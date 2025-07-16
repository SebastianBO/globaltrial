'use client'

import Link from "next/link";
import { Search } from 'lucide-react';

export default function Navigation() {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-blue-600">
            GlobalTrial
          </Link>
          
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-8">
            <form action="/search" method="get" className="relative">
              <input
                type="text"
                name="q"
                placeholder="Search clinical trials..."
                className="w-full px-4 py-2 pr-10 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-blue-600"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>
          </div>

          <div className="flex gap-6">
            <Link 
              href="/search" 
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Advanced Search
            </Link>
            <Link 
              href="/patient" 
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Find Trials
            </Link>
            <Link 
              href="/trials" 
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Browse All
            </Link>
            <Link 
              href="/sponsors" 
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              For Sponsors
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}