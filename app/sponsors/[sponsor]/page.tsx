'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Activity,
  AlertCircle,
  Target,
  Globe,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Eye,
  Zap,
  MapPin,
  Clock
} from 'lucide-react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement)

interface Trial {
  id: string
  trial_id: string
  title: string
  status: string
  phase: string
  conditions: string[]
  locations: any[]
  start_date: string
  completion_date: string
  compensation?: number
  urgency?: string
  boost_visibility?: boolean
  enrollment_target?: number
  current_enrollment?: number
}

interface PatientMatch {
  patient_id: string
  trial_id: string
  match_score: number
  patient_interest: boolean
  status: string
  patient: {
    age: number
    gender: string
    location: any
    conditions: string[]
  }
}

interface SponsorMetrics {
  totalTrials: number
  recruitingTrials: number
  completedTrials: number
  totalPatientMatches: number
  interestedPatients: number
  appliedPatients: number
  averageMatchScore: number
  enrollmentRate: number
}

export default function SponsorDashboard({ params }: { params: { sponsor: string } }) {
  const [loading, setLoading] = useState(true)
  const [trials, setTrials] = useState<Trial[]>([])
  const [patientMatches, setPatientMatches] = useState<PatientMatch[]>([])
  const [metrics, setMetrics] = useState<SponsorMetrics | null>(null)
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [selectedTrial, setSelectedTrial] = useState<string | null>(null)
  const [boostAmount, setBoostAmount] = useState<{ [key: string]: string }>({})

  const supabase = createClientComponentClient()
  const sponsorName = decodeURIComponent(params.sponsor)

  useEffect(() => {
    fetchSponsorData()
    fetchCompanyLogo()
  }, [params.sponsor])

  const fetchCompanyLogo = async () => {
    try {
      const response = await fetch(`/api/company-logo?company=${encodeURIComponent(sponsorName)}`)
      const data = await response.json()
      if (data.logoUrl) {
        setLogoUrl(data.logoUrl)
      }
    } catch (error) {
      console.error('Error fetching company logo:', error)
    }
  }

  const fetchSponsorData = async () => {
    try {
      // Fetch trials for this sponsor
      const { data: trialsData, error: trialsError } = await supabase
        .from('clinical_trials')
        .select('*')
        .eq('sponsor', sponsorName)
        .order('created_at', { ascending: false })

      if (trialsError) throw trialsError

      // Fetch all patient matches for these trials
      const trialIds = trialsData?.map(t => t.id) || []
      const { data: matchesData, error: matchesError } = await supabase
        .from('patient_trial_matches')
        .select(`
          *,
          patient:patients(*)
        `)
        .in('trial_id', trialIds)

      if (matchesError) throw matchesError

      setTrials(trialsData || [])
      setPatientMatches(matchesData || [])

      // Calculate metrics
      calculateMetrics(trialsData || [], matchesData || [])
    } catch (error) {
      console.error('Error fetching sponsor data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateMetrics = (trialsData: Trial[], matchesData: PatientMatch[]) => {
    const totalTrials = trialsData.length
    const recruitingTrials = trialsData.filter(t => t.status === 'recruiting').length
    const completedTrials = trialsData.filter(t => t.status === 'completed').length
    const totalPatientMatches = matchesData.length
    const interestedPatients = matchesData.filter(m => m.patient_interest).length
    const appliedPatients = matchesData.filter(m => m.status === 'applied').length
    const averageMatchScore = matchesData.length > 0 
      ? matchesData.reduce((sum, m) => sum + m.match_score, 0) / matchesData.length 
      : 0
    const enrollmentRate = totalPatientMatches > 0 ? (appliedPatients / totalPatientMatches) * 100 : 0

    setMetrics({
      totalTrials,
      recruitingTrials,
      completedTrials,
      totalPatientMatches,
      interestedPatients,
      appliedPatients,
      averageMatchScore,
      enrollmentRate
    })
  }

  const handleBoostTrial = async (trialId: string, type: 'compensation' | 'visibility') => {
    // In a real implementation, this would update the database
    console.log(`Boosting ${type} for trial ${trialId}`)
    if (type === 'compensation' && boostAmount[trialId]) {
      console.log(`New compensation: $${boostAmount[trialId]}`)
    }
  }

  const getTrialMetrics = (trialId: string) => {
    const trialMatches = patientMatches.filter(m => m.trial_id === trialId)
    return {
      totalMatches: trialMatches.length,
      interested: trialMatches.filter(m => m.patient_interest).length,
      applied: trialMatches.filter(m => m.status === 'applied').length,
      avgScore: trialMatches.length > 0 
        ? trialMatches.reduce((sum, m) => sum + m.match_score, 0) / trialMatches.length 
        : 0
    }
  }

  const getPatientDemographics = () => {
    const demographics = {
      ageGroups: {
        '18-30': 0,
        '31-45': 0,
        '46-60': 0,
        '60+': 0
      },
      gender: {
        male: 0,
        female: 0,
        other: 0
      },
      conditions: {} as Record<string, number>
    }

    patientMatches.forEach(match => {
      const age = match.patient.age
      if (age >= 18 && age <= 30) demographics.ageGroups['18-30']++
      else if (age >= 31 && age <= 45) demographics.ageGroups['31-45']++
      else if (age >= 46 && age <= 60) demographics.ageGroups['46-60']++
      else if (age > 60) demographics.ageGroups['60+']++

      const gender = match.patient.gender?.toLowerCase()
      if (gender === 'male') demographics.gender.male++
      else if (gender === 'female') demographics.gender.female++
      else demographics.gender.other++

      match.patient.conditions.forEach(condition => {
        demographics.conditions[condition] = (demographics.conditions[condition] || 0) + 1
      })
    })

    return demographics
  }

  const demographics = getPatientDemographics()

  // Chart configurations
  const enrollmentChartData = {
    labels: trials.slice(0, 6).map(t => t.title.substring(0, 30) + '...'),
    datasets: [
      {
        label: 'Patient Interest',
        data: trials.slice(0, 6).map(t => getTrialMetrics(t.id).interested),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2
      },
      {
        label: 'Applied',
        data: trials.slice(0, 6).map(t => getTrialMetrics(t.id).applied),
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2
      }
    ]
  }

  const ageDistributionData = {
    labels: Object.keys(demographics.ageGroups),
    datasets: [{
      data: Object.values(demographics.ageGroups),
      backgroundColor: [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)'
      ],
      borderWidth: 1
    }]
  }

  const conditionDistributionData = {
    labels: Object.keys(demographics.conditions).slice(0, 5),
    datasets: [{
      label: 'Patient Conditions',
      data: Object.values(demographics.conditions).slice(0, 5),
      backgroundColor: 'rgba(153, 102, 255, 0.5)',
      borderColor: 'rgba(153, 102, 255, 1)',
      borderWidth: 1
    }]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {logoUrl && (
                <img 
                  src={logoUrl} 
                  alt={`${sponsorName} logo`}
                  className="h-16 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{sponsorName}</h1>
                <p className="text-gray-600">Clinical Trials Dashboard</p>
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Activity className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Trials</CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalTrials}</div>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <Badge variant="secondary" className="mr-2">
                  {metrics?.recruitingTrials} Recruiting
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Patient Matches</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalPatientMatches}</div>
              <div className="flex items-center text-sm mt-1">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">+23% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Interest Rate</CardTitle>
              <Target className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.totalPatientMatches 
                  ? Math.round((metrics.interestedPatients / metrics.totalPatientMatches) * 100)
                  : 0}%
              </div>
              <Progress 
                value={metrics?.totalPatientMatches 
                  ? (metrics.interestedPatients / metrics.totalPatientMatches) * 100
                  : 0} 
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Enrollment Rate</CardTitle>
              <Activity className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(metrics?.enrollmentRate || 0)}%</div>
              <div className="text-sm text-gray-600 mt-1">
                {metrics?.appliedPatients} patients enrolled
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Patient Interest by Trial</CardTitle>
              <CardDescription>Top 6 trials by patient engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <Bar data={enrollmentChartData} options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Patient Age Distribution</CardTitle>
              <CardDescription>Demographics of interested patients</CardDescription>
            </CardHeader>
            <CardContent>
              <Doughnut data={ageDistributionData} options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'right' as const,
                  }
                }
              }} />
            </CardContent>
          </Card>
        </div>

        {/* Trials Management Section */}
        <Card>
          <CardHeader>
            <CardTitle>Active Trials Management</CardTitle>
            <CardDescription>Monitor and boost your clinical trials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trials.map((trial) => {
                const trialMetrics = getTrialMetrics(trial.id)
                const enrollmentProgress = trial.enrollment_target 
                  ? (trial.current_enrollment || 0) / trial.enrollment_target * 100
                  : 0

                return (
                  <div key={trial.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{trial.title}</h3>
                          <Badge variant={trial.status === 'recruiting' ? 'default' : 'secondary'}>
                            {trial.status}
                          </Badge>
                          {trial.urgency === 'high' && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Urgent
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-gray-600">Matches</p>
                            <p className="font-semibold">{trialMetrics.totalMatches}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Interested</p>
                            <p className="font-semibold text-blue-600">{trialMetrics.interested}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Applied</p>
                            <p className="font-semibold text-green-600">{trialMetrics.applied}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Match Score</p>
                            <p className="font-semibold">{Math.round(trialMetrics.avgScore)}%</p>
                          </div>
                        </div>

                        {trial.enrollment_target && (
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Enrollment Progress</span>
                              <span className="font-medium">
                                {trial.current_enrollment || 0} / {trial.enrollment_target}
                              </span>
                            </div>
                            <Progress value={enrollmentProgress} className="h-2" />
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4" />
                          <span>{trial.locations?.length || 0} locations</span>
                          <Clock className="h-4 w-4 ml-4" />
                          <span>Phase {trial.phase}</span>
                          {trial.compensation && (
                            <>
                              <DollarSign className="h-4 w-4 ml-4" />
                              <span>${trial.compensation} compensation</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 space-y-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleBoostTrial(trial.id, 'visibility')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Boost Visibility
                        </Button>
                        
                        {trial.status === 'recruiting' && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Amount"
                              className="w-24 h-8"
                              value={boostAmount[trial.id] || ''}
                              onChange={(e) => setBoostAmount({
                                ...boostAmount,
                                [trial.id]: e.target.value
                              })}
                            />
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => handleBoostTrial(trial.id, 'compensation')}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Boost Pay
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Patient Insights */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Patient Insights</CardTitle>
            <CardDescription>Understanding your patient demographics and conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Top Conditions in Matched Patients</h4>
                <Bar data={conditionDistributionData} options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }} />
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Geographic Distribution</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="flex items-center">
                      <Globe className="h-4 w-4 mr-2 text-gray-600" />
                      United States
                    </span>
                    <span className="font-medium">78%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="flex items-center">
                      <Globe className="h-4 w-4 mr-2 text-gray-600" />
                      Canada
                    </span>
                    <span className="font-medium">12%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="flex items-center">
                      <Globe className="h-4 w-4 mr-2 text-gray-600" />
                      United Kingdom
                    </span>
                    <span className="font-medium">6%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="flex items-center">
                      <Globe className="h-4 w-4 mr-2 text-gray-600" />
                      Other
                    </span>
                    <span className="font-medium">4%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>AI-Powered Recommendations</CardTitle>
            <CardDescription>Insights to improve your trial recruitment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Boost compensation for NCT12345678</p>
                  <p className="text-sm text-blue-700">This trial has high interest but low application rate. Consider increasing compensation by $500-$1000.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <Target className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Expand locations for diabetes trials</p>
                  <p className="text-sm text-green-700">68% of interested patients are outside your current trial locations. Consider adding sites in Texas and Florida.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                <Users className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-900">Target younger demographics</p>
                  <p className="text-sm text-purple-700">Your trials attract mainly 45+ patients. Consider social media campaigns to reach 25-35 age group.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}