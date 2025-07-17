import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PatientDashboard from '@/components/dashboard/patient-dashboard';
import PharmaDashboard from '@/components/dashboard/pharma-dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | GlobalTrials',
  description: 'Manage your clinical trial activities and preferences.',
};

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });

  // Check if user is authenticated
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    redirect('/auth/signin?redirectTo=/dashboard');
  }

  // Get user profile to determine user type
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('user_type, first_name, last_name, verification_status')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching user profile:', profileError);
    redirect('/auth/signin');
  }

  // Render appropriate dashboard based on user type
  if (profile.user_type === 'patient') {
    return <PatientDashboard user={session.user} profile={profile} />;
  } else if (profile.user_type === 'pharma') {
    return <PharmaDashboard user={session.user} profile={profile} />;
  } else {
    // Admin or unknown user type
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Account Setup Required
          </h1>
          <p className="text-gray-600 mb-6">
            Your account type needs to be configured. Please contact support.
          </p>
          <a 
            href="/contact" 
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }
}