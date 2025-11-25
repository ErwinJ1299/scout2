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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
          <p className="text-muted-foreground">Monitor your patients' health</p>
        </div>
      </div>

      {/* Fix Button (temporary) - Uncomment if needed */}
      {/* {user && (
        <div className="mb-6">
          <FixAcceptedRequestsButton doctorId={user.uid} />
        </div>
      )} */}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assigned Patients</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedPatients.length}</div>
            <p className="text-xs text-gray-600 mt-1">Active patients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Send className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sentRequests.filter((r) => r.status === 'pending').length}
            </div>
            <p className="text-xs text-gray-600 mt-1">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Specialization</CardTitle>
            <Activity className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{doctor?.specialization || 'General'}</div>
            <p className="text-xs text-gray-600 mt-1">Your specialty</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assigned" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="assigned">Assigned Patients</TabsTrigger>
          <TabsTrigger value="find">Find Patients</TabsTrigger>
          <TabsTrigger value="requests">Sent Requests</TabsTrigger>
        </TabsList>

        {/* Assigned Patients Tab */}
        <TabsContent value="assigned" className="space-y-6">
          {assignedPatients.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No patients assigned yet
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Send requests to patients to start monitoring their health
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedPatients.map((patient) => (
                <Card key={patient.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{patient.name}</CardTitle>
                        <CardDescription>{patient.email}</CardDescription>
                      </div>
                      <Heart className="h-5 w-5 text-red-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {patient.age && <p>Age: {patient.age} years</p>}
                      {patient.gender && <p>Gender: {patient.gender}</p>}
                      {patient.conditions && patient.conditions.length > 0 && (
                        <div>
                          <p className="font-semibold">Conditions:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {patient.conditions.map((condition, idx) => (
                              <Badge key={idx} variant="secondary">
                                {condition}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => router.push(`/doctor/patients/${patient.id}`)}
                      className="w-full mt-4"
                      variant="outline"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Full Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Find Patients Tab */}
        <TabsContent value="find" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Find Patients</CardTitle>
              <CardDescription>Search for patients to send connection requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, or ABHA number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {availablePatients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No patients found matching your search</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availablePatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-sm text-gray-600">{patient.email}</p>
                        {patient.abhaNumber && (
                          <p className="text-xs text-gray-500">ABHA: {patient.abhaNumber}</p>
                        )}
                      </div>
                      <Button
                        onClick={() => {
                          setSelectedPatient(patient);
                          setIsRequestDialogOpen(true);
                        }}
                        size="sm"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Send Request
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sent Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sent Requests</CardTitle>
              <CardDescription>Track your patient connection requests</CardDescription>
            </CardHeader>
            <CardContent>
              {sentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No requests sent yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{request.patientName}</p>
                        <p className="text-sm text-gray-600">{request.patientEmail}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Sent: {format(request.createdAt, 'MMM d, yyyy h:mm a')}
                        </p>
                        {request.message && (
                          <p className="text-sm text-gray-700 mt-2 italic">"{request.message}"</p>
                        )}
                      </div>
                      <Badge
                        variant={
                          request.status === 'accepted'
                            ? 'default'
                            : request.status === 'pending'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {request.status === 'accepted' && <Check className="h-3 w-3 mr-1" />}
                        {request.status === 'rejected' && <X className="h-3 w-3 mr-1" />}
                        {request.status === 'pending' && <Send className="h-3 w-3 mr-1" />}
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
