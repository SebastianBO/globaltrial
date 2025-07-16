import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.error('GROQ_API_KEY is not configured');
}

const groq = new Groq({
  apiKey: groqApiKey || '',
});

const SYSTEM_PROMPT = `You are a compassionate medical intake specialist for a clinical trials marketplace. Your role is to have a natural conversation with patients to understand their medical situation and help match them with appropriate clinical trials.

Guidelines:
1. Be empathetic and conversational, not robotic
2. Ask one question at a time
3. Based on their responses, ask relevant follow-up questions
4. Extract key information: conditions, medications, age, location, symptoms, treatment history
5. If they mention a condition, ask about severity, duration, current treatments
6. Be supportive and encouraging about their interest in clinical trials
7. Keep responses concise and friendly

Start by introducing yourself and asking about their main health concern.`;

export async function POST(request: NextRequest) {
  try {
    if (!groqApiKey) {
      console.error('GROQ_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'Groq API key not configured', details: 'GROQ_API_KEY environment variable is missing' },
        { status: 500 }
      );
    }

    const { messages } = await request.json();
    console.log('Received messages:', messages?.length || 0);

    console.log('Calling Groq API with model: llama-3.1-8b-instant');
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 200,
    });

    const assistantMessage = completion.choices[0]?.message?.content || '';

    // Extract patient data from conversation (if enough info gathered)
    const extractedData = await extractPatientData(messages, assistantMessage);

    return NextResponse.json({
      message: assistantMessage,
      extractedData,
      shouldContinue: !isIntakeComplete(extractedData)
    });
  } catch (error) {
    console.error('Groq chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let errorDetails = null;
    if (error instanceof Error && 'response' in error) {
      const errorWithResponse = error as Error & { response?: { data?: unknown } };
      errorDetails = errorWithResponse.response?.data;
    }
    return NextResponse.json(
      { 
        error: 'Failed to process chat', 
        details: errorMessage,
        groqError: errorDetails,
        hasApiKey: !!groqApiKey,
        model: 'llama-3.1-8b-instant'
      },
      { status: 500 }
    );
  }
}

interface ChatMessage {
  role: string;
  content: string;
}

async function extractPatientData(messages: ChatMessage[], latestResponse: string) {
  // Use Groq to extract structured data from conversation
  try {
    const extraction = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Extract patient information from the conversation. You MUST return ONLY a valid JSON object with these fields: conditions (array), medications (array), age (number or null), location (object with city, state, country), symptoms (array), previousTreatments (array). Only include fields where information was clearly provided. No other text, just the JSON."
        },
        {
          role: "user",
          content: `Conversation:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}\nassistant: ${latestResponse}`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 500
    });

    const content = extraction.choices[0]?.message?.content || '{}';
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let extractedData = {};
    if (jsonMatch) {
      extractedData = JSON.parse(jsonMatch[0]);
    } else {
      extractedData = JSON.parse(content);
    }
    
    // Enhance conditions with medical terminology
    if (extractedData.conditions && extractedData.conditions.length > 0) {
      const supabase = await createClient();
      const enhancedConditions = [];
      
      for (const condition of extractedData.conditions) {
        // Look up medical terms for patient-friendly terms
        const { data: termMapping } = await supabase
          .rpc('find_medical_terms', { patient_input: condition.toLowerCase() });
        
        if (termMapping && termMapping.length > 0) {
          enhancedConditions.push({
            patientTerm: condition,
            medicalTerms: termMapping[0].medical_terms,
            category: termMapping[0].category
          });
        } else {
          enhancedConditions.push({
            patientTerm: condition,
            medicalTerms: [condition],
            category: 'unknown'
          });
        }
      }
      
      extractedData.enhancedConditions = enhancedConditions;
    }
    
    return extractedData;
  } catch (error) {
    console.error('Error extracting patient data:', error);
    return {};
  }
}

interface ExtractedData {
  conditions?: string[];
  age?: number;
  location?: {
    state: string;
  };
}

function isIntakeComplete(data: ExtractedData): boolean {
  // Check if we have minimum required information
  return !!(
    data.conditions && data.conditions.length > 0 &&
    data.age &&
    data.location?.state
  );
}