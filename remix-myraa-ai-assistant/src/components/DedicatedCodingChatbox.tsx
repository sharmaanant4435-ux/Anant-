import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal, 
  Send, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  FileCode, 
  Package, 
  Play, 
  BookOpen, 
  Trash2, 
  X, 
  FileText,
  RotateCcw,
  Zap,
  FolderOpen,
  Flame,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { 
  PersonalityMode, 
  PERSONALITY_PROFILES, 
  UIThemeConfig, 
  VoiceEngineConfig 
} from "../types/personality";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
  metadata?: {
    active_mode: PersonalityMode;
    ui_theme: UIThemeConfig;
    voice_engine: VoiceEngineConfig;
  };
}

interface DedicatedCodingChatboxProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToNotepad?: (content: string, title?: string) => void;
  initialQuery?: string;
  themeColor?: string;
  activeMode?: PersonalityMode;
  onModeChange?: (mode: PersonalityMode) => void;
}

export function DedicatedCodingChatbox({
  isOpen,
  onClose,
  onSendToNotepad,
  initialQuery = "",
  themeColor = "charcoal",
  activeMode = "DEFAULT",
  onModeChange
}: DedicatedCodingChatboxProps) {
  const [currentMode, setCurrentMode] = useState<PersonalityMode>(activeMode);

  useEffect(() => {
    if (activeMode && activeMode !== currentMode) {
      setCurrentMode(activeMode);
    }
  }, [activeMode]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("myra_chat_messages");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "msg-welcome",
        role: "model",
        content: 
          "```json\n" +
          "{\n" +
          "  \"active_mode\": \"DEFAULT\",\n" +
          "  \"ui_theme\": {\n" +
          "    \"primary_color\": \"#4A90E2\",\n" +
          "    \"accent_color\": \"#50E3C2\",\n" +
          "    \"background_style\": \"Dark glassmorphism, clean neutral aesthetic\",\n" +
          "    \"theme_name\": \"Classic Neon Breeze\"\n" +
          "  },\n" +
          "  \"voice_engine\": {\n" +
          "    \"pitch\": \"MEDIUM\",\n" +
          "    \"speed\": \"NORMAL\",\n" +
          "    \"style\": \"Warm, friendly, balanced, expressive natural Indian-English/Hinglish tone\"\n" +
          "  }\n" +
          "}\n" +
          "```\n\n" +
          "Hello Anant! I am Myra, your multi-personality Coding Architect & Adaptive AI Partner.\n\n" +
          "Choose any persona above or trigger via `[MODE: STRICT]`, `[MODE: TECH]`, `[MODE: SAVAGE]`, `[MODE: DETECTIVE]`, or `[MODE: DEFAULT]`:\n" +
          "• Complete, functional Python / Node.js projects & automation scripts with terminal install commands\n" +
          "• Custom school & coaching test papers (CBSE, JEE, NEET patterns) with full solutions\n" +
          "• High-yield revision formulas, exam cheat sheets, and bug fixes\n\n" +
          "What shall we build or solve together today?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ];
  });

  const [inputPrompt, setInputPrompt] = useState<string>(initialQuery || "");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showRawJsonMap, setShowRawJsonMap] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentProfile = PERSONALITY_PROFILES[currentMode] || PERSONALITY_PROFILES.DEFAULT;

  useEffect(() => {
    if (initialQuery) {
      setInputPrompt(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    try {
      localStorage.setItem("myra_chat_messages", JSON.stringify(messages.slice(-30)));
    } catch {}
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectMode = (newMode: PersonalityMode) => {
    setCurrentMode(newMode);
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputPrompt;
    if (!textToSend.trim() || isLoading) return;

    // Check for inline mode switch in prompt
    const modeMatch = textToSend.match(/\[MODE:\s*(DEFAULT|STRICT|TECH|SAVAGE|DETECTIVE)\]/i);
    let targetMode = currentMode;
    if (modeMatch) {
      targetMode = modeMatch[1].toUpperCase() as PersonalityMode;
      handleSelectMode(targetMode);
    }

    const userMsg: ChatMessage = {
      id: "usr-" + Math.random().toString(36).substring(2, 9),
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputPrompt("");
    setIsLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map(m => ({
            role: m.role,
            content: m.content
          })),
          mode: targetMode
        })
      });

      const data = await resp.json();

      if (data.active_mode && onModeChange && data.active_mode !== currentMode) {
        onModeChange(data.active_mode);
        setCurrentMode(data.active_mode);
      }

      if (data.text) {
        const modelMsg: ChatMessage = {
          id: "mdl-" + Math.random().toString(36).substring(2, 9),
          role: "model",
          content: data.text,
          metadata: data.metadata,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, modelMsg]);
      } else if (data.error) {
        const errMsg: ChatMessage = {
          id: "err-" + Math.random().toString(36).substring(2, 9),
          role: "model",
          content: `Error: ${data.error}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: "err-" + Math.random().toString(36).substring(2, 9),
        role: "model",
        content: `Connection error: ${err.message || "Failed to reach chat service."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "script.py";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper parser for markdown code blocks, dependencies, and file placement
  const renderMessageContent = (msg: ChatMessage) => {
    const rawContent = msg.content;

    // Check for JSON metadata block at start of model response
    let metadataBlock: any = msg.metadata || null;
    let textToDisplay = rawContent;
    let rawJsonSnippet = "";

    const jsonMatch = rawContent.match(/^```json\s*(\{[\s\S]*?\})\s*```/i);
    if (jsonMatch) {
      rawJsonSnippet = jsonMatch[0];
      try {
        metadataBlock = JSON.parse(jsonMatch[1]);
      } catch (e) {}
      textToDisplay = rawContent.replace(/^```json\s*\{[\s\S]*?\}\s*```/i, "").trim();
    }

    const parts = textToDisplay.split(/(```[\s\S]*?```)/g);

    return (
      <div className="space-y-3 leading-relaxed text-sm">
        {/* Render Personality Metadata Badge if present */}
        {metadataBlock && (
          <div 
            className="p-3 rounded-2xl bg-black/60 border text-xs font-mono space-y-2 mb-3 shadow-md"
            style={{
              borderColor: `${metadataBlock.ui_theme?.primary_color || currentProfile.ui_theme.primary_color}40`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full animate-ping"
                  style={{ backgroundColor: metadataBlock.ui_theme?.primary_color || currentProfile.ui_theme.primary_color }}
                />
                <span className="font-bold text-white tracking-wider uppercase">
                  [MODE: {metadataBlock.active_mode}]
                </span>
                <span 
                  className="px-2 py-0.5 rounded-full text-[10px] border uppercase"
                  style={{
                    color: metadataBlock.ui_theme?.primary_color || currentProfile.ui_theme.primary_color,
                    borderColor: `${metadataBlock.ui_theme?.primary_color || currentProfile.ui_theme.primary_color}50`,
                    backgroundColor: `${metadataBlock.ui_theme?.primary_color || currentProfile.ui_theme.primary_color}15`
                  }}
                >
                  {metadataBlock.ui_theme?.theme_name || "Active Theme"}
                </span>
              </div>

              <button
                onClick={() => {
                  setShowRawJsonMap(prev => ({
                    ...prev,
                    [msg.id]: !prev[msg.id]
                  }));
                }}
                className="text-[10px] text-white/50 hover:text-white flex items-center gap-1 transition"
              >
                <span>Metadata JSON</span>
                {showRawJsonMap[msg.id] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            </div>

            {/* Voice Engine Specs */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/70 pt-1 border-t border-white/5">
              <span>Speed: <strong className="text-white">{metadataBlock.voice_engine?.speed}</strong></span>
              <span>•</span>
              <span>Pitch: <strong className="text-white">{metadataBlock.voice_engine?.pitch}</strong></span>
              <span>•</span>
              <span className="truncate max-w-xs text-white/60">Style: {metadataBlock.voice_engine?.style}</span>
            </div>

            {/* Collapsible raw JSON */}
            {showRawJsonMap[msg.id] && rawJsonSnippet && (
              <pre className="p-2 rounded-xl bg-black/80 border border-white/5 text-[10px] text-cyan-300 overflow-x-auto mt-2 font-mono">
                {rawJsonSnippet}
              </pre>
            )}
          </div>
        )}

        {/* Formatted Text & Code blocks */}
        {parts.map((part, index) => {
          if (part.startsWith("```")) {
            const lines = part.slice(3, -3).trim().split("\n");
            const firstLine = lines[0].trim();
            const language = firstLine || "python";
            const code = (firstLine ? lines.slice(1) : lines).join("\n");

            const isInstallCmd = code.includes("pip install") || code.includes("npm install");
            let defaultFileName = language.includes("py") ? "main.py" : language.includes("js") || language.includes("node") ? "index.js" : `script.${language}`;

            return (
              <div 
                key={index}
                className="my-3 rounded-2xl overflow-hidden border border-white/10 bg-[#080914] shadow-2xl"
              >
                {/* Code Block Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-white/10 text-xs font-mono text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="ml-2 font-semibold text-cyan-400 uppercase tracking-wider">{language}</span>
                    {isInstallCmd && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] flex items-center gap-1">
                        <Package size={10} /> Install Command
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onSendToNotepad && (
                      <button
                        onClick={() => onSendToNotepad(code, `Code: ${defaultFileName}`)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px]"
                        title="Send Code to Smart Speech Notepad"
                      >
                        <FileText size={12} />
                        <span>Send to Notepad</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDownload(defaultFileName, code)}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px]"
                      title="Download file directly"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>

                    <button
                      onClick={() => handleCopy(`${msg.id}-${index}`, code)}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px]"
                      title="Copy full code to clipboard"
                    >
                      {copiedId === `${msg.id}-${index}` ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Code Box Content */}
                <div className="p-4 overflow-x-auto text-xs font-mono text-cyan-200/90 leading-relaxed bg-[#05060e] selection:bg-cyan-500/30">
                  <pre className="whitespace-pre">{code}</pre>
                </div>

                {/* File Placement Guidance Footer */}
                {!isInstallCmd && (
                  <div className="px-4 py-2 bg-slate-900/60 border-t border-white/5 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-cyan-400">
                      <FolderOpen size={13} />
                      <span>Save as: <strong className="text-white">{defaultFileName}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Play size={13} />
                      <span>Run: <code className="px-1.5 py-0.5 rounded bg-white/5 text-emerald-300">{language.includes("py") ? `python ${defaultFileName}` : `node ${defaultFileName}`}</code></span>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={index} className="whitespace-pre-wrap select-text">
              {part}
            </div>
          );
        })}
      </div>
    );
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "msg-welcome",
        role: "model",
        content: `Conversation reset to ${currentProfile.name}. What would you like to build or solve, Anant?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  if (!isOpen) return null;

  const modeKeys: PersonalityMode[] = ["DEFAULT", "STRICT", "TECH", "SAVAGE", "DETECTIVE"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl h-[92vh] flex flex-col rounded-3xl border bg-slate-950/95 text-slate-100 shadow-2xl overflow-hidden transition-all duration-300"
        style={{
          borderColor: `${currentProfile.ui_theme.primary_color}40`,
          boxShadow: `0 0 60px ${currentProfile.ui_theme.primary_color}25`
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-colors duration-300"
              style={{
                background: `linear-gradient(135deg, ${currentProfile.ui_theme.primary_color}, ${currentProfile.ui_theme.accent_color})`
              }}
            >
              <Terminal size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-sans tracking-wide text-white">
                  Myra Coding & Research Agent
                </h3>
                <span 
                  className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider"
                  style={{
                    color: currentProfile.ui_theme.primary_color,
                    borderColor: `${currentProfile.ui_theme.primary_color}50`,
                    backgroundColor: `${currentProfile.ui_theme.primary_color}15`
                  }}
                >
                  {currentProfile.name} • {currentProfile.ui_theme.theme_name}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                {currentProfile.attitude}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/5 transition cursor-pointer"
              title="Clear Conversation"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Personality Mode Quick-Switch Strip */}
        <div className="px-6 py-2 border-b border-white/10 bg-slate-900/50 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">Mode Switch:</span>
            {modeKeys.map(key => {
              const prof = PERSONALITY_PROFILES[key];
              const isSelected = currentMode === key;

              return (
                <button
                  key={key}
                  onClick={() => handleSelectMode(key)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium font-sans transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "text-white font-bold shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${prof.ui_theme.primary_color}25`,
                          borderColor: prof.ui_theme.primary_color,
                          borderWidth: "1px",
                          color: "#fff"
                        }
                      : { border: "1px solid transparent" }
                  }
                  title={`${prof.name}: ${prof.tagline}`}
                >
                  {key === "DEFAULT" && <Sparkles size={11} className="text-[#50E3C2]" />}
                  {key === "STRICT" && <Flame size={11} className="text-[#FF9500]" />}
                  {key === "TECH" && <Terminal size={11} className="text-[#00F0FF]" />}
                  {key === "SAVAGE" && <Zap size={11} className="text-[#FF007F]" />}
                  {key === "DETECTIVE" && <Eye size={11} className="text-[#00FF66]" />}
                  <span>{prof.name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-white/50 shrink-0">
            <span>Command: <code className="text-cyan-300 font-bold">{currentProfile.trigger_command}</code></span>
          </div>
        </div>

        {/* Quick Action Preset Chips */}
        <div className="px-6 py-2 border-b border-white/5 bg-slate-900/30 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs font-sans">
          <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0">Prompts:</span>
          
          <button
            onClick={() => handleSendMessage("[MODE: STRICT] Demand a strict high-efficiency study schedule for Anant to balance coaching, school, and AI projects. Give zero room for excuses.")}
            className="px-2.5 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer"
          >
            <Flame size={11} />
            <span>Strict Discipline Checklist</span>
          </button>

          <button
            onClick={() => handleSendMessage("[MODE: TECH] Generate a complete CBSE / JEE Level Physics Test Paper on 'Work, Energy and Power' and 'Rotational Motion' with MCQs, Numericals, and Derivations with Detailed Solutions.")}
            className="px-2.5 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen size={11} />
            <span>Physics Test Paper (JEE/CBSE)</span>
          </button>

          <button
            onClick={() => handleSendMessage("[MODE: SAVAGE] Roast my procrastination habits in a funny and brutally honest way, but also tell me the exact 3 steps to finish my physics revision today.")}
            className="px-2.5 py-1 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-300 whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer"
          >
            <Zap size={11} />
            <span>Savage Motivation Roast</span>
          </button>

          <button
            onClick={() => handleSendMessage("[MODE: DETECTIVE] Investigate this logic problem and uncover hidden edge cases: 'Why does Python float addition 0.1 + 0.2 != 0.3, and how to write a forensic IEEE-754 precision helper?'")}
            className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer"
          >
            <Eye size={11} />
            <span>Detective Code Audit</span>
          </button>

          <button
            onClick={() => handleSendMessage("[MODE: TECH] Write a complete, production-ready Python automation script to download YouTube video transcripts and save into clean markdown with exact pip install dependencies.")}
            className="px-2.5 py-1 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode size={11} />
            <span>Python Script & Dependencies</span>
          </button>
        </div>

        {/* Chat Message List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 font-mono">
                <span>{msg.role === "user" ? "Anant" : `Myra (${currentProfile.name})`}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-3xl p-4 sm:p-5 shadow-lg ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-tr-none"
                    : "bg-slate-900/90 border border-white/10 text-slate-200 rounded-tl-none"
                }`}
                style={
                  msg.role === "model"
                    ? {
                        borderColor: `${currentProfile.ui_theme.primary_color}25`,
                      }
                    : {}
                }
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap select-text leading-relaxed text-sm">
                    {msg.content}
                  </div>
                ) : (
                  renderMessageContent(msg)
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/10 w-fit">
              <div 
                className="w-2.5 h-2.5 rounded-full animate-ping"
                style={{ backgroundColor: currentProfile.ui_theme.primary_color }}
              />
              <span className="text-xs font-mono text-slate-300">
                Myra ({currentProfile.name}) is synthesizing response with {currentProfile.ui_theme.theme_name} engine...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer Bar */}
        <div className="p-4 bg-slate-900/90 border-t border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-3"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder={`Ask ${currentProfile.name} anything, or use [MODE: STRICT], [MODE: TECH], [MODE: SAVAGE]...`}
                className="w-full px-5 py-3.5 rounded-2xl bg-black/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none transition shadow-inner font-sans"
                style={{
                  borderColor: inputPrompt.trim() ? `${currentProfile.ui_theme.primary_color}80` : "rgba(255,255,255,0.1)"
                }}
              />
              {inputPrompt && (
                <button
                  type="button"
                  onClick={() => setInputPrompt("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className={`p-3.5 rounded-2xl flex items-center justify-center transition shadow-lg cursor-pointer ${
                inputPrompt.trim() && !isLoading
                  ? "text-white hover:scale-105 active:scale-95"
                  : "bg-white/5 text-slate-600 cursor-not-allowed"
              }`}
              style={
                inputPrompt.trim() && !isLoading
                  ? {
                      background: `linear-gradient(135deg, ${currentProfile.ui_theme.primary_color}, ${currentProfile.ui_theme.accent_color})`,
                      boxShadow: `0 0 20px ${currentProfile.ui_theme.primary_color}50`
                    }
                  : {}
              }
            >
              <Send size={18} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
