// Check trial sources and counts in the database

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wwjorfctbizdhqkpduxt.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTrialSources() {
  console.log('📊 Checking trial sources in database...\n');
  
  try {
    // Get total count
    const { count: totalCount } = await supabase
      .from('clinical_trials')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total trials in database: ${totalCount || 0}`);
    
    // Get count by source
    const { data: sources, error } = await supabase
      .from('clinical_trials')
      .select('source')
      .not('source', 'is', null);
    
    if (error) throw error;
    
    const sourceCounts = {};
    sources.forEach(row => {
      sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
    });
    
    console.log('\nTrials by source:');
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`  - ${source}: ${count} trials`);
    });
    
    // Get count by status
    const { data: statuses } = await supabase
      .from('clinical_trials')
      .select('status');
    
    const statusCounts = {};
    statuses.forEach(row => {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    });
    
    console.log('\nTrials by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count} trials`);
    });
    
    // Check for trials with compensation
    const { count: compensatedTrials } = await supabase
      .from('clinical_trials')
      .select('*', { count: 'exact', head: true })
      .not('compensation', 'is', null)
      .filter('compensation->amount', 'gt', 0);
    
    console.log(`\nTrials with compensation: ${compensatedTrials || 0}`);
    
    // Get sample of EU trials
    const { data: euTrials } = await supabase
      .from('clinical_trials')
      .select('trial_id, title')
      .eq('source', 'EU-CTR')
      .limit(5);
    
    if (euTrials && euTrials.length > 0) {
      console.log('\nSample EU trials:');
      euTrials.forEach(trial => {
        console.log(`  - ${trial.trial_id}: ${trial.title.substring(0, 60)}...`);
      });
    } else {
      console.log('\n⚠️ No EU trials found in database yet');
    }
    
  } catch (error) {
    console.error('Error checking trial sources:', error);
  }
}

checkTrialSources();