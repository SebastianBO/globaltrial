import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { embedMany, embed } from 'ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TrialEmbedding {
  nct_id: string;
  title: string;
  conditions: string[];
  eligibility_text: string;
  embedding: number[];
  last_updated: string;
}

interface PatientProfile {
  conditions: string[];
  symptoms: string[];
  age?: number;
  gender?: string;
  previousTreatments: string[];
  medications: string[];
  urgency: 'low' | 'medium' | 'high';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

interface MatchResult {
  nct_id: string;
  title: string;
  similarity_score: number;
  semantic_relevance: number;
  eligibility_match: number;
  overall_score: number;
  match_explanation: string;
}

export class VectorTrialMatcher {
  private embeddingModel = openai.embedding('text-embedding-3-small');

  /**
   * Generate embeddings for a patient profile
   */
  async generatePatientEmbedding(profile: PatientProfile): Promise<number[]> {
    // Create a comprehensive text representation of the patient
    const patientText = this.createPatientText(profile);
    
    const { embedding } = await embed({
      model: this.embeddingModel,
      value: patientText
    });

    return embedding;
  }

  /**
   * Generate embeddings for multiple trials
   */
  async generateTrialEmbeddings(trials: any[]): Promise<TrialEmbedding[]> {
    const trialTexts = trials.map(trial => this.createTrialText(trial));
    
    const { embeddings } = await embedMany({
      model: this.embeddingModel,
      values: trialTexts
    });

    return trials.map((trial, index) => ({
      nct_id: trial.nct_id,
      title: trial.title,
      conditions: trial.conditions || [],
      eligibility_text: this.createTrialText(trial),
      embedding: embeddings[index],
      last_updated: new Date().toISOString()
    }));
  }

  /**
   * Store trial embeddings in database
   */
  async storeTrialEmbeddings(embeddings: TrialEmbedding[]): Promise<void> {
    const { error } = await supabase
      .from('trial_embeddings')
      .upsert(embeddings, {
        onConflict: 'nct_id'
      });

    if (error) {
      throw new Error(`Failed to store embeddings: ${error.message}`);
    }
  }

  /**
   * Find matching trials using vector similarity
   */
  async findMatchingTrials(
    profile: PatientProfile,
    limit: number = 20,
    threshold: number = 0.7
  ): Promise<MatchResult[]> {
    // Generate patient embedding
    const patientEmbedding = await this.generatePatientEmbedding(profile);
    
    // Use Supabase vector similarity search
    const { data: similarTrials, error } = await supabase.rpc(
      'find_similar_trials',
      {
        query_embedding: patientEmbedding,
        similarity_threshold: threshold,
        match_count: limit
      }
    );

    if (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }

    // Enhance matches with additional scoring
    return this.enhanceMatches(profile, similarTrials || []);
  }

  /**
   * Enhanced hybrid matching with multiple factors
   */
  async hybridTrialMatching(
    profile: PatientProfile,
    options: {
      vectorWeight: number;
      keywordWeight: number;
      eligibilityWeight: number;
      locationWeight: number;
      limit: number;
    } = {
      vectorWeight: 0.4,
      keywordWeight: 0.3,
      eligibilityWeight: 0.2,
      locationWeight: 0.1,
      limit: 20
    }
  ): Promise<MatchResult[]> {
    // 1. Vector similarity search
    const vectorMatches = await this.findMatchingTrials(profile, options.limit * 2, 0.6);
    
    // 2. Keyword-based search
    const keywordMatches = await this.keywordBasedSearch(profile, options.limit * 2);
    
    // 3. Eligibility-based filtering
    const eligibilityMatches = await this.eligibilityBasedMatching(profile, options.limit * 2);
    
    // 4. Location-based scoring
    const locationScores = await this.calculateLocationScores(profile, vectorMatches);
    
    // 5. Combine all scores
    const combinedMatches = this.combineMatchingResults(
      vectorMatches,
      keywordMatches,
      eligibilityMatches,
      locationScores,
      options
    );
    
    // 6. Sort by overall score and return top matches
    return combinedMatches
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, options.limit);
  }

  /**
   * Create text representation of patient profile
   */
  private createPatientText(profile: PatientProfile): string {
    const parts = [];
    
    if (profile.conditions.length > 0) {
      parts.push(`Medical conditions: ${profile.conditions.join(', ')}`);
    }
    
    if (profile.symptoms.length > 0) {
      parts.push(`Symptoms: ${profile.symptoms.join(', ')}`);
    }
    
    if (profile.previousTreatments.length > 0) {
      parts.push(`Previous treatments: ${profile.previousTreatments.join(', ')}`);
    }
    
    if (profile.medications.length > 0) {
      parts.push(`Current medications: ${profile.medications.join(', ')}`);
    }
    
    if (profile.age) {
      parts.push(`Age: ${profile.age} years`);
    }
    
    if (profile.gender) {
      parts.push(`Gender: ${profile.gender}`);
    }
    
    parts.push(`Treatment urgency: ${profile.urgency}`);
    
    if (profile.location) {
      const location = [
        profile.location.city,
        profile.location.state,
        profile.location.country
      ].filter(Boolean).join(', ');
      if (location) {
        parts.push(`Location: ${location}`);
      }
    }
    
    return parts.join('. ');
  }

  /**
   * Create text representation of clinical trial
   */
  private createTrialText(trial: any): string {
    const parts = [];
    
    parts.push(trial.title || trial.brief_title || '');
    
    if (trial.brief_summary) {
      parts.push(trial.brief_summary);
    }
    
    if (trial.conditions && trial.conditions.length > 0) {
      parts.push(`Conditions: ${trial.conditions.join(', ')}`);
    }
    
    if (trial.interventions && trial.interventions.length > 0) {
      const interventionNames = trial.interventions.map((i: any) => i.name || i).join(', ');
      parts.push(`Interventions: ${interventionNames}`);
    }
    
    if (trial.eligibility_criteria) {
      if (typeof trial.eligibility_criteria === 'string') {
        parts.push(`Eligibility: ${trial.eligibility_criteria}`);
      } else {
        const criteria = [
          trial.eligibility_criteria.inclusion,
          trial.eligibility_criteria.exclusion
        ].filter(Boolean).join(' ');
        if (criteria) {
          parts.push(`Eligibility: ${criteria}`);
        }
      }
    }
    
    if (trial.eligibility_simple) {
      parts.push(`Simplified eligibility: ${trial.eligibility_simple}`);
    }
    
    if (trial.phase) {
      parts.push(`Phase: ${trial.phase}`);
    }
    
    return parts.join('. ');
  }

  /**
   * Keyword-based search for trials
   */
  private async keywordBasedSearch(profile: PatientProfile, limit: number): Promise<any[]> {
    const searchTerms = [
      ...profile.conditions,
      ...profile.symptoms,
      ...profile.previousTreatments
    ].join(' ');

    const { data, error } = await supabase
      .from('clinical_trials')
      .select('nct_id, title, conditions, eligibility_criteria, brief_summary')
      .textSearch('fts', searchTerms)
      .eq('status', 'RECRUITING')
      .limit(limit);

    if (error) {
      console.error('Keyword search error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Eligibility-based matching
   */
  private async eligibilityBasedMatching(profile: PatientProfile, limit: number): Promise<any[]> {
    let query = supabase
      .from('clinical_trials')
      .select('nct_id, title, eligibility_criteria, conditions')
      .eq('status', 'RECRUITING');

    // Age filtering
    if (profile.age) {
      // This would need proper age range parsing from eligibility criteria
      // For now, we'll do a simple text search
      query = query.not('eligibility_criteria', 'ilike', `%maximum age: ${profile.age - 10}%`);
    }

    // Gender filtering
    if (profile.gender && profile.gender !== 'other') {
      query = query.or(`eligibility_criteria.ilike.%${profile.gender}%,eligibility_criteria.ilike.%All%,eligibility_criteria.ilike.%Both%`);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error('Eligibility search error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Calculate location-based scores
   */
  private async calculateLocationScores(
    profile: PatientProfile, 
    trials: any[]
  ): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};
    
    if (!profile.location?.country) {
      // No location preference, return neutral scores
      trials.forEach(trial => {
        scores[trial.nct_id] = 0.5;
      });
      return scores;
    }

    trials.forEach(trial => {
      let score = 0;
      
      if (trial.locations && Array.isArray(trial.locations)) {
        const hasMatchingCountry = trial.locations.some((loc: any) => 
          loc.country?.toLowerCase() === profile.location?.country?.toLowerCase()
        );
        
        if (hasMatchingCountry) {
          score += 0.5;
          
          // Check for state/city matches
          if (profile.location.state) {
            const hasMatchingState = trial.locations.some((loc: any) => 
              loc.state?.toLowerCase() === profile.location?.state?.toLowerCase()
            );
            if (hasMatchingState) score += 0.3;
          }
          
          if (profile.location.city) {
            const hasMatchingCity = trial.locations.some((loc: any) => 
              loc.city?.toLowerCase() === profile.location?.city?.toLowerCase()
            );
            if (hasMatchingCity) score += 0.2;
          }
        }
      }
      
      scores[trial.nct_id] = Math.min(score, 1.0);
    });

    return scores;
  }

  /**
   * Enhance matches with additional scoring
   */
  private enhanceMatches(profile: PatientProfile, similarTrials: any[]): MatchResult[] {
    return similarTrials.map(trial => {
      const similarity = trial.similarity || 0;
      
      // Calculate semantic relevance based on condition overlap
      const semanticRelevance = this.calculateSemanticRelevance(profile, trial);
      
      // Calculate eligibility match
      const eligibilityMatch = this.calculateEligibilityMatch(profile, trial);
      
      // Calculate overall score
      const overallScore = (similarity * 0.4) + (semanticRelevance * 0.3) + (eligibilityMatch * 0.3);
      
      return {
        nct_id: trial.nct_id,
        title: trial.title,
        similarity_score: similarity,
        semantic_relevance: semanticRelevance,
        eligibility_match: eligibilityMatch,
        overall_score: overallScore,
        match_explanation: this.generateMatchExplanation(profile, trial, {
          similarity,
          semanticRelevance,
          eligibilityMatch,
          overallScore
        })
      };
    });
  }

  /**
   * Calculate semantic relevance between patient and trial
   */
  private calculateSemanticRelevance(profile: PatientProfile, trial: any): number {
    const patientTerms = new Set([
      ...profile.conditions.map(c => c.toLowerCase()),
      ...profile.symptoms.map(s => s.toLowerCase())
    ]);
    
    const trialTerms = new Set([
      ...(trial.conditions || []).map((c: string) => c.toLowerCase())
    ]);
    
    const intersection = new Set([...patientTerms].filter(x => trialTerms.has(x)));
    const union = new Set([...patientTerms, ...trialTerms]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate eligibility match score
   */
  private calculateEligibilityMatch(profile: PatientProfile, trial: any): number {
    let score = 0.5; // Base score
    
    // Age check
    if (profile.age && trial.eligibility_criteria) {
      // Simple age range check - in practice, this would need more sophisticated parsing
      const eligibilityText = JSON.stringify(trial.eligibility_criteria).toLowerCase();
      if (eligibilityText.includes('18') && profile.age >= 18) score += 0.2;
      if (eligibilityText.includes('65') && profile.age <= 65) score += 0.1;
    }
    
    // Gender check
    if (profile.gender && trial.eligibility_criteria) {
      const eligibilityText = JSON.stringify(trial.eligibility_criteria).toLowerCase();
      if (eligibilityText.includes(profile.gender.toLowerCase()) || 
          eligibilityText.includes('all') || 
          eligibilityText.includes('both')) {
        score += 0.2;
      }
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Combine multiple matching results
   */
  private combineMatchingResults(
    vectorMatches: MatchResult[],
    keywordMatches: any[],
    eligibilityMatches: any[],
    locationScores: Record<string, number>,
    weights: any
  ): MatchResult[] {
    const combinedMap = new Map<string, MatchResult>();
    
    // Start with vector matches as base
    vectorMatches.forEach(match => {
      combinedMap.set(match.nct_id, { ...match });
    });
    
    // Enhance with keyword and eligibility data
    [...keywordMatches, ...eligibilityMatches].forEach(trial => {
      if (combinedMap.has(trial.nct_id)) {
        const existing = combinedMap.get(trial.nct_id)!;
        existing.overall_score = (
          existing.similarity_score * weights.vectorWeight +
          existing.semantic_relevance * weights.keywordWeight +
          existing.eligibility_match * weights.eligibilityWeight +
          (locationScores[trial.nct_id] || 0) * weights.locationWeight
        );
      }
    });
    
    return Array.from(combinedMap.values());
  }

  /**
   * Generate explanation for match
   */
  private generateMatchExplanation(
    profile: PatientProfile, 
    trial: any, 
    scores: any
  ): string {
    const explanations = [];
    
    if (scores.similarity > 0.8) {
      explanations.push('High semantic similarity to your medical profile');
    } else if (scores.similarity > 0.6) {
      explanations.push('Good semantic match to your conditions');
    }
    
    if (scores.semanticRelevance > 0.5) {
      explanations.push('Shares common medical conditions with your profile');
    }
    
    if (scores.eligibilityMatch > 0.7) {
      explanations.push('Meets basic eligibility criteria');
    }
    
    if (explanations.length === 0) {
      explanations.push('Potential match based on available criteria');
    }
    
    return explanations.join('. ');
  }
}

// SQL functions for vector search (to be added to migration)
export const vectorSearchSQL = `
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create trial embeddings table
CREATE TABLE IF NOT EXISTS trial_embeddings (
  nct_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  conditions TEXT[] DEFAULT '{}',
  eligibility_text TEXT,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_trial_embeddings_vector 
ON trial_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Function to find similar trials
CREATE OR REPLACE FUNCTION find_similar_trials(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  nct_id text,
  title text,
  conditions text[],
  eligibility_text text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    te.nct_id,
    te.title,
    te.conditions,
    te.eligibility_text,
    1 - (te.embedding <=> query_embedding) as similarity
  FROM trial_embeddings te
  WHERE 1 - (te.embedding <=> query_embedding) > similarity_threshold
  ORDER BY te.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant permissions
GRANT SELECT ON trial_embeddings TO anon, authenticated;
GRANT INSERT, UPDATE ON trial_embeddings TO authenticated;
`;