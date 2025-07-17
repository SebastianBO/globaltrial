import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailTemplate {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface TrialMatchNotification {
  patientEmail: string;
  patientName: string;
  trials: Array<{
    nct_id: string;
    title: string;
    match_score: number;
    phase: string;
    status: string;
    location: string;
  }>;
}

export interface TrialApplicationNotification {
  patientEmail: string;
  pharmaEmail: string;
  trialId: string;
  trialTitle: string;
  patientProfile: any;
}

export class EmailService {
  private defaultFrom = 'GlobalTrials <noreply@globaltrials.com>';

  async sendEmail(email: EmailTemplate): Promise<boolean> {
    try {
      const { data, error } = await resend.emails.send({
        from: email.from || this.defaultFrom,
        to: email.to,
        subject: email.subject,
        html: email.html,
        replyTo: email.replyTo
      });

      if (error) {
        console.error('Email sending error:', error);
        return false;
      }

      console.log('Email sent successfully:', data?.id);
      return true;
    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  }

  async sendTrialMatchNotification(notification: TrialMatchNotification): Promise<boolean> {
    const html = this.generateTrialMatchEmail(notification);
    
    return this.sendEmail({
      to: notification.patientEmail,
      subject: `${notification.trials.length} New Clinical Trial${notification.trials.length > 1 ? 's' : ''} Match Your Profile`,
      html,
      replyTo: 'support@globaltrials.com'
    });
  }

  async sendTrialApplicationNotification(notification: TrialApplicationNotification): Promise<boolean> {
    // Send confirmation to patient
    const patientConfirmed = await this.sendEmail({
      to: notification.patientEmail,
      subject: `Application Submitted: ${notification.trialTitle}`,
      html: this.generatePatientApplicationConfirmationEmail(notification),
      replyTo: 'support@globaltrials.com'
    });

    // Send notification to pharma company
    const pharmaNotified = await this.sendEmail({
      to: notification.pharmaEmail,
      subject: `New Trial Application: ${notification.trialId}`,
      html: this.generatePharmaApplicationNotificationEmail(notification),
      replyTo: 'recruitment@globaltrials.com'
    });

    return patientConfirmed && pharmaNotified;
  }

  async sendWelcomeEmail(userEmail: string, userName: string, userType: 'patient' | 'pharma'): Promise<boolean> {
    const html = this.generateWelcomeEmail(userName, userType);
    
    return this.sendEmail({
      to: userEmail,
      subject: `Welcome to GlobalTrials, ${userName}!`,
      html,
      replyTo: 'welcome@globaltrials.com'
    });
  }

  async sendPasswordResetEmail(userEmail: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;
    const html = this.generatePasswordResetEmail(resetUrl);
    
    return this.sendEmail({
      to: userEmail,
      subject: 'Reset Your GlobalTrials Password',
      html,
      replyTo: 'support@globaltrials.com'
    });
  }

  async sendTrialStatusUpdateEmail(
    patientEmail: string, 
    patientName: string, 
    trialId: string, 
    trialTitle: string, 
    newStatus: string
  ): Promise<boolean> {
    const html = this.generateTrialStatusUpdateEmail(patientName, trialId, trialTitle, newStatus);
    
    return this.sendEmail({
      to: patientEmail,
      subject: `Trial Update: ${trialTitle}`,
      html,
      replyTo: 'support@globaltrials.com'
    });
  }

  private generateTrialMatchEmail(notification: TrialMatchNotification): string {
    const trialsHtml = notification.trials.map(trial => `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; background: #f9fafb;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <span style="color: #2563eb; font-weight: 600; font-size: 14px;">${trial.nct_id}</span>
          <span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
            ${Math.round(trial.match_score * 100)}% Match
          </span>
          <span style="background: #f3f4f6; color: #6b7280; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
            ${trial.phase}
          </span>
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111827;">${trial.title}</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">📍 ${trial.location}</p>
        <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">Status: ${trial.status}</p>
      </div>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Trial Matches</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">🎯 New Trial Matches!</h1>
          <p style="margin: 8px 0 0 0; color: #ddd6fe; font-size: 16px;">We found clinical trials that match your profile</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
            Hi ${notification.patientName},
          </p>
          
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151; line-height: 1.6;">
            Great news! We found <strong>${notification.trials.length} clinical trial${notification.trials.length > 1 ? 's' : ''}</strong> 
            that could be a perfect fit for your medical profile. These trials are currently recruiting participants.
          </p>

          ${trialsHtml}

          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              View All Matches
            </a>
          </div>

          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <h4 style="margin: 0 0 8px 0; color: #0369a1; font-size: 14px; font-weight: 600;">💡 Next Steps:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #0369a1; font-size: 14px;">
              <li>Review trial details and eligibility requirements</li>
              <li>Contact the research team for more information</li>
              <li>Schedule a screening appointment if interested</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
            Questions? Reply to this email or contact our support team.
          </p>
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            GlobalTrials - Connecting patients with life-changing clinical trials
          </p>
        </div>
      </div>
    </body>
    </html>`;
  }

  private generatePatientApplicationConfirmationEmail(notification: TrialApplicationNotification): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Application Submitted</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">✅ Application Submitted!</h1>
        </div>

        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
            Your application for the clinical trial has been successfully submitted.
          </p>
          
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px 0; color: #111827;">Trial Details:</h3>
            <p style="margin: 0 0 8px 0; color: #374151;"><strong>ID:</strong> ${notification.trialId}</p>
            <p style="margin: 0; color: #374151;"><strong>Title:</strong> ${notification.trialTitle}</p>
          </div>

          <p style="margin: 24px 0; font-size: 16px; color: #374151; line-height: 1.6;">
            The research team will review your application and contact you within 2-3 business days. 
            You can track the status of your application in your dashboard.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              View Dashboard
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>`;
  }

  private generatePharmaApplicationNotificationEmail(notification: TrialApplicationNotification): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Trial Application</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">🎯 New Trial Application</h1>
        </div>

        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
            A qualified patient has applied for your clinical trial:
          </p>
          
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px 0; color: #111827;">Trial: ${notification.trialId}</h3>
            <p style="margin: 0; color: #374151;">${notification.trialTitle}</p>
          </div>

          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <h4 style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">⚡ Quick Action Required:</h4>
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              Review the patient's profile and contact them within 24 hours for best engagement rates.
            </p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Review Application
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>`;
  }

  private generateWelcomeEmail(userName: string, userType: 'patient' | 'pharma'): string {
    const content = userType === 'patient' ? {
      title: '🎉 Welcome to GlobalTrials!',
      subtitle: 'Your journey to finding the right clinical trial starts here',
      message: 'We\'re here to help you discover clinical trials that could make a real difference in your health journey.',
      cta: 'Find Trials',
      ctaUrl: '/search'
    } : {
      title: '🚀 Welcome to GlobalTrials!',
      subtitle: 'Start recruiting qualified participants today',
      message: 'Access our global network of patients actively seeking clinical trial opportunities.',
      cta: 'View Dashboard',
      ctaUrl: '/dashboard'
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to GlobalTrials</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 40px 24px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">${content.title}</h1>
          <p style="margin: 12px 0 0 0; color: #ddd6fe; font-size: 18px;">${content.subtitle}</p>
        </div>

        <div style="padding: 40px 24px;">
          <p style="margin: 0 0 24px 0; font-size: 18px; color: #374151;">
            Hi ${userName},
          </p>
          
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151; line-height: 1.6;">
            ${content.message}
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}${content.ctaUrl}" 
               style="background: #3b82f6; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
              ${content.cta}
            </a>
          </div>

          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 32px 0;">
            <h4 style="margin: 0 0 12px 0; color: #0369a1; font-size: 16px; font-weight: 600;">Getting Started:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #0369a1; font-size: 14px; line-height: 1.6;">
              ${userType === 'patient' ? `
                <li>Complete your medical profile for better trial matching</li>
                <li>Use our AI assistant to find trials that fit your needs</li>
                <li>Set up notifications for new trial opportunities</li>
              ` : `
                <li>Set up your recruitment campaigns and target criteria</li>
                <li>Access our patient database and analytics tools</li>
                <li>Track your recruitment performance and ROI</li>
              `}
            </ul>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
            Need help? We're here for you every step of the way.
          </p>
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            GlobalTrials - Revolutionizing clinical trial recruitment
          </p>
        </div>
      </div>
    </body>
    </html>`;
  }

  private generatePasswordResetEmail(resetUrl: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: #ef4444; padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">🔐 Reset Your Password</h1>
        </div>

        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
            You requested to reset your GlobalTrials password. Click the button below to create a new password:
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" 
               style="background: #ef4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>

          <p style="margin: 24px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
            This link will expire in 24 hours. If you didn't request this password reset, please ignore this email.
          </p>

          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #dc2626; font-size: 14px;">
              <strong>Security tip:</strong> Never share your password or reset links with anyone.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>`;
  }

  private generateTrialStatusUpdateEmail(
    patientName: string, 
    trialId: string, 
    trialTitle: string, 
    newStatus: string
  ): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Trial Status Update</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">📋 Trial Status Update</h1>
        </div>

        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
            Hi ${patientName},
          </p>
          
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151; line-height: 1.6;">
            There's an update on the clinical trial you're interested in:
          </p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px 0; color: #111827;">${trialTitle}</h3>
            <p style="margin: 0 0 8px 0; color: #374151;"><strong>Trial ID:</strong> ${trialId}</p>
            <p style="margin: 0; color: #374151;"><strong>New Status:</strong> <span style="color: #10b981; font-weight: 600;">${newStatus}</span></p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              View Details
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>`;
  }
}

export const emailService = new EmailService();