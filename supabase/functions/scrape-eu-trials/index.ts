import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EUTrial {
  eudract_number: string;
  sponsor_protocol_number?: string;
  title: string;
  sponsor_name: string;
  disease: string;
  therapeutic_area: string;
  status: string;
  phase?: string;
  countries: string[];
  start_date?: string;
  completion_date?: string;
  results_available?: boolean;
}

// Map EU trial status to our schema
function mapEUStatus(euStatus: string): string {
  const statusMap: Record<string, string> = {
    'Ongoing': 'Active, not recruiting',
    'Recruiting': 'Recruiting',
    'Completed': 'Completed',
    'Terminated': 'Terminated',
    'Suspended': 'Suspended',
    'Not yet recruiting': 'Not yet recruiting',
    'Prematurely Ended': 'Terminated',
  };
  return statusMap[euStatus] || euStatus;
}

// Parse EU trial phase
function parsePhase(phaseText: string): string | null {
  if (!phaseText) return null;
  
  const phaseMap: Record<string, string> = {
    'I': 'Phase 1',
    'II': 'Phase 2',
    'III': 'Phase 3',
    'IV': 'Phase 4',
    '1': 'Phase 1',
    '2': 'Phase 2',
    '3': 'Phase 3',
    '4': 'Phase 4',
  };
  
  // Extract phase number from text
  const match = phaseText.match(/Phase\s*([IV]+|\d)/i);
  if (match) {
    return phaseMap[match[1]] || `Phase ${match[1]}`;
  }
  
  return null;
}

async function fetchEUTrials(searchParams: URLSearchParams): Promise<EUTrial[]> {
  try {
    // EU Clinical Trials Register search endpoint
    const baseUrl = 'https://www.clinicaltrialsregister.eu/ctr-search/rest/search';
    const url = `${baseUrl}?${searchParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GlobalTrial-Scraper/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`EU CTR API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching EU trials:', error);
    // Fallback to web scraping if API fails
    return await scrapeEUTrialsWebsite(searchParams);
  }
}

// Fallback web scraping method
async function scrapeEUTrialsWebsite(searchParams: URLSearchParams): Promise<EUTrial[]> {
  const trials: EUTrial[] = [];
  
  try {
    // Use the public search page
    const searchUrl = `https://www.clinicaltrialsregister.eu/ctr-search/search?${searchParams.toString()}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch EU CTR page: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse trials from HTML using regex (simplified example)
    // In production, consider using a proper HTML parser
    const trialMatches = html.matchAll(
      /<tr class="result">.*?<a href="\/ctr-search\/trial\/([\d-]+\/[\d-]+)".*?>(.*?)<\/a>.*?<td.*?>(.*?)<\/td>.*?<td.*?>(.*?)<\/td>.*?<td.*?>(.*?)<\/td>/gs
    );
    
    for (const match of trialMatches) {
      const [_, eudractNumber, title, sponsor, status, countries] = match;
      
      trials.push({
        eudract_number: eudractNumber.trim(),
        title: title.trim(),
        sponsor_name: sponsor.trim(),
        disease: '', // Would need to fetch detail page
        therapeutic_area: '',
        status: status.trim(),
        countries: countries.split(',').map(c => c.trim()),
      });
    }
  } catch (error) {
    console.error('Error scraping EU trials:', error);
  }
  
  return trials;
}

async function transformToGlobalTrialFormat(euTrial: EUTrial): Promise<any> {
  // Transform EU trial data to match our schema
  return {
    trial_id: `EU-${euTrial.eudract_number}`,
    title: euTrial.title,
    description: `${euTrial.disease} - ${euTrial.therapeutic_area}`.trim(),
    conditions: [euTrial.disease, euTrial.therapeutic_area].filter(Boolean),
    interventions: [], // Would need to fetch from detail page
    sponsor: euTrial.sponsor_name,
    status: mapEUStatus(euTrial.status),
    phase: euTrial.phase ? parsePhase(euTrial.phase) : null,
    start_date: euTrial.start_date,
    completion_date: euTrial.completion_date,
    eligibility_criteria: {
      inclusion_criteria: [],
      exclusion_criteria: [],
    },
    locations: euTrial.countries.map(country => ({
      country,
      status: 'Recruiting',
    })),
    contact_info: {},
    source: 'EU-CTR',
    last_updated: new Date().toISOString(),
    url: `https://www.clinicaltrialsregister.eu/ctr-search/trial/${euTrial.eudract_number}`,
    nct_id: null,
    registry_last_updated: new Date().toISOString(),
    is_active: euTrial.status === 'Recruiting' || euTrial.status === 'Ongoing',
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request parameters
    const url = new URL(req.url);
    const conditions = url.searchParams.get('conditions')?.split(',') || [
      'cancer',
      'diabetes',
      'heart disease',
      'alzheimer',
      'covid-19',
      'depression',
      'arthritis',
      'asthma',
      'hypertension',
      'parkinson',
    ];
    
    const maxTrialsPerCondition = parseInt(url.searchParams.get('maxPerCondition') || '50');
    
    console.log(`Starting EU trials scrape for ${conditions.length} conditions`);
    
    let totalTrials = 0;
    const errors: string[] = [];
    
    for (const condition of conditions) {
      try {
        console.log(`Fetching EU trials for: ${condition}`);
        
        // Build search parameters
        const searchParams = new URLSearchParams({
          query: condition,
          status: 'ongoing,recruiting',
          page: '1',
          perPage: maxTrialsPerCondition.toString(),
        });
        
        const euTrials = await fetchEUTrials(searchParams);
        console.log(`Found ${euTrials.length} EU trials for ${condition}`);
        
        // Transform and insert trials
        for (const euTrial of euTrials) {
          try {
            const transformedTrial = await transformToGlobalTrialFormat(euTrial);
            
            // Check if trial already exists
            const { data: existing } = await supabase
              .from('clinical_trials')
              .select('id')
              .eq('trial_id', transformedTrial.trial_id)
              .single();
            
            if (existing) {
              // Update existing trial
              const { error: updateError } = await supabase
                .from('clinical_trials')
                .update({
                  ...transformedTrial,
                  updated_at: new Date().toISOString(),
                })
                .eq('trial_id', transformedTrial.trial_id);
              
              if (updateError) {
                console.error(`Error updating trial ${transformedTrial.trial_id}:`, updateError);
              }
            } else {
              // Insert new trial
              const { error: insertError } = await supabase
                .from('clinical_trials')
                .insert(transformedTrial);
              
              if (insertError) {
                console.error(`Error inserting trial ${transformedTrial.trial_id}:`, insertError);
              } else {
                totalTrials++;
              }
            }
          } catch (error) {
            console.error(`Error processing EU trial ${euTrial.eudract_number}:`, error);
          }
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        const errorMsg = `Error fetching EU trials for ${condition}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    // Log summary
    console.log(`EU trials scrape completed. Total new trials: ${totalTrials}`);
    if (errors.length > 0) {
      console.log('Errors encountered:', errors);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        totalTrials,
        conditions: conditions.length,
        errors,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('EU trials scraper error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})