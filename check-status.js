// Check the status of your GlobalTrials implementation
// Run with: node check-status.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wwjorfctbizdhqkpduxt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3am9yZmN0Yml6ZGhxa3BkdXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODMwMzksImV4cCI6MjA2ODE1OTAzOX0.PW5ZRSQsK9ij97v4xg7FLQPXEwmxtZC_Zlxdx3dJKnY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStatus() {
  console.log('🔍 Checking GlobalTrials Status...\n');

  // 1. Check total trials
  const { count: totalTrials } = await supabase
    .from('clinical_trials')
    .select('*', { count: 'exact', head: true });
  
  console.log(`✅ Total trials in database: ${totalTrials || 0}`);

  // 2. Check trials by condition
  const { data: trialsByCondition } = await supabase
    .from('clinical_trials')
    .select('conditions')
    .limit(1000);

  const conditionCounts = {};
  trialsByCondition?.forEach(trial => {
    trial.conditions?.forEach(condition => {
      conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
    });
  });

  console.log('\n📊 Top conditions by trial count:');
  Object.entries(conditionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([condition, count]) => {
      console.log(`   - ${condition}: ${count} trials`);
    });

  // 3. Check terminology mappings
  const { count: termMappings, error: termError } = await supabase
    .from('medical_term_mappings')
    .select('*', { count: 'exact', head: true });
  
  if (termError) {
    console.log(`\n❌ Error checking terminology mappings: ${termError.message}`);
  }
  
  console.log(`\n✅ Terminology mappings: ${termMappings || 0}`);

  // 4. Test a terminology lookup
  const { data: termTest } = await supabase
    .rpc('find_medical_terms', { patient_input: 'heart attack' });
  
  if (termTest && termTest.length > 0) {
    console.log('\n🔍 Test terminology lookup for "heart attack":');
    console.log(`   Medical terms: ${termTest[0].medical_terms.join(', ')}`);
  }

  // 5. Check recent trials
  const { data: recentTrials } = await supabase
    .from('clinical_trials')
    .select('trial_id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n📅 Most recent trials added:');
  recentTrials?.forEach(trial => {
    const date = new Date(trial.created_at).toLocaleString();
    console.log(`   - ${trial.trial_id}: ${trial.title.substring(0, 50)}... (${date})`);
  });

  // 6. Check if scraping is active
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentlyAdded } = await supabase
    .from('clinical_trials')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);

  console.log(`\n📈 Trials added in last hour: ${recentlyAdded || 0}`);
  
  if (recentlyAdded > 0) {
    console.log('   ✅ Scraping appears to be active!');
  } else {
    console.log('   ⏸️  No recent activity - scraper may need to be triggered');
  }
}

checkStatus().catch(console.error);