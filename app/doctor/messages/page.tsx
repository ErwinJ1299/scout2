"use client";

import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { VideoCallModal } from "@/components/video-call-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, VideoIcon, ChevronLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useAuthStore } from "@/lib/store/auth.store";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface Conversation {
  id: string;
  patientId: string;
  patientName: string;
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
}

export default function DoctorMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
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

    // Listen for conversations where doctor is a participant
    console.log("Setting up conversations listener for doctor:", userId);
    const conversationsRef = collection(db, "conversations");
    const q = query(conversationsRef, where("participants", "array-contains", userId));

    const unsub = onSnapshot(q, async (snapshot) => {
      console.log("Received", snapshot.docs.length, "conversations");
      const convos: Conversation[] = [];
      const seenPatients = new Set<string>();

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const patientId = data.participants.find((id: string) => id !== userId);

        // Only include if there's a patient and we haven't seen them
        if (patientId && !seenPatients.has(patientId)) {
          seenPatients.add(patientId);

          // Get patient info
          try {
            const patientDoc = await getDoc(doc(db, "patients", patientId));
            const patientName = patientDoc.exists() ? patientDoc.data().name : "Patient";

            convos.push({
              id: docSnapshot.id,
              patientId,
              patientName,
              lastMessage: data.lastMessage || "",
              lastMessageTime: data.lastMessageTime,
              unreadCount: data.unreadCount?.[userId] || 0,
            });
          } catch (err) {
            console.error("Error fetching patient data:", err);
          }
        }
      }

      // Sort by last message time
      convos.sort((a, b) => {
        const timeA = a.lastMessageTime?.toMillis() || 0;
        const timeB = b.lastMessageTime?.toMillis() || 0;
        return timeB - timeA;
      });

      console.log("Processed conversations:", convos.length);
      setConversations(convos);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => unsub();
  }, [userId, router, toast]);

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
            
            // Get caller name
            const callerConv = conversations.find(c => c.patientId === callData.caller);
            toast({
              title: "Incoming Call",
              description: `${callerConv?.patientName || "A patient"} is calling...`,
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
  }, [userId, conversations, incomingCall, toast]);

  function handleVideoCall() {
    if (!selectedConversation) return;

    const newCallId = `call_${Date.now()}`;
    setCallId(newCallId);
    setVideoCallOpen(true);
  }

  async function handleAnswerCall() {
    if (incomingCall) {
      try {
        // Get call data to find the caller
        const callDoc = await getDoc(doc(db, "videoCalls", incomingCall));
        if (callDoc.exists()) {
          const callData = callDoc.data();
          const callerId = callData.caller;
          
          // Find the conversation with this caller
          const callerConv = conversations.find(c => c.patientId === callerId);
          if (callerConv) {
            setSelectedConversation(callerConv);
          }
        }
      } catch (error) {
        console.error("Error getting call data:", error);
      }
      
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

  // No conversations - show empty state
  if (conversations.length === 0) {
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
              No messages yet. When patients message you, their conversations will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show conversation list if no conversation selected, otherwise show chat
  if (!selectedConversation) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-4">
        <div className="max-w-6xl mx-auto h-full">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-white flex items-center">
              <MessageCircle className="mr-2 text-cyan-500" />
              Messages
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Chat with your patients
            </p>
          </div>

          <div className="space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className="w-full p-4 bg-slate-900 border border-slate-700 rounded-lg text-left hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-purple-600 text-white font-semibold">
                      {conv.patientName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white truncate">
                        {conv.patientName}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-cyan-500 text-white">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">
                      {conv.lastMessage || "No messages yet"}
                    </p>
                    {conv.lastMessageTime && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(conv.lastMessageTime.toMillis()).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show chat interface with selected conversation
  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto h-full">
        <div className="mb-4">
          <div className="flex items-center">
            {conversations.length > 1 && (
              <button
                onClick={() => setSelectedConversation(null)}
                className="mr-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-400" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center">
                <MessageCircle className="mr-2 text-cyan-500" />
                Messages
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Chat with {selectedConversation.patientName}
              </p>
            </div>
          </div>
        </div>

        <div className="h-[calc(100vh-120px)]">
          <ChatInterface
            conversationId={selectedConversation.id}
            currentUserId={userId}
            otherUserId={selectedConversation.patientId}
            otherUserName={selectedConversation.patientName}
            otherUserRole="patient"
            onVideoCall={handleVideoCall}
          />
        </div>

        {/* Video Call Modal */}
        {videoCallOpen && selectedConversation && callId && (
          <VideoCallModal
            isOpen={videoCallOpen}
            onClose={handleCallClose}
            callId={callId}
            isInitiator={!incomingCall}
            currentUserId={userId}
            otherUserId={selectedConversation.patientId}
            otherUserName={selectedConversation.patientName}
          />
        )}

        {/* Incoming Call Notification */}
        {incomingCall && !videoCallOpen && (
          <div className="fixed top-4 right-4 bg-slate-900 border-2 border-green-500 rounded-lg p-4 shadow-2xl animate-pulse z-50">
            <div className="flex items-center space-x-4">
              <VideoIcon className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-white font-semibold">Incoming Call</p>
                <p className="text-gray-400 text-sm">A patient is calling...</p>
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