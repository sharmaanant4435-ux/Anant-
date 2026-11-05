import React, { useState, useEffect, useRef } from "react";
import { 
  Youtube, 
  Search, 
  X, 
  Play, 
  ExternalLink, 
  RotateCw, 
  FileText, 
  Clock, 
  Maximize2, 
  Compass, 
  Sparkles,
  Flame,
  Music,
  Radio,
  Tv,
  Check,
  Copy
} from "lucide-react";

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channel: string;
  description?: string;
  duration?: string;
  views?: string;
}

interface YouTubeHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToNotepad?: (content: string, title?: string) => void;
  initialQuery?: string;
  initialVideoId?: string;
  themeColor?: string;
}

export function YouTubeHubModal({
  isOpen,
  onClose,
  onSendToNotepad,
  initialQuery = "Trending Music Hindi",
  initialVideoId,
}: YouTubeHubModalProps) {
  const [query, setQuery] = useState<string>(initialQuery);
  const [activeVideo, setActiveVideo] = useState<YouTubeVideoItem>({
    id: initialVideoId || "jfKfPfyJRdk",
    title: "Lofi Hip Hop Radio - Beats to Relax/Study to",
    channel: "Lofi Girl",
    description: "Relaxing live music player"
  });
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [recentHistory, setRecentHistory] = useState<YouTubeVideoItem[]>(() => {
    try {
      const saved = localStorage.getItem("myra_youtube_recent_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Curated quick category chips
  const categories = [
    { label: "Trending", icon: Flame, query: "Trending Videos India" },
    { label: "Hindi Songs", icon: Music, query: "Top Bollywood Hindi Songs 2024" },
    { label: "Lofi Study", icon: Radio, query: "Lofi study chill beats" },
    { label: "Tech & AI", icon: Sparkles, query: "Artificial Intelligence Tech Future" },
    { label: "Space & Science", icon: Compass, query: "ISRO Space Exploration Universe" },
    { label: "Live News", icon: Tv, query: "Live News India" }
  ];

  // Auto focus input and trigger initial search if opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      if (initialVideoId && initialVideoId !== activeVideo.id) {
        setActiveVideo({
          id: initialVideoId,
          title: "Selected Video",
          channel: "YouTube"
        });
      }
      if (videos.length === 0) {
        searchYouTube(query || "Trending Music");
      }
    }
  }, [isOpen]);

  const searchYouTube = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    // Direct YouTube Link Detection
    const directMatch = q.match(/(?:v=|youtu\.be\/|\/embed\/|\/watch\?v=|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (directMatch) {
      const vId = directMatch[1];
      const directItem: YouTubeVideoItem = {
        id: vId,
        title: `Playing Video: ${vId}`,
        channel: "Direct Link",
        description: `Direct video from: ${q}`
      };
      playVideo(directItem);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          platform: "youtube"
        })
      });

      if (!resp.ok) {
        throw new Error("यूट्यूब वीडियो लोड करने में समस्या आई।");
      }

      const data = await resp.json();
      if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
        setVideos(data.videos);
        // If current active video is placeholder, play first returned video
        if (!activeVideo.id || activeVideo.id === "jfKfPfyJRdk") {
          playVideo(data.videos[0]);
        }
      } else {
        setVideos([]);
      }
    } catch (e: any) {
      console.error("YouTube search execution error:", e);
      setError(e.message || "यूट्यूब वीडियो सर्च करने में असमर्थ।");
    } finally {
      setIsLoading(false);
    }
  };

  const playVideo = (video: YouTubeVideoItem) => {
    setActiveVideo(video);
    
    // Save to history
    setRecentHistory((prev) => {
      const filtered = prev.filter(v => v.id !== video.id);
      const updated = [video, ...filtered].slice(0, 10);
      try {
        localStorage.setItem("myra_youtube_recent_history", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleCopyLink = () => {
    const link = `https://www.youtube.com/watch?v=${activeVideo.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] flex flex-col rounded-3xl border border-red-500/25 bg-[#0b0b10]/98 text-slate-100 shadow-[0_25px_80px_rgba(239,68,68,0.15)] overflow-hidden">
        
        {/* Top Header & Search Strip */}
        <div className="p-3.5 sm:p-4 border-b border-white/10 bg-slate-900/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
                <Youtube size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold font-sans tracking-wide text-white flex items-center gap-2">
                  <span>YouTube Video Hub</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                    Full In-App Player
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              title="Close YouTube Hub"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Bar Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchYouTube(query);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1 flex items-center">
              <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="यूट्यूब पर कोई भी वीडियो सर्च करें या लिंक पेस्ट करें (उदा. Arijit Singh, Space, Coding)..."
                className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-sm outline-none focus:border-red-500/50 transition font-sans"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 p-1 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-md shadow-red-600/20 shrink-0"
            >
              {isLoading ? (
                <RotateCw size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              <span>Search</span>
            </button>
          </form>

          {/* Quick Categories Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 text-xs">
            {categories.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(cat.query);
                    searchYouTube(cat.query);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-red-300 transition shrink-0 cursor-pointer border border-white/5 text-[11px]"
                >
                  <Icon size={12} className="text-red-400" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area: Left Main Video Player, Right Video List */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 p-3.5 sm:p-5">
          
          {/* Main Embedded Player (7 columns on large screen) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* 16:9 Video Player Container with Full YouTube Embed */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-red-500/30 bg-black shadow-2xl">
              <iframe
                key={activeVideo.id}
                src={`https://www.youtube.com/embed/${activeVideo.id}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`}
                title={activeVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            {/* Video Details & Action Toolbar */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-sm sm:text-base font-bold text-white font-sans leading-snug">
                    {activeVideo.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
                    <span className="text-red-400 font-semibold">{activeVideo.channel}</span>
                    {activeVideo.views && <span>• {activeVideo.views}</span>}
                  </div>
                </div>

                {/* External link */}
                <a
                  href={`https://www.youtube.com/watch?v=${activeVideo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs font-sans flex items-center gap-1.5 transition shrink-0"
                  title="Open video on YouTube"
                >
                  <span>YouTube पर खोलें</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs text-slate-400">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition cursor-pointer text-[11px]"
                >
                  {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                </button>

                {onSendToNotepad && (
                  <button
                    onClick={() => onSendToNotepad(`YouTube Video: ${activeVideo.title}\nURL: https://www.youtube.com/watch?v=${activeVideo.id}\nChannel: ${activeVideo.channel}`, activeVideo.title)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-red-300 transition cursor-pointer text-[11px]"
                  >
                    <FileText size={12} />
                    <span>Save to Notepad</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick URL / ID direct player input bar */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                💡 यूट्यूब की कोई भी लिंक सीधे ऊपर सर्च बार में पेस्ट करके चला सकते हैं।
              </span>
            </div>
          </div>

          {/* Right Column: Search Results & Up Next (5 columns on large screen) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h5 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Play size={12} className="text-red-400" />
                <span>वीडियो सूची (Video Queue)</span>
              </h5>
              <span className="text-[10px] font-mono text-slate-500">
                {videos.length} परिणाम
              </span>
            </div>

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                <RotateCw size={20} className="animate-spin text-red-500" />
                <span className="text-xs">यूट्यूब वीडियो लोड हो रहे हैं...</span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Videos Scroll List */}
            <div className="space-y-2 overflow-y-auto max-h-[550px] pr-1 custom-scrollbar">
              {videos.map((vid) => {
                const isSelected = activeVideo.id === vid.id;
                return (
                  <div
                    key={vid.id}
                    onClick={() => playVideo(vid)}
                    className={`group flex items-start gap-2.5 p-2 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-red-950/40 border-red-500/50 shadow-md"
                        : "bg-slate-900/40 border-white/5 hover:border-red-500/30 hover:bg-slate-900/80"
                    }`}
                  >
                    {/* Thumbnail with duration overlay */}
                    <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-slate-950 shrink-0">
                      <img
                        src={`https://i.ytimg.com/vi/${vid.id}/mqdefault.jpg`}
                        alt={vid.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e: any) => {
                          e.target.src = `https://img.youtube.com/vi/${vid.id}/0.jpg`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <div className="w-6 h-6 rounded-full bg-red-600/90 flex items-center justify-center text-white shadow">
                          <Play size={12} />
                        </div>
                      </div>
                      {vid.duration && (
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono text-white">
                          {vid.duration}
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 overflow-hidden">
                      <h6 className="text-xs font-semibold text-slate-100 line-clamp-2 leading-snug group-hover:text-red-300 transition">
                        {vid.title}
                      </h6>
                      <p className="text-[10px] text-slate-400 truncate mt-1">
                        {vid.channel}
                      </p>
                      {vid.views && (
                        <p className="text-[9px] text-slate-500 font-mono">
                          {vid.views}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recently Watched Mini Drawer */}
            {recentHistory.length > 0 && (
              <div className="pt-2 border-t border-white/10 mt-auto">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  <Clock size={11} className="text-slate-400" />
                  <span>हाल ही में देखे गए (Recently Watched)</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {recentHistory.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => playVideo(item)}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 hover:text-white truncate max-w-[130px] shrink-0 border border-white/5 cursor-pointer"
                      title={item.title}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
