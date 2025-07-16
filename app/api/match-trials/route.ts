import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

function getGroqClient() {
  const groqApiKey = process.env.GROQ_API_KEY;
  
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }
  
  return new Groq({
    apiKey: groqApiKey,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { patientId, conditions, medicalHistory, location } = await request.json()
    const supabase = await createClient()

    // Enhance conditions with medical terminology
    const enhancedConditions = [];
    for (const condition of conditions) {
      const { data: termMapping } = await supabase
        .rpc('find_medical_terms', { patient_input: condition.toLowerCase() });
      
      if (termMapping && termMapping.length > 0) {
        enhancedConditions.push(...termMapping[0].medical_terms);
      } else {
        enhancedConditions.push(condition);
      }
    }
    
    // Fetch all recruiting trials that match any of the conditions
    const { data: trials, error: trialsError } = await supabase
      .from('clinical_trials')
      .select('*')
      .eq('status', 'recruiting')
      .or(enhancedConditions.map(c => `conditions.cs.{${c}}`).join(','))

    if (trialsError) throw trialsError

    // Use AI to analyze and match trials
    const matchPromises = trials.map(async (trial) => {
      const prompt = `
        Analyze if this patient is a good match for the clinical trial.
        
        Patient Information:
        - Conditions: ${conditions.join(', ')}
        - Medical History: ${medicalHistory}
        - Location: ${location.city}, ${location.state}, ${location.country}
        
        Trial Information:
        - Title: ${trial.title}
        - Conditions: ${trial.conditions?.join(', ')}
        - Description: ${trial.description}
        - Eligibility: ${JSON.stringify(trial.eligibility_criteria)}
        - Locations: ${JSON.stringify(trial.locations)}
        
        Provide a match score from 0 to 1 and explain the key matching factors.
        Response format: { "score": 0.0-1.0, "reasons": ["reason1", "reason2"] }
      `

      try {
        const groq = getGroqClient();
        const completion = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are a clinical trial matching expert. Analyze patient-trial compatibility based on medical conditions, eligibility criteria, and location. Be conservative with match scores."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3
        })

        const result = JSON.parse(completion.choices[0].message.content || '{}')
        
        return {
          trial_id: trial.id,
          score: result.score || 0,
          reasons: result.reasons || []
        }
      } catch (error) {
        console.error('AI matching error:', error)
        return null
      }
    })

    const matchResults = (await Promise.all(matchPromises)).filter(Boolean)
    
    // Filter and sort by score
    const relevantMatches = matchResults
      .filter(match => match!.score > 0.3)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 10)

    // Save matches to database
    if (relevantMatches.length > 0) {
      const { error: matchError } = await supabase
        .from('patient_trial_matches')
        .insert(
          relevantMatches.map(match => ({
            patient_id: patientId,
            trial_id: match!.trial_id,
            match_score: match!.score,
            match_reasons: { reasons: match!.reasons },
            status: 'matched'
          }))
        )

      if (matchError) throw matchError
    }

    return NextResponse.json({ 
      success: true, 
      matchCount: relevantMatches.length 
    })
  } catch (error) {
    console.error('Match trials error:', error)
    return NextResponse.json(
      { error: 'Failed to match trials' },
      { status: 500 }
    )
  }
}