import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { type, data } = await request.json();

    // Verify user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let success = false;

    switch (type) {
      case 'trial_match':
        success = await emailService.sendTrialMatchNotification(data);
        break;
      
      case 'trial_application':
        success = await emailService.sendTrialApplicationNotification(data);
        break;
      
      case 'welcome':
        success = await emailService.sendWelcomeEmail(data.email, data.name, data.userType);
        break;
      
      case 'password_reset':
        success = await emailService.sendPasswordResetEmail(data.email, data.token);
        break;
      
      case 'trial_status_update':
        success = await emailService.sendTrialStatusUpdateEmail(
          data.patientEmail,
          data.patientName,
          data.trialId,
          data.trialTitle,
          data.newStatus
        );
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    if (success) {
      // Log the notification in the database
      await supabase
        .from('notification_logs')
        .insert({
          user_id: session.user.id,
          type: type,
          recipient: data.email || data.patientEmail,
          status: 'sent',
          sent_at: new Date().toISOString()
        });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
    }

  } catch (error) {
    console.error('Notification API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}