'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Send, Bot, User, DollarSign, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
  isTyping?: boolean
}

interface PatientData {
  email?: string
  age?: number
  gender?: string
  conditions?: string[]
  medications?: string[]
  symptoms?: string[]
  previousTreatments?: string[]
  location?: {
    country: string
    state: string
    city: string
  }
}

export default function ChatIntake() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [patientData, setPatientData] = useState<PatientData>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conversationComplete, setConversationComplete] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Initialize conversation
    if (messages.length === 0) {
      initializeChat()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const initializeChat = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/groq-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], patientData: {} })
      })
      
      const data = await response.json()
      if (data.message) {
        addMessage(data.message, 'assistant')
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error)
      addMessage("Hello! I'm here to help match you with clinical trials. Can you tell me about your main health concern?", 'assistant')
    } finally {
      setLoading(false)
    }
  }

  const addMessage = (content: string, role: 'assistant' | 'user') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      isTyping: false
    }
    setMessages(prev => [...prev, newMessage])
  }

  const addTypingMessage = () => {
    const typingMessage: Message = {
      id: 'typing',
      role: 'assistant',
      content: '',
      isTyping: true
    }
    setMessages(prev => [...prev, typingMessage])
  }

  const removeTypingMessage = () => {
    setMessages(prev => prev.filter(msg => msg.id !== 'typing'))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading || conversationComplete) return

    const userMessage = input.trim()
    setInput('')
    addMessage(userMessage, 'user')
    setLoading(true)

    // Show typing indicator
    addTypingMessage()

    try {
      const response = await fetch('/api/groq-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, { role: 'user', content: userMessage }].map(m => ({
            role: m.role,
            content: m.content
          })),
          patientData 
        })
      })
      
      const data = await response.json()
      
      removeTypingMessage()
      
      if (data.message) {
        addMessage(data.message, 'assistant')
      }
      
      // Update patient data with extracted information
      if (data.extractedData) {
        setPatientData(prev => {
          const updated = {
            ...prev,
            ...data.extractedData,
            conditions: data.extractedData.conditions || prev.conditions,
            medications: data.extractedData.medications || prev.medications,
            age: data.extractedData.age || prev.age,
            location: data.extractedData.location || prev.location
          }
          return updated
        })
      }
      
      // Check if conversation is complete
      if (!data.shouldContinue && data.extractedData) {
        setConversationComplete(true)
        setTimeout(() => {
          addMessage("I have all the information I need. Let me find the best clinical trials for you...", 'assistant')
          setTimeout(() => createPatientAndMatch(), 2000)
        }, 1000)
      }
    } catch (error) {
      console.error('Chat error:', error)
      removeTypingMessage()
      addMessage("I'm having trouble processing that. Could you please rephrase?", 'assistant')
    } finally {
      setLoading(false)
    }
  }

  const createPatientAndMatch = async () => {
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      
      // For now, we'll need the user to provide email
      // In a real app, this would come from auth
      const email = patientData.email || 'test@example.com'
      
      const finalData = {
        email,
        age: patientData.age || 0,
        gender: patientData.gender || 'not specified',
        conditions: patientData.conditions || [],
        current_medications: patientData.medications || [],
        medical_history: `Symptoms: ${(patientData.symptoms || []).join(', ')}. Previous treatments: ${(patientData.previousTreatments || []).join(', ')}`,
        location: patientData.location || {
          country: 'USA',
          state: '',
          city: ''
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
          medicalHistory: finalData.medical_history,
          location: patient.location
        })
      })

      if (!response.ok) throw new Error('Failed to match trials')

      // Show success message
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const successMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Great news! I've found several clinical trials that match your profile. Redirecting you to your personalized matches..."
      }
      setMessages(prev => [...prev, successMessage])

      await new Promise(resolve => setTimeout(resolve, 2000))
      router.push(`/patient/${patient.id}/matches`)
    } catch (error) {
      console.error('Error:', error)
      addMessage("I'm sorry, there was an error processing your information. Please try again.", 'assistant')
      setIsSubmitting(false)
      setConversationComplete(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Find Your Clinical Trial Match</h1>
          <p className="text-lg text-gray-600">Have a natural conversation with our AI to find trials that match your needs</p>
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
                  placeholder={conversationComplete ? "Processing..." : "Type your message..."}
                  disabled={loading || isSubmitting || conversationComplete}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-full focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || isSubmitting || !input.trim() || conversationComplete}
                  className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
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