'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, ExternalLink, Copy } from 'lucide-react';
import { useState } from 'react';

export default function SetupPage() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const envTemplate = `# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id`;

  const copyToClipboard = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4 flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-orange-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Firebase Setup Required</h1>
          <p className="text-lg text-gray-600">
            Let's get your health monitoring app connected to Firebase
          </p>
        </div>

        {/* Steps */}
        <div className="grid gap-4">
          {/* Step 1 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white text-sm font-bold">
                  1
                </span>
                Create or Select Firebase Project
              </CardTitle>
              <CardDescription>Set up your Firebase backend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Go to Firebase Console and create a new project or select an existing one.
              </p>
              <Button
                variant="outline"
                onClick={() => window.open('https://console.firebase.google.com/', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Firebase Console
              </Button>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white text-sm font-bold">
                  2
                </span>
                Enable Firebase Services
              </CardTitle>
              <CardDescription>Configure Authentication and Firestore</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Enable Authentication:</h4>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                  <li>Click "Authentication" in the left sidebar</li>
                  <li>Click "Get started"</li>
                  <li>Select "Email/Password" provider</li>
                  <li>Toggle "Enable" and click "Save"</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Create Firestore Database:</h4>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                  <li>Click "Firestore Database" in the left sidebar</li>
                  <li>Click "Create database"</li>
                  <li>Choose "Start in production mode"</li>
                  <li>Select your preferred location</li>
                  <li>Click "Enable"</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white text-sm font-bold">
                  3
                </span>
                Get Your Firebase Configuration
              </CardTitle>
              <CardDescription>Copy your project credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>In Firebase Console, click the gear icon ⚙️ next to "Project Overview"</li>
                <li>Select "Project settings"</li>
                <li>Scroll down to "Your apps" section</li>
                <li>Click the Web icon {"(</>)"} to add a web app</li>
                <li>Register your app and copy the configuration values</li>
              </ol>
            </CardContent>
          </Card>

          {/* Step 4 */}
          <Card className="border-2 border-teal-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white text-sm font-bold">
                  4
                </span>
                Update Your .env.local File
              </CardTitle>
              <CardDescription>Add your Firebase credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Open the <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file in
                your project root and replace the placeholder values:
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                  {envTemplate}
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(envTemplate, 4)}
                >
                  {copiedStep === 4 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 5 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white text-sm font-bold">
                  5
                </span>
                Restart Development Server
              </CardTitle>
              <CardDescription>Apply the changes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">After updating the .env.local file:</p>
              <div className="bg-gray-900 text-gray-100 p-3 rounded-lg">
                <code className="text-sm">npm run dev</code>
              </div>
              <p className="text-sm text-gray-600">
                The app will automatically reload with your Firebase configuration.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Help Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Need More Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-blue-800">
              Check out these resources for detailed setup instructions:
            </p>
            <ul className="list-disc list-inside text-sm text-blue-800 space-y-1 ml-2">
              <li>
                <code className="bg-blue-100 px-2 py-0.5 rounded">SETUP_GUIDE.md</code> - Complete
                setup walkthrough
              </li>
              <li>
                <code className="bg-blue-100 px-2 py-0.5 rounded">README_NEXTJS.md</code> - Full
                documentation
              </li>
              <li>
                <a
                  href="https://firebase.google.com/docs/web/setup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Firebase Documentation
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
