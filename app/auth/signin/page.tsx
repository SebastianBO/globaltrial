import AuthForm from '@/components/auth/auth-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | GlobalTrials',
  description: 'Sign in to access your GlobalTrials account and manage your clinical trial participation.',
};

export default function SignInPage() {
  return <AuthForm mode="signin" />;
}