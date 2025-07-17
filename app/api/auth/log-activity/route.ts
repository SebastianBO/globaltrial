import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { userId, activityType, details } = await request.json();

    // Get IP address and user agent
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Log the activity
    const { error } = await supabase.rpc('log_user_activity', {
      p_user_id: userId,
      p_activity_type: activityType,
      p_activity_details: details || {},
      p_ip_address: ip,
      p_user_agent: userAgent
    });

    if (error) {
      console.error('Error logging activity:', error);
      return NextResponse.json(
        { error: 'Failed to log activity' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Activity logging error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}