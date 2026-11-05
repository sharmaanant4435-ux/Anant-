import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Mic, 
  MicOff, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Download, 
  Search, 
  X, 
  MessageSquare,
  Globe
} from "lucide-react";

export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SmartSpeechNotepadProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
  onSendToCalculator?: (expression: string) => void;
  externalNotes?: Note[];
  onNoteChange?: (notes: Note[]) => void;
  liveUserCaption?: string;
  themeColor?: string;
}

export function SmartSpeechNotepad({
  isOpen,
  onClose,
  onSendToChat,
  onSendToCalculator,
  externalNotes,
  onNoteChange,
  themeColor = "charcoal"
}: SmartSpeechNotepadProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Speech Recognition state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [speechLanguage, setSpeechLanguage] = useState<"hi-IN" | "en-US">("hi-IN");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);

  // Load notes initially from server
  useEffect(() => {
    fetch("/api/notes")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setNotes(data);
          setActiveNoteId(data[0].id);
        } else {
          const local = localStorage.getItem("myra_saved_notes");
          if (local) {
            try {
              const parsed = JSON.parse(local);
              setNotes(parsed);
              if (parsed.length > 0) setActiveNoteId(parsed[0].id);
            } catch {}
          }
        }
      })
      .catch(err => console.error("Notes load error:", err));
  }, []);

  // Update if external notes provided
  useEffect(() => {
    if (externalNotes && externalNotes.length > 0) {
      setNotes(externalNotes);
      if (!activeNoteId || !externalNotes.some(n => n.id === activeNoteId)) {
        setActiveNoteId(externalNotes[0].id);
      }
    }
  }, [externalNotes]);

  const saveNotesToServerAndLocal = async (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    if (onNoteChange) onNoteChange(updatedNotes);
    try {
      localStorage.setItem("myra_saved_notes", JSON.stringify(updatedNotes));
    } catch {}
  };

  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0];

  // Speech recognition initialization
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Web Speech Recognition API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLanguage;

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      setInterimTranscript(interim);

      if (finalTranscript.trim()) {
        appendSpeechText(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("[Speech Recognition Error]:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      if (isRecording) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [speechLanguage, activeNoteId, isRecording]);

  const appendSpeechText = (text: string) => {
    if (!text.trim()) return;

    setNotes((prevNotes) => {
      if (prevNotes.length === 0) {
        const newN: Note = {
          id: "note_" + Math.random().toString(36).substring(2, 9),
          title: "Voice Note - " + new Date().toLocaleDateString(),
          content: text.trim(),
          tags: ["Voice Note"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setActiveNoteId(newN.id);
        fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newN)
        }).catch(console.error);
        return [newN];
      }

      const updated = prevNotes.map((note) => {
        if (note.id === activeNoteId || (!activeNoteId && note.id === prevNotes[0].id)) {
          const sep = note.content.trim().length > 0 ? "\n\n" : "";
          const newContent = note.content + sep + text.trim();
          
          fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: note.id, content: newContent })
          }).catch(console.error);

          return {
            ...note,
            content: newContent,
            updatedAt: new Date().toISOString()
          };
        }
        return note;
      });

      return updated;
    });
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or a compatible browser.");
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
      setInterimTranscript("");
    } else {
      try {
        recognitionRef.current.lang = speechLanguage;
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  };

  const handleCreateNote = async () => {
    const newNote: Note = {
      id: "note_" + Math.random().toString(36).substring(2, 9),
      title: "New Note " + (notes.length + 1),
      content: "",
      tags: ["General"],
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const next = [newNote, ...notes];
    saveNotesToServerAndLocal(next);
    setActiveNoteId(newNote.id);

    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNote)
      });
    } catch (err) {
      console.error("Save note error:", err);
    }
  };

  const handleUpdateActiveNote = (updates: Partial<Note>) => {
    if (!activeNote) return;
    const next = notes.map((n) => {
      if (n.id === activeNote.id) {
        const updated = { ...n, ...updates, updatedAt: new Date().toISOString() };
        fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated)
        }).catch(console.error);
        return updated;
      }
      return n;
    });
    saveNotesToServerAndLocal(next);
  };

  const handleDeleteNote = async (id: string) => {
    const next = notes.filter(n => n.id !== id);
    saveNotesToServerAndLocal(next);
    if (activeNoteId === id && next.length > 0) {
      setActiveNoteId(next[0].id);
    }
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Delete note error:", err);
    }
  };

  const handleDownloadNote = () => {
    if (!activeNote) return;
    const content = `# ${activeNote.title}\n\n${activeNote.content}\n\n---\nCreated: ${new Date(activeNote.createdAt).toLocaleString()}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeNote.title.replace(/[^a-zA-Z0-9_]/g, "_") || "note"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyNote = () => {
    if (!activeNote) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col rounded-3xl border border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-[0_0_60px_rgba(6,182,212,0.18)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-sans tracking-wide text-white">
                  Myra Speech Notepad
                </h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Voice-to-Text
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Transcribes voice dictation directly into persistent notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Dictation Mic Button */}
            <button
              onClick={toggleRecording}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-sans text-xs font-semibold cursor-pointer transition shadow-md ${
                isRecording
                  ? "bg-rose-500 text-white animate-pulse shadow-rose-500/30"
                  : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
              }`}
              title={isRecording ? "Stop Dictation" : "Start Voice Dictation"}
            >
              {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
              <span>{isRecording ? "Listening..." : "Dictate"}</span>
            </button>

            {/* Language toggle: Hindi vs English */}
            <button
              onClick={() => setSpeechLanguage(prev => prev === "hi-IN" ? "en-US" : "hi-IN")}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
              title="Toggle Speech Language"
            >
              <Globe size={13} className="text-cyan-400" />
              <span>{speechLanguage === "hi-IN" ? "Hindi" : "English"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live speech transcription ticker */}
        {isRecording && (
          <div className="px-6 py-2.5 bg-cyan-950/40 border-b border-cyan-500/20 flex items-center justify-between gap-4 text-xs font-mono animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-cyan-300 overflow-hidden">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <span className="font-semibold shrink-0">Live Transcribing:</span>
              <span className="italic truncate text-slate-200">
                {interimTranscript || "Speak now, Myra is listening..."}
              </span>
            </div>
            <span className="text-[10px] text-cyan-400 shrink-0 font-sans">
              Lang: {speechLanguage === "hi-IN" ? "Hindi (hi-IN)" : "English (en-US)"}
            </span>
          </div>
        )}

        {/* Workspace: Left Notes List & Right Editor */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Notes Sidebar */}
          <div className="w-64 sm:w-72 border-r border-white/10 bg-slate-900/40 flex flex-col">
            
            {/* Search & New Note */}
            <div className="p-3 border-b border-white/10 flex items-center gap-2">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/40"
                />
              </div>
              <button
                onClick={handleCreateNote}
                className="p-2 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition cursor-pointer shadow-md shadow-cyan-500/20"
                title="Create New Note"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Note Cards List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredNotes.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No notes found
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    className={`p-3 rounded-2xl cursor-pointer transition text-left group border ${
                      note.id === activeNoteId
                        ? "bg-cyan-950/40 border-cyan-500/40 shadow-md shadow-cyan-500/10"
                        : "bg-white/5 hover:bg-white/10 border-white/5"
                    }`}
                  >
                    <span className="font-semibold text-xs text-white truncate block mb-1">
                      {note.title || "Untitled Note"}
                    </span>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {note.content || "Empty note... speak or type"}
                    </p>
                    <div className="text-[10px] text-slate-500 mt-2 font-mono">
                      {new Date(note.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

          {/* Note Editor */}
          {activeNote ? (
            <div className="flex-1 flex flex-col bg-slate-950">
              
              {/* Note Header / Action buttons */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 bg-slate-900/30">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
                  placeholder="Note Title..."
                  className="text-base sm:text-lg font-bold font-sans text-white bg-transparent outline-none flex-1 truncate"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyNote}
                    className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Copy Note Text"
                  >
                    {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>

                  <button
                    onClick={handleDownloadNote}
                    className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Download Note (.md)"
                  >
                    <Download size={15} />
                  </button>

                  {onSendToChat && (
                    <button
                      onClick={() => onSendToChat(activeNote.content)}
                      className="px-2.5 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-sans flex items-center gap-1 transition cursor-pointer"
                      title="Send Note to Coding Chat"
                    >
                      <MessageSquare size={13} />
                      <span className="hidden sm:inline">To Chat</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteNote(activeNote.id)}
                    className="p-2 rounded-xl hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                    title="Delete Note"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Note Textarea */}
              <div className="flex-1 p-5 relative overflow-y-auto">
                <textarea
                  value={activeNote.content}
                  onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
                  placeholder="Type your notes here or click 'Dictate' above to speak. Myra will transcribe your words directly into this note..."
                  className="w-full h-full bg-transparent text-slate-100 placeholder-slate-600 font-sans text-sm sm:text-base leading-relaxed outline-none resize-none"
                />
              </div>

              {/* Footer status */}
              <div className="px-5 py-2.5 border-t border-white/10 bg-slate-900/40 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-4">
                  <span>Words: {activeNote.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0}</span>
                  <span>Characters: {activeNote.content.length}</span>
                </div>
                <span>Updated: {new Date(activeNote.updatedAt).toLocaleTimeString()}</span>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <FileText size={48} className="opacity-20 mb-3" />
              <h4 className="text-base font-bold text-slate-300">No Note Selected</h4>
              <p className="text-xs text-slate-400 mt-1">Select a note from the left or create a new one</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
