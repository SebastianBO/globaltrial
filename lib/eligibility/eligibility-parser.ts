import { createClient } from '@supabase/supabase-js';

interface EligibilityCriteria {
  raw_text: string;
  parsed: {
    inclusion: ParsedCriterion[];
    exclusion: ParsedCriterion[];
  };
  simple_explanation: string;
  match_requirements: MatchRequirement[];
}

interface ParsedCriterion {
  type: 'age' | 'condition' | 'lab_value' | 'medication' | 'procedure' | 'other';
  text: string;
  parameters?: any;
  patient_friendly: string;
}

interface MatchRequirement {
  category: string;
  requirement: string;
  friendly_text: string;
  must_have: boolean;
  data_needed: string[];
}

export class EligibilityParser {
  private supabase: any;
  private groqApiKey: string;

  constructor(supabaseUrl: string, supabaseKey: string, groqApiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.groqApiKey = groqApiKey;
  }

  async parseTrialEligibility(trialId: string): Promise<EligibilityCriteria> {
    // Get trial data
    const { data: trial } = await this.supabase
      .from('clinical_trials')
      .select('*')
      .eq('id', trialId)
      .single();

    if (!trial || !trial.eligibility_criteria) {
      throw new Error('Trial or eligibility criteria not found');
    }

    // Parse using AI
    const parsed = await this.parseWithAI(trial.eligibility_criteria);
    
    // Store parsed data
    await this.supabase
      .from('clinical_trials')
      .update({
        eligibility_parsed: parsed.parsed,
        eligibility_simple: parsed.simple_explanation
      })
      .eq('id', trialId);

    return parsed;
  }

  private async parseWithAI(criteria: string): Promise<EligibilityCriteria> {
    const prompt = `
Parse these clinical trial eligibility criteria into structured data.
Extract age ranges, medical conditions, lab values, medications, and procedures.
Convert medical terms to patient-friendly language.

Eligibility Criteria:
${criteria}

Return JSON with:
1. parsed: { inclusion: [...], exclusion: [...] } with each criterion categorized
2. simple_explanation: 2-3 sentence summary a patient can understand
3. match_requirements: What info we need from patient to check eligibility
`;

    const response = await this.callGroqAPI(prompt);
    return this.validateAndEnrichParsedCriteria(response);
  }

  private async callGroqAPI(prompt: string): Promise<any> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a medical expert who translates complex clinical trial criteria into patient-friendly language. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  private validateAndEnrichParsedCriteria(parsed: any): EligibilityCriteria {
    // Enrich with medical term mappings
    const enriched = { ...parsed };

    // Add MeSH mappings for conditions
    enriched.parsed.inclusion = enriched.parsed.inclusion.map((criterion: any) => {
      if (criterion.type === 'condition') {
        criterion.mesh_terms = this.findMeshTerms(criterion.text);
      }
      return criterion;
    });

    // Validate required fields
    if (!enriched.simple_explanation) {
      enriched.simple_explanation = 'This trial has specific requirements. Please check with your doctor.';
    }

    return enriched;
  }

  private async findMeshTerms(condition: string): Promise<string[]> {
    // Query MeSH database for matching terms
    const { data: meshTerms } = await this.supabase
      .from('mesh_cache')
      .select('mesh_id, preferred_term')
      .textSearch('condition_name', condition)
      .limit(5);

    return meshTerms?.map((t: any) => t.mesh_id) || [];
  }

  // Extract specific requirements
  extractRequirements(criteria: ParsedCriterion[]): MatchRequirement[] {
    const requirements: MatchRequirement[] = [];

    for (const criterion of criteria) {
      switch (criterion.type) {
        case 'age':
          requirements.push({
            category: 'demographics',
            requirement: 'age',
            friendly_text: criterion.patient_friendly,
            must_have: true,
            data_needed: ['date_of_birth', 'age']
          });
          break;

        case 'condition':
          requirements.push({
            category: 'medical_history',
            requirement: 'diagnosis',
            friendly_text: criterion.patient_friendly,
            must_have: true,
            data_needed: ['conditions', 'diagnoses']
          });
          break;

        case 'lab_value':
          requirements.push({
            category: 'lab_results',
            requirement: criterion.parameters?.test_name || 'lab_test',
            friendly_text: criterion.patient_friendly,
            must_have: false,
            data_needed: ['recent_lab_results']
          });
          break;

        case 'medication':
          requirements.push({
            category: 'medications',
            requirement: criterion.parameters?.drug_name || 'medication',
            friendly_text: criterion.patient_friendly,
            must_have: true,
            data_needed: ['current_medications', 'medication_history']
          });
          break;
      }
    }

    return requirements;
  }
}