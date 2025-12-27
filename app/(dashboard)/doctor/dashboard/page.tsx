'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { FirestoreService } from '@/lib/services/firestore.service';
import { Doctor, Patient, DoctorPatientRequest } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  UserPlus,
  Activity,
  Heart,
  Search,
  Send,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { FixAcceptedRequestsButton } from '@/components/fix-accepted-requests-button';
import { HealthAlertsDashboard } from '@/components/health-alerts-dashboard';

export default function DoctorDashboard() {
  const router = useRouter();
  const { user, userRole, loading } = useAuthStore();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [assignedPatients, setAssignedPatients] = useState<Patient[]>([]);
  const [sentRequests, setSentRequests] = useState<DoctorPatientRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [requestMessage, setRequestMessage] = useState('');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'doctor')) {
      router.push('/login');
    }
  }, [user, userRole, loading, router]);

  useEffect(() => {
    if (!user) return;

    const unsubscribeDoctor = FirestoreService.subscribeToDoctor(user.uid, setDoctor);
    const unsubscribeRequests = FirestoreService.subscribeToDoctorRequests(
      user.uid,
      (requests) => {
        console.log('Sent requests updated:', requests);
        setSentRequests(requests);
      }
    );

    // Load all patients
    FirestoreService.getAllPatients().then((patients) => {
      console.log('All patients loaded:', patients);
      setAllPatients(patients);
    }).catch((error) => {
      console.error('Error loading all patients:', error);
    });

    return () => {
      unsubscribeDoctor();
      unsubscribeRequests();
    };
  }, [user]);

  useEffect(() => {
    if (doctor) {
      console.log('Doctor profile loaded:', doctor);
      console.log('Assigned patient IDs:', doctor.assignedPatientIds);

      if (doctor.assignedPatientIds && doctor.assignedPatientIds.length > 0) {
        console.log('Loading assigned patients...');
        FirestoreService.getAssignedPatients(doctor.assignedPatientIds).then((patients) => {
          console.log('Assigned patients loaded:', patients);
          setAssignedPatients(patients);
        }).catch((error) => {
          console.error('Error loading assigned patients:', error);
          setAssignedPatients([]);
        });
      } else {
        console.log('No assigned patients');
        setAssignedPatients([]);
      }
    }
  }, [doctor]);

  const handleSendRequest = async () => {
    if (!user || !doctor || !selectedPatient) return;

    try {
      await FirestoreService.createDoctorPatientRequest({
        doctorId: user.uid,
        doctorName: doctor.name,
        doctorEmail: doctor.email,
        doctorSpecialization: doctor.specialization,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientEmail: selectedPatient.email,
        status: 'pending',
        message: requestMessage,
      });

      setIsRequestDialogOpen(false);
      setSelectedPatient(null);
      setRequestMessage('');
      alert('Request sent successfully!');
    } catch (error: any) {
      console.error('Error sending request:', error);
      if (error.message === 'A request already exists for this patient') {
        alert('You have already sent a request to this patient.');
      } else {
        alert('Failed to send request. Please try again.');
      }
    }
  };

  const filteredPatients = allPatients.filter((patient) => {
    const query = searchQuery.toLowerCase();
    return (
      patient.name.toLowerCase().includes(query) ||
      patient.email.toLowerCase().includes(query) ||
      (patient.abhaNumber && patient.abhaNumber.toLowerCase().includes(query))
    );
  });

  // Filter out patients who already have this doctor or have any existing request
  const availablePatients = filteredPatients.filter((patient) => {
    const hasDoctor = patient.doctorId === user?.uid;
    const hasExistingRequest = sentRequests.some(
      (req) => req.patientId === patient.id && (req.status === 'pending' || req.status === 'accepted')
    );
    return !hasDoctor && !hasExistingRequest;
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Doctor Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">Welcome back, Dr. {doctor?.name?.split(' ')[1] || 'Doctor'}</p>
          </div>
        </div>
      </div>

      {/* Fix Button (temporary) - Uncomment if needed */}
      {/* {user && (
        <div className="mb-6">
          <FixAcceptedRequestsButton doctorId={user.uid} />
        </div>
      )} */}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Assigned Patients</p>
              <p className="text-3xl font-bold mt-1">{assignedPatients.length}</p>
              <p className="text-blue-200 text-xs mt-1">Active patients</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10"></div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-5 text-white shadow-lg shadow-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Pending Requests</p>
              <p className="text-3xl font-bold mt-1">
                {sentRequests.filter((r) => r.status === 'pending').length}
              </p>
              <p className="text-orange-200 text-xs mt-1">Awaiting response</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Send className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10"></div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 p-5 text-white shadow-lg shadow-teal-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-sm font-medium">Specialization</p>
              <p className="text-xl font-bold mt-1">{doctor?.specialization || 'General'}</p>
              <p className="text-teal-200 text-xs mt-1">Your specialty</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Activity className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10"></div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assigned" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-xl p-1">
          <TabsTrigger value="assigned" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow">Assigned Patients</TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow">Health Alerts</TabsTrigger>
          <TabsTrigger value="find" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow">Find Patients</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow">Sent Requests</TabsTrigger>
        </TabsList>

        {/* Health Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          {user && <HealthAlertsDashboard doctorId={user.uid} />}
        </TabsContent>

        {/* Assigned Patients Tab */}
        <TabsContent value="assigned" className="space-y-6">
          {assignedPatients.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No patients assigned yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Send requests to patients to start monitoring their health
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{patient.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{patient.email}</p>
                      </div>
                    </div>
                    <Heart className="h-5 w-5 text-red-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    {patient.age && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span className="w-16 text-gray-400">Age:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{patient.age} years</span>
                      </div>
                    )}
                    {patient.gender && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span className="w-16 text-gray-400">Gender:</span>
                        <span className="font-medium text-gray-900 dark:text-white capitalize">{patient.gender}</span>
                      </div>
                    )}
                    {patient.conditions && patient.conditions.length > 0 && (
                      <div className="pt-2">
                        <p className="text-gray-400 text-xs mb-2">CONDITIONS</p>
                        <div className="flex flex-wrap gap-1">
                          {patient.conditions.map((condition, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            >
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/doctor/patients/${patient.id}`)}
                    className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-blue-500 hover:text-white text-gray-700 dark:text-gray-300 font-medium text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    View Full Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Find Patients Tab */}
        <TabsContent value="find" className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Find Patients</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Search for patients to send connection requests</p>
            </div>
            <div className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or ABHA number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-xl text-base"
                />
              </div>

              {availablePatients.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                    <Search className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">No patients found matching your search</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availablePatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                          {patient.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{patient.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{patient.email}</p>
                          {patient.abhaNumber && (
                            <p className="text-xs text-gray-400">ABHA: {patient.abhaNumber}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPatient(patient);
                          setIsRequestDialogOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/25"
                      >
                        <UserPlus className="h-4 w-4" />
                        Send Request
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Sent Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sent Requests</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Track your patient connection requests</p>
            </div>
            <div className="p-6">
              {sentRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                    <Send className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">No requests sent yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${request.status === 'accepted'
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                            : request.status === 'rejected'
                              ? 'bg-gradient-to-br from-red-400 to-rose-500'
                              : 'bg-gradient-to-br from-orange-400 to-amber-500'
                          }`}>
                          {request.patientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{request.patientName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{request.patientEmail}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Sent: {format(request.createdAt, 'MMM d, yyyy h:mm a')}
                          </p>
                          {request.message && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                              "{request.message}"
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${request.status === 'accepted'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : request.status === 'pending'
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}
                      >
                        {request.status === 'accepted' && <Check className="h-3 w-3" />}
                        {request.status === 'rejected' && <X className="h-3 w-3" />}
                        {request.status === 'pending' && <Send className="h-3 w-3" />}
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Send Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Connection Request</DialogTitle>
            <DialogDescription>
              Send a request to {selectedPatient?.name} to access their health data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-1">Patient</p>
              <p className="text-sm text-gray-600">{selectedPatient?.name}</p>
              <p className="text-xs text-gray-500">{selectedPatient?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Message (Optional)</label>
              <Textarea
                placeholder="Introduce yourself and explain why you'd like to monitor this patient's health..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendRequest}>
              <Send className="h-4 w-4 mr-2" />
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
