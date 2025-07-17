'use client';

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Send, 
  MessageCircle, 
  User, 
  Bot, 
  Loader2, 
  CheckCircle, 
  FileText,
  Activity,
  MapPin,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PatientData {
  conditions?: string[];
  medications?: string[];
  symptoms?: string[];
  age?: number;
  gender?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  urgency?: 'low' | 'medium' | 'high';
  compensationInterest?: boolean;
  isComplete?: boolean;
}

interface AITrialMatch {
  nct_id: string;
  title: string;
  match_score: number;
  reasoning: string;
  eligibility_summary: string;
  concerns?: string[];
  next_steps?: string;
}

export default function AIChat() {
  const [patientData, setPatientData] = useState<PatientData>({});
  const [showDataExtraction, setShowDataExtraction] = useState(false);
  const [extractedData, setExtractedData] = useState<PatientData | null>(null);
  const [matchedTrials, setMatchedTrials] = useState<AITrialMatch[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [phase, setPhase] = useState<'conversation' | 'extraction' | 'matching' | 'complete'>('conversation');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    reload,
    setMessages
  } = useChat({
    api: '/api/ai-chat',
    initialMessages: [{
      id: 'initial',
      role: 'assistant',
      content: `Hello! I'm Emily, a medical intake specialist here at GlobalTrials. I'm so glad you're interested in exploring clinical trials as an option for your health. 

Can you tell me a little bit about what's been bringing you to our clinical trials marketplace today? What's been your main health concern lately?`
    }],
    body: {
      mode: phase
    },
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === 'extractPatientData') {
        const data = toolCall.args as PatientData;
        setExtractedData(data);
        setPatientData(prev => ({ ...prev, ...data }));
        
        if (data.isComplete) {
          setPhase('extraction');
          setShowDataExtraction(true);
        }
      }
      
      if (toolCall.toolName === 'searchTrials' || toolCall.toolName === 'trialMatches') {
        const results = toolCall.result;
        if (results.matches) {
          setMatchedTrials(results.matches);
          setPhase('complete');
        }
      }
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleExtractData = async () => {
    setShowDataExtraction(false);
    
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          mode: 'extract'
        })
      });

      if (response.ok) {
        setPhase('matching');
        await findMatchingTrials();
      }
    } catch (error) {
      console.error('Error extracting data:', error);
    }
  };

  const findMatchingTrials = async () => {
    setIsMatching(true);
    
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'match',
          patientData: extractedData
        })
      });

      if (response.ok) {
        // Matches will be handled by onToolCall
        setPhase('complete');
      }
    } catch (error) {
      console.error('Error matching trials:', error);
    } finally {
      setIsMatching(false);
    }
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getUrgencyIcon = (urgency?: string) => {
    switch (urgency) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <MessageCircle className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">AI Clinical Trial Assistant</h1>
        </div>
        <p className="text-gray-600">
          Let Emily help you find the perfect clinical trial for your health needs
        </p>
        
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className={`flex items-center gap-2 ${phase === 'conversation' ? 'text-blue-600' : 'text-green-600'}`}>
            <div className={`w-3 h-3 rounded-full ${phase === 'conversation' ? 'bg-blue-600 animate-pulse' : 'bg-green-600'}`} />
            <span className="text-sm font-medium">Conversation</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 ${['extraction', 'matching', 'complete'].includes(phase) ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-3 h-3 rounded-full ${['extraction', 'matching', 'complete'].includes(phase) ? 'bg-green-600' : 'bg-gray-200'}`} />
            <span className="text-sm font-medium">Matching</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 ${phase === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-3 h-3 rounded-full ${phase === 'complete' ? 'bg-green-600' : 'bg-gray-200'}`} />
            <span className="text-sm font-medium">Results</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Bot className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                    )}
                    
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    {message.role === 'user' && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-gray-600">Emily is typing...</span>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Type your message..."
                  disabled={isLoading || phase !== 'conversation'}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || !input.trim() || phase !== 'conversation'}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Extracted Data */}
          {extractedData && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold">Your Information</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                {extractedData.conditions && extractedData.conditions.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Conditions:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {extractedData.conditions.map((condition, idx) => (
                        <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {condition}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {extractedData.symptoms && extractedData.symptoms.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Symptoms:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {extractedData.symptoms.map((symptom, idx) => (
                        <span key={idx} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {extractedData.age && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span>Age: {extractedData.age}</span>
                  </div>
                )}
                
                {extractedData.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>
                      {[extractedData.location.city, extractedData.location.state, extractedData.location.country]
                        .filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                
                {extractedData.urgency && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className={getUrgencyColor(extractedData.urgency)}>
                      {getUrgencyIcon(extractedData.urgency)} {extractedData.urgency} urgency
                    </span>
                  </div>
                )}
              </div>
              
              {showDataExtraction && (
                <div className="mt-4 pt-4 border-t">
                  <Button 
                    onClick={handleExtractData} 
                    className="w-full"
                    disabled={isMatching}
                  >
                    {isMatching ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Finding Trials...
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4 mr-2" />
                        Find Matching Trials
                      </>
                    )}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Trial Matches */}
          {matchedTrials.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold">Trial Matches</h3>
              </div>
              
              <div className="space-y-3">
                {matchedTrials.slice(0, 3).map((match, idx) => (
                  <div key={match.nct_id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">{match.nct_id}</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          match.match_score >= 0.8 ? 'bg-green-500' :
                          match.match_score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="text-xs text-gray-600">
                          {Math.round(match.match_score * 100)}% match
                        </span>
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      {match.title}
                    </h4>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {match.reasoning}
                    </p>
                  </div>
                ))}
                
                {matchedTrials.length > 3 && (
                  <Button variant="outline" size="sm" className="w-full">
                    View All {matchedTrials.length} Matches
                  </Button>
                )}
              </div>
            </Card>
          )}
          
          {/* Actions */}
          <Card className="p-4">
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => reload()}
                className="w-full"
              >
                Start New Conversation
              </Button>
              
              {phase === 'complete' && (
                <Button size="sm" className="w-full">
                  View All Matches
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}