import { useState, useEffect, useRef } from "react";
import { MyraaAudioSession, LiveState } from "./lib/audio";
import { MyraaCoreVisualizer, MyraaEmotion } from "./components/MyraaCoreVisualizer";
import { UniversalSearchHub, SearchPlatform } from "./components/UniversalSearchHub";
import { 
  Power, 
  Volume2, 
  Info, 
  Sparkles, 
  Globe, 
  Maximize2, 
  MessageSquareOff, 
  Compass, 
  CircleAlert,
  MicOff,
  Mic,
  X,
  Brain,
  Monitor,
  Play,
  Pause,
  Square,
  RefreshCw,
  Calculator,
  FileText,
  Terminal,
  Search,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Memory, MemoryCategory } from "./lib/memoryTypes";
import { MemoryDashboard } from "./components/MemoryDashboard";
import { SmartInfiniteCalculator } from "./components/SmartInfiniteCalculator";
import { SmartSpeechNotepad, Note } from "./components/SmartSpeechNotepad";
import { PersonalityMode, PERSONALITY_PROFILES } from "./types/personality";
import { PersonalityModeSwitcher } from "./components/PersonalityModeSwitcher";
import { ToolboxDropdown } from "./components/ToolboxDropdown";
import { YouTubeHubModal } from "./components/YouTubeHubModal";

export default function App() {
  const [state, setState] = useState<LiveState>("disconnected");

  // Real-time Screen Sharing states
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isScreenSharingPaused, setIsScreenSharingPaused] = useState<boolean>(false);
  const [screenVisionMode, setScreenVisionMode] = useState<boolean>(true);

  // References to preserve state across intervals
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenIntervalRef = useRef<any>(null);

  const isPausedRef = useRef<boolean>(false);
  const screenVisionRef = useRef<boolean>(true);
  const stateRef = useRef<LiveState>("disconnected");

  // Sync state changes with refs to totally prevent stale closures in callbacks
  useEffect(() => {
    isPausedRef.current = isScreenSharingPaused;
  }, [isScreenSharingPaused]);

  useEffect(() => {
    screenVisionRef.current = screenVisionMode;
  }, [screenVisionMode]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Clean up streaming intervals on unmount
  useEffect(() => {
    return () => {
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
    };
  }, []);

  const captureFrameAndSend = () => {
    const video = screenVideoRef.current;
    if (!video || isPausedRef.current || !screenVisionRef.current) {
      return;
    }

    if (stateRef.current === "disconnected") {
      return;
    }

    try {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      if (!screenCanvasRef.current) {
        screenCanvasRef.current = document.createElement("canvas");
      }
      const canvas = screenCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Restrict maximum resolution size to keep payload light for Gemini Live
      const maxDim = 960;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(video, 0, 0, width, height);

      // Highly compressed JPEG standard is optimized and preserves details perfectly
      const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
      const base64 = dataUrl.split(",")[1];

      if (sessionRef.current && stateRef.current !== "disconnected") {
        sessionRef.current.sendVideoFrame(base64);
      }
    } catch (err) {
      console.error("[Screen Capture] Failed drawing frame to canvas:", err);
    }
  };

  const startScreenSharing = async () => {
    setErrorText(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 5 }
        },
        audio: false
      });

      screenStreamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(e => console.error("Video play warning:", e));
      screenVideoRef.current = video;

      setIsScreenSharing(true);
      setIsScreenSharingPaused(false);

      // Stop handling when native stop sharing bar button ends
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };

      // Set up frame capture interval (one frame every 2 seconds is highly robust, preventing overload)
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
      screenIntervalRef.current = setInterval(() => {
        captureFrameAndSend();
      }, 2000);

      // Promptly capture first frame immediately
      setTimeout(() => {
        captureFrameAndSend();
      }, 500);

    } catch (e: any) {
      console.error("Screen sharing permission declined or missing API:", e);
      if (e.name !== "NotAllowedError") {
        setErrorText(`Could not capture screen: ${e.message || e}`);
      }
    }
  };

  const stopScreenSharing = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      screenStreamRef.current = null;
    }

    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current = null;
    }

    setIsScreenSharing(false);
    setIsScreenSharingPaused(false);
  };

  const pauseScreenSharing = () => {
    setIsScreenSharingPaused(true);
  };

  const resumeScreenSharing = () => {
    setIsScreenSharingPaused(false);
    // Refresh first frame immediately
    setTimeout(() => {
      captureFrameAndSend();
    }, 100);
  };

  const switchScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
    }
    await startScreenSharing();
  };

  const [activeEmotion, setActiveEmotion] = useState<MyraaEmotion>("idle");
  const [themeColor, setThemeColor] = useState<string>("charcoal");
  const [userCaption, setUserCaption] = useState<string>("");
  const [characterState, setCharacterState] = useState<"idle" | "thinking" | "talking">("idle");

  const detectEmotionFromText = (text: string): MyraaEmotion => {
    const lower = text.toLowerCase();
    if (lower.includes("haha") || lower.includes("lol") || lower.includes("funny") || lower.includes("joke") || lower.includes("hehe") || lower.includes("wink")) return "playful";
    if (lower.includes("happy") || lower.includes("harmony") || lower.includes("glad") || lower.includes("joy") || lower.includes("wonderful") || lower.includes("love") || lower.includes("smile")) return "happy";
    if (lower.includes("wow") || lower.includes("awesome") || lower.includes("excited") || lower.includes("amazing") || lower.includes("yay") || lower.includes("incredible") || lower.includes("hype")) return "excited";
    if (lower.includes("really?") || lower.includes("curious") || lower.includes("interest") || lower.includes("tell me more") || lower.includes("why") || lower.includes("how") || lower.includes("wonder")) return "curious";
    if (lower.includes("think") || lower.includes("calculat") || lower.includes("analyz") || lower.includes("hmmm") || lower.includes("process") || lower.includes("let me see") || lower.includes("conclude")) return "thinking";
    if (lower.includes("proud") || lower.includes("achieved") || lower.includes("expert") || lower.includes("skill") || lower.includes("confidence") || lower.includes("succeed")) return "proud";
    if (lower.includes("sad") || lower.includes("sorry") || lower.includes("unfortunate") || lower.includes("grief") || lower.includes("bad") || lower.includes("regret") || lower.includes("alas") || lower.includes("cry")) return "sad";
    if (lower.includes("shock") || lower.includes("surprise") || lower.includes("gasp") || lower.includes("unexpected") || lower.includes("seriously") || lower.includes("oh my")) return "surprised";
    if (lower.includes("blush") || lower.includes("shy") || lower.includes("embarrass") || lower.includes("nervous") || lower.includes("oops") || lower.includes("sorry about")) return "embarrassed";
    if (lower.includes("what?") || lower.includes("confus") || lower.includes("puzzled") || lower.includes("dont know") || lower.includes("not sure") || lower.includes("wait")) return "confused";
    return "idle";
  };
  const [modelCaption, setModelCaption] = useState<string>("");
  const [showSearchHub, setShowSearchHub] = useState<boolean>(false);
  const [searchHubInitialQuery, setSearchHubInitialQuery] = useState<string>("");
  const [searchHubInitialPlatform, setSearchHubInitialPlatform] = useState<SearchPlatform>("google");
  const [showYouTubeHub, setShowYouTubeHub] = useState<boolean>(false);
  const [youTubeHubQuery, setYouTubeHubQuery] = useState<string>("Trending Music");
  const [youTubeHubVideoId, setYouTubeHubVideoId] = useState<string | undefined>(undefined);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Myra core modules state
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [showNotepad, setShowNotepad] = useState<boolean>(false);
  const [calcInitialExpression, setCalcInitialExpression] = useState<string>("");
  const [notepadNotes, setNotepadNotes] = useState<Note[]>([]);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // Myraa recollections database core state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showMemoryDashboard, setShowMemoryDashboard] = useState<boolean>(false);

  // Dynamic Personality Engine Core State
  const [activeMode, setActiveMode] = useState<PersonalityMode>(() => {
    try {
      const saved = localStorage.getItem("myra_active_personality_mode");
      if (saved && (saved === "DEFAULT" || saved === "STRICT" || saved === "TECH" || saved === "SAVAGE" || saved === "DETECTIVE")) {
        return saved as PersonalityMode;
      }
    } catch {}
    return "DEFAULT";
  });

  const handleModeChange = (newMode: PersonalityMode) => {
    setActiveMode(newMode);
    try {
      localStorage.setItem("myra_active_personality_mode", newMode);
    } catch {}

    const profile = PERSONALITY_PROFILES[newMode];
    if (sessionRef.current) {
      sessionRef.current.sendPersonalityMode(newMode);
      if (profile?.voice_engine?.playbackRate) {
        sessionRef.current.setVoicePlaybackRate(profile.voice_engine.playbackRate);
      }
    }

    setToastNotification(`🌟 Mode Activated: ${profile.name} (${profile.ui_theme.theme_name})`);
    setTimeout(() => setToastNotification(null), 3500);
  };

  const sessionRef = useRef<MyraaAudioSession | null>(null);

  // Fetch initial recollections from backend database
  useEffect(() => {
    fetch("/api/memories")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMemories(data);
        }
      })
      .catch(err => console.error("Initial persistent recollections load failure:", err));
  }, []);

  const handleAddManualMemory = async (category: MemoryCategory, text: string) => {
    try {
      const resp = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, text })
      });
      const saved = await resp.json();
      if (saved && saved.id) {
        setMemories((prev) => [...prev, saved]);
      }
    } catch (err) {
      console.error("Manual database recollect upload error:", err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const resp = await fetch(`/api/memories/${id}`, {
        method: "DELETE"
      });
      const resObj = await resp.json();
      if (resObj && resObj.success) {
        setMemories((prev) => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error("Manual memory delete execution failed:", err);
    }
  };

  // Inter-tool handoffs
  const handleSendNotepadToSearch = (content: string) => {
    setSearchHubInitialQuery(content);
    setShowNotepad(false);
    setShowSearchHub(true);
  };

  const handleSendNotepadToCalculator = (expression: string) => {
    setCalcInitialExpression(expression);
    setShowNotepad(false);
    setShowCalculator(true);
  };

  const handleSendToNotepadGlobal = async (content: string, title?: string) => {
    try {
      const newNote: Note = {
        id: "note_" + Math.random().toString(36).substring(2, 9),
        title: title || "मायरा सुरक्षित नोट",
        content,
        tags: ["Saved"],
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const resp = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNote)
      });
      const saved = await resp.json();
      if (saved) {
        setNotepadNotes(prev => [saved, ...prev]);
        setToastNotification(`📝 नोटपैड में सुरक्षित हुआ: ${title || "नया नोट"}`);
        setTimeout(() => setToastNotification(null), 3500);
      }
    } catch (err) {
      console.error("Save to notepad error:", err);
    }
  };

  // Initialize the audio session handlers once on mount
  useEffect(() => {
    sessionRef.current = new MyraaAudioSession({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === "disconnected") {
          setUserCaption("");
          setModelCaption("");
          setActiveEmotion("idle");
          setCharacterState("idle");
        } else if (newState === "listening") {
          setActiveEmotion("idle");
          setCharacterState("idle");
        } else if (newState === "speaking") {
          setCharacterState("talking");
        }
      },
      onTranscription: (role, text) => {
        if (role === "user") {
          setUserCaption(text);
          setModelCaption("");
          setCharacterState("thinking");
        } else if (role === "model") {
          setModelCaption((prev) => {
            const next = prev + text;
            const newEmotion = detectEmotionFromText(next);
            setActiveEmotion(newEmotion);
            return next;
          });
          setUserCaption("");
        }
      },
      onToolCall: (name, args, callback) => {
        console.log(`[App] Tool call triggered: ${name}`, args);
        
        if (name === "calculateInfiniteMath") {
          setCalcInitialExpression(args.expression || "");
          setShowCalculator(true);
          callback({ result: `Opened Smart Infinite Calculator for: ${args.expression}` });
          return;
        }

        if (name === "addToSpeechNotepad") {
          setToastNotification(`📝 नोटपैड में लाइव सुरक्षित हुआ: ${args.title || "Voice Note"}`);
          setTimeout(() => setToastNotification(null), 3500);
          callback({ result: "Saved to Smart Speech Notepad successfully." });
          return;
        }

        if (name === "openSearchHub") {
          if (args.platform === "youtube") {
            setYouTubeHubQuery(args.query || "Trending Music");
            setShowYouTubeHub(true);
            callback({ result: `Opened YouTube Player Window for "${args.query}"` });
            return;
          }
          setSearchHubInitialPlatform((args.platform as SearchPlatform) || "google");
          setSearchHubInitialQuery(args.query || "");
          setShowSearchHub(true);
          callback({ result: `Opened Search Hub for "${args.query}" on ${args.platform}` });
          return;
        }

        if (name === "switchPersonalityMode") {
          const target = ((args.mode || "DEFAULT") as string).toUpperCase() as PersonalityMode;
          handleModeChange(target);
          callback({ result: `Switched active personality mode to ${target}. Theme and voice modulation updated.` });
          return;
        }

        if (name === "changeBackground") {
          const colorName = args.color?.toLowerCase();
          const validColors = ["violet", "crimson", "emerald", "celestial", "gold", "rose", "charcoal"];
          
          if (colorName && validColors.includes(colorName)) {
            setThemeColor(colorName);
            callback({ result: `Successfully shifted aesthetic atmosphere to ${colorName}.` });
          } else {
            callback({ error: `Unsupported color '${colorName}'. Supported themes are: ${validColors.join(", ")}` });
          }
        } else {
          callback({ error: `Tool ${name} is not implemented.` });
        }
      },
      onError: (err) => {
        setErrorText(err);
      },
      onMemorySync: (updatedMemories) => {
        console.log("[App] WebSocket memories sync triggered:", updatedMemories);
        if (Array.isArray(updatedMemories)) {
          setMemories(updatedMemories);
        }
      },
      onNoteSync: (note, notesList) => {
        if (notesList) setNotepadNotes(notesList);
        setToastNotification(`📝 नोटपैड में सुरक्षित हुआ: ${note.title || "नया नोट"}`);
        setTimeout(() => setToastNotification(null), 3500);
      },
      onCalculatorRequest: (expression) => {
        setCalcInitialExpression(expression);
        setShowCalculator(true);
      },
      onSearchHubRequest: (targetPlatform, targetQuery) => {
        if (targetPlatform === "youtube") {
          setYouTubeHubQuery(targetQuery || "Trending Music");
          setShowYouTubeHub(true);
        } else {
          setSearchHubInitialPlatform((targetPlatform as SearchPlatform) || "google");
          setSearchHubInitialQuery(targetQuery || "");
          setShowSearchHub(true);
        }
      },
      onPersonalityModeSwitch: (modeStr) => {
        const validModes: PersonalityMode[] = ["DEFAULT", "STRICT", "TECH", "SAVAGE", "DETECTIVE"];
        const matched = validModes.find(m => m.toLowerCase() === modeStr.toLowerCase());
        if (matched) {
          handleModeChange(matched);
        }
      }
    });

    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
      }
    };
  }, []);

  const handleToggleConnection = async () => {
    setErrorText(null);
    if (!sessionRef.current) return;

    if (state === "disconnected") {
      await sessionRef.current.connect();
    } else {
      sessionRef.current.disconnect();
    }
  };

  const currentProfile = PERSONALITY_PROFILES[activeMode] || PERSONALITY_PROFILES.DEFAULT;

  // Maps personality mode and theme colors to CSS ambient light spots
  const getAmbientStyles = () => {
    switch (activeMode) {
      case "STRICT":
        return "from-red-950/70 via-amber-950/35 to-black";
      case "TECH":
        return "from-cyan-950/60 via-purple-950/30 to-[#020308]";
      case "SAVAGE":
        return "from-pink-950/60 via-purple-950/35 to-[#05000a]";
      case "DETECTIVE":
        return "from-emerald-950/65 via-teal-950/30 to-[#000502]";
      case "DEFAULT":
      default:
        return "from-blue-950/45 via-cyan-950/20 to-slate-950";
    }
  };

  const getThemeTextGlow = () => {
    return `drop-shadow-[0_0_12px_${currentProfile.ui_theme.primary_color}80]`;
  };

  const getOrbRingColor = () => {
    switch (state) {
      case "listening": return "border-cyan-400/80 shadow-[0_0_30px_rgba(34,211,238,0.3)] bg-cyan-500/10";
      case "speaking": return "border-purple-400/80 shadow-[0_0_40px_rgba(168,85,247,0.4)] bg-purple-500/10";
      case "connecting": return "border-amber-500/50 animate-pulse bg-amber-500/10";
      case "disconnected":
      default:
        return "border-white/10 hover:border-white/30 bg-white/5";
    }
  };

  return (
    <div
      id="myraa-holographic-desktop"
      className={`relative w-full h-screen overflow-hidden bg-[#020205] text-white ${getAmbientStyles()} theme-transition flex flex-col justify-between p-4 sm:p-8 select-none`}
    >
      {/* Ambient Background Gradients matching Frosted Glass theme */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[130px] pointer-events-none transition-colors duration-1000 opacity-25"
        style={{ backgroundColor: currentProfile.ui_theme.primary_color }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none transition-colors duration-1000 opacity-20"
        style={{ backgroundColor: currentProfile.ui_theme.accent_color }}
      />
      <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-indigo-800/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Decorative grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      {/* FULL VIEWPORT HOLOGRAPHIC STAGE: Myraa materializes across the entire screen */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <MyraaCoreVisualizer
          session={sessionRef.current}
          state={state}
          themeColor={themeColor}
          activeEmotion={activeEmotion}
          characterState={characterState}
          activeMode={activeMode}
        />
      </div>

      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-black/85 border text-xs font-sans shadow-2xl backdrop-blur-xl flex items-center gap-2 pointer-events-auto"
            style={{
              borderColor: `${currentProfile.ui_theme.primary_color}60`,
              color: "#fff",
              boxShadow: `0 0 30px ${currentProfile.ui_theme.primary_color}35`
            }}
          >
            <Sparkles size={14} style={{ color: currentProfile.ui_theme.primary_color }} className="shrink-0" />
            <span>{toastNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION - Streamlined top navigation with compact personality tool button and adjacent utility icons */}
      <header className="relative z-30 flex items-center justify-between gap-3 w-full max-w-6xl mx-auto select-none px-1">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-[0.4em] text-white/70 uppercase font-sans">
              Myraa
            </span>
            <div 
              className="w-2 h-2 rounded-full transition-colors duration-500" 
              style={{
                backgroundColor: state === "listening" || state === "speaking" ? currentProfile.ui_theme.primary_color : "rgba(255,255,255,0.2)",
                boxShadow: state === "listening" || state === "speaking" ? `0 0 10px ${currentProfile.ui_theme.primary_color}` : "none"
              }}
            />
          </div>

          <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
            <Sparkles size={10} style={{ color: currentProfile.ui_theme.primary_color }} />
            <span>Dev: Anant</span>
          </div>
        </div>

        {/* Right: Compact Personality Switcher + Unified Toolbox */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Personality Switcher Button [ 🎭 Original ▾ ] stays in place */}
          <PersonalityModeSwitcher
            activeMode={activeMode}
            onModeChange={handleModeChange}
          />

          {/* Single Unified Toolbox containing all tools in one compact box */}
          <ToolboxDropdown
            activeMode={activeMode}
            onOpenYouTube={() => setShowYouTubeHub(true)}
            onOpenSearch={() => setShowSearchHub(true)}
            onOpenCalculator={() => setShowCalculator(true)}
            onOpenNotepad={() => setShowNotepad(true)}
            onToggleScreenShare={isScreenSharing ? stopScreenSharing : startScreenSharing}
            isScreenSharing={isScreenSharing}
            isScreenSharingPaused={isScreenSharingPaused}
            onOpenMemory={() => setShowMemoryDashboard(true)}
            onOpenGuide={() => setShowGuide(true)}
          />
        </div>
      </header>

      {/* CORE AVATAR AND VISUALS */}
      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-between py-6">
        
        {/* Space Spacer to avoid head area */}
        <div className="h-10 sm:h-20" />

        {/* Cinematic dialogue layer overlay - Smooth, delicate text transitions with soft focus blur */}
        <div id="cinematic-subtitles" className="w-full max-w-3xl flex flex-col items-center justify-center text-center px-6 relative z-25 mt-auto mb-6 pointer-events-none min-h-[6rem]">
          <AnimatePresence mode="wait">
            {(() => {
              const textType = modelCaption 
                ? "model" 
                : userCaption 
                  ? "user" 
                  : "status";

              const activeText = modelCaption 
                ? modelCaption 
                : userCaption 
                  ? userCaption 
                  : state === "listening" 
                    ? "मैं सुन रही हूँ, बोलिए अनंत जी... (Listening freely...)" 
                    : state === "connecting" 
                      ? "मायरा सक्रिय हो रही है... (Awakening Myra's presence...)" 
                      : "नमस्ते अनंत जी! मायरा को सक्रिय करने के लिए कोर बटन दबाएँ।";

              return (
                <motion.div
                  key={textType}
                  initial={{ opacity: 0, y: 15, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -15, filter: "blur(6px)" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center justify-center w-full"
                >
                  {textType === "model" && (
                    <h2 className="text-xl sm:text-2xl font-light text-white leading-relaxed tracking-wide font-display max-w-2xl drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]">
                      {activeText}
                    </h2>
                  )}

                  {textType === "user" && (
                    <p className="text-cyan-300 font-mono text-sm sm:text-base tracking-wider flex items-center justify-center gap-2 drop-shadow-[0_1px_10px_rgba(0,0,0,0.85)] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>&ldquo;{activeText}&rdquo;</span>
                    </p>
                  )}

                  {textType === "status" && (
                    <span className="text-xs sm:text-sm tracking-[0.1em] font-medium text-white/50 font-sans drop-shadow-[0_1px_4px_rgba(0, 0, 0, 0.5)]">
                      {activeText}
                    </span>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>

        {/* Interactive suggestions prompt guide */}
        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="mt-6 p-5 rounded-2xl border border-white/10 bg-slate-900/85 backdrop-blur-2xl max-w-md text-left w-full absolute z-40 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3 text-white">
                <div className="flex items-center gap-1.5 font-display text-sm font-bold tracking-wide">
                  <Sparkles size={16} className="text-cyan-400" />
                  <span>मायरा वॉइस व रिसर्च कमांड्स</span>
                </div>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                मायरा एक अत्यधिक समझदार रिसर्च असिस्टेंट और कोडिंग पार्टनर है। आप सीधे बोलकर या नीचे दिए गए टूल्स का उपयोग कर सकते हैं:
              </p>
              {/* Personality Modes Switcher Section */}
              <div className="mb-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-2">
                  🎭 डायनामिक पर्सनैलिटी मोड्स (Voice & Theme Controller)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["DEFAULT", "STRICT", "TECH", "SAVAGE", "DETECTIVE"] as PersonalityMode[]).map((mode) => {
                    const prof = PERSONALITY_PROFILES[mode];
                    const isSelected = activeMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => {
                          handleModeChange(mode);
                          setShowGuide(false);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-mono flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? "bg-white/20 text-white border border-white/30 font-bold"
                            : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: prof.ui_theme.primary_color }} 
                          />
                          <span>{prof.name}</span>
                        </span>
                        <span className="text-[9px] opacity-60">[{mode}]</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 text-xs font-sans text-slate-200">
                <div 
                  onClick={() => {
                    setShowSearchHub(true);
                    setSearchHubInitialPlatform("google");
                    setSearchHubInitialQuery("Quantum Computing and AI");
                    setShowGuide(false);
                  }}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer"
                >
                  ⚡ &quot;मायरा, Google, YouTube या Wikipedia पर सर्च करो&quot; <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">Google, YouTube, Wikipedia व DuckDuckGo इन-ऐप सर्च हब</span>
                </div>
                <div 
                  onClick={() => {
                    setShowCalculator(true);
                    setCalcInitialExpression("3x^2 - 5x + 2 = 0");
                    setShowGuide(false);
                  }}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer"
                >
                  ⚡ &quot;मायरा, 2^64 का मान और x^2 - 4x + 4 = 0 का हल बताओ&quot; <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">स्मार्ट इनफिनिट कैलकुलेटर सक्रिय करता है</span>
                </div>
                <div 
                  onClick={() => {
                    setShowNotepad(true);
                    setShowGuide(false);
                  }}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer"
                >
                  ⚡ &quot;मायरा, इसे नोटपैड में लिख लो&quot; <span className="text-[10px] font-mono text-purple-400 block mt-0.5">स्मार्ट स्पीच नोटपैड में लाइव ट्रांसक्राइब व सेव करता है</span>
                </div>
                <div 
                  onClick={() => {
                    setShowSearchHub(true);
                    setSearchHubInitialPlatform("wikipedia");
                    setSearchHubInitialQuery("Space exploration ISRO");
                    setShowGuide(false);
                  }}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer"
                >
                  ⚡ &quot;मायरा, विकिपीडिया पर स्पेस मिशन के बारे में बताओ&quot; <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">विकिपीडिया व गूगल से विस्तृत जानकारी</span>
                </div>
                <div 
                  onClick={() => {
                    setShowYouTubeHub(true);
                    setYouTubeHubQuery("Trending Hindi Songs");
                    setShowGuide(false);
                  }}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer"
                >
                  ⚡ &quot;मायरा, YouTube पर कोई वीडियो या गाना चलाओ&quot; <span className="text-[10px] font-mono text-red-400 block mt-0.5">इन-ऐप समर्पित YouTube वीडियो प्लेयर व एक्सप्लोरर</span>
                </div>
                <div 
                  onClick={() => {
                    setShowCalculator(true);
                    setCalcInitialExpression("integrate x^2 * sin(x) dx");
                    setShowGuide(false);
                  }}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer"
                >
                  ⚡ &quot;मायरा, x^2 * sin(x) का समाकलन और फॉर्मूला बताओ&quot; <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">स्मार्ट कैलकुलेटर में स्टेप-बाई-स्टेप हल</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Error Banner */}
        <AnimatePresence>
          {errorText && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="mt-6 flex flex-col gap-2.5 p-4 rounded-2xl border border-rose-500/30 bg-rose-950/60 backdrop-blur-xl max-w-md w-full text-left shadow-2xl z-30"
            >
              <div className="flex items-start gap-3">
                <CircleAlert className="text-rose-400 shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-rose-300 font-mono">
                    माइक्रोफोन व ऑडियो सहायता (Audio Connection)
                  </h4>
                  <p className="text-xs text-rose-200 mt-1 leading-relaxed font-sans">{errorText}</p>
                  
                  {errorText.toLowerCase().includes("अनुमति") || errorText.toLowerCase().includes("permission") || errorText.toLowerCase().includes("notallowed") ? (
                    <div className="mt-2 p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-300 leading-normal">
                      💡 <strong>त्वरित समाधान:</strong> ब्राउज़र के URL बार में बाएं कोने पर लॉक (🔒) या माइक आइकन पर टैप करें और <em>Microphone</em> को <strong>&quot;Allow&quot;</strong> करें।
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-rose-500/20">
                <button
                  onClick={() => {
                    setErrorText(null);
                    handleToggleConnection();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 text-xs font-medium transition cursor-pointer"
                >
                  पुनः प्रयास करें (Try Again)
                </button>
                <button
                  onClick={() => {
                    setErrorText(null);
                    setShowSearchHub(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-medium transition cursor-pointer"
                >
                  सर्च हब खोलें (Search Hub)
                </button>
                <button
                  onClick={() => setErrorText(null)}
                  className="ml-auto text-[11px] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  खारिज करें (Dismiss)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* FOOTER INTERFACE WITH WAVEFORM AND CONTROLS */}
      <footer className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center gap-5 mt-auto">
        
        {/* Dynamic Minimalist Waveform Visualizer */}
        <div className="flex items-center justify-center gap-1 h-8 w-44">
          {[12, 28, 16, 32, 20, 8].map((baseHeight, idx) => {
            let heightFactor = 0.35;
            if (state === "speaking") {
              heightFactor = 0.35 + Math.sin(Date.now() * 0.02 + idx * 0.9) * 0.65;
            } else if (state === "listening") {
              heightFactor = 0.2 + Math.sin(Date.now() * 0.01 + idx * 0.5) * 0.4;
            } else {
              heightFactor = idx % 2 === 0 ? 0.25 : 0.12;
            }
            const calculatedHeight = Math.max(3, baseHeight * heightFactor);

            return (
              <div
                key={idx}
                className="w-0.5 rounded-full transition-all duration-300"
                style={{ 
                  height: `${calculatedHeight}px`,
                  backgroundColor: state === "speaking" 
                    ? currentProfile.ui_theme.accent_color 
                    : state === "listening" 
                    ? currentProfile.ui_theme.primary_color 
                    : "rgba(255,255,255,0.12)",
                  boxShadow: state !== "disconnected" ? `0 0 10px ${currentProfile.ui_theme.primary_color}80` : undefined
                }}
              />
            );
          })}
        </div>

        {/* Glossy Beautiful Primary Connector Core Node */}
        <div className="flex items-center justify-center relative mb-4">
          <button 
            onClick={handleToggleConnection}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer ${
              state === "disconnected"
                ? "bg-white/10 hover:bg-white/15 border border-white/15 text-white shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:scale-105 active:scale-95"
                : state === "listening"
                ? "text-white animate-pulse scale-105"
                : state === "speaking"
                ? "text-white scale-105"
                : "bg-amber-600 border border-amber-300 text-white animate-spin"
            }`}
            style={
              state === "listening"
                ? {
                    backgroundColor: `${currentProfile.ui_theme.primary_color}25`,
                    borderColor: currentProfile.ui_theme.primary_color,
                    borderWidth: "1.5px",
                    boxShadow: `0 0 35px ${currentProfile.ui_theme.primary_color}80`,
                    color: currentProfile.ui_theme.accent_color
                  }
                : state === "speaking"
                ? {
                    backgroundColor: `${currentProfile.ui_theme.primary_color}e6`,
                    borderColor: currentProfile.ui_theme.accent_color,
                    borderWidth: "1.5px",
                    boxShadow: `0 0 45px ${currentProfile.ui_theme.accent_color}99`,
                    color: "#ffffff"
                  }
                : undefined
            }
            title={state === "disconnected" ? "Awake Myra" : "Sleep core"}
          >
            {state === "disconnected" ? (
              <Power className="opacity-80" size={24} />
            ) : state === "connecting" ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : state === "listening" ? (
              <Mic size={24} style={{ color: currentProfile.ui_theme.accent_color }} />
            ) : (
              <Volume2 size={24} className="text-white" />
            )}
          </button>

          {errorText && (
            <button 
              onClick={() => setErrorText(null)}
              className="absolute right-[-60px] p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition duration-150 cursor-pointer"
              title="Dismiss error"
            >
              <X size={16} />
            </button>
          )}
        </div>

      </footer>

      {/* Dynamic Floating Glassmorphic Screen Sharing Control Hub */}
      <AnimatePresence>
        {isScreenSharing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 50 }}
            className={`absolute bottom-6 md:bottom-10 right-6 md:right-10 z-50 w-72 p-4 rounded-2xl border ${
              isScreenSharingPaused 
                ? "border-amber-500/20 bg-slate-950/70" 
                : "border-cyan-500/20 bg-slate-950/70"
            } backdrop-blur-2xl shadow-2xl overflow-hidden`}
          >
            {/* Header / Indicator */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isScreenSharingPaused ? "bg-amber-400" : "bg-cyan-400 animate-pulse"}`} />
                <span className="text-[10px] font-bold font-mono tracking-widest text-slate-200">
                  {isScreenSharingPaused ? "SCREEN VISION PAUSED" : "SCREEN VISION ACTIVE"}
                </span>
              </div>
              <button 
                onClick={stopScreenSharing}
                className="text-slate-400 hover:text-white transition-colors duration-150 p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                title="Stop Sharing"
              >
                <X size={14} />
              </button>
            </div>

            {/* Smart Video PIP Preview Holder */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-white/5 mb-3 flex items-center justify-center group select-none">
              <video
                ref={(el) => {
                  if (el && screenStreamRef.current && el.srcObject !== screenStreamRef.current) {
                    el.srcObject = screenStreamRef.current;
                    el.muted = true;
                    el.play().catch(err => console.log("Mini preview stream play issue:", err));
                  }
                }}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isScreenSharingPaused ? "opacity-30 blur-sm" : "opacity-90"
                }`}
                autoPlay
                playsInline
                muted
              />

              {isScreenSharingPaused && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] uppercase tracking-widest font-mono text-amber-400 font-bold px-2 py-1 bg-amber-950/40 border border-amber-500/20 rounded-md">
                    Transmission Paused
                  </span>
                </div>
              )}
              
              {!isScreenSharingPaused && screenVisionMode && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-400/20 text-[9px] font-mono text-cyan-300">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                  <span>Streaming FPS: 0.5</span>
                </div>
              )}
            </div>

            {/* Quick Action Control Strip */}
            <div className="flex items-center justify-between gap-1.5 mb-2.5">
              {isScreenSharingPaused ? (
                <button
                  onClick={resumeScreenSharing}
                  className="flex-1 py-1.5 px-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-xs font-mono font-medium text-cyan-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Resume Streaming Feed"
                >
                  <Play size={10} />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={pauseScreenSharing}
                  className="flex-1 py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-xs font-mono font-medium text-amber-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Pause Streaming Feed"
                >
                  <Pause size={10} />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={switchScreenShare}
                className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all cursor-pointer"
                title="Choose Another Screen or Window"
              >
                <RefreshCw size={11} />
                <span>Switch</span>
              </button>

              <button
                onClick={stopScreenSharing}
                className="py-1.5 px-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-xs font-mono text-rose-400 flex items-center justify-center gap-1 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Terminate Stream"
              >
                <Square size={9} />
                <span>Stop</span>
              </button>
            </div>

            {/* Core Mode Configuration Toggle */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-left">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold font-mono text-slate-200">SCREEN VISION MODE</span>
                <span className="text-[8px] text-slate-400 uppercase font-mono max-w-[150px]">Gemini Auto-Analysis</span>
              </div>
              <button
                onClick={() => setScreenVisionMode(!screenVisionMode)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  screenVisionMode ? "bg-cyan-500" : "bg-white/10"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                    screenVisionMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recollections sliding core panel */}
      <MemoryDashboard
        isOpen={showMemoryDashboard}
        onClose={() => setShowMemoryDashboard(false)}
        memories={memories}
        onAddMemory={handleAddManualMemory}
        onDeleteMemory={handleDeleteMemory}
        themeColor={themeColor}
      />

      {/* Smart Infinite Calculator Modal */}
      <SmartInfiniteCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        onSendToNotepad={handleSendToNotepadGlobal}
        initialExpression={calcInitialExpression}
        themeColor={themeColor}
      />

      {/* Smart Speech Notepad Modal */}
      <SmartSpeechNotepad
        isOpen={showNotepad}
        onClose={() => setShowNotepad(false)}
        onSendToChat={handleSendNotepadToSearch}
        onSendToCalculator={handleSendNotepadToCalculator}
        externalNotes={notepadNotes}
        onNoteChange={(updated) => setNotepadNotes(updated)}
        liveUserCaption={userCaption}
        themeColor={themeColor}
      />

      {/* Universal In-App Search Hub Modal (Google, YouTube, Wikipedia, DuckDuckGo) */}
      <UniversalSearchHub
        isOpen={showSearchHub}
        onClose={() => setShowSearchHub(false)}
        onSendToNotepad={handleSendToNotepadGlobal}
        onOpenYouTubeHub={(q, vId) => {
          if (q) setYouTubeHubQuery(q);
          if (vId) setYouTubeHubVideoId(vId);
          setShowYouTubeHub(true);
        }}
        initialQuery={searchHubInitialQuery}
        initialPlatform={searchHubInitialPlatform}
        themeColor={themeColor}
      />

      {/* Dedicated Full In-App YouTube Hub & Video Player Modal */}
      <YouTubeHubModal
        isOpen={showYouTubeHub}
        onClose={() => setShowYouTubeHub(false)}
        onSendToNotepad={handleSendToNotepadGlobal}
        initialQuery={youTubeHubQuery}
        initialVideoId={youTubeHubVideoId}
        themeColor={themeColor}
      />
    </div>
  );
}
