import AuthForm from '@/components/auth/auth-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up | GlobalTrials',
  description: 'Join GlobalTrials to find clinical trials or recruit participants for your research.',
};

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}