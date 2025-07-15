// Test script to trigger the clinical trials scraping
const SUPABASE_URL = 'https://wwjorfctbizdhqkpduxt.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE' // You'll need to add this

async function testScraping() {
  console.log('Testing clinical trials scraping...')
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/scrape-trials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    console.log('Response:', data)
    
    if (response.ok) {
      console.log('✅ Scraping successful!')
    } else {
      console.error('❌ Scraping failed:', data)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Instructions:
console.log(`
To test the scraping:
1. Go to https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt/settings/api
2. Copy your "anon public" key
3. Replace YOUR_ANON_KEY_HERE with your actual key
4. Run: node test-scraping.js
`)

// Uncomment to run the test
// testScraping()