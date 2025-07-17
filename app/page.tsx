'use client'

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Mic,
  ArrowUp,
  Plus,
  FileText,
  Code,
  BookOpen,
  PenTool,
  BrainCircuit,
  Sparkles,
  MessageSquare,
  Users,
  Database,
  Zap,
  Globe,
  Clock,
  ChevronRight,
  Menu,
  X,
  Star,
  TrendingUp,
  Shield,
  Heart,
  Activity,
  Award,
  CheckCircle,
  ArrowRight,
  Bot,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Linkedin,
  Instagram
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Utility function
function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  children: React.ReactNode;
  href?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', children, href, ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      default: "bg-blue-600 text-white hover:bg-blue-700",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
    };
    
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8"
    };

    if (href) {
      return (
        <Link href={href} className={cn(baseClasses, variants[variant], sizes[size], className)}>
          {children}
        </Link>
      );
    }

    return (
      <button
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// Card Components
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

// AI Assistant Interface Component
function AIAssistantInterface() {
  const [inputValue, setInputValue] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [reasonEnabled, setReasonEnabled] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [showUploadAnimation, setShowUploadAnimation] = useState(false);
  const [activeCommandCategory, setActiveCommandCategory] = useState<string | null>(null);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commandSuggestions = {
    learn: [
      "Find clinical trials for diabetes",
      "What are the latest cancer treatment trials?",
      "Show me trials for rare diseases",
      "Explain clinical trial phases",
      "How do I qualify for a trial?",
    ],
    code: [
      "Search trials by location",
      "Filter by trial status",
      "Find pediatric trials",
      "Show trials with compensation",
      "Browse by medical condition",
    ],
    write: [
      "Help me understand trial requirements",
      "What questions should I ask?",
      "Prepare for trial screening",
      "Understand informed consent",
      "Connect with trial coordinators",
    ],
  };

  const handleUploadFile = () => {
    setShowUploadAnimation(true);
    setTimeout(() => {
      const newFile = `Medical_Records_${Date.now()}.pdf`;
      setUploadedFiles((prev) => [...prev, newFile]);
      setShowUploadAnimation(false);
    }, 1500);
  };

  const handleCommandSelect = (command: string) => {
    setInputValue(command);
    setActiveCommandCategory(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSendMessage = async () => {
    if (inputValue.trim()) {
      const userMessage = inputValue;
      setInputValue("");
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      setIsLoading(true);

      try {
        // Call the existing Groq chat API
        const response = await fetch('/api/groq-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, { role: 'user', content: userMessage }],
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } catch (error) {
        console.error('Error sending message:', error);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="p-4 border-b bg-white/95 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">GlobalTrial</span>
          </Link>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push('/patient')}
          >
            Use Traditional Form
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center"
              >
                <div className="mb-8 w-20 h-20 relative">
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-green-500 rounded-full flex items-center justify-center">
                    <Bot className="w-10 h-10 text-white" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-green-500 mb-2">
                  AI Clinical Trial Assistant
                </h1>
                <p className="text-gray-600 max-w-md">
                  Find the perfect clinical trial match for your medical condition
                </p>
              </motion.div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-gray-200'
                  }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <div className="max-w-3xl mx-auto">
          {/* Command categories */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <CommandButton
              icon={<Search className="w-5 h-5" />}
              label="Find Trials"
              isActive={activeCommandCategory === "learn"}
              onClick={() =>
                setActiveCommandCategory(
                  activeCommandCategory === "learn" ? null : "learn"
                )
              }
            />
            <CommandButton
              icon={<Globe className="w-5 h-5" />}
              label="Browse"
              isActive={activeCommandCategory === "code"}
              onClick={() =>
                setActiveCommandCategory(
                  activeCommandCategory === "code" ? null : "code"
                )
              }
            />
            <CommandButton
              icon={<MessageSquare className="w-5 h-5" />}
              label="Get Help"
              isActive={activeCommandCategory === "write"}
              onClick={() =>
                setActiveCommandCategory(
                  activeCommandCategory === "write" ? null : "write"
                )
              }
            />
          </div>

          {/* Command suggestions */}
          <AnimatePresence>
            {activeCommandCategory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-700">
                      {activeCommandCategory === "learn"
                        ? "Find Clinical Trials"
                        : activeCommandCategory === "code"
                        ? "Browse Options"
                        : "Get Assistance"}
                    </h3>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {commandSuggestions[
                      activeCommandCategory as keyof typeof commandSuggestions
                    ].map((suggestion, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handleCommandSelect(suggestion)}
                        className="p-3 hover:bg-gray-50 cursor-pointer transition-colors duration-75"
                      >
                        <span className="text-sm text-gray-700">
                          {suggestion}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input field */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4">
              <input
                ref={inputRef}
                type="text"
                placeholder="Describe your condition or ask about trials..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="w-full text-gray-700 text-base outline-none placeholder:text-gray-400"
              />
            </div>

            {/* Uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="px-4 pb-3">
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-blue-50 py-1 px-2 rounded-md border border-blue-200"
                    >
                      <FileText className="w-3 h-3 text-blue-600" />
                      <span className="text-xs text-blue-700">{file}</span>
                      <button
                        onClick={() =>
                          setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="text-blue-400 hover:text-blue-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Functions and actions */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSearchEnabled(!searchEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    searchEnabled
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>
                <button
                  onClick={() => setDeepResearchEnabled(!deepResearchEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    deepResearchEnabled
                      ? "bg-green-50 text-green-600 hover:bg-green-100"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>Deep Research</span>
                </button>
                <button
                  onClick={() => setReasonEnabled(!reasonEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    reasonEnabled
                      ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  <BrainCircuit className="w-4 h-4" />
                  <span>AI Match</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleUploadFile}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                    inputValue.trim()
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CommandButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function CommandButton({ icon, label, isActive, onClick }: CommandButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
        isActive
          ? "bg-blue-50 border-blue-200 shadow-sm"
          : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className={`${isActive ? "text-blue-600" : "text-gray-500"}`}>
        {icon}
      </div>
      <span
        className={`text-sm font-medium ${
          isActive ? "text-blue-700" : "text-gray-700"
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}

// Main GlobalTrial Homepage Component
export default function GlobalTrialHomepage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const router = useRouter();

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemFadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  if (showAIAssistant) {
    return <AIAssistantInterface />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">GlobalTrial</span>
          </Link>
          
          <nav className="hidden md:flex gap-6">
            <Link href="/trials" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
              Browse Trials
            </Link>
            <Link href="/search" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
              Advanced Search
            </Link>
            <Link href="/sponsors" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
              For Sponsors
            </Link>
            <a href="#contact" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
              Contact
            </a>
          </nav>
          
          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
            <Button size="sm" onClick={() => router.push('/patient')}>
              Get Started
            </Button>
          </div>
          
          <button 
            className="flex md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              <Link href="/trials" className="block text-gray-600 hover:text-blue-600">Browse Trials</Link>
              <Link href="/search" className="block text-gray-600 hover:text-blue-600">Advanced Search</Link>
              <Link href="/sponsors" className="block text-gray-600 hover:text-blue-600">For Sponsors</Link>
              <a href="#contact" className="block text-gray-600 hover:text-blue-600">Contact</a>
              <div className="flex flex-col gap-2 pt-4">
                <Button variant="outline" size="sm">Sign In</Button>
                <Button size="sm" onClick={() => router.push('/patient')}>Get Started</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* Hero Section */}
        <section className="py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="text-center max-w-4xl mx-auto"
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="text-4xl md:text-6xl font-bold text-gray-900 mb-6"
              >
                <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                  GlobalTrial
                </span>
                <br />
                AI-Powered Clinical Trial Matching
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
              >
                Connecting patients with life-changing clinical trials worldwide using advanced AI technology
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
              >
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600 text-white px-8"
                  onClick={() => setShowAIAssistant(true)}
                >
                  <Bot className="w-5 h-5 mr-2" />
                  Start Chat with AI Assistant
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="px-8"
                  onClick={() => router.push('/patient')}
                >
                  Use Traditional Form
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.6 }}
                className="mb-12"
              >
                <Link href="/trials" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
                  Browse All 47,620 Trials
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
            >
              <motion.div variants={itemFadeIn} className="space-y-2">
                <div className="text-4xl font-bold text-blue-600">47,620</div>
                <div className="text-gray-600">Active Trials</div>
              </motion.div>
              <motion.div variants={itemFadeIn} className="space-y-2">
                <div className="text-4xl font-bold text-green-600">144</div>
                <div className="text-gray-600">Conditions Covered</div>
              </motion.div>
              <motion.div variants={itemFadeIn} className="space-y-2">
                <div className="text-4xl font-bold text-purple-600">100%</div>
                <div className="text-gray-600">Free to Use</div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Key Benefits Section */}
        <section className="py-16 bg-gradient-to-r from-blue-50 to-green-50">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Why Choose GlobalTrial?
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Discover the benefits of participating in clinical trials
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
            >
              <motion.div variants={itemFadeIn} className="bg-white rounded-lg p-8 shadow-sm border">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Award className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Earn compensation for participation
                </h3>
                <p className="text-gray-600">
                  Many trials offer compensation for your time and travel expenses, making participation financially beneficial.
                </p>
              </motion.div>

              <motion.div variants={itemFadeIn} className="bg-white rounded-lg p-8 shadow-sm border">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Access cutting-edge treatments
                </h3>
                <p className="text-gray-600">
                  Get early access to innovative treatments and therapies that may not be available elsewhere.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Powerful Features
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Advanced technology to help you find the perfect clinical trial match
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <motion.div variants={itemFadeIn}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                      <BrainCircuit className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">AI Matching</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Our AI analyzes your medical history and preferences to find the most suitable trials for you.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemFadeIn}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <Database className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Global Database</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Access trials from ClinicalTrials.gov, EU CTR, and other major databases worldwide in one place.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemFadeIn}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                      <Clock className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Real-time Updates</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Get instant notifications about trial status updates, new opportunities, and important deadlines.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-green-500">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Find Your Perfect Trial?
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Join thousands of patients who have found life-changing treatments through our platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-white text-blue-600 hover:bg-gray-100 px-8"
                  onClick={() => setShowAIAssistant(true)}
                >
                  <Bot className="w-5 h-5 mr-2" />
                  Start with AI Assistant
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-white text-white hover:bg-white hover:text-blue-600 px-8"
                  href="/trials"
                >
                  Browse All Trials
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t bg-muted/50">
        <div className="container px-4 py-12 md:px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-lg">GlobalTrial</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Connecting patients with clinical trials worldwide through AI-powered matching.
              </p>
              <div className="flex space-x-4">
                {[
                  { icon: <Facebook className="h-5 w-5" />, label: "Facebook" },
                  { icon: <Twitter className="h-5 w-5" />, label: "Twitter" },
                  { icon: <Linkedin className="h-5 w-5" />, label: "LinkedIn" },
                  { icon: <Instagram className="h-5 w-5" />, label: "Instagram" },
                ].map((social, index) => (
                  <Link
                    key={index}
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {social.icon}
                    <span className="sr-only">{social.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">For Patients</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <Link href="/trials" className="text-muted-foreground hover:text-foreground">Find Trials</Link>
                <Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">How It Works</Link>
                <Link href="/safety-privacy" className="text-muted-foreground hover:text-foreground">Safety & Privacy</Link>
                <Link href="/faqs" className="text-muted-foreground hover:text-foreground">FAQs</Link>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">For Researchers</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <Link href="/list-trial" className="text-muted-foreground hover:text-foreground">List Your Trial</Link>
                <Link href="/recruitment-tools" className="text-muted-foreground hover:text-foreground">Recruitment Tools</Link>
                <Link href="/analytics" className="text-muted-foreground hover:text-foreground">Analytics</Link>
                <Link href="/support" className="text-muted-foreground hover:text-foreground">Support</Link>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contact Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-muted-foreground">support@globaltrial.com</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span className="text-muted-foreground">+46 31 123 4567</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span className="text-muted-foreground">Gothenburg, Sweden</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 GlobalTrial. All rights reserved.
            </p>
            <nav className="flex gap-4 text-sm">
              <Link href="/privacy-policy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link>
              <Link href="/terms-of-service" className="text-muted-foreground hover:text-foreground">Terms of Service</Link>
              <Link href="/cookie-policy" className="text-muted-foreground hover:text-foreground">Cookie Policy</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}