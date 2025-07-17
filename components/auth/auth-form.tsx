'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Building2, 
  UserCheck,
  Loader2,
  ArrowRight,
  Heart,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type UserType = 'patient' | 'pharma';
type AuthMode = 'signin' | 'signup';

interface AuthFormProps {
  mode: AuthMode;
  redirectTo?: string;
}

export default function AuthForm({ mode, redirectTo = '/dashboard' }: AuthFormProps) {
  const [userType, setUserType] = useState<UserType>('patient');
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    companySize: '',
    industry: '',
    agreedToTerms: false,
    marketingConsent: false
  });

  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        // Log activity
        await fetch('/api/auth/log-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            activityType: 'login',
            details: { method: 'email' }
          })
        });

        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate form
      if (!validateEmail(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }

      if (!validatePassword(formData.password)) {
        setError('Password must be at least 8 characters long');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (!formData.agreedToTerms) {
        setError('Please agree to the terms and conditions');
        return;
      }

      // Sign up user
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            user_type: userType,
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            company_name: userType === 'pharma' ? formData.companyName : null,
            marketing_consent: formData.marketingConsent
          }
        }
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        // Create profile based on user type
        await createUserProfile(data.user.id);
        
        // Show success message
        setStep(3);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const createUserProfile = async (userId: string) => {
    try {
      // Create base profile
      await supabase
        .from('user_profiles')
        .update({
          user_type: userType,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          marketing_consent: formData.marketingConsent,
          data_sharing_consent: true,
        })
        .eq('id', userId);

      // Create specific profile
      if (userType === 'patient') {
        await supabase
          .from('patient_profiles')
          .insert({
            user_id: userId,
            compensation_interest: false,
            max_travel_distance_km: 50,
            contact_for_studies: true
          });
      } else {
        await supabase
          .from('pharma_profiles')
          .insert({
            user_id: userId,
            company_name: formData.companyName,
            company_size: formData.companySize as any,
            industry_sector: formData.industry,
            subscription_tier: 'free'
          });
      }
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!validateEmail(formData.email) || !validatePassword(formData.password)) {
        setError('Please check your email and password');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }
    setStep(step + 1);
    setError(null);
  };

  const prevStep = () => {
    setStep(step - 1);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'signin' ? 'Welcome Back' : 'Join GlobalTrials'}
          </h1>
          <p className="text-gray-600 mt-2">
            {mode === 'signin' 
              ? 'Sign in to access your account' 
              : 'Find clinical trials that could change your life'
            }
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'signin' ? (
            <motion.div
              key="signin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pl-10 pr-10"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}

              <Button 
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <button 
                  onClick={() => router.push('/auth/signup')}
                  className="text-blue-600 hover:underline"
                >
                  Sign up
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Sign Up Flow */}
              {step === 1 && (
                <motion.div
                  key="signup-step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* User Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      I am a...
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setUserType('patient')}
                        className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                          userType === 'patient'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Heart className="h-6 w-6" />
                        <span className="font-medium">Patient</span>
                        <span className="text-xs text-center">Looking for trials</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserType('pharma')}
                        className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                          userType === 'pharma'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Briefcase className="h-6 w-6" />
                        <span className="font-medium">Company</span>
                        <span className="text-xs text-center">Finding participants</span>
                      </button>
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="pl-10"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="pl-10 pr-10"
                        placeholder="At least 8 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className="pl-10"
                        placeholder="Confirm your password"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                      {error}
                    </div>
                  )}

                  <Button onClick={nextStep} className="w-full">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="signup-step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold">
                      {userType === 'patient' ? 'Personal Information' : 'Company Information'}
                    </h3>
                  </div>

                  {userType === 'patient' ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First Name
                          </label>
                          <Input
                            value={formData.firstName}
                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                            placeholder="First name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name
                          </label>
                          <Input
                            value={formData.lastName}
                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                            placeholder="Last name"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone (Optional)
                        </label>
                        <Input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="Phone number"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Company Name
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            value={formData.companyName}
                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                            className="pl-10"
                            placeholder="Your company name"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First Name
                          </label>
                          <Input
                            value={formData.firstName}
                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                            placeholder="First name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name
                          </label>
                          <Input
                            value={formData.lastName}
                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                            placeholder="Last name"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Company Size
                        </label>
                        <select
                          value={formData.companySize}
                          onChange={(e) => handleInputChange('companySize', e.target.value)}
                          className="w-full p-2 border rounded-md"
                          required
                        >
                          <option value="">Select company size</option>
                          <option value="startup">Startup (1-10 employees)</option>
                          <option value="small">Small (11-50 employees)</option>
                          <option value="medium">Medium (51-200 employees)</option>
                          <option value="large">Large (201-1000 employees)</option>
                          <option value="enterprise">Enterprise (1000+ employees)</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Terms and Conditions */}
                  <div className="space-y-3">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={formData.agreedToTerms}
                        onChange={(e) => handleInputChange('agreedToTerms', e.target.checked)}
                        className="mt-1"
                        required
                      />
                      <span className="text-sm text-gray-600">
                        I agree to the{' '}
                        <a href="/terms" className="text-blue-600 hover:underline">
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a href="/privacy" className="text-blue-600 hover:underline">
                          Privacy Policy
                        </a>
                      </span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={formData.marketingConsent}
                        onChange={(e) => handleInputChange('marketingConsent', e.target.checked)}
                        className="mt-1"
                      />
                      <span className="text-sm text-gray-600">
                        I would like to receive updates about clinical trials and health research
                      </span>
                    </label>
                  </div>

                  {error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={prevStep} className="flex-1">
                      Back
                    </Button>
                    <Button onClick={handleSignUp} disabled={isLoading} className="flex-1">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="signup-success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <UserCheck className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Account Created Successfully!
                  </h3>
                  <p className="text-gray-600">
                    Please check your email to verify your account, then you can start{' '}
                    {userType === 'patient' ? 'finding clinical trials' : 'recruiting participants'}.
                  </p>
                  <Button onClick={() => router.push('/auth/signin')} className="w-full">
                    Continue to Sign In
                  </Button>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>

        {mode === 'signin' && (
          <div className="mt-6 text-center">
            <a 
              href="/auth/forgot-password" 
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}