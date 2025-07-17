import AIChat from '@/components/ai-chat-enhanced';
import Navigation from '@/components/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Clinical Trial Assistant | GlobalTrials',
  description: 'Get personalized clinical trial recommendations through our AI-powered chat assistant. Find trials that match your medical condition and needs.',
};

export default function AIChatPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <AIChat />
      </div>
    </>
  );
}