'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FirestoreService } from '@/lib/services/firestore.service';
import { User, Stethoscope } from 'lucide-react';

interface DoctorProfileSetupProps {
  userId: string;
  email: string;
  onComplete: () => void;
}

export function DoctorProfileSetup({ userId, email, onComplete }: DoctorProfileSetupProps) {
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [hospital, setHospital] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !specialization.trim()) {
      alert('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await FirestoreService.saveDoctor({
        id: userId,
        name: name.trim(),
        email,
        specialization: specialization.trim(),
        licenseNumber: licenseNumber.trim() || undefined,
        hospital: hospital.trim() || undefined,
        phone: phone.trim() || undefined,
        assignedPatientIds: [],
        createdAt: new Date(),
      });
      
      onComplete();
    } catch (error) {
      console.error('Error creating doctor profile:', error);
      alert('Failed to create profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-600 to-teal-600 flex items-center justify-center">
              <Stethoscope className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Complete Your Doctor Profile</CardTitle>
          <CardDescription>
            Please provide your professional information to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Dr. John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialization">Specialization *</Label>
              <Input
                id="specialization"
                type="text"
                placeholder="Cardiology, General Physician, etc."
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="licenseNumber">Medical License Number</Label>
              <Input
                id="licenseNumber"
                type="text"
                placeholder="Optional"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital/Clinic</Label>
              <Input
                id="hospital"
                type="text"
                placeholder="Optional"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Optional"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-teal-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating Profile...' : 'Complete Setup'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
