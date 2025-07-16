import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'quick_check':
        return await handleQuickCheck(data);
      
      case 'detailed_match':
        return await handleDetailedMatch(data);
      
      case 'ask_question':
        return await handleQuestion(data);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Eligibility check error:', error);
    return NextResponse.json(
      { error: 'Failed to check eligibility' },
      { status: 500 }
    );
  }
}

async function handleQuickCheck(data: any) {
  const { trial_id, patient_info } = data;

  // Quick eligibility check based on basic info
  const quickChecks = [];

  // Age check
  if (patient_info.age) {
    const { data: trial } = await supabase
      .from('clinical_trials')
      .select('eligibility_parsed')
      .eq('id', trial_id)
      .single();

    if (trial?.eligibility_parsed?.inclusion) {
      const ageCriteria = trial.eligibility_parsed.inclusion.find(
        (c: any) => c.type === 'age'
      );
      
      if (ageCriteria) {
        const { min_age, max_age } = ageCriteria.parameters || {};
        const qualifies = 
          (!min_age || patient_info.age >= min_age) &&
          (!max_age || patient_info.age <= max_age);
        
        quickChecks.push({
          criterion: 'Age',
          qualifies,
          message: qualifies
            ? `✓ Your age (${patient_info.age}) meets the requirement`
            : `✗ This trial requires ages ${min_age}-${max_age}`
        });
      }
    }
  }

  // Condition check
  if (patient_info.condition) {
    const { data: trial } = await supabase
      .from('clinical_trials')
      .select('conditions')
      .eq('id', trial_id)
      .single();

    const hasCondition = trial?.conditions?.some((c: string) =>
      c.toLowerCase().includes(patient_info.condition.toLowerCase())
    );

    quickChecks.push({
      criterion: 'Condition',
      qualifies: hasCondition,
      message: hasCondition
        ? `✓ This trial is studying ${patient_info.condition}`
        : `✗ This trial is for different conditions`
    });
  }

  // Location check
  if (patient_info.location) {
    const { data: trial } = await supabase
      .from('clinical_trials')
      .select('locations')
      .eq('id', trial_id)
      .single();

    const nearbyLocation = trial?.locations?.some((loc: any) => {
      // Simple location check - in production, use geocoding
      return loc.city?.toLowerCase().includes(patient_info.location.toLowerCase()) ||
             loc.state?.toLowerCase().includes(patient_info.location.toLowerCase());
    });

    quickChecks.push({
      criterion: 'Location',
      qualifies: nearbyLocation,
      message: nearbyLocation
        ? `✓ Trial locations available near ${patient_info.location}`
        : `✗ No nearby locations for this trial`
    });
  }

  const qualifyingChecks = quickChecks.filter(c => c.qualifies).length;
  const totalChecks = quickChecks.length;
  const likelyQualifies = totalChecks > 0 && (qualifyingChecks / totalChecks) >= 0.5;

  return NextResponse.json({
    quickChecks,
    likelyQualifies,
    message: likelyQualifies
      ? 'You may qualify for this trial! Complete a detailed assessment to confirm.'
      : 'You might not qualify for this trial, but a detailed check can provide more information.',
    nextStep: 'Complete detailed eligibility assessment'
  });
}

async function handleDetailedMatch(data: any) {
  const { trial_id, patient_profile } = data;

  // Call Edge Function for detailed matching
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/eligibility-processor`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'match_patient',
        data: {
          patient_id: patient_profile.id || 'anonymous',
          trial_id
        }
      })
    }
  );

  const result = await response.json();

  return NextResponse.json({
    ...result.match,
    recommendations: generateRecommendations(result.match)
  });
}

async function handleQuestion(data: any) {
  const { trial_id, question } = data;

  // Call Edge Function to answer question
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/eligibility-processor`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'check_qualification',
        data: { trial_id, question }
      })
    }
  );

  const result = await response.json();

  return NextResponse.json({
    answer: result.answer,
    suggestedQuestions: [
      'What are the age requirements?',
      'Do I need to stop my current medications?',
      'How often would I need to visit?',
      'Is there compensation for participation?'
    ]
  });
}

function generateRecommendations(matchResult: any) {
  const recommendations = [];

  if (matchResult.status === 'likely_eligible') {
    recommendations.push({
      action: 'Contact trial coordinator',
      priority: 'high',
      message: 'You appear to meet the requirements. Contact the trial team to confirm eligibility.'
    });
  }

  if (matchResult.missing_info.length > 0) {
    recommendations.push({
      action: 'Gather medical records',
      priority: 'medium',
      message: `Please have the following information ready: ${matchResult.missing_info.join(', ')}`
    });
  }

  if (matchResult.status === 'possibly_eligible') {
    recommendations.push({
      action: 'Schedule screening',
      priority: 'medium',
      message: 'You may qualify. A screening visit can determine final eligibility.'
    });
  }

  return recommendations;
}