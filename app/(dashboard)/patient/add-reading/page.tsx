'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { FirestoreService } from '@/lib/services/firestore.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Activity, Heart, Droplet, Footprints, Weight, CheckCircle2 } from 'lucide-react';
import { Reading } from '@/types';

export default function AddReadingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    bloodGlucose: '',
    steps: '',
    weight: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const reading: Reading = {
        id: `reading_${Date.now()}`,
        patientId: user.uid,
        createdAt: new Date(),
        source: 'manual',
        bpSystolic: formData.systolicBP ? Number(formData.systolicBP) : undefined,
        bpDiastolic: formData.diastolicBP ? Number(formData.diastolicBP) : undefined,
        heartRate: formData.heartRate ? Number(formData.heartRate) : undefined,
        glucose: formData.bloodGlucose ? Number(formData.bloodGlucose) : undefined,
        steps: formData.steps ? Number(formData.steps) : undefined,
        weight: formData.weight ? Number(formData.weight) : undefined,
      };

      await FirestoreService.addReading(reading);
      router.push('/patient/dashboard');
    } catch (err) {
      setError('Failed to save health reading. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Log Health Data</h1>
            <p className="text-gray-600 mt-1">Track your vital signs and daily metrics</p>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Blood Pressure */}
          <Card className="border-red-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Heart className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Blood Pressure</CardTitle>
                    <CardDescription>Systolic and Diastolic readings</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">mmHg</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="systolicBP" className="text-sm font-medium">
                  Systolic (Top)
                </Label>
                <Input
                  id="systolicBP"
                  type="number"
                  placeholder="120"
                  value={formData.systolicBP}
                  onChange={(e) => handleChange('systolicBP', e.target.value)}
                  min="0"
                  max="300"
                  className="text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diastolicBP" className="text-sm font-medium">
                  Diastolic (Bottom)
                </Label>
                <Input
                  id="diastolicBP"
                  type="number"
                  placeholder="80"
                  value={formData.diastolicBP}
                  onChange={(e) => handleChange('diastolicBP', e.target.value)}
                  min="0"
                  max="200"
                  className="text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Heart Rate */}
          <Card className="border-pink-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Activity className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Heart Rate</CardTitle>
                    <CardDescription>Your pulse reading</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">bpm</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="heartRate" className="text-sm font-medium">
                  Beats per Minute
                </Label>
                <Input
                  id="heartRate"
                  type="number"
                  placeholder="72"
                  value={formData.heartRate}
                  onChange={(e) => handleChange('heartRate', e.target.value)}
                  min="0"
                  max="300"
                  className="text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Blood Glucose */}
          <Card className="border-blue-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Droplet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Blood Glucose</CardTitle>
                    <CardDescription>Blood sugar level</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">mg/dL</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="bloodGlucose" className="text-sm font-medium">
                  Glucose Level
                </Label>
                <Input
                  id="bloodGlucose"
                  type="number"
                  placeholder="100"
                  value={formData.bloodGlucose}
                  onChange={(e) => handleChange('bloodGlucose', e.target.value)}
                  min="0"
                  max="600"
                  className="text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Steps */}
          <Card className="border-green-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Footprints className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Daily Steps</CardTitle>
                    <CardDescription>Physical activity tracking</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">steps</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="steps" className="text-sm font-medium">
                  Step Count
                </Label>
                <Input
                  id="steps"
                  type="number"
                  placeholder="5000"
                  value={formData.steps}
                  onChange={(e) => handleChange('steps', e.target.value)}
                  min="0"
                  max="100000"
                  className="text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Weight */}
          <Card className="border-purple-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Weight className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Weight</CardTitle>
                    <CardDescription>Body weight measurement</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">kg</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-sm font-medium">
                  Weight (Kilograms)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="70"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  min="0"
                  max="500"
                  step="0.1"
                  className="text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()} 
              className="flex-1 sm:flex-initial sm:w-32 h-11 rounded-lg border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white shadow-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Health Data
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
