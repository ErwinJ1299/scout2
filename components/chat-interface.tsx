"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Video, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  senderId: string;
  text: string;
  type: "text" | "video-call" | "voice-call";
  timestamp: Timestamp;
  read: boolean;
}

interface ChatInterfaceProps {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserRole: "doctor" | "patient";
  onVideoCall: () => void;
}

export function ChatInterface({
  conversationId,
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserRole,
  onVideoCall,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actualConversationId, setActualConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize or get conversation ID
  useEffect(() => {
    if (!conversationId) return;

    // If conversationId starts with "pending_", we need to create the conversation
    if (conversationId.startsWith("pending_")) {
      setActualConversationId(null);
    } else {
      setActualConversationId(conversationId);
    }
  }, [conversationId]);

  // Subscribe to messages
  useEffect(() => {
    if (!actualConversationId) return;

    const messagesRef = collection(db, `conversations/${actualConversationId}/messages`);
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(msgs);

      // Mark unread messages as read
      snapshot.docs.forEach(async (docSnapshot) => {
        const msg = docSnapshot.data();
        if (msg.senderId !== currentUserId && !msg.read) {
          try {
            await updateDoc(doc(db, `conversations/${actualConversationId}/messages`, docSnapshot.id), {
              read: true,
            });
          } catch (err) {
            console.error("Error marking message as read:", err);
          }
        }
      });
    }, (error) => {
      console.error("Error listening to messages:", error);
      toast({
        title: "Error",
        description: "Failed to load messages. Please refresh the page.",
        variant: "destructive",
      });
    });

    return () => unsub();
  }, [actualConversationId, currentUserId, toast]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  async function sendMessage() {
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      let convId = actualConversationId;

      // If no conversation exists yet, create it
      if (!convId) {
        const newConvRef = doc(collection(db, "conversations"));
        await setDoc(newConvRef, {
          participants: [currentUserId, otherUserId],
          lastMessage: "",
          lastMessageTime: serverTimestamp(),
          unreadCount: {
            [currentUserId]: 0,
            [otherUserId]: 0,
          },
        });
        convId = newConvRef.id;
        setActualConversationId(convId);
      }

      // Add message to subcollection
      await addDoc(collection(db, `conversations/${convId}/messages`), {
        senderId: currentUserId,
        text: input,
        type: "text",
        timestamp: serverTimestamp(),
        read: false,
      });

      // Update conversation lastMessage
      await updateDoc(doc(db, "conversations", convId), {
        lastMessage: input,
        lastMessageTime: serverTimestamp(),
      });

      setInput("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <Card className="flex flex-col h-full bg-slate-900 border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback className={otherUserRole === "doctor" ? "bg-blue-600" : "bg-purple-600"}>
              {otherUserName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-white">{otherUserName}</h3>
            <p className="text-xs text-gray-400 capitalize">{otherUserRole}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={onVideoCall}
            variant="outline"
            size="icon"
            className="bg-slate-800 border-slate-600 hover:bg-green-600 hover:border-green-500"
            title="Start video call"
          >
            <Video size={18} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-400">No messages yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Start a conversation with {otherUserName}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === currentUserId ? "justify-end" : "justify-start"
              }`}
            >
              {message.senderId !== currentUserId && (
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarFallback className={otherUserRole === "doctor" ? "bg-blue-600" : "bg-purple-600"}>
                    {otherUserName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.senderId === currentUserId
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-700 text-gray-100"
                }`}
              >
                <p className="break-words">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp ? message.timestamp.toDate().toLocaleTimeString() : "Sending..."}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border-slate-600 text-white"
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
