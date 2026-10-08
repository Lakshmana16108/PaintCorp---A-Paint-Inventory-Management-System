import React, { useState, useEffect, useRef, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
 * Lightweight Markdown & Table Parser for Corp AI Floating Widget
 */
function MiniFormattedMessage({ content }) {
  if (!content) return null;

  const rawLines = content.split("\n");
  const chunks = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++;
      chunks.push({ type: "code", lang, code: codeLines.join("\n") });
      continue;
    }

    // 2. Table block
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

    // 3. Regular line
    chunks.push({ type: "line", text: line });
    i++;
  }

  return (
    <div className="corp-ai-mini-content" style={{ lineHeight: 1.55, fontSize: "0.865rem" }}>
      {chunks.map((chunk, cIdx) => {
        if (chunk.type === "code") {
          return (
            <div
              key={cIdx}
              style={{
                margin: "0.45rem 0",
                borderRadius: "6px",
                overflow: "hidden",
                border: "1px solid var(--border-color)",
                backgroundColor: "#0f172a",
                color: "#f8fafc"
              }}
            >
              {chunk.lang && (
                <div
                  style={{
                    padding: "0.2rem 0.6rem",
                    fontSize: "0.685rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    color: "#94a3b8",
                    borderBottom: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  {chunk.lang}
                </div>
              )}
              <pre
                style={{
                  margin: 0,
                  padding: "0.6rem",
                  overflowX: "auto",
                  fontFamily: "Consolas, Monaco, monospace",
                  fontSize: "0.785rem",
                  lineHeight: 1.4
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
                margin: "0.45rem 0",
                overflowX: "auto",
                borderRadius: "6px",
                border: "1px solid var(--border-color)"
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.78rem",
                  textAlign: "left"
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-color)" }}>
                    {headerRow.map((cell, hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          padding: "0.35rem 0.55rem",
                          fontWeight: 700,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {parseInlineMini(cell)}
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
                            padding: "0.35rem 0.55rem",
                            color: "var(--text-main)",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {parseInlineMini(cell)}
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
          return <div key={cIdx} style={{ height: "0.35rem" }} />;
        }

        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={cIdx}
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                marginTop: cIdx === 0 ? "0" : "0.55rem",
                marginBottom: "0.25rem",
                color: "var(--text-main)"
              }}
            >
              {parseInlineMini(trimmed.replace(/^###\s*/, ""))}
            </h4>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h3
              key={cIdx}
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                marginTop: cIdx === 0 ? "0" : "0.6rem",
                marginBottom: "0.3rem",
                color: "var(--text-main)"
              }}
            >
              {parseInlineMini(trimmed.replace(/^##\s*/, ""))}
            </h3>
          );
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div
              key={cIdx}
              style={{
                display: "flex",
                gap: "0.4rem",
                marginLeft: "0.35rem",
                marginBottom: "0.2rem"
              }}
            >
              <span style={{ color: "var(--primary)", fontWeight: 700 }}>•</span>
              <div style={{ flex: 1 }}>{parseInlineMini(trimmed.slice(2))}</div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div
              key={cIdx}
              style={{
                display: "flex",
                gap: "0.4rem",
                marginLeft: "0.35rem",
                marginBottom: "0.2rem"
              }}
            >
              <span style={{ color: "var(--primary)", fontWeight: 600, minWidth: "1rem" }}>
                {numMatch[1]}.
              </span>
              <div style={{ flex: 1 }}>{parseInlineMini(numMatch[2])}</div>
            </div>
          );
        }

        return (
          <p key={cIdx} style={{ margin: "0 0 0.35rem 0", color: "var(--text-main)" }}>
            {parseInlineMini(line)}
          </p>
        );
      })}
    </div>
  );
}

function parseInlineMini(text) {
  if (!text) return "";
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
            backgroundColor: "rgba(37, 99, 235, 0.08)",
            padding: "0.1rem 0.3rem",
            borderRadius: "4px",
            fontSize: "0.85em",
            fontFamily: "monospace",
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

const QUICK_PROMPTS = [
  "Check low stock",
  "Today's sales",
  "Top selling paints",
  "Recent orders",
  "Safety stock threshold"
];

function getDefaultWelcomeMessage() {
  return [
    {
      id: "welcome-fab-1",
      sender: "ai",
      text: "👋 Hi! I am **Corp AI**, your PaintCorp assistant.\n\nAsk me anything about paints, warehouse stock, sales metrics, or billing operations!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: "system"
    }
  ];
}

export default function CorpAIFloatingWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext) || {};
  const { theme } = useContext(ThemeContext) || {};

  // Check if currently on the full /corp-ai page
  const isFullAiPage = location.pathname === "/corp-ai" || location.pathname === "/ai";

  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [interimVoice, setInterimVoice] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Storage key matching Corp AI full page
  const storageKey = currentUser?.id
    ? `paintcorp_corp_ai_chat_${currentUser.id}`
    : currentUser?.email
    ? `paintcorp_corp_ai_chat_${currentUser.email}`
    : "paintcorp_corp_ai_chat_default";

  // Initial messages
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
      console.warn("Error reading stored chat in widget:", e);
    }
    return getDefaultWelcomeMessage();
  });

  // Re-sync with localStorage when user changes or window regains focus
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (e) {}
    };

    window.addEventListener("storage", handleSync);
    return () => window.removeEventListener("storage", handleSync);
  }, [storageKey]);

  // Save to localStorage whenever messages update
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch (e) {}
  }, [messages, storageKey]);

  // Auto-scroll when messages update or when widget opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages, loading]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  // Keyboard shortcut: Escape to close widget
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Don't render floating widget if user is already on the dedicated Corp AI page
  if (isFullAiPage) {
    return null;
  }

  // Handle toggling widget
  const handleToggle = () => {
    if (!isOpen) {
      setUnreadCount(0);
      setIsOpen(true);
    } else {
      setIsOpen(false);
      stopSpeaking();
      setSpeakingMsgId(null);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (textToSend, isVoice = false) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    setError(null);
    setInputMessage("");

    // Build conversation history
    const conversationHistory = messages.slice(-10).map((m) => ({
      sender: m.sender,
      text: m.text
    }));

    const userMessageId = `user-${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
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

        if (!isOpen) {
          setUnreadCount((c) => c + 1);
        }

        // Auto speak if voice triggered
        if (isVoice) {
          handleSpeak(aiMsgId, response.answer);
        }
      } else {
        throw new Error(response?.error || "Corp AI could not process the query.");
      }
    } catch (err) {
      console.error("Corp AI widget query error:", err);
      const errMsg = err.message || "Failed to get answer. Please check network.";
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: `⚠️ **Error**: ${errMsg}`,
          source: "system",
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Voice Input Toggle
  const handleToggleVoice = () => {
    if (!isSpeechRecognitionSupported()) {
      alert("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      setInterimVoice("");
      return;
    }

    try {
      stopSpeaking();
      setSpeakingMsgId(null);
      setInterimVoice("");

      const recognition = createSpeechRecognition({
        lang: "en-US",
        onStart: () => {
          setIsListening(true);
        },
        onInterimResult: (transcript) => {
          setInterimVoice(transcript);
        },
        onFinalResult: (finalTranscript) => {
          setIsListening(false);
          setInterimVoice("");
          handleSendMessage(finalTranscript, true);
        },
        onError: (errMsg) => {
          setIsListening(false);
          setInterimVoice("");
          setError(errMsg);
        },
        onEnd: () => {
          setIsListening(false);
          setInterimVoice("");
        }
      });

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start voice recognition:", err);
      setIsListening(false);
    }
  };

  // Text-to-speech
  const handleSpeak = (msgId, text) => {
    if (!isSpeechSynthesisSupported()) return;

    if (speakingMsgId === msgId) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }

    stopSpeaking();
    setSpeakingMsgId(msgId);
    speakText(text, {
      lang: "en-US",
      onEnd: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null)
    });
  };

  // Copy Message Text
  const handleCopy = (msgId, text) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  // Clear Chat History
  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear this Corp AI conversation?")) {
      stopSpeaking();
      const resetMsg = getDefaultWelcomeMessage();
      setMessages(resetMsg);
      try {
        localStorage.setItem(storageKey, JSON.stringify(resetMsg));
      } catch (e) {}
    }
  };

  // Navigate to full Corp AI page
  const handleOpenFullPage = () => {
    setIsOpen(false);
    navigate("/corp-ai");
  };

  return (
    <div className="corp-ai-widget-wrapper" id="corp-ai-widget-root">
      {/* Floating Action Button (FAB) Toggle */}
      <button
        id="corp-ai-fab-toggle"
        className={`corp-ai-fab ${isOpen ? "active" : ""}`}
        onClick={handleToggle}
        title={isOpen ? "Close Corp AI" : "Chat with Corp AI Assistant"}
        aria-label="Toggle Corp AI Assistant"
      >
        <span className="corp-ai-fab-pulse" />
        
        {isOpen ? (
          // Close Icon (X)
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          // Sparkle AI Icon
          <div className="corp-ai-fab-icon-container">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" fill="currentColor" fillOpacity="0.15" />
              <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            {unreadCount > 0 && (
              <span className="corp-ai-fab-badge" id="corp-ai-unread-badge">
                {unreadCount}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Floating Chat Window Card */}
      {isOpen && (
        <div
          id="corp-ai-floating-card"
          className="corp-ai-floating-card"
          role="dialog"
          aria-label="Corp AI Chat Window"
        >
          {/* Header */}
          <div className="corp-ai-card-header">
            <div className="corp-ai-header-left">
              <div className="corp-ai-avatar-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
                  <rect x="4" y="8" width="16" height="12" rx="4"></rect>
                  <line x1="9" y1="13" x2="9" y2="13.01"></line>
                  <line x1="15" y1="13" x2="15" y2="13.01"></line>
                  <line x1="9" y1="17" x2="15" y2="17"></line>
                </svg>
                <span className="corp-ai-online-indicator" />
              </div>
              <div>
                <div className="corp-ai-header-title">Corp AI</div>
                <div className="corp-ai-header-subtitle">Live Inventory & ERP Assistant</div>
              </div>
            </div>

            <div className="corp-ai-header-actions">
              {/* Fullscreen / Open Page Button */}
              <button
                type="button"
                className="corp-ai-header-btn"
                onClick={handleOpenFullPage}
                title="Open full Corp AI page"
                id="corp-ai-widget-expand-btn"
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>

              {/* Clear History Button */}
              <button
                type="button"
                className="corp-ai-header-btn"
                onClick={handleClearHistory}
                title="Clear chat history"
                id="corp-ai-widget-clear-btn"
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {/* Close Button */}
              <button
                type="button"
                className="corp-ai-header-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize widget"
                id="corp-ai-widget-close-btn"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Prompts Carousel / Chips */}
          <div className="corp-ai-chips-container" id="corp-ai-chips-list">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                className="corp-ai-chip"
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="corp-ai-messages-container" id="corp-ai-messages-scroll">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id}
                  className={`corp-ai-message-row ${isUser ? "user" : "ai"}`}
                  id={`widget-msg-${msg.id}`}
                >
                  <div className={`corp-ai-message-bubble ${isUser ? "user" : "ai"} ${msg.isError ? "error" : ""}`}>
                    <MiniFormattedMessage content={msg.text} />

                    <div className="corp-ai-bubble-footer">
                      <span className="corp-ai-time-label">{msg.timestamp}</span>

                      {!isUser && (
                        <div className="corp-ai-bubble-actions">
                          {/* Speak Button */}
                          {isSpeechSynthesisSupported() && (
                            <button
                              type="button"
                              className={`corp-ai-msg-action-btn ${speakingMsgId === msg.id ? "speaking" : ""}`}
                              onClick={() => handleSpeak(msg.id, msg.text)}
                              title={speakingMsgId === msg.id ? "Stop reading" : "Read aloud"}
                            >
                              {speakingMsgId === msg.id ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                              ) : (
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                              )}
                            </button>
                          )}

                          {/* Copy Button */}
                          <button
                            type="button"
                            className="corp-ai-msg-action-btn"
                            onClick={() => handleCopy(msg.id, msg.text)}
                            title={copiedId === msg.id ? "Copied!" : "Copy answer"}
                          >
                            {copiedId === msg.id ? (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Listening Banner */}
            {isListening && (
              <div className="corp-ai-listening-row" id="corp-ai-listening-box">
                <div className="corp-ai-listening-bubble">
                  <div className="corp-ai-pulse-wave">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>{interimVoice || "Listening... speak now into your microphone"}</span>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="corp-ai-loading-row" id="corp-ai-loading-box">
                <div className="corp-ai-typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="corp-ai-typing-text">Corp AI is querying MySQL database...</span>
              </div>
            )}

            {/* Error Message */}
            {error && !loading && (
              <div className="corp-ai-widget-error-banner" id="corp-ai-error-banner">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="corp-ai-card-footer">
            <form
              className="corp-ai-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              {/* Voice Input Toggle Button */}
              <button
                type="button"
                id="corp-ai-widget-voice-btn"
                className={`corp-ai-input-action-btn ${isListening ? "listening" : ""}`}
                onClick={handleToggleVoice}
                title={isListening ? "Stop listening" : "Speak to Corp AI"}
              >
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              {/* Text Input */}
              <input
                ref={inputRef}
                type="text"
                id="corp-ai-widget-input"
                className="corp-ai-text-input"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about paints, stock, orders..."
                disabled={loading}
              />

              {/* Send Button */}
              <button
                type="submit"
                id="corp-ai-widget-send-btn"
                className="corp-ai-send-btn"
                disabled={!inputMessage.trim() || loading}
                title="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>

            <div className="corp-ai-card-footnote">
              Connected to PaintCorp DB • Press Enter to send
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
