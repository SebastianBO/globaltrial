#!/usr/bin/env node

/**
 * Script to import international clinical trials data
 * This will import trials from EU, WHO, UK, and other registries
 */

require('dotenv').config();

const { WHOICTRPScraper } = require('./lib/scraper/who-ictrp-scraper');
const { ISRCTNScraper } = require('./lib/scraper/isrctn-scraper');
const { CTISScraper } = require('./lib/scraper/ctis-scraper');
const { EUCTRBulkScraper } = require('./lib/scraper/eu-ctr-bulk-scraper');

async function runScrapers() {
  console.log('🌍 Starting international clinical trials import...\n');

  // WHO ICTRP (World Health Organization - Global aggregator)
  console.log('1️⃣ WHO ICTRP - Global trials aggregator');
  console.log('   This includes trials from multiple countries');
  const whoScraper = new WHOICTRPScraper();
  try {
    await whoScraper.import();
    console.log('✅ WHO ICTRP import completed\n');
  } catch (error) {
    console.error('❌ WHO ICTRP import failed:', error.message);
  }

  // ISRCTN (UK Registry)
  console.log('2️⃣ ISRCTN - UK Clinical Trials Registry');
  const isrctnScraper = new ISRCTNScraper();
  try {
    await isrctnScraper.scrapeAllTrials();
    console.log('✅ ISRCTN import completed\n');
  } catch (error) {
    console.error('❌ ISRCTN import failed:', error.message);
  }

  // EU CTR (European Union Clinical Trials Register)
  console.log('3️⃣ EU CTR - European Union Clinical Trials');
  const euScraper = new EUCTRBulkScraper();
  try {
    await euScraper.import();
    console.log('✅ EU CTR import completed\n');
  } catch (error) {
    console.error('❌ EU CTR import failed:', error.message);
  }

  // CTIS (New EU Clinical Trials Information System)
  console.log('4️⃣ CTIS - New EU Clinical Trials System');
  const ctisScraper = new CTISScraper();
  try {
    await ctisScraper.scrapeAllTrials();
    console.log('✅ CTIS import completed\n');
  } catch (error) {
    console.error('❌ CTIS import failed:', error.message);
  }

  console.log('🎉 International trials import process completed!');
  console.log('Note: Some scrapers may require manual downloads or API keys.');
  console.log('Check the logs above for any errors or instructions.');
}

// Run the scrapers
runScrapers().catch(console.error);