"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
import { WebRTCService } from "@/lib/services/webrtc.service";
import { useToast } from "@/hooks/use-toast";

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  isInitiator: boolean;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
}

export function VideoCallModal({
  isOpen,
  onClose,
  callId,
  isInitiator,
  currentUserId,
  otherUserId,
  otherUserName,
}: VideoCallModalProps) {
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<"connecting" | "connected" | "ended">("connecting");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const { toast } = useToast();
  const initializingRef = useRef(false);

  useEffect(() => {
    if (isOpen && callId && !initializingRef.current) {
      initializingRef.current = true;
      initializeCall();
    }

    return () => {
      cleanup();
      initializingRef.current = false;
    };
  }, [isOpen, callId]);

  async function initializeCall() {
    try {
      // Prevent double initialization
      if (webrtcServiceRef.current) {
        console.log('⚠️ Call already initialized, skipping...');
        return;
      }
      
      console.log('🚀 Initializing call modal...');
      const webrtcService = new WebRTCService();
      webrtcServiceRef.current = webrtcService;

      // Check available devices first
      const { hasVideo, hasAudio } = await webrtcService.checkAvailableDevices();
      
      if (!hasVideo && !hasAudio) {
        toast({
          title: "No devices found",
          description: "No camera or microphone detected. You can still view the other person's video.",
          variant: "default",
        });
      } else if (!hasVideo) {
        toast({
          title: "No camera found",
          description: "Joining with audio only.",
          variant: "default",
        });
        setVideoEnabled(false);
      } else if (!hasAudio) {
        toast({
          title: "No microphone found",
          description: "Joining with video only.",
          variant: "default",
        });
        setAudioEnabled(false);
      }

      // Get local media stream (will handle fallbacks automatically)
      console.log('📹 About to request local stream...');
      const localStream = await webrtcService.getLocalStream(true, true);
      const tracks = localStream.getTracks();
      console.log('✅ Local stream obtained:', tracks.map(t => t.kind));
      
      // Update state based on actual tracks received
      const hasVideoTrack = tracks.some(t => t.kind === 'video');
      const hasAudioTrack = tracks.some(t => t.kind === 'audio');
      setVideoEnabled(hasVideoTrack);
      setAudioEnabled(hasAudioTrack);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      // Handle remote stream
      const handleRemoteStream = (remoteStream: MediaStream) => {
        console.log('🎥 Remote stream received in modal');
        console.log('🎥 Remote stream tracks:', remoteStream.getTracks().map(t => `${t.kind}: ${t.enabled}, readyState: ${t.readyState}`));
        
        if (remoteVideoRef.current) {
          // Always update srcObject - autoPlay handles playback
          remoteVideoRef.current.srcObject = remoteStream;
          console.log('🎥 Set remote stream to video element (tracks:', remoteStream.getTracks().length, ')');
          
          // Force play after a short delay to ensure srcObject is set
          const videoElement = remoteVideoRef.current;
          setTimeout(() => {
            if (videoElement && videoElement.srcObject && videoElement.paused) {
              videoElement.play().catch(err => console.log('🎥 Play deferred:', err.message));
            }
          }, 100);
        } else {
          console.error('❌ remoteVideoRef.current is null!');
        }
        setCallStatus("connected");
      };

      // Start or answer call
      if (isInitiator) {
        console.log('📞 About to start call as initiator');
        await webrtcService.startCall(callId, currentUserId, otherUserId, handleRemoteStream);
        toast({
          title: "Calling...",
          description: `Calling ${otherUserName}`,
        });
      } else {
        console.log('📞 About to answer call');
        await webrtcService.answerCall(callId, handleRemoteStream);
        setCallStatus("connected");
        toast({
          title: "Call connected",
          description: `Connected with ${otherUserName}`,
        });
      }
    } catch (error: any) {
      console.error("Error initializing call:", error);
      toast({
        title: "Call failed",
        description: error.message || "Failed to initialize video call. Please check camera/microphone permissions.",
        variant: "destructive",
      });
      onClose();
    }
  }

  async function cleanup() {
    if (webrtcServiceRef.current) {
      await webrtcServiceRef.current.endCall();
      webrtcServiceRef.current = null;
    }
  }

  async function toggleVideo() {
    if (webrtcServiceRef.current) {
      const newState = !videoEnabled;
      webrtcServiceRef.current.toggleVideo(newState);
      setVideoEnabled(newState);
    }
  }

  async function toggleAudio() {
    if (webrtcServiceRef.current) {
      const newState = !audioEnabled;
      webrtcServiceRef.current.toggleAudio(newState);
      setAudioEnabled(newState);
    }
  }

  async function endCall() {
    setCallStatus("ended");
    await cleanup();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[80vh] bg-slate-900 border-slate-700 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="p-4 border-b border-slate-700">
            <DialogTitle className="text-white">
              {callStatus === "connecting" ? "Connecting..." : `Call with ${otherUserName}`}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {callStatus === "connecting" 
                ? "Setting up video call..." 
                : `Video call with ${otherUserName}`}
            </DialogDescription>
          </DialogHeader>

          {/* Video Streams */}
          <div className="flex-1 relative bg-black">
            {/* Remote Video (large) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-slate-800"
              onLoadedMetadata={() => console.log('🎬 Remote video: loadedmetadata')}
              onLoadedData={() => console.log('🎬 Remote video: loadeddata')}
              onPlay={() => console.log('🎬 Remote video: playing')}
              onCanPlay={() => console.log('🎬 Remote video: canplay')}
              onError={(e) => console.error('🎬 Remote video error:', e)}
            />

            {/* Connecting Overlay */}
            {callStatus === "connecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
                  <p className="text-white text-lg">
                    {isInitiator ? `Calling ${otherUserName}...` : "Connecting..."}
                  </p>
                </div>
              </div>
            )}

            {/* Local Video (small, picture-in-picture) */}
            <div className="absolute bottom-4 right-4 w-48 h-36 bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-600 shadow-xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <VideoOff className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* Call Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-slate-900/90 px-6 py-3 rounded-full">
              <Button
                onClick={toggleVideo}
                variant="outline"
                size="icon"
                className={`rounded-full ${
                  videoEnabled
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}
                title={videoEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {videoEnabled ? (
                  <Video className="h-5 w-5 text-white" />
                ) : (
                  <VideoOff className="h-5 w-5 text-white" />
                )}
              </Button>

              <Button
                onClick={toggleAudio}
                variant="outline"
                size="icon"
                className={`rounded-full ${
                  audioEnabled
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}
                title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                {audioEnabled ? (
                  <Mic className="h-5 w-5 text-white" />
                ) : (
                  <MicOff className="h-5 w-5 text-white" />
                )}
              </Button>

              <Button
                onClick={endCall}
                size="icon"
                className="rounded-full bg-red-600 hover:bg-red-700 text-white"
                title="End call"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </Dialog>
  );
}
