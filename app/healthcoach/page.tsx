"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Send, Volume2, VolumeX, Loader2, Languages } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, getDoc } from "firebase/firestore";
import { useAuthStore } from "@/lib/store/auth.store";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  role: "user" | "assistant";
  text: string;
  createdAt?: Timestamp | null;
}

export default function HealthCoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [language, setLanguage] = useState("en"); // en, hi, mr
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const { toast } = useToast();

  const userId = user?.uid || "";

  // Load voices on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Load voices
      speechSynthesis.getVoices();
      // Voices load asynchronously, so we need to listen for the event
      speechSynthesis.onvoiceschanged = () => {
        speechSynthesis.getVoices();
      };
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Fetch patient data
    const fetchPatientData = async () => {
      try {
        const patientDoc = await getDoc(doc(db, "patients", userId));
        if (patientDoc.exists()) {
          setPatientData(patientDoc.data());
        }
      } catch (error) {
        console.log("Could not load patient data:", error);
      }
    };
    fetchPatientData();

    // Subscribe to chat messages
    const q = query(
      collection(db, "healthCoachChats"),
      where("userId", "==", userId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const chats = snap.docs.map((d) => {
        const data = d.data();
        return {
          role: data.role as "user" | "assistant",
          text: data.text,
          createdAt: data.createdAt,
        };
      });
      setMessages(chats);
    });

    return () => unsub();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please log in to use the Health Coach.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const userMsg: Message = { role: "user", text: input };
      await addDoc(collection(db, "healthCoachChats"), {
        userId,
        role: userMsg.role,
        text: userMsg.text,
        createdAt: serverTimestamp(),
      });
      setInput("");

      // Prepare recent messages for context (last 10)
      const recentMessages = messages.slice(-10).map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch("/api/healthcoach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId, 
          input,
          patientData,
          recentMessages,
          language // Send selected language to API
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response from AI coach");
      }

      const data = await res.json();
      const reply: Message = { role: "assistant", text: data.reply };

      await addDoc(collection(db, "healthCoachChats"), {
        userId,
        role: reply.role,
        text: reply.text,
        createdAt: serverTimestamp(),
      });

      if (voiceEnabled) {
        speak(data.reply);
      }

      toast({
        title: "Coach responded",
        description: "Your health coach has replied!",
      });
    } catch (error) {
      console.error("Error in chat:", error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function speak(text: string) {
    if (isSpeaking) {
      speechSynthesis.cancel();
    }

    const utter = new SpeechSynthesisUtterance(text);
    
    // Set language based on user selection
    const langCode = language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN";
    utter.lang = langCode;
    
    // Try to find a voice that matches the language
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => voice.lang === langCode) || 
                          voices.find(voice => voice.lang.startsWith(language)) ||
                          voices.find(voice => voice.lang.includes("IN"));
    
    if (preferredVoice) {
      utter.voice = preferredVoice;
    }
    
    utter.rate = 0.9;
    utter.pitch = 1;
    
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = (err) => {
      console.log("Speech error:", err);
      setIsSpeaking(false);
      toast({
        title: "Voice not available",
        description: `${language === "hi" ? "Hindi" : language === "mr" ? "Marathi" : "English"} voice may not be installed on your device. Text will still display correctly.`,
        variant: "default",
      });
    };

    speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function handleVoiceInput() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast({
        title: "Not supported",
        description: "Speech recognition is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Set recognition language based on user selection
    recognition.lang = language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      toast({
        title: "Voice captured",
        description: "Your message was transcribed successfully.",
      });
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      toast({
        title: "Voice input error",
        description: "Failed to capture voice. Please try again.",
        variant: "destructive",
      });
    };

    recognition.start();
  }

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Card className="max-w-4xl mx-auto p-6 space-y-4 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-3xl font-bold text-cyan-400">Your AI Health Coach 🧠</h2>
            <p className="text-sm text-gray-400 mt-1">
              Get personalized health guidance and motivation
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700 text-white">
                <Languages size={16} className="mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="mr">मराठी (Marathi)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              variant="outline"
              size="icon"
              className={`${
                voiceEnabled
                  ? "bg-cyan-600 text-white border-cyan-500"
                  : "bg-slate-800 text-gray-300 border-slate-700"
              }`}
              title={voiceEnabled ? "Voice enabled" : "Voice disabled"}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </Button>
            {isSpeaking && (
              <Button
                onClick={stopSpeaking}
                variant="outline"
                size="icon"
                className="bg-red-600 text-white border-red-500 animate-pulse"
                title="Stop speaking"
              >
                <VolumeX size={18} />
              </Button>
            )}
          </div>
        </div>

        {/* Messages Container */}
        <div className="h-[60vh] overflow-y-auto space-y-4 p-4 rounded-xl bg-slate-900/50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <span className="text-4xl">🧠</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-cyan-300">Start Your Health Journey</h3>
                <p className="text-gray-400 mt-2 max-w-md">
                  Ask me about your health metrics, get motivation, or discuss your wellness goals.
                  I'm here to support you!
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  onClick={() => setInput("How am I doing with my health goals?")}
                  variant="outline"
                  size="sm"
                  className="bg-slate-800 border-slate-700 text-gray-300 hover:bg-slate-700"
                >
                  Health progress
                </Button>
                <Button
                  onClick={() => setInput("Give me motivation for today")}
                  variant="outline"
                  size="sm"
                  className="bg-slate-800 border-slate-700 text-gray-300 hover:bg-slate-700"
                >
                  Daily motivation
                </Button>
                <Button
                  onClick={() => setInput("Tips to improve my readings")}
                  variant="outline"
                  size="sm"
                  className="bg-slate-800 border-slate-700 text-gray-300 hover:bg-slate-700"
                >
                  Get tips
                </Button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`p-4 rounded-2xl max-w-[75%] shadow-lg ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-cyan-600 to-cyan-700 text-white"
                        : "bg-gradient-to-br from-slate-800 to-slate-700 text-gray-100 border border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {msg.role === "assistant" && (
                        <span className="text-xl flex-shrink-0">🧠</span>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2 pt-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach anything..."
            className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:ring-cyan-500"
            disabled={loading}
          />
          <Button
            type="button"
            onClick={handleVoiceInput}
            variant="outline"
            size="icon"
            className="bg-slate-800 border-slate-700 text-gray-300 hover:bg-slate-700 hover:text-cyan-400"
            disabled={loading}
            title="Voice input"
          >
            <Mic size={18} />
          </Button>
          <Button
            type="submit"
            className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white px-6"
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </form>

        {/* Disclaimer */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-white/5">
          💡 This AI coach provides general wellness guidance. Always consult your physician for medical advice.
        </div>
      </Card>
    </div>
  );
}
