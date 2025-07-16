// Script to trigger EU Clinical Trials Register scraper

async function triggerEUScraper() {
  const SUPABASE_URL = 'https://wwjorfctbizdhqkpduxt.supabase.co';
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!SUPABASE_ANON_KEY) {
    console.error('SUPABASE_ANON_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🇪🇺 Triggering EU Clinical Trials Register scraper...');
  
  const conditions = [
    'cancer',
    'diabetes',
    'hypertension',
    'depression',
    'alzheimer',
    'parkinson',
    'arthritis',
    'asthma',
    'heart disease',
    'stroke',
    'covid-19',
    'obesity'
  ];
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/scrape-eu-trials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        conditions,
        maxPerCondition: 50
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${error}`);
    }
    
    const result = await response.json();
    
    console.log('✅ EU scraper triggered successfully!');
    console.log(`📊 Results:
      - Total trials scraped: ${result.totalScraped}
      - Successfully saved: ${result.successCount}
      - Errors: ${result.errorCount}
      - Duplicates skipped: ${result.duplicateCount}
    `);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
  } catch (error) {
    console.error('❌ Error triggering EU scraper:', error);
  }
}

// Run the scraper
triggerEUScraper();