import { createClient } from '@supabase/supabase-js';
import { ClinicalTrialsScaper } from './clinical-trials-scraper';
import { MeshImporter } from './mesh-importer';
import { TrialDeduplicator } from './trial-deduplicator';
import { v4 as uuidv4 } from 'uuid';

interface Job {
  id: string;
  job_type: string;
  payload: any;
}

export class JobWorker {
  private supabase: any;
  private workerId: string;
  private isRunning: boolean = false;
  private queues: string[];
  private scrapers: Map<string, ClinicalTrialsScaper> = new Map();

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    queues: string[] = ['default', 'scraping', 'enrichment']
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.workerId = `worker-${process.pid}-${uuidv4().slice(0, 8)}`;
    this.queues = queues;
  }

  async start(): Promise<void> {
    console.log(`Worker ${this.workerId} starting...`);
    this.isRunning = true;

    // Set up graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    // Start heartbeat
    this.startHeartbeat();

    // Main work loop
    while (this.isRunning) {
      try {
        const job = await this.getNextJob();
        
        if (job) {
          await this.processJob(job);
        } else {
          // No jobs available, wait a bit
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Worker error:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async getNextJob(): Promise<Job | null> {
    for (const queue of this.queues) {
      const { data, error } = await this.supabase.rpc('acquire_next_job', {
        p_queue_name: queue,
        p_worker_id: this.workerId
      });

      if (data && data.length > 0) {
        return data[0];
      }
    }
    
    return null;
  }

  private async processJob(job: Job): Promise<void> {
    console.log(`Processing job ${job.id} of type ${job.job_type}`);
    
    try {
      let result: any;
      
      switch (job.job_type) {
        case 'scrape_trials_full':
          result = await this.handleFullScrape(job);
          break;
          
        case 'scrape_trials_incremental':
          result = await this.handleIncrementalScrape(job);
          break;
          
        case 'scrape_trials_condition':
          result = await this.handleConditionScrape(job);
          break;
          
        case 'import_mesh_terms':
          result = await this.handleMeshImport(job);
          break;
          
        case 'deduplicate_trials':
          result = await this.handleDeduplication(job);
          break;
          
        case 'enrich_trial':
          result = await this.handleTrialEnrichment(job);
          break;
          
        case 'geocode_locations':
          result = await this.handleGeocoding(job);
          break;
          
        default:
          throw new Error(`Unknown job type: ${job.job_type}`);
      }
      
      await this.completeJob(job.id, result);
      
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      await this.failJob(job.id, error);
    }
  }

  private async handleFullScrape(job: Job): Promise<any> {
    const scraper = new ClinicalTrialsScaper(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      job.payload.scraping_job_id
    );
    
    this.scrapers.set(job.id, scraper);
    
    try {
      await scraper.startFullScrape();
      return { success: true, message: 'Full scrape completed' };
    } finally {
      this.scrapers.delete(job.id);
    }
  }

  private async handleIncrementalScrape(job: Job): Promise<any> {
    const { since_date } = job.payload;
    
    const scraper = new ClinicalTrialsScaper(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Implement incremental scraping logic
    console.log(`Scraping trials updated since ${since_date}`);
    
    return { success: true, trials_scraped: 0 };
  }

  private async handleConditionScrape(job: Job): Promise<any> {
    const { condition } = job.payload;
    
    console.log(`Scraping trials for condition: ${condition}`);
    
    // Implementation here
    
    return { success: true, condition, trials_found: 0 };
  }

  private async handleMeshImport(job: Job): Promise<any> {
    const importer = new MeshImporter(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    await importer.importFullMeshDatabase();
    
    return { success: true, message: 'MeSH import completed' };
  }

  private async handleDeduplication(job: Job): Promise<any> {
    const deduplicator = new TrialDeduplicator(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { batch_size = 1000 } = job.payload;
    
    const results = await deduplicator.findDuplicates(batch_size);
    
    return { 
      success: true, 
      duplicates_found: results.duplicatesFound,
      groups_created: results.groupsCreated
    };
  }

  private async handleTrialEnrichment(job: Job): Promise<any> {
    const { trial_id } = job.payload;
    
    // Fetch trial
    const { data: trial } = await this.supabase
      .from('clinical_trials')
      .select('*')
      .eq('id', trial_id)
      .single();
      
    if (!trial) {
      throw new Error('Trial not found');
    }
    
    // Enrich with AI
    const enriched = await this.enrichTrialWithAI(trial);
    
    // Update trial
    await this.supabase
      .from('clinical_trials')
      .update(enriched)
      .eq('id', trial_id);
      
    return { success: true, trial_id };
  }

  private async handleGeocoding(job: Job): Promise<any> {
    const { trial_id } = job.payload;
    
    // Implementation for geocoding trial locations
    console.log(`Geocoding locations for trial ${trial_id}`);
    
    return { success: true, locations_geocoded: 0 };
  }

  private async enrichTrialWithAI(trial: any): Promise<any> {
    // Use Groq to generate patient-friendly description
    const prompt = `
      Create a simple, patient-friendly explanation of this clinical trial:
      
      Title: ${trial.title}
      Condition: ${trial.conditions.join(', ')}
      Description: ${trial.description}
      
      Write 2-3 sentences that a patient without medical knowledge could understand.
    `;
    
    // Call Groq API here
    
    return {
      layman_description: 'AI generated description here',
      eligibility_parsed: {
        // Parsed eligibility criteria
      }
    };
  }

  private async completeJob(jobId: string, result: any): Promise<void> {
    const { error } = await this.supabase
      .from('job_queue')
      .update({
        status: 'completed',
        completed_at: new Date(),
        result
      })
      .eq('id', jobId);
      
    if (error) {
      console.error('Failed to complete job:', error);
    }
  }

  private async failJob(jobId: string, error: any): Promise<void> {
    const { data: job } = await this.supabase
      .from('job_queue')
      .select('attempts, max_attempts')
      .eq('id', jobId)
      .single();
      
    const shouldRetry = job && job.attempts < job.max_attempts;
    
    await this.supabase
      .from('job_queue')
      .update({
        status: shouldRetry ? 'pending' : 'failed',
        last_error: error.message || String(error),
        locked_at: null,
        locked_by: null,
        scheduled_for: shouldRetry 
          ? new Date(Date.now() + 60000 * job.attempts) // Exponential backoff
          : null
      })
      .eq('id', jobId);
  }

  private startHeartbeat(): void {
    setInterval(async () => {
      // Update heartbeat for all active scraping jobs
      for (const [jobId, scraper] of this.scrapers) {
        await this.supabase
          .from('scraping_jobs')
          .update({ last_heartbeat: new Date() })
          .eq('worker_id', this.workerId)
          .eq('status', 'running');
      }
    }, 30000); // Every 30 seconds
  }

  async shutdown(): Promise<void> {
    console.log(`Worker ${this.workerId} shutting down...`);
    this.isRunning = false;
    
    // Release any locked jobs
    await this.supabase
      .from('job_queue')
      .update({
        status: 'pending',
        locked_at: null,
        locked_by: null
      })
      .eq('locked_by', this.workerId)
      .eq('status', 'processing');
      
    process.exit(0);
  }
}

// Start worker if run directly
if (require.main === module) {
  const worker = new JobWorker(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  worker.start().catch(console.error);
}