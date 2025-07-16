'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle, Send } from 'lucide-react';

interface EligibilityCheckerProps {
  trialId: string;
  trialTitle: string;
  conditions: string[];
}

export function EligibilityChecker({ trialId, trialTitle, conditions }: EligibilityCheckerProps) {
  const [step, setStep] = useState<'quick' | 'detailed' | 'results'>('quick');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  // Quick check form
  const [quickInfo, setQuickInfo] = useState({
    age: '',
    condition: conditions[0] || '',
    location: ''
  });

  // Detailed profile
  const [profile, setProfile] = useState({
    age: '',
    gender: '',
    conditions: [] as string[],
    medications: [] as string[],
    medicalHistory: ''
  });

  const handleQuickCheck = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/check-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quick_check',
          data: {
            trial_id: trialId,
            patient_info: quickInfo
          }
        })
      });

      const data = await response.json();
      setResults(data);
      setStep('results');
    } catch (error) {
      console.error('Quick check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDetailedCheck = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/check-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'detailed_match',
          data: {
            trial_id: trialId,
            patient_profile: profile
          }
        })
      });

      const data = await response.json();
      setResults(data);
      setStep('results');
    } catch (error) {
      console.error('Detailed check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/check-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_question',
          data: {
            trial_id: trialId,
            question
          }
        })
      });

      const data = await response.json();
      setAnswer(data.answer);
    } catch (error) {
      console.error('Question failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Do I Qualify for This Trial?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Check your eligibility for: {trialTitle}
        </p>
      </CardHeader>
      <CardContent>
        {step === 'quick' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="age">Your Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="Enter your age"
                value={quickInfo.age}
                onChange={(e) => setQuickInfo({ ...quickInfo, age: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="condition">Your Condition</Label>
              <select
                id="condition"
                className="w-full p-2 border rounded"
                value={quickInfo.condition}
                onChange={(e) => setQuickInfo({ ...quickInfo, condition: e.target.value })}
              >
                {conditions.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
                <option value="other">Other condition</option>
              </select>
            </div>

            <div>
              <Label htmlFor="location">Your Location (City or State)</Label>
              <Input
                id="location"
                placeholder="e.g., Boston or MA"
                value={quickInfo.location}
                onChange={(e) => setQuickInfo({ ...quickInfo, location: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleQuickCheck} 
                disabled={loading}
                className="flex-1"
              >
                Quick Check
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setStep('detailed')}
                className="flex-1"
              >
                Detailed Assessment
              </Button>
            </div>
          </div>
        )}

        {step === 'detailed' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Provide more details for a comprehensive eligibility assessment.
                Your information is kept confidential.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="det-age">Age</Label>
                <Input
                  id="det-age"
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  className="w-full p-2 border rounded"
                  value={profile.gender}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="conditions">Medical Conditions (one per line)</Label>
              <Textarea
                id="conditions"
                placeholder="e.g., Type 2 diabetes&#10;High blood pressure"
                rows={3}
                onChange={(e) => setProfile({ 
                  ...profile, 
                  conditions: e.target.value.split('\n').filter(c => c.trim())
                })}
              />
            </div>

            <div>
              <Label htmlFor="medications">Current Medications (one per line)</Label>
              <Textarea
                id="medications"
                placeholder="e.g., Metformin 1000mg&#10;Lisinopril 10mg"
                rows={3}
                onChange={(e) => setProfile({ 
                  ...profile, 
                  medications: e.target.value.split('\n').filter(m => m.trim())
                })}
              />
            </div>

            <div>
              <Label htmlFor="history">Relevant Medical History</Label>
              <Textarea
                id="history"
                placeholder="Any other relevant medical information..."
                rows={2}
                value={profile.medicalHistory}
                onChange={(e) => setProfile({ ...profile, medicalHistory: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleDetailedCheck} 
                disabled={loading}
                className="flex-1"
              >
                Check Eligibility
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setStep('quick')}
                className="flex-1"
              >
                Back to Quick Check
              </Button>
            </div>
          </div>
        )}

        {step === 'results' && results && (
          <div className="space-y-4">
            {/* Quick check results */}
            {results.quickChecks && (
              <div className="space-y-2">
                {results.quickChecks.map((check: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2">
                    {check.qualifies ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <span className="text-sm">{check.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Detailed match results */}
            {results.status && (
              <Alert className={
                results.status === 'likely_eligible' ? 'border-green-500' :
                results.status === 'possibly_eligible' ? 'border-yellow-500' :
                'border-red-500'
              }>
                <AlertDescription>
                  <strong>Status:</strong> {results.status.replace('_', ' ').toUpperCase()}
                  <br />
                  {results.explanation}
                </AlertDescription>
              </Alert>
            )}

            {/* Recommendations */}
            {results.recommendations && (
              <div>
                <h4 className="font-semibold mb-2">Recommended Next Steps:</h4>
                <ul className="space-y-1">
                  {results.recommendations.map((rec: any, idx: number) => (
                    <li key={idx} className="text-sm">
                      • {rec.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ask a question */}
            <div className="border-t pt-4">
              <Label>Have a specific question about this trial?</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="e.g., Do I need to stop my current medications?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                />
                <Button onClick={handleAskQuestion} disabled={loading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {answer && (
                <Alert className="mt-2">
                  <AlertDescription>{answer}</AlertDescription>
                </Alert>
              )}
            </div>

            <Button 
              variant="outline" 
              onClick={() => {
                setStep('quick');
                setResults(null);
                setAnswer('');
              }}
              className="w-full"
            >
              Check Another Trial
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}