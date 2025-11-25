"use client";

import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { VideoCallModal } from "@/components/video-call-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, VideoIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { useAuthStore } from "@/lib/store/auth.store";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function PatientMessagesPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [callId, setCallId] = useState<string>("");
  const [incomingCall, setIncomingCall] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();

  const userId = user?.uid || "";

  useEffect(() => {
    if (!userId) {
      router.push("/login");
      return;
    }

    initializeConversation();
  }, [userId]);

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;

    const callsRef = collection(db, "videoCalls");
    const q = query(callsRef, where("receiver", "==", userId), where("status", "==", "ringing"));

    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const callData = change.doc.data();
          
          // Only accept calls that are less than 60 seconds old
          const callTime = callData.createdAt?.toMillis() || 0;
          const now = Date.now();
          const callAge = now - callTime;
          
          if (callAge < 60000) { // 60 seconds
            setIncomingCall(change.doc.id);
            setCallId(change.doc.id);
            toast({
              title: "Incoming Call",
              description: `${doctorName || "Your doctor"} is calling...`,
            });
          }
        }
        
        // Clear incoming call if status changes or call is removed
        if (change.type === "modified" || change.type === "removed") {
          if (change.doc.id === incomingCall) {
            setIncomingCall(null);
          }
        }
      });
    });

    return () => unsub();
  }, [userId, doctorName, incomingCall]);

  async function initializeConversation() {
    try {
      // Get patient data to find assigned doctor
      const patientDoc = await getDoc(doc(db, "patients", userId));
      if (!patientDoc.exists()) {
        toast({
          title: "Error",
          description: "Patient profile not found",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const patientData = patientDoc.data();
      const assignedDoctorId = patientData.doctorId;

      if (!assignedDoctorId) {
        toast({
          title: "No doctor assigned",
          description: "You need to be assigned to a doctor before you can message them.",
        });
        setLoading(false);
        return;
      }

      setDoctorId(assignedDoctorId);

      // Get doctor info
      const doctorDoc = await getDoc(doc(db, "doctors", assignedDoctorId));
      if (doctorDoc.exists()) {
        setDoctorName(doctorDoc.data().name || "Doctor");
      }

      // Find or create conversation
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", userId)
      );

      const snapshot = await getDocs(q);
      let existingConversation = null;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(assignedDoctorId)) {
          existingConversation = doc.id;
        }
      });

      if (existingConversation) {
        setConversationId(existingConversation);
      } else {
        // Create new conversation
        const newConvRef = doc(collection(db, "conversations"));
        await setDoc(newConvRef, {
          participants: [userId, assignedDoctorId],
          lastMessage: "",
          lastMessageTime: new Date(),
          unreadCount: {
            [userId]: 0,
            [assignedDoctorId]: 0,
          },
        });
        setConversationId(newConvRef.id);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error initializing conversation:", error);
      toast({
        title: "Error",
        description: "Failed to load messages. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  }

  function handleVideoCall() {
    if (!doctorId) {
      toast({
        title: "Error",
        description: "Cannot start call. Doctor not found.",
        variant: "destructive",
      });
      return;
    }

    const newCallId = `call_${Date.now()}`;
    setCallId(newCallId);
    setVideoCallOpen(true);
  }

  function handleAnswerCall() {
    if (incomingCall) {
      // Don't clear incomingCall yet - keep the call ID
      setVideoCallOpen(true);
    }
  }

  function handleCallClose() {
    setVideoCallOpen(false);
    setIncomingCall(null);
    setCallId("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-cyan-500 animate-pulse mx-auto mb-4" />
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!conversationId || !doctorId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 to-slate-900">
        <Card className="max-w-md bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <MessageCircle className="mr-2" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">
              You need to be assigned to a doctor before you can send messages.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto h-full">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white flex items-center">
            <MessageCircle className="mr-2 text-cyan-500" />
            Messages
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Chat with your healthcare provider
          </p>
        </div>

        <div className="h-[calc(100vh-120px)]">
          <ChatInterface
            conversationId={conversationId}
            currentUserId={userId}
            otherUserId={doctorId}
            otherUserName={doctorName}
            otherUserRole="doctor"
            onVideoCall={handleVideoCall}
          />
        </div>

        {/* Video Call Modal */}
        {videoCallOpen && callId && doctorId && (
          <VideoCallModal
            isOpen={videoCallOpen}
            onClose={handleCallClose}
            callId={callId}
            isInitiator={!incomingCall}
            currentUserId={userId}
            otherUserId={doctorId}
            otherUserName={doctorName}
          />
        )}

        {/* Incoming Call Notification */}
        {incomingCall && !videoCallOpen && (
          <div className="fixed top-4 right-4 bg-slate-900 border-2 border-green-500 rounded-lg p-4 shadow-2xl animate-pulse">
            <div className="flex items-center space-x-4">
              <VideoIcon className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-white font-semibold">Incoming Call</p>
                <p className="text-gray-400 text-sm">{doctorName} is calling...</p>
              </div>
              <button
                onClick={handleAnswerCall}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                Answer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
