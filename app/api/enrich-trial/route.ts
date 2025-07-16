import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichTrialWithLaymanTerms } from '@/lib/mesh-translator'

export async function POST(request: NextRequest) {
  try {
    const { trialId } = await request.json()
    const supabase = await createClient()
    
    // Fetch trial
    const { data: trial, error } = await supabase
      .from('clinical_trials')
      .select('*')
      .eq('id', trialId)
      .single()
    
    if (error || !trial) {
      return NextResponse.json({ error: 'Trial not found' }, { status: 404 })
    }
    
    // Enrich with layman terms
    const enriched = await enrichTrialWithLaymanTerms(trial)
    
    // Update trial with layman description
    const { error: updateError } = await supabase
      .from('clinical_trials')
      .update({
        layman_description: enriched.laymanDescription,
        mesh_terms: enriched.meshTerms,
        last_updated: new Date().toISOString()
      })
      .eq('id', trialId)
    
    if (updateError) {
      console.error('Error updating trial:', updateError)
    }
    
    return NextResponse.json({
      success: true,
      enrichedTrial: enriched
    })
  } catch (error) {
    console.error('Enrich trial error:', error)
    return NextResponse.json(
      { error: 'Failed to enrich trial' },
      { status: 500 }
    )
  }
}

// Batch enrich endpoint
export async function PUT() {
  try {
    const supabase = await createClient()
    
    // Get trials without layman descriptions
    const { data: trials, error } = await supabase
      .from('clinical_trials')
      .select('*')
      .is('layman_description', null)
      .limit(10) // Process 10 at a time
    
    if (error || !trials || trials.length === 0) {
      return NextResponse.json({ 
        message: 'No trials to process',
        processed: 0 
      })
    }
    
    let processed = 0
    
    for (const trial of trials) {
      try {
        const enriched = await enrichTrialWithLaymanTerms(trial)
        
        await supabase
          .from('clinical_trials')
          .update({
            layman_description: enriched.laymanDescription,
            mesh_terms: enriched.meshTerms,
            last_updated: new Date().toISOString()
          })
          .eq('id', trial.id)
        
        processed++
      } catch (error) {
        console.error(`Error processing trial ${trial.id}:`, error)
      }
    }
    
    return NextResponse.json({
      success: true,
      processed,
      remaining: trials.length - processed
    })
  } catch (error) {
    console.error('Batch enrich error:', error)
    return NextResponse.json(
      { error: 'Failed to batch enrich trials' },
      { status: 500 }
    )
  }
}