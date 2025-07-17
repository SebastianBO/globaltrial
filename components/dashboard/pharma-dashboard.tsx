'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  Users, 
  Search, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Mail, 
  Phone,
  BarChart3,
  Filter,
  Download,
  Settings,
  Crown,
  Zap,
  Target,
  Globe,
  Clock,
  CheckCircle,
  AlertTriangle,
  PlusCircle,
  FileText,
  Eye,
  MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';

interface PharmaDashboardProps {
  user: any;
  profile: any;
}

interface PatientLead {
  id: string;
  patient_id: string;
  trial_interest: string[];
  match_score: number;
  location: {
    city: string;
    state?: string;
    country: string;
  };
  demographics: {
    age?: number;
    gender?: string;
  };
  medical_profile: {
    conditions: string[];
    medications: string[];
  };
  engagement_score: number;
  last_active: string;
  contact_status: 'new' | 'contacted' | 'responded' | 'qualified' | 'enrolled';
}

interface RecruitmentMetrics {
  total_searches: number;
  patient_views: number;
  contact_requests: number;
  qualified_leads: number;
  enrollment_rate: number;
  avg_response_time: number;
}

interface TrialPerformance {
  trial_id: string;
  trial_name: string;
  target_enrollment: number;
  current_enrollment: number;
  screening_funnel: {
    inquiries: number;
    screened: number;
    eligible: number;
    enrolled: number;
  };
  demographics: {
    age_distribution: Record<string, number>;
    gender_distribution: Record<string, number>;
    location_distribution: Record<string, number>;
  };
}

export default function PharmaDashboard({ user, profile }: PharmaDashboardProps) {
  const [leads, setLeads] = useState<PatientLead[]>([]);
  const [metrics, setMetrics] = useState<RecruitmentMetrics | null>(null);
  const [trialPerformance, setTrialPerformance] = useState<TrialPerformance[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClientComponentClient();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    
    try {
      await Promise.all([
        loadPatientLeads(),
        loadRecruitmentMetrics(),
        loadTrialPerformance(),
        loadSubscriptionInfo(),
        loadUsageStats()
      ]);
    } catch (error) {
      console.error('Error loading pharma dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatientLeads = async () => {
    // Mock data for demonstration
    setLeads([
      {
        id: '1',
        patient_id: 'p1',
        trial_interest: ['Alzheimer\'s Disease', 'Memory Loss'],
        match_score: 0.92,
        location: { city: 'Boston', state: 'MA', country: 'USA' },
        demographics: { age: 67, gender: 'female' },
        medical_profile: {
          conditions: ['Mild Cognitive Impairment', 'Hypertension'],
          medications: ['Donepezil', 'Lisinopril']
        },
        engagement_score: 8.5,
        last_active: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        contact_status: 'new'
      },
      {
        id: '2',
        patient_id: 'p2',
        trial_interest: ['Cancer Treatment', 'Immunotherapy'],
        match_score: 0.88,
        location: { city: 'San Francisco', state: 'CA', country: 'USA' },
        demographics: { age: 45, gender: 'male' },
        medical_profile: {
          conditions: ['Non-Small Cell Lung Cancer', 'Stage IIIA'],
          medications: ['Carboplatin', 'Paclitaxel']
        },
        engagement_score: 9.2,
        last_active: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        contact_status: 'contacted'
      }
    ]);
  };

  const loadRecruitmentMetrics = async () => {
    setMetrics({
      total_searches: 1247,
      patient_views: 342,
      contact_requests: 89,
      qualified_leads: 23,
      enrollment_rate: 0.18,
      avg_response_time: 4.2
    });
  };

  const loadTrialPerformance = async () => {
    setTrialPerformance([
      {
        trial_id: 'NCT12345678',
        trial_name: 'Phase III Alzheimer\'s Drug Study',
        target_enrollment: 200,
        current_enrollment: 147,
        screening_funnel: {
          inquiries: 534,
          screened: 423,
          eligible: 189,
          enrolled: 147
        },
        demographics: {
          age_distribution: { '18-30': 5, '31-50': 15, '51-65': 45, '65+': 35 },
          gender_distribution: { 'male': 48, 'female': 52 },
          location_distribution: { 'Northeast': 35, 'Southeast': 25, 'West': 30, 'Midwest': 10 }
        }
      }
    ]);
  };

  const loadSubscriptionInfo = async () => {
    const { data: pharmaProfile } = await supabase
      .from('pharma_profiles')
      .select('subscription_tier, monthly_search_limit, monthly_contact_limit')
      .eq('user_id', user.id)
      .single();

    setSubscription(pharmaProfile);
  };

  const loadUsageStats = async () => {
    setUsageStats({
      searches_used: 87,
      contacts_used: 23,
      api_calls_used: 156,
      exports_used: 12
    });
  };

  const getContactStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'responded':
        return 'bg-green-100 text-green-800';
      case 'qualified':
        return 'bg-purple-100 text-purple-800';
      case 'enrolled':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEngagementColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const calculateEnrollmentProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your recruitment dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.pharma_profiles?.company_name || 'Recruitment Dashboard'}
              </h1>
              <p className="text-gray-600 mt-1">
                Manage your clinical trial recruitment and analytics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="font-medium capitalize">
                  {subscription?.subscription_tier || 'Free'} Plan
                </span>
              </div>
              <Button size="sm">
                <PlusCircle className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Searches</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.total_searches.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">+12% from last month</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Patient Views</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.patient_views}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">+8% from last month</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Qualified Leads</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.qualified_leads}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-gray-600">
                {((metrics?.qualified_leads || 0) / (metrics?.contact_requests || 1) * 100).toFixed(1)}% conversion rate
              </span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Enrollment Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {((metrics?.enrollment_rate || 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Clock className="h-4 w-4 text-gray-500 mr-1" />
              <span className="text-gray-600">{metrics?.avg_response_time}h avg response</span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Patient Leads */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Patient Leads</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {leads.map((lead, index) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-blue-600">
                            Lead #{lead.id}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getContactStatusColor(lead.contact_status)}`}>
                            {lead.contact_status}
                          </span>
                          <span className="text-sm text-gray-500">
                            {Math.round(lead.match_score * 100)}% match
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Demographics</p>
                            <p className="text-sm text-gray-900">
                              {lead.demographics.age}y, {lead.demographics.gender}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Location</p>
                            <p className="text-sm text-gray-900">
                              {lead.location.city}, {lead.location.state || lead.location.country}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Engagement</p>
                            <p className={`text-sm font-medium ${getEngagementColor(lead.engagement_score)}`}>
                              {lead.engagement_score}/10
                            </p>
                          </div>
                        </div>

                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1">Conditions</p>
                          <div className="flex flex-wrap gap-1">
                            {lead.medical_profile.conditions.map((condition, idx) => (
                              <span key={idx} className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                                {condition}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 mb-1">Trial Interest</p>
                          <div className="flex flex-wrap gap-1">
                            {lead.trial_interest.map((interest, idx) => (
                              <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button size="sm">
                          <Mail className="h-4 w-4 mr-2" />
                          Contact
                        </Button>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {leads.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Leads Yet</h3>
                  <p className="text-gray-600 mb-4">
                    Start searching for patients to build your recruitment pipeline
                  </p>
                  <Button>
                    <Search className="h-4 w-4 mr-2" />
                    Search Patients
                  </Button>
                </div>
              )}
            </Card>

            {/* Trial Performance */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Trial Performance</h2>
              
              {trialPerformance.map((trial) => (
                <div key={trial.trial_id} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900">{trial.trial_name}</h3>
                      <p className="text-sm text-gray-600">{trial.trial_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">
                        {trial.current_enrollment}/{trial.target_enrollment}
                      </p>
                      <p className="text-sm text-gray-600">enrolled</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Enrollment Progress</span>
                      <span className="text-sm font-medium">
                        {calculateEnrollmentProgress(trial.current_enrollment, trial.target_enrollment).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={calculateEnrollmentProgress(trial.current_enrollment, trial.target_enrollment)} 
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{trial.screening_funnel.inquiries}</p>
                      <p className="text-xs text-gray-600">Inquiries</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">{trial.screening_funnel.screened}</p>
                      <p className="text-xs text-gray-600">Screened</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{trial.screening_funnel.eligible}</p>
                      <p className="text-xs text-gray-600">Eligible</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{trial.screening_funnel.enrolled}</p>
                      <p className="text-xs text-gray-600">Enrolled</p>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Usage Limits */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Monthly Usage</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Searches</span>
                    <span className="text-sm font-medium">
                      {usageStats?.searches_used || 0}/{subscription?.monthly_search_limit || 100}
                    </span>
                  </div>
                  <Progress 
                    value={((usageStats?.searches_used || 0) / (subscription?.monthly_search_limit || 100)) * 100} 
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Contacts</span>
                    <span className="text-sm font-medium">
                      {usageStats?.contacts_used || 0}/{subscription?.monthly_contact_limit || 10}
                    </span>
                  </div>
                  <Progress 
                    value={((usageStats?.contacts_used || 0) / (subscription?.monthly_contact_limit || 10)) * 100} 
                    className="h-2"
                  />
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full mt-4">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Search className="h-4 w-4 mr-2" />
                  Search Patients
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </Button>
              </div>
            </Card>

            {/* Geographic Distribution */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Lead Distribution</h3>
              
              <div className="space-y-3">
                {Object.entries(trialPerformance[0]?.demographics.location_distribution || {}).map(([region, percentage]) => (
                  <div key={region} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{region}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent Activity */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Patient enrolled in NCT12345678</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Contacted 3 new leads</p>
                    <p className="text-xs text-gray-500">5 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Search className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Searched for Alzheimer's patients</p>
                    <p className="text-xs text-gray-500">1 day ago</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}