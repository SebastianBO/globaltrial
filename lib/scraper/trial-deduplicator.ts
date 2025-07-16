import { createClient } from '@supabase/supabase-js';

interface DuplicationResult {
  duplicatesFound: number;
  groupsCreated: number;
  processingTime: number;
}

interface TrialSimilarity {
  trial1_id: string;
  trial2_id: string;
  similarity_score: number;
  match_reasons: {
    title_similarity: number;
    sponsor_match: boolean;
    nct_id_match: boolean;
    date_proximity: boolean;
    location_overlap: number;
    condition_overlap: number;
    intervention_overlap: number;
  };
}

export class TrialDeduplicator {
  private supabase: any;
  private readonly SIMILARITY_THRESHOLD = 0.85;
  private readonly BATCH_SIZE = 100;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async findDuplicates(batchSize: number = 1000): Promise<DuplicationResult> {
    const startTime = Date.now();
    let duplicatesFound = 0;
    let groupsCreated = 0;

    console.log('Starting duplicate detection...');

    try {
      // Get trials that haven't been checked for duplicates
      const { data: trials, error } = await this.supabase
        .from('clinical_trials')
        .select('id, nct_id, title, sponsor, start_date, conditions, interventions, locations')
        .is('duplicate_check_date', null)
        .limit(batchSize);

      if (error) throw error;

      console.log(`Processing ${trials.length} trials for duplicate detection`);

      // Process each trial
      for (const trial of trials) {
        const duplicates = await this.findTrialDuplicates(trial);
        
        if (duplicates.length > 0) {
          duplicatesFound += duplicates.length;
          groupsCreated += await this.createDuplicateGroup(trial, duplicates);
        }

        // Mark trial as checked
        await this.supabase
          .from('clinical_trials')
          .update({ duplicate_check_date: new Date() })
          .eq('id', trial.id);
      }

      // Run cross-registry duplicate detection
      await this.detectCrossRegistryDuplicates();

      const processingTime = Date.now() - startTime;
      console.log(`Duplicate detection completed in ${processingTime}ms`);

      return {
        duplicatesFound,
        groupsCreated,
        processingTime
      };

    } catch (error) {
      console.error('Duplicate detection failed:', error);
      throw error;
    }
  }

  private async findTrialDuplicates(trial: any): Promise<TrialSimilarity[]> {
    const duplicates: TrialSimilarity[] = [];

    // Step 1: Find exact NCT ID matches (different versions)
    if (trial.nct_id) {
      const baseNctId = trial.nct_id.replace(/NCT0*/i, '');
      const { data: nctMatches } = await this.supabase
        .from('clinical_trials')
        .select('id, nct_id, title, sponsor')
        .neq('id', trial.id)
        .ilike('nct_id', `%${baseNctId}%`)
        .limit(10);

      for (const match of nctMatches || []) {
        duplicates.push({
          trial1_id: trial.id,
          trial2_id: match.id,
          similarity_score: 1.0,
          match_reasons: {
            title_similarity: 0,
            sponsor_match: trial.sponsor === match.sponsor,
            nct_id_match: true,
            date_proximity: false,
            location_overlap: 0,
            condition_overlap: 0,
            intervention_overlap: 0
          }
        });
      }
    }

    // Step 2: Find fuzzy title matches using trigram similarity
    const { data: titleMatches } = await this.supabase.rpc('find_similar_trials', {
      p_title: trial.title,
      p_threshold: 0.7,
      p_exclude_id: trial.id,
      p_limit: 20
    });

    for (const match of titleMatches || []) {
      const similarity = await this.calculateDetailedSimilarity(trial, match);
      
      if (similarity.similarity_score >= this.SIMILARITY_THRESHOLD) {
        duplicates.push(similarity);
      }
    }

    // Step 3: Find trials with same sponsor and overlapping dates
    if (trial.sponsor && trial.start_date) {
      const dateRange = this.getDateRange(trial.start_date, 180); // 6 months window
      
      const { data: sponsorMatches } = await this.supabase
        .from('clinical_trials')
        .select('*')
        .eq('sponsor', trial.sponsor)
        .neq('id', trial.id)
        .gte('start_date', dateRange.start)
        .lte('start_date', dateRange.end)
        .limit(50);

      for (const match of sponsorMatches || []) {
        const similarity = await this.calculateDetailedSimilarity(trial, match);
        
        if (similarity.similarity_score >= this.SIMILARITY_THRESHOLD &&
            !duplicates.find(d => d.trial2_id === match.id)) {
          duplicates.push(similarity);
        }
      }
    }

    return duplicates;
  }

  private async calculateDetailedSimilarity(trial1: any, trial2: any): Promise<TrialSimilarity> {
    // Title similarity using trigram
    const titleSim = await this.calculateTrigramSimilarity(trial1.title, trial2.title);
    
    // Sponsor match
    const sponsorMatch = trial1.sponsor === trial2.sponsor;
    
    // Date proximity (within 6 months)
    const dateProximity = this.checkDateProximity(trial1.start_date, trial2.start_date);
    
    // Location overlap
    const locationOverlap = this.calculateArrayOverlap(
      trial1.locations || [],
      trial2.locations || []
    );
    
    // Condition overlap
    const conditionOverlap = this.calculateArrayOverlap(
      trial1.conditions || [],
      trial2.conditions || []
    );
    
    // Intervention overlap
    const interventionOverlap = this.calculateArrayOverlap(
      trial1.interventions || [],
      trial2.interventions || []
    );
    
    // Calculate weighted similarity score
    const weights = {
      title: 0.35,
      sponsor: 0.20,
      date: 0.10,
      location: 0.10,
      condition: 0.15,
      intervention: 0.10
    };
    
    const similarityScore = 
      (titleSim * weights.title) +
      (sponsorMatch ? weights.sponsor : 0) +
      (dateProximity ? weights.date : 0) +
      (locationOverlap * weights.location) +
      (conditionOverlap * weights.condition) +
      (interventionOverlap * weights.intervention);

    return {
      trial1_id: trial1.id,
      trial2_id: trial2.id,
      similarity_score: Math.min(similarityScore, 1.0),
      match_reasons: {
        title_similarity: titleSim,
        sponsor_match: sponsorMatch,
        nct_id_match: false,
        date_proximity: dateProximity,
        location_overlap: locationOverlap,
        condition_overlap: conditionOverlap,
        intervention_overlap: interventionOverlap
      }
    };
  }

  private async calculateTrigramSimilarity(text1: string, text2: string): Promise<number> {
    // Use database trigram similarity function
    const { data } = await this.supabase.rpc('similarity', {
      text1: text1.toLowerCase(),
      text2: text2.toLowerCase()
    });
    
    return data || 0;
  }

  private checkDateProximity(date1: any, date2: any, windowDays: number = 180): boolean {
    if (!date1 || !date2) return false;
    
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffDays = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
    
    return diffDays <= windowDays;
  }

  private calculateArrayOverlap(arr1: any[], arr2: any[]): number {
    if (!arr1.length || !arr2.length) return 0;
    
    const set1 = new Set(arr1.map(item => 
      typeof item === 'string' ? item.toLowerCase() : JSON.stringify(item)
    ));
    const set2 = new Set(arr2.map(item => 
      typeof item === 'string' ? item.toLowerCase() : JSON.stringify(item)
    ));
    
    let overlap = 0;
    for (const item of set1) {
      if (set2.has(item)) overlap++;
    }
    
    return overlap / Math.max(set1.size, set2.size);
  }

  private getDateRange(date: any, windowDays: number): { start: Date; end: Date } {
    const d = new Date(date);
    const start = new Date(d.getTime() - (windowDays / 2) * 24 * 60 * 60 * 1000);
    const end = new Date(d.getTime() + (windowDays / 2) * 24 * 60 * 60 * 1000);
    
    return { start, end };
  }

  private async createDuplicateGroup(primaryTrial: any, duplicates: TrialSimilarity[]): Promise<number> {
    let groupsCreated = 0;

    for (const duplicate of duplicates) {
      // Check if duplicate relationship already exists
      const { data: existing } = await this.supabase
        .from('trial_duplicates')
        .select('id')
        .or(`primary_trial_id.eq.${duplicate.trial1_id},primary_trial_id.eq.${duplicate.trial2_id}`)
        .or(`duplicate_trial_id.eq.${duplicate.trial1_id},duplicate_trial_id.eq.${duplicate.trial2_id}`)
        .single();

      if (!existing) {
        // Determine match type based on score
        let matchType = 'possible';
        if (duplicate.similarity_score >= 0.95) matchType = 'exact';
        else if (duplicate.similarity_score >= 0.90) matchType = 'fuzzy';
        else if (duplicate.similarity_score >= 0.85) matchType = 'probable';

        const { error } = await this.supabase
          .from('trial_duplicates')
          .insert({
            primary_trial_id: duplicate.trial1_id,
            duplicate_trial_id: duplicate.trial2_id,
            similarity_score: duplicate.similarity_score,
            match_reasons: duplicate.match_reasons,
            match_type: matchType,
            verified: duplicate.match_reasons.nct_id_match // Auto-verify NCT matches
          });

        if (!error) {
          groupsCreated++;
        }
      }
    }

    return groupsCreated;
  }

  private async detectCrossRegistryDuplicates(): Promise<void> {
    console.log('Detecting cross-registry duplicates...');

    // Get trials from different registries with similar timeframes
    const { data: recentTrials } = await this.supabase
      .from('clinical_trials')
      .select('id, title, sponsor, source, start_date, conditions')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .order('source');

    // Group by source
    const trialsBySource = new Map<string, any[]>();
    for (const trial of recentTrials || []) {
      if (!trialsBySource.has(trial.source)) {
        trialsBySource.set(trial.source, []);
      }
      trialsBySource.get(trial.source)!.push(trial);
    }

    // Compare across sources
    const sources = Array.from(trialsBySource.keys());
    for (let i = 0; i < sources.length - 1; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const source1Trials = trialsBySource.get(sources[i])!;
        const source2Trials = trialsBySource.get(sources[j])!;

        for (const trial1 of source1Trials) {
          for (const trial2 of source2Trials) {
            const similarity = await this.calculateDetailedSimilarity(trial1, trial2);
            
            if (similarity.similarity_score >= this.SIMILARITY_THRESHOLD) {
              await this.createDuplicateGroup(trial1, [similarity]);
            }
          }
        }
      }
    }
  }

  async mergeDuplicates(primaryId: string, duplicateIds: string[]): Promise<void> {
    console.log(`Merging ${duplicateIds.length} duplicates into primary trial ${primaryId}`);

    try {
      // Begin transaction
      await this.supabase.rpc('begin_transaction');

      // Get all trial data
      const { data: primaryTrial } = await this.supabase
        .from('clinical_trials')
        .select('*')
        .eq('id', primaryId)
        .single();

      const { data: duplicateTrials } = await this.supabase
        .from('clinical_trials')
        .select('*')
        .in('id', duplicateIds);

      // Merge data (keep most complete/recent information)
      const mergedData = this.mergeTrialData(primaryTrial, duplicateTrials);

      // Update primary trial
      await this.supabase
        .from('clinical_trials')
        .update(mergedData)
        .eq('id', primaryId);

      // Update references to point to primary
      await this.updateReferences(primaryId, duplicateIds);

      // Mark duplicates as merged
      await this.supabase
        .from('clinical_trials')
        .update({ 
          is_active: false,
          merged_into_id: primaryId,
          merged_at: new Date()
        })
        .in('id', duplicateIds);

      // Commit transaction
      await this.supabase.rpc('commit_transaction');

      console.log('Merge completed successfully');

    } catch (error) {
      // Rollback on error
      await this.supabase.rpc('rollback_transaction');
      throw error;
    }
  }

  private mergeTrialData(primary: any, duplicates: any[]): any {
    const merged = { ...primary };

    // Merge arrays (union)
    const arrayFields = ['conditions', 'interventions', 'locations', 'mesh_terms'];
    for (const field of arrayFields) {
      const allValues = new Set(merged[field] || []);
      for (const dup of duplicates) {
        (dup[field] || []).forEach((val: any) => allValues.add(val));
      }
      merged[field] = Array.from(allValues);
    }

    // Take most recent or most complete data
    const takeIfBetter = (field: string) => {
      for (const dup of duplicates) {
        if (dup[field] && (!merged[field] || 
            (dup.last_updated > merged.last_updated && dup[field].length > merged[field].length))) {
          merged[field] = dup[field];
        }
      }
    };

    takeIfBetter('description');
    takeIfBetter('eligibility_criteria');
    takeIfBetter('layman_description');

    // Merge compensation (take highest)
    for (const dup of duplicates) {
      if (dup.compensation_amount && (!merged.compensation_amount || dup.compensation_amount > merged.compensation_amount)) {
        merged.compensation_amount = dup.compensation_amount;
      }
    }

    return merged;
  }

  private async updateReferences(primaryId: string, duplicateIds: string[]): Promise<void> {
    // Update patient matches
    await this.supabase
      .from('patient_trial_matches')
      .update({ trial_id: primaryId })
      .in('trial_id', duplicateIds);

    // Update trial sources
    await this.supabase
      .from('trial_sources')
      .update({ trial_id: primaryId })
      .in('trial_id', duplicateIds);
  }

  // Create the similarity function in the database
  async createDatabaseFunctions(): Promise<void> {
    const sql = `
      -- Function to find similar trials using trigram
      CREATE OR REPLACE FUNCTION find_similar_trials(
        p_title TEXT,
        p_threshold NUMERIC DEFAULT 0.7,
        p_exclude_id UUID DEFAULT NULL,
        p_limit INTEGER DEFAULT 20
      )
      RETURNS TABLE(
        id UUID,
        title TEXT,
        sponsor TEXT,
        similarity NUMERIC
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          ct.id,
          ct.title,
          ct.sponsor,
          similarity(ct.title, p_title) as similarity
        FROM clinical_trials ct
        WHERE similarity(ct.title, p_title) >= p_threshold
        AND (p_exclude_id IS NULL OR ct.id != p_exclude_id)
        ORDER BY similarity DESC
        LIMIT p_limit;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to begin transaction
      CREATE OR REPLACE FUNCTION begin_transaction() RETURNS VOID AS $$
      BEGIN
        BEGIN;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to commit transaction  
      CREATE OR REPLACE FUNCTION commit_transaction() RETURNS VOID AS $$
      BEGIN
        COMMIT;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to rollback transaction
      CREATE OR REPLACE FUNCTION rollback_transaction() RETURNS VOID AS $$
      BEGIN
        ROLLBACK;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await this.supabase.rpc('execute_sql', { query: sql });
  }
}