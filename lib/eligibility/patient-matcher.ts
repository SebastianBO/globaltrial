import { createClient } from '@supabase/supabase-js';
import { EligibilityParser } from './eligibility-parser';

interface PatientProfile {
  id: string;
  age: number;
  gender: string;
  conditions: string[];
  medications: Medication[];
  lab_results?: LabResult[];
  location: {
    city: string;
    state: string;
    country: string;
    max_travel_distance?: number;
  };
  preferences: {
    compensation_required?: boolean;
    phase_preferences?: string[];
    time_commitment?: string;
  };
}

interface Medication {
  name: string;
  dose?: string;
  frequency?: string;
  start_date?: Date;
}

interface LabResult {
  test_name: string;
  value: number | string;
  unit: string;
  date: Date;
  normal_range?: string;
}

interface MatchResult {
  trial_id: string;
  match_score: number;
  eligibility_status: 'likely_eligible' | 'possibly_eligible' | 'likely_ineligible' | 'need_more_info';
  matched_criteria: MatchedCriterion[];
  missing_info: string[];
  explanation: string;
  next_steps: string;
}

interface MatchedCriterion {
  criterion: string;
  patient_value: any;
  required_value: any;
  matches: boolean;
  confidence: number;
  explanation: string;
}

export class PatientMatcher {
  private supabase: any;
  private parser: EligibilityParser;
  private groqApiKey: string;

  constructor(supabaseUrl: string, supabaseKey: string, groqApiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.parser = new EligibilityParser(supabaseUrl, supabaseKey, groqApiKey);
    this.groqApiKey = groqApiKey;
  }

  async matchPatientToTrial(
    patientProfile: PatientProfile,
    trialId: string
  ): Promise<MatchResult> {
    // Get trial with parsed eligibility
    const { data: trial } = await this.supabase
      .from('clinical_trials')
      .select('*')
      .eq('id', trialId)
      .single();

    if (!trial.eligibility_parsed) {
      // Parse eligibility if not already done
      await this.parser.parseTrialEligibility(trialId);
      const { data: updatedTrial } = await this.supabase
        .from('clinical_trials')
        .select('*')
        .eq('id', trialId)
        .single();
      trial.eligibility_parsed = updatedTrial.eligibility_parsed;
    }

    // Match patient against criteria
    const matchResult = await this.evaluateEligibility(
      patientProfile,
      trial.eligibility_parsed,
      trial
    );

    // Store match result
    await this.storeMatchResult(patientProfile.id, trialId, matchResult);

    return matchResult;
  }

  private async evaluateEligibility(
    patient: PatientProfile,
    eligibility: any,
    trial: any
  ): Promise<MatchResult> {
    const matchedCriteria: MatchedCriterion[] = [];
    const missingInfo: string[] = [];
    let totalScore = 0;
    let criteriaCount = 0;

    // Check inclusion criteria
    for (const criterion of eligibility.inclusion || []) {
      const match = await this.checkCriterion(patient, criterion);
      matchedCriteria.push(match);
      totalScore += match.matches ? match.confidence : 0;
      criteriaCount++;

      if (match.confidence < 0.5) {
        missingInfo.push(this.getMissingInfoMessage(criterion));
      }
    }

    // Check exclusion criteria (inverse scoring)
    for (const criterion of eligibility.exclusion || []) {
      const match = await this.checkCriterion(patient, criterion);
      match.matches = !match.matches; // Invert for exclusions
      matchedCriteria.push(match);
      totalScore += match.matches ? match.confidence : 0;
      criteriaCount++;
    }

    // Calculate overall match score
    const matchScore = criteriaCount > 0 ? totalScore / criteriaCount : 0;

    // Determine eligibility status
    const status = this.determineEligibilityStatus(matchScore, missingInfo.length);

    // Generate explanation
    const explanation = await this.generateExplanation(
      patient,
      trial,
      matchedCriteria,
      status
    );

    return {
      trial_id: trial.id,
      match_score: matchScore,
      eligibility_status: status,
      matched_criteria: matchedCriteria,
      missing_info: missingInfo,
      explanation: explanation.summary,
      next_steps: explanation.next_steps
    };
  }

  private async checkCriterion(
    patient: PatientProfile,
    criterion: any
  ): Promise<MatchedCriterion> {
    switch (criterion.type) {
      case 'age':
        return this.checkAgeCriterion(patient, criterion);
      
      case 'condition':
        return this.checkConditionCriterion(patient, criterion);
      
      case 'medication':
        return this.checkMedicationCriterion(patient, criterion);
      
      case 'lab_value':
        return this.checkLabValueCriterion(patient, criterion);
      
      default:
        return {
          criterion: criterion.text,
          patient_value: null,
          required_value: criterion.parameters,
          matches: false,
          confidence: 0.3,
          explanation: 'Unable to evaluate this criterion automatically'
        };
    }
  }

  private checkAgeCriterion(patient: PatientProfile, criterion: any): MatchedCriterion {
    const { min_age, max_age } = criterion.parameters || {};
    const patientAge = patient.age;

    const matches = 
      (!min_age || patientAge >= min_age) &&
      (!max_age || patientAge <= max_age);

    return {
      criterion: criterion.patient_friendly,
      patient_value: patientAge,
      required_value: `${min_age || 'any'}-${max_age || 'any'} years`,
      matches,
      confidence: 1.0,
      explanation: matches 
        ? `You are ${patientAge} years old, which meets the age requirement`
        : `You are ${patientAge} years old, but this trial requires ages ${min_age}-${max_age}`
    };
  }

  private async checkConditionCriterion(
    patient: PatientProfile,
    criterion: any
  ): Promise<MatchedCriterion> {
    const requiredCondition = criterion.parameters?.condition_name || criterion.text;
    
    // Check direct match
    const directMatch = patient.conditions.some(c => 
      c.toLowerCase().includes(requiredCondition.toLowerCase())
    );

    if (directMatch) {
      return {
        criterion: criterion.patient_friendly,
        patient_value: patient.conditions,
        required_value: requiredCondition,
        matches: true,
        confidence: 1.0,
        explanation: `You have ${requiredCondition}, which is required for this trial`
      };
    }

    // Check using medical term mappings
    const semanticMatch = await this.checkSemanticConditionMatch(
      patient.conditions,
      requiredCondition
    );

    return {
      criterion: criterion.patient_friendly,
      patient_value: patient.conditions,
      required_value: requiredCondition,
      matches: semanticMatch.matches,
      confidence: semanticMatch.confidence,
      explanation: semanticMatch.explanation
    };
  }

  private checkMedicationCriterion(
    patient: PatientProfile,
    criterion: any
  ): MatchedCriterion {
    const requiredMed = criterion.parameters?.drug_name;
    const requiredDose = criterion.parameters?.min_dose;
    const requiredDuration = criterion.parameters?.min_duration_weeks;

    const patientMed = patient.medications.find(m => 
      m.name.toLowerCase().includes(requiredMed?.toLowerCase() || '')
    );

    if (!patientMed) {
      return {
        criterion: criterion.patient_friendly,
        patient_value: patient.medications.map(m => m.name),
        required_value: requiredMed,
        matches: false,
        confidence: 1.0,
        explanation: `This trial requires ${requiredMed}, which you are not currently taking`
      };
    }

    // Check dose if required
    let meetsRequirements = true;
    let explanation = `You are taking ${patientMed.name}`;

    if (requiredDose && patientMed.dose) {
      const patientDoseNum = this.extractNumericDose(patientMed.dose);
      const requiredDoseNum = this.extractNumericDose(requiredDose);
      
      if (patientDoseNum < requiredDoseNum) {
        meetsRequirements = false;
        explanation += `, but the dose (${patientMed.dose}) is below the required ${requiredDose}`;
      } else {
        explanation += ` at an adequate dose (${patientMed.dose})`;
      }
    }

    return {
      criterion: criterion.patient_friendly,
      patient_value: patientMed,
      required_value: { drug: requiredMed, dose: requiredDose },
      matches: meetsRequirements,
      confidence: 0.9,
      explanation
    };
  }

  private checkLabValueCriterion(
    patient: PatientProfile,
    criterion: any
  ): MatchedCriterion {
    const testName = criterion.parameters?.test_name;
    const minValue = criterion.parameters?.min_value;
    const maxValue = criterion.parameters?.max_value;

    if (!patient.lab_results) {
      return {
        criterion: criterion.patient_friendly,
        patient_value: null,
        required_value: `${testName}: ${minValue}-${maxValue}`,
        matches: false,
        confidence: 0,
        explanation: `Lab result for ${testName} is needed but not provided`
      };
    }

    const labResult = patient.lab_results.find(l => 
      l.test_name.toLowerCase().includes(testName?.toLowerCase() || '')
    );

    if (!labResult) {
      return {
        criterion: criterion.patient_friendly,
        patient_value: null,
        required_value: `${testName}: ${minValue}-${maxValue}`,
        matches: false,
        confidence: 0,
        explanation: `${testName} test result not found in your records`
      };
    }

    const value = typeof labResult.value === 'number' 
      ? labResult.value 
      : parseFloat(labResult.value as string);

    const matches = 
      (!minValue || value >= minValue) &&
      (!maxValue || value <= maxValue);

    return {
      criterion: criterion.patient_friendly,
      patient_value: `${value} ${labResult.unit}`,
      required_value: `${minValue || 'any'}-${maxValue || 'any'} ${labResult.unit}`,
      matches,
      confidence: 1.0,
      explanation: matches
        ? `Your ${testName} (${value}) is within the required range`
        : `Your ${testName} (${value}) is outside the required range (${minValue}-${maxValue})`
    };
  }

  private async checkSemanticConditionMatch(
    patientConditions: string[],
    requiredCondition: string
  ): Promise<{ matches: boolean; confidence: number; explanation: string }> {
    // Query medical term mappings
    const { data: mappings } = await this.supabase
      .from('medical_term_mappings')
      .select('*')
      .contains('medical_terms', [requiredCondition]);

    for (const mapping of mappings || []) {
      for (const patientTerm of mapping.patient_terms) {
        if (patientConditions.some(c => 
          c.toLowerCase().includes(patientTerm.toLowerCase())
        )) {
          return {
            matches: true,
            confidence: 0.85,
            explanation: `Your condition "${patientConditions.find(c => 
              c.toLowerCase().includes(patientTerm.toLowerCase())
            )}" matches the requirement for ${requiredCondition}`
          };
        }
      }
    }

    return {
      matches: false,
      confidence: 0.7,
      explanation: `Could not confirm if your conditions match the requirement for ${requiredCondition}`
    };
  }

  private determineEligibilityStatus(
    matchScore: number,
    missingInfoCount: number
  ): MatchResult['eligibility_status'] {
    if (matchScore >= 0.8 && missingInfoCount === 0) {
      return 'likely_eligible';
    } else if (matchScore >= 0.6) {
      return 'possibly_eligible';
    } else if (missingInfoCount > 3) {
      return 'need_more_info';
    } else {
      return 'likely_ineligible';
    }
  }

  private async generateExplanation(
    patient: PatientProfile,
    trial: any,
    matchedCriteria: MatchedCriterion[],
    status: MatchResult['eligibility_status']
  ): Promise<{ summary: string; next_steps: string }> {
    const prompt = `
Generate a patient-friendly explanation of their eligibility for a clinical trial.

Trial: ${trial.title}
Condition: ${trial.conditions?.join(', ')}
Patient Age: ${patient.age}
Patient Conditions: ${patient.conditions.join(', ')}
Eligibility Status: ${status}

Key matches:
${matchedCriteria.filter(m => m.matches).map(m => `✓ ${m.explanation}`).join('\n')}

Key mismatches:
${matchedCriteria.filter(m => !m.matches).map(m => `✗ ${m.explanation}`).join('\n')}

Provide:
1. A 2-3 sentence summary explaining if they might qualify
2. Clear next steps they should take
`;

    const response = await this.callGroqAPI(prompt);
    return response;
  }

  private async callGroqAPI(prompt: string): Promise<any> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful medical assistant explaining clinical trial eligibility to patients in simple, encouraging language.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse response
    const lines = content.split('\n');
    const summaryStart = lines.findIndex((l: string) => l.includes('Summary:'));
    const stepsStart = lines.findIndex((l: string) => l.includes('Next steps:'));
    
    return {
      summary: lines.slice(summaryStart + 1, stepsStart).join(' ').trim(),
      next_steps: lines.slice(stepsStart + 1).join(' ').trim()
    };
  }

  private extractNumericDose(doseString: string): number {
    const match = doseString.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private getMissingInfoMessage(criterion: any): string {
    switch (criterion.type) {
      case 'lab_value':
        return `Recent ${criterion.parameters?.test_name || 'lab'} test results needed`;
      case 'medication':
        return `Current medication details needed`;
      default:
        return `Additional information needed for: ${criterion.patient_friendly}`;
    }
  }

  private async storeMatchResult(
    patientId: string,
    trialId: string,
    matchResult: MatchResult
  ): Promise<void> {
    await this.supabase
      .from('patient_trial_matches')
      .upsert({
        patient_id: patientId,
        trial_id: trialId,
        match_score: matchResult.match_score,
        match_reasons: {
          eligibility_status: matchResult.eligibility_status,
          matched_criteria: matchResult.matched_criteria,
          missing_info: matchResult.missing_info,
          explanation: matchResult.explanation,
          next_steps: matchResult.next_steps
        },
        status: 'matched',
        created_at: new Date()
      });
  }
}