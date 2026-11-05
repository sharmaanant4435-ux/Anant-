import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { 
  loadMemories, 
  saveMemories, 
  formatSystemInstructionsWithMemories, 
  processConversationSlice 
} from "./server_memory";
import { loadNotes, saveNotes, NoteItem } from "./server_notes";
import { Memory } from "./src/lib/memoryTypes";
import { MYRA_MULTI_PERSONALITY_PROMPT, PERSONALITY_PROFILES, PersonalityMode } from "./src/types/personality";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Memory REST API Endpoints
  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await loadMemories();
      res.json(memories);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/memories", async (req, res) => {
    try {
      const { category, text } = req.body;
      if (!category || !text) {
        return res.status(400).json({ error: "Category and text parameters are required." });
      }
      const memories = await loadMemories();
      const timestamp = new Date().toISOString();
      const newMemory: Memory = {
        id: Math.random().toString(36).substring(2, 11),
        category,
        text,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      memories.push(newMemory);
      await saveMemories(memories);
      res.status(201).json(newMemory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/memories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let memories = await loadMemories();
      memories = memories.filter(m => m.id !== id);
      await saveMemories(memories);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Smart Speech Notepad REST API Endpoints
  app.get("/api/notes", async (req, res) => {
    try {
      const notes = await loadNotes();
      res.json(notes);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const { id, title, content, tags, pinned } = req.body;
      const notes = await loadNotes();
      const timestamp = new Date().toISOString();

      if (id) {
        // Update existing note
        const index = notes.findIndex(n => n.id === id);
        if (index !== -1) {
          notes[index] = {
            ...notes[index],
            title: title ?? notes[index].title,
            content: content ?? notes[index].content,
            tags: tags ?? notes[index].tags,
            pinned: pinned ?? notes[index].pinned,
            updatedAt: timestamp
          };
          await saveNotes(notes);
          return res.json(notes[index]);
        }
      }

      // Create new note
      const newNote: NoteItem = {
        id: id || ("note_" + Math.random().toString(36).substring(2, 11)),
        title: title || "शीर्षक रहित नोट",
        content: content || "",
        tags: tags || ["General"],
        pinned: !!pinned,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      notes.unshift(newNote);
      await saveNotes(notes);
      res.status(201).json(newNote);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let notes = await loadNotes();
      notes = notes.filter(n => n.id !== id);
      await saveNotes(notes);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Dedicated Coding & Text Chatbox Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured in workspace secrets." });
      }

      const { messages, userPrompt, mode } = req.body;
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });

      // Build conversation contents
      let contents: any[] = [];
      if (Array.isArray(messages) && messages.length > 0) {
        contents = messages.map((m: any) => ({
          role: m.role === "assistant" || m.role === "model" ? "model" : "user",
          parts: [{ text: m.content || m.text || "" }]
        }));
      } else if (userPrompt) {
        contents = [{ role: "user", parts: [{ text: userPrompt }] }];
      }

      if (contents.length === 0) {
        return res.status(400).json({ error: "No messages or prompt provided." });
      }

      // Check for inline [MODE: ...] trigger in user's prompt
      let detectedMode: PersonalityMode | null = null;
      const lastUserContent = contents.filter(c => c.role === "user").slice(-1)[0]?.parts?.[0]?.text || "";
      const modeTagMatch = lastUserContent.match(/\[MODE:\s*(DEFAULT|STRICT|TECH|SAVAGE|DETECTIVE)\]/i);
      if (modeTagMatch) {
        detectedMode = modeTagMatch[1].toUpperCase() as PersonalityMode;
      }

      const activeMode: PersonalityMode = detectedMode || (mode && PERSONALITY_PROFILES[mode as PersonalityMode] ? (mode as PersonalityMode) : "DEFAULT");
      const profile = PERSONALITY_PROFILES[activeMode];

      const chatSystemInstruction = 
        `${MYRA_MULTI_PERSONALITY_PROMPT}\n\n` +
        `## ACTIVE PERSONALITY MODE DIRECTIVE:\n` +
        `Active Mode: [MODE: ${activeMode}]\n` +
        `Persona Name: "${profile.name}" (${profile.ui_theme.theme_name})\n` +
        `Behavioral Rule & Core Attitude: "${profile.attitude}"\n\n` +
        `CRITICAL MANDATORY INSTRUCTION:\n` +
        `At the VERY TOP of your response, before ANY text, you MUST output this exact JSON block (enclosed in triple backticks with tag \`json\`):\n` +
        `\`\`\`json\n` +
        `{\n` +
        `  "active_mode": "${activeMode}",\n` +
        `  "ui_theme": {\n` +
        `    "primary_color": "${profile.ui_theme.primary_color}",\n` +
        `    "accent_color": "${profile.ui_theme.accent_color}",\n` +
        `    "background_style": "${profile.ui_theme.background_style}",\n` +
        `    "theme_name": "${profile.ui_theme.theme_name}"\n` +
        `  },\n` +
        `  "voice_engine": {\n` +
        `    "pitch": "${profile.voice_engine.pitch}",\n` +
        `    "speed": "${profile.voice_engine.speed}",\n` +
        `    "style": "${profile.voice_engine.style}"\n` +
        `  }\n` +
        `}\n` +
        `\`\`\`\n\n` +
        `## Creator & Technical Assistance Rules:\n` +
        `- Developer & Creator: Anant (hardworking student balancing school, coaching, and AI).\n` +
        `- When generating code: provide complete, functional Python/Node.js code, exact terminal installation commands (pip install / npm install), and file saving/running instructions.\n` +
        `- When generating test papers: provide detailed questions with answer keys and solutions.\n` +
        `- Primary language: Hindi / Hinglish. Switch to English when prompted in English.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction: chatSystemInstruction,
          temperature: activeMode === "STRICT" ? 0.35 : activeMode === "TECH" ? 0.25 : activeMode === "SAVAGE" ? 0.9 : 0.65,
        }
      });

      const replyText = response.text || "";
      let metadata: any = null;
      let cleanText = replyText;

      const jsonMatch = replyText.match(/```json\s*(\{[\s\S]*?\})\s*```/i);
      if (jsonMatch) {
        try {
          metadata = JSON.parse(jsonMatch[1]);
          cleanText = replyText.replace(/```json\s*\{[\s\S]*?\}\s*```/i, "").trim();
        } catch (e) {}
      }

      res.json({ 
        text: replyText,
        cleanText: cleanText || replyText,
        metadata: metadata || {
          active_mode: activeMode,
          ui_theme: profile.ui_theme,
          voice_engine: profile.voice_engine
        },
        active_mode: metadata?.active_mode || activeMode,
        ui_theme: metadata?.ui_theme || profile.ui_theme,
        voice_engine: metadata?.voice_engine || profile.voice_engine
      });
    } catch (e: any) {
      console.error("[Chat API Error]:", e);
      res.status(500).json({ error: e.message || "Failed to generate AI response." });
    }
  });

  // Smart Infinite Calculator Solver Endpoint
  app.post("/api/calculate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { expression, query } = req.body;

      if (!expression && !query) {
        return res.status(400).json({ error: "Missing expression or query." });
      }

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const prompt = 
        `You are the Smart Infinite Calculator module of Myra AI, developed by Anant. ` +
        `Perform complex, multi-step, and high-precision calculations without any limits.\n` +
        `Task: Solve the mathematical or scientific problem below with high precision, complete step-by-step reasoning, formula explanation, and verified final answer.\n` +
        `Input Problem: ${expression || query}\n\n` +
        `Format your response clearly:\n` +
        `1. Summary / Final Answer (Exact & Approximate decimal if applicable)\n` +
        `2. Step-by-Step Derivation / Calculation steps\n` +
        `3. Formulas & Principles used\n` +
        `4. Notes / Verification\n` +
        `Respond in Hindi if prompted in Hindi, otherwise English. Always be accurate and high-precision!`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          temperature: 0.2
        }
      });

      res.json({
        problem: expression || query,
        solution: response.text || ""
      });
    } catch (e: any) {
      console.error("[Calculate API Error]:", e);
      res.status(500).json({ error: e.message || "Calculation failed." });
    }
  });

  // Universal In-App Search Engine Endpoint (Google, YouTube, Wikipedia, DuckDuckGo)
  app.post("/api/search", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { query, platform = "google", lang = "en" } = req.body;

      if (!query || typeof query !== "string" || !query.trim()) {
        return res.status(400).json({ error: "Search query is required." });
      }

      const cleanQuery = query.trim();

      // Platform: Wikipedia
      if (platform === "wikipedia") {
        try {
          const wikiLang = lang === "hi" ? "hi" : "en";
          const wikiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=10&prop=pageimages|extracts&exintro=1&explaintext=1&exsentences=4&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;
          const resp = await fetch(wikiUrl);
          const data: any = await resp.json();
          const pagesObj = data?.query?.pages || {};
          const results = Object.values(pagesObj).map((p: any) => ({
            id: p.pageid,
            title: p.title,
            snippet: p.extract || "",
            thumbnail: p.thumbnail?.source || null,
            url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`
          }));
          return res.json({
            platform: "wikipedia",
            query: cleanQuery,
            results
          });
        } catch (wikiErr: any) {
          console.error("Wikipedia search failed:", wikiErr);
          return res.status(500).json({ error: "Wikipedia search request failed." });
        }
      }

      // Platform: DuckDuckGo Instant Answers & Topics
      if (platform === "duckduckgo") {
        try {
          const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
          const resp = await fetch(ddgUrl);
          const data: any = await resp.json();
          const related = Array.isArray(data.RelatedTopics) ? data.RelatedTopics.slice(0, 10).map((t: any) => ({
            title: t.Text?.split(" - ")[0] || cleanQuery,
            snippet: t.Text || "",
            url: t.FirstURL || "",
            icon: t.Icon?.URL ? `https://duckduckgo.com${t.Icon.URL}` : null
          })) : [];

          return res.json({
            platform: "duckduckgo",
            query: cleanQuery,
            heading: data.Heading || cleanQuery,
            abstract: data.AbstractText || "",
            abstractUrl: data.AbstractURL || "",
            image: data.Image || null,
            results: related
          });
        } catch (ddgErr: any) {
          console.error("DuckDuckGo search error:", ddgErr);
          return res.status(500).json({ error: "DuckDuckGo search failed." });
        }
      }

      // Platform: YouTube Search & Embedded Player with Real Video IDs
      if (platform === "youtube") {
        try {
          // If user pasted a direct YouTube link or video ID, extract it directly
          const directMatch = cleanQuery.match(/(?:v=|youtu\.be\/|\/embed\/|\/watch\?v=|\/shorts\/)([a-zA-Z0-9_-]{11})/);
          let directVideoId = directMatch ? directMatch[1] : null;

          // Fetch real YouTube search results
          console.log(`[YouTube Search Engine] Scraping real YouTube videos for: "${cleanQuery}"`);
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}&hl=en&sp=EgIQAQ%253D%253D`;
          const ytResponse = await fetch(searchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9,hi;q=0.8"
            }
          });
          const html = await ytResponse.text();

          const videoList: Array<{ id: string; title: string; channel: string; description: string; duration?: string; views?: string }> = [];
          const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
          
          if (jsonMatch) {
            try {
              const data = JSON.parse(jsonMatch[1]);
              const contents = data.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
              if (contents && Array.isArray(contents)) {
                for (const item of contents) {
                  if (item.videoRenderer) {
                    const vr = item.videoRenderer;
                    const vId = vr.videoId;
                    if (vId && /^[a-zA-Z0-9_-]{11}$/.test(vId)) {
                      videoList.push({
                        id: vId,
                        title: vr.title?.runs?.[0]?.text || vr.title?.simpleText || `${cleanQuery} Video`,
                        channel: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "YouTube Creator",
                        description: vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.[0]?.text || vr.descriptionSnippet?.runs?.[0]?.text || "YouTube video",
                        duration: vr.lengthText?.simpleText || "N/A",
                        views: vr.viewCountText?.simpleText || "Verified Video"
                      });
                    }
                  }
                }
              }
            } catch (e: any) {
              console.warn("[YouTube Engine] Parse error, trying regex:", e.message);
            }
          }

          // Regex fallback if JSON was obfuscated
          if (videoList.length === 0) {
            const videoRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
            let match;
            const seen = new Set<string>();
            while ((match = videoRegex.exec(html)) !== null && videoList.length < 12) {
              const id = match[1];
              if (!seen.has(id)) {
                seen.add(id);
                videoList.push({
                  id,
                  title: `${cleanQuery} - Video ${videoList.length + 1}`,
                  channel: "YouTube",
                  description: `Watch ${cleanQuery} inside Myra.`,
                  views: "Verified Video"
                });
              }
            }
          }

          // Verified backup videos if search returned 0 results
          if (videoList.length === 0) {
            const verifiedBackups = [
              { id: "jfKfPfyJRdk", title: "Lofi Hip Hop Radio - Beats to Relax/Study to", channel: "Lofi Girl", description: "Peaceful music to study and focus." },
              { id: "21X5lGlDOfg", title: "NASA Live: Earth from Space (Space Station)", channel: "NASA", description: "Live views of Earth from the International Space Station." },
              { id: "O6Xo21L0ybE", title: "ISRO Chandrayaan-3 Moon Landing", channel: "ISRO Official", description: "Historic soft landing on the Moon." },
              { id: "kJQP7kiw5Fk", title: "Luis Fonsi - Despacito ft. Daddy Yankee", channel: "Luis Fonsi", description: "Official Music Video" },
              { id: "kJw3pxb3RGo", title: "Top 10 Quantum Computing Breakthroughs", channel: "Tech Vision", description: "Latest science and technology analysis." }
            ];
            videoList.push(...verifiedBackups);
          }

          if (directVideoId && !videoList.some(v => v.id === directVideoId)) {
            videoList.unshift({
              id: directVideoId,
              title: `Direct Video: ${directVideoId}`,
              channel: "YouTube",
              description: `Playing direct YouTube video: ${cleanQuery}`
            });
          }

          return res.json({
            platform: "youtube",
            query: cleanQuery,
            videos: videoList.slice(0, 15)
          });
        } catch (ytErr: any) {
          console.error("YouTube search error:", ytErr);
          return res.status(500).json({ error: "YouTube search failed." });
        }
      }

      // Platform: Google Search (Grounded with real-time Google Search)
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured for Google Search." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      let summaryText = "";
      let sources: any[] = [];
      let searchQueries: string[] = [cleanQuery];

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `Search Google for: "${cleanQuery}". Provide a comprehensive, highly accurate, clean, well-formatted summary of current top results with key facts. Respond in Hindi if the query is in Hindi, otherwise English.`,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.3
          }
        });

        summaryText = response.text || "";
        const grounding = response.candidates?.[0]?.groundingMetadata;
        const chunks = grounding?.groundingChunks || [];
        sources = chunks.map((c: any) => {
          if (!c.web) return null;
          let title = c.web.title || "";
          const uri = c.web.uri || "";
          if (!title && uri) {
            try {
              title = new URL(uri).hostname.replace("www.", "");
            } catch {
              title = uri;
            }
          }
          return { title, uri };
        }).filter(Boolean);
        if (grounding?.webSearchQueries && Array.isArray(grounding.webSearchQueries)) {
          searchQueries = grounding.webSearchQueries;
        }
      } catch (geminiSearchErr: any) {
        console.warn("[Google Grounding Warn]:", geminiSearchErr.message);
        // Fallback to Wikipedia summary if Google Grounding tool hits any constraint
        try {
          const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*`;
          const wResp = await fetch(wikiUrl);
          const wData: any = await wResp.json();
          const firstSnippet = wData?.query?.search?.[0]?.snippet?.replace(/<[^>]+>/g, "");
          if (firstSnippet) {
            summaryText = `Search results for "${cleanQuery}":\n\n${firstSnippet}`;
            sources = [{
              title: `Wikipedia: ${wData.query.search[0].title}`,
              uri: `https://en.wikipedia.org/wiki/${encodeURIComponent(wData.query.search[0].title.replace(/ /g, "_"))}`
            }];
          } else {
            summaryText = `Information on "${cleanQuery}" is available on Google and Wikipedia.`;
          }
        } catch {
          summaryText = `Could not retrieve live Google results. Try searching Wikipedia or YouTube.`;
        }
      }

      res.json({
        platform: "google",
        query: cleanQuery,
        summary: summaryText,
        sources,
        searchQueries
      });
    } catch (e: any) {
      console.error("[Search API Error]:", e);
      res.status(500).json({ error: e.message || "Failed to perform search." });
    }
  });

  // Wikipedia Article Full Page Content Reader
  app.get("/api/search/wikipedia/page", async (req, res) => {
    try {
      const title = req.query.title as string;
      const lang = (req.query.lang as string) === "hi" ? "hi" : "en";
      if (!title) return res.status(400).json({ error: "Missing title parameter" });

      const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|images|sections&format=json&origin=*`;
      const resp = await fetch(url);
      const data: any = await resp.json();
      let html = data?.parse?.text?.["*"];

      if (html) {
        // Rewrite relative links and protocol-relative links so they never 404 in the app
        html = html
          .replace(/href="\/wiki\//g, `target="_blank" rel="noopener noreferrer" href="https://${lang}.wikipedia.org/wiki/`)
          .replace(/href="\/\//g, 'target="_blank" rel="noopener noreferrer" href="https://')
          .replace(/src="\/\//g, 'src="https://')
          .replace(/srcset="\/\//g, 'srcset="https://');

        return res.json({
          title: data.parse.title,
          html
        });
      }
      res.status(404).json({ error: "Article not found on Wikipedia." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Safe Server-Side Scraper & HTML Proxy endpoint
  app.get("/api/proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter." });
      }

      console.log(`[Proxy Scraper] Fetching external content for: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Scraper failed to load page: status ${response.status}`);
      }

      const html = await response.text();

      // Simple regex-based HTML parsers for standard items
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Extract high-level headings (h1, h2, h3)
      const headings: string[] = [];
      const headingMatches = html.matchAll(/<h([1-3])\b[^>]*>(.*?)<\/h\1>/gi);
      for (const match of headingMatches) {
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 3 && text.length < 120 && !headings.includes(text)) {
          headings.push(text);
        }
      }

      // Extract organic anchor links
      const links: { text: string; href: string }[] = [];
      const linkMatches = html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
      for (const match of linkMatches) {
        let href = match[1].trim();
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        
        if (text && text.length > 2 && text.length < 100) {
          if (href.startsWith("/")) {
            try {
              const u = new URL(url);
              href = `${u.protocol}//${u.host}${href}`;
            } catch {}
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            links.push({ text, href });
          }
        }
      }

      // Extract general copy paragraphs
      const paragraphs: string[] = [];
      const paragraphMatches = html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gi);
      for (const match of paragraphMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 25 && text.length < 600 && !paragraphs.includes(text)) {
          paragraphs.push(text);
        }
      }

      // Extract button elements
      const buttons: string[] = [];
      const buttonMatches = html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gi);
      for (const match of buttonMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 1 && text.length < 60 && !buttons.includes(text)) {
          buttons.push(text);
        }
      }

      res.json({
        url,
        title,
        headings: headings.slice(0, 15),
        links: links.filter(l => !l.href.includes("javascript:")).slice(0, 30),
        buttons: buttons.slice(0, 15),
        paragraphs: paragraphs.slice(0, 12)
      });

    } catch (err: any) {
      console.error(`[Proxy Scraper] Error fetching ${req.query.url}:`, err.message);
      res.status(500).json({ error: `Scraper error: ${err.message}` });
    }
  });

  // High-fidelity fully functional HTML Proxy which circumvents CSP and X-Frame-Options
  app.get("/api/web-proxy", async (req, res) => {
    let targetUrl = "";
    try {
      const urlParam = req.query.url as string;
      if (!urlParam) {
        return res.status(400).send("Myraa Web Proxy Error: Missing target 'url' parameter");
      }

      targetUrl = urlParam.trim();
      
      // Prevent relative paths from requesting on same-origin
      if (targetUrl.startsWith("/")) {
        return res.status(400).send(`Myraa Web Proxy Error: Relative paths are not supported directly (${targetUrl}).`);
      }

      // Check protocol and hostname format
      try {
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }
        const parsed = new URL(targetUrl);
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
          throw new Error("Missing or invalid domain name extension (e.g. .com, .org, .net).");
        }
      } catch (err: any) {
        return res.status(400).send(`Myraa Web Proxy Error: Invalid URL specified: "${urlParam}". Make sure you enter a valid domain name.`);
      }

      console.log(`[Web Proxy] Routing connection through proxy: ${targetUrl}`);
      
      let response;
      try {
        response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
          }
        });
      } catch (fetchErr: any) {
        console.warn(`[Web Proxy Failed Fetch] Target: ${targetUrl} Error:`, fetchErr.message);
        return res.status(502).send(`Myraa Web Proxy Error: Unable to fetch the website "${targetUrl}". The site might be offline, or the URL address is spelled incorrectly. Details: ${fetchErr.message}`);
      }

      if (!response.ok) {
        return res.status(response.status).send(`Myraa Web Proxy Error: Failed loading remote website. Server returned status: ${response.status} (${response.statusText})`);
      }

      const contentType = response.headers.get("content-type") || "";
      
      // If it is not HTML (e.g. stylesheet, script, or image loaded directly), proxy it as binary
      if (!contentType.includes("text/html")) {
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", contentType);
        return res.send(Buffer.from(arrayBuffer));
      }

      let htmlContents = await response.text();

      // Inject base tag to resolve relative paths and direct parent communication scripts
      const baseUrlTag = `<base href="${targetUrl}" />`;
      const interceptorScript = `
        <script>
          (function() {
            // Hijack link interactions safely
            document.addEventListener('click', function(e) {
              var anchor = e.target.closest('a');
              if (anchor) {
                var href = anchor.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  e.preventDefault();
                  try {
                    var resolvedUrl = new URL(href, window.location.href).href;
                    window.parent.postMessage({ type: 'NAVIGATE', url: resolvedUrl }, '*');
                  } catch (err) {
                    console.error("[Proxy Interceptor] Failed resolving link:", err);
                  }
                }
              }
            }, true);

            // Hijack search form submits
            document.addEventListener('submit', function(e) {
              var form = e.target;
              if (form) {
                e.preventDefault();
                try {
                  var formData = new FormData(form);
                  var params = new URLSearchParams();
                  formData.forEach(function(value, key) {
                    if (typeof value === 'string') {
                      params.append(key, value);
                    }
                  });
                  var actionAttr = form.getAttribute('action') || '';
                  var actionUrl = new URL(actionAttr, window.location.href).href;
                  if (form.method.toLowerCase() === 'get') {
                    actionUrl += (actionUrl.indexOf('?') !== -1 ? '&' : '?') + params.toString();
                  }
                  window.parent.postMessage({ type: 'NAVIGATE', url: actionUrl }, '*');
                } catch (err) {
                  console.error("[Proxy Interceptor] Failed submitting form:", err);
                }
              }
            }, true);

            // Neutralize parent context locks (frame-busters)
            window.alert = function(msg) { console.log("[Myraa Browser alert bypassed]:", msg); };
            window.confirm = function(msg) { console.log("[Myraa Browser confirm bypassed]:", msg); return true; };
            window.open = function(url) { window.parent.postMessage({ type: 'NAVIGATE', url: url }, '*'); return null; };
          })();
        </script>
      `;

      // Inject into <head> or prepend
      if (htmlContents.includes("<head>")) {
        htmlContents = htmlContents.replace("<head>", `<head>\n${baseUrlTag}\n${interceptorScript}`);
      } else if (htmlContents.includes("<HEAD>")) {
        htmlContents = htmlContents.replace("<HEAD>", `<HEAD>\n${baseUrlTag}\n${interceptorScript}`);
      } else {
        htmlContents = baseUrlTag + "\n" + interceptorScript + "\n" + htmlContents;
      }

      // Neutralize security headers to allow displaying in an iframe on same-origin
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Myraa-Proxied", "true");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("content-security-policy");
      res.removeHeader("x-frame-options");
      
      res.status(200).send(htmlContents);
    } catch (e: any) {
      console.warn("[Web Proxy Exception] Handled internal error:", e.message);
      res.status(500).send(`Myraa Web Proxy Error: Internal error occurred proxying URL "${targetUrl || "unknown"}". Details: ${e.message}`);
    }
  });

  // Real-time live YouTube search proxy endpoint
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Missing query q" });
      }

      console.log(`[YouTube Proxy Search] Searching real YouTube for: "${query}"`);
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&sp=EgIQAQ%253D%253D`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      const html = await response.text();

      const videoList: any[] = [];
      const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
      
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const contents = data.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
          if (contents && Array.isArray(contents)) {
            for (const item of contents) {
              if (item.videoRenderer) {
                const vr = item.videoRenderer;
                const vId = vr.videoId;
                if (vId) {
                  videoList.push({
                    videoId: vId,
                    title: vr.title?.runs?.[0]?.text || vr.title?.simpleText || "YouTube Video",
                    thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                    author: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "Unknown Channel",
                    duration: vr.lengthText?.simpleText || "N/A",
                    views: vr.viewCountText?.simpleText || "N/A",
                    published: vr.publishedTimeText?.simpleText || ""
                  });
                }
              }
            }
          }
        } catch (e: any) {
          console.error("[YouTube Parser Engine] JSON parse error, falling back:", e.message);
        }
      }

      // Regex fallback if JSON extraction gets blocked or is empty
      if (videoList.length === 0) {
        const videoRegex = /"videoId":"([^"]+)"/g;
        let match;
        const ids: string[] = [];
        while ((match = videoRegex.exec(html)) !== null && ids.length < 15) {
          const id = match[1];
          if (id && !ids.includes(id)) {
            ids.push(id);
          }
        }

        for (const id of ids) {
          videoList.push({
            videoId: id,
            title: `Live Stream: ${id}`,
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: "YouTube Creator",
            duration: "N/A",
            views: "Available Now"
          });
        }
      }

      res.setHeader("Cache-Control", "public, max-age=60");
      res.status(200).json({ results: videoList.slice(0, 15) });
    } catch (err: any) {
      console.error("[YouTube Search Error]:", err.message);
      res.status(500).json({ error: err.message, results: [] });
    }
  });
  
  // Custom server running with http.createServer so we can upgrade for WebSocket on port 3000
  const server = http.createServer(app);
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    if (pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle client WebSocket Connection
  wss.on("connection", async (clientWs) => {
    console.log("Client WebSocket connected to /live");
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in environment.");
      clientWs.send(JSON.stringify({ 
        type: "error", 
        error: "GEMINI_API_KEY is missing from workspace Secrets. Please set it in the AI Studio Settings panel." 
      }));
      clientWs.close();
      return;
    }
    
    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      clientWs.send(JSON.stringify({ type: "status", status: "connecting_gemini" }));

      // Load persistent recollections card
      const memories = await loadMemories();
      const baseInstructions = 
        `${MYRA_MULTI_PERSONALITY_PROMPT}\n\n` +
        `# MYRA AI - LIVE COMPANION IDENTITY & RULES\n` +
        `- Name: Myra (मायरा)\n` +
        `- Founder / Creator: Anant (hardworking student who diligently balances school, coaching classes, and advanced AI development).\n` +
        `- Deep Respect for Anant: Always address Anant with warmth, deep respect (अनंत जी / Anant), and encouragement.\n` +
        `- DYNAMIC PERSONALITY ENGINE:\n` +
        `  You possess 5 dynamic modes: DEFAULT (Original Myra), STRICT (Strict Mentor), TECH (Code Architect), SAVAGE (Roast Master), and DETECTIVE (Cyber Detective).\n` +
        `  When the user verbally asks to change mode (e.g., "Switch to Strict mode", "बी माय कोडिंग आर्किटेक्ट", "रोस्ट करो मुझे", "डिटेक्टिव मोड चालू करो", "डिफ़ॉल्ट पर वापस आओ"), IMMEDIATELY call the 'switchPersonalityMode' tool and adapt your speaking style and demeanor instantly.\n` +
        `- Core Tools:\n` +
        `  - 'switchPersonalityMode': Shifts the active personality mode and interface theme.\n` +
        `  - 'calculateInfiniteMath': Computes complex, multi-step math with precision.\n` +
        `  - 'addToSpeechNotepad': Saves spoken thoughts or study revision to Notepad.\n` +
        `  - 'openSearchHub': Opens search on Google, YouTube, Wikipedia, or DuckDuckGo.\n` +
        `  - 'saveCustomMemory': Persists long-term recollections.\n` +
        `- Language: Speaks naturally in Hindi / Hinglish. Switches to English when the user speaks in English.`;

      const finalInstructions = formatSystemInstructionsWithMemories(baseInstructions, memories);

      // Track running transcription state for auto memory consolidation
      let dialogueHistory: { role: string; text: string }[] = [];
      let currentModelResponseText = "";
      
      const session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: finalInstructions,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "switchPersonalityMode",
                  description: "Switches Myra's active dynamic personality mode between DEFAULT, STRICT, TECH, SAVAGE, and DETECTIVE based on user verbal command or intent.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      mode: {
                        type: Type.STRING,
                        description: "The mode to switch to.",
                        enum: ["DEFAULT", "STRICT", "TECH", "SAVAGE", "DETECTIVE"]
                      }
                    },
                    required: ["mode"]
                  }
                },
                {
                  name: "openSearchHub",
                  description: "Opens the Universal Search Hub inside the app with Google, YouTube, Wikipedia, or DuckDuckGo results.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      platform: {
                        type: Type.STRING,
                        description: "The search platform.",
                        enum: ["google", "youtube", "wikipedia", "duckduckgo"]
                      },
                      query: {
                        type: Type.STRING,
                        description: "The search query term."
                      }
                    },
                    required: ["platform", "query"]
                  }
                },
                {
                  name: "changeBackground",
                  description: "Changes the visual theme or atmospheric glow color of Myraa's interface.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      color: {
                        type: Type.STRING,
                        description: "The theme color name (violet, crimson, emerald, celestial, gold, rose, charcoal)"
                      }
                    },
                    required: ["color"]
                  }
                },
                {
                  name: "saveCustomMemory",
                  description: "Allows Myraa to immediately save a piece of critical user information to her persistent memory core.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description: "The memory category.",
                        enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"]
                      },
                      text: {
                        type: Type.STRING,
                        description: "Precise third-person statement."
                      }
                    },
                    required: ["category", "text"]
                  }
                },
                {
                  name: "addToSpeechNotepad",
                  description: "Transcribes and appends spoken thoughts, study notes, or meeting points directly into the persistent Smart Speech Notepad.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description: "The title of the note."
                      },
                      content: {
                        type: Type.STRING,
                        description: "The transcribed content or thoughts to save."
                      },
                      tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Tags for the note, e.g. ['Study', 'Coaching', 'Python', 'Ideas']."
                      }
                    },
                    required: ["content"]
                  }
                },
                {
                  name: "calculateInfiniteMath",
                  description: "Solves complex, multi-step, high-precision, symbolic, or scientific calculations without limits.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      expression: {
                        type: Type.STRING,
                        description: "The mathematical or scientific expression to solve, e.g. 'sqrt(3^10 + 4^10)' or 'derivative of x^4 * cos(x)'."
                      }
                    },
                    required: ["expression"]
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Audio Stream Chunk (model response audio play, 24kHz raw PCM)
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            
            // Interruption flag
            if (message.serverContent?.interrupted) {
              console.log("[Myraa Interrupted!]");
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
            
            // Turn Complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
              
              if (currentModelResponseText.trim()) {
                dialogueHistory.push({ role: "model", text: currentModelResponseText });
                currentModelResponseText = "";
              }

              // Fire asynchronous memory extraction
              if (dialogueHistory.length >= 2) {
                (async () => {
                  try {
                    const updated = await processConversationSlice(apiKey, dialogueHistory);
                    if (updated) {
                      console.log("[Memory Sync] Sending refreshed memory list to client.");
                      clientWs.send(JSON.stringify({ type: "memory_sync", memories: updated }));
                    }
                  } catch (err) {
                    console.error("[Memory Sync] Error running background consolidation:", err);
                  }
                })();
              }
            }
            
            // Transcription of model output (text chunk)
            const modelText = (message.serverContent as any)?.modelTurn?.parts?.[0]?.text;
            if (modelText) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "model", text: modelText }));
              currentModelResponseText += modelText;
            }
            
            // User input transcription (user speech text translated by Gemini)
            const userTextOutput = (message.serverContent as any)?.userTurn?.parts?.[0]?.text;
            if (userTextOutput) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "user", text: userTextOutput }));
              dialogueHistory.push({ role: "user", text: userTextOutput });
            }
            
            // Function Calls (Gemini requesting server/client tool execution)
            if (message.toolCall?.functionCalls) {
              for (const fc of message.toolCall.functionCalls) {
                console.log(`[Function Call]: ${fc.name}`, fc.args);
                
                if (fc.name === "saveCustomMemory") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const category = args.category;
                      const text = args.text;
                      if (category && text) {
                        const mList = await loadMemories();
                        const timestamp = new Date().toISOString();
                        const newMemory: Memory = {
                          id: Math.random().toString(36).substring(2, 11),
                          category,
                          text,
                          createdAt: timestamp,
                          updatedAt: timestamp
                        };
                        mList.push(newMemory);
                        await saveMemories(mList);
                        
                        // Sync immediately with the React client
                        clientWs.send(JSON.stringify({ type: "memory_sync", memories: mList }));
                        
                        // Send success code back to live link
                        session.sendToolResponse({
                          functionResponses: [
                            {
                              name: fc.name,
                              response: { output: { result: "Memory successfully captured and persisted in connections core." } },
                              id: fc.id
                            }
                          ]
                        });
                      }
                    } catch (err: any) {
                      console.error("saveCustomMemory execution failure:", err);
                    }
                  })();
                } else if (fc.name === "addToSpeechNotepad") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const title = args.title || "मायरा स्पीच नोट";
                      const content = args.content || "";
                      const tags = args.tags && Array.isArray(args.tags) ? args.tags : ["Live Speech", "Voice Note"];
                      const notes = await loadNotes();
                      const timestamp = new Date().toISOString();
                      const newNote: NoteItem = {
                        id: "note_" + Math.random().toString(36).substring(2, 11),
                        title,
                        content,
                        tags,
                        pinned: false,
                        createdAt: timestamp,
                        updatedAt: timestamp
                      };
                      notes.unshift(newNote);
                      await saveNotes(notes);

                      // Broadcast to client WebSocket
                      clientWs.send(JSON.stringify({
                        type: "note_saved",
                        note: newNote,
                        notes
                      }));

                      session.sendToolResponse({
                        functionResponses: [
                          {
                            name: fc.name,
                            response: { output: { result: "नोटपैड में सफलतापूर्वक सुरक्षित कर लिया गया है (Saved to Smart Speech Notepad successfully)." } },
                            id: fc.id
                          }
                        ]
                      });
                    } catch (err: any) {
                      console.error("addToSpeechNotepad execution failure:", err);
                    }
                  })();
                } else if (fc.name === "calculateInfiniteMath") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const expression = args.expression || "";
                      // Forward to client to open/show in Infinite Calculator
                      clientWs.send(JSON.stringify({
                        type: "calculator_request",
                        expression
                      }));

                      session.sendToolResponse({
                        functionResponses: [
                          {
                            name: fc.name,
                            response: { output: { result: `गैलकुलेटर में गणना की जा रही है: ${expression}` } },
                            id: fc.id
                          }
                        ]
                      });
                    } catch (err: any) {
                      console.error("calculateInfiniteMath execution failure:", err);
                    }
                  })();
                } else if (fc.name === "openSearchHub") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const platform = args.platform || "google";
                      const query = args.query || "";
                      clientWs.send(JSON.stringify({
                        type: "search_hub_request",
                        platform,
                        query
                      }));

                      session.sendToolResponse({
                        functionResponses: [
                          {
                            name: fc.name,
                            response: { output: { result: `सर्च हब खोल दिया गया है: "${query}" पर ${platform}` } },
                            id: fc.id
                          }
                        ]
                      });
                    } catch (err: any) {
                      console.error("openSearchHub execution failure:", err);
                    }
                  })();
                } else if (fc.name === "switchPersonalityMode") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const targetMode = (args.mode || "DEFAULT").toUpperCase();
                      const profile = PERSONALITY_PROFILES[targetMode as PersonalityMode] || PERSONALITY_PROFILES.DEFAULT;

                      clientWs.send(JSON.stringify({
                        type: "personality_mode_switch",
                        mode: targetMode,
                        profile
                      }));

                      session.sendToolResponse({
                        functionResponses: [
                          {
                            name: fc.name,
                            response: { output: { result: `सफलतापूर्वक ${profile.name} (${profile.ui_theme.theme_name}) मोड सक्रिय कर दिया गया है।` } },
                            id: fc.id
                          }
                        ]
                      });
                    } catch (err: any) {
                      console.error("switchPersonalityMode execution failure:", err);
                    }
                  })();
                } else {
                  clientWs.send(JSON.stringify({
                    type: "toolCall",
                    callId: fc.id,
                    name: fc.name,
                    args: fc.args
                  }));
                }
              }
            }
          },
          onclose: () => {
            console.log("Gemini Live session closed");
            clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
          }
        }
      });
      
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));
      
      clientWs.on("message", (rawMsg) => {
        try {
          const msg = JSON.parse(rawMsg.toString());
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          } else if (msg.type === "video" && msg.video) {
            session.sendRealtimeInput({
              video: { data: msg.video, mimeType: "image/jpeg" }
            });
          } else if (msg.type === "toolResponse") {
            session.sendToolResponse({
              functionResponses: [
                {
                  name: msg.name,
                  response: { output: msg.output },
                  id: msg.id
                }
              ]
            });
          } else if (msg.type === "set_mode" && msg.mode) {
            console.log(`[Myraa Live Bridge] Active personality set to: ${msg.mode}`);
          }
        } catch (e) {
          console.error("Error editing/forwarding client frame message:", e);
        }
      });
      
      clientWs.on("close", () => {
        console.log("Client disconnected, closing Gemini session");
        try {
          session.close();
        } catch (e) {}
      });
      
    } catch (err: any) {
      console.error("Error connecting to Gemini Live API:", err);
      clientWs.send(JSON.stringify({ 
        type: "error", 
        error: `Could not connect to Gemini: ${err.message || err}` 
      }));
      clientWs.close();
    }
  });

  // Serve custom static assets folder
  app.use("/assets", express.static(path.join(process.cwd(), "assets")));

  // Express Static assets / Vite Dev Middleware configuration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server startup sequence:", error);
});
