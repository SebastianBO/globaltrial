const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function enrichTrialsWithMeSH() {
  console.log('Starting MeSH enrichment for clinical trials...');
  
  // Fetch trials that don't have MeSH data yet
  const { data: trials, error } = await supabase
    .from('clinical_trials')
    .select('id, trial_id, title, conditions')
    .is('layman_description', null)
    .not('conditions', 'is', null)
    .limit(10); // Start with 10 trials
    
  if (error) {
    console.error('Error fetching trials:', error);
    return;
  }
  
  console.log(`Found ${trials.length} trials to enrich with MeSH terms`);
  
  for (const trial of trials) {
    console.log(`\nProcessing trial ${trial.trial_id}: ${trial.title}`);
    console.log(`Conditions: ${trial.conditions.join(', ')}`);
    
    try {
      // Call our API endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '-q54w9zgby-finance-liciancoms-projects.vercel.app')}/api/mesh-translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trial_id: trial.id,
          action: 'translate_trial'
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to translate trial ${trial.trial_id}:`, error);
        continue;
      }
      
      const result = await response.json();
      console.log('✓ Successfully enriched with MeSH terms');
      console.log(`Layman description: ${result.layman_description?.substring(0, 100)}...`);
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error processing trial ${trial.trial_id}:`, error);
    }
  }
  
  console.log('\nMeSH enrichment complete!');
  
  // Show statistics
  const { count } = await supabase
    .from('clinical_trials')
    .select('*', { count: 'exact', head: true })
    .not('layman_description', 'is', null);
    
  console.log(`\nTotal trials with layman descriptions: ${count}`);
}

// Test translating specific conditions
async function testConditionTranslation() {
  console.log('\nTesting condition translations...');
  
  const testConditions = [
    'Type 2 Diabetes Mellitus',
    'Hypertension',
    'Acute Myocardial Infarction',
    'Major Depressive Disorder',
    'Rheumatoid Arthritis'
  ];
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '-q54w9zgby-finance-liciancoms-projects.vercel.app')}/api/mesh-translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conditions: testConditions,
        action: 'translate_conditions'
      })
    });
    
    const result = await response.json();
    
    console.log('\nCondition Translations:');
    result.translations.forEach(t => {
      console.log(`\n${t.condition}:`);
      console.log(`  MeSH ID: ${t.mesh_id || 'Not found'}`);
      console.log(`  Preferred Term: ${t.preferred_term}`);
      console.log(`  Layman Explanation: ${t.layman_explanation}`);
      if (t.layman_terms?.length > 0) {
        console.log(`  Also known as: ${t.layman_terms.join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('Error testing conditions:', error);
  }
}

// Run the enrichment
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    await testConditionTranslation();
  } else {
    await enrichTrialsWithMeSH();
  }
}

main().catch(console.error);