# GlobalTrials Production Deployment Guide

## Overview
This guide covers the deployment of the production-ready GlobalTrials platform capable of processing 400,000+ clinical trials from multiple registries.

## Architecture Components

### 1. Distributed Scraper System
- **ClinicalTrialsScaper**: Handles ClinicalTrials.gov API with checkpointing and rate limiting
- **JobWorker**: Processes jobs from distributed queue
- **JobOrchestrator**: Manages workers with auto-scaling
- **MonitoringService**: Real-time health checks and alerting

### 2. Database Infrastructure
- Production-scale migrations with proper indexes
- Job queue for distributed processing
- Scraping checkpoints for failure recovery
- Duplicate detection system
- MeSH terminology database

### 3. Key Features
- ✅ Distributed job processing with auto-scaling workers
- ✅ Checkpoint-based recovery from failures
- ✅ Rate limiting and exponential backoff
- ✅ Real-time monitoring and alerting
- ✅ Intelligent deduplication across registries
- ✅ MeSH term import and mapping
- ✅ AI-powered trial enrichment

## Quick Start

### 1. Prerequisites
```bash
# Install dependencies
npm install

# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export DATABASE_URL="postgresql://..."
```

### 2. Deploy Everything
```bash
# Run full deployment
./scripts/deploy-production.sh
```

This will:
1. Install all dependencies
2. Run database migrations
3. Build TypeScript files
4. Start the job orchestrator
5. Initiate full scraping
6. Start monitoring

### 3. Monitor Progress
```bash
# View orchestrator logs
tail -f logs/orchestrator.log

# Check job status
node dist/scraper/job-orchestrator.js status

# View real-time metrics
tail -f logs/monitor.log
```

## Manual Operations

### Run Specific Tasks
```bash
# Start orchestrator only
./scripts/deploy-production.sh start

# Run migrations only
./scripts/deploy-production.sh migrate

# Initiate scraping
node dist/scraper/job-orchestrator.js scrape

# Import MeSH database
node dist/scraper/job-orchestrator.js mesh

# Run deduplication
node dist/scraper/job-orchestrator.js dedupe

# Enrich trials with AI
node dist/scraper/job-orchestrator.js enrich
```

### Scale Workers
The orchestrator auto-scales workers based on load, but you can configure:
```javascript
// In job-orchestrator.ts
const orchestrator = new JobOrchestrator(url, key, {
  workerCount: 4,      // Initial workers
  minWorkers: 2,       // Minimum workers
  maxWorkers: 20,      // Maximum workers
  autoScale: true      // Enable auto-scaling
});
```

## Database Queries

### Check Progress
```sql
-- Total trials by source
SELECT source, COUNT(*) as count 
FROM clinical_trials 
GROUP BY source;

-- Active scraping jobs
SELECT * FROM scraping_jobs 
WHERE status = 'running';

-- Job queue depth
SELECT queue_name, status, COUNT(*) 
FROM job_queue 
GROUP BY queue_name, status;

-- Recent errors
SELECT * FROM system_alerts 
WHERE severity IN ('critical', 'high') 
AND created_at > NOW() - INTERVAL '1 hour';
```

### Monitor Performance
```sql
-- Scraping speed
SELECT 
  job_type,
  AVG(processed_items / EXTRACT(EPOCH FROM (completed_at - started_at)) * 60) as items_per_minute
FROM scraping_jobs
WHERE status = 'completed'
GROUP BY job_type;

-- Duplicate detection results
SELECT match_type, COUNT(*) 
FROM trial_duplicates 
GROUP BY match_type;
```

## Troubleshooting

### Common Issues

1. **Workers timing out**
   - Check `last_heartbeat` in scraping_jobs table
   - Increase worker timeout in monitoring service
   - Check for network issues

2. **High failure rate**
   - Check job_queue for error messages
   - Review system_alerts table
   - Check API rate limits

3. **Slow scraping**
   - Increase worker count
   - Check rate limiting settings
   - Optimize database indexes

### Recovery Procedures

1. **Resume failed scraping job**
```bash
# Job will automatically resume from checkpoint
node dist/scraper/job-orchestrator.js scrape
```

2. **Clear stale locks**
```sql
UPDATE job_queue 
SET status = 'pending', locked_at = NULL, locked_by = NULL 
WHERE status = 'processing' 
AND locked_at < NOW() - INTERVAL '5 minutes';
```

3. **Reprocess failed jobs**
```sql
UPDATE job_queue 
SET status = 'pending', attempts = 0 
WHERE status = 'failed' 
AND created_at > NOW() - INTERVAL '1 day';
```

## Performance Optimization

### Database Tuning
```sql
-- Update table statistics
ANALYZE clinical_trials;
ANALYZE job_queue;
ANALYZE scraping_jobs;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_trials_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mesh_with_synonyms;
```

### Monitoring Dashboard
Access the monitoring dashboard:
```javascript
const monitoring = new MonitoringService(url, key);
const dashboard = await monitoring.getDashboardMetrics();
console.log(JSON.stringify(dashboard, null, 2));
```

## Expected Results

After full deployment:
- **24 hours**: ~50,000 trials scraped
- **48 hours**: 400,000+ trials indexed
- **Deduplication**: 5-10% duplicates identified
- **MeSH Import**: 30,000+ medical terms
- **Query Performance**: <100ms for most searches

## Next Steps

1. **Add More Registries**
   - EU Clinical Trials Register
   - WHO ICTRP
   - ISRCTN
   - CTIS

2. **Enable AI Features**
   - Eligibility translator
   - Patient matching
   - Risk prediction

3. **Production Monitoring**
   - Set up Grafana dashboards
   - Configure PagerDuty alerts
   - Enable APM tracking

## Support

For issues or questions:
1. Check logs in `/logs` directory
2. Query system_alerts table
3. Review monitoring metrics
4. Check GitHub issues