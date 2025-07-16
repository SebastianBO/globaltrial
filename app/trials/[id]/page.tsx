'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notFound, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Calendar, Building2, Users, MapPin, Info, Phone, Mail, Globe, Heart, Shield, Clock, Activity, CheckCircle, AlertCircle, DollarSign, ExternalLink } from 'lucide-react'
import Navigation from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function TrialDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [trial, setTrial] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchTrial() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('clinical_trials')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error || !data) {
        notFound()
      }
      
      setTrial(data)
      setLoading(false)
    }
    
    fetchTrial()
  }, [id])
  
  if (loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    )
  }
  
  if (!trial) {
    notFound()
  }

  const eligibility = trial.eligibility_criteria as { gender?: string; minAge?: string; maxAge?: string; criteria?: string }
  const locations = trial.locations as { facility?: string; city?: string; state?: string; country?: string; status?: string }[]
  const contactInfo = trial.contact_info as { centralContact?: { name?: string; phone?: string; email?: string } }
  const compensation = trial.compensation as { amount?: number; per_visit?: number; currency?: string; description?: string; additional_benefits?: string[]; visits_estimated?: number }

  const isHighPriority = trial.urgency === 'critical' || (compensation && compensation.amount > 500) || 
                       (trial.conditions && trial.conditions.some((c: string) => 
                         c.toLowerCase().includes('cancer') || 
                         c.toLowerCase().includes('alzheimer') ||
                         c.toLowerCase().includes('parkinson')))

  // Parse eligibility criteria into inclusion/exclusion
  const parseEligibilityCriteria = (criteria: string | undefined) => {
    if (!criteria) return { inclusion: [], exclusion: [] }
    
    const lines = criteria.split('\n').filter(line => line.trim())
    const inclusion: string[] = []
    const exclusion: string[] = []
    let currentSection = 'inclusion'
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('exclusion')) {
        currentSection = 'exclusion'
      } else if (line.toLowerCase().includes('inclusion')) {
        currentSection = 'inclusion'
      } else if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
        const cleanLine = line.trim().replace(/^[•\-\*]\s*/, '')
        if (currentSection === 'inclusion') {
          inclusion.push(cleanLine)
        } else {
          exclusion.push(cleanLine)
        }
      }
    })
    
    return { inclusion, exclusion }
  }

  const { inclusion: inclusionCriteria, exclusion: exclusionCriteria } = parseEligibilityCriteria(eligibility?.criteria)

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/trials">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Trials
            </Link>
          </Button>

          <div className="space-y-6">
            {/* Header Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      {isHighPriority && (
                        <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
                          HIGH PRIORITY
                        </Badge>
                      )}
                      <Badge 
                        variant="secondary" 
                        className="bg-green-100 text-green-800 hover:bg-green-200"
                      >
                        {trial.status}
                      </Badge>
                      {trial.phase && trial.phase !== 'NA' && (
                        <Badge variant="outline">Phase {trial.phase}</Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl mb-2">{trial.title}</CardTitle>
                    <p className="text-muted-foreground">Study ID: {trial.trial_id}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Compensation Highlight */}
                {compensation && (compensation.amount > 0 || compensation.per_visit > 0) && (
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-6 w-6 text-green-600" />
                      <div>
                        <span className="text-xl font-bold text-green-800 dark:text-green-200">
                          ${compensation.amount?.toLocaleString() || '0'} {compensation.currency || 'USD'}
                        </span>
                        {compensation.per_visit > 0 && (
                          <span className="text-sm text-green-600 dark:text-green-400 ml-3">
                            ${compensation.per_visit} per visit • ~{compensation.visits_estimated || 10} visits
                          </span>
                        )}
                      </div>
                    </div>
                    {compensation.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{compensation.description}</p>
                    )}
                  </div>
                )}
                
                {/* Quick Info Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Sponsor</p>
                      <p className="font-medium">{trial.sponsor || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Completion</p>
                      <p className="font-medium">
                        {trial.completion_date ? new Date(trial.completion_date).toLocaleDateString() : 'Not specified'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Locations</p>
                      <p className="font-medium">{locations?.length || 0} sites</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Eligibility</p>
                      <p className="font-medium">
                        {eligibility?.gender || 'All'}, {eligibility?.minAge || 'Any'} - {eligibility?.maxAge || 'Any'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Study Description */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Study Description
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {trial.layman_description && (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Heart className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                          In Simple Terms
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          {trial.layman_description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="font-medium mb-2">Medical Description</h4>
                  <p className="text-muted-foreground whitespace-pre-line">{trial.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Conditions & Interventions */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {trial.conditions?.map((condition: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Interventions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {trial.interventions?.length > 0 ? (
                      trial.interventions.map((intervention: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-sm">
                          {intervention}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Eligibility Criteria */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Eligibility Criteria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Inclusion Criteria
                    </h4>
                    <ul className="space-y-2">
                      {inclusionCriteria.length > 0 ? (
                        inclusionCriteria.map((criteria, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-green-600 mt-1">•</span>
                            {criteria}
                          </li>
                        ))
                      ) : eligibility?.criteria ? (
                        <li className="text-sm text-muted-foreground">
                          See detailed criteria below
                        </li>
                      ) : (
                        <li className="text-sm text-muted-foreground">
                          No specific inclusion criteria listed
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Exclusion Criteria
                    </h4>
                    <ul className="space-y-2">
                      {exclusionCriteria.length > 0 ? (
                        exclusionCriteria.map((criteria, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-red-600 mt-1">•</span>
                            {criteria}
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-muted-foreground">
                          No specific exclusion criteria listed
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
                
                {eligibility?.criteria && inclusionCriteria.length === 0 && exclusionCriteria.length === 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-medium mb-2">Detailed Criteria</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {eligibility.criteria}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Study Locations */}
            {locations && locations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Study Locations ({locations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {locations.map((location, idx) => (
                      <div key={idx} className="bg-muted rounded-lg p-4">
                        <p className="font-medium">{location.facility}</p>
                        <p className="text-sm text-muted-foreground">
                          {location.city}{location.state && `, ${location.state}`}, {location.country}
                        </p>
                        {location.status && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {location.status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            {contactInfo?.centralContact && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="font-medium mb-3">
                      {contactInfo.centralContact.name || 'Central Contact'}
                    </p>
                    <div className="space-y-2">
                      {contactInfo.centralContact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{contactInfo.centralContact.phone}</span>
                        </div>
                      )}
                      {contactInfo.centralContact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{contactInfo.centralContact.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" className="flex-1 bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href="/patient">
                      Check If You Match
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1" asChild>
                    <a 
                      href={`https://clinicaltrials.gov/study/${trial.trial_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on ClinicalTrials.gov
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}