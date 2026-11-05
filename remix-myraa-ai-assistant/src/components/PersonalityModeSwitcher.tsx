import React, { useState, useEffect, useRef } from "react";
import { 
  ChevronDown, 
  Check, 
  X,
  Volume2,
  Sparkles
} from "lucide-react";
import { 
  PersonalityMode, 
  PERSONALITY_PROFILES 
} from "../types/personality";

interface PersonalityOption {
  key: PersonalityMode;
  label: string;
  emoji: string;
  themeName: string;
  tagline: string;
  attitude: string;
  voiceStyle: string;
  pitch: string;
  speed: string;
  primaryColor: string;
  accentColor: string;
  trigger: string;
}

const PERSONALITY_OPTIONS: PersonalityOption[] = [
  {
    key: "DEFAULT",
    label: "Original",
    emoji: "🔹",
    themeName: "Classic Neon Breeze",
    tagline: "Approachable, sharp & warm co-pilot",
    attitude: "Warm, natural Indian-English/Hinglish friend and daily co-pilot.",
    voiceStyle: "Expressive & warm Hinglish tone",
    pitch: "Medium",
    speed: "Normal (1.0x)",
    primaryColor: "#4A90E2",
    accentColor: "#50E3C2",
    trigger: "[MODE: DEFAULT]"
  },
  {
    key: "STRICT",
    label: "Strict",
    emoji: "🔴",
    themeName: "Discipline Command",
    tagline: "Commanding mentor & taskmaster",
    attitude: "Zero excuses, direct and high-discipline accountability coach.",
    voiceStyle: "Authoritative, crisp & urgent",
    pitch: "Medium",
    speed: "Fast (1.15x)",
    primaryColor: "#FF3B30",
    accentColor: "#FF9500",
    trigger: "[MODE: STRICT]"
  },
  {
    key: "TECH",
    label: "Tech",
    emoji: "⚡",
    themeName: "Quantum Core Matrix",
    tagline: "Principal code architect & JARVIS",
    attitude: "Clean architecture, package dependencies and high-IQ dev solutioning.",
    voiceStyle: "Futuristic, calm & analytical",
    pitch: "Low",
    speed: "Normal (1.0x)",
    primaryColor: "#00F0FF",
    accentColor: "#7000FF",
    trigger: "[MODE: TECH]"
  },
  {
    key: "SAVAGE",
    label: "Savage",
    emoji: "🔥",
    themeName: "Savage Synthwave",
    tagline: "Roast master & witty friend",
    attitude: "Playful sarcasm and cheeky burns, while delivering accurate answers.",
    voiceStyle: "Sassy, rapid-fire & playful",
    pitch: "High",
    speed: "Normal (1.0x)",
    primaryColor: "#FF007F",
    accentColor: "#9B00FF",
    trigger: "[MODE: SAVAGE]"
  },
  {
    key: "DETECTIVE",
    label: "Cyber",
    emoji: "🕵️",
    themeName: "Shadow Protocol Noir",
    tagline: "Forensic mystery solver & keen investigator",
    attitude: "Natural, observant, thoughtful human thinker who loves exploring puzzles and clues.",
    voiceStyle: "Warm, natural, expressive & curious human tone",
    pitch: "Medium",
    speed: "Normal (1.0x)",
    primaryColor: "#00FF66",
    accentColor: "#1A3026",
    trigger: "[MODE: DETECTIVE]"
  }
];

interface PersonalityModeSwitcherProps {
  activeMode: PersonalityMode;
  onModeChange: (mode: PersonalityMode) => void;
  className?: string;
}

export const PersonalityModeSwitcher: React.FC<PersonalityModeSwitcherProps> = ({
  activeMode,
  onModeChange,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeOption = PERSONALITY_OPTIONS.find((opt) => opt.key === activeMode) || PERSONALITY_OPTIONS[0];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectMode = (mode: PersonalityMode) => {
    onModeChange(mode);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block select-none ${className}`}>
      {/* Compact Trigger Button: [ 🎭 Original ▾ ] */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer text-xs font-medium backdrop-blur-xl shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        style={{
          backgroundColor: `${activeOption.primaryColor}18`,
          borderColor: `${activeOption.primaryColor}55`,
          color: "#ffffff",
          boxShadow: `0 0 16px ${activeOption.primaryColor}30`
        }}
        title={`Active Personality: ${activeOption.label} (${activeOption.themeName}) — Click to switch`}
      >
        <span className="text-sm shrink-0 leading-none">🎭</span>
        <span className="font-sans font-semibold tracking-wide text-white">{activeOption.label}</span>
        <ChevronDown 
          size={13} 
          className={`transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
          style={{ color: activeOption.primaryColor }}
        />
      </button>

      {/* Floating Popup Modal Backdrop Overlay (for clicks outside & focus) */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sleek Floating Popup Modal with 5 Selectable Personality Cards */}
      {isOpen && (
        <div 
          className="fixed sm:absolute top-16 sm:top-full sm:mt-2 left-4 right-4 sm:left-auto sm:right-0 z-50 sm:w-[380px] p-3.5 rounded-2xl bg-slate-950/95 border backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-150 text-left"
          style={{
            borderColor: `${activeOption.primaryColor}50`,
            boxShadow: `0 20px 50px rgba(0,0,0,0.85), 0 0 35px ${activeOption.primaryColor}20`
          }}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-base">🎭</span>
              <div>
                <h3 className="text-xs font-bold font-mono tracking-wider text-white uppercase flex items-center gap-1.5">
                  <span>Personality Engine</span>
                  <span 
                    className="w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: activeOption.primaryColor }}
                  />
                </h3>
                <p className="text-[10px] text-white/50 font-sans">
                  Choose a persona to dynamically adapt UI, tone, and voice
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close modal"
            >
              <X size={14} />
            </button>
          </div>

          {/* The 5 Selectable Personality Cards */}
          <div className="space-y-1.5 max-h-[70vh] sm:max-h-[460px] overflow-y-auto pr-0.5 custom-scrollbar">
            {PERSONALITY_OPTIONS.map((opt, idx) => {
              const isSelected = activeMode === opt.key;

              return (
                <div
                  key={opt.key}
                  onClick={() => handleSelectMode(opt.key)}
                  className={`group relative p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "shadow-lg"
                      : "bg-white/[0.03] hover:bg-white/[0.08] border-white/5 hover:border-white/15"
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${opt.primaryColor}18`,
                          borderColor: opt.primaryColor,
                          boxShadow: `0 0 20px ${opt.primaryColor}30`
                        }
                      : undefined
                  }
                >
                  {/* Card Title & Status Row */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base select-none shrink-0">{opt.emoji}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white tracking-wide font-sans">
                          {idx + 1}. {opt.label}
                        </span>
                        <span 
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                          style={{
                            borderColor: `${opt.primaryColor}50`,
                            color: opt.primaryColor,
                            backgroundColor: `${opt.primaryColor}10`
                          }}
                        >
                          {opt.themeName}
                        </span>
                      </div>
                    </div>

                    {isSelected ? (
                      <div 
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase text-white shadow-sm"
                        style={{ backgroundColor: opt.primaryColor }}
                      >
                        <Check size={10} />
                        <span>ACTIVE</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-white/30 group-hover:text-white/60 transition">
                        {opt.trigger}
                      </span>
                    )}
                  </div>

                  {/* Card Description */}
                  <p className="text-[11px] text-white/70 line-clamp-2 pl-6 leading-relaxed mb-1.5">
                    {opt.attitude}
                  </p>

                  {/* Voice Specs & Accent Strip */}
                  <div className="flex items-center justify-between pl-6 text-[10px] font-mono text-white/50 border-t border-white/5 pt-1.5">
                    <div className="flex items-center gap-1">
                      <Volume2 size={11} style={{ color: opt.primaryColor }} />
                      <span>{opt.speed} • {opt.pitch} Pitch</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span 
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: opt.primaryColor }}
                        title={`Primary: ${opt.primaryColor}`}
                      />
                      <span 
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: opt.accentColor }}
                        title={`Accent: ${opt.accentColor}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Footer Tip */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/40">
            <span className="flex items-center gap-1">
              <Sparkles size={10} style={{ color: activeOption.primaryColor }} />
              Auto-activates UI theme & voice modulation
            </span>
            <span className="text-white/30">Tap to select</span>
          </div>
        </div>
      )}
    </div>
  );
};
