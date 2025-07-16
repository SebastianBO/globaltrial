import { createClient } from '@supabase/supabase-js';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { OpenAIEmbeddings } from '@langchain/openai';

interface EligibilityExample {
  id: string;
  original_text: string;
  parsed_criteria: any;
  patient_friendly: string;
  condition_type: string;
}

export class RAGEligibilitySystem {
  private supabase: any;
  private vectorStore: SupabaseVectorStore;
  private groqApiKey: string;

  constructor(supabaseUrl: string, supabaseKey: string, groqApiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.groqApiKey = groqApiKey;
    
    // Initialize vector store for eligibility examples
    this.vectorStore = new SupabaseVectorStore(
      new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY // For embeddings only
      }),
      {
        client: this.supabase,
        tableName: 'eligibility_examples',
        queryName: 'match_eligibility_examples'
      }
    );
  }

  async initializeRAG() {
    // Create vector storage table
    await this.supabase.rpc('execute_sql', {
      query: `
        -- Create eligibility examples table with vector storage
        CREATE TABLE IF NOT EXISTS eligibility_examples (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          original_text TEXT NOT NULL,
          parsed_criteria JSONB NOT NULL,
          patient_friendly TEXT NOT NULL,
          condition_type VARCHAR(100),
          embedding vector(1536),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create vector similarity search function
        CREATE OR REPLACE FUNCTION match_eligibility_examples(
          query_embedding vector(1536),
          match_threshold FLOAT DEFAULT 0.78,
          match_count INT DEFAULT 10
        )
        RETURNS TABLE(
          id UUID,
          original_text TEXT,
          parsed_criteria JSONB,
          patient_friendly TEXT,
          similarity FLOAT
        )
        LANGUAGE SQL STABLE
        AS $$
          SELECT
            id,
            original_text,
            parsed_criteria,
            patient_friendly,
            1 - (embedding <=> query_embedding) AS similarity
          FROM eligibility_examples
          WHERE 1 - (embedding <=> query_embedding) > match_threshold
          ORDER BY embedding <=> query_embedding
          LIMIT match_count;
        $$;

        -- Create index for vector search
        CREATE INDEX IF NOT EXISTS idx_eligibility_embedding 
        ON eligibility_examples USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `
    });
  }

  async parseWithRAG(eligibilityText: string): Promise<any> {
    // Step 1: Find similar examples using vector search
    const similarExamples = await this.findSimilarExamples(eligibilityText);
    
    // Step 2: Build context from examples
    const context = this.buildContextFromExamples(similarExamples);
    
    // Step 3: Use Groq with RAG context
    const prompt = `
You are parsing clinical trial eligibility criteria.

Here are similar examples and how they were parsed:
${context}

Now parse this new eligibility criteria following the same pattern:
${eligibilityText}

Return JSON with:
- inclusion: array of parsed criteria
- exclusion: array of parsed criteria  
- simple_explanation: patient-friendly summary
- data_requirements: what info needed from patient
`;

    const response = await this.callGroqWithRAG(prompt);
    
    // Step 4: Store this example for future RAG
    await this.storeExample(eligibilityText, response);
    
    return response;
  }

  private async findSimilarExamples(text: string): Promise<EligibilityExample[]> {
    // Get embedding for the input text
    const embedding = await this.getEmbedding(text);
    
    // Find similar examples
    const { data: examples } = await this.supabase.rpc('match_eligibility_examples', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5
    });
    
    return examples || [];
  }

  private buildContextFromExamples(examples: EligibilityExample[]): string {
    return examples.map(ex => `
Example ${examples.indexOf(ex) + 1}:
Original: "${ex.original_text.substring(0, 200)}..."
Parsed to: ${JSON.stringify(ex.parsed_criteria, null, 2)}
Patient-friendly: "${ex.patient_friendly}"
---`).join('\n');
  }

  private async callGroqWithRAG(prompt: string): Promise<any> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at parsing clinical trial eligibility criteria. Use the provided examples to maintain consistency.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // For production, use OpenAI embeddings or similar
    // For now, return mock embedding
    return Array(1536).fill(0).map(() => Math.random());
  }

  private async storeExample(
    originalText: string, 
    parsed: any
  ): Promise<void> {
    const embedding = await this.getEmbedding(originalText);
    
    await this.supabase
      .from('eligibility_examples')
      .insert({
        original_text: originalText,
        parsed_criteria: parsed,
        patient_friendly: parsed.simple_explanation,
        condition_type: this.detectConditionType(originalText),
        embedding
      });
  }

  private detectConditionType(text: string): string {
    // Simple condition detection
    const conditions = {
      'diabetes': ['diabetes', 'hba1c', 'glucose', 'insulin'],
      'cancer': ['cancer', 'tumor', 'oncology', 'chemotherapy'],
      'heart': ['cardiac', 'heart', 'cardiovascular', 'hypertension'],
      'mental_health': ['depression', 'anxiety', 'psychiatric', 'mental'],
      'respiratory': ['asthma', 'copd', 'lung', 'respiratory']
    };
    
    const lowerText = text.toLowerCase();
    for (const [type, keywords] of Object.entries(conditions)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return type;
      }
    }
    
    return 'other';
  }

  // Pre-populate with high-quality examples
  async seedExamples() {
    const examples = [
      {
        original_text: "Inclusion: Type 2 diabetes mellitus for ≥6 months, HbA1c 7.5-11.0%, BMI 25-40 kg/m²",
        parsed_criteria: {
          inclusion: [
            {
              type: "condition",
              text: "Type 2 diabetes for at least 6 months",
              parameters: { condition_name: "Type 2 diabetes", min_duration_months: 6 }
            },
            {
              type: "lab_value", 
              text: "HbA1c between 7.5% and 11.0%",
              parameters: { test_name: "HbA1c", min_value: 7.5, max_value: 11.0, unit: "%" }
            }
          ]
        },
        patient_friendly: "You may qualify if you've had type 2 diabetes for at least 6 months, your HbA1c is between 7.5-11%, and your BMI is 25-40."
      },
      // Add more examples...
    ];
    
    for (const example of examples) {
      await this.storeExample(example.original_text, example.parsed_criteria);
    }
  }
}