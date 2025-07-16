'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import Navigation from '@/components/navigation'
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
  Clock,
  Building2,
  Plus
} from 'lucide-react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import Image from 'next/image'
import Link from 'next/link'

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
  compensation?: any
  urgency?: string
  boost_visibility?: boolean
  enrollment_target?: number
  current_enrollment?: number
}

interface PatientMatch {
  patient_id: string
  trial_id: string
  match_score: number
  created_at: string
}

export default function SponsorDashboard({ params }: { params: { sponsor: string } }) {
  const [trials, setTrials] = useState<Trial[]>([])
  const [matches, setMatches] = useState<PatientMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalTrials: 0,
    recruitingTrials: 0,
    totalMatches: 0,
    averageMatchScore: 0,
    enrollmentRate: 0
  })
  const [patientDemographics, setPatientDemographics] = useState({
    ageGroups: [] as { age: string, count: number }[],
    genders: [] as { gender: string, count: number }[],
    conditions: [] as { condition: string, count: number }[]
  })
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [selectedTrial, setSelectedTrial] = useState<string | null>(null)
  const [boostAmount, setBoostAmount] = useState<{ [key: string]: string }>({})

  const supabase = createClientComponentClient()
  const sponsorName = decodeURIComponent(params.sponsor)

  useEffect(() => {
    fetchSponsorData()
    fetchCompanyLogo()
  }, [sponsorName])

  const fetchCompanyLogo = async () => {
    try {
      const response = await fetch(`/api/company-logo?company=${encodeURIComponent(sponsorName)}`)
      if (response.ok) {
        const data = await response.json()
        setLogoUrl(data.primaryLogo)
      }
    } catch (error) {
      console.error('Failed to fetch company logo:', error)
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

      setTrials(trialsData || [])

      // Calculate stats
      const recruiting = trialsData?.filter(t => t.status === 'recruiting').length || 0
      const totalEnrollmentTarget = trialsData?.reduce((sum, t) => sum + (t.enrollment_target || 0), 0) || 0
      const currentEnrollment = trialsData?.reduce((sum, t) => sum + (t.current_enrollment || 0), 0) || 0

      // Fetch patient matches for all trials
      const trialIds = trialsData?.map(t => t.id) || []
      if (trialIds.length > 0) {
        const { data: matchesData, error: matchesError } = await supabase
          .from('patient_trial_matches')
          .select('*')
          .in('trial_id', trialIds)

        if (matchesError) throw matchesError

        setMatches(matchesData || [])

        const avgScore = matchesData?.reduce((sum, m) => sum + m.match_score, 0) / (matchesData?.length || 1) || 0

        setStats({
          totalTrials: trialsData?.length || 0,
          recruitingTrials: recruiting,
          totalMatches: matchesData?.length || 0,
          averageMatchScore: avgScore,
          enrollmentRate: totalEnrollmentTarget > 0 ? (currentEnrollment / totalEnrollmentTarget) * 100 : 0
        })

        // Mock patient demographics (in real app, would fetch from patient data)
        setPatientDemographics({
          ageGroups: [
            { age: '18-30', count: 23 },
            { age: '31-45', count: 45 },
            { age: '46-60', count: 67 },
            { age: '60+', count: 34 }
          ],
          genders: [
            { gender: 'Male', count: 87 },
            { gender: 'Female', count: 82 }
          ],
          conditions: trialsData?.flatMap(t => t.conditions || [])
            .reduce((acc: any[], condition) => {
              const existing = acc.find(c => c.condition === condition)
              if (existing) {
                existing.count++
              } else {
                acc.push({ condition, count: 1 })
              }
              return acc
            }, [])
            .sort((a, b) => b.count - a.count)
            .slice(0, 5) || []
        })
      }

      setLoading(false)
    } catch (error) {
      console.error('Error fetching sponsor data:', error)
      setLoading(false)
    }
  }

  const handleBoostTrial = async (trialId: string) => {
    const amount = parseFloat(boostAmount[trialId] || '0')
    if (amount <= 0) return

    try {
      const { error } = await supabase
        .from('clinical_trials')
        .update({ 
          boost_visibility: true,
          compensation: { 
            amount: amount,
            currency: 'USD'
          }
        })
        .eq('id', trialId)

      if (error) throw error

      alert('Trial visibility boosted successfully!')
      fetchSponsorData()
    } catch (error) {
      console.error('Error boosting trial:', error)
      alert('Failed to boost trial visibility')
    }
  }

  // Chart data
  const patientInterestData = {
    labels: trials.slice(0, 5).map(t => t.trial_id),
    datasets: [{
      label: 'Patient Interest',
      data: trials.slice(0, 5).map((t, i) => matches.filter(m => m.trial_id === t.id).length),
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
      borderColor: 'rgb(59, 130, 246)',
      borderWidth: 1
    }]
  }

  const ageDistributionData = {
    labels: patientDemographics.ageGroups.map(g => g.age),
    datasets: [{
      data: patientDemographics.ageGroups.map(g => g.count),
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
    labels: patientDemographics.conditions.map(c => c.condition),
    datasets: [{
      label: 'Number of Trials',
      data: patientDemographics.conditions.map(c => c.count),
      backgroundColor: 'rgba(34, 197, 94, 0.5)',
      borderColor: 'rgb(34, 197, 94)',
      borderWidth: 1
    }]
  }

  if (loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sponsor data...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <div className="relative w-16 h-16">
                      <Image
                        src={logoUrl}
                        alt={`${sponsorName} logo`}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{sponsorName}</h1>
                    <p className="text-gray-600">Sponsor Dashboard</p>
                  </div>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/trials/new" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    New Trial
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Trials</CardTitle>
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTrials}</p>
                <span className="text-sm text-gray-500">All time</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">Recruiting</CardTitle>
                  <Activity className="w-4 h-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{stats.recruitingTrials}</p>
                <div className="flex items-center gap-1 text-sm">
                  <ArrowUp className="w-3 h-3 text-green-500" />
                  <span className="text-green-500">Active</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">Patient Matches</CardTitle>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMatches}</p>
                <span className="text-sm text-gray-500">Total interested</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">Match Score</CardTitle>
                  <Target className="w-4 h-4 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{stats.averageMatchScore.toFixed(1)}%</p>
                <span className="text-sm text-gray-500">Average</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">Enrollment</CardTitle>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{stats.enrollmentRate.toFixed(0)}%</p>
                <Progress value={stats.enrollmentRate} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Patient Interest by Trial</CardTitle>
              </CardHeader>
              <CardContent>
                <Bar data={patientInterestData} options={{ responsive: true, maintainAspectRatio: false }} height={200} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Age Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <Doughnut data={ageDistributionData} options={{ responsive: true, maintainAspectRatio: false }} height={200} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <Bar data={conditionDistributionData} options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y' }} height={200} />
              </CardContent>
            </Card>
          </div>

          {/* Trials Table */}
          <Card>
            <CardHeader>
              <CardTitle>Your Clinical Trials</CardTitle>
              <CardDescription>Manage and monitor your active trials</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trial</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {trials.map((trial) => {
                      const trialMatches = matches.filter(m => m.trial_id === trial.id).length
                      const enrollmentPercent = trial.enrollment_target 
                        ? ((trial.current_enrollment || 0) / trial.enrollment_target) * 100 
                        : 0

                      return (
                        <tr key={trial.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{trial.trial_id}</p>
                              <p className="text-sm text-gray-500 line-clamp-1">{trial.title}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={trial.status === 'recruiting' ? 'default' : 'secondary'}>
                              {trial.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            Phase {trial.phase || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span>{trial.current_enrollment || 0}/{trial.enrollment_target || '?'}</span>
                                  <span className="text-gray-500">{enrollmentPercent.toFixed(0)}%</span>
                                </div>
                                <Progress value={enrollmentPercent} className="mt-1" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium">{trialMatches}</span>
                              {trial.urgency === 'critical' && (
                                <Badge variant="destructive" className="ml-2">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Critical
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/trials/${trial.id}`}>
                                  View
                                </Link>
                              </Button>
                              {!trial.boost_visibility && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={boostAmount[trial.id] || ''}
                                    onChange={(e) => setBoostAmount({
                                      ...boostAmount,
                                      [trial.id]: e.target.value
                                    })}
                                    className="w-20 h-8"
                                  />
                                  <Button
                                    onClick={() => handleBoostTrial(trial.id)}
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <Zap className="w-3 h-3 mr-1" />
                                    Boost
                                  </Button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="mt-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">AI Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 mt-0.5" />
                  <span>Consider increasing compensation for trials with low enrollment rates</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  <span>Expand trial locations to areas with high patient interest</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5" />
                  <span>3 trials have been recruiting for over 6 months - consider adjusting criteria</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}