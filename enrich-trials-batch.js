// Batch process existing trials to add layman descriptions
// Run with: node enrich-trials-batch.js

async function enrichTrialsBatch() {
  console.log('🔄 Starting batch enrichment of clinical trials...\n');
  
  let totalProcessed = 0;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await fetch('http://localhost:3000/api/enrich-trial', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.processed > 0) {
        totalProcessed += data.processed;
        console.log(`✅ Processed ${data.processed} trials (Total: ${totalProcessed})`);
        
        // Wait 2 seconds between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        hasMore = false;
        console.log('\n✨ All trials have been enriched!');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      hasMore = false;
    }
  }
  
  console.log(`\n📊 Total trials enriched: ${totalProcessed}`);
}

console.log('Make sure your Next.js server is running (npm run dev)\n');
console.log('This will enrich trials with patient-friendly descriptions from MeSH\n');
console.log('Starting in 3 seconds...\n');

setTimeout(() => {
  enrichTrialsBatch().catch(console.error);
}, 3000);