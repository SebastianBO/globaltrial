-- Automatic Processing Setup for GlobalTrials
-- This migration sets up triggers, cron jobs, and automatic processing

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to automatically queue enrichment jobs
CREATE OR REPLACE FUNCTION queue_trial_enrichment()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue enrichment job for new trials
  IF NEW.layman_description IS NULL THEN
    INSERT INTO job_queue (
      job_type,
      payload,
      priority,
      queue_name
    ) VALUES (
      'enrich_trial',
      jsonb_build_object('trial_id', NEW.id),
      5,
      'enrichment'
    );
  END IF;
  
  -- Queue geocoding if locations exist but not geocoded
  IF NEW.locations IS NOT NULL AND NEW.locations_geocoded IS NULL THEN
    INSERT INTO job_queue (
      job_type,
      payload,
      priority,
      queue_name
    ) VALUES (
      'geocode_locations',
      jsonb_build_object('trial_id', NEW.id),
      4,
      'enrichment'
    );
  END IF;
  
  -- Queue duplicate check
  IF NEW.duplicate_check_date IS NULL THEN
    INSERT INTO job_queue (
      job_type,
      payload,
      priority,
      queue_name
    ) VALUES (
      'check_duplicates',
      jsonb_build_object('trial_id', NEW.id),
      3,
      'default'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new trials
DROP TRIGGER IF EXISTS auto_enrich_trials ON clinical_trials;
CREATE TRIGGER auto_enrich_trials
  AFTER INSERT ON clinical_trials
  FOR EACH ROW
  EXECUTE FUNCTION queue_trial_enrichment();

-- Create function to monitor and restart stale jobs
CREATE OR REPLACE FUNCTION monitor_stale_jobs()
RETURNS void AS $$
DECLARE
  stale_job RECORD;
BEGIN
  -- Find stale scraping jobs
  FOR stale_job IN 
    SELECT * FROM scraping_jobs
    WHERE status = 'running'
    AND last_heartbeat < NOW() - INTERVAL '10 minutes'
  LOOP
    -- Mark as failed and create alert
    UPDATE scraping_jobs
    SET status = 'failed',
        error_log = error_log || jsonb_build_array(jsonb_build_object(
          'timestamp', NOW(),
          'error', 'Job timeout - no heartbeat'
        ))
    WHERE id = stale_job.id;
    
    -- Queue retry if under max retries
    IF stale_job.retry_count < stale_job.max_retries THEN
      INSERT INTO job_queue (
        job_type,
        payload,
        priority,
        queue_name
      ) VALUES (
        'resume_scraping',
        jsonb_build_object('original_job_id', stale_job.id),
        8,
        'scraping'
      );
    END IF;
  END LOOP;
  
  -- Release stale job queue locks
  UPDATE job_queue
  SET status = 'pending',
      locked_at = NULL,
      locked_by = NULL,
      last_error = 'Released due to stale lock'
  WHERE status = 'processing'
  AND locked_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create function to trigger incremental scraping
CREATE OR REPLACE FUNCTION trigger_incremental_scrape()
RETURNS void AS $$
DECLARE
  last_scrape TIMESTAMP;
  edge_function_url TEXT;
BEGIN
  -- Get last successful scrape
  SELECT MAX(completed_at) INTO last_scrape
  FROM scraping_jobs
  WHERE job_type = 'incremental'
  AND status = 'completed';
  
  -- Default to 24 hours ago if no previous scrape
  IF last_scrape IS NULL THEN
    last_scrape := NOW() - INTERVAL '24 hours';
  END IF;
  
  -- Get edge function URL
  edge_function_url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-scraper';
  
  -- Call edge function
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'action', 'scrape',
      'since_date', last_scrape
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to process job queue
CREATE OR REPLACE FUNCTION process_job_queue()
RETURNS void AS $$
BEGIN
  -- Call worker processor edge function
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/worker-processor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('action', 'process')
  );
END;
$$ LANGUAGE plpgsql;

-- Create function for daily maintenance
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS void AS $$
BEGIN
  -- Clean up old metrics
  DELETE FROM system_metrics
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Archive completed jobs
  INSERT INTO job_queue_archive
  SELECT * FROM job_queue
  WHERE status IN ('completed', 'failed')
  AND completed_at < NOW() - INTERVAL '7 days';
  
  DELETE FROM job_queue
  WHERE status IN ('completed', 'failed')
  AND completed_at < NOW() - INTERVAL '7 days';
  
  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_trials_summary;
  
  -- Vacuum tables
  VACUUM ANALYZE clinical_trials;
  VACUUM ANALYZE job_queue;
  
  -- Generate daily report
  INSERT INTO daily_reports (
    date,
    stats,
    created_at
  ) VALUES (
    CURRENT_DATE - INTERVAL '1 day',
    jsonb_build_object(
      'total_trials', (SELECT COUNT(*) FROM clinical_trials),
      'active_trials', (SELECT COUNT(*) FROM clinical_trials WHERE is_active = true),
      'trials_added_yesterday', (SELECT COUNT(*) FROM clinical_trials WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day'),
      'jobs_processed', (SELECT COUNT(*) FROM job_queue WHERE completed_at::date = CURRENT_DATE - INTERVAL '1 day'),
      'duplicates_found', (SELECT COUNT(*) FROM trial_duplicates WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day')
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Create job queue archive table
CREATE TABLE IF NOT EXISTS job_queue_archive (
  LIKE job_queue INCLUDING ALL
);

-- Create daily reports table
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  stats JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule cron jobs using pg_cron
-- These will run automatically without any manual intervention

-- Every 5 minutes: Process job queue
SELECT cron.schedule(
  'process-job-queue',
  '*/5 * * * *',
  'SELECT process_job_queue();'
);

-- Every hour: Incremental scraping
SELECT cron.schedule(
  'incremental-scrape',
  '0 * * * *',
  'SELECT trigger_incremental_scrape();'
);

-- Every 10 minutes: Monitor stale jobs
SELECT cron.schedule(
  'monitor-stale-jobs',
  '*/10 * * * *',
  'SELECT monitor_stale_jobs();'
);

-- Daily at 2 AM: Full maintenance
SELECT cron.schedule(
  'daily-maintenance',
  '0 2 * * *',
  'SELECT daily_maintenance();'
);

-- Weekly on Sunday at 3 AM: Full deduplication
SELECT cron.schedule(
  'weekly-deduplication',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-scraper',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('action', 'deduplicate')
  );
  $$
);

-- Create initial scraping job on deployment
DO $$
BEGIN
  -- Check if we have any trials
  IF NOT EXISTS (SELECT 1 FROM clinical_trials LIMIT 1) THEN
    -- No trials exist, queue full scrape
    INSERT INTO job_queue (
      job_type,
      payload,
      priority,
      queue_name
    ) VALUES (
      'scrape_full',
      jsonb_build_object('auto_start', true),
      10,
      'scraping'
    );
    
    -- Also queue MeSH import
    INSERT INTO job_queue (
      job_type,
      payload,
      priority,
      queue_name
    ) VALUES (
      'import_mesh_terms',
      jsonb_build_object('auto_start', true),
      9,
      'default'
    );
  END IF;
END $$;

-- Create monitoring dashboard view
CREATE OR REPLACE VIEW v_system_dashboard AS
SELECT 
  -- Trial statistics
  (SELECT COUNT(*) FROM clinical_trials) as total_trials,
  (SELECT COUNT(*) FROM clinical_trials WHERE is_active = true) as active_trials,
  (SELECT COUNT(*) FROM clinical_trials WHERE created_at > NOW() - INTERVAL '24 hours') as trials_added_24h,
  
  -- Job statistics
  (SELECT COUNT(*) FROM job_queue WHERE status = 'pending') as pending_jobs,
  (SELECT COUNT(*) FROM job_queue WHERE status = 'processing') as processing_jobs,
  (SELECT COUNT(*) FROM job_queue WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') as failed_jobs_24h,
  
  -- Scraping statistics
  (SELECT COUNT(*) FROM scraping_jobs WHERE status = 'running') as active_scraping_jobs,
  (SELECT SUM(processed_items) FROM scraping_jobs WHERE completed_at > NOW() - INTERVAL '24 hours') as items_scraped_24h,
  
  -- System health
  (SELECT COUNT(*) FROM system_alerts WHERE severity IN ('critical', 'high') AND acknowledged = false) as unacked_alerts,
  NOW() as dashboard_updated;

-- Grant permissions
GRANT SELECT ON v_system_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION process_job_queue TO authenticated;
GRANT EXECUTE ON FUNCTION monitor_stale_jobs TO authenticated;

-- Create index for cron job execution
CREATE INDEX IF NOT EXISTS idx_cron_job_run_at ON cron.job_run_details(runid, job_id, start_time);