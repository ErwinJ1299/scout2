"use client";

import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { VideoCallModal } from "@/components/video-call-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, VideoIcon, User } from "lucide-react";
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

    loadConversations();
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
  }, [userId, conversations, incomingCall]);

  async function loadConversations() {
    try {
      const conversationsRef = collection(db, "conversations");
      const q = query(conversationsRef, where("participants", "array-contains", userId));

      const unsub = onSnapshot(q, async (snapshot) => {
        const convos: Conversation[] = [];

        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          const patientId = data.participants.find((id: string) => id !== userId);

          if (patientId) {
            // Get patient info
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
          }
        }

        // Sort by last message time
        convos.sort((a, b) => {
          const timeA = a.lastMessageTime?.toMillis() || 0;
          const timeB = b.lastMessageTime?.toMillis() || 0;
          return timeB - timeA;
        });

        setConversations(convos);
        setLoading(false);
      });

      return () => unsub();
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  }

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
          <p className="text-gray-400">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white flex items-center">
            <MessageCircle className="mr-2 text-cyan-500" />
            Patient Messages
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Communicate with your patients
          </p>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
          {/* Conversations List */}
          <Card className="col-span-4 bg-slate-900 border-slate-700 overflow-hidden flex flex-col">
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center p-6">
                  <div>
                    <User className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">No conversations yet</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Patients assigned to you will appear here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`w-full p-4 text-left hover:bg-slate-800 transition-colors ${
                        selectedConversation?.id === conv.id ? "bg-slate-800" : ""
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <Avatar>
                          <AvatarFallback className="bg-purple-600">
                            {conv.patientName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-white truncate">
                              {conv.patientName}
                            </p>
                            {conv.unreadCount > 0 && (
                              <Badge variant="default" className="bg-cyan-600">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 truncate">
                            {conv.lastMessage || "No messages yet"}
                          </p>
                          {conv.lastMessageTime && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(conv.lastMessageTime.toMillis()).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Area */}
          <div className="col-span-8">
            {selectedConversation ? (
              <ChatInterface
                conversationId={selectedConversation.id}
                currentUserId={userId}
                otherUserId={selectedConversation.patientId}
                otherUserName={selectedConversation.patientName}
                otherUserRole="patient"
                onVideoCall={handleVideoCall}
              />
            ) : (
              <Card className="h-full bg-slate-900 border-slate-700 flex items-center justify-center">
                <CardContent className="text-center">
                  <MessageCircle className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">Select a conversation to start messaging</p>
                </CardContent>
              </Card>
            )}
          </div>
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
