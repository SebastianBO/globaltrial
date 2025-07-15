import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GlobalTrial - AI Clinical Trial Matching",
  description: "Find the right clinical trials with AI-powered matching",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="text-xl font-bold text-blue-600">
                GlobalTrial
              </Link>
              <div className="flex gap-6">
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
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
