const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://wwjorfctbizdhqkpduxt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3am9yZmN0Yml6ZGhxa3BkdXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODMwMzksImV4cCI6MjA2ODE1OTAzOX0.PW5ZRSQsK9ij97v4xg7FLQPXEwmxtZC_Zlxdx3dJKnY'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkData() {
  console.log('Checking database for clinical trials...\n')
  
  // Count total trials
  const { count: totalCount } = await supabase
    .from('clinical_trials')
    .select('*', { count: 'exact', head: true })
    
  console.log(`Total trials in database: ${totalCount || 0}`)
  
  // Get a sample of trials
  const { data: trials, error } = await supabase
    .from('clinical_trials')
    .select('trial_id, title, conditions, status')
    .limit(5)
    
  if (error) {
    console.error('Error fetching trials:', error)
    return
  }
  
  if (trials && trials.length > 0) {
    console.log('\nSample trials:')
    trials.forEach((trial, index) => {
      console.log(`\n${index + 1}. ${trial.title}`)
      console.log(`   ID: ${trial.trial_id}`)
      console.log(`   Conditions: ${trial.conditions?.join(', ') || 'None'}`)
      console.log(`   Status: ${trial.status}`)
    })
  } else {
    console.log('\nNo trials found in database.')
  }
  
  // Check conditions distribution
  const { data: conditions } = await supabase
    .from('clinical_trials')
    .select('conditions')
    
  if (conditions) {
    const conditionCounts = {}
    conditions.forEach(row => {
      row.conditions?.forEach(condition => {
        conditionCounts[condition] = (conditionCounts[condition] || 0) + 1
      })
    })
    
    console.log('\nTop conditions in database:')
    Object.entries(conditionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([condition, count]) => {
        console.log(`  - ${condition}: ${count} trials`)
      })
  }
}

checkData()