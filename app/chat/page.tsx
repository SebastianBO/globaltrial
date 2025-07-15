'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Send, Bot, User, DollarSign } from 'lucide-react'

interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
  isTyping?: boolean
}

interface PatientData {
  email: string
  age: string
  gender: string
  conditions: string[]
  medications: string[]
  medicalHistory: string
  country: string
  state: string
  city: string
}

const questions = [
  { field: 'email', question: "Welcome! I'm here to help match you with clinical trials. What's your email address?" },
  { field: 'age', question: "Great! How old are you?" },
  { field: 'gender', question: "What's your gender? (male/female/other)" },
  { field: 'conditions', question: "What medical conditions are you dealing with? You can list multiple conditions separated by commas." },
  { field: 'medications', question: "Are you currently taking any medications? Please list them (or type 'none')." },
  { field: 'medicalHistory', question: "Could you tell me more about your medical history? Any surgeries, allergies, or other relevant information?" },
  { field: 'country', question: "What country are you located in?" },
  { field: 'state', question: "Which state or province?" },
  { field: 'city', question: "And which city?" },
]

export default function ChatIntake() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Welcome! I'm here to help match you with clinical trials. What's your email address?"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [patientData, setPatientData] = useState<Partial<PatientData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const addTypingMessage = () => {
    const typingMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '',
      isTyping: true
    }
    setMessages(prev => [...prev, typingMessage])
  }

  const removeTypingMessage = () => {
    setMessages(prev => prev.filter(msg => !msg.isTyping))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    // Simulate typing
    addTypingMessage()
    await new Promise(resolve => setTimeout(resolve, 1000))
    removeTypingMessage()

    // Process the answer
    const currentField = questions[currentQuestion].field
    let processedData: any = input

    if (currentField === 'conditions' || currentField === 'medications') {
      processedData = input.split(',').map(item => item.trim()).filter(Boolean)
    }

    setPatientData(prev => ({ ...prev, [currentField]: processedData }))

    // Move to next question or submit
    if (currentQuestion < questions.length - 1) {
      const nextQuestion = currentQuestion + 1
      setCurrentQuestion(nextQuestion)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: questions[nextQuestion].question
      }
      setMessages(prev => [...prev, assistantMessage])
    } else {
      // All questions answered, submit data
      setIsSubmitting(true)
      
      const summaryMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Perfect! I have all the information I need. Let me find the best clinical trials for you..."
      }
      setMessages(prev => [...prev, summaryMessage])

      // Submit to database
      try {
        const supabase = createClient()
        
        const finalData = {
          email: patientData.email || '',
          age: parseInt(patientData.age || '0'),
          gender: patientData.gender || '',
          conditions: patientData.conditions || [],
          current_medications: patientData.medications || [],
          medical_history: patientData.medicalHistory || '',
          location: {
            country: patientData.country || '',
            state: patientData.state || '',
            city: patientData.city || ''
          }
        }

        const { data: patient, error } = await supabase
          .from('patients')
          .insert(finalData)
          .select()
          .single()

        if (error) throw error

        // Call matching API
        const response = await fetch('/api/match-trials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: patient.id,
            conditions: patient.conditions,
            medicalHistory: patientData.medicalHistory,
            location: patient.location
          })
        })

        if (!response.ok) throw new Error('Failed to match trials')

        // Show success message with animation
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        const successMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: "🎉 Great news! I've found several clinical trials that match your profile. Redirecting you to your personalized matches..."
        }
        setMessages(prev => [...prev, successMessage])

        await new Promise(resolve => setTimeout(resolve, 2000))
        router.push(`/patient/${patient.id}/matches`)
      } catch (error) {
        console.error('Error:', error)
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: "I'm sorry, there was an error processing your information. Please try again or use the traditional form."
        }
        setMessages(prev => [...prev, errorMessage])
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Find Your Clinical Trial Match</h1>
          <p className="text-lg text-gray-600">Have a conversation with our AI to find trials that match your needs</p>
          <div className="flex items-center justify-center gap-2 mt-4 text-green-600">
            <DollarSign className="w-5 h-5" />
            <span className="font-medium">Many trials offer compensation for participation</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="h-[600px] flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    message.role === 'assistant' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    {message.role === 'assistant' ? (
                      <Bot className="w-6 h-6 text-blue-600" />
                    ) : (
                      <User className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <div className={`max-w-[70%] ${
                    message.role === 'user' ? 'text-right' : ''
                  }`}>
                    <div className={`inline-block px-4 py-3 rounded-2xl ${
                      message.role === 'assistant' 
                        ? 'bg-blue-50 text-gray-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {message.isTyping ? (
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={loading || isSubmitting}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-full focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || isSubmitting || !input.trim()}
                  className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Prefer a traditional form?{' '}
            <a href="/patient" className="text-blue-600 hover:underline">
              Click here
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}