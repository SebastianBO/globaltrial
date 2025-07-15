#!/usr/bin/env node

/**
 * Analyze the structure and content of the clinical_trials table in Supabase
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase connection details
const SUPABASE_URL = 'https://wwjorfctbizdhqkpduxt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3am9yZmN0Yml6ZGhxa3BkdXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODMwMzksImV4cCI6MjA2ODE1OTAzOX0.PW5ZRSQsK9ij97v4xg7FLQPXEwmxtZC_Zlxdx3dJKnY';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function analyzeClinicalTrials() {
  console.log('=== CLINICAL TRIALS TABLE ANALYSIS ===\n');

  try {
    // 1. Get total count of records
    const { count: totalRecords, error: countError } = await supabase
      .from('clinical_trials')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    console.log(`Total records in clinical_trials table: ${totalRecords}\n`);

    // 2. Get sample records to analyze structure
    console.log('Fetching sample records...');
    const { data: sampleRecords, error: sampleError } = await supabase
      .from('clinical_trials')
      .select('*')
      .limit(5);

    if (sampleError) throw sampleError;

    if (sampleRecords && sampleRecords.length > 0) {
      console.log(`Successfully fetched ${sampleRecords.length} sample records\n`);

      // Analyze column population
      console.log('=== COLUMN POPULATION ANALYSIS ===');
      const columnStats = analyzeColumnPopulation(sampleRecords);
      
      for (const [col, stats] of Object.entries(columnStats)) {
        console.log(`\n${col}:`);
        console.log(`  - Populated: ${stats.populated}/${stats.total} (${stats.percentage.toFixed(1)}%)`);
        console.log(`  - Data type: ${stats.type}`);
        if (stats.sampleValues.length > 0) {
          console.log(`  - Sample values: ${JSON.stringify(stats.sampleValues.slice(0, 3))}`);
        }
      }

      // Analyze JSONB fields in detail
      console.log('\n\n=== JSONB FIELD STRUCTURE ANALYSIS ===');

      console.log('\n1. ELIGIBILITY_CRITERIA Structure:');
      analyzeJsonbField(sampleRecords, 'eligibility_criteria');

      console.log('\n2. LOCATIONS Structure:');
      analyzeJsonbField(sampleRecords, 'locations');

      console.log('\n3. CONTACT_INFO Structure:');
      analyzeJsonbField(sampleRecords, 'contact_info');

      // Display full sample records
      console.log('\n\n=== SAMPLE RECORDS (First 2) ===');
      sampleRecords.slice(0, 2).forEach((record, i) => {
        console.log(`\n--- Record ${i + 1} ---`);
        console.log(`ID: ${record.id || 'N/A'}`);
        console.log(`Trial ID: ${record.trial_id || 'N/A'}`);
        console.log(`Title: ${(record.title || 'N/A').substring(0, 100)}...`);
        console.log(`Status: ${record.status || 'N/A'}`);
        console.log(`Phase: ${record.phase || 'N/A'}`);
        console.log(`Sponsor: ${record.sponsor || 'N/A'}`);
        console.log(`Conditions: ${JSON.stringify(record.conditions || [])}`);
        console.log(`Interventions: ${JSON.stringify(record.interventions || [])}`);

        // Pretty print JSONB fields
        if (record.eligibility_criteria) {
          console.log('\nEligibility Criteria:');
          console.log(JSON.stringify(record.eligibility_criteria, null, 2));
        }

        if (record.locations && record.locations.length > 0) {
          console.log(`\nLocations (${record.locations.length} total):`);
          record.locations.slice(0, 2).forEach(loc => {
            console.log(JSON.stringify(loc, null, 2));
          });
        }

        if (record.contact_info) {
          console.log('\nContact Info:');
          console.log(JSON.stringify(record.contact_info, null, 2));
        }
      });
    }

    // 3. Analyze data patterns and issues
    console.log('\n\n=== DATA PATTERNS AND ISSUES ===');

    // Check for missing critical fields
    console.log('\nChecking for records with missing critical fields...');

    // Records without title
    const { count: noTitleCount } = await supabase
      .from('clinical_trials')
      .select('*', { count: 'exact', head: true })
      .is('title', null);
    console.log(`Records without title: ${noTitleCount || 0}`);

    // Records without conditions
    const { count: emptyConditionsCount } = await supabase
      .from('clinical_trials')
      .select('*', { count: 'exact', head: true })
      .eq('conditions', []);
    console.log(`Records with empty conditions array: ${emptyConditionsCount || 0}`);

    // Status distribution
    console.log('\nStatus distribution:');
    const { data: allRecords } = await supabase
      .from('clinical_trials')
      .select('status');

    if (allRecords) {
      const statusCounts = {};
      allRecords.forEach(record => {
        const status = record.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
          const percentage = (count / allRecords.length * 100).toFixed(1);
          console.log(`  - ${status}: ${count} (${percentage}%)`);
        });
    }

    // Phase distribution
    console.log('\nPhase distribution:');
    const { data: phaseData } = await supabase
      .from('clinical_trials')
      .select('phase');

    if (phaseData) {
      const phaseCounts = {};
      phaseData.forEach(record => {
        const phase = record.phase || 'Not specified';
        phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
      });

      Object.entries(phaseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([phase, count]) => {
          console.log(`  - ${phase}: ${count}`);
        });
    }

    // Date range analysis
    console.log('\nDate range analysis:');
    const { data: dateData } = await supabase
      .from('clinical_trials')
      .select('start_date, completion_date');

    if (dateData) {
      const startDates = dateData
        .map(r => r.start_date)
        .filter(d => d)
        .sort();
      const completionDates = dateData
        .map(r => r.completion_date)
        .filter(d => d)
        .sort();

      if (startDates.length > 0) {
        console.log(`  - Earliest start date: ${startDates[0]}`);
        console.log(`  - Latest start date: ${startDates[startDates.length - 1]}`);
      }

      if (completionDates.length > 0) {
        console.log(`  - Earliest completion date: ${completionDates[0]}`);
        console.log(`  - Latest completion date: ${completionDates[completionDates.length - 1]}`);
      }
    }

    // Most common conditions
    console.log('\n\nMost common conditions (top 10):');
    const { data: conditionData } = await supabase
      .from('clinical_trials')
      .select('conditions');

    if (conditionData) {
      const conditionCounts = {};
      conditionData.forEach(record => {
        if (record.conditions && Array.isArray(record.conditions)) {
          record.conditions.forEach(condition => {
            conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
          });
        }
      });

      Object.entries(conditionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([condition, count]) => {
          console.log(`  - ${condition}: ${count}`);
        });
    }

    // Location analysis
    console.log('\n\nLocation countries (top 10):');
    const { data: locationData } = await supabase
      .from('clinical_trials')
      .select('locations');

    if (locationData) {
      const countryCounts = {};
      locationData.forEach(record => {
        if (record.locations && Array.isArray(record.locations)) {
          record.locations.forEach(location => {
            if (location.country) {
              countryCounts[location.country] = (countryCounts[location.country] || 0) + 1;
            }
          });
        }
      });

      Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([country, count]) => {
          console.log(`  - ${country}: ${count}`);
        });
    }

  } catch (error) {
    console.error('Error analyzing clinical trials:', error);
  }
}

function analyzeColumnPopulation(records) {
  if (!records || records.length === 0) return {};

  const allColumns = new Set();
  records.forEach(record => {
    Object.keys(record).forEach(key => allColumns.add(key));
  });

  const columnStats = {};

  Array.from(allColumns).sort().forEach(col => {
    let populated = 0;
    const sampleValues = [];
    const dataTypes = new Set();

    records.forEach(record => {
      const value = record[col];
      if (value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
        populated++;
        if (sampleValues.length < 3) {
          if (typeof value === 'object') {
            sampleValues.push(`${Array.isArray(value) ? 'Array' : 'Object'} with ${Array.isArray(value) ? value.length : Object.keys(value).length} items`);
          } else {
            const strValue = String(value);
            sampleValues.push(strValue.length > 50 ? strValue.substring(0, 50) + '...' : strValue);
          }
        }
        dataTypes.add(Array.isArray(value) ? 'array' : typeof value);
      }
    });

    columnStats[col] = {
      populated,
      total: records.length,
      percentage: (populated / records.length) * 100,
      type: Array.from(dataTypes).join(', ') || 'unknown',
      sampleValues
    };
  });

  return columnStats;
}

function analyzeJsonbField(records, fieldName) {
  const fieldValues = records
    .map(r => r[fieldName])
    .filter(v => v !== null && v !== undefined);

  if (fieldValues.length === 0) {
    console.log(`  No populated ${fieldName} fields found in sample`);
    return;
  }

  console.log(`  Found ${fieldValues.length} populated ${fieldName} fields`);

  // For array fields (like locations)
  if (Array.isArray(fieldValues[0])) {
    console.log(`  Type: Array of objects`);
    console.log(`  Array lengths: ${fieldValues.slice(0, 5).map(v => v.length).join(', ')}`);

    // Get sample structure from first non-empty array
    const nonEmptyArray = fieldValues.find(v => v.length > 0);
    if (nonEmptyArray && nonEmptyArray.length > 0) {
      console.log(`  Sample item structure:`);
      const sampleItem = nonEmptyArray[0];
      Object.entries(sampleItem).forEach(([key, val]) => {
        console.log(`    - ${key}: ${typeof val}`);
      });
    }
  }
  // For object fields
  else if (typeof fieldValues[0] === 'object') {
    console.log(`  Type: Object`);

    // Collect all keys across samples
    const allKeys = new Set();
    fieldValues.forEach(value => {
      if (typeof value === 'object' && value !== null) {
        Object.keys(value).forEach(key => allKeys.add(key));
      }
    });

    console.log(`  Keys found: ${Array.from(allKeys).sort().join(', ')}`);

    // Show sample structure
    console.log(`  Sample structure:`);
    const sample = fieldValues[0];
    Object.entries(sample).forEach(([key, val]) => {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        console.log(`    - ${key}: ${typeof val} = ${String(val).substring(0, 50)}`);
      } else {
        console.log(`    - ${key}: ${typeof val}`);
      }
    });
  }
}

// Run the analysis
analyzeClinicalTrials();