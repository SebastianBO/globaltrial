'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Crown, Zap, Building2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { PRICING_PLANS } from '@/lib/stripe';

interface PricingPlansProps {
  currentPlan?: string;
  onSelectPlan?: (planId: string) => void;
}

export default function PricingPlans({ currentPlan, onSelectPlan }: PricingPlansProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') return;
    
    setIsLoading(planId);
    
    try {
      if (onSelectPlan) {
        await onSelectPlan(planId);
      } else {
        // Default behavior - redirect to checkout
        const response = await fetch('/api/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId })
        });

        if (response.ok) {
          const { url } = await response.json();
          window.location.href = url;
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to create checkout session');
        }
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free':
        return <Building2 className="h-6 w-6" />;
      case 'basic':
        return <Zap className="h-6 w-6" />;
      case 'professional':
        return <Crown className="h-6 w-6" />;
      case 'enterprise':
        return <Sparkles className="h-6 w-6" />;
      default:
        return <Building2 className="h-6 w-6" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'free':
        return 'border-gray-200 bg-gray-50';
      case 'basic':
        return 'border-blue-200 bg-blue-50';
      case 'professional':
        return 'border-purple-200 bg-purple-50 ring-2 ring-purple-500';
      case 'enterprise':
        return 'border-indigo-200 bg-indigo-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getButtonStyle = (planId: string) => {
    if (currentPlan === planId) {
      return 'bg-gray-400 text-white cursor-not-allowed';
    }
    
    switch (planId) {
      case 'free':
        return 'bg-gray-600 hover:bg-gray-700 text-white';
      case 'basic':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'professional':
        return 'bg-purple-600 hover:bg-purple-700 text-white';
      case 'enterprise':
        return 'bg-indigo-600 hover:bg-indigo-700 text-white';
      default:
        return 'bg-gray-600 hover:bg-gray-700 text-white';
    }
  };

  const formatLimit = (limit: number) => {
    if (limit === -1) return 'Unlimited';
    return limit.toLocaleString();
  };

  return (
    <div className="py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Select the perfect plan for your clinical trial recruitment needs. 
          All plans include our core features with varying limits and capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {Object.values(PRICING_PLANS).map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}
            
            <Card className={`p-6 h-full ${getPlanColor(plan.id)} transition-all duration-200 hover:shadow-lg`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  plan.id === 'free' ? 'bg-gray-100 text-gray-600' :
                  plan.id === 'basic' ? 'bg-blue-100 text-blue-600' :
                  plan.id === 'professional' ? 'bg-purple-100 text-purple-600' :
                  'bg-indigo-100 text-indigo-600'
                }`}>
                  {getPlanIcon(plan.id)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-600">/{plan.interval}</span>
                </div>
                {plan.id !== 'free' && (
                  <p className="text-sm text-gray-600 mt-1">
                    Billed {plan.interval === 'month' ? 'monthly' : 'annually'}
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="text-sm font-medium text-gray-900 mb-2">Usage Limits:</div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Monthly searches</span>
                  <span className="text-sm font-medium">{formatLimit(plan.limits.searches)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Patient contacts</span>
                  <span className="text-sm font-medium">{formatLimit(plan.limits.contacts)}</span>
                </div>
                {plan.limits.apiCalls && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">API calls</span>
                    <span className="text-sm font-medium">{formatLimit(plan.limits.apiCalls)}</span>
                  </div>
                )}
                {plan.limits.exports && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Data exports</span>
                    <span className="text-sm font-medium">{formatLimit(plan.limits.exports)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="text-sm font-medium text-gray-900 mb-2">Features:</div>
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={currentPlan === plan.id || isLoading === plan.id || plan.id === 'free'}
                className={`w-full ${getButtonStyle(plan.id)}`}
              >
                {isLoading === plan.id ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : currentPlan === plan.id ? (
                  'Current Plan'
                ) : plan.id === 'free' ? (
                  'Get Started Free'
                ) : (
                  `Upgrade to ${plan.name}`
                )}
              </Button>

              {plan.id === 'enterprise' && (
                <p className="text-xs text-center text-gray-600 mt-3">
                  Contact sales for custom pricing
                </p>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-gray-600 mb-4">
          Need a custom solution? We offer enterprise packages with dedicated support.
        </p>
        <Button variant="outline">
          Contact Sales
        </Button>
      </div>

      <div className="mt-12 bg-gray-50 rounded-xl p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
          Frequently Asked Questions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Can I change plans anytime?</h4>
            <p className="text-sm text-gray-600">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What happens if I exceed my limits?</h4>
            <p className="text-sm text-gray-600">
              We'll notify you when you're approaching your limits. You can upgrade your plan or purchase additional credits.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h4>
            <p className="text-sm text-gray-600">
              Yes, all paid plans come with a 14-day free trial. No credit card required to start.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Do you offer annual discounts?</h4>
            <p className="text-sm text-gray-600">
              Yes, save 20% when you choose annual billing. Perfect for established research teams.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}