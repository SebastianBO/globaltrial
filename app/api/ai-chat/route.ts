import { createGroq } from '@ai-sdk/groq';
import { convertToCoreMessages, streamText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY!,
});

// Schema for extracted patient data
const patientDataSchema = z.object({
  conditions: z.array(z.string()).describe('Medical conditions mentioned by the patient'),
  medications: z.array(z.string()).describe('Current medications'),
  symptoms: z.array(z.string()).describe('Symptoms described by the patient'),
  age: z.number().optional().describe('Patient age'),
  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
  location: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional()
  }).optional(),
  previousTreatments: z.array(z.string()).describe('Previous treatments or therapies'),
  allergies: z.array(z.string()).describe('Known allergies'),
  smokingStatus: z.enum(['never', 'former', 'current']).optional(),
  pregnancyStatus: z.enum(['not-applicable', 'pregnant', 'not-pregnant', 'trying-to-conceive']).optional(),
  insuranceStatus: z.string().optional(),
  transportationConcerns: z.boolean().optional(),
  timeAvailability: z.string().optional(),
  compensationInterest: z.boolean().optional().describe('Whether patient is interested in compensation'),
  urgency: z.enum(['low', 'medium', 'high']).describe('How urgently the patient needs treatment'),
  isComplete: z.boolean().describe('Whether enough information has been gathered'),
  shouldContinue: z.boolean().describe('Whether the conversation should continue')
});

type PatientData = z.infer<typeof patientDataSchema>;

export async function POST(req: Request) {
  try {
    const { messages, mode = 'conversation' } = await req.json();
    
    // System prompt for the AI intake specialist
    const systemPrompt = `You are Emily, a compassionate medical intake specialist at GlobalTrials, the world's first global clinical trials marketplace. Your role is to help patients find relevant clinical trials through natural conversation.

CONVERSATION GUIDELINES:
- Be warm, empathetic, and professional
- Ask open-ended questions to understand their medical situation
- Gather information about their condition, symptoms, treatments, and needs
- Don't ask too many questions at once - keep it conversational
- Show genuine interest in helping them find appropriate trials
- Be encouraging about clinical trial opportunities

INFORMATION TO GATHER:
1. Primary medical condition/diagnosis
2. Current symptoms and severity
3. Previous treatments tried
4. Current medications
5. Age and basic demographics
6. Location (for finding nearby trials)
7. Treatment urgency
8. Interest in compensation
9. Transportation/logistical considerations
10. Insurance status

CONVERSATION FLOW:
- Start with understanding their main health concern
- Ask follow-up questions based on their responses
- Gradually gather more details as the conversation flows naturally
- When you have enough information, guide toward finding matching trials

Remember: Patients may use non-medical language. Help translate their concerns into medical terms when appropriate.`;

    if (mode === 'conversation') {
      // Stream the conversation
      const result = await streamText({
        model: groq('llama-3.1-8b-instant'),
        system: systemPrompt,
        messages: convertToCoreMessages(messages),
        maxTokens: 500,
        temperature: 0.7,
        tools: {
          extractPatientData: {
            description: 'Extract structured patient data from the conversation',
            parameters: patientDataSchema,
            execute: async (data) => {
              console.log('Extracted patient data:', data);
              return data;
            }
          },
          searchTrials: {
            description: 'Search for clinical trials based on patient information',
            parameters: z.object({
              conditions: z.array(z.string()),
              location: z.object({
                city: z.string().optional(),
                state: z.string().optional(),
                country: z.string().optional()
              }).optional(),
              urgency: z.enum(['low', 'medium', 'high']).optional()
            }),
            execute: async ({ conditions, location, urgency }) => {
              // Search for trials
              let query = supabase
                .from('clinical_trials')
                .select('nct_id, title, brief_title, status, phase, conditions, brief_summary, locations')
                .eq('status', 'RECRUITING')
                .limit(5);

              // Filter by conditions if provided
              if (conditions.length > 0) {
                query = query.or(
                  conditions.map(condition => `conditions.cs.{${condition}}`).join(',')
                );
              }

              const { data: trials, error } = await query;
              
              if (error) {
                console.error('Error searching trials:', error);
                return { trials: [], error: 'Failed to search trials' };
              }

              return { trials: trials || [], count: trials?.length || 0 };
            }
          }
        }
      });

      return result.toDataStreamResponse();
    } 
    
    if (mode === 'extract') {
      // Extract structured data from conversation
      const conversationText = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      
      const extractionPrompt = `Based on the following conversation between a medical intake specialist and a patient, extract structured patient information. Focus on medical conditions, symptoms, treatments, demographics, and trial preferences.

Conversation:
${conversationText}

Extract the information into the specified schema. If information is not mentioned, don't include it or mark as unknown. Determine if enough information has been gathered to proceed with trial matching.`;

      const result = await streamText({
        model: groq('llama-3.1-8b-instant'),
        system: 'You are a medical data extraction specialist. Extract patient information accurately from conversations.',
        prompt: extractionPrompt,
        tools: {
          extractedData: {
            description: 'The extracted patient data from the conversation',
            parameters: patientDataSchema,
            execute: async (data) => data
          }
        },
        toolChoice: 'required'
      });

      return result.toDataStreamResponse();
    }

    if (mode === 'match') {
      // Enhanced trial matching using extracted patient data
      const { patientData } = await req.json();
      
      // Get enhanced conditions using MeSH translation
      const enhancedConditions = await enhanceConditionsWithMedicalTerms(patientData.conditions || []);
      
      // Search for trials
      const { data: trials, error } = await supabase
        .from('clinical_trials')
        .select(`
          id, nct_id, title, brief_title, status, phase, conditions, 
          brief_summary, eligibility_criteria, locations, sponsors,
          primary_outcome, enrollment, eligibility_simple
        `)
        .eq('status', 'RECRUITING')
        .limit(20);

      if (error) {
        throw new Error('Failed to fetch trials for matching');
      }

      // Use AI to score and match trials
      const matchingPrompt = `You are a clinical trial matching specialist. Score how well each trial matches this patient profile on a scale of 0-1.

Patient Profile:
${JSON.stringify(patientData, null, 2)}

Enhanced Medical Conditions: ${enhancedConditions.join(', ')}

For each trial, provide:
1. Match score (0-1)
2. Reason for the score
3. Key eligibility factors
4. Potential concerns or requirements

Be thorough but concise in your reasoning.`;

      const result = await streamText({
        model: groq('llama-3.1-70b-versatile'), // Use more powerful model for matching
        system: 'You are an expert clinical trial matching specialist with deep knowledge of medical conditions and trial eligibility criteria.',
        prompt: matchingPrompt,
        tools: {
          trialMatches: {
            description: 'Generated trial matches with scores and reasoning',
            parameters: z.object({
              matches: z.array(z.object({
                nct_id: z.string(),
                match_score: z.number().min(0).max(1),
                reasoning: z.string(),
                eligibility_summary: z.string(),
                concerns: z.array(z.string()).optional(),
                next_steps: z.string().optional()
              }))
            }),
            execute: async ({ matches }) => {
              // Save matches to database
              const patientMatches = matches.map(match => ({
                patient_id: patientData.id, // Would be set from patient creation
                trial_id: match.nct_id,
                match_score: match.match_score,
                match_reason: match.reasoning,
                eligibility_notes: match.eligibility_summary,
                created_at: new Date().toISOString()
              }));

              // Insert matches into database
              if (patientData.id) {
                await supabase
                  .from('patient_trial_matches')
                  .upsert(patientMatches);
              }

              return { matches, saved: patientMatches.length };
            }
          }
        },
        maxTokens: 2000,
        temperature: 0.1
      });

      return result.toDataStreamResponse();
    }

    return new Response('Invalid mode', { status: 400 });

  } catch (error) {
    console.error('AI Chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

/**
 * Enhance patient conditions with medical terminology
 */
async function enhanceConditionsWithMedicalTerms(conditions: string[]): Promise<string[]> {
  if (conditions.length === 0) return [];

  const enhancedConditions = new Set(conditions);

  // Check database for existing mappings
  const { data: mappings } = await supabase
    .from('medical_term_mappings')
    .select('patient_term, medical_terms')
    .in('patient_term', conditions);

  if (mappings) {
    mappings.forEach(mapping => {
      mapping.medical_terms.forEach((term: string) => {
        enhancedConditions.add(term);
      });
    });
  }

  // For new conditions, use AI to suggest medical terms
  const unmappedConditions = conditions.filter(condition => 
    !mappings?.some(m => m.patient_term.toLowerCase() === condition.toLowerCase())
  );

  if (unmappedConditions.length > 0) {
    try {
      const medicalTermPrompt = `Convert these patient-described conditions to standard medical terminology:

Patient terms: ${unmappedConditions.join(', ')}

Provide medical terms that would be used in clinical trials and medical literature. Return as a JSON array of objects with 'patient_term' and 'medical_terms' (array).`;

      const result = await streamText({
        model: groq('llama-3.1-8b-instant'),
        prompt: medicalTermPrompt,
        maxTokens: 400
      });

      // Parse the response and add to enhanced conditions
      // This would need proper JSON parsing implementation
    } catch (error) {
      console.error('Error enhancing conditions:', error);
    }
  }

  return Array.from(enhancedConditions);
}