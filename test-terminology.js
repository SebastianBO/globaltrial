// Quick test script for terminology mapping
// Run with: node test-terminology.js

async function testTerminologyMapping() {
  const testTerms = [
    'heart attack',
    'high blood pressure',
    'diabetes',
    'depression',
    'cancer'
  ];

  console.log('Testing terminology mapping...\n');

  for (const term of testTerms) {
    console.log(`Testing: "${term}"`);
    
    const response = await fetch('http://localhost:3000/api/groq-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `I have ${term}`
          }
        ]
      })
    });

    const data = await response.json();
    console.log('Response:', data.extractedData?.enhancedConditions || 'No enhanced conditions');
    console.log('---\n');
  }
}

// Test the match-trials endpoint
async function testTrialMatching() {
  console.log('\nTesting trial matching with patient-friendly terms...\n');
  
  const response = await fetch('http://localhost:3000/api/match-trials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      patientId: 'test-patient-123',
      conditions: ['heart attack', 'high blood pressure'],
      medicalHistory: 'Recently diagnosed with heart problems',
      location: {
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    })
  });

  const data = await response.json();
  console.log('Match result:', data);
}

// Run tests
console.log('Make sure your Next.js dev server is running (npm run dev)\n');
console.log('Starting tests in 3 seconds...\n');

setTimeout(async () => {
  try {
    await testTerminologyMapping();
    await testTrialMatching();
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure your dev server is running: npm run dev');
  }
}, 3000);