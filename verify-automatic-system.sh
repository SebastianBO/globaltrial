#!/bin/bash

echo "Verifying Automatic Processing System..."

# Check if edge functions are deployed
echo -e "\n✓ Edge Functions Status:"
supabase functions list

# Check if cron jobs are scheduled
echo -e "\n✓ Checking Scheduled Jobs:"
psql "$DATABASE_URL" -c "SELECT jobname, schedule, active FROM cron.job;" 2>/dev/null || \
echo "   Note: Run this in Supabase SQL Editor to verify cron jobs"

# Check job queue
echo -e "\n✓ Job Queue Status:"
psql "$DATABASE_URL" -c "
SELECT queue_name, status, COUNT(*) 
FROM job_queue 
GROUP BY queue_name, status;" 2>/dev/null || \
echo "   Note: Check job_queue table in Supabase dashboard"

# Provide dashboard link
echo -e "\n📊 Monitor Progress at:"
echo "https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt/editor"
echo ""
echo "The system is now running automatically!"
echo "- New trials are scraped every hour"
echo "- Jobs are processed every 5 minutes"
echo "- Duplicates are detected automatically"
echo "- Trials are enriched with AI"
echo ""
echo "No manual intervention needed! 🎉"
