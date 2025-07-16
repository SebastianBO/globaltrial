import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { action, data } = await req.json()

    switch (action) {
      case 'parse_eligibility':
        return await parseEligibility(supabaseClient, data)
      
      case 'match_patient':
        return await matchPatient(supabaseClient, data)
      
      case 'check_qualification':
        return await checkQualification(supabaseClient, data)
      
      case 'batch_process':
        return await batchProcessTrials(supabaseClient)
      
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function parseEligibility(supabase: any, data: any) {
  const { trial_id } = data
  
  // Get trial
  const { data: trial, error } = await supabase
    .from('clinical_trials')
    .select('*')
    .eq('id', trial_id)
    .single()
  
  if (error || !trial) {
    throw new Error('Trial not found')
  }
  
  // Parse eligibility with Groq
  const parsed = await parseWithGroq(trial.eligibility_criteria || trial.description)
  
  // Update trial with parsed data
  await supabase
    .from('clinical_trials')
    .update({
      eligibility_parsed: parsed,
      eligibility_simple: parsed.simple_explanation
    })
    .eq('id', trial_id)
  
  return new Response(JSON.stringify({
    success: true,
    parsed: parsed
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function parseWithGroq(criteria: string) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a medical expert who parses clinical trial eligibility criteria.
Extract and categorize all requirements into:
- Age requirements
- Medical conditions (required/excluded)
- Lab values with ranges
- Medications (required/prohibited)
- Other requirements

For each requirement, provide:
1. The original medical text
2. A patient-friendly explanation
3. Structured parameters (age ranges, lab values, etc.)

Return JSON with:
{
  "inclusion": [...],
  "exclusion": [...],
  "simple_explanation": "2-3 sentence summary for patients",
  "data_requirements": ["age", "conditions", "medications", etc.]
}`
        },
        {
          role: 'user',
          content: `Parse these eligibility criteria:\n\n${criteria}`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  })
  
  const result = await response.json()
  return JSON.parse(result.choices[0].message.content)
}

async function matchPatient(supabase: any, data: any) {
  const { patient_id, trial_id } = data
  
  // Get patient profile
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patient_id)
    .single()
  
  // Get trial with parsed eligibility
  const { data: trial } = await supabase
    .from('clinical_trials')
    .select('*')
    .eq('id', trial_id)
    .single()
  
  if (!trial.eligibility_parsed) {
    // Parse if needed
    await parseEligibility(supabase, { trial_id })
    const { data: updatedTrial } = await supabase
      .from('clinical_trials')
      .select('eligibility_parsed')
      .eq('id', trial_id)
      .single()
    trial.eligibility_parsed = updatedTrial.eligibility_parsed
  }
  
  // Evaluate match
  const matchResult = await evaluateMatch(patient, trial)
  
  // Store result
  await supabase
    .from('patient_trial_matches')
    .upsert({
      patient_id,
      trial_id,
      match_score: matchResult.score,
      match_reasons: matchResult,
      status: 'matched'
    })
  
  return new Response(JSON.stringify({
    success: true,
    match: matchResult
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function evaluateMatch(patient: any, trial: any) {
  const eligibility = trial.eligibility_parsed
  const results = {
    score: 0,
    status: 'unknown',
    matched_criteria: [],
    failed_criteria: [],
    missing_info: [],
    explanation: ''
  }
  
  let totalCriteria = 0
  let metCriteria = 0
  
  // Check inclusion criteria
  for (const criterion of eligibility.inclusion || []) {
    totalCriteria++
    const check = checkCriterion(patient, criterion)
    
    if (check.matches) {
      metCriteria++
      results.matched_criteria.push(check)
    } else if (check.missing) {
      results.missing_info.push(check)
    } else {
      results.failed_criteria.push(check)
    }
  }
  
  // Check exclusion criteria (inverse)
  for (const criterion of eligibility.exclusion || []) {
    totalCriteria++
    const check = checkCriterion(patient, criterion)
    
    if (!check.matches) { // Inverse for exclusions
      metCriteria++
      results.matched_criteria.push({ ...check, explanation: `Does not have: ${check.explanation}` })
    } else {
      results.failed_criteria.push({ ...check, explanation: `Has excluded condition: ${check.explanation}` })
    }
  }
  
  // Calculate score
  results.score = totalCriteria > 0 ? metCriteria / totalCriteria : 0
  
  // Determine status
  if (results.score >= 0.8 && results.missing_info.length === 0) {
    results.status = 'likely_eligible'
    results.explanation = 'You appear to meet the requirements for this trial.'
  } else if (results.score >= 0.6) {
    results.status = 'possibly_eligible'
    results.explanation = 'You may qualify for this trial, but should confirm some details.'
  } else if (results.missing_info.length > 2) {
    results.status = 'need_more_info'
    results.explanation = 'We need more information to determine if you qualify.'
  } else {
    results.status = 'likely_ineligible'
    results.explanation = 'You may not meet all requirements for this trial.'
  }
  
  return results
}

function checkCriterion(patient: any, criterion: any) {
  const result = {
    criterion: criterion.text,
    type: criterion.type,
    matches: false,
    missing: false,
    explanation: ''
  }
  
  switch (criterion.type) {
    case 'age':
      if (patient.age) {
        const { min_age, max_age } = criterion.parameters || {}
        result.matches = 
          (!min_age || patient.age >= min_age) &&
          (!max_age || patient.age <= max_age)
        result.explanation = `Age ${patient.age} ${result.matches ? 'meets' : 'does not meet'} requirement`
      } else {
        result.missing = true
        result.explanation = 'Age information needed'
      }
      break
      
    case 'condition':
      const requiredCondition = criterion.parameters?.condition_name
      if (patient.conditions && patient.conditions.length > 0) {
        result.matches = patient.conditions.some((c: string) =>
          c.toLowerCase().includes(requiredCondition?.toLowerCase() || '')
        )
        result.explanation = result.matches 
          ? `Has ${requiredCondition}`
          : `Does not have ${requiredCondition}`
      } else {
        result.missing = true
        result.explanation = 'Medical history needed'
      }
      break
      
    case 'medication':
      const requiredMed = criterion.parameters?.drug_name
      if (patient.current_medications) {
        result.matches = patient.current_medications.some((m: string) =>
          m.toLowerCase().includes(requiredMed?.toLowerCase() || '')
        )
        result.explanation = result.matches
          ? `Currently taking ${requiredMed}`
          : `Not taking ${requiredMed}`
      } else {
        result.missing = true
        result.explanation = 'Medication list needed'
      }
      break
      
    default:
      result.explanation = 'Cannot automatically evaluate this requirement'
  }
  
  return result
}

async function checkQualification(supabase: any, data: any) {
  const { question, trial_id } = data
  
  // Get trial
  const { data: trial } = await supabase
    .from('clinical_trials')
    .select('*')
    .eq('id', trial_id)
    .single()
  
  // Use Groq to answer qualification question
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
          content: `You are a helpful assistant answering questions about clinical trial eligibility.
Be encouraging but accurate. Use simple language.`
        },
        {
          role: 'user',
          content: `Trial: ${trial.title}
Conditions: ${trial.conditions?.join(', ')}
Eligibility: ${trial.eligibility_criteria || trial.description}

Patient question: ${question}

Provide a helpful, simple answer about whether they might qualify.`
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    })
  })
  
  const result = await response.json()
  
  return new Response(JSON.stringify({
    success: true,
    answer: result.choices[0].message.content
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function batchProcessTrials(supabase: any) {
  // Get trials without parsed eligibility
  const { data: trials } = await supabase
    .from('clinical_trials')
    .select('id, eligibility_criteria, description')
    .is('eligibility_parsed', null)
    .limit(10)
  
  let processed = 0
  
  for (const trial of trials || []) {
    try {
      if (trial.eligibility_criteria || trial.description) {
        const parsed = await parseWithGroq(
          trial.eligibility_criteria || trial.description
        )
        
        await supabase
          .from('clinical_trials')
          .update({
            eligibility_parsed: parsed,
            eligibility_simple: parsed.simple_explanation
          })
          .eq('id', trial.id)
        
        processed++
      }
    } catch (error) {
      console.error(`Failed to parse trial ${trial.id}:`, error)
    }
  }
  
  return new Response(JSON.stringify({
    success: true,
    processed,
    remaining: trials?.length === 10 ? 'more' : 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}