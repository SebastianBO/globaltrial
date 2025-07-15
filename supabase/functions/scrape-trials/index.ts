import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    // ClinicalTrials.gov API endpoint
    const conditions = ['diabetes', 'cancer', 'heart disease', 'alzheimer'] // Example conditions
    const baseUrl = 'https://clinicaltrials.gov/api/v2/studies'
    
    for (const condition of conditions) {
      const params = new URLSearchParams({
        'query.cond': condition,
        'filter.overallStatus': 'RECRUITING',
        'pageSize': '20',
        'format': 'json'
      })

      const response = await fetch(`${baseUrl}?${params}`)
      const data = await response.json()

      if (data.studies) {
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
    }

    return new Response(
      JSON.stringify({ message: 'Trials scraped successfully' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})