import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // This function runs automatically every hour via cron
    const { action } = await req.json()

    switch (action || 'scrape') {
      case 'scrape':
        return await handleIncrementalScrape(supabaseClient)
      case 'full_scrape':
        return await handleFullScrape(supabaseClient)
      case 'deduplicate':
        return await handleDeduplication(supabaseClient)
      case 'enrich':
        return await handleEnrichment(supabaseClient)
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

async function handleIncrementalScrape(supabase: any) {
  console.log('Starting incremental scrape...')
  
  // Get last scrape timestamp
  const { data: lastRun } = await supabase
    .from('scraping_jobs')
    .select('completed_at')
    .eq('job_type', 'incremental')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  const sinceDate = lastRun?.completed_at || new Date(Date.now() - 86400000).toISOString()
  
  // Create scraping job
  const { data: job } = await supabase
    .from('scraping_jobs')
    .insert({
      job_type: 'incremental',
      registry: 'clinicaltrials.gov',
      status: 'running',
      started_at: new Date(),
      progress: { since_date: sinceDate }
    })
    .select()
    .single()

  // Queue the job
  await supabase
    .from('job_queue')
    .insert({
      job_type: 'scrape_incremental',
      payload: { since_date: sinceDate, job_id: job.id },
      priority: 7,
      queue_name: 'scraping'
    })

  // Process immediately in edge function (up to 5 minutes)
  const startTime = Date.now()
  const maxRuntime = 270000 // 4.5 minutes to leave buffer
  
  try {
    const results = await scrapeRecentTrials(supabase, sinceDate, maxRuntime, job.id)
    
    await supabase
      .from('scraping_jobs')
      .update({
        status: 'completed',
        completed_at: new Date(),
        processed_items: results.processed,
        progress: { ...job.progress, results }
      })
      .eq('id', job.id)

    return new Response(JSON.stringify({
      success: true,
      processed: results.processed,
      runtime: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    await supabase
      .from('scraping_jobs')
      .update({
        status: 'failed',
        error_log: [{ timestamp: new Date(), error: error.message }]
      })
      .eq('id', job.id)

    throw error
  }
}

async function scrapeRecentTrials(supabase: any, sinceDate: string, maxRuntime: number, jobId: string) {
  const CLINICALTRIALS_API = 'https://clinicaltrials.gov/api/v2/studies'
  const startTime = Date.now()
  let processed = 0
  let nextPageToken = null

  do {
    // Check if we're approaching timeout
    if (Date.now() - startTime > maxRuntime) {
      console.log('Approaching timeout, saving checkpoint...')
      await supabase
        .from('scraping_checkpoints')
        .insert({
          job_id: jobId,
          checkpoint_type: 'page_token',
          checkpoint_data: { nextPageToken, processed },
          items_processed: processed
        })
      break
    }

    // Build query
    const params = new URLSearchParams({
      format: 'json',
      pageSize: '100',
      'filter.advanced': `AREA[LastUpdatePostDate]RANGE[${sinceDate.split('T')[0]},MAX]`
    })
    
    if (nextPageToken) {
      params.append('pageToken', nextPageToken)
    }

    const response = await fetch(`${CLINICALTRIALS_API}?${params}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    // Process trials
    for (const study of data.studies || []) {
      const trial = transformTrial(study)
      
      await supabase
        .from('clinical_trials')
        .upsert(trial, { onConflict: 'nct_id' })
      
      processed++
    }

    nextPageToken = data.nextPageToken

    // Update progress
    if (processed % 50 === 0) {
      await supabase
        .from('scraping_jobs')
        .update({
          processed_items: processed,
          last_heartbeat: new Date()
        })
        .eq('id', jobId)
    }

  } while (nextPageToken)

  return { processed, completed: !nextPageToken }
}

function transformTrial(study: any): any {
  const protocol = study.protocolSection || {}
  const identification = protocol.identificationModule || {}
  const status = protocol.statusModule || {}
  const description = protocol.descriptionModule || {}
  const conditions = protocol.conditionsModule || {}
  const sponsor = protocol.sponsorCollaboratorsModule || {}
  
  return {
    nct_id: identification.nctId,
    title: identification.officialTitle || identification.briefTitle,
    status: status.overallStatus,
    sponsor: sponsor.leadSponsor?.name,
    description: description.briefSummary,
    conditions: conditions.conditions || [],
    last_updated: new Date(),
    registry_last_updated: new Date(status.lastUpdatePostDateStruct?.date || new Date()),
    source: 'clinicaltrials.gov',
    url: `https://clinicaltrials.gov/study/${identification.nctId}`,
    is_active: ['Recruiting', 'Enrolling by invitation', 'Active, not recruiting'].includes(status.overallStatus)
  }
}

async function handleFullScrape(supabase: any) {
  // For full scrape, we just queue the job and let workers handle it
  const { data: job } = await supabase
    .from('scraping_jobs')
    .insert({
      job_type: 'full_scrape',
      registry: 'clinicaltrials.gov',
      status: 'pending',
      priority: 10
    })
    .select()
    .single()

  await supabase
    .from('job_queue')
    .insert({
      job_type: 'scrape_full',
      payload: { job_id: job.id },
      priority: 10,
      queue_name: 'scraping'
    })

  return new Response(JSON.stringify({
    success: true,
    message: 'Full scrape job queued',
    job_id: job.id
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleDeduplication(supabase: any) {
  console.log('Running deduplication...')
  
  const startTime = Date.now()
  const maxRuntime = 270000
  let duplicatesFound = 0

  // Get trials to check
  const { data: trials } = await supabase
    .from('clinical_trials')
    .select('id, nct_id, title, sponsor, start_date')
    .is('duplicate_check_date', null)
    .limit(100)

  for (const trial of trials || []) {
    if (Date.now() - startTime > maxRuntime) break

    // Find potential duplicates by title similarity
    const { data: similar } = await supabase.rpc('find_similar_trials', {
      p_title: trial.title,
      p_threshold: 0.85,
      p_exclude_id: trial.id,
      p_limit: 5
    })

    for (const match of similar || []) {
      // Check if already marked as duplicate
      const { data: existing } = await supabase
        .from('trial_duplicates')
        .select('id')
        .or(`primary_trial_id.eq.${trial.id},duplicate_trial_id.eq.${trial.id}`)
        .or(`primary_trial_id.eq.${match.id},duplicate_trial_id.eq.${match.id}`)
        .single()

      if (!existing) {
        await supabase
          .from('trial_duplicates')
          .insert({
            primary_trial_id: trial.id,
            duplicate_trial_id: match.id,
            similarity_score: match.similarity,
            match_type: match.similarity > 0.95 ? 'exact' : 'fuzzy',
            match_reasons: { title_similarity: match.similarity }
          })
        
        duplicatesFound++
      }
    }

    // Mark as checked
    await supabase
      .from('clinical_trials')
      .update({ duplicate_check_date: new Date() })
      .eq('id', trial.id)
  }

  return new Response(JSON.stringify({
    success: true,
    duplicates_found: duplicatesFound,
    trials_checked: trials?.length || 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleEnrichment(supabase: any) {
  console.log('Enriching trials...')
  
  // Get trials needing enrichment
  const { data: trials } = await supabase
    .from('clinical_trials')
    .select('id, title, description, conditions')
    .is('layman_description', null)
    .limit(10) // Process 10 at a time in edge function

  let enriched = 0

  for (const trial of trials || []) {
    try {
      // Generate simple description using Groq
      const laymanDescription = await generateLaymanDescription(trial)
      
      await supabase
        .from('clinical_trials')
        .update({ 
          layman_description: laymanDescription,
          enriched_at: new Date()
        })
        .eq('id', trial.id)
      
      enriched++
    } catch (error) {
      console.error(`Failed to enrich trial ${trial.id}:`, error)
    }
  }

  return new Response(JSON.stringify({
    success: true,
    enriched,
    remaining: trials?.length === 10 ? 'more' : 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function generateLaymanDescription(trial: any): Promise<string> {
  // For now, create a simple description
  // In production, this would call Groq API
  const conditions = trial.conditions?.join(', ') || 'various conditions'
  return `This clinical trial is studying treatments for ${conditions}. The purpose is to ${trial.description?.slice(0, 200) || 'evaluate new treatment options'}.`
}