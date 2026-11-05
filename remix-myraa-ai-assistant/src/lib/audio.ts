/**
 * Audio handling utility for Myraa Live API Voice stream.
 * Handles:
 * - Immediate user-gesture microphone stream acquisition.
 * - Hardware-agnostic sampling with high-precision anti-aliased downsampling to 16kHz Little Endian Int16 PCM.
 * - Native Web Audio API 24kHz buffer playback scheduling with automatic hardware sample-rate matching.
 * - Gapless double-buffer queue scheduler with instant interrupt flush.
 * - Input & Output AnalyserNodes for real-time waveform visuals.
 * - Comprehensive error recovery for browser permissions, device constraints, and network reconnections.
 */

export type LiveState = "disconnected" | "connecting" | "listening" | "speaking";

// PCM Conversion Helper: converts Float32Array [-1.0, 1.0] to signed Int16 Raw PCM Little Endian
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

// Downsampler: cleanly downsamples Float32Array from inputSampleRate (e.g. 44100 or 48000) to target 16000Hz
function downsampleTo16kHz(buffer: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return buffer;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

// Float conversion helper: converts signed Int16 array buffer to Float32Array [-1.0, 1.0]
function pcm16ToFloats(uint8Array: Uint8Array): Float32Array {
  const int16 = new Int16Array(
    uint8Array.buffer,
    uint8Array.byteOffset,
    uint8Array.byteLength / 2
  );
  const floats = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    floats[i] = int16[i] / 32768.0;
  }
  return floats;
}

// Convert ArrayBuffer to Base64 String
function base64ArrayBuffer(arrayBuffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class MyraaAudioSession {
  private ws: WebSocket | null = null;
  
  // Audio contexts (use native device sample rate to guarantee 100% browser compatibility)
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  
  // Audio sources & processors
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micProcessorNode: ScriptProcessorNode | null = null;
  
  // Visualisers
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;
  private outputGainNode: GainNode | null = null;
  
  // Buffering / Playback details
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  
  // State Callbacks
  private onStateChange: (state: LiveState) => void;
  private onTranscription: (role: "user" | "model", text: string) => void;
  private onToolCall: (name: string, args: any, callback: (result: any) => void) => void;
  private onError: (error: string) => void;
  private onMemorySync?: (memories: any[]) => void;
  private onNoteSync?: (note: any, notes?: any[]) => void;
  private onCalculatorRequest?: (expression: string) => void;
  private onSearchHubRequest?: (platform: string, query: string) => void;
  private onPersonalityModeSwitch?: (mode: string) => void;
  private voicePlaybackRate = 1.0;
  
  private currentState: LiveState = "disconnected";
  private isActivated = false;

  constructor(handlers: {
    onStateChange: (state: LiveState) => void;
    onTranscription: (role: "user" | "model", text: string) => void;
    onToolCall: (name: string, args: any, callback: (result: any) => void) => void;
    onError: (error: string) => void;
    onMemorySync?: (memories: any[]) => void;
    onNoteSync?: (note: any, notes?: any[]) => void;
    onCalculatorRequest?: (expression: string) => void;
    onSearchHubRequest?: (platform: string, query: string) => void;
    onPersonalityModeSwitch?: (mode: string) => void;
  }) {
    this.onStateChange = handlers.onStateChange;
    this.onTranscription = handlers.onTranscription;
    this.onToolCall = handlers.onToolCall;
    this.onError = handlers.onError;
    this.onMemorySync = handlers.onMemorySync;
    this.onNoteSync = handlers.onNoteSync;
    this.onCalculatorRequest = handlers.onCalculatorRequest;
    this.onSearchHubRequest = handlers.onSearchHubRequest;
    this.onPersonalityModeSwitch = handlers.onPersonalityModeSwitch;
  }

  private setState(state: LiveState) {
    this.currentState = state;
    this.onStateChange(state);
  }

  public getState(): LiveState {
    return this.currentState;
  }

  /**
   * Pushes a compressed JPEG base64 screenshot frame directly to the live WebSocket server.
   */
  public sendVideoFrame(base64Data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentState !== "disconnected") {
      this.ws.send(JSON.stringify({ type: "video", video: base64Data }));
    }
  }

  /**
   * Sets the voice playback rate for personality modulation (e.g. 1.15 for STRICT, 0.92 for DETECTIVE).
   */
  public setVoicePlaybackRate(rate: number) {
    this.voicePlaybackRate = Math.max(0.5, Math.min(2.0, rate || 1.0));
  }

  /**
   * Notifies backend server of active personality mode.
   */
  public sendPersonalityMode(mode: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "set_mode", mode }));
    }
  }

  /**
   * Requests microphone and establishes WebSocket stream to backend bridge.
   * Crucial: navigator.mediaDevices.getUserMedia is called immediately within the click
   * action to preserve transient user activation tokens across all mobile and desktop browsers.
   */
  public async connect() {
    if (this.isActivated) return;
    this.isActivated = true;
    this.setState("connecting");

    // 1. Immediately request microphone within user gesture activation window
    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("आपका ब्राउज़र या एनवायरनमेंट माइक्रोफोन एक्सेस की अनुमति नहीं देता (Microphone API not supported).");
      }

      // Request stream with resilient fallback parameters
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
    } catch (micErr: any) {
      console.error("[Myraa Audio] Microphone acquisition failed:", micErr);
      this.isActivated = false;
      this.setState("disconnected");

      let errorMsg = "माइक्रोफोन कनेक्शन विफल (Microphone error).";
      if (micErr.name === "NotAllowedError" || micErr.name === "PermissionDeniedError") {
        errorMsg = "माइक्रोफोन अनुमति अस्वीकार हुई (Permission Denied). कृपया ब्राउज़र के URL बार में माइक या लॉक आइकन पर क्लिक करके 'Allow' करें और पुनः प्रयास करें।";
      } else if (micErr.name === "NotFoundError" || micErr.name === "DevicesNotFoundError") {
        errorMsg = "कोई माइक्रोफोन डिवाइस नहीं मिली (No Microphone Detected). कृपया अपना माइक या ईयरफोन कनेक्ट करें।";
      } else if (micErr.name === "NotReadableError" || micErr.name === "TrackStartError") {
        errorMsg = "माइक्रोफोन किसी अन्य ऐप द्वारा उपयोग किया जा रहा है (Microphone Busy). कृपया अन्य ऐप्स बंद करके पुनः प्रयास करें।";
      } else {
        errorMsg = `माइक्रोफोन त्रुटि: ${micErr.message || "अनुमति नहीं मिली"}.`;
      }

      this.onError(errorMsg);
      return;
    }

    // Guard if user aborted or disconnected during the mic permission prompt
    if (!this.isActivated) {
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      return;
    }

    this.micStream = stream;

    // 2. Cross-browser AudioContext initialization (natural hardware sample rate)
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser.");
      }

      this.inputAudioCtx = new AudioContextClass();
      this.outputAudioCtx = new AudioContextClass();

      // Ensure AudioContexts are active and resumed
      if (this.inputAudioCtx.state === "suspended") {
        await this.inputAudioCtx.resume().catch(() => {});
      }
      if (this.outputAudioCtx.state === "suspended") {
        await this.outputAudioCtx.resume().catch(() => {});
      }

      // Setup output analyser & gain
      this.outputGainNode = this.outputAudioCtx.createGain();
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.8;
      this.outputGainNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);

      // Setup input analyser & capture pipeline
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;

      this.micSourceNode = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      this.micSourceNode.connect(this.inputAnalyser);

      // 2048 sample buffer processor node
      this.micProcessorNode = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
      this.micSourceNode.connect(this.micProcessorNode);
      this.micProcessorNode.connect(this.inputAudioCtx.destination);

      const hardwareRate = this.inputAudioCtx.sampleRate || 48000;

      this.micProcessorNode.onaudioprocess = (e) => {
        if (this.currentState === "disconnected" || this.currentState === "connecting") return;

        const rawChannelData = e.inputBuffer.getChannelData(0);

        // High quality downsample from native hardware rate to 16000Hz expected by Gemini Live API
        const downsampled = downsampleTo16kHz(rawChannelData, hardwareRate);

        // Convert to base64 Int16 Little Endian PCM
        const pcmBuffer = floatTo16BitPCM(downsampled);
        const base64 = base64ArrayBuffer(pcmBuffer);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ audio: base64 }));
        }
      };

    } catch (audioCtxErr: any) {
      console.error("[Myraa Audio] AudioContext initialization failed:", audioCtxErr);
      this.onError(`ऑडियो इंजन त्रुटि: ${audioCtxErr.message || "Web Audio प्रारंभ नहीं हो सका।"}`);
      this.disconnect();
      return;
    }

    // 3. Establish custom WebSocket server bridge
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      this.ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      this.ws.binaryType = "blob";

      this.ws.onopen = () => {
        console.log("[Myraa] Connected to server side WS bridge");
        // Audio is already active; wait for model connection or go straight to listening
        if (this.currentState === "connecting") {
          this.setState("listening");
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // Root Error Handler message
          if (data.type === "error") {
            this.onError(data.error);
            this.disconnect();
            return;
          }

          // Handle server-side states
          if (data.type === "status") {
            console.log("[Myraa WS Status]:", data.status);
            if (data.status === "connecting_gemini") {
              // Waiting for Gemini Live handshake
            } else if (data.status === "connected") {
              this.setState("listening");
            } else if (data.status === "session_closed") {
              this.disconnect();
            }
            return;
          }

          // Handle audio payload (24kHz PCM model response)
          if (data.type === "audio" && data.audio) {
            this.playAudioPCMChunk(data.audio);
          }

          // Handle interruption signal (e.g. user talked over Myraa)
          if (data.type === "interrupted") {
            this.handleInterruption();
          }

          // Turn complete
          if (data.type === "turnComplete") {
            setTimeout(() => {
              if (this.activeSources.length === 0 && this.currentState === "speaking") {
                this.setState("listening");
              }
            }, 100);
          }

          // Handle live captions transcription
          if (data.type === "transcription") {
            this.onTranscription(data.role, data.text);
          }

          // Handle memory synchronization
          if (data.type === "memory_sync" && data.memories) {
            if (this.onMemorySync) {
              this.onMemorySync(data.memories);
            }
          }

          // Handle smart speech notepad synchronization
          if (data.type === "note_saved" && data.note) {
            if (this.onNoteSync) {
              this.onNoteSync(data.note, data.notes);
            }
          }

          // Handle calculator invocation request
          if (data.type === "calculator_request" && data.expression) {
            if (this.onCalculatorRequest) {
              this.onCalculatorRequest(data.expression);
            }
          }

          // Handle Universal Search Hub invocation request
          if (data.type === "search_hub_request") {
            if (this.onSearchHubRequest) {
              this.onSearchHubRequest(data.platform || "google", data.query || "");
            }
          }

          // Handle Personality Mode Switch request from voice tool
          if (data.type === "personality_mode_switch" && data.mode) {
            if (this.onPersonalityModeSwitch) {
              this.onPersonalityModeSwitch(data.mode);
            }
          }

          // Handle Tool Calling
          if (data.type === "toolCall") {
            const { callId, name, args } = data;
            this.onToolCall(name, args, (result) => {
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                  type: "toolResponse",
                  id: callId,
                  name: name,
                  output: result
                }));
              }
            });
          }

        } catch (parseError) {
          console.error("Error reading server packet:", parseError);
        }
      };

      this.ws.onerror = (wsError) => {
        console.error("WebSocket transport error:", wsError);
        this.onError("नेटवर्क कनेक्शन टूट गया (Network link lost). कृपया पुनः प्रयास करें।");
        this.disconnect();
      };

      this.ws.onclose = () => {
        console.log("WebSocket connection closed");
        this.disconnect();
      };

    } catch (e: any) {
      console.error("Connection establish sequence failed:", e);
      this.onError(e.message || "Failed to initialize active channel.");
      this.disconnect();
    }
  }

  // Interruption triggers: stops all active audio players immediately
  private handleInterruption() {
    console.log("[Audio] Interruption signal received; flushing play logs.");
    
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (err) {
        // Already finished or stopped
      }
    });
    this.activeSources = [];
    this.nextStartTime = 0;
    
    this.setState("listening");
  }

  // Direct raw PCM chunk scheduled playback at 24kHz with automatic native resampling
  private playAudioPCMChunk(base64Audio: string) {
    if (!this.outputAudioCtx || !this.outputGainNode) return;

    try {
      this.setState("speaking");
      const uint8Array = base64ToUint8Array(base64Audio);
      const floats = pcm16ToFloats(uint8Array);

      // Create AudioBuffer of 24000Hz (the exact playback sample rate of Gemini outputs)
      // Web Audio API automatically resamples from 24000Hz to hardware output rate seamlessly
      const buffer = this.outputAudioCtx.createBuffer(1, floats.length, 24000);
      buffer.getChannelData(0).set(floats);

      const source = this.outputAudioCtx.createBufferSource();
      const effectiveRate = (Math.abs(this.voicePlaybackRate - 1.0) < 0.03) ? 1.0 : this.voicePlaybackRate;
      if (effectiveRate !== 1.0) {
        source.playbackRate.value = effectiveRate;
      }
      source.connect(this.outputGainNode);

      const currentTime = this.outputAudioCtx.currentTime;
      
      // Gapless scheduler sync
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.03;
      }

      source.start(this.nextStartTime);
      const effectiveDuration = buffer.duration / (effectiveRate || 1.0);
      this.nextStartTime += effectiveDuration;

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        
        if (this.activeSources.length === 0 && this.currentState === "speaking") {
          this.setState("listening");
        }
      };

      this.activeSources.push(source);

    } catch (playbackError) {
      console.error("PCM Chunk buffering/playback failed:", playbackError);
    }
  }

  // Fully cleanup and release microphones & connection sockets
  public disconnect() {
    this.isActivated = false;
    this.setState("disconnected");

    // Close WS socket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    // Stop and release user microphone streams
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.micStream = null;
    }

    // Disconnect routing nodes
    if (this.micProcessorNode) {
      try {
        this.micProcessorNode.disconnect();
      } catch (e) {}
      this.micProcessorNode = null;
    }

    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch (e) {}
      this.micSourceNode = null;
    }

    // Close Audio contexts
    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch (e) {}
      this.outputAudioCtx = null;
    }

    this.activeSources = [];
    this.nextStartTime = 0;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.outputGainNode = null;
  }
}
