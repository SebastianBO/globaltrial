import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';

const CLINICALTRIALS_API_BASE = 'https://clinicaltrials.gov/api/v2/studies';
const MAX_CONCURRENT_REQUESTS = 10;
const RATE_LIMIT_PER_MINUTE = 300;
const PAGE_SIZE = 1000;
const CHECKPOINT_INTERVAL = 100;

interface ScrapingJob {
  id: string;
  job_type: string;
  status: string;
  progress: any;
  checkpoint_data: any;
  total_items?: number;
  processed_items: number;
  failed_items: number;
  error_log: any[];
}

interface ClinicalTrialsResponse {
  studies: any[];
  totalCount: number;
  nextPageToken?: string;
}

export class ClinicalTrialsScaper {
  private supabase: any;
  private jobId: string;
  private limit: any;
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private checkpointCounter: number = 0;

  constructor(supabaseUrl: string, supabaseKey: string, jobId?: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.jobId = jobId || uuidv4();
    this.limit = pLimit(MAX_CONCURRENT_REQUESTS);
  }

  async startFullScrape(): Promise<void> {
    console.log(`Starting full scrape job: ${this.jobId}`);
    
    // Create or update job record
    const job = await this.createJob('full_scrape');
    
    try {
      // Strategy 1: Get total count first
      const totalCount = await this.getTotalTrialsCount();
      await this.updateJob({ total_items: totalCount });
      
      // Strategy 2: Process in chunks using pagination
      await this.scrapeByPagination(totalCount);
      
      // Strategy 3: Also scrape by date ranges to catch any missed
      await this.scrapeByDateRanges();
      
      await this.updateJob({ status: 'completed', completed_at: new Date() });
    } catch (error) {
      console.error('Scraping failed:', error);
      await this.logError(error);
      await this.updateJob({ status: 'failed' });
      throw error;
    }
  }

  private async createJob(jobType: string): Promise<ScrapingJob> {
    const { data, error } = await this.supabase
      .from('scraping_jobs')
      .upsert({
        id: this.jobId,
        job_type: jobType,
        registry: 'clinicaltrials.gov',
        status: 'running',
        started_at: new Date(),
        worker_id: `worker-${process.pid}`,
        last_heartbeat: new Date(),
        progress: {},
        checkpoint_data: {},
        error_log: []
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async updateJob(updates: Partial<ScrapingJob>): Promise<void> {
    const { error } = await this.supabase
      .from('scraping_jobs')
      .update({
        ...updates,
        last_heartbeat: new Date()
      })
      .eq('id', this.jobId);

    if (error) throw error;
  }

  private async getTotalTrialsCount(): Promise<number> {
    const response = await this.rateLimitedFetch(
      `${CLINICALTRIALS_API_BASE}?format=json&pageSize=1`
    );
    const data: ClinicalTrialsResponse = await response.json();
    return data.totalCount;
  }

  private async scrapeByPagination(totalCount: number): Promise<void> {
    console.log(`Total trials to scrape: ${totalCount}`);
    
    let nextPageToken: string | undefined;
    let processedCount = 0;
    
    // Check for existing checkpoint
    const checkpoint = await this.getLatestCheckpoint('pagination');
    if (checkpoint) {
      nextPageToken = checkpoint.checkpoint_data.nextPageToken;
      processedCount = checkpoint.items_processed;
      console.log(`Resuming from checkpoint: ${processedCount} items processed`);
    }

    do {
      try {
        const url = this.buildUrl({ 
          pageSize: PAGE_SIZE,
          pageToken: nextPageToken 
        });
        
        const response = await this.rateLimitedFetch(url);
        const data: ClinicalTrialsResponse = await response.json();
        
        // Process trials in parallel batches
        await this.processTrialsBatch(data.studies);
        
        processedCount += data.studies.length;
        nextPageToken = data.nextPageToken;
        
        // Update progress
        await this.updateJob({
          processed_items: processedCount,
          progress: {
            percentage: (processedCount / totalCount) * 100,
            current_page_token: nextPageToken
          }
        });
        
        // Create checkpoint
        if (++this.checkpointCounter % CHECKPOINT_INTERVAL === 0) {
          await this.createCheckpoint('pagination', {
            nextPageToken,
            processedCount,
            lastProcessedTime: new Date()
          }, processedCount);
        }
        
        console.log(`Processed ${processedCount}/${totalCount} trials`);
        
      } catch (error) {
        console.error('Error processing page:', error);
        await this.logError(error);
        
        // Implement exponential backoff
        await this.exponentialBackoff();
      }
    } while (nextPageToken);
  }

  private async scrapeByDateRanges(): Promise<void> {
    console.log('Starting date-based scraping for verification...');
    
    const startDate = new Date('2000-01-01');
    const endDate = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const chunkDays = 30; // Process in 30-day chunks
    
    for (let date = startDate; date < endDate; date.setDate(date.getDate() + chunkDays)) {
      const chunkEnd = new Date(Math.min(date.getTime() + (chunkDays * dayMs), endDate.getTime()));
      
      try {
        await this.scrapeByDateRange(date, chunkEnd);
      } catch (error) {
        console.error(`Error scraping date range ${date} to ${chunkEnd}:`, error);
        await this.logError(error);
      }
    }
  }

  private async scrapeByDateRange(startDate: Date, endDate: Date): Promise<void> {
    const dateFilter = `filter.advanced=AREA[StudyFirstPostDate]RANGE[${this.formatDate(startDate)},${this.formatDate(endDate)}]`;
    
    let nextPageToken: string | undefined;
    
    do {
      const url = this.buildUrl({
        pageSize: PAGE_SIZE,
        pageToken: nextPageToken,
        query: dateFilter
      });
      
      const response = await this.rateLimitedFetch(url);
      const data: ClinicalTrialsResponse = await response.json();
      
      await this.processTrialsBatch(data.studies);
      nextPageToken = data.nextPageToken;
      
    } while (nextPageToken);
  }

  private async processTrialsBatch(studies: any[]): Promise<void> {
    const batchPromises = studies.map(study => 
      this.limit(() => this.processSingleTrial(study))
    );
    
    const results = await Promise.allSettled(batchPromises);
    
    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount > 0) {
      await this.updateJob({
        failed_items: (await this.getJob()).failed_items + failedCount
      });
    }
  }

  private async processSingleTrial(study: any): Promise<void> {
    try {
      const trial = this.transformTrial(study);
      
      // Upsert trial data
      const { error } = await this.supabase
        .from('clinical_trials')
        .upsert(trial, {
          onConflict: 'nct_id',
          ignoreDuplicates: false
        });
      
      if (error) throw error;
      
      // Track source
      await this.supabase
        .from('trial_sources')
        .upsert({
          trial_id: trial.id,
          source_registry: 'clinicaltrials.gov',
          source_id: trial.nct_id,
          source_url: `https://clinicaltrials.gov/study/${trial.nct_id}`,
          last_fetched_at: new Date(),
          raw_data: study
        }, {
          onConflict: 'source_registry,source_id'
        });
        
    } catch (error) {
      console.error(`Error processing trial ${study.protocolSection?.identificationModule?.nctId}:`, error);
      throw error;
    }
  }

  private transformTrial(study: any): any {
    const protocol = study.protocolSection || {};
    const identification = protocol.identificationModule || {};
    const status = protocol.statusModule || {};
    const description = protocol.descriptionModule || {};
    const conditions = protocol.conditionsModule || {};
    const interventions = protocol.armsInterventionsModule || {};
    const eligibility = protocol.eligibilityModule || {};
    const contacts = protocol.contactsLocationsModule || {};
    const outcomes = protocol.outcomesModule || {};
    const design = protocol.designModule || {};
    const sponsor = protocol.sponsorCollaboratorsModule || {};
    
    // Extract locations
    const locations = this.extractLocations(contacts.locations || []);
    
    // Extract intervention types
    const interventionTypes = this.extractInterventionTypes(interventions.interventions || []);
    
    // Parse eligibility criteria
    const eligibilityParsed = this.parseEligibilityCriteria(eligibility.eligibilityCriteria || '');
    
    return {
      id: uuidv4(),
      nct_id: identification.nctId,
      title: identification.officialTitle || identification.briefTitle,
      status: status.overallStatus,
      phase: design.phases?.join(', '),
      study_type: design.studyType,
      sponsor: sponsor.leadSponsor?.name,
      description: description.briefSummary,
      conditions: conditions.conditions || [],
      interventions: (interventions.interventions || []).map((i: any) => i.name),
      intervention_types: interventionTypes,
      eligibility_criteria: eligibility.eligibilityCriteria,
      eligibility_parsed: eligibilityParsed,
      locations: locations,
      start_date: this.parseDate(status.startDateStruct),
      completion_date: this.parseDate(status.completionDateStruct),
      last_updated: new Date(study.hasResults ? study.resultsSection?.documentSection?.date : status.lastUpdatePostDateStruct?.date || new Date()),
      registry_last_updated: new Date(status.lastUpdatePostDateStruct?.date || new Date()),
      source: 'clinicaltrials.gov',
      url: `https://clinicaltrials.gov/study/${identification.nctId}`,
      enrollment_target: design.enrollmentInfo?.count,
      enrollment_actual: status.enrollmentCount,
      primary_outcome_timeframe: outcomes.primaryOutcomes?.[0]?.timeFrame,
      is_active: this.isTrialActive(status.overallStatus),
      urgency_level: this.calculateUrgencyLevel(status, design),
      data_quality_score: this.calculateDataQuality(study)
    };
  }

  private extractLocations(locations: any[]): any[] {
    return locations.map(loc => ({
      facility: loc.facility,
      city: loc.city,
      state: loc.state,
      country: loc.country,
      zip: loc.zip,
      status: loc.status,
      coordinates: null // Will be geocoded later
    }));
  }

  private extractInterventionTypes(interventions: any[]): string[] {
    const types = new Set<string>();
    interventions.forEach(i => {
      if (i.type) types.add(i.type);
    });
    return Array.from(types);
  }

  private parseEligibilityCriteria(criteria: string): any {
    // Basic parsing - can be enhanced with NLP
    const parsed: any = {
      inclusion: [],
      exclusion: [],
      age_min: null,
      age_max: null,
      gender: 'all'
    };
    
    // Extract age requirements
    const ageMatch = criteria.match(/(\d+)\s*(years?|months?)\s*to\s*(\d+)\s*(years?|months?)/i);
    if (ageMatch) {
      parsed.age_min = parseInt(ageMatch[1]);
      parsed.age_max = parseInt(ageMatch[3]);
    }
    
    // Split inclusion/exclusion
    const parts = criteria.split(/exclusion criteria/i);
    if (parts.length > 1) {
      parsed.inclusion = parts[0].split('\n').filter(line => line.trim().length > 0);
      parsed.exclusion = parts[1].split('\n').filter(line => line.trim().length > 0);
    }
    
    return parsed;
  }

  private isTrialActive(status: string): boolean {
    const activeStatuses = ['Recruiting', 'Enrolling by invitation', 'Active, not recruiting', 'Not yet recruiting'];
    return activeStatuses.includes(status);
  }

  private calculateUrgencyLevel(status: any, design: any): string {
    if (status.overallStatus === 'Recruiting' && design.enrollmentInfo?.count < 50) {
      return 'high';
    }
    if (status.overallStatus === 'Not yet recruiting') {
      return 'medium';
    }
    return 'low';
  }

  private calculateDataQuality(study: any): number {
    let score = 0;
    const fields = [
      study.protocolSection?.identificationModule?.officialTitle,
      study.protocolSection?.descriptionModule?.briefSummary,
      study.protocolSection?.eligibilityModule?.eligibilityCriteria,
      study.protocolSection?.contactsLocationsModule?.locations?.length > 0,
      study.protocolSection?.outcomesModule?.primaryOutcomes?.length > 0
    ];
    
    fields.forEach(field => {
      if (field) score += 0.2;
    });
    
    return Math.min(score, 1);
  }

  private parseDate(dateStruct: any): Date | null {
    if (!dateStruct) return null;
    return new Date(`${dateStruct.date}`);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private buildUrl(params: any): string {
    const url = new URL(CLINICALTRIALS_API_BASE);
    url.searchParams.append('format', 'json');
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
    
    return url.toString();
  }

  private async rateLimitedFetch(url: string): Promise<Response> {
    await this.enforceRateLimit();
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait and retry
        await this.exponentialBackoff();
        return this.rateLimitedFetch(url);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowElapsed = now - this.windowStart;
    
    if (windowElapsed >= 60000) {
      // Reset window
      this.windowStart = now;
      this.requestCount = 0;
    }
    
    if (this.requestCount >= RATE_LIMIT_PER_MINUTE) {
      // Wait until window resets
      const waitTime = 60000 - windowElapsed;
      console.log(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.windowStart = Date.now();
      this.requestCount = 0;
    }
    
    this.requestCount++;
  }

  private async exponentialBackoff(attempt: number = 0): Promise<void> {
    const waitTime = Math.min(1000 * Math.pow(2, attempt), 60000);
    console.log(`Backing off for ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  private async createCheckpoint(type: string, data: any, itemsProcessed: number): Promise<void> {
    const { error } = await this.supabase
      .from('scraping_checkpoints')
      .insert({
        job_id: this.jobId,
        checkpoint_type: type,
        checkpoint_data: data,
        items_processed: itemsProcessed
      });
      
    if (error) {
      console.error('Failed to create checkpoint:', error);
    }
  }

  private async getLatestCheckpoint(type: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('scraping_checkpoints')
      .select('*')
      .eq('job_id', this.jobId)
      .eq('checkpoint_type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get checkpoint:', error);
    }
    
    return data;
  }

  private async getJob(): Promise<ScrapingJob> {
    const { data, error } = await this.supabase
      .from('scraping_jobs')
      .select('*')
      .eq('id', this.jobId)
      .single();
      
    if (error) throw error;
    return data;
  }

  private async logError(error: any): Promise<void> {
    const job = await this.getJob();
    const errorLog = [...(job.error_log || []), {
      timestamp: new Date(),
      error: error.message || String(error),
      stack: error.stack
    }];
    
    await this.updateJob({
      error_log: errorLog,
      failed_items: job.failed_items + 1
    });
  }
}