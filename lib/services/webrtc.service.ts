import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, onSnapshot, Timestamp, deleteDoc, getDoc } from 'firebase/firestore';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
}

const DEFAULT_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private config: WebRTCConfig = DEFAULT_CONFIG) {}

  // Check available media devices
  async checkAvailableDevices(): Promise<{ hasVideo: boolean; hasAudio: boolean }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');
      console.log('📱 Available devices - Video:', hasVideo, 'Audio:', hasAudio);
      return { hasVideo, hasAudio };
    } catch (error) {
      console.error('Error enumerating devices:', error);
      return { hasVideo: false, hasAudio: false };
    }
  }

  // Initialize local media stream with fallback options
  async getLocalStream(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      console.log('🎥 Requesting media access...');
      
      // First check what devices are available
      const { hasVideo, hasAudio } = await this.checkAvailableDevices();
      
      // Adjust requested media based on available devices
      const requestVideo = video && hasVideo;
      const requestAudio = audio && hasAudio;
      
      if (!requestVideo && !requestAudio) {
        console.warn('⚠️ No media devices available, creating empty stream');
        // Create an empty stream - user can still view remote stream
        this.localStream = new MediaStream();
        return this.localStream;
      }
      
      console.log(`📹 Requesting - Video: ${requestVideo}, Audio: ${requestAudio}`);
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: requestVideo ? { width: 1280, height: 720 } : false,
        audio: requestAudio,
      });
      console.log('✅ Media access granted. Stream tracks:', 
        this.localStream.getTracks().map(t => `${t.kind}: ${t.enabled}`).join(', '));
      return this.localStream;
    } catch (error: any) {
      console.error('❌ Error accessing media devices:', error);
      
      // Try fallback options
      if (error.name === 'NotFoundError' || error.name === 'NotAllowedError') {
        // Try audio only if video failed
        if (video && audio) {
          console.log('🔄 Falling back to audio only...');
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            console.log('✅ Audio-only stream obtained');
            return this.localStream;
          } catch (audioError) {
            console.log('🔄 Audio also failed, creating empty stream...');
          }
        }
        
        // Create empty stream as last resort
        console.warn('⚠️ Creating empty stream - user can still view remote video');
        this.localStream = new MediaStream();
        return this.localStream;
      }
      
      if (error.name === 'NotReadableError') {
        throw new Error('Camera/microphone is already in use by another application.');
      } else if (error.name === 'TypeError') {
        throw new Error('Media devices not available. Ensure you are using HTTPS or localhost.');
      }
      throw new Error(`Failed to access camera/microphone: ${error.message || 'Unknown error'}`);
    }
  }

  // Start a new call (caller)
  async startCall(
    callId: string,
    callerId: string,
    receiverId: string,
    onRemoteStream: (stream: MediaStream) => void
  ): Promise<void> {
    console.log('📞 Starting call...', { callId, hasLocalStream: !!this.localStream });
    this.callId = callId;
    
    // Create peer connection
    this.peerConnection = new RTCPeerConnection(this.config);

    // Add local stream to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log('📤 Caller: Adding local track to peer connection', track.kind);
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    } else {
      console.error('❌ Caller: No local stream available!');
    }

    // Collect ICE candidates - they will be added dynamically
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateType = event.candidate.type;
        const protocol = event.candidate.protocol;
        console.log(`🧊 Caller: New ICE candidate ${candidateType} (${protocol})`, event.candidate.address);
        this.addIceCandidate(callId, event.candidate.toJSON(), 'caller');
      } else {
        console.log('✅ Caller: ICE candidate gathering complete');
      }
    };

    // Log ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('🧊 Caller ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('🎥 Caller: Remote track received', event.track.kind, 'enabled:', event.track.enabled, 'readyState:', event.track.readyState);
      console.log('🎥 Caller: event.streams:', event.streams.length);
      
      if (event.streams && event.streams[0]) {
        console.log('🎥 Caller: Using event.streams[0] with tracks:', event.streams[0].getTracks().map(t => t.kind).join(', '));
        onRemoteStream(event.streams[0]);
      } else {
        // Fallback: create stream manually
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        console.log('🎥 Caller: Using manual stream with tracks:', this.remoteStream.getTracks().map(t => t.kind).join(', '));
        onRemoteStream(this.remoteStream);
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Caller connection state:', state);
      if (state === 'connected') {
        console.log('✅ Caller: Peer connection established!');
      } else if (state === 'failed') {
        // Don't restart immediately - give more time for ICE
        console.warn('⚠️ Caller: Peer connection failed state - waiting for recovery');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('🧊 Caller ICE connection state:', state);
      if (state === 'connected' || state === 'completed') {
        console.log('✅ Caller: ICE connected!');
      } else if (state === 'failed') {
        console.error('❌ Caller: ICE connection failed - trying ICE restart');
        this.peerConnection?.restartIce();
      }
    };

    // **CRITICAL: Start listening for receiver ICE candidates BEFORE creating offer**
    // This ensures we catch all candidates as they're added to Firestore
    this.listenForIceCandidates(callId, 'receiver');

    // Create offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Save call to Firestore
    await setDoc(doc(db, 'videoCalls', callId), {
      caller: callerId,
      receiver: receiverId,
      status: 'ringing',
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
      callerIceCandidates: [],
      receiverIceCandidates: [],
      createdAt: Timestamp.now(),
    });

    // Listen for answer
    this.listenForAnswer(callId);
  }

  // Answer an incoming call (receiver)
  async answerCall(
    callId: string,
    onRemoteStream: (stream: MediaStream) => void
  ): Promise<void> {
    console.log('📞 Answering call...', { callId, hasLocalStream: !!this.localStream });
    this.callId = callId;

    // Get call data
    const callDoc = await getDoc(doc(db, 'videoCalls', callId));
    if (!callDoc.exists()) {
      throw new Error('Call not found');
    }

    const callData = callDoc.data();
    
    // Create peer connection
    this.peerConnection = new RTCPeerConnection(this.config);

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log('📤 Receiver: Adding local track to peer connection', track.kind);
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    } else {
      console.error('❌ Receiver: No local stream available!');
    }

    // Collect ICE candidates - they will be added dynamically
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateType = event.candidate.type;
        const protocol = event.candidate.protocol;
        console.log(`🧊 Receiver: New ICE candidate ${candidateType} (${protocol})`, event.candidate.address);
        this.addIceCandidate(callId, event.candidate.toJSON(), 'receiver');
      } else {
        console.log('✅ Receiver: ICE candidate gathering complete');
      }
    };

    // Log ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('🧊 Receiver ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('🎥 Receiver: Remote track received', event.track.kind, 'enabled:', event.track.enabled, 'readyState:', event.track.readyState);
      console.log('🎥 Receiver: event.streams:', event.streams.length);
      
      if (event.streams && event.streams[0]) {
        console.log('🎥 Receiver: Using event.streams[0] with tracks:', event.streams[0].getTracks().map(t => t.kind).join(', '));
        onRemoteStream(event.streams[0]);
      } else {
        // Fallback: create stream manually
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        console.log('🎥 Receiver: Using manual stream with tracks:', this.remoteStream.getTracks().map(t => t.kind).join(', '));
        onRemoteStream(this.remoteStream);
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Receiver connection state:', state);
      if (state === 'connected') {
        console.log('✅ Receiver: Peer connection established!');
      } else if (state === 'failed') {
        console.error('❌ Receiver: Peer connection failed - trying ICE restart');
        this.peerConnection?.restartIce();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('🧊 Receiver ICE connection state:', state);
      if (state === 'failed') {
        console.error('❌ Receiver: ICE connection failed - trying ICE restart');
        this.peerConnection?.restartIce();
      }
    };

    // Set remote description (offer)
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));

    // Add caller's ICE candidates
    if (callData.callerIceCandidates) {
      for (const candidate of callData.callerIceCandidates) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }

    // Create answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // Update Firestore with answer
    await updateDoc(doc(db, 'videoCalls', callId), {
      status: 'active',
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    });

    // Listen for new ICE candidates from caller
    this.listenForIceCandidates(callId, 'caller');
  }

  // Listen for answer from receiver
  private listenForAnswer(callId: string): void {
    let answerSet = false;
    this.unsubscribe = onSnapshot(doc(db, 'videoCalls', callId), async (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && this.peerConnection && !answerSet) {
        console.log('📞 Caller: Answer received, setting remote description');
        answerSet = true;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('✅ Caller: Remote description set');
        
        // Add receiver's ICE candidates that arrived before answer
        if (data.receiverIceCandidates && data.receiverIceCandidates.length > 0) {
          console.log(`🧊 Caller: Adding ${data.receiverIceCandidates.length} ICE candidates from receiver`);
          for (const candidate of data.receiverIceCandidates) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }

        // Note: listenForIceCandidates already started in startCall() before creating offer
      }
    });
  }

  // Listen for ICE candidates
  private listenForIceCandidates(callId: string, from: 'caller' | 'receiver'): void {
    const field = from === 'caller' ? 'callerIceCandidates' : 'receiverIceCandidates';
    let lastCount = 0;

    onSnapshot(doc(db, 'videoCalls', callId), async (snapshot) => {
      const data = snapshot.data();
      const candidates = data?.[field] || [];
      
      if (candidates.length > lastCount) {
        const newCount = candidates.length - lastCount;
        console.log(`🧊 Adding ${newCount} new ICE candidates from ${from} (total: ${candidates.length})`);
        
        // Add all new candidates
        for (let i = lastCount; i < candidates.length; i++) {
          try {
            if (this.peerConnection?.remoteDescription) {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidates[i]));
            } else {
              console.log('⚠️ Queuing ICE candidate - no remote description yet');
              // Queue it to add after remote description is set
              setTimeout(async () => {
                if (this.peerConnection?.remoteDescription) {
                  await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidates[i]));
                }
              }, 100);
            }
          } catch (err) {
            console.error('Failed to add ICE candidate:', err);
          }
        }
        lastCount = candidates.length;
      }
    });
  }

  // Add ICE candidate to Firestore
  private async addIceCandidate(
    callId: string,
    candidate: RTCIceCandidateInit,
    type: 'caller' | 'receiver'
  ): Promise<void> {
    try {
      const field = type === 'caller' ? 'callerIceCandidates' : 'receiverIceCandidates';
      const callRef = doc(db, 'videoCalls', callId);
      const callDoc = await getDoc(callRef);
      
      if (!callDoc.exists()) {
        console.warn(`⚠️ Call document ${callId} does not exist, skipping ICE candidate`);
        return;
      }
      
      const callData = callDoc.data();
      console.log(`🔍 Adding ${type} ICE candidate. Call data:`, {
        caller: callData?.caller,
        receiver: callData?.receiver,
        status: callData?.status
      });
      
      const currentCandidates = callData?.[field] || [];
      
      await updateDoc(callRef, {
        [field]: [...currentCandidates, candidate],
      });
      console.log(`✅ Added ICE candidate for ${type}`);
    } catch (error) {
      console.error(`❌ Failed to add ICE candidate for ${type}:`, error);
      // Don't throw - allow call to continue even if ICE candidate sync fails
    }
  }

  // Toggle video on/off
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  // Toggle audio on/off
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  // End call
  async endCall(): Promise<void> {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    
    // Clear remote stream
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Unsubscribe from listeners
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Delete call document from Firestore
    if (this.callId) {
      await deleteDoc(doc(db, 'videoCalls', this.callId));
      this.callId = null;
    }
  }

  // Get current local stream
  getCurrentStream(): MediaStream | null {
    return this.localStream;
  }

  // Check if video is enabled
  isVideoEnabled(): boolean {
    return this.localStream?.getVideoTracks().some((track) => track.enabled) || false;
  }

  // Check if audio is enabled
  isAudioEnabled(): boolean {
    return this.localStream?.getAudioTracks().some((track) => track.enabled) || false;
  }
}
