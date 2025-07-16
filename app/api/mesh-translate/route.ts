import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enrichTrialWithLaymanTerms, searchMeSHTerm } from '@/lib/mesh-translator';

export async function POST(request: NextRequest) {
  try {
    const { trial_id, conditions, action } = await request.json();
    
    if (action === 'translate_trial') {
      // Translate MeSH terms for a specific trial
      if (!trial_id) {
        return NextResponse.json({ error: 'trial_id is required' }, { status: 400 });
      }
      
      const supabase = await createClient();
      
      // Fetch trial data
      const { data: trial, error } = await supabase
        .from('clinical_trials')
        .select('*')
        .eq('id', trial_id)
        .single();
        
      if (error || !trial) {
        return NextResponse.json({ error: 'Trial not found' }, { status: 404 });
      }
      
      // Enrich with layman terms
      const enrichedTrial = await enrichTrialWithLaymanTerms(trial);
      
      // Update the trial with layman description
      if (enrichedTrial.laymanDescription) {
        await supabase
          .from('clinical_trials')
          .update({ 
            layman_description: enrichedTrial.laymanDescription,
            mesh_terms: enrichedTrial.meshTerms.map(term => ({
              meshId: term.meshId,
              preferredTerm: term.preferredTerm,
              laymanTerms: term.laymanTerms
            }))
          })
          .eq('id', trial_id);
      }
      
      return NextResponse.json({
        success: true,
        trial_id,
        conditions: enrichedTrial.conditions,
        mesh_terms: enrichedTrial.meshTerms,
        layman_description: enrichedTrial.laymanDescription
      });
      
    } else if (action === 'translate_conditions') {
      // Translate a list of conditions
      if (!conditions || !Array.isArray(conditions)) {
        return NextResponse.json({ error: 'conditions array is required' }, { status: 400 });
      }
      
      const supabase = await createClient();
      const translations = [];
      
      for (const condition of conditions) {
        // First check cache
        const { data: cached } = await supabase
          .from('mesh_cache')
          .select('*')
          .eq('condition_name', condition)
          .single();
          
        if (cached) {
          translations.push({
            condition,
            mesh_id: cached.mesh_id,
            preferred_term: cached.preferred_term,
            scope_note: cached.scope_note,
            layman_terms: cached.layman_terms,
            layman_explanation: simplifyConditionExplanation(cached.scope_note || condition)
          });
        } else {
          // Fetch from NCBI
          const meshTerm = await searchMeSHTerm(condition);
          if (meshTerm) {
            translations.push({
              condition,
              mesh_id: meshTerm.meshId,
              preferred_term: meshTerm.preferredTerm,
              scope_note: meshTerm.scopeNote,
              layman_terms: meshTerm.laymanTerms,
              layman_explanation: simplifyConditionExplanation(meshTerm.scopeNote || condition)
            });
            
            // Cache it
            await supabase
              .from('mesh_cache')
              .upsert({
                condition_name: condition,
                mesh_id: meshTerm.meshId,
                preferred_term: meshTerm.preferredTerm,
                scope_note: meshTerm.scopeNote,
                layman_terms: meshTerm.laymanTerms,
                tree_numbers: meshTerm.treeNumbers
              });
          } else {
            // No MeSH term found, provide basic translation
            translations.push({
              condition,
              mesh_id: null,
              preferred_term: condition,
              scope_note: null,
              layman_terms: [],
              layman_explanation: `A medical condition called ${condition}`
            });
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        translations
      });
      
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('MeSH translation error:', error);
    return NextResponse.json(
      { error: 'Failed to translate MeSH terms', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function simplifyConditionExplanation(text: string): string {
  // Common medical term replacements
  const replacements: Record<string, string> = {
    'characterized by': 'known for',
    'etiology': 'cause',
    'pathogenesis': 'how it develops',
    'manifestation': 'symptom',
    'idiopathic': 'unknown cause',
    'congenital': 'present from birth',
    'acquired': 'developed later in life',
    'progressive': 'gets worse over time',
    'chronic': 'long-lasting',
    'acute': 'sudden and severe',
    'benign': 'not harmful/not cancer',
    'malignant': 'cancerous',
    'bilateral': 'affecting both sides',
    'unilateral': 'affecting one side',
    'systemic': 'affecting the whole body',
    'localized': 'in one specific area',
    'inflammation': 'swelling and irritation',
    'neoplasm': 'abnormal growth or tumor',
    'lesion': 'area of damage',
    'syndrome': 'group of symptoms',
    'disorder': 'condition'
  };
  
  let simplified = text.toLowerCase();
  
  // Replace medical terms
  for (const [medical, simple] of Object.entries(replacements)) {
    simplified = simplified.replace(new RegExp(`\\b${medical}\\b`, 'gi'), simple);
  }
  
  // Remove overly technical phrases
  simplified = simplified.replace(/\([^)]*\)/g, ''); // Remove parenthetical content
  simplified = simplified.replace(/\b[A-Z]{2,}\b/g, ''); // Remove acronyms
  
  // Make it more conversational
  if (!simplified.includes('is a') && !simplified.includes('are')) {
    simplified = 'This is ' + simplified;
  }
  
  // Capitalize first letter and ensure it ends with a period
  simplified = simplified.charAt(0).toUpperCase() + simplified.slice(1);
  if (!simplified.endsWith('.')) {
    simplified += '.';
  }
  
  return simplified;
}