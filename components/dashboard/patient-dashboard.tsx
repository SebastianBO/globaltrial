'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Heart, 
  Search, 
  MessageCircle, 
  Star, 
  Calendar, 
  MapPin, 
  User, 
  Bell,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Settings,
  Activity,
  Filter,
  BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';

interface PatientDashboardProps {
  user: any;
  profile: any;
}

interface TrialMatch {
  id: string;
  nct_id: string;
  title: string;
  match_score: number;
  status: string;
  phase: string;
  location_distance?: number;
  match_reason: string;
  applied_at?: string;
  last_contact?: string;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

export default function PatientDashboard({ user, profile }: PatientDashboardProps) {
  const [matches, setMatches] = useState<TrialMatch[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [savedTrials, setSavedTrials] = useState<any[]>([]);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);

  const supabase = createClientComponentClient();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    
    try {
      // Load parallel data
      await Promise.all([
        loadTrialMatches(),
        loadRecentActivity(),
        loadSavedTrials(),
        calculateProfileCompletion(),
        loadNotifications()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrialMatches = async () => {
    const { data, error } = await supabase
      .from('patient_trial_matches')
      .select(`
        id,
        match_score,
        match_reason,
        applied_at,
        last_contact,
        clinical_trials (
          nct_id,
          title,
          status,
          phase,
          locations
        )
      `)
      .eq('patient_id', user.id)
      .order('match_score', { ascending: false })
      .limit(5);

    if (!error && data) {
      const formattedMatches = data.map(match => ({
        id: match.id,
        nct_id: match.clinical_trials?.nct_id || '',
        title: match.clinical_trials?.title || '',
        match_score: match.match_score,
        status: match.clinical_trials?.status || '',
        phase: match.clinical_trials?.phase || '',
        match_reason: match.match_reason || '',
        applied_at: match.applied_at,
        last_contact: match.last_contact
      }));
      setMatches(formattedMatches);
    }
  };

  const loadRecentActivity = async () => {
    const { data, error } = await supabase
      .from('user_activity_logs')
      .select('id, activity_type, activity_details, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      const formattedActivity = data.map(activity => ({
        id: activity.id,
        type: activity.activity_type,
        description: getActivityDescription(activity.activity_type, activity.activity_details),
        timestamp: activity.created_at,
        metadata: activity.activity_details
      }));
      setRecentActivity(formattedActivity);
    }
  };

  const loadSavedTrials = async () => {
    const { data, error } = await supabase
      .from('saved_trials')
      .select(`
        id,
        saved_at,
        clinical_trials (
          nct_id,
          title,
          status,
          phase,
          brief_summary
        )
      `)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(3);

    if (!error && data) {
      setSavedTrials(data);
    }
  };

  const calculateProfileCompletion = async () => {
    const { data: patientProfile, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && patientProfile) {
      let completed = 0;
      const fields = [
        'date_of_birth',
        'gender',
        'medical_conditions',
        'city',
        'country'
      ];
      
      fields.forEach(field => {
        if (patientProfile[field] && 
            (Array.isArray(patientProfile[field]) ? patientProfile[field].length > 0 : true)) {
          completed += 20;
        }
      });
      
      setProfileCompletion(completed);
    }
  };

  const loadNotifications = async () => {
    // Mock notifications for now
    setNotifications([
      {
        id: '1',
        type: 'new_match',
        title: 'New Trial Match',
        message: '3 new trials match your profile',
        timestamp: new Date().toISOString(),
        read: false
      },
      {
        id: '2',
        type: 'trial_update',
        title: 'Trial Status Update',
        message: 'NCT12345678 is now recruiting in your area',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        read: false
      }
    ]);
  };

  const getActivityDescription = (type: string, details: any) => {
    switch (type) {
      case 'login':
        return 'Signed in to your account';
      case 'search':
        return `Searched for trials: "${details?.query || 'clinical trials'}"`;
      case 'trial_view':
        return `Viewed trial ${details?.nct_id || 'details'}`;
      case 'profile_update':
        return 'Updated your profile information';
      case 'ai_chat':
        return 'Used AI assistant to find matching trials';
      default:
        return `Performed ${type.replace('_', ' ')}`;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <User className="h-4 w-4" />;
      case 'search':
        return <Search className="h-4 w-4" />;
      case 'trial_view':
        return <FileText className="h-4 w-4" />;
      case 'profile_update':
        return <Settings className="h-4 w-4" />;
      case 'ai_chat':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECRUITING':
        return 'text-green-600 bg-green-100';
      case 'ACTIVE_NOT_RECRUITING':
        return 'text-blue-600 bg-blue-100';
      case 'COMPLETED':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
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
                Welcome back, {profile.first_name || 'there'}!
              </h1>
              <p className="text-gray-600 mt-1">
                Here's your clinical trial activity and matches
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                {notifications.filter(n => !n.read).length} notifications
              </Button>
              <Button size="sm">
                <MessageCircle className="h-4 w-4 mr-2" />
                Find New Trials
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Search className="h-6 w-6" />
                  <span className="text-sm">Search Trials</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <MessageCircle className="h-6 w-6" />
                  <span className="text-sm">AI Assistant</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Star className="h-6 w-6" />
                  <span className="text-sm">Saved Trials</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Settings className="h-6 w-6" />
                  <span className="text-sm">Profile</span>
                </Button>
              </div>
            </Card>

            {/* Trial Matches */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Your Trial Matches</h2>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  View All
                </Button>
              </div>
              
              {matches.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Matches Yet</h3>
                  <p className="text-gray-600 mb-4">
                    Complete your profile to get personalized trial recommendations
                  </p>
                  <Button>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Find Trials with AI
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.map((match, index) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-medium text-blue-600">
                              {match.nct_id}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMatchScoreColor(match.match_score)}`}>
                              {Math.round(match.match_score * 100)}% match
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(match.status)}`}>
                              {match.status}
                            </span>
                          </div>
                          <h3 className="font-medium text-gray-900 mb-2">
                            {match.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            {match.match_reason}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Phase {match.phase}
                            </span>
                            {match.location_distance && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {match.location_distance.toFixed(1)} km away
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {match.applied_at ? (
                            <Button size="sm" variant="outline" disabled>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Applied
                            </Button>
                          ) : (
                            <Button size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              Apply
                            </Button>
                          )}
                          <Button size="sm" variant="ghost">
                            View Details
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Activity */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <p className="text-gray-600 text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Completion */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Profile Completion</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-medium">{profileCompletion}%</span>
                </div>
                <Progress value={profileCompletion} className="h-2" />
                {profileCompletion < 100 && (
                  <div className="text-sm text-gray-600">
                    <p className="mb-2">Complete your profile to get better matches:</p>
                    <ul className="space-y-1 text-xs">
                      {profileCompletion < 20 && <li>• Add your date of birth</li>}
                      {profileCompletion < 40 && <li>• Specify your gender</li>}
                      {profileCompletion < 60 && <li>• List medical conditions</li>}
                      {profileCompletion < 80 && <li>• Add your location</li>}
                      {profileCompletion < 100 && <li>• Set trial preferences</li>}
                    </ul>
                    <Button size="sm" className="mt-3 w-full">
                      Complete Profile
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Saved Trials */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Saved Trials</h3>
                <Button variant="ghost" size="sm">View All</Button>
              </div>
              {savedTrials.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">
                  No saved trials yet
                </p>
              ) : (
                <div className="space-y-3">
                  {savedTrials.map((saved) => (
                    <div key={saved.id} className="border border-gray-200 rounded p-3">
                      <p className="text-sm font-medium text-blue-600 mb-1">
                        {saved.clinical_trials?.nct_id}
                      </p>
                      <p className="text-sm text-gray-900 line-clamp-2">
                        {saved.clinical_trials?.title}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(saved.clinical_trials?.status)}`}>
                          {saved.clinical_trials?.status}
                        </span>
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Notifications */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Notifications</h3>
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">
                  No new notifications
                </p>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 3).map((notification) => (
                    <div key={notification.id} className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${notification.read ? 'bg-gray-300' : 'bg-blue-600'}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Stats Overview */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Your Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Trial matches</span>
                  <span className="text-xl font-bold text-blue-600">{matches.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Applications sent</span>
                  <span className="text-xl font-bold text-green-600">
                    {matches.filter(m => m.applied_at).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Trials saved</span>
                  <span className="text-xl font-bold text-purple-600">{savedTrials.length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}