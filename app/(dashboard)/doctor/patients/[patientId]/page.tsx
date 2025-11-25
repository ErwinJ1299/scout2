'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { FirestoreService } from '@/lib/services/firestore.service';
import { Patient, Reading, Reminder, GamificationProgress, ClinicalNote, Doctor } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Activity,
  Heart,
  Trophy,
  Flame,
  Calendar,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  TrendingUp,
  Clock,
  Target,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';
import { HealthCharts } from '@/components/health-charts';
import { DoctorProfileSetup } from '@/components/doctor-profile-setup';

export default function PatientDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.patientId as string;
  const { user, userRole, loading: authLoading } = useAuthStore();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'doctor')) {
      router.push('/login');
    }
  }, [user, userRole, authLoading, router]);

  useEffect(() => {
    if (!patientId || !user) return;

    const loadPatientData = async () => {
      try {
        setLoading(true);
        
        // Load patient info
        const patientData = await FirestoreService.getPatient(patientId);
        setPatient(patientData);
        console.log('Patient loaded:', patientData);

        // Subscribe to doctor info for real-time updates
        const unsubscribeDoctor = FirestoreService.subscribeToDoctor(user.uid, (doctorData) => {
          console.log('Doctor data received:', doctorData);
          if (!doctorData) {
            console.error('No doctor document found for user:', user.uid);
            console.error('Please ensure you signed up as a doctor with a specialization');
          }
          setDoctor(doctorData);
        });

        // Subscribe to readings
        const unsubscribeReadings = FirestoreService.subscribeToReadings(
          patientId,
          setReadings,
          50
        );

        // Subscribe to reminders
        const unsubscribeReminders = FirestoreService.subscribeToReminders(
          patientId,
          setReminders
        );

        // Subscribe to clinical notes
        const unsubscribeNotes = FirestoreService.subscribeToClinicalNotes(
          patientId,
          setClinicalNotes
        );

        // Load gamification progress
        const progressData = await FirestoreService.getGamificationProgress(patientId);
        setProgress(progressData);

        setLoading(false);

        return () => {
          unsubscribeDoctor();
          unsubscribeReadings();
          unsubscribeReminders();
          unsubscribeNotes();
        };
      } catch (error) {
        console.error('Error loading patient data:', error);
        setLoading(false);
      }
    };

    loadPatientData();
  }, [patientId, user]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !patient) {
      console.error('Missing required data:', { noteText: !!noteText.trim(), doctor: !!doctor, patient: !!patient });
      alert('Unable to add note. Please ensure all required information is available.');
      return;
    }

    if (!doctor) {
      alert('Doctor profile not loaded. Please refresh the page and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Adding clinical note with data:', {
        patientId: patient.id,
        doctorId: doctor.id,
        doctorName: doctor.name,
        note: noteText,
      });

      await FirestoreService.addClinicalNote({
        patientId: patient.id,
        doctorId: doctor.id,
        doctorName: doctor.name,
        note: noteText,
        recommendation: recommendation || undefined,
        diagnosis: diagnosis || undefined,
        isPriority,
      });

      setNoteText('');
      setRecommendation('');
      setDiagnosis('');
      setIsPriority(false);
      setIsNoteDialogOpen(false);
    } catch (error) {
      console.error('Error adding clinical note:', error);
      alert('Failed to add clinical note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Patient not found</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!loading && !doctor) {
    return (
      <DoctorProfileSetup
        userId={user!.uid}
        email={user!.email!}
        onComplete={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-teal-600 flex items-center justify-center text-white text-xl font-bold">
                  {patient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{patient.name}</h1>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {patient.email}
                  </p>
                </div>
              </div>
            </div>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-teal-600"
              onClick={() => setIsNoteDialogOpen(true)}
              disabled={!doctor}
              title={!doctor ? "Loading doctor information..." : "Add clinical note"}
            >
              <FileText className="h-4 w-4 mr-2" />
              Add Clinical Note
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Age</p>
                  <p className="text-3xl font-bold text-blue-700 mt-1">
                    {patient.age || 'N/A'}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">years old</p>
                </div>
                <User className="h-10 w-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Points</p>
                  <p className="text-3xl font-bold text-purple-700 mt-1">
                    {patient.points || 0}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">points earned</p>
                </div>
                <Trophy className="h-10 w-10 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Streak</p>
                  <p className="text-3xl font-bold text-orange-700 mt-1">
                    {patient.streak || 0}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">days active</p>
                </div>
                <Flame className="h-10 w-10 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Readings</p>
                  <p className="text-3xl font-bold text-green-700 mt-1">
                    {readings.length}
                  </p>
                  <p className="text-xs text-green-600 mt-1">total records</p>
                </div>
                <Activity className="h-10 w-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-pink-600">Reminders</p>
                  <p className="text-3xl font-bold text-pink-700 mt-1">
                    {reminders.filter(r => r.isActive).length}
                  </p>
                  <p className="text-xs text-pink-600 mt-1">active tasks</p>
                </div>
                <Clock className="h-10 w-10 text-pink-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-12">
            <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
            <TabsTrigger value="health" className="text-sm">Health Trends</TabsTrigger>
            <TabsTrigger value="readings" className="text-sm">All Readings</TabsTrigger>
            <TabsTrigger value="notes" className="text-sm">Clinical Notes</TabsTrigger>
            <TabsTrigger value="reminders" className="text-sm">Reminders</TabsTrigger>
            <TabsTrigger value="progress" className="text-sm">Progress</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Patient Information */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-500" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Gender</p>
                    <p className="text-base font-medium mt-1">{patient.gender || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Date of Birth</p>
                    <p className="text-base font-medium mt-1">
                      {patient.dateOfBirth ? format(patient.dateOfBirth, 'MMM d, yyyy') : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">ABHA Number</p>
                    <p className="text-base font-medium mt-1">
                      {patient.abhaNumber || <span className="text-gray-400 italic">Not linked</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Registration Date</p>
                    <p className="text-base font-medium mt-1">
                      {format(patient.createdAt, 'MMM d, yyyy')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Medical Conditions */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    Medical Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {patient.conditions && patient.conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.conditions.map((condition, idx) => (
                        <Badge
                          key={idx}
                          className="px-4 py-2 text-sm bg-red-50 text-red-700 border-red-200"
                        >
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">No medical conditions recorded</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Latest Reading */}
            {readings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    Latest Reading
                  </CardTitle>
                  <CardDescription>
                    {format(readings[0].createdAt, 'MMMM d, yyyy • h:mm a')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {readings[0].bpSystolic && readings[0].bpDiastolic && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <Heart className="h-5 w-5 text-red-600" />
                          </div>
                          <span>Blood Pressure</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {readings[0].bpSystolic}/{readings[0].bpDiastolic}
                        </p>
                        <p className="text-xs text-gray-500">mmHg</p>
                      </div>
                    )}
                    {readings[0].glucose && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-orange-600" />
                          </div>
                          <span>Glucose</span>
                        </div>
                        <p className="text-2xl font-bold">{readings[0].glucose}</p>
                        <p className="text-xs text-gray-500">mg/dL</p>
                      </div>
                    )}
                    {readings[0].heartRate && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center">
                            <Heart className="h-5 w-5 text-pink-600" />
                          </div>
                          <span>Heart Rate</span>
                        </div>
                        <p className="text-2xl font-bold">{readings[0].heartRate}</p>
                        <p className="text-xs text-gray-500">bpm</p>
                      </div>
                    )}
                    {readings[0].weight && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <span>Weight</span>
                        </div>
                        <p className="text-2xl font-bold">{readings[0].weight}</p>
                        <p className="text-xs text-gray-500">kg</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Health Trends Tab */}
          <TabsContent value="health" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-teal-500" />
                  Health Trends Over Time
                </CardTitle>
                <CardDescription>Comprehensive view of all health metrics</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {readings.length > 0 ? (
                  <div className="h-[500px]">
                    <HealthCharts readings={readings} />
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-400">
                    <Activity className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>No health data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Readings Tab */}
          <TabsContent value="readings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  All Health Readings
                </CardTitle>
                <CardDescription>Complete history of health measurements</CardDescription>
              </CardHeader>
              <CardContent>
                {readings.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>No readings recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {readings.map((reading) => (
                      <div
                        key={reading.id}
                        className="flex flex-col gap-4 p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <p className="font-semibold">
                              {format(reading.createdAt, 'MMMM d, yyyy • h:mm a')}
                            </p>
                          </div>
                          <Badge variant="outline">{reading.source}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {reading.bpSystolic && reading.bpDiastolic && (
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                                <Heart className="h-6 w-6 text-red-600" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Blood Pressure</p>
                                <p className="text-lg font-semibold">
                                  {reading.bpSystolic}/{reading.bpDiastolic}
                                </p>
                              </div>
                            </div>
                          )}
                          {reading.glucose && (
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                                <Activity className="h-6 w-6 text-orange-600" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Glucose</p>
                                <p className="text-lg font-semibold">{reading.glucose} mg/dL</p>
                              </div>
                            </div>
                          )}
                          {reading.heartRate && (
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center">
                                <Heart className="h-6 w-6 text-pink-600" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Heart Rate</p>
                                <p className="text-lg font-semibold">{reading.heartRate} bpm</p>
                              </div>
                            </div>
                          )}
                          {reading.weight && (
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                <User className="h-6 w-6 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Weight</p>
                                <p className="text-lg font-semibold">{reading.weight} kg</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clinical Notes Tab */}
          <TabsContent value="notes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  Clinical Notes
                </CardTitle>
                <CardDescription>Doctor's notes and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                {clinicalNotes.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>No clinical notes added yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clinicalNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`p-6 border rounded-lg ${
                          note.isPriority ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-lg">{note.doctorName}</p>
                            <p className="text-sm text-gray-500">
                              {format(note.createdAt, 'MMMM d, yyyy • h:mm a')}
                            </p>
                          </div>
                          {note.isPriority && (
                            <Badge className="bg-red-600">Priority</Badge>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Note</p>
                            <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                          </div>
                          
                          {note.diagnosis && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Diagnosis</p>
                              <p className="text-gray-700">{note.diagnosis}</p>
                            </div>
                          )}
                          
                          {note.recommendation && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Recommendation</p>
                              <p className="text-gray-700">{note.recommendation}</p>
                            </div>
                          )}
                          
                          {note.medications && note.medications.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Medications</p>
                              <div className="flex flex-wrap gap-2">
                                {note.medications.map((med, idx) => (
                                  <Badge key={idx} variant="outline">{med}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reminders Tab */}
          <TabsContent value="reminders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Active Reminders & Tasks
                </CardTitle>
                <CardDescription>Patient's scheduled health tasks</CardDescription>
              </CardHeader>
              <CardContent>
                {reminders.filter(r => r.isActive).length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>No active reminders</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reminders
                      .filter(r => r.isActive)
                      .map((reminder) => (
                        <div
                          key={reminder.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Clock className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">{reminder.type}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(`2000-01-01T${reminder.time}`), 'h:mm a')}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">{reminder.type}</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Gamification Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Total Points</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {progress?.totalPoints || 0}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Current Streak</span>
                      <span className="text-2xl font-bold text-orange-600">
                        {progress?.currentStreak || 0} days
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Longest Streak</span>
                      <span className="text-2xl font-bold text-green-600">
                        {progress?.longestStreak || 0} days
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Tasks Today</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {progress?.tasksCompletedToday || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    Earned Badges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {progress?.earnedBadges && progress.earnedBadges.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {progress.earnedBadges.map((badge, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-3 border rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50"
                        >
                          <Award className="h-6 w-6 text-yellow-600" />
                          <span className="text-sm font-medium">{badge}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No badges earned yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Clinical Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Clinical Note</DialogTitle>
            <DialogDescription>
              Add clinical observations and recommendations for {patient?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note">Clinical Note *</Label>
              <Textarea
                id="note"
                placeholder="Enter your clinical observations, examination findings, etc."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Input
                id="diagnosis"
                placeholder="Enter diagnosis if applicable"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendation">Recommendations</Label>
              <Textarea
                id="recommendation"
                placeholder="Treatment recommendations, lifestyle changes, etc."
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="priority"
                checked={isPriority}
                onChange={(e) => setIsPriority(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="priority" className="cursor-pointer">
                Mark as priority
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsNoteDialogOpen(false);
                setNoteText('');
                setRecommendation('');
                setDiagnosis('');
                setIsPriority(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddNote}
              disabled={!noteText.trim() || isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-teal-600"
            >
              {isSubmitting ? 'Adding...' : 'Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
