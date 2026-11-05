import React, { useState, useEffect, useRef } from "react";
import { 
  ChevronDown, 
  Search, 
  Calculator, 
  FileText, 
  Monitor, 
  Brain, 
  Compass, 
  X,
  Sparkles,
  Wrench,
  Youtube
} from "lucide-react";
import { PersonalityMode, PERSONALITY_PROFILES } from "../types/personality";

interface ToolboxDropdownProps {
  activeMode: PersonalityMode;
  onOpenYouTube: () => void;
  onOpenSearch: () => void;
  onOpenCalculator: () => void;
  onOpenNotepad: () => void;
  onToggleScreenShare: () => void;
  isScreenSharing: boolean;
  isScreenSharingPaused: boolean;
  onOpenMemory: () => void;
  onOpenGuide: () => void;
  className?: string;
}

export const ToolboxDropdown: React.FC<ToolboxDropdownProps> = ({
  activeMode,
  onOpenYouTube,
  onOpenSearch,
  onOpenCalculator,
  onOpenNotepad,
  onToggleScreenShare,
  isScreenSharing,
  isScreenSharingPaused,
  onOpenMemory,
  onOpenGuide,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const profile = PERSONALITY_PROFILES[activeMode] || PERSONALITY_PROFILES.DEFAULT;

  // Close on click outside
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

  const handleToolClick = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const tools = [
    {
      id: "youtube",
      name: "YouTube Hub",
      hindiName: "यूट्यूब वीडियो हब",
      description: "सिस्टम में पूरा YouTube, कोई भी वीडियो खोजें व देखें",
      icon: Youtube,
      color: "#EF4444",
      action: onOpenYouTube,
      badge: "Video Player"
    },
    {
      id: "search",
      name: "Search Hub",
      hindiName: "सर्च हब",
      description: "Google, Wikipedia व वेब लाइव खोज",
      icon: Search,
      color: "#38BDF8",
      action: onOpenSearch,
      badge: "Google & Wiki"
    },
    {
      id: "calculator",
      name: "Infinite Calculator",
      hindiName: "स्मार्ट कैलकुलेटर",
      description: "असीमित गणित, समीकरण व वैज्ञानिक हल",
      icon: Calculator,
      color: "#22D3EE",
      action: onOpenCalculator,
      badge: "High-Precision"
    },
    {
      id: "notepad",
      name: "Speech Notepad",
      hindiName: "स्पीच नोटपैड",
      description: "लाइव वॉइस नोट्स व सुरक्षित ट्रांसक्रिप्शन",
      icon: FileText,
      color: "#C084FC",
      action: onOpenNotepad,
      badge: "Voice & Text"
    },
    {
      id: "screenshare",
      name: "Screen Vision",
      hindiName: "स्क्रीन शेयरिंग",
      description: isScreenSharing ? "स्क्रीन विज़न सक्रिय है (क्लिक कर रोकें)" : "स्क्रीन शेयर कर मायरा से विश्लेषण कराएं",
      icon: Monitor,
      color: isScreenSharing ? "#4ADE80" : "#94A3B8",
      action: onToggleScreenShare,
      badge: isScreenSharing ? (isScreenSharingPaused ? "PAUSED" : "ACTIVE") : "Visual AI"
    },
    {
      id: "memory",
      name: "Memory Core",
      hindiName: "मेमोरी कोर",
      description: "स्थायी यादें, प्राथमिकताएं व डेटाबेस",
      icon: Brain,
      color: "#F472B6",
      action: onOpenMemory,
      badge: "Long-Term"
    },
    {
      id: "guide",
      name: "Myra Guide",
      hindiName: "मायरा गाइड",
      description: "वॉइस कमांड्स, फीचर्स व उपयोग निर्देश",
      icon: Compass,
      color: "#FBBF24",
      action: onOpenGuide,
      badge: "Tips"
    }
  ];

  return (
    <div ref={containerRef} className={`relative inline-block select-none ${className}`}>
      {/* Compact Toolbox Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer text-xs font-medium backdrop-blur-xl shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        style={{
          backgroundColor: isOpen ? `${profile.ui_theme.primary_color}25` : "rgba(255, 255, 255, 0.06)",
          borderColor: isOpen ? profile.ui_theme.primary_color : "rgba(255, 255, 255, 0.12)",
          color: "#ffffff",
          boxShadow: isOpen ? `0 0 16px ${profile.ui_theme.primary_color}30` : undefined
        }}
        title="टूलबॉक्स (Toolbox) — सभी टूल्स एक स्थान पर"
      >
        <span className="text-sm shrink-0 leading-none">🧰</span>
        <span className="font-sans font-semibold tracking-wide text-white">Toolbox</span>
        {isScreenSharing && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
        <ChevronDown 
          size={13} 
          className={`transition-transform duration-200 shrink-0 text-slate-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Floating Popup Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sleek Floating Toolbox Modal */}
      {isOpen && (
        <div 
          className="fixed sm:absolute top-16 sm:top-full sm:mt-2 left-4 right-4 sm:left-auto sm:right-0 z-50 sm:w-[340px] p-3 rounded-2xl bg-slate-950/95 border backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-150 text-left"
          style={{
            borderColor: `${profile.ui_theme.primary_color}45`,
            boxShadow: `0 20px 50px rgba(0,0,0,0.85), 0 0 30px ${profile.ui_theme.primary_color}20`
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-base">🧰</span>
              <div>
                <h4 className="text-xs font-bold font-mono tracking-wider text-white uppercase flex items-center gap-1.5">
                  <span>मायरा टूलबॉक्स</span>
                  <span className="text-[10px] font-sans font-normal text-white/50">(Toolbox)</span>
                </h4>
                <p className="text-[10px] text-white/50 font-sans">
                  सभी आवश्यक टूल्स व सुविधाएं
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close toolbox"
            >
              <X size={14} />
            </button>
          </div>

          {/* Tools List Grid */}
          <div className="space-y-1.5 max-h-[70vh] sm:max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
            {tools.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.id}
                  onClick={() => handleToolClick(t.action)}
                  className="group flex items-center gap-3 p-2.5 rounded-xl border border-white/5 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-150 cursor-pointer"
                >
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105"
                    style={{
                      backgroundColor: `${t.color}15`,
                      borderColor: `${t.color}40`,
                      color: t.color
                    }}
                  >
                    <Icon size={17} />
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-white font-sans truncate group-hover:text-cyan-200 transition">
                        {t.name}
                      </span>
                      <span 
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0"
                        style={{
                          borderColor: `${t.color}40`,
                          color: t.color,
                          backgroundColor: `${t.color}10`
                        }}
                      >
                        {t.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/60 truncate mt-0.5 font-sans">
                      {t.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/40">
            <span className="flex items-center gap-1">
              <Sparkles size={10} style={{ color: profile.ui_theme.primary_color }} />
              Myra Intelligent Co-Pilot
            </span>
            <span className="text-white/30">Click to launch</span>
          </div>
        </div>
      )}
    </div>
  );
};
