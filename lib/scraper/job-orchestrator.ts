import { createClient } from '@supabase/supabase-js';
import { JobWorker } from './job-worker';
import { MonitoringService } from './monitoring-service';
import { v4 as uuidv4 } from 'uuid';

interface OrchestratorConfig {
  workerCount: number;
  queues: string[];
  autoScale: boolean;
  maxWorkers: number;
  minWorkers: number;
}

export class JobOrchestrator {
  private supabase: any;
  private workers: JobWorker[] = [];
  private monitoring: MonitoringService;
  private config: OrchestratorConfig;
  private isRunning: boolean = false;
  private autoScaleInterval?: NodeJS.Timer;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.monitoring = new MonitoringService(supabaseUrl, supabaseKey);
    
    this.config = {
      workerCount: 4,
      queues: ['default', 'scraping', 'enrichment'],
      autoScale: true,
      maxWorkers: 20,
      minWorkers: 2,
      ...config
    };
  }

  async start(): Promise<void> {
    console.log('Starting job orchestrator...');
    this.isRunning = true;

    // Start monitoring
    this.monitoring.on('alert', (alert) => this.handleAlert(alert));

    // Start initial workers
    await this.scaleWorkers(this.config.workerCount);

    // Start auto-scaling if enabled
    if (this.config.autoScale) {
      this.startAutoScaling();
    }

    // Start orchestration loop
    this.startOrchestrationLoop();

    console.log(`Orchestrator started with ${this.workers.length} workers`);
  }

  async stop(): Promise<void> {
    console.log('Stopping job orchestrator...');
    this.isRunning = false;

    if (this.autoScaleInterval) {
      clearInterval(this.autoScaleInterval);
    }

    // Stop all workers
    for (const worker of this.workers) {
      await worker.shutdown();
    }

    this.workers = [];
    console.log('Orchestrator stopped');
  }

  async initiateFullScrape(): Promise<string> {
    console.log('Initiating full ClinicalTrials.gov scrape...');

    // Create master scraping job
    const jobId = uuidv4();
    const { data: scrapingJob, error } = await this.supabase
      .from('scraping_jobs')
      .insert({
        id: jobId,
        job_type: 'full_scrape',
        registry: 'clinicaltrials.gov',
        status: 'pending',
        progress: {},
        checkpoint_data: {},
        priority: 10
      })
      .select()
      .single();

    if (error) throw error;

    // Queue the job
    await this.queueJob({
      job_type: 'scrape_trials_full',
      payload: { scraping_job_id: jobId },
      priority: 10,
      queue_name: 'scraping'
    });

    // Also queue condition-based scrapers for redundancy
    const conditions = [
      'cancer', 'diabetes', 'heart disease', 'alzheimer', 'covid-19',
      'depression', 'anxiety', 'obesity', 'hypertension', 'asthma',
      'arthritis', 'stroke', 'parkinson', 'epilepsy', 'autism',
      'copd', 'kidney disease', 'liver disease', 'multiple sclerosis',
      'inflammatory bowel disease', 'lupus', 'fibromyalgia', 'migraine',
      'psoriasis', 'rheumatoid arthritis'
    ];

    for (const condition of conditions) {
      await this.queueJob({
        job_type: 'scrape_trials_condition',
        payload: { condition },
        priority: 5,
        queue_name: 'scraping'
      });
    }

    return jobId;
  }

  async initiateMeshImport(): Promise<string> {
    console.log('Initiating MeSH database import...');

    const jobId = await this.queueJob({
      job_type: 'import_mesh_terms',
      payload: {},
      priority: 8,
      queue_name: 'default'
    });

    return jobId;
  }

  async initiateDeduplication(batchSize: number = 5000): Promise<string> {
    console.log('Initiating trial deduplication...');

    const jobId = await this.queueJob({
      job_type: 'deduplicate_trials',
      payload: { batch_size: batchSize },
      priority: 6,
      queue_name: 'default'
    });

    return jobId;
  }

  async initiateTrialEnrichment(): Promise<void> {
    console.log('Initiating trial enrichment...');

    // Get trials that need enrichment
    const { data: trials } = await this.supabase
      .from('clinical_trials')
      .select('id')
      .is('layman_description', null)
      .limit(1000);

    for (const trial of trials || []) {
      await this.queueJob({
        job_type: 'enrich_trial',
        payload: { trial_id: trial.id },
        priority: 3,
        queue_name: 'enrichment'
      });
    }
  }

  private async queueJob(jobData: any): Promise<string> {
    const job = {
      id: uuidv4(),
      ...jobData,
      status: 'pending',
      created_at: new Date()
    };

    const { error } = await this.supabase
      .from('job_queue')
      .insert(job);

    if (error) throw error;

    return job.id;
  }

  private startOrchestrationLoop(): void {
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // Check for scheduled tasks
        await this.checkScheduledTasks();

        // Monitor job progress
        await this.monitorJobProgress();

        // Handle failed jobs
        await this.handleFailedJobs();

      } catch (error) {
        console.error('Orchestration loop error:', error);
      }
    }, 60000); // Every minute
  }

  private async checkScheduledTasks(): Promise<void> {
    const now = new Date();
    const hour = now.getHours();

    // Run incremental scrape daily at 2 AM
    if (hour === 2 && now.getMinutes() === 0) {
      await this.queueJob({
        job_type: 'scrape_trials_incremental',
        payload: { since_date: new Date(Date.now() - 86400000) }, // Last 24 hours
        priority: 7,
        queue_name: 'scraping'
      });
    }

    // Run deduplication daily at 4 AM
    if (hour === 4 && now.getMinutes() === 0) {
      await this.initiateDeduplication();
    }

    // Generate reports daily at 6 AM
    if (hour === 6 && now.getMinutes() === 0) {
      await this.generateDailyReport();
    }
  }

  private async monitorJobProgress(): Promise<void> {
    // Get job statistics
    const { data: stats } = await this.supabase
      .from('job_queue')
      .select('queue_name, status, count(*)', { count: 'exact' })
      .group('queue_name, status');

    // Log progress
    for (const stat of stats || []) {
      console.log(`Queue ${stat.queue_name} - ${stat.status}: ${stat.count}`);
    }

    // Check for queue backlogs
    const pendingByQueue = new Map<string, number>();
    for (const stat of stats || []) {
      if (stat.status === 'pending') {
        pendingByQueue.set(stat.queue_name, stat.count);
      }
    }

    // Scale workers based on queue depth
    if (this.config.autoScale) {
      for (const [queue, pending] of pendingByQueue) {
        if (pending > 100 && this.workers.length < this.config.maxWorkers) {
          console.log(`Scaling up workers for queue ${queue}`);
          await this.scaleWorkers(this.workers.length + 1);
        }
      }
    }
  }

  private async handleFailedJobs(): Promise<void> {
    // Get recently failed jobs
    const { data: failedJobs } = await this.supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'failed')
      .gte('updated_at', new Date(Date.now() - 3600000)) // Last hour
      .lt('attempts', 'max_attempts');

    for (const job of failedJobs || []) {
      // Retry with exponential backoff
      const retryDelay = Math.min(60000 * Math.pow(2, job.attempts), 3600000); // Max 1 hour
      
      await this.supabase
        .from('job_queue')
        .update({
          status: 'pending',
          scheduled_for: new Date(Date.now() + retryDelay)
        })
        .eq('id', job.id);
    }
  }

  private startAutoScaling(): void {
    this.autoScaleInterval = setInterval(async () => {
      try {
        const metrics = await this.monitoring.getDashboardMetrics();
        
        // Get current load
        const pendingJobs = metrics.jobStats?.find((s: any) => s.status === 'pending')?.count || 0;
        const processingJobs = metrics.jobStats?.find((s: any) => s.status === 'processing')?.count || 0;
        
        const load = pendingJobs / Math.max(this.workers.length, 1);
        
        // Scale up if load is high
        if (load > 50 && this.workers.length < this.config.maxWorkers) {
          const newWorkerCount = Math.min(
            this.workers.length + Math.ceil(load / 50),
            this.config.maxWorkers
          );
          await this.scaleWorkers(newWorkerCount);
        }
        
        // Scale down if load is low
        else if (load < 10 && this.workers.length > this.config.minWorkers) {
          const newWorkerCount = Math.max(
            Math.floor(this.workers.length * 0.8),
            this.config.minWorkers
          );
          await this.scaleWorkers(newWorkerCount);
        }
        
      } catch (error) {
        console.error('Auto-scaling error:', error);
      }
    }, 30000); // Every 30 seconds
  }

  private async scaleWorkers(targetCount: number): Promise<void> {
    const currentCount = this.workers.length;
    
    if (targetCount > currentCount) {
      // Scale up
      const newWorkersNeeded = targetCount - currentCount;
      console.log(`Scaling up: adding ${newWorkersNeeded} workers`);
      
      for (let i = 0; i < newWorkersNeeded; i++) {
        const worker = new JobWorker(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          this.config.queues
        );
        
        this.workers.push(worker);
        worker.start().catch(err => {
          console.error('Worker failed:', err);
          this.workers = this.workers.filter(w => w !== worker);
        });
      }
    } else if (targetCount < currentCount) {
      // Scale down
      const workersToRemove = currentCount - targetCount;
      console.log(`Scaling down: removing ${workersToRemove} workers`);
      
      for (let i = 0; i < workersToRemove; i++) {
        const worker = this.workers.pop();
        if (worker) {
          await worker.shutdown();
        }
      }
    }
  }

  private handleAlert(alert: any): void {
    console.log(`Alert received: ${alert.title}`);
    
    // Handle specific alerts
    if (alert.title === 'High Job Failure Rate' && alert.severity === 'critical') {
      // Pause new job creation temporarily
      console.log('Pausing new job creation due to high failure rate');
      // Implementation here
    }
    
    if (alert.title === 'Stale Scraping Job Detected') {
      // Could trigger a new job to resume from checkpoint
      console.log('Handling stale scraping job');
      // Implementation here
    }
  }

  private async generateDailyReport(): Promise<void> {
    console.log('Generating daily report...');
    
    const yesterday = new Date(Date.now() - 86400000);
    
    // Get trial statistics
    const { data: newTrials } = await this.supabase
      .from('clinical_trials')
      .select('count(*)', { count: 'exact' })
      .gte('created_at', yesterday);
    
    // Get job statistics
    const { data: jobStats } = await this.supabase
      .from('job_queue')
      .select('status, count(*)', { count: 'exact' })
      .gte('created_at', yesterday)
      .group('status');
    
    // Get scraping statistics
    const { data: scrapingStats } = await this.supabase
      .from('scraping_jobs')
      .select('status, sum(processed_items), sum(failed_items)')
      .gte('started_at', yesterday)
      .group('status');
    
    const report = {
      date: yesterday.toISOString().split('T')[0],
      newTrials: newTrials?.[0]?.count || 0,
      jobStats,
      scrapingStats,
      health: await this.monitoring.getHealthStatus(),
      generated_at: new Date()
    };
    
    // Store report
    await this.supabase
      .from('daily_reports')
      .insert(report);
    
    console.log('Daily report generated:', report);
  }

  async getStatus(): Promise<any> {
    const health = await this.monitoring.getHealthStatus();
    const metrics = await this.monitoring.getDashboardMetrics();
    
    return {
      orchestrator: {
        running: this.isRunning,
        workers: this.workers.length,
        config: this.config
      },
      health,
      metrics,
      timestamp: new Date()
    };
  }
}

// CLI interface for orchestrator
if (require.main === module) {
  const orchestrator = new JobOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const command = process.argv[2];

  switch (command) {
    case 'start':
      orchestrator.start()
        .then(() => console.log('Orchestrator running...'))
        .catch(console.error);
      break;
      
    case 'scrape':
      orchestrator.initiateFullScrape()
        .then(jobId => console.log(`Scraping job started: ${jobId}`))
        .catch(console.error);
      break;
      
    case 'mesh':
      orchestrator.initiateMeshImport()
        .then(jobId => console.log(`MeSH import job started: ${jobId}`))
        .catch(console.error);
      break;
      
    case 'dedupe':
      orchestrator.initiateDeduplication()
        .then(jobId => console.log(`Deduplication job started: ${jobId}`))
        .catch(console.error);
      break;
      
    case 'enrich':
      orchestrator.initiateTrialEnrichment()
        .then(() => console.log('Enrichment jobs queued'))
        .catch(console.error);
      break;
      
    case 'status':
      orchestrator.getStatus()
        .then(status => console.log(JSON.stringify(status, null, 2)))
        .catch(console.error);
      break;
      
    default:
      console.log(`
Usage: node job-orchestrator.js [command]

Commands:
  start   - Start the orchestrator with workers
  scrape  - Initiate full ClinicalTrials.gov scrape
  mesh    - Import MeSH database
  dedupe  - Run deduplication
  enrich  - Enrich trials with AI
  status  - Get current status
      `);
  }
}