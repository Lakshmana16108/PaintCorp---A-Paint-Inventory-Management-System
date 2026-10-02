const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(__dirname, "../../knowledge");

const STOPWORDS = new Set([
  "how", "does", "what", "why", "who", "when", "where", "which",
  "is", "are", "was", "were", "the", "a", "an", "in", "on", "at",
  "to", "for", "of", "with", "after", "before", "my", "your", "our",
  "i", "we", "they", "it", "can", "do", "did", "done", "show", "tell", "me", "about"
]);

function normalizeWord(w) {
  return w.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getKeywords(text) {
  return (text || "")
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function resolveKnowledgeDir() {
  const candidates = [
    path.join(__dirname, "../../knowledge"),
    path.join(__dirname, "../knowledge"),
    path.join(process.cwd(), "server", "knowledge"),
    path.join(process.cwd(), "knowledge"),
    path.join(__dirname, "../../../server/knowledge")
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.readdirSync(c).some((f) => f.endsWith(".md"))) {
        return c;
      }
    } catch (e) {}
  }
  return path.join(__dirname, "../../knowledge");
}

class KnowledgeService {
  constructor() {
    this.documents = [];
    this.sections = [];
    this.loadDocuments();
  }

  /**
   * Load and index all markdown knowledge base files and sections from disk
   */
  loadDocuments() {
    try {
      const knowledgeDir = resolveKnowledgeDir();
      if (!fs.existsSync(knowledgeDir)) {
        console.warn(`[Corp AI] Knowledge directory not found at ${knowledgeDir}`);
        return;
      }

      const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));
      this.documents = [];
      this.sections = [];

      files.forEach((file) => {
        const fullPath = path.join(knowledgeDir, file);
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        const titleLine = lines.find((l) => l.startsWith("# ")) || `# ${file}`;
        const title = titleLine.replace(/^#\s*/, "").trim();

        // Extract key terms from title and headings
        const headings = lines
          .filter((l) => l.startsWith("## ") || l.startsWith("### "))
          .map((l) => l.replace(/^#+\s*/, "").toLowerCase());

        this.documents.push({
          filename: file,
          id: file.replace(".md", ""),
          title,
          headings,
          content
        });

        // Index each section starting with ##
        const rawSections = content.split(/\n(?=##\s+)/);
        for (const sec of rawSections) {
          if (!sec.trim().startsWith("##")) continue;
          const secLines = sec.trim().split("\n");
          const heading = secLines[0].replace(/^##\s+(\d+\.\s*)?/, "").trim();
          const body = secLines.slice(1).join("\n").trim();
          this.sections.push({
            heading,
            body,
            file,
            docTitle: title,
            hKeywords: getKeywords(heading)
          });
        }
      });

      console.log(`[Corp AI] Loaded ${this.documents.length} knowledge base documents with ${this.sections.length} sections.`);
    } catch (err) {
      console.error("[Corp AI] Error loading knowledge base:", err);
      this.documents = [];
      this.sections = [];
    }
  }

  /**
   * Find the most relevant specific section for a targeted doubt / workflow question
   */
  findBestSection(query, minScore = 20) {
    if (!query || typeof query !== "string") return null;
    const queryKeywords = getKeywords(query);
    if (queryKeywords.length === 0) return null;

    let best = null;
    let maxScore = 0;

    for (const s of this.sections) {
      let score = 0;
      for (const qk of queryKeywords) {
        for (const hk of s.hKeywords) {
          if (hk === qk) score += 20;
          else if (hk.includes(qk) || qk.includes(hk)) score += 12;
        }
        if (s.body.toLowerCase().includes(qk)) score += 2;
      }

      if (score > maxScore) {
        maxScore = score;
        best = {
          heading: s.heading,
          body: s.body,
          file: s.file,
          docTitle: s.docTitle,
          score
        };
      }
    }

    return best && best.score >= minScore ? best : null;
  }

  /**
   * Search knowledge base using keyword and term relevance scoring
   */
  searchKnowledge(query, maxResults = 3) {
    if (!query || typeof query !== "string") return [];
    const normalizedQuery = query.toLowerCase().trim();
    const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 2);

    const scored = this.documents.map((doc) => {
      let score = 0;
      const lowerContent = doc.content.toLowerCase();
      const lowerTitle = doc.title.toLowerCase();

      // Full phrase matches
      if (lowerTitle.includes(normalizedQuery)) score += 15;
      if (lowerContent.includes(normalizedQuery)) score += 8;

      // Token matches
      for (const token of queryTokens) {
        if (lowerTitle.includes(token)) score += 5;
        for (const h of doc.headings) {
          if (h.includes(token)) score += 4;
        }
        // Count occurrences in content (capped)
        const matches = (lowerContent.match(new RegExp(token, "g")) || []).length;
        score += Math.min(matches, 5);
      }

      return { doc, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((item) => ({
        title: item.doc.title,
        id: item.doc.id,
        content: item.doc.content
      }));
  }

  /**
   * Get concise summary of all system documentation
   */
  getAllKnowledgeSummary() {
    return this.documents.map((d) => ({ id: d.id, title: d.title }));
  }
}

// Singleton instance
const knowledgeService = new KnowledgeService();

module.exports = {
  knowledgeService,
  findBestSection: (q, min) => knowledgeService.findBestSection(q, min),
  searchKnowledge: (q, max) => knowledgeService.searchKnowledge(q, max),
  getAllKnowledgeSummary: () => knowledgeService.getAllKnowledgeSummary()
};

