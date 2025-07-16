import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate realistic compensation based on trial characteristics
function generateCompensation(phase: string, condition: string, interventionCount: number) {
  // Base amounts by phase
  const phaseMultipliers: Record<string, number> = {
    'PHASE1': 3000,
    'PHASE2': 2000,
    'PHASE3': 1500,
    'PHASE4': 1000,
    'NA': 1200
  }
  
  // Condition severity multipliers
  const conditionMultipliers: Record<string, number> = {
    'cancer': 1.5,
    'alzheimer': 1.4,
    'heart disease': 1.3,
    'covid-19': 1.2,
    'diabetes': 1.1,
    'hypertension': 1.0
  }
  
  const baseAmount = phaseMultipliers[phase] || 1200
  const conditionMultiplier = conditionMultipliers[condition.toLowerCase()] || 1.0
  const interventionBonus = interventionCount * 200
  
  const totalAmount = Math.round((baseAmount * conditionMultiplier) + interventionBonus)
  const perVisit = Math.round(totalAmount / 10) // Assume 10 visits average
  
  return {
    amount: totalAmount,
    currency: 'USD',
    type: 'total_compensation',
    per_visit: perVisit,
    visits_estimated: 10,
    additional_benefits: [
      'travel_reimbursement',
      'parking_validation',
      'meal_vouchers',
      'health_screenings'
    ],
    description: `Participants receive $${perVisit} per visit for approximately 10 visits. Total compensation up to $${totalAmount}.`
  }
}

// Determine urgency level based on condition
function determineUrgency(condition: string): string {
  const criticalConditions = ['cancer', 'alzheimer']
  const highConditions = ['heart disease', 'covid-19']
  
  if (criticalConditions.includes(condition.toLowerCase())) {
    return 'critical'
  } else if (highConditions.includes(condition.toLowerCase())) {
    return 'high'
  }
  return 'standard'
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ClinicalTrials.gov API endpoint
    const conditions = [
      // Current conditions
      'diabetes', 'cancer', 'heart disease', 'alzheimer', 'covid-19', 'hypertension',
      // Common conditions (high volume)
      'asthma', 'depression', 'anxiety', 'obesity', 'arthritis', 'copd',
      'stroke', 'epilepsy', 'migraine', 'parkinsons disease',
      // High-value conditions (good compensation)
      'multiple sclerosis', 'crohns disease', 'psoriasis', 'lupus',
      'rheumatoid arthritis', 'fibromyalgia', 'hepatitis c',
      // Rare diseases (urgent need)
      'cystic fibrosis', 'sickle cell disease', 'huntingtons disease'
    ]
    const baseUrl = 'https://clinicaltrials.gov/api/v2/studies'
    
    console.log('Starting clinical trials scraping...')
    
    for (const condition of conditions) {
      console.log(`Fetching trials for condition: ${condition}`)
      let pageToken = null
      let totalFetched = 0
      
      do {
        const params = new URLSearchParams({
          'query.cond': condition,
          'filter.overallStatus': 'RECRUITING',
          'pageSize': '50', // Increased page size
          'format': 'json'
        })
        
        if (pageToken) {
          params.append('pageToken', pageToken)
        }

        const response = await fetch(`${baseUrl}?${params}`)
        const data = await response.json()
        
        if (data.studies) {
          totalFetched += data.studies.length
        for (const study of data.studies) {
          const trialData = {
            trial_id: study.protocolSection?.identificationModule?.nctId || '',
            title: study.protocolSection?.identificationModule?.briefTitle || '',
            description: study.protocolSection?.descriptionModule?.briefSummary || '',
            conditions: study.protocolSection?.conditionsModule?.conditions || [],
            interventions: study.protocolSection?.armsInterventionsModule?.interventions?.map(
              (i: any) => i.name
            ) || [],
            sponsor: study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name || '',
            status: 'recruiting',
            phase: study.protocolSection?.designModule?.phases?.[0] || '',
            start_date: study.protocolSection?.statusModule?.startDateStruct?.date || null,
            completion_date: study.protocolSection?.statusModule?.completionDateStruct?.date || null,
            eligibility_criteria: {
              criteria: study.protocolSection?.eligibilityModule?.eligibilityCriteria || '',
              minAge: study.protocolSection?.eligibilityModule?.minimumAge || null,
              maxAge: study.protocolSection?.eligibilityModule?.maximumAge || null,
              gender: study.protocolSection?.eligibilityModule?.sex || 'ALL'
            },
            locations: study.protocolSection?.contactsLocationsModule?.locations?.map((loc: any) => ({
              facility: loc.facility,
              city: loc.city,
              state: loc.state,
              country: loc.country,
              status: loc.status
            })) || [],
            contact_info: {
              centralContact: study.protocolSection?.contactsLocationsModule?.centralContacts?.[0] || null,
              overallOfficial: study.protocolSection?.contactsLocationsModule?.overallOfficials?.[0] || null
            },
            compensation: generateCompensation(
              study.protocolSection?.designModule?.phases?.[0] || '',
              condition,
              study.protocolSection?.armsInterventionsModule?.interventions?.length || 0
            ),
            urgency_level: determineUrgency(condition),
            source: 'clinicaltrials.gov'
          }

          // Upsert trial data
          const { error } = await supabase
            .from('clinical_trials')
            .upsert(trialData, { 
              onConflict: 'trial_id',
              ignoreDuplicates: false 
            })

          if (error) {
            console.error('Error inserting trial:', error)
          }
        }
        }
        
        pageToken = data.nextPageToken
      } while (pageToken && totalFetched < 200) // Limit per condition to avoid timeouts
      
      console.log(`Fetched ${totalFetched} trials for ${condition}`)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Trials scraped successfully',
        conditionsProcessed: conditions.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Scraping error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})