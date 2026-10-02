/**
 * PaintCorp Domain Guard
 * Strictly restricts Corp AI to the PaintCorp Inventory Management System domain.
 * Unrelated questions (general trivia, celebrities, coding, sports, weather, crypto, etc.)
 * are blocked and redirected to PaintCorp-related topics.
 */

const PAINTCORP_REDIRECT_MESSAGE =
  "I'm Corp AI, the assistant for the PaintCorp Inventory Management System. I can help with PaintCorp products, inventory, stock, orders, billing, sales analysis, system features, and troubleshooting. Please ask me a PaintCorp-related question.";

// Common PaintCorp domain terms and entity stems
const PAINTCORP_KEYWORDS = [
  // Products & Paints
  "paint", "paints", "color", "colour", "shade", "brand", "finish", "luster", "matte", "gloss",
  "satin", "sheen", "primer", "enamel", "emulsion", "distemper", "weatherproof", "waterproof",
  "nippon", "spot-less", "spotless", "weathershield", "ultima", "apex", "easyclean", "woodtech",
  "dampblock", "tractor", "royale", "apcolite", "brite", "melamyne", "berger", "asian paints", "dulux", "nerolac",
  "liter", "liters", "litre", "litres", "pnt", "product", "products", "catalog", "pricing", "price", "unit price",

  // Inventory & Stock
  "stock", "inventory", "warehouse", "depot", "tirunelveli", "madurai", "chennai", "central warehouse",
  "quantity", "liters available", "low stock", "out of stock", "in stock", "reorder", "safety threshold",
  "replenish", "negative stock", "threshold", "minimum quantity",

  // Orders & Billing
  "order", "orders", "ord", "order_items", "invoice", "billing", "customer", "phone", "address",
  "checkout", "cart", "payment", "pos", "status", "pending", "shipped", "delivered", "cancelled",
  "cancel", "restoration", "restore", "deduction", "deduct", "pos checkout",

  // Sales & Analytics
  "sales", "revenue", "top selling", "sold", "average order value", "aov", "sales analysis",
  "sales report", "daily sales", "monthly sales", "date range", "profit",

  // Users & System
  "user", "users", "auth", "authentication", "login", "signup", "register", "password", "token", "jwt",
  "role", "admin", "employee", "manager", "paintcorp", "corp ai", "dashboard", "sidebar", "system",
  "navigation", "workflow", "troubleshoot", "troubleshooting", "error", "bug", "feature", "features"
];

// Patterns that indicate system behavior questions or doubts
const SYSTEM_DOUBT_PATTERNS = [
  /why (did|is|does|was) (my |the )?stock/i,
  /why (did|is|does|was) (my |the )?order/i,
  /why (can't|cannot|am i unable to) (i |we )?find/i,
  /why is (my |the )?order showing cancelled/i,
  /how (does|do) (i |we |paintcorp )?(prevent|handle|stop) negative stock/i,
  /how (does|do) (i |we |paintcorp )?(calculate|compute) revenue/i,
  /how (does|do) (i |we |paintcorp )?create an order/i,
  /how (does|do) (i |we |paintcorp )?check (low|available) stock/i,
  /how (does|do) (i |we |paintcorp )?login/i,
  /how (does|do) (i |we |paintcorp )?billing/i,
  /how (does|do) (i |we |paintcorp )?cancel/i,
  /how does (the )?system work/i,
  /how to use paintcorp/i,
  /how does order cancellation restore stock/i,
  /why was stock restored/i,
  /why did my stock decrease/i,
  /what does sales analysis show/i,
  /explain paintcorp/i,
  /about paintcorp/i,
  /what is paintcorp/i
];

// Unrelated topics patterns: immediately flagged as out-of-domain
const UNRELATED_PATTERNS = [
  // Organizations & Religions
  /\b(iskcon|krishna consciousness|church|temple|mosque|vatican|bible|quran|gita|buddhism|hinduism|islam|christianity)\b/i,
  // Cryptocurrencies & Stocks outside PaintCorp
  /\b(bitcoin|btc|ethereum|eth|crypto|cryptocurrency|dogecoin|solana|binance|blockchain|wall street|nasdaq|sensex|nifty)\b/i,
  // Celebrities & Politicians
  /\b(elon musk|bill gates|steve jobs|mark zuckerberg|donald trump|joe biden|narendra modi|rahul gandhi|messi|ronaldo|virat kohli|sachin)\b/i,
  // General Tech / Programming outside PaintCorp
  /\b(write a python|write a java|write a c\+\+|write code|coding in python|write a program|write a script|c\+\+|golang|rust lang|quantum physics|quantum computing|black hole|astronomy|mars rover)\b/i,
  // Geography & General Trivia
  /\b(capital of france|capital of|who won the world cup|world cup|olympics|who is the president of|who is the prime minister of|mount everest|tallest building)\b/i,
  // Entertainment & Casual
  /\b(tell me a joke|tell a joke|make me laugh|sing a song|write a poem|movie recommendation|recipe for|how to cook|how to bake|what is the weather|weather today|weather forecast|horoscope|astrology)\b/i
];

/**
 * Classify incoming user query against the PaintCorp domain.
 * Returns { isRelated: boolean, isGreeting: boolean, isAmbiguous: boolean, answer?: string }
 */
function classifyPaintCorpDomain(query, conversationHistory = []) {
  if (!query || typeof query !== "string") {
    return { isRelated: false, answer: PAINTCORP_REDIRECT_MESSAGE };
  }

  const clean = query.trim().toLowerCase();

  // 1. Basic conversational greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)\b/i.test(clean) && clean.split(/\s+/).length <= 4) {
    return {
      isRelated: true,
      isGreeting: true,
      answer: "Hello! I'm Corp AI, your PaintCorp assistant. I can help with products, inventory, orders, billing, sales analysis, and system guidance."
    };
  }

  // 2. Questions about Corp AI identity & capabilities
  if (
    clean === "who are you" ||
    clean === "who are you?" ||
    clean === "what is your name" ||
    clean === "what is your name?" ||
    clean.includes("what can you do") ||
    clean.includes("help me")
  ) {
    return {
      isRelated: true,
      isGreeting: true,
      answer: "I am **Corp AI**, the official intelligent assistant for the PaintCorp Inventory Management System.\n\nI can help you:\n- Check live paint catalog prices and specifications\n- Monitor current stock across physical warehouses\n- View low-stock (≤ 15 L) and out-of-stock items\n- Look up customer orders and delivery statuses\n- Review real-time sales metrics, revenue, and top-selling paints\n- Answer questions and doubts about PaintCorp workflows\n\nHow can I assist you with PaintCorp today?"
    };
  }

  // 3. Explicit check for unrelated topics (Strict Blacklist)
  for (const pattern of UNRELATED_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isRelated: false,
        isUnrelated: true,
        answer: PAINTCORP_REDIRECT_MESSAGE
      };
    }
  }

  // 4. Check for system doubt & troubleshooting patterns
  for (const pattern of SYSTEM_DOUBT_PATTERNS) {
    if (pattern.test(clean)) {
      return { isRelated: true, isSystemDoubt: true };
    }
  }

  // 5. Check for explicit PaintCorp keywords
  for (const kw of PAINTCORP_KEYWORDS) {
    // Word boundary match
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(clean)) {
      return { isRelated: true };
    }
  }

  // 6. Check for ambiguous questions without product context
  if (
    clean === "how much does it cost" ||
    clean === "how much does it cost?" ||
    clean === "how much is it" ||
    clean === "how much is it?" ||
    clean === "what is the price" ||
    clean === "what is the price?"
  ) {
    // Check if conversation history recently discussed a product
    const hasPriorProduct = conversationHistory.some(
      (m) =>
        m.text &&
        PAINTCORP_KEYWORDS.some((kw) => m.text.toLowerCase().includes(kw))
    );
    if (!hasPriorProduct) {
      return {
        isRelated: true,
        isAmbiguous: true,
        answer: "Are you asking about the price of a product in PaintCorp?"
      };
    }
    return { isRelated: true, isContextual: true };
  }

  if (
    clean === "how many are available" ||
    clean === "how many are available?" ||
    clean === "how many units" ||
    clean === "how many units?" ||
    clean === "how much is available" ||
    clean === "is it available" ||
    clean === "is it available?"
  ) {
    const hasPriorProduct = conversationHistory.some(
      (m) =>
        m.text &&
        PAINTCORP_KEYWORDS.some((kw) => m.text.toLowerCase().includes(kw))
    );
    if (!hasPriorProduct) {
      return {
        isRelated: true,
        isAmbiguous: true,
        answer: "Which PaintCorp product would you like me to check?"
      };
    }
    return { isRelated: true, isContextual: true };
  }

  // 7. Check for Contextual Follow-up (e.g. "Is that low?", "Why?", "What about the previous month?")
  const isFollowUpPattern =
    /^(is that (low|high|out of stock|available)|why|why\?|why so|how come|what about (the )?(previous|last|next) (month|week|day|year)|and the revenue\??|which warehouse\??|show details|tell me more)\b/i.test(
      clean
    );

  if (isFollowUpPattern && conversationHistory.length > 0) {
    // Check if last turn in conversation history was PaintCorp-related
    const lastAssistantTurn = [...conversationHistory]
      .reverse()
      .find((m) => m.role === "assistant" || m.sender === "ai");
    if (
      lastAssistantTurn &&
      lastAssistantTurn.text &&
      !lastAssistantTurn.text.includes(PAINTCORP_REDIRECT_MESSAGE)
    ) {
      return { isRelated: true, isContextual: true };
    }
  }

  // 8. If the query does not contain ANY PaintCorp domain terms, system doubt patterns,
  // or active contextual follow-up, it is UNRELATED to PaintCorp.
  return {
    isRelated: false,
    isUnrelated: true,
    answer: PAINTCORP_REDIRECT_MESSAGE
  };
}

module.exports = {
  PAINTCORP_REDIRECT_MESSAGE,
  classifyPaintCorpDomain
};
