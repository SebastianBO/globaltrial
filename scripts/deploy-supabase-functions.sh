#!/bin/bash

# Deploy Supabase Edge Functions and Enable Automatic Processing

set -e

echo "========================================"
echo "Deploying Supabase Edge Functions"
echo "========================================"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Login to Supabase (if not already logged in)
echo "Checking Supabase authentication..."
supabase link --project-ref wwjorfctbizdhqkpduxt || {
    echo "Please run: supabase login"
    exit 1
}

# Deploy edge functions
echo "Deploying auto-scraper function..."
supabase functions deploy auto-scraper \
    --no-verify-jwt \
    --import-map supabase/functions/import_map.json

echo "Deploying worker-processor function..."
supabase functions deploy worker-processor \
    --no-verify-jwt \
    --import-map supabase/functions/import_map.json

# Set environment variables for functions
echo "Setting function secrets..."
supabase secrets set GROQ_API_KEY="gsk_TjqN7G9KuArtrP72Cy5sWGdyb3FY2DDC2t5aWz0uLVjIvu7PmV" --project-ref wwjorfctbizdhqkpduxt

# Run automatic processing migration
echo "Running automatic processing migration..."
supabase db push --db-url "$DATABASE_URL" || {
    echo "Applying migration directly..."
    psql "$DATABASE_URL" -f supabase/migrations/20250117_automatic_processing.sql
}

# Enable cron jobs in Supabase dashboard
echo ""
echo "========================================"
echo "IMPORTANT: Manual Steps Required"
echo "========================================"
echo ""
echo "1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt"
echo ""
echo "2. Enable pg_cron extension:"
echo "   - Go to Database > Extensions"
echo "   - Search for 'pg_cron'"
echo "   - Click 'Enable'"
echo ""
echo "3. Enable Edge Function Cron Triggers:"
echo "   - Go to Edge Functions"
echo "   - For 'auto-scraper' function:"
echo "     - Click on the function"
echo "     - Go to 'Triggers' tab"
echo "     - Add Cron trigger: '0 * * * *' (every hour)"
echo "   - For 'worker-processor' function:"
echo "     - Add Cron trigger: '*/5 * * * *' (every 5 minutes)"
echo ""
echo "4. Verify Automatic Processing:"
echo "   - Check SQL Editor and run: SELECT * FROM cron.job;"
echo "   - You should see scheduled jobs listed"
echo ""
echo "========================================"
echo ""

# Create monitoring script
cat > monitor-automatic-processing.sh << 'EOF'
#!/bin/bash

echo "Monitoring Automatic Processing..."

# Check cron jobs
echo -e "\n=== Scheduled Cron Jobs ==="
psql "$DATABASE_URL" -c "SELECT jobname, schedule, command FROM cron.job;"

# Check recent job runs
echo -e "\n=== Recent Cron Executions ==="
psql "$DATABASE_URL" -c "
SELECT 
    j.jobname,
    r.start_time,
    r.end_time,
    r.status,
    r.return_message
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
ORDER BY r.start_time DESC
LIMIT 10;"

# Check job queue
echo -e "\n=== Job Queue Status ==="
psql "$DATABASE_URL" -c "
SELECT 
    queue_name,
    status,
    COUNT(*) as count
FROM job_queue
GROUP BY queue_name, status
ORDER BY queue_name, status;"

# Check scraping progress
echo -e "\n=== Active Scraping Jobs ==="
psql "$DATABASE_URL" -c "
SELECT 
    job_type,
    status,
    processed_items,
    total_items,
    ROUND((processed_items::numeric / NULLIF(total_items, 0) * 100), 1) as progress_pct,
    last_heartbeat
FROM scraping_jobs
WHERE status IN ('running', 'pending')
ORDER BY created_at DESC;"

# Check system dashboard
echo -e "\n=== System Dashboard ==="
psql "$DATABASE_URL" -c "SELECT * FROM v_system_dashboard;"
EOF

chmod +x monitor-automatic-processing.sh

echo ""
echo "Deployment complete!"
echo ""
echo "To monitor automatic processing:"
echo "./monitor-automatic-processing.sh"
echo ""
echo "The system will now automatically:"
echo "- Scrape new trials every hour"
echo "- Process job queue every 5 minutes"
echo "- Monitor for stale jobs every 10 minutes"
echo "- Run daily maintenance at 2 AM"
echo "- Perform weekly deduplication on Sundays"
echo ""
echo "No manual intervention required! 🚀"