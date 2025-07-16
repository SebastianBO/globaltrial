-- Production Scale Infrastructure Migration for GlobalTrials
-- This migration prepares the database for handling 400k+ clinical trials

-- Add missing columns to clinical_trials table
ALTER TABLE clinical_trials
ADD COLUMN IF NOT EXISTS compensation_amount INTEGER,
ADD COLUMN IF NOT EXISTS compensation_currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) CHECK (urgency_level IN ('critical', 'high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS last_verified_date DATE,
ADD COLUMN IF NOT EXISTS registry_last_updated TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS data_quality_score NUMERIC(3,2) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
ADD COLUMN IF NOT EXISTS eligibility_parsed JSONB,
ADD COLUMN IF NOT EXISTS locations_geocoded JSONB,
ADD COLUMN IF NOT EXISTS intervention_types TEXT[],
ADD COLUMN IF NOT EXISTS primary_outcome_timeframe VARCHAR(255),
ADD COLUMN IF NOT EXISTS enrollment_target INTEGER,
ADD COLUMN IF NOT EXISTS enrollment_actual INTEGER;

-- Create job tracking table for distributed scraping
CREATE TABLE IF NOT EXISTS scraping_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('full_scrape', 'incremental', 'condition_based', 'date_range', 'registry_sync')),
    registry VARCHAR(50) NOT NULL DEFAULT 'clinicaltrials.gov',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused', 'cancelled')),
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    progress JSONB DEFAULT '{}'::jsonb,
    checkpoint_data JSONB DEFAULT '{}'::jsonb,
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    error_log JSONB DEFAULT '[]'::jsonb,
    worker_id VARCHAR(100),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for job management
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status, priority DESC, created_at);
CREATE INDEX idx_scraping_jobs_worker ON scraping_jobs(worker_id, last_heartbeat);

-- Create duplicate tracking table
CREATE TABLE IF NOT EXISTS trial_duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_trial_id UUID NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
    duplicate_trial_id UUID NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    match_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
    match_type VARCHAR(20) CHECK (match_type IN ('exact', 'fuzzy', 'probable', 'possible')),
    verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(100),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(primary_trial_id, duplicate_trial_id),
    CHECK (primary_trial_id != duplicate_trial_id)
);

-- Create job queue for distributed processing
CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(50) NOT NULL DEFAULT 'default',
    job_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(100),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    completed_at TIMESTAMPTZ,
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for job queue
CREATE INDEX idx_job_queue_next ON job_queue(queue_name, status, priority DESC, scheduled_for) 
WHERE status = 'pending';
CREATE INDEX idx_job_queue_locked ON job_queue(locked_by, locked_at) 
WHERE status = 'processing';

-- Create scraping checkpoints table
CREATE TABLE IF NOT EXISTS scraping_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES scraping_jobs(id) ON DELETE CASCADE,
    checkpoint_type VARCHAR(50) NOT NULL,
    checkpoint_data JSONB NOT NULL,
    items_processed INTEGER DEFAULT 0,
    last_item_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scraping_checkpoints_job ON scraping_checkpoints(job_id, created_at DESC);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_name VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255),
    requests_made INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    window_duration_minutes INTEGER DEFAULT 1,
    max_requests INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(api_name, endpoint, window_start)
);

-- Create monitoring metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    tags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_lookup ON system_metrics(metric_type, metric_name, created_at DESC);

-- Create trial source tracking
CREATE TABLE IF NOT EXISTS trial_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trial_id UUID NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
    source_registry VARCHAR(50) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    source_url TEXT,
    last_fetched_at TIMESTAMPTZ,
    source_last_updated TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_registry, source_id)
);

-- Performance indexes for clinical_trials
CREATE INDEX IF NOT EXISTS idx_trials_compensation ON clinical_trials(compensation_amount) WHERE compensation_amount IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trials_urgency ON clinical_trials(urgency_level) WHERE urgency_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trials_active ON clinical_trials(is_active, last_updated DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trials_location_gin ON clinical_trials USING GIN(locations);
CREATE INDEX IF NOT EXISTS idx_trials_conditions_gin ON clinical_trials USING GIN(conditions);
CREATE INDEX IF NOT EXISTS idx_trials_intervention_types ON clinical_trials USING GIN(intervention_types);
CREATE INDEX IF NOT EXISTS idx_trials_registry_update ON clinical_trials(source, registry_last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_trials_enrollment ON clinical_trials(enrollment_target, enrollment_actual);

-- Create trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create text search indexes for better matching
CREATE INDEX IF NOT EXISTS idx_trials_title_trgm ON clinical_trials USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trials_description_trgm ON clinical_trials USING GIN(description gin_trgm_ops);

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DROP TRIGGER IF EXISTS update_scraping_jobs_updated_at ON scraping_jobs;
CREATE TRIGGER update_scraping_jobs_updated_at BEFORE UPDATE ON scraping_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_queue_updated_at ON job_queue;
CREATE TRIGGER update_job_queue_updated_at BEFORE UPDATE ON job_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check for stale jobs
CREATE OR REPLACE FUNCTION check_stale_jobs()
RETURNS TABLE(job_id UUID, job_type VARCHAR, last_heartbeat TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT id, job_type, last_heartbeat
    FROM scraping_jobs
    WHERE status = 'running'
    AND last_heartbeat < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Function to acquire job from queue
CREATE OR REPLACE FUNCTION acquire_next_job(
    p_queue_name VARCHAR DEFAULT 'default',
    p_worker_id VARCHAR DEFAULT NULL
)
RETURNS TABLE(
    job_id UUID,
    job_type VARCHAR,
    payload JSONB
) AS $$
DECLARE
    v_job_id UUID;
BEGIN
    -- Lock the next available job
    SELECT id INTO v_job_id
    FROM job_queue
    WHERE queue_name = p_queue_name
    AND status = 'pending'
    AND scheduled_for <= NOW()
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF v_job_id IS NOT NULL THEN
        -- Update the job as processing
        UPDATE job_queue
        SET status = 'processing',
            locked_at = NOW(),
            locked_by = p_worker_id,
            attempts = attempts + 1
        WHERE id = v_job_id;
        
        -- Return the job details
        RETURN QUERY
        SELECT jq.id, jq.job_type, jq.payload
        FROM job_queue jq
        WHERE jq.id = v_job_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate trial similarity
CREATE OR REPLACE FUNCTION calculate_trial_similarity(
    trial1_id UUID,
    trial2_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
    t1 RECORD;
    t2 RECORD;
    title_sim NUMERIC;
    sponsor_sim NUMERIC;
    condition_sim NUMERIC;
    intervention_sim NUMERIC;
    total_score NUMERIC;
BEGIN
    -- Get trial data
    SELECT * INTO t1 FROM clinical_trials WHERE id = trial1_id;
    SELECT * INTO t2 FROM clinical_trials WHERE id = trial2_id;
    
    -- Calculate similarities
    title_sim := similarity(t1.title, t2.title);
    sponsor_sim := similarity(COALESCE(t1.sponsor, ''), COALESCE(t2.sponsor, ''));
    
    -- Calculate weighted average
    total_score := (title_sim * 0.4 + sponsor_sim * 0.3 + 0.3); -- Simplified for now
    
    RETURN total_score;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_active_trials_summary AS
SELECT 
    source,
    COUNT(*) as total_trials,
    COUNT(DISTINCT sponsor) as unique_sponsors,
    COUNT(DISTINCT UNNEST(conditions)) as unique_conditions,
    AVG(enrollment_target) as avg_enrollment_target,
    COUNT(CASE WHEN compensation_amount > 0 THEN 1 END) as paid_trials,
    MAX(last_updated) as last_update
FROM clinical_trials
WHERE is_active = true
GROUP BY source;

CREATE UNIQUE INDEX ON mv_active_trials_summary(source);

-- Grant permissions (adjust based on your roles)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;