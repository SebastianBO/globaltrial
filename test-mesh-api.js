// Test the MeSH translation API
const API_URL = 'https://globaltrial-7wvat5bda-finance-liciancoms-projects.vercel.app/api/mesh-translate';

async function testConditionTranslation() {
  console.log('Testing MeSH translation API...\n');
  
  const testConditions = [
    'Type 2 Diabetes Mellitus',
    'Hypertension',
    'Acute Myocardial Infarction',
    'Major Depressive Disorder',
    'Rheumatoid Arthritis',
    'COVID-19',
    'Alzheimer Disease',
    'Chronic Obstructive Pulmonary Disease'
  ];
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conditions: testConditions,
        action: 'translate_conditions'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      return;
    }
    
    const result = await response.json();
    
    console.log('MeSH Translations Results:');
    console.log('=' .repeat(80));
    
    result.translations.forEach(t => {
      console.log(`\n📋 Condition: ${t.condition}`);
      console.log(`   MeSH ID: ${t.mesh_id || 'Not found in MeSH database'}`);
      console.log(`   Preferred Term: ${t.preferred_term}`);
      console.log(`   ✨ Layman Explanation: ${t.layman_explanation}`);
      if (t.layman_terms && t.layman_terms.length > 0) {
        console.log(`   Also known as: ${t.layman_terms.slice(0, 3).join(', ')}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ MeSH translation API is working!');
    
  } catch (error) {
    console.error('Error testing MeSH API:', error);
  }
}

// Test translating a specific trial
async function testTrialTranslation(trialId) {
  console.log(`\nTesting trial translation for ID: ${trialId}...\n`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trial_id: trialId,
        action: 'translate_trial'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      return;
    }
    
    const result = await response.json();
    
    console.log('Trial Translation Result:');
    console.log('=' .repeat(80));
    console.log(`Trial ID: ${result.trial_id}`);
    console.log(`Conditions: ${result.conditions.join(', ')}`);
    console.log(`\nLayman Description:`);
    console.log(result.layman_description || 'No description generated');
    
    if (result.mesh_terms && result.mesh_terms.length > 0) {
      console.log(`\nMeSH Terms Found:`);
      result.mesh_terms.forEach(term => {
        console.log(`  - ${term.preferredTerm} (${term.meshId})`);
      });
    }
    
  } catch (error) {
    console.error('Error testing trial translation:', error);
  }
}

// Run tests
async function main() {
  await testConditionTranslation();
  
  // If you want to test a specific trial, uncomment and add the trial ID:
  // await testTrialTranslation('your-trial-id-here');
}

main();