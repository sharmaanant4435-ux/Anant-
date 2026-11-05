import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  X, 
  Youtube, 
  BookOpen, 
  Globe, 
  ExternalLink, 
  Sparkles, 
  FileText, 
  Play, 
  ChevronLeft, 
  RotateCw,
  Compass,
  Check,
  Copy,
  ArrowRight,
  Maximize2
} from "lucide-react";

export type SearchPlatform = "google" | "wikipedia" | "youtube" | "duckduckgo";

interface UniversalSearchHubProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToNotepad?: (content: string, title?: string) => void;
  onOpenYouTubeHub?: (query?: string, videoId?: string) => void;
  initialQuery?: string;
  initialPlatform?: SearchPlatform;
  themeColor?: string;
}

export function UniversalSearchHub({
  isOpen,
  onClose,
  onSendToNotepad,
  onOpenYouTubeHub,
  initialQuery = "",
  initialPlatform = "google"
}: UniversalSearchHubProps) {
  const [platform, setPlatform] = useState<SearchPlatform>(initialPlatform);
  const [query, setQuery] = useState<string>(initialQuery);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Google Search Data
  const [googleData, setGoogleData] = useState<{
    summary?: string;
    sources?: Array<{ uri: string; title: string }>;
    searchQueries?: string[];
  } | null>(null);

  // YouTube Search Data
  const [youtubeData, setYoutubeData] = useState<{
    embedSearchUrl?: string;
    videos?: Array<{ id: string; title: string; channel?: string; description?: string }>;
  } | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Wikipedia Search Data
  const [wikiResults, setWikiResults] = useState<Array<{
    id: number;
    title: string;
    snippet: string;
    thumbnail: string | null;
    url: string;
  }>>([]);
  const [wikiLang, setWikiLang] = useState<"en" | "hi">("en");
  const [wikiActiveArticle, setWikiActiveArticle] = useState<{
    title: string;
    html: string;
  } | null>(null);
  const [wikiLoadingArticle, setWikiLoadingArticle] = useState<boolean>(false);

  // DuckDuckGo Data
  const [ddgData, setDdgData] = useState<{
    heading?: string;
    abstract?: string;
    abstractUrl?: string;
    image?: string | null;
    results?: Array<{ title: string; snippet: string; url: string; icon: string | null }>;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sample quick suggestion topics
  const quickSuggestions = [
    { label: "Quantum Computing", query: "Quantum Computing and Artificial Intelligence" },
    { label: "Chandrayaan", query: "Chandrayaan Mission ISRO" },
    { label: "Solar System", query: "Solar System planets facts" },
    { label: "History of India", query: "History of India summary" },
    { label: "Black Holes", query: "Black Holes in Astrophysics" },
    { label: "Python Basics", query: "Python programming language overview" }
  ];

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      executeSearch(initialQuery, initialPlatform);
    }
  }, [initialQuery, initialPlatform]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const executeSearch = async (searchQuery: string, targetPlatform: SearchPlatform = platform) => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsLoading(true);
    setError(null);
    setWikiActiveArticle(null);

    try {
      const resp = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          platform: targetPlatform,
          lang: wikiLang
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || "सर्च परिणाम लोड करने में समस्या आई।");
      }

      const data = await resp.json();

      if (targetPlatform === "google") {
        setGoogleData({
          summary: data.summary,
          sources: data.sources || [],
          searchQueries: data.searchQueries || []
        });
      } else if (targetPlatform === "youtube") {
        setYoutubeData({
          embedSearchUrl: data.embedSearchUrl,
          videos: data.videos || []
        });
        if (data.videos && data.videos.length > 0) {
          setActiveVideoId(data.videos[0].id);
        } else {
          setActiveVideoId(null);
        }
      } else if (targetPlatform === "wikipedia") {
        setWikiResults(data.results || []);
      } else if (targetPlatform === "duckduckgo") {
        setDdgData({
          heading: data.heading,
          abstract: data.abstract,
          abstractUrl: data.abstractUrl,
          image: data.image,
          results: data.results || []
        });
      }
    } catch (e: any) {
      console.error("Search execution failed:", e);
      setError(e.message || "खोज परिणाम प्राप्त करने में असमर्थ। कृपया पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (newPlatform: SearchPlatform) => {
    setPlatform(newPlatform);
    if (query.trim()) {
      executeSearch(query, newPlatform);
    }
  };

  const loadFullWikiArticle = async (title: string) => {
    setWikiLoadingArticle(true);
    try {
      const resp = await fetch(`/api/search/wikipedia/page?title=${encodeURIComponent(title)}&lang=${wikiLang}`);
      const data = await resp.json();
      if (data.html) {
        setWikiActiveArticle({
          title: data.title,
          html: data.html
        });
      }
    } catch (e) {
      console.error("Wiki article load error:", e);
    } finally {
      setWikiLoadingArticle(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleOpenExternal = (url: string) => {
    if (!url) return;
    let target = url;
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = "https://" + target;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[88vh] flex flex-col rounded-3xl border border-white/10 bg-[#0c0d14]/95 text-slate-100 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden">
        
        {/* Top Header & Search Bar Strip */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-900/70 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                <Search size={16} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold font-sans tracking-wide text-white flex items-center gap-2">
                  <span>Smart Search Bar</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                    Google & Wikipedia Live
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              title="Close Search Hub"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Input Bar with Instant Google & Wiki Controls */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeSearch(query);
            }}
            className="flex items-center gap-2 relative"
          >
            <div className="relative flex-1 flex items-center">
              <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${platform === "google" ? "Google Live" : platform === "wikipedia" ? "Wikipedia Encyclopedia" : platform === "youtube" ? "YouTube" : "DuckDuckGo"}...`}
                className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-sm outline-none focus:border-cyan-500/50 transition font-sans"
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
              className="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-md shadow-cyan-600/20 shrink-0"
            >
              {isLoading ? (
                <RotateCw size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              <span>Search</span>
            </button>
          </form>

          {/* Quick Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 text-[11px]">
            <span className="text-slate-400 font-mono text-[10px] uppercase shrink-0">सुझाव:</span>
            {quickSuggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(s.query);
                  executeSearch(s.query, platform);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition shrink-0 cursor-pointer border border-white/5"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Platform Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pt-1">
            {/* Google Tab */}
            <button
              onClick={() => handleTabChange("google")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition cursor-pointer shrink-0 ${
                platform === "google"
                  ? "bg-blue-600/25 border border-blue-500/50 text-blue-300 shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <Globe size={13} className="text-blue-400" />
              <span>Google</span>
            </button>

            {/* Wikipedia Tab */}
            <button
              onClick={() => handleTabChange("wikipedia")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition cursor-pointer shrink-0 ${
                platform === "wikipedia"
                  ? "bg-emerald-600/25 border border-emerald-500/50 text-emerald-300 shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <BookOpen size={13} className="text-emerald-400" />
              <span>Wikipedia</span>
            </button>

            {/* YouTube Tab */}
            <button
              onClick={() => handleTabChange("youtube")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition cursor-pointer shrink-0 ${
                platform === "youtube"
                  ? "bg-red-600/25 border border-red-500/50 text-red-300 shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <Youtube size={14} className="text-red-400" />
              <span>YouTube</span>
            </button>

            {/* DuckDuckGo Tab */}
            <button
              onClick={() => handleTabChange("duckduckgo")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition cursor-pointer shrink-0 ${
                platform === "duckduckgo"
                  ? "bg-orange-600/25 border border-orange-500/50 text-orange-300 shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <Compass size={13} className="text-orange-400" />
              <span>DuckDuckGo</span>
            </button>

            {/* If in Wikipedia, Language selector */}
            {platform === "wikipedia" && (
              <div className="ml-auto flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/10 text-[11px] font-sans">
                <button
                  onClick={() => {
                    setWikiLang("en");
                    if (query.trim()) executeSearch(query, "wikipedia");
                  }}
                  className={`px-2 py-0.5 rounded transition ${wikiLang === "en" ? "bg-cyan-600 text-white font-bold" : "text-slate-400"}`}
                >
                  English
                </button>
                <button
                  onClick={() => {
                    setWikiLang("hi");
                    if (query.trim()) executeSearch(query, "wikipedia");
                  }}
                  className={`px-2 py-0.5 rounded transition ${wikiLang === "hi" ? "bg-cyan-600 text-white font-bold" : "text-slate-400"}`}
                >
                  हिन्दी
                </button>
              </div>
            )}

            {/* Direct Open in Browser Tab button */}
            {query.trim() && (
              <button
                onClick={() => {
                  const targetUrl = platform === "google" 
                    ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
                    : platform === "wikipedia" 
                    ? `https://${wikiLang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`
                    : platform === "youtube"
                    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
                    : `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
                  handleOpenExternal(targetUrl);
                }}
                className="ml-auto hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-xs font-mono transition cursor-pointer"
                title="Open directly in browser tab"
              >
                <span>ब्राउज़र में खोलें</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Content Body Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-sans flex items-center justify-between">
              <span>{error}</span>
              {query && (
                <button
                  onClick={() => handleOpenExternal(`https://www.google.com/search?q=${encodeURIComponent(query)}`)}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Google पर खोलें</span>
                  <ExternalLink size={11} />
                </button>
              )}
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <RotateCw size={24} className="animate-spin text-cyan-400" />
              <p className="text-xs font-sans">{platform.toUpperCase()} से परिणाम खोजे जा रहे हैं...</p>
            </div>
          )}

          {/* 1. GOOGLE SEARCH RESULTS */}
          {!isLoading && platform === "google" && googleData && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Summary Card */}
              {googleData.summary && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 text-slate-200 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 font-sans uppercase tracking-wider">
                      <Sparkles size={14} className="text-cyan-400" />
                      <span>Google Live Search Overview</span>
                    </div>
                    {onSendToNotepad && (
                      <button
                        onClick={() => onSendToNotepad(googleData.summary || "", `Search: ${query}`)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 text-xs font-sans flex items-center gap-1 transition cursor-pointer"
                        title="Save to Notepad"
                      >
                        <FileText size={12} />
                        <span>Save to Notepad</span>
                      </button>
                    )}
                  </div>
                  <div className="text-sm font-sans leading-relaxed whitespace-pre-wrap select-text">
                    {googleData.summary}
                  </div>
                </div>
              )}

              {/* Web Sources & Links */}
              {googleData.sources && googleData.sources.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 mb-2.5">
                    सत्यापित वेब स्रोत व पेजेस (Web Sources)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {googleData.sources.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 transition flex flex-col justify-between gap-2"
                      >
                        <div className="overflow-hidden">
                          <h5 className="text-xs font-semibold text-slate-100 truncate font-sans">
                            {s.title || s.uri}
                          </h5>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                            {s.uri}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
                          <button
                            onClick={() => handleCopy(s.uri)}
                            className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px] cursor-pointer"
                          >
                            {copiedLink === s.uri ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>{copiedLink === s.uri ? "Copied" : "Copy Link"}</span>
                          </button>
                          <button
                            onClick={() => handleOpenExternal(s.uri)}
                            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <span>Open Page</span>
                            <ExternalLink size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Search query fallback */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-300">
                <span>Google पर पूर्ण सर्च परिणाम देखें:</span>
                <button
                  onClick={() => handleOpenExternal(`https://www.google.com/search?q=${encodeURIComponent(query)}`)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <span>Google.com पर खोलें</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}

          {/* 2. WIKIPEDIA SEARCH & ARTICLE VIEWER (NO IFRAME ERRORS) */}
          {!isLoading && platform === "wikipedia" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Full Article Reader Mode */}
              {wikiActiveArticle ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <button
                      onClick={() => setWikiActiveArticle(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-sans cursor-pointer transition"
                    >
                      <ChevronLeft size={14} />
                      <span>परिणामों पर वापस जाएं (Back)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenExternal(`https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(wikiActiveArticle.title)}`)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-sans flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Wikipedia.org</span>
                        <ExternalLink size={12} />
                      </button>
                      {onSendToNotepad && (
                        <button
                          onClick={() => onSendToNotepad(`Wikipedia: ${wikiActiveArticle.title}`, wikiActiveArticle.title)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-sans flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText size={13} />
                          <span>Save to Notepad</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-900/90 border border-white/10 text-slate-200 select-text font-sans">
                    <h2 className="text-2xl font-bold mb-4 text-white">
                      {wikiActiveArticle.title}
                    </h2>
                    <div 
                      className="prose prose-invert max-w-none text-sm leading-relaxed wiki-content space-y-3"
                      dangerouslySetInnerHTML={{ __html: wikiActiveArticle.html }}
                    />
                  </div>
                </div>
              ) : (
                /* Wikipedia Search Results List */
                <div className="space-y-3">
                  {wikiLoadingArticle && (
                    <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 flex items-center gap-2">
                      <RotateCw size={13} className="animate-spin" />
                      <span>विकिपीडिया लेख लोड हो रहा है...</span>
                    </div>
                  )}

                  {wikiResults.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-sans">
                      विकिपीडिया से जानकारी प्राप्त करने के लिए ऊपर खोजें।
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {wikiResults.map((art) => (
                        <div
                          key={art.id}
                          className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 transition flex items-start gap-4"
                        >
                          {art.thumbnail && (
                            <img
                              src={art.thumbnail}
                              alt={art.title}
                              className="w-20 h-20 rounded-xl object-cover shrink-0 bg-slate-950 border border-white/10"
                            />
                          )}

                          <div className="flex-1 overflow-hidden">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-sm font-bold text-white font-sans">
                                {art.title}
                              </h5>
                              <button
                                onClick={() => loadFullWikiArticle(art.title)}
                                className="px-3 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-xs font-sans cursor-pointer transition shrink-0"
                              >
                                पढ़ें (Read Article)
                              </button>
                            </div>
                            <p 
                              className="text-xs text-slate-300 mt-1 font-sans line-clamp-3 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: art.snippet }}
                            />
                            <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-400">
                              <button
                                onClick={() => handleOpenExternal(art.url)}
                                className="hover:text-white flex items-center gap-1 cursor-pointer"
                              >
                                <span>Wikipedia.org पर खोलें</span>
                                <ExternalLink size={10} />
                              </button>
                              {onSendToNotepad && (
                                <button
                                  onClick={() => onSendToNotepad(`${art.title}\n\n${art.snippet.replace(/<[^>]+>/g, "")}`, art.title)}
                                  className="hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText size={10} />
                                  <span>Save Note</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. YOUTUBE RESULTS & EMBEDDED PLAYER */}
          {!isLoading && platform === "youtube" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Dedicated YouTube Window Switcher Banner */}
              {onOpenYouTubeHub && (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-red-950/60 to-slate-900 border border-red-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Youtube size={16} className="text-red-400 shrink-0" />
                    <span className="text-xs text-white font-medium">
                      पूरा YouTube अनुभव चाहते हैं? नई समर्पित प्लेयर विंडो में खोलें।
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenYouTubeHub(query, activeVideoId || undefined);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-red-600/30"
                  >
                    <span>YouTube हब विंडो खोलें</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              )}

              {activeVideoId ? (
                <div className="rounded-2xl overflow-hidden border border-red-500/30 bg-black shadow-2xl">
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1&rel=0`}
                      title="YouTube video player"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-3 bg-slate-900/90 flex items-center justify-between text-xs">
                    <span className="font-sans text-slate-200 truncate">
                      Video: <strong>{activeVideoId}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      {onOpenYouTubeHub && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenYouTubeHub(query, activeVideoId);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-600/25 hover:bg-red-600/40 text-red-200 text-xs cursor-pointer flex items-center gap-1"
                        >
                          <Maximize2 size={11} />
                          <span>विंडो में चलाएं</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenExternal(`https://www.youtube.com/watch?v=${activeVideoId}`)}
                        className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <span>YouTube पर खोलें</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  कोई वीडियो चुनने के लिए नीचे सूची पर क्लिक करें या सर्च करें।
                </div>
              )}

              {/* Video Cards Grid */}
              {youtubeData?.videos && youtubeData.videos.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 mb-2">
                    YouTube वीडियो सिफारिशें
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {youtubeData.videos.map((vid, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveVideoId(vid.id)}
                        className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                          activeVideoId === vid.id
                            ? "bg-red-950/30 border-red-500/50"
                            : "bg-slate-900/60 border-white/5 hover:border-red-500/30"
                        }`}
                      >
                        <div className="w-24 aspect-video rounded-xl bg-slate-950 overflow-hidden relative shrink-0 flex items-center justify-center">
                          <img
                            src={`https://img.youtube.com/vi/${vid.id}/mqdefault.jpg`}
                            alt={vid.title}
                            className="w-full h-full object-cover"
                            onError={(e: any) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center hover:bg-black/10 transition">
                            <Play size={18} className="text-white drop-shadow" />
                          </div>
                        </div>

                        <div className="overflow-hidden flex-1">
                          <h5 className="text-xs font-semibold text-slate-100 line-clamp-2 font-sans">
                            {vid.title}
                          </h5>
                          <p className="text-[10px] text-red-400 font-mono mt-1">
                            {vid.channel || "YouTube"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. DUCKDUCKGO INSTANT ANSWERS */}
          {!isLoading && platform === "duckduckgo" && ddgData && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {ddgData.abstract && (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 text-slate-200 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-orange-400 font-sans uppercase tracking-wider">
                      {ddgData.heading}
                    </h4>
                    {ddgData.abstractUrl && (
                      <button
                        onClick={() => handleOpenExternal(ddgData.abstractUrl || "")}
                        className="text-xs text-orange-300 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>स्रोत खोलें</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-sans leading-relaxed select-text">
                    {ddgData.abstract}
                  </p>
                </div>
              )}

              {ddgData.results && ddgData.results.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 mb-2">
                    संबंधित विषय
                  </h4>
                  {ddgData.results.map((res, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-900/60 border border-white/5 hover:border-orange-500/30 transition flex items-center justify-between gap-3"
                    >
                      <div className="overflow-hidden flex-1">
                        <h5 className="text-xs font-semibold text-slate-100 truncate">
                          {res.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {res.snippet}
                        </p>
                      </div>
                      {res.url && (
                        <button
                          onClick={() => handleOpenExternal(res.url)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-orange-300 text-xs shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                          <span>खोलें</span>
                          <ExternalLink size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
