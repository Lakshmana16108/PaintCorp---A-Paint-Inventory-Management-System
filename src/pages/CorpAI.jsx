import React, { useState, useEffect, useRef, useContext } from "react";
import { api } from "../services/api";
import { ThemeContext } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  createSpeechRecognition,
  speakText,
  stopSpeaking
} from "../utils/voiceAssistant";

/**
 * Format markdown-like text safely into clean React elements.
 * Supports bold, inline code, headers, bullets, and line breaks without unsafe HTML.
 */
/**
 * Format markdown-like text safely into clean React elements.
 * Supports bold, inline code, multi-line code blocks, markdown tables, headers, bullets, and line breaks without unsafe HTML.
 */
function FormattedMessage({ content }) {
  if (!content) return null;

  const rawLines = content.split("\n");
  const chunks = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Code Block (```)
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // skip closing ```
      chunks.push({ type: "code", lang, code: codeLines.join("\n") });
      continue;
    }

    // 2. Markdown Table (| ... |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|", 1)) {
      const tableLines = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith("|") && rawLines[i].trim().endsWith("|")) {
        tableLines.push(rawLines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        chunks.push({ type: "table", lines: tableLines });
        continue;
      } else {
        chunks.push({ type: "line", text: tableLines[0] });
        continue;
      }
    }

    // 3. Normal line
    chunks.push({ type: "line", text: line });
    i++;
  }

  return (
    <div className="corp-ai-message-content" style={{ lineHeight: 1.6, fontSize: "0.925rem" }}>
      {chunks.map((chunk, cIdx) => {
        if (chunk.type === "code") {
          return (
            <div
              key={cIdx}
              style={{
                margin: "0.6rem 0",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid var(--border-color)",
                backgroundColor: "#1e293b",
                color: "#f8fafc"
              }}
            >
              {chunk.lang && (
                <div
                  style={{
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    color: "#94a3b8",
                    borderBottom: "1px solid rgba(255,255,255,0.1)"
                  }}
                >
                  {chunk.lang}
                </div>
              )}
              <pre
                style={{
                  margin: 0,
                  padding: "0.75rem",
                  overflowX: "auto",
                  fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                  fontSize: "0.85rem",
                  lineHeight: 1.45
                }}
              >
                <code>{chunk.code}</code>
              </pre>
            </div>
          );
        }

        if (chunk.type === "table") {
          const rows = chunk.lines.map((l) =>
            l
              .split("|")
              .slice(1, -1)
              .map((c) => c.trim())
          );
          const headerRow = rows[0] || [];
          const dataRows = rows.slice(1).filter((r) => !r.every((cell) => /^[:\s-]+$/.test(cell)));

          return (
            <div
              key={cIdx}
              style={{
                margin: "0.65rem 0",
                overflowX: "auto",
                borderRadius: "8px",
                border: "1px solid var(--border-color)"
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.85rem",
                  textAlign: "left"
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-main)", borderBottom: "1px solid var(--border-color)" }}>
                    {headerRow.map((cell, hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontWeight: 700,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {renderInlineStyles(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: rIdx < dataRows.length - 1 ? "1px solid var(--border-color)" : "none",
                        backgroundColor: rIdx % 2 === 1 ? "rgba(0,0,0,0.02)" : "transparent"
                      }}
                    >
                      {row.map((cell, cdIdx) => (
                        <td
                          key={cdIdx}
                          style={{
                            padding: "0.45rem 0.75rem",
                            color: "var(--text-main)"
                          }}
                        >
                          {renderInlineStyles(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const line = chunk.text;
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={cIdx} style={{ height: "0.45rem" }} />;
        }

        // Header 3 (### )
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={cIdx}
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                marginTop: cIdx === 0 ? "0" : "0.75rem",
                marginBottom: "0.35rem",
                color: "var(--text-main)"
              }}
            >
              {renderInlineStyles(trimmed.replace(/^###\s*/, ""))}
            </h4>
          );
        }

        // Header 2 (## )
        if (trimmed.startsWith("## ")) {
          return (
            <h3
              key={cIdx}
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                marginTop: cIdx === 0 ? "0" : "0.85rem",
                marginBottom: "0.4rem",
                color: "var(--text-main)"
              }}
            >
              {renderInlineStyles(trimmed.replace(/^##\s*/, ""))}
            </h3>
          );
        }

        // Bullet point (- or * )
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div
              key={cIdx}
              style={{
                display: "flex",
                gap: "0.5rem",
                marginLeft: "0.5rem",
                marginBottom: "0.25rem"
              }}
            >
              <span style={{ color: "var(--primary)", fontWeight: 700 }}>•</span>
              <div>{renderInlineStyles(trimmed.replace(/^[-*]\s+/, ""))}</div>
            </div>
          );
        }

        // Numbered list item (e.g. 1. )
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div
              key={cIdx}
              style={{
                display: "flex",
                gap: "0.5rem",
                marginLeft: "0.5rem",
                marginBottom: "0.25rem"
              }}
            >
              <span style={{ color: "var(--primary)", fontWeight: 600, minWidth: "1.25rem" }}>
                {numMatch[1]}.
              </span>
              <div>{renderInlineStyles(numMatch[2])}</div>
            </div>
          );
        }

        // Regular paragraph line
        return (
          <p key={cIdx} style={{ margin: "0 0 0.4rem 0", color: "var(--text-main)" }}>
            {renderInlineStyles(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parses bold (**text**), italics (*text*), and code (`code`) into React elements
 */
function renderInlineStyles(text) {
  if (!text) return "";

  // Split on bold (**...**) and inline code (`...`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} style={{ fontWeight: 700, color: "var(--text-main)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          style={{
            backgroundColor: "var(--bg-main)",
            padding: "0.15rem 0.35rem",
            borderRadius: "4px",
            fontSize: "0.85em",
            fontFamily: "monospace",
            border: "1px solid var(--border-color)",
            color: "var(--primary)"
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={index} style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function getDefaultWelcomeMessage() {
  return [
    {
      id: "welcome-1",
      sender: "ai",
      text: `Hello! I am **Corp AI**, the official intelligent assistant for PaintCorp.\n\nI can help you monitor live inventory, check warehouse stock, review sales analytics, look up customer orders, and clear doubts about PaintCorp operations.\n\n💡 **Popular Questions:**\n- *"Which paints are low in stock?"*\n- *"What was today's sales and revenue?"*\n- *"How does the safety stock threshold work?"*\n- *"What happens when an order is cancelled?"*\n- *"How does billing prevent negative stock?"*`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: "system"
    }
  ];
}

const QUICK_QUESTIONS = [
  "Check low stock",
  "Today's sales",
  "Top selling paints",
  "How does low stock threshold work?",
  "What happens when an order is cancelled?",
  "How does billing prevent negative stock?",
  "Can I modify an order once submitted?",
  "Why can't I find an order by invoice?",
  "Recent orders"
];

export default function CorpAI() {
  const { theme } = useContext(ThemeContext) || {};
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const { currentUser } = useContext(AuthContext) || {};

  // Storage key scoped to user for persistent auto-saved chat
  const storageKey = currentUser?.id
    ? `paintcorp_corp_ai_chat_${currentUser.id}`
    : currentUser?.email
    ? `paintcorp_corp_ai_chat_${currentUser.email}`
    : "paintcorp_corp_ai_chat_default";

  // Initial state: auto-restore saved messages from localStorage if available
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Error reading auto-saved Corp AI chat:", e);
    }
    return getDefaultWelcomeMessage();
  });

  // Re-sync if user account changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (e) {}
  }, [storageKey]);

  // Auto-save messages to localStorage whenever messages change
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch (e) {
      console.warn("Error auto-saving Corp AI chat:", e);
    }
  }, [messages, storageKey]);

  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Voice Module States
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("paintcorp_voice_mode_enabled");
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });
  const [voiceState, setVoiceState] = useState("idle"); // "idle" | "listening" | "processing" | "speaking" | "error"
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState(null);
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("paintcorp_voice_mode_enabled", JSON.stringify(voiceModeEnabled));
    } catch (e) {}
  }, [voiceModeEnabled]);

  // Clean up recognition and speech on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      stopSpeaking();
    };
  }, []);

  // Stop any active speech playback
  const handleStopSpeaking = () => {
    stopSpeaking();
    setSpeakingMsgId(null);
    if (voiceState === "speaking") {
      setVoiceState("idle");
    }
  };

  // Speak a specific AI message aloud
  const handleSpeakMessage = (msgId, text) => {
    if (speakingMsgId === msgId) {
      handleStopSpeaking();
      return;
    }

    handleStopSpeaking();
    setSpeakingMsgId(msgId);
    setVoiceState("speaking");

    speakText(text, {
      lang: voiceLang,
      onStart: () => {
        setSpeakingMsgId(msgId);
        setVoiceState("speaking");
      },
      onEnd: () => {
        setSpeakingMsgId((cur) => (cur === msgId ? null : cur));
        setVoiceState((cur) => (cur === "speaking" ? "idle" : cur));
      },
      onError: () => {
        setSpeakingMsgId((cur) => (cur === msgId ? null : cur));
        setVoiceState((cur) => (cur === "speaking" ? "idle" : cur));
      }
    });
  };

  // Toggle speech recognition on/off
  const handleToggleVoiceInput = () => {
    if (voiceState === "speaking" || speakingMsgId) {
      handleStopSpeaking();
    }

    if (voiceState === "listening") {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      setVoiceState("idle");
      setVoiceTranscript("");
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setVoiceError("Voice input is not supported in this browser. You can continue using text chat.");
      setVoiceState("error");
      return;
    }

    setVoiceError(null);
    setVoiceTranscript("");

    try {
      const recognition = createSpeechRecognition({
        lang: voiceLang,
        onStart: () => {
          setVoiceState("listening");
          setVoiceTranscript("");
          setVoiceError(null);
        },
        onInterimResult: (interimText) => {
          setVoiceTranscript(interimText);
        },
        onFinalResult: (finalText) => {
          setVoiceTranscript(finalText);
          setVoiceState("processing");
          // Requirement 2: Send recognized speech to Corp AI without adding USER message to permanent chat!
          handleSendMessage(finalText, { isVoice: true });
        },
        onError: (errMsg) => {
          setVoiceError(errMsg);
          setVoiceState("error");
        },
        onEnd: (hasFinal) => {
          if (!hasFinal) {
            setVoiceState((cur) => (cur === "listening" ? "idle" : cur));
          }
        }
      });

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
      setVoiceError(err.message || "Failed to initialize microphone.");
      setVoiceState("error");
    }
  };

  // Auto-scroll to latest message within the chat container only
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, voiceState]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Copy message text to clipboard
  const handleCopyText = (msgId, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(msgId);
      setTimeout(() => {
        setCopiedId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    }).catch((err) => {
      console.warn("Failed to copy message to clipboard:", err);
    });
  };

  // Regenerate last AI response
  const handleRegenerate = () => {
    if (loading || messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
    if (lastUserMsg && lastUserMsg.text) {
      handleSendMessage(lastUserMsg.text);
    }
  };

  // Handle send message (shared engine for both text and voice modes)
  const handleSendMessage = async (textToSend, options = {}) => {
    const isVoice = Boolean(options.isVoice);
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    setError(null);
    setInputMessage("");

    // Build session conversation history
    const conversationHistory = messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      text: m.text
    }));

    // Requirement 2 & 3:
    // If NOT a voice query, add USER message to permanent message list.
    // If it IS a voice query, DO NOT add USER message to permanent message list!
    if (!isVoice) {
      const userMessageId = `user-${Date.now()}`;
      const userMsg = {
        id: userMessageId,
        sender: "user",
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setLoading(true);

    try {
      const response = await api.sendCorpAIMessage(query, conversationHistory);

      if (response && response.success) {
        const aiMsgId = `ai-${Date.now()}`;
        const aiMsg = {
          id: aiMsgId,
          sender: "ai",
          text: response.answer,
          source: response.source || "general",
          toolUsed: response.toolUsed,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, aiMsg]);

        // Clear temporary voice transcript
        setVoiceTranscript("");
        setVoiceState("idle");

        // Requirement 10: Speak the AI answer aloud if voice query or Voice Mode is enabled
        if (isVoice || voiceModeEnabled) {
          handleSpeakMessage(aiMsgId, response.answer);
        }
      } else {
        throw new Error(response?.error || "Corp AI encountered an error processing your request.");
      }
    } catch (err) {
      console.error("Corp AI request error:", err);
      const errorText = err.message || "Unable to retrieve an answer right now. Please try again.";
      setError(errorText);

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: `⚠️ **Error**: ${errorText}`,
          source: "system",
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
      setVoiceState("idle");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat conversation and purge auto-saved history
  const handleClearChat = () => {
    const welcome = [
      {
        id: `welcome-${Date.now()}`,
        sender: "ai",
        text: `Chat cleared. How can I assist you with PaintCorp?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        source: "system"
      }
    ];
    setMessages(welcome);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn("Error purging auto-saved Corp AI chat:", e);
    }
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div
      id="corp-ai-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        height: "calc(100vh - var(--navbar-height) - 5.5rem)",
        maxHeight: "calc(100vh - var(--navbar-height) - 5.5rem)"
      }}
    >
      {/* Header Card */}
      <div
        className="card"
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: 0,
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "var(--primary)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
                Corp AI
              </h1>
              <span
                style={{
                  fontSize: "0.725rem",
                  fontWeight: 600,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  backgroundColor: "var(--success-bg)",
                  color: "var(--success-text)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "var(--success)",
                    display: "inline-block"
                  }}
                />
                Live MySQL Connected
              </span>

              <span
                style={{
                  fontSize: "0.725rem",
                  fontWeight: 600,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  backgroundColor: "var(--info-bg)",
                  color: "var(--info-text)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
                title="Chat messages are automatically saved to your browser session"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Auto-Saved
              </span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0.15rem 0 0 0" }}>
              PaintCorp intelligent assistant – live inventory, orders, sales analysis, and system guidance
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Voice Mode Toggle */}
          <button
            type="button"
            className={`btn btn-sm ${voiceModeEnabled ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setVoiceModeEnabled((prev) => {
                const next = !prev;
                if (!next) handleStopSpeaking();
                return next;
              });
            }}
            id="corp-ai-voice-mode-toggle"
            title={voiceModeEnabled ? "Voice Mode is ON (AI responses speak aloud)" : "Voice Mode is OFF (Text only)"}
            style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>Voice: {voiceModeEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Voice Language Selector */}
          <select
            value={voiceLang}
            onChange={(e) => setVoiceLang(e.target.value)}
            className="form-input"
            style={{
              padding: "0.2rem 0.5rem",
              fontSize: "0.75rem",
              borderRadius: "6px",
              height: "32px",
              cursor: "pointer",
              fontWeight: 500
            }}
            title="Speech Recognition & Voice Output Language"
          >
            <option value="en-US">English (US)</option>
          </select>

          {messages.some((m) => m.sender === "user") && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRegenerate}
              disabled={loading}
              id="corp-ai-regenerate-btn"
              title="Regenerate last response"
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleClearChat}
            id="corp-ai-clear-btn"
            title="Clear current conversation"
            style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Chat
          </button>
        </div>
      </div>

      {/* Main Chat Card Container */}
      <div
        className="card"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          marginBottom: 0
        }}
        id="corp-ai-chat-card"
      >
        {/* Quick Question Chips Banner */}
        <div
          style={{
            padding: "0.65rem 1.25rem",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-main)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            overflowX: "auto",
            scrollbarWidth: "none",
            minWidth: 0,
            maxWidth: "100%",
            flexShrink: 0
          }}
          id="corp-ai-quick-chips"
        >
          <span style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
            Suggested:
          </span>
          {QUICK_QUESTIONS.map((question, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSendMessage(question)}
              disabled={loading}
              style={{
                fontSize: "0.775rem",
                padding: "0.3rem 0.75rem",
                borderRadius: "9999px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-main)",
                cursor: loading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
                fontWeight: 500,
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.color = "var(--primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.color = "var(--text-main)";
                }
              }}
            >
              {question}
            </button>
          ))}
        </div>

        {/* Scrollable Messages Area */}
        <div
          ref={messagesContainerRef}
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflowY: "auto",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem"
          }}
          id="corp-ai-messages-container"
        >
          {messages.map((msg) => {
            const isUser = msg.sender === "user";

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  width: "100%"
                }}
              >
                {/* Message Header (Sender name + Source Pill Badge + Timestamp + Copy Action) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem",
                    fontSize: "0.75rem",
                    color: "var(--text-muted)"
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{isUser ? "You" : "Corp AI"}</span>

                  {!isUser && msg.source && (
                    <span
                      style={{
                        fontSize: "0.685rem",
                        fontWeight: 600,
                        padding: "0.1rem 0.5rem",
                        borderRadius: "9999px",
                        backgroundColor:
                          msg.source === "inventory"
                            ? "var(--info-bg)"
                            : msg.source === "sales"
                            ? "var(--success-bg)"
                            : msg.source === "orders"
                            ? "var(--warning-bg)"
                            : msg.source === "system"
                            ? "rgba(99, 102, 241, 0.12)"
                            : "var(--bg-card)",
                        color:
                          msg.source === "inventory"
                            ? "var(--info-text)"
                            : msg.source === "sales"
                            ? "var(--success-text)"
                            : msg.source === "orders"
                            ? "var(--warning-text)"
                            : msg.source === "system"
                            ? "#6366f1"
                            : "var(--text-muted)",
                        border: "1px solid var(--border-color)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem"
                      }}
                    >
                      {msg.source === "inventory"
                        ? "Source: Inventory"
                        : msg.source === "sales"
                        ? "Source: Sales Analysis"
                        : msg.source === "orders"
                        ? "Source: Orders"
                        : msg.source === "system"
                        ? "Source: PaintCorp Knowledge"
                        : "General"}
                    </span>
                  )}

                  <span>{msg.timestamp}</span>

                  {!isUser && !msg.isError && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      title="Copy response to clipboard"
                      style={{
                        background: "none",
                        border: "none",
                        padding: "0.1rem 0.35rem",
                        color: copiedId === msg.id ? "var(--success)" : "var(--text-muted)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.7rem",
                        borderRadius: "4px"
                      }}
                    >
                      {copiedId === msg.id ? (
                        <>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span style={{ fontWeight: 600 }}>Copied</span>
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}

                  {!isUser && !msg.isError && (
                    <button
                      type="button"
                      onClick={() => handleSpeakMessage(msg.id, msg.text)}
                      title={speakingMsgId === msg.id ? "Stop speaking this response" : "Listen to this response aloud"}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "0.1rem 0.35rem",
                        color: speakingMsgId === msg.id ? "var(--primary)" : "var(--text-muted)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.7rem",
                        borderRadius: "4px",
                        fontWeight: speakingMsgId === msg.id ? 600 : 400
                      }}
                    >
                      {speakingMsgId === msg.id ? (
                        <>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--danger)" }}>
                            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                          </svg>
                          <span style={{ color: "var(--danger)" }}>Stop</span>
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: isUser ? "75%" : "85%",
                    padding: "0.85rem 1.15rem",
                    borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    backgroundColor: isUser
                      ? "var(--primary)"
                      : msg.isError
                      ? "var(--danger-bg)"
                      : isDark
                      ? "#263345"
                      : "#F1F5F9",
                    color: isUser ? "#FFFFFF" : msg.isError ? "var(--danger-text)" : "var(--text-main)",
                    boxShadow: "var(--shadow-sm)",
                    wordBreak: "break-word"
                  }}
                >
                  {isUser ? (
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "0.925rem" }}>
                      {msg.text}
                    </div>
                  ) : (
                    <FormattedMessage content={msg.text} />
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.25rem"
              }}
              id="corp-ai-loading"
            >
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Corp AI is querying MySQL & thinking...
              </div>
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "16px 16px 16px 4px",
                  backgroundColor: isDark ? "#263345" : "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--primary)",
                    animation: "pulse 1s infinite alternate"
                  }}
                />
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--primary)",
                    animation: "pulse 1s infinite alternate",
                    animationDelay: "0.2s"
                  }}
                />
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--primary)",
                    animation: "pulse 1s infinite alternate",
                    animationDelay: "0.4s"
                  }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Temporary Voice State Banner (Listening / Processing / Speaking / Error) */}
        {voiceState === "listening" && (
          <div
            style={{
              padding: "0.6rem 1.25rem",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              borderTop: "1px solid rgba(239, 68, 68, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem"
            }}
            id="corp-ai-voice-listening-banner"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, overflow: "hidden" }}>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "var(--danger)",
                  boxShadow: "0 0 8px rgba(239, 68, 68, 0.8)",
                  animation: "pulse 1s infinite alternate",
                  flexShrink: 0
                }}
              />
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--danger)" }}>
                Listening...
              </span>
              <span
                style={{
                  fontSize: "0.85rem",
                  fontStyle: "italic",
                  color: "var(--text-main)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                "{voiceTranscript || "Speak your question into your microphone..."}"
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleToggleVoiceInput}
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
            >
              Cancel
            </button>
          </div>
        )}

        {voiceState === "processing" && (
          <div
            style={{
              padding: "0.6rem 1.25rem",
              backgroundColor: "rgba(14, 165, 233, 0.08)",
              borderTop: "1px solid rgba(14, 165, 233, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem"
            }}
            id="corp-ai-voice-processing-banner"
          >
            <span
              style={{
                width: "14px",
                height: "14px",
                border: "2px solid var(--primary)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                display: "inline-block"
              }}
            />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>
              Processing voice query:
            </span>
            <span style={{ fontSize: "0.85rem", fontStyle: "italic", color: "var(--text-main)" }}>
              "{voiceTranscript}"
            </span>
          </div>
        )}

        {voiceState === "speaking" && (
          <div
            style={{
              padding: "0.5rem 1.25rem",
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              borderTop: "1px solid rgba(16, 185, 129, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
            id="corp-ai-voice-speaking-banner"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: "var(--success)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--success)" }}>
                Corp AI is speaking aloud...
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleStopSpeaking}
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
            >
              Stop Speaking
            </button>
          </div>
        )}

        {voiceState === "error" && voiceError && (
          <div
            style={{
              padding: "0.6rem 1.25rem",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              borderTop: "1px solid rgba(239, 68, 68, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem"
            }}
            id="corp-ai-voice-error-banner"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "var(--danger)", fontSize: "1rem" }}>⚠️</span>
              <span style={{ fontSize: "0.85rem", color: "var(--danger-text)" }}>{voiceError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setVoiceError(null);
                setVoiceState("idle");
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.9rem" }}
              title="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-card)",
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexShrink: 0
          }}
          id="corp-ai-input-bar"
        >
          {/* Microphone Voice Button */}
          <button
            type="button"
            onClick={handleToggleVoiceInput}
            id="corp-ai-mic-btn"
            title={
              voiceState === "listening"
                ? "Listening... Click to stop"
                : voiceState === "speaking"
                ? "Speaking... Click to stop"
                : "Speak to Corp AI (Voice Input)"
            }
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              border: voiceState === "listening" ? "2px solid var(--danger)" : "1px solid var(--border-color)",
              backgroundColor:
                voiceState === "listening"
                  ? "var(--danger)"
                  : voiceState === "speaking"
                  ? "var(--success)"
                  : "var(--bg-main)",
              color: voiceState === "listening" || voiceState === "speaking" ? "#FFFFFF" : "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: voiceState === "listening" ? "0 0 10px rgba(239, 68, 68, 0.5)" : "none",
              flexShrink: 0
            }}
          >
            {voiceState === "listening" ? (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            ) : voiceState === "processing" ? (
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }}
              />
            ) : voiceState === "speaking" ? (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            className="form-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Corp AI about paints, stock, sales, revenue, orders, or how to use PaintCorp..."
            disabled={loading}
            style={{
              flex: 1,
              minWidth: 0,
              resize: "none",
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              minHeight: "44px",
              maxHeight: "120px",
              lineHeight: 1.4,
              fontSize: "0.925rem"
            }}
            id="corp-ai-input"
          />

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSendMessage()}
            disabled={loading || !inputMessage.trim()}
            id="corp-ai-send-btn"
            style={{
              minWidth: "85px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              borderRadius: "10px",
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            <span>Send</span>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
