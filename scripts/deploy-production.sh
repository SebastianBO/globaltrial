#!/bin/bash

# GlobalTrials Production Deployment Script
# This script runs the full production deployment of the clinical trials platform

set -e  # Exit on error

echo "========================================"
echo "GlobalTrials Production Deployment"
echo "========================================"

# Check environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "Error: Supabase environment variables not set"
    echo "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    exit 1
fi

# Function to run SQL migrations
run_migrations() {
    echo "Running database migrations..."
    
    # Apply production scale infrastructure
    npx supabase db push --db-url "$DATABASE_URL" || {
        echo "Using direct SQL execution..."
        psql "$DATABASE_URL" -f supabase/migrations/20250117_production_scale_infrastructure.sql
    }
    
    # Apply terminology data
    if [ -f "INSERT_TERMINOLOGY_DATA.sql" ]; then
        echo "Inserting medical terminology mappings..."
        psql "$DATABASE_URL" -f INSERT_TERMINOLOGY_DATA.sql
    fi
    
    echo "✓ Migrations completed"
}

# Function to install dependencies
install_dependencies() {
    echo "Installing dependencies..."
    
    # Install Node.js dependencies
    npm install --save \
        p-limit \
        fast-xml-parser \
        uuid \
        @supabase/supabase-js
    
    # Install TypeScript types
    npm install --save-dev \
        @types/node \
        @types/uuid
    
    echo "✓ Dependencies installed"
}

# Function to build TypeScript files
build_typescript() {
    echo "Building TypeScript files..."
    
    # Create tsconfig for scraper if it doesn't exist
    if [ ! -f "tsconfig.scraper.json" ]; then
        cat > tsconfig.scraper.json << EOF
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "./dist/scraper",
    "rootDir": "./lib/scraper",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["lib/scraper/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
    fi
    
    # Build scraper modules
    npx tsc -p tsconfig.scraper.json
    
    echo "✓ TypeScript build completed"
}

# Function to start the orchestrator
start_orchestrator() {
    echo "Starting job orchestrator..."
    
    # Create log directory
    mkdir -p logs
    
    # Start orchestrator in background
    nohup node dist/scraper/job-orchestrator.js start > logs/orchestrator.log 2>&1 &
    
    # Save PID
    echo $! > orchestrator.pid
    
    echo "✓ Orchestrator started (PID: $(cat orchestrator.pid))"
}

# Function to initiate full scrape
initiate_scrape() {
    echo "Initiating full clinical trials scrape..."
    
    # Start ClinicalTrials.gov scrape
    node dist/scraper/job-orchestrator.js scrape
    
    # Import MeSH database
    echo "Starting MeSH import..."
    node dist/scraper/job-orchestrator.js mesh
    
    # Wait a bit for jobs to start
    sleep 5
    
    # Check status
    node dist/scraper/job-orchestrator.js status
    
    echo "✓ Scraping jobs initiated"
}

# Function to monitor progress
monitor_progress() {
    echo "Monitoring scraping progress..."
    
    # Create monitoring script
    cat > monitor-progress.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function monitor() {
    // Get scraping job status
    const { data: jobs } = await supabase
        .from('scraping_jobs')
        .select('*')
        .in('status', ['running', 'pending'])
        .order('created_at', { ascending: false });
    
    console.log('\n=== Active Scraping Jobs ===');
    for (const job of jobs || []) {
        const progress = job.processed_items && job.total_items 
            ? `${((job.processed_items / job.total_items) * 100).toFixed(1)}%`
            : 'N/A';
        console.log(`Job ${job.id}: ${job.job_type} - ${job.status} - Progress: ${progress}`);
    }
    
    // Get queue depth
    const { data: queues } = await supabase
        .from('job_queue')
        .select('queue_name, status, count(*)', { count: 'exact' })
        .group('queue_name, status');
    
    console.log('\n=== Job Queue Status ===');
    for (const q of queues || []) {
        console.log(`${q.queue_name}/${q.status}: ${q.count}`);
    }
    
    // Get trial count
    const { data: trialCount } = await supabase
        .from('clinical_trials')
        .select('count(*)', { count: 'exact' });
    
    console.log(`\n=== Total Trials: ${trialCount?.[0]?.count || 0} ===\n`);
}

// Monitor every 30 seconds
setInterval(monitor, 30000);
monitor();
EOF

    # Run monitor in background
    nohup node monitor-progress.js > logs/monitor.log 2>&1 &
    echo $! > monitor.pid
    
    echo "✓ Monitoring started (PID: $(cat monitor.pid))"
}

# Main deployment flow
main() {
    echo "Starting deployment at $(date)"
    
    # Step 1: Install dependencies
    install_dependencies
    
    # Step 2: Run migrations
    run_migrations
    
    # Step 3: Build TypeScript
    build_typescript
    
    # Step 4: Start orchestrator
    start_orchestrator
    
    # Step 5: Initiate scraping
    initiate_scrape
    
    # Step 6: Start monitoring
    monitor_progress
    
    echo ""
    echo "========================================"
    echo "Deployment completed successfully!"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "1. Monitor progress: tail -f logs/orchestrator.log"
    echo "2. Check scraping status: node dist/scraper/job-orchestrator.js status"
    echo "3. View real-time metrics: tail -f logs/monitor.log"
    echo ""
    echo "To stop services:"
    echo "- kill $(cat orchestrator.pid 2>/dev/null || echo 'N/A')"
    echo "- kill $(cat monitor.pid 2>/dev/null || echo 'N/A')"
    echo ""
    echo "Production URL: $NEXT_PUBLIC_SUPABASE_URL"
}

# Handle command line arguments
case "${1}" in
    "migrate")
        run_migrations
        ;;
    "build")
        build_typescript
        ;;
    "start")
        start_orchestrator
        ;;
    "scrape")
        initiate_scrape
        ;;
    "monitor")
        monitor_progress
        ;;
    "stop")
        if [ -f "orchestrator.pid" ]; then
            kill $(cat orchestrator.pid) && rm orchestrator.pid
            echo "Orchestrator stopped"
        fi
        if [ -f "monitor.pid" ]; then
            kill $(cat monitor.pid) && rm monitor.pid
            echo "Monitor stopped"
        fi
        ;;
    *)
        main
        ;;
esac