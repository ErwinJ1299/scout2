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
import { Textarea } from '@/components/ui/textarea';
import { ModernTimePicker } from '@/components/time-picker/ModernTimePicker';
import { ArrowLeft, Bell, Calendar, Clock, Pill, Droplet, Activity, CheckCircle2 } from 'lucide-react';
import { Reminder } from '@/types';

export default function AddReminderPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    type: 'medicine' as 'medicine' | 'exercise' | 'checkup' | 'meal' | 'water' | 'other',
    time: '',
    days: [] as number[],
    description: '',
  });

  const daysOfWeek = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  const reminderTypes = [
    { value: 'medicine', label: 'Medicine', icon: Pill },
    { value: 'exercise', label: 'Exercise', icon: Activity },
    { value: 'checkup', label: 'Checkup', icon: Calendar },
    { value: 'meal', label: 'Meal', icon: Droplet },
  ];

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title || !formData.time || formData.days.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const reminder: Reminder = {
        id: `reminder_${Date.now()}`,
        patientId: user.uid,
        label: formData.title,
        type: formData.type,
        time: formData.time,
        daysOfWeek: formData.days,
        isActive: true,
        createdAt: new Date(),
      };

      await FirestoreService.addReminder(reminder);
      router.push('/patient/dashboard');
    } catch (err) {
      setError('Failed to create reminder. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-teal-50 to-blue-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Reminder</h1>
            <p className="text-gray-600 mt-1">Set up a new health reminder</p>
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
          {/* Reminder Type */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Bell className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Reminder Type</CardTitle>
                  <CardDescription>What would you like to be reminded about?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {reminderTypes.map((type) => {
                  const Icon = type.icon;
                  const isSelected = formData.type === type.value;
                  return (
                    <Button
                      key={type.value}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => setFormData((prev) => ({ ...prev, type: type.value as any }))}
                      className={`h-auto py-4 flex-col gap-2 ${
                        isSelected
                          ? 'bg-teal-600 hover:bg-teal-700 text-white'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-teal-600'}`} />
                      <span className="text-sm font-medium">{type.label}</span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Reminder Details */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Reminder Details</CardTitle>
              <CardDescription>Provide information about this reminder</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Take Blood Pressure Medication"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  required
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description <span className="text-gray-400">(Optional)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Additional notes or instructions..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="text-base resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Time */}
          <Card className="border-blue-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Time</CardTitle>
                    <CardDescription>When should we remind you?</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Required</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="time" className="text-sm font-medium">
                  Reminder Time <span className="text-red-500">*</span>
                </Label>
                <ModernTimePicker
                  value={formData.time}
                  onChange={(newTime) => setFormData((prev) => ({ ...prev, time: newTime }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Days of Week */}
          <Card className="border-purple-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Days of Week</CardTitle>
                    <CardDescription>
                      Select the days {formData.days.length > 0 && `(${formData.days.length} selected)`}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Required</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => {
                  const isSelected = formData.days.includes(day.value);
                  return (
                    <Button
                      key={day.value}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => toggleDay(day.value)}
                      className={`w-14 h-14 rounded-full text-sm font-semibold ${
                        isSelected
                          ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {day.label}
                    </Button>
                  );
                })}
              </div>
              {formData.days.length === 0 && (
                <p className="text-sm text-amber-600 mt-3 flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  Please select at least one day
                </p>
              )}
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()} 
              className="flex-1 sm:flex-initial sm:w-32"
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
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Create Reminder
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
