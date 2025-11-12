'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { AuthService } from '@/lib/services/auth.service';
import { FirestoreService } from '@/lib/services/firestore.service';
import { Patient, Reading } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Users, Activity, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function DoctorDashboard() {
  const router = useRouter();
  const { user, userRole, loading } = useAuthStore();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientReadings, setPatientReadings] = useState<Reading[]>([]);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'doctor')) {
      router.push('/login');
    }
  }, [user, userRole, loading, router]);

  useEffect(() => {
    // In a real app, fetch assigned patients from Firestore
    // For now, this is a placeholder
  }, [user]);

  const handleSignOut = async () => {
    await AuthService.signOut();
    router.push('/login');
  };

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    const readings = await FirestoreService.getReadings(patient.id, 10);
    setPatientReadings(readings);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
              <p className="text-sm text-gray-600">Monitor your patients' health</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patients List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Assigned Patients
                </CardTitle>
                <CardDescription>{patients.length} patients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {patients.length === 0 ? (
                  <p className="text-sm text-gray-600">No patients assigned yet</p>
                ) : (
                  patients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className={`w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors ${
                        selectedPatient?.id === patient.id ? 'border-teal-600 bg-teal-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-sm text-gray-600">{patient.email}</p>
                        </div>
                        <Badge variant="secondary">{patient.conditions.length} conditions</Badge>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Patient Details */}
          <div className="lg:col-span-2">
            {!selectedPatient ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Select a patient to view their details</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Patient Info */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{selectedPatient.name}</CardTitle>
                        <CardDescription>{selectedPatient.email}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{selectedPatient.points}</div>
                        <div className="text-sm text-gray-600">points</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Age</p>
                        <p className="font-medium">{selectedPatient.age || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Gender</p>
                        <p className="font-medium">{selectedPatient.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Streak</p>
                        <p className="font-medium">{selectedPatient.streak} days</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">ABHA Linked</p>
                        <p className="font-medium">{selectedPatient.abhaLinked ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                    {selectedPatient.conditions.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">Conditions</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedPatient.conditions.map((condition, index) => (
                            <Badge key={index} variant="secondary">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Readings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Health Readings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {patientReadings.length === 0 ? (
                      <p className="text-sm text-gray-600">No readings available</p>
                    ) : (
                      patientReadings.map((reading) => (
                        <div key={reading.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium">
                              {format(reading.createdAt, 'MMM d, yyyy • h:mm a')}
                            </p>
                            <Badge variant="outline">{reading.source}</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {reading.glucose && (
                              <div className="text-center p-2 bg-blue-50 rounded">
                                <p className="text-xs text-gray-600">Glucose</p>
                                <p className="font-medium">{reading.glucose} mg/dL</p>
                              </div>
                            )}
                            {reading.bpSystolic && reading.bpDiastolic && (
                              <div className="text-center p-2 bg-red-50 rounded">
                                <p className="text-xs text-gray-600">BP</p>
                                <p className="font-medium">
                                  {reading.bpSystolic}/{reading.bpDiastolic}
                                </p>
                              </div>
                            )}
                            {reading.heartRate && (
                              <div className="text-center p-2 bg-pink-50 rounded">
                                <p className="text-xs text-gray-600">HR</p>
                                <p className="font-medium">{reading.heartRate} bpm</p>
                              </div>
                            )}
                            {reading.steps && (
                              <div className="text-center p-2 bg-green-50 rounded">
                                <p className="text-xs text-gray-600">Steps</p>
                                <p className="font-medium">{reading.steps.toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
