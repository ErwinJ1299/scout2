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
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Modern Chat Container */}
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-teal-600/20 to-cyan-600/20 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Health Coach AI</h1>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-xs text-gray-400">Online • Ready to help</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[110px] h-9 bg-slate-800/80 border-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">
                    <Languages size={14} className="mr-1.5 text-teal-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 rounded-lg shadow-xl">
                    <SelectItem value="en" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white cursor-pointer">🇺🇸 English</SelectItem>
                    <SelectItem value="hi" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white cursor-pointer">🇮🇳 हिंदी</SelectItem>
                    <SelectItem value="mr" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white cursor-pointer">🇮🇳 मराठी</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${voiceEnabled
                    ? "bg-teal-500 text-white shadow-lg shadow-teal-500/25"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  title={voiceEnabled ? "Voice enabled" : "Voice disabled"}
                >
                  {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="h-[55vh] overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center mb-4 border border-teal-500/20">
                  <span className="text-4xl">💬</span>
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">Start a Conversation</h2>
                <p className="text-sm text-gray-400 mb-6 max-w-sm">
                  I'm your personal health assistant. Ask me anything about wellness, fitness, or nutrition!
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    { text: "Health tips", icon: "💡" },
                    { text: "Motivation", icon: "🔥" },
                    { text: "My progress", icon: "📊" },
                  ].map((item) => (
                    <button
                      key={item.text}
                      onClick={() => setInput(item.text === "Health tips" ? "Give me a health tip" : item.text === "Motivation" ? "Motivate me today" : "How am I doing?")}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 hover:border-teal-500/50 transition-all flex items-center gap-2"
                    >
                      <span>{item.icon}</span>
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                        <span className="text-sm">🤖</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.role === "user"
                        ? "bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-br-md"
                        : "bg-white/[0.05] text-gray-100 border border-white/10 rounded-bl-md"
                        }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mr-2 flex-shrink-0">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="bg-white/[0.05] border border-white/10 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02]">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your coach anything..."
                  className="w-full bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-xl pl-4 pr-12 py-3 focus:border-teal-500/50 focus:ring-teal-500/20"
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                onClick={handleVoiceInput}
                className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-teal-400 hover:bg-white/10 transition-all"
                disabled={loading}
                title="Voice input"
              >
                <Mic size={18} />
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>
            <p className="text-[11px] text-gray-500 text-center mt-3">
              AI provides general guidance only • Always consult your doctor for medical advice
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
