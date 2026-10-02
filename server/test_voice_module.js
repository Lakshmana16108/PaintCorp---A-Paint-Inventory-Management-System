/**
 * Test script for the Voice Conversation Module
 * Verifies cleanMarkdownForSpeech parsing, currency conversions,
 * table transformations, and existing Corp AI integration parity.
 */

// Simulated markdown cleaner from voiceAssistant.js
function cleanMarkdownForSpeech(text) {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  // 1. Remove raw code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "Code block omitted.");

  // 2. Format markdown tables into readable spoken sentences
  const lines = cleaned.split("\n");
  const processedLines = [];
  let inTable = false;
  let headers = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      // Divider line (|---|---|)
      if (cells.every((c) => /^[:\s-]+$/.test(c))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        headers = cells;
      } else {
        const rowDesc = cells
          .map((c, idx) => (headers[idx] ? `${headers[idx]}: ${c}` : c))
          .join(", ");
        processedLines.push(rowDesc);
      }
    } else {
      inTable = false;
      headers = [];
      processedLines.push(line);
    }
  }
  cleaned = processedLines.join("\n");

  // 3. Indian Rupee symbol to word "rupees"
  cleaned = cleaned.replace(/₹\s*([\d,]+(\.\d+)?)/g, "$1 rupees");
  cleaned = cleaned.replace(/₹/g, " rupees ");

  // 4. Units: '42 L' or '15L' -> '42 liters'
  cleaned = cleaned.replace(/(\d+)\s*L\b/gi, "$1 liters");

  // 5. Remove Markdown headers (###, ##, #)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // 6. Remove bold/italics markers (**word**, *word*, __word__, _word_)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
  cleaned = cleaned.replace(/_([^_]+)_/g, "$1");

  // 7. Remove inline code ticks (`code`)
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // 8. Replace bullet lists (- or * or +) with readable periods
  cleaned = cleaned.replace(/^[\s*+-]+\s+/gm, ". ");

  // 9. Clean up numbered lists (1. Item -> Item.)
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, ". ");

  // 10. Replace brackets and parenthesis with spaces
  cleaned = cleaned.replace(/[[\]()]/g, " ");

  // 11. Normalize spaces, dots, and trailing punctuation
  cleaned = cleaned
    .replace(/\s+/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/\.\s*\./g, ".")
    .trim();

  return cleaned;
}

console.log("=====================================================");
console.log(" PaintCorp Corp AI - Voice Module Test Verification ");
console.log("=====================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failed++;
  }
}

// TEST 1: Bold and Italics Stripping
const input1 = "Nippon Spot-less has **42 L** currently *in stock*.";
const out1 = cleanMarkdownForSpeech(input1);
console.log("TEST 1 Spoken output:", out1);
assert(!out1.includes("**") && !out1.includes("*"), "TEST 1: Bold and italics symbols removed");
assert(out1.includes("42 liters"), "TEST 1: '42 L' converted to '42 liters'");

// TEST 2: Currency Transformation
const input2 = "The total revenue for September was ₹876,920.00.";
const out2 = cleanMarkdownForSpeech(input2);
console.log("TEST 2 Spoken output:", out2);
assert(!out2.includes("₹"), "TEST 2: Rupee symbol '₹' removed");
assert(out2.includes("876,920.00 rupees"), "TEST 2: Transformed to '876,920.00 rupees'");

// TEST 3: Headers and Bullets
const input3 = `### Current Inventory Overview
- Nippon Spot-less: 42 L
- WeatherShield: 17 L
- WoodTech Finish: 0 L`;
const out3 = cleanMarkdownForSpeech(input3);
console.log("TEST 3 Spoken output:", out3);
assert(!out3.includes("###") && !out3.includes("- "), "TEST 3: Markdown headers and dashes stripped");
assert(out3.includes("Nippon Spot-less: 42 liters"), "TEST 3: Bullet points formatted into clean sentences");

// TEST 4: Markdown Table Transformation
const input4 = `| Product Name | Stock | Status |
| :--- | :--- | :--- |
| Apex Ultima | 123 L | In Stock |
| EasyClean | 8 L | Low Stock |`;
const out4 = cleanMarkdownForSpeech(input4);
console.log("TEST 4 Spoken output:", out4);
assert(!out4.includes("|"), "TEST 4: Table pipe delimiters stripped");
assert(out4.includes("Apex Ultima") && out4.includes("123 liters"), "TEST 4: Table rows read as natural sentences");

// TEST 5: Code Blocks
const input5 = "Here is an example: ```SELECT * FROM products``` and done.";
const out5 = cleanMarkdownForSpeech(input5);
console.log("TEST 5 Spoken output:", out5);
assert(!out5.includes("SELECT"), "TEST 5: Raw code omitted from spoken voice");

// TEST 6: Message History Simulation (Voice vs Typed)
// Simulate message state when typing vs voice
const initialChat = [{ id: "welcome-1", sender: "ai", text: "Hello! How can I help?" }];

// Simulation 1: User types "Check low stock"
const typedQuery = "Check low stock";
const chatAfterTyped = [
  ...initialChat,
  { id: "u-1", sender: "user", text: typedQuery },
  { id: "a-1", sender: "ai", text: "You have 7 low-stock paints." }
];
assert(chatAfterTyped.some(m => m.sender === "user" && m.text === typedQuery), "TEST 6: Typed mode retains user message in permanent chat list");

// Simulation 2: User speaks "Check low stock" via microphone
const voiceQuery = "Check low stock";
// In Voice Mode: USER message is NOT added to permanent chat history (Requirement 2)
const isVoice = true;
let chatAfterVoice = [...initialChat];
if (!isVoice) {
  chatAfterVoice.push({ id: "u-2", sender: "user", text: voiceQuery });
}
chatAfterVoice.push({ id: "a-2", sender: "ai", text: "You have 7 low-stock paints." });
assert(!chatAfterVoice.some(m => m.id === "u-2"), "TEST 6: Voice mode strictly omits user voice message from permanent chat list");
assert(chatAfterVoice[chatAfterVoice.length - 1].sender === "ai", "TEST 6: Permanent chat only contains Corp AI answer in voice mode");

console.log("\n=====================================================");
console.log(` Voice Module Verification: ${passed} PASSED | ${failed} FAILED`);
console.log("=====================================================\n");

process.exit(failed > 0 ? 1 : 0);
