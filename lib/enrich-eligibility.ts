import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function parseEligibility(criteria: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a medical expert. Parse clinical trial eligibility criteria into simple patient-friendly language. Extract age ranges, conditions, and key requirements.'
          },
          {
            role: 'user',
            content: `Convert this eligibility criteria to patient-friendly language:\n\n${criteria}\n\nProvide:\n1. Simple 2-3 sentence summary\n2. Key requirements in bullet points`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Groq API error:', data.error);
      return null;
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Groq:', error);
    return null;
  }
}

async function enrichTrialsWithEligibility() {
  console.log('Starting eligibility enrichment...');

  // Get trials that need parsing
  const { data: trials, error } = await supabase
    .from('clinical_trials')
    .select('id, trial_id, title, eligibility_criteria')
    .not('eligibility_criteria', 'is', null)
    .is('eligibility_simple', null)
    .limit(10);

  if (error) {
    console.error('Error fetching trials:', error);
    return;
  }

  console.log(`Found ${trials.length} trials to process`);

  for (const trial of trials as any[]) {
    console.log(`Processing trial ${trial.trial_id}: ${trial.title}`);
    
    const parsed = await parseEligibility(trial.eligibility_criteria.criteria);
    
    if (parsed) {
      const { error: updateError } = await supabase
        .from('clinical_trials')
        .update({ 
          eligibility_simple: parsed,
          updated_at: new Date()
        })
        .eq('id', trial.id);

      if (updateError) {
        console.error(`Failed to update trial ${trial.id}:`, updateError);
      } else {
        console.log(`✓ Successfully parsed eligibility for ${trial.trial_id}`);
      }
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('Eligibility enrichment complete!');
}

export { parseEligibility, enrichTrialsWithEligibility };