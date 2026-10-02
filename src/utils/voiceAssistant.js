/**
 * Voice Assistant Utility for PaintCorp Corp AI
 * Provides browser-native Speech Recognition (STT) and Speech Synthesis (TTS).
 * Uses zero paid external APIs.
 */

/**
 * Checks whether Speech Recognition is supported by the current browser.
 */
export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Checks whether Speech Synthesis (TTS) is supported by the current browser.
 */
export function isSpeechSynthesisSupported() {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
}

/**
 * Transforms Markdown-formatted text into natural, fluent spoken English.
 * Strips code blocks, symbols, table pipes, and converts currency and unit notations.
 */
export function cleanMarkdownForSpeech(text) {
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

/**
 * Creates and initializes a browser-native SpeechRecognition instance.
 */
export function createSpeechRecognition({
  lang = "en-US",
  onInterimResult = () => {},
  onFinalResult = () => {},
  onError = () => {},
  onStart = () => {},
  onEnd = () => {}
} = {}) {
  if (!isSpeechRecognitionSupported()) {
    throw new Error("Speech Recognition is not supported in this browser.");
  }

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = lang;
  recognition.maxAlternatives = 1;

  let finalTranscriptReceived = false;

  recognition.onstart = () => {
    finalTranscriptReceived = false;
    onStart();
  };

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const item = event.results[i];
      const text = item[0].transcript;
      if (item.isFinal) {
        final += text;
      } else {
        interim += text;
      }
    }

    if (final.trim()) {
      finalTranscriptReceived = true;
      onFinalResult(final.trim());
    } else if (interim.trim()) {
      onInterimResult(interim.trim());
    }
  };

  recognition.onerror = (event) => {
    console.warn("[Voice Assistant Error]:", event.error);
    let userMsg = "Voice input could not be recognized. Please try again.";
    if (event.error === "not-allowed") {
      userMsg = "Microphone permission is required for voice input. Please allow microphone access in your browser.";
    } else if (event.error === "no-speech") {
      userMsg = "No speech detected. Please speak clearly into your microphone.";
    } else if (event.error === "network") {
      userMsg = "Network error occurred during speech recognition.";
    }
    onError(userMsg, event.error);
  };

  recognition.onend = () => {
    onEnd(finalTranscriptReceived);
  };

  return recognition;
}

/**
 * Speak text aloud using browser-native SpeechSynthesis.
 * Automatically cleans markdown and selects the best matching voice.
 */
export function speakText(text, {
  lang = "en-US",
  rate = 1,
  pitch = 1,
  onStart = () => {},
  onEnd = () => {},
  onError = () => {}
} = {}) {
  if (!isSpeechSynthesisSupported()) {
    console.warn("Speech Synthesis is not supported in this browser.");
    return () => {};
  }

  // Cancel any ongoing speech
  stopSpeaking();

  const spokenText = cleanMarkdownForSpeech(text);
  if (!spokenText.trim()) return () => {};

  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;

  // Attempt to select an optimal natural voice for the requested locale
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    const matchedVoice =
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ||
      voices.find((v) => v.lang.includes("en") && !v.name.includes("Google") === false) ||
      voices[0];
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
  }

  utterance.onstart = onStart;
  utterance.onend = onEnd;
  utterance.onerror = (e) => {
    if (e.error !== "canceled" && e.error !== "interrupted") {
      console.warn("[SpeechSynthesis Error]:", e.error);
      onError(e);
    }
    onEnd();
  };

  window.speechSynthesis.speak(utterance);

  return () => {
    stopSpeaking();
  };
}

/**
 * Immediately stop any active SpeechSynthesis playback.
 */
export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.warn("Error cancelling speech:", e);
    }
  }
}
