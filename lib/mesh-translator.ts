// MeSH Term Translator - Extracts medical terms and provides patient-friendly explanations
import { createClient } from '@/lib/supabase/server'

interface MeSHTerm {
  meshId: string
  preferredTerm: string
  scopeNote?: string // Definition from MeSH
  laymanTerms: string[]
  treeNumbers?: string[]
}

interface ClinicalTrialWithLaymanTerms {
  trialId: string
  conditions: string[]
  meshTerms: MeSHTerm[]
  laymanDescription: string
}

// NCBI E-utilities API configuration
const NCBI_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const NCBI_API_KEY = process.env.NCBI_API_KEY || '' // Optional but recommended for higher rate limits

/**
 * Extract MeSH terms from clinical trial conditions
 * ClinicalTrials.gov often provides MeSH terms in their API responses
 */
export async function extractMeSHTermsFromTrial(trial: any): Promise<string[]> {
  const meshTerms: string[] = []
  
  // Check if trial has MeSH terms in metadata
  if (trial.protocolSection?.conditionsModule?.keywords) {
    meshTerms.push(...trial.protocolSection.conditionsModule.keywords)
  }
  
  // Also check conditions - many are already MeSH terms
  if (trial.conditions) {
    meshTerms.push(...trial.conditions)
  }
  
  return [...new Set(meshTerms)] // Remove duplicates
}

/**
 * Search for MeSH term details using NCBI E-utilities
 */
export async function searchMeSHTerm(term: string): Promise<MeSHTerm | null> {
  try {
    // Step 1: Search for the term in MeSH database with exact match
    const searchUrl = new URL(`${NCBI_BASE_URL}/esearch.fcgi`)
    searchUrl.searchParams.append('db', 'mesh')
    searchUrl.searchParams.append('term', `"${term}"[MeSH Terms]`)
    searchUrl.searchParams.append('retmode', 'json')
    if (NCBI_API_KEY) searchUrl.searchParams.append('api_key', NCBI_API_KEY)
    
    const searchResponse = await fetch(searchUrl.toString())
    const searchData = await searchResponse.json()
    
    if (!searchData.esearchresult?.idlist?.length) {
      return null
    }
    
    // Step 2: Get detailed information for the MeSH term
    const meshId = searchData.esearchresult.idlist[0]
    const summaryUrl = new URL(`${NCBI_BASE_URL}/esummary.fcgi`)
    summaryUrl.searchParams.append('db', 'mesh')
    summaryUrl.searchParams.append('id', meshId)
    summaryUrl.searchParams.append('retmode', 'json')
    if (NCBI_API_KEY) summaryUrl.searchParams.append('api_key', NCBI_API_KEY)
    
    const summaryResponse = await fetch(summaryUrl.toString())
    const summaryData = await summaryResponse.json()
    
    const meshData = summaryData.result?.[meshId]
    if (!meshData) return null
    
    // Extract layman-friendly terms and scope note
    const laymanTerms = extractLaymanTerms(meshData)
    
    return {
      meshId: meshData.uid,
      preferredTerm: meshData.ds_meshterms?.[0] || term,
      scopeNote: meshData.ds_scopenote,
      laymanTerms,
      treeNumbers: meshData.ds_idxlinks?.map((link: any) => link.treenumber)
    }
  } catch (error) {
    console.error('Error fetching MeSH term:', error)
    return null
  }
}

/**
 * Extract layman-friendly terms from MeSH data
 */
function extractLaymanTerms(meshData: any): string[] {
  const terms: string[] = []
  
  // Add entry terms (synonyms)
  if (meshData.ds_meshsynonyms) {
    terms.push(...meshData.ds_meshsynonyms)
  }
  
  // Add any common language variants
  if (meshData.ds_entrylanguage) {
    terms.push(...meshData.ds_entrylanguage)
  }
  
  return terms.filter(term => 
    // Filter for more common/simple terms
    !term.includes(',') && // Avoid complex medical phrases
    term.length < 30 && // Shorter terms are usually simpler
    !term.match(/\b(syndrome|disease|disorder)\b/i) // Unless it's the primary way to refer to it
  )
}

/**
 * Generate patient-friendly description for a clinical trial
 */
export async function generateLaymanDescription(
  conditions: string[],
  meshTerms: MeSHTerm[]
): Promise<string> {
  const descriptions: string[] = []
  
  for (const meshTerm of meshTerms) {
    if (meshTerm.scopeNote) {
      // Clean up medical jargon from scope note
      const simplified = simplifyMedicalText(meshTerm.scopeNote)
      descriptions.push(simplified)
    } else if (meshTerm.laymanTerms.length > 0) {
      descriptions.push(`Also known as: ${meshTerm.laymanTerms.join(', ')}`)
    }
  }
  
  return descriptions.join(' ')
}

/**
 * Simplify medical text for patients
 */
function simplifyMedicalText(text: string): string {
  // Replace common medical terms with simpler alternatives
  const replacements: Record<string, string> = {
    'etiology': 'cause',
    'pathogenesis': 'how it develops',
    'prognosis': 'outlook',
    'chronic': 'long-term',
    'acute': 'sudden',
    'bilateral': 'both sides',
    'unilateral': 'one side',
    'systemic': 'whole body',
    'localized': 'in one area',
    'benign': 'not cancer',
    'malignant': 'cancer',
    'metastasis': 'spread',
    'inflammation': 'swelling and redness',
    'lesion': 'damaged area',
    'neoplasm': 'tumor or growth'
  }
  
  let simplified = text.toLowerCase()
  for (const [medical, simple] of Object.entries(replacements)) {
    simplified = simplified.replace(new RegExp(`\\b${medical}\\b`, 'gi'), simple)
  }
  
  // Capitalize first letter
  return simplified.charAt(0).toUpperCase() + simplified.slice(1)
}

/**
 * Process a clinical trial and add layman terms
 */
export async function enrichTrialWithLaymanTerms(trial: any): Promise<ClinicalTrialWithLaymanTerms> {
  const supabase = await createClient()
  
  // Check if we already have cached MeSH data
  const { data: cachedTerms } = await supabase
    .from('mesh_cache')
    .select('*')
    .in('condition_name', trial.conditions || [])
  
  const meshTerms: MeSHTerm[] = []
  const uncachedConditions = trial.conditions?.filter(
    (condition: string) => !cachedTerms?.find(cached => cached.condition_name === condition)
  ) || []
  
  // Fetch uncached terms from NCBI
  for (const condition of uncachedConditions) {
    const meshTerm = await searchMeSHTerm(condition)
    if (meshTerm) {
      meshTerms.push(meshTerm)
      
      // Cache for future use
      await supabase
        .from('mesh_cache')
        .upsert({
          condition_name: condition,
          mesh_id: meshTerm.meshId,
          preferred_term: meshTerm.preferredTerm,
          scope_note: meshTerm.scopeNote,
          layman_terms: meshTerm.laymanTerms,
          tree_numbers: meshTerm.treeNumbers
        })
    }
  }
  
  // Add cached terms
  cachedTerms?.forEach(cached => {
    meshTerms.push({
      meshId: cached.mesh_id,
      preferredTerm: cached.preferred_term,
      scopeNote: cached.scope_note,
      laymanTerms: cached.layman_terms || [],
      treeNumbers: cached.tree_numbers
    })
  })
  
  const laymanDescription = await generateLaymanDescription(trial.conditions || [], meshTerms)
  
  return {
    trialId: trial.trial_id,
    conditions: trial.conditions || [],
    meshTerms,
    laymanDescription
  }
}

/**
 * Batch process multiple trials
 */
export async function enrichMultipleTrials(trials: any[]): Promise<ClinicalTrialWithLaymanTerms[]> {
  const enrichedTrials: ClinicalTrialWithLaymanTerms[] = []
  
  // Process in batches to avoid rate limits
  const batchSize = 5
  for (let i = 0; i < trials.length; i += batchSize) {
    const batch = trials.slice(i, i + batchSize)
    const enrichedBatch = await Promise.all(
      batch.map(trial => enrichTrialWithLaymanTerms(trial))
    )
    enrichedTrials.push(...enrichedBatch)
    
    // Add delay to respect NCBI rate limits (3 requests per second without API key)
    if (!NCBI_API_KEY && i + batchSize < trials.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return enrichedTrials
}