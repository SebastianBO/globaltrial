import { createClient } from '@/lib/supabase/server'
import { Calendar, Building2, MapPin, Info, DollarSign, AlertCircle, Clock, Users, Activity, ArrowRight, Target, Shield } from 'lucide-react'
import Link from 'next/link'
import Navigation from '@/components/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function TrialsPage() {
  const supabase = await createClient()
  
  let { data: trials, count, error } = await supabase
    .from('clinical_trials')
    .select('*', { count: 'exact' })
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching trials:', error)
  }
  
  // If no recruiting trials found, try to get any active trials
  if (!trials || trials.length === 0) {
    const fallback = await supabase
      .from('clinical_trials')
      .select('*', { count: 'exact' })
      .or('status.eq.recruiting,status.eq.active')
      .order('created_at', { ascending: false })
      .limit(20)
    
    trials = fallback.data
    count = fallback.count
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-b from-blue-50 to-background py-12">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-4">Active Clinical Trials</h1>
              <p className="text-xl text-muted-foreground">
                Found <span className="font-semibold text-blue-600">{count || 0}</span> recruiting clinical trials. 
                Showing the most recent 20.
              </p>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-6">
            {trials?.map((trial) => {
              const eligibility = trial.eligibility_criteria as { gender?: string; minAge?: string; maxAge?: string; criteria?: string }
              const locations = trial.locations as { facility?: string; city?: string; state?: string; country?: string; status?: string }[]
              const compensation = trial.compensation as { amount?: number; per_visit?: number; currency?: string; description?: string; additional_benefits?: string[]; visits_estimated?: number }
              const isHighPriority = trial.urgency === 'critical' || (compensation && compensation.amount > 500) || 
                                   (trial.conditions && trial.conditions.some((c: string) => 
                                     c.toLowerCase().includes('cancer') || 
                                     c.toLowerCase().includes('alzheimer') ||
                                     c.toLowerCase().includes('parkinson')))
              
              return (
                <Card key={trial.id} className="w-full hover:shadow-lg transition-shadow duration-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
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
                        </div>
                        <h3 className="text-lg font-semibold text-foreground leading-tight">
                          {trial.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">ID: {trial.trial_id}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Compensation Badge */}
                    {compensation && (compensation.amount > 0 || compensation.per_visit > 0) && (
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          <span className="font-semibold text-green-800 dark:text-green-200">
                            ${compensation.amount?.toLocaleString() || '0'} {compensation.currency || 'USD'}
                          </span>
                          {compensation.per_visit > 0 && (
                            <span className="text-sm text-green-600 dark:text-green-400">
                              • ${compensation.per_visit} per visit • ~{compensation.visits_estimated || 10} visits
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {trial.description}
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-1">Conditions</h4>
                        <div className="flex flex-wrap gap-1">
                          {trial.conditions?.map((condition: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {trial.interventions && trial.interventions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-1">Interventions</h4>
                          <div className="flex flex-wrap gap-1">
                            {trial.interventions.slice(0, 3).map((intervention: string, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {intervention}
                              </Badge>
                            ))}
                            {trial.interventions.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{trial.interventions.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="text-muted-foreground">
                            {eligibility?.gender || 'All'}, {eligibility?.minAge || 'Any age'} - {eligibility?.maxAge || 'Any age'}
                          </span>
                        </div>
                        
                        {locations && locations.length > 0 && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-600" />
                            <span className="text-muted-foreground">
                              {locations[0].city}, {locations[0].state || locations[0].country}
                              {locations.length > 1 && ` +${locations.length - 1} more`}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          <span className="text-muted-foreground">{trial.sponsor || 'Not specified'}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-blue-600" />
                          <span className="text-muted-foreground">Phase {trial.phase || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                      <Link href={`/trials/${trial.id}`}>
                        View Details & Apply
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}