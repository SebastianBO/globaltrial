import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This function runs every minute to process jobs
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

    const workerId = `edge-worker-${crypto.randomUUID().slice(0, 8)}`
    const startTime = Date.now()
    const maxRuntime = 50000 // 50 seconds to be safe
    let jobsProcessed = 0

    // Process jobs until timeout approaches
    while (Date.now() - startTime < maxRuntime) {
      // Acquire next job
      const { data: jobs } = await supabaseClient.rpc('acquire_next_job', {
        p_queue_name: 'default',
        p_worker_id: workerId
      })

      if (!jobs || jobs.length === 0) {
        // No jobs available, check other queues
        const queues = ['scraping', 'enrichment']
        let foundJob = false
        
        for (const queue of queues) {
          const { data: queueJobs } = await supabaseClient.rpc('acquire_next_job', {
            p_queue_name: queue,
            p_worker_id: workerId
          })
          
          if (queueJobs && queueJobs.length > 0) {
            await processJob(supabaseClient, queueJobs[0], workerId)
            jobsProcessed++
            foundJob = true
            break
          }
        }
        
        if (!foundJob) {
          // No jobs in any queue, wait a bit
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      } else {
        // Process the job
        await processJob(supabaseClient, jobs[0], workerId)
        jobsProcessed++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      workerId,
      jobsProcessed,
      runtime: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Worker error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function processJob(supabase: any, job: any, workerId: string) {
  console.log(`Processing job ${job.job_id} of type ${job.job_type}`)
  
  try {
    let result: any
    
    switch (job.job_type) {
      case 'scrape_condition':
        result = await scrapeByCondition(supabase, job.payload)
        break
        
      case 'enrich_trial':
        result = await enrichTrial(supabase, job.payload)
        break
        
      case 'geocode_locations':
        result = await geocodeLocations(supabase, job.payload)
        break
        
      case 'check_duplicates':
        result = await checkDuplicates(supabase, job.payload)
        break
        
      default:
        throw new Error(`Unknown job type: ${job.job_type}`)
    }
    
    // Mark job as completed
    await supabase
      .from('job_queue')
      .update({
        status: 'completed',
        completed_at: new Date(),
        result
      })
      .eq('id', job.job_id)
      
  } catch (error) {
    console.error(`Job ${job.job_id} failed:`, error)
    
    // Mark job as failed
    await supabase
      .from('job_queue')
      .update({
        status: job.attempts < job.max_attempts ? 'pending' : 'failed',
        last_error: error.message,
        locked_at: null,
        locked_by: null,
        scheduled_for: job.attempts < job.max_attempts 
          ? new Date(Date.now() + 60000 * job.attempts) 
          : null
      })
      .eq('id', job.job_id)
  }
}

async function scrapeByCondition(supabase: any, payload: any) {
  const { condition } = payload
  const CLINICALTRIALS_API = 'https://clinicaltrials.gov/api/v2/studies'
  
  const params = new URLSearchParams({
    format: 'json',
    pageSize: '50',
    'query.cond': condition
  })
  
  const response = await fetch(`${CLINICALTRIALS_API}?${params}`)
  const data = await response.json()
  
  let processed = 0
  
  for (const study of data.studies || []) {
    const trial = transformTrial(study)
    
    await supabase
      .from('clinical_trials')
      .upsert(trial, { onConflict: 'nct_id' })
    
    processed++
  }
  
  return { condition, processed, total: data.totalCount }
}

async function enrichTrial(supabase: any, payload: any) {
  const { trial_id } = payload
  
  // Get trial data
  const { data: trial } = await supabase
    .from('clinical_trials')
    .select('*')
    .eq('id', trial_id)
    .single()
  
  if (!trial) {
    throw new Error('Trial not found')
  }
  
  // Generate enriched data
  const enrichments = {
    layman_description: generateSimpleDescription(trial),
    urgency_level: calculateUrgency(trial),
    data_quality_score: calculateQualityScore(trial)
  }
  
  // Update trial
  await supabase
    .from('clinical_trials')
    .update(enrichments)
    .eq('id', trial_id)
  
  return { trial_id, enrichments }
}

async function geocodeLocations(supabase: any, payload: any) {
  const { trial_id } = payload
  
  // Get trial locations
  const { data: trial } = await supabase
    .from('clinical_trials')
    .select('locations')
    .eq('id', trial_id)
    .single()
  
  if (!trial || !trial.locations) {
    return { trial_id, geocoded: 0 }
  }
  
  const geocodedLocations = []
  
  for (const location of trial.locations) {
    // In production, this would call a geocoding API
    // For now, we'll add mock coordinates
    geocodedLocations.push({
      ...location,
      coordinates: {
        lat: 40.7128 + Math.random() * 10 - 5,
        lng: -74.0060 + Math.random() * 10 - 5
      }
    })
  }
  
  await supabase
    .from('clinical_trials')
    .update({ locations_geocoded: geocodedLocations })
    .eq('id', trial_id)
  
  return { trial_id, geocoded: geocodedLocations.length }
}

async function checkDuplicates(supabase: any, payload: any) {
  const { trial_id } = payload
  
  // Get trial
  const { data: trial } = await supabase
    .from('clinical_trials')
    .select('*')
    .eq('id', trial_id)
    .single()
  
  if (!trial) return { trial_id, duplicates: [] }
  
  // Find similar trials
  const { data: similar } = await supabase.rpc('find_similar_trials', {
    p_title: trial.title,
    p_threshold: 0.8,
    p_exclude_id: trial_id,
    p_limit: 10
  })
  
  const duplicates = []
  
  for (const match of similar || []) {
    if (match.similarity > 0.85) {
      duplicates.push({
        duplicate_id: match.id,
        similarity: match.similarity,
        title: match.title
      })
    }
  }
  
  // Mark as checked
  await supabase
    .from('clinical_trials')
    .update({ duplicate_check_date: new Date() })
    .eq('id', trial_id)
  
  return { trial_id, duplicates }
}

function transformTrial(study: any): any {
  const protocol = study.protocolSection || {}
  const identification = protocol.identificationModule || {}
  const status = protocol.statusModule || {}
  const description = protocol.descriptionModule || {}
  const conditions = protocol.conditionsModule || {}
  const sponsor = protocol.sponsorCollaboratorsModule || {}
  const design = protocol.designModule || {}
  
  return {
    nct_id: identification.nctId,
    title: identification.officialTitle || identification.briefTitle,
    status: status.overallStatus,
    phase: design.phases?.join(', '),
    sponsor: sponsor.leadSponsor?.name,
    description: description.briefSummary,
    conditions: conditions.conditions || [],
    enrollment_target: design.enrollmentInfo?.count,
    last_updated: new Date(),
    source: 'clinicaltrials.gov',
    url: `https://clinicaltrials.gov/study/${identification.nctId}`,
    is_active: ['Recruiting', 'Enrolling by invitation'].includes(status.overallStatus)
  }
}

function generateSimpleDescription(trial: any): string {
  const conditions = trial.conditions?.join(', ') || 'certain conditions'
  const status = trial.status === 'Recruiting' ? 'currently recruiting participants' : 'ongoing'
  
  return `This clinical trial is ${status} to study treatments for ${conditions}. ${trial.description?.slice(0, 150) || ''}`
}

function calculateUrgency(trial: any): string {
  if (trial.status === 'Recruiting' && trial.enrollment_target < 50) {
    return 'high'
  }
  if (trial.status === 'Not yet recruiting') {
    return 'medium'
  }
  return 'low'
}

function calculateQualityScore(trial: any): number {
  let score = 0
  const fields = [
    trial.title,
    trial.description,
    trial.eligibility_criteria,
    trial.locations?.length > 0,
    trial.sponsor
  ]
  
  fields.forEach(field => {
    if (field) score += 0.2
  })
  
  return Math.min(score, 1)
}