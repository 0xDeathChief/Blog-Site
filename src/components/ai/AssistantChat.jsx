"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Copy,
  Eye,
  EyeOff,
  Languages,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

const taskOptions = [
  ["chat", "Ask a question"],
  ["concept", "Explain a concept"],
  ["simplify", "Simplify an explanation"],
  ["command", "Explain a command"],
  ["code", "Explain code"],
  ["vulnerability", "Understand a vulnerability"],
  ["tool", "Learn about a security tool"],
  ["example", "Give a safe example"],
  ["notes", "Create study notes"],
  ["summarize", "Summarize text or article"],
  ["quiz", "Make a quiz"],
  ["terminology", "Explain a term"],
  ["roadmap", "Build a learning roadmap"],
];
const teachingModes = [
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
  ["deep_dive", "Technical deep dive"],
  ["practical_lab", "Practical lab (safe, offline)"],
];
const languages = [
  ["english", "English"],
  ["bangla", "বাংলা"],
  ["bangla_english", "বাংলা + English terms"],
];
const translationStyles = [
  ["simple_bangla", "Simple Bangla"],
  ["professional_bangla", "Professional Bangla"],
  ["bangla_technical", "Bangla + English technical terms"],
];

export default function AssistantChat({ articleSlug, selection = "" }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [question, setQuestion] = useState("");
  const [task, setTask] = useState("chat");
  const [mode, setMode] = useState("beginner");
  const [language, setLanguage] = useState("english");
  const [translationTarget, setTranslationTarget] = useState("bangla");
  const [translationStyle, setTranslationStyle] = useState("bangla_technical");
  const [responseTranslations, setResponseTranslations] = useState({});
  const [translatingMessageId, setTranslatingMessageId] = useState("");
  const [translationError, setTranslationError] = useState("");
  const [selectedTranslation, setSelectedTranslation] = useState(null);
  const [showSelectedTranslation, setShowSelectedTranslation] = useState(false);
  const [translatingSelection, setTranslatingSelection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endOfMessagesRef = useRef(null);
  const currentSelectionRef = useRef(selection);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    currentSelectionRef.current = selection;
  }, [selection]);

  async function sendPrompt({
    prompt,
    task: selectedTask = task,
    selectedText = "",
    priorMessages = messages,
    regenerate = false,
  }) {
    if (busy) return false;
    const historyMessages = regenerate ? priorMessages.slice(0, -1) : priorMessages;
    const visibleMessages = regenerate ? priorMessages : [
      ...priorMessages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        task: selectedTask,
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(visibleMessages);
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const history = historyMessages.slice(-4).map((message) => ({
        role: message.role,
        content: message.content.slice(0, 1500),
      }));
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          task: selectedTask,
          mode,
          language,
          articleSlug,
          selection: selectedText || undefined,
          history,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The assistant could not answer right now.");
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        task: selectedTask,
        createdAt: result.createdAt,
      };
      const completedMessages = [...visibleMessages, assistantMessage];
      setMessages(completedMessages);
      try {
        const historyResponse = await fetch("/api/reader/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: conversationId || undefined,
            title: (completedMessages.find((message) => message.role === "user")?.content ?? "Learning conversation").slice(0, 120),
            messages: completedMessages,
          }),
        });
        const historyResult = await historyResponse.json();
        if (historyResponse.status === 401) {
          setNotice("Sign in to save this conversation to your history.");
        } else if (!historyResponse.ok) {
          setNotice(historyResult.error || "Your answer is ready, but conversation history could not be saved.");
        } else {
          setConversationId(historyResult.id);
        }
      } catch {
        setNotice("Your answer is ready, but conversation history could not be saved.");
      }
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not answer right now.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    setQuestion("");
    const sent = await sendPrompt({ prompt, selectedText: selectionTooLong ? "" : selection });
    if (!sent) setQuestion((currentQuestion) => currentQuestion || prompt);
  }

  function askAboutSelection(action) {
    const prompts = {
      selection_explain: "Explain this selected passage in clear, beginner-friendly language.",
      selection_simplify: "Simplify this selected passage without losing its technical meaning.",
      selection_code: "Explain this selected code or command and identify any risky behavior.",
    };
    sendPrompt({
      prompt: prompts[action],
      task: action,
      selectedText: selection,
    });
  }

  function regenerateLastAnswer() {
    if (busy || messages.length < 2) return;
    const lastMessage = messages[messages.length - 1];
    const userMessage = messages[messages.length - 2];
    if (lastMessage.role !== "assistant" || userMessage.role !== "user") return;
    sendPrompt({
      prompt: userMessage.content,
      task: userMessage.task ?? task,
      priorMessages: messages.slice(0, -1),
      regenerate: true,
    });
  }

  async function copyAnswer(content) {
    try {
      await navigator.clipboard.writeText(content);
      setNotice("Answer copied.");
    } catch {
      setNotice("Could not copy to the clipboard. Select and copy the answer instead.");
    }
  }

  async function translateResponse(message) {
    const current = responseTranslations[message.id];
    if (
      current
      && current.targetLanguage === translationTarget
      && current.style === translationStyle
    ) {
      setResponseTranslations((translations) => ({
        ...translations,
        [message.id]: { ...current, visible: !current.visible },
      }));
      return;
    }

    setTranslatingMessageId(message.id);
    setTranslationError("");
    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "response",
          text: message.content,
          targetLanguage: translationTarget,
          style: translationStyle,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to translate this response.");
      setResponseTranslations((translations) => ({
        ...translations,
        [message.id]: {
          text: result.translation,
          targetLanguage: translationTarget,
          style: translationStyle,
          visible: true,
        },
      }));
    } catch (requestError) {
      setTranslationError(requestError instanceof Error ? requestError.message : "Unable to translate this response.");
    } finally {
      setTranslatingMessageId("");
    }
  }

  async function translateSelectedText() {
    if (!articleSlug || !selection || selection.length > 12000 || translatingSelection) return;
    const sourceSelection = selection;
    setTranslatingSelection(true);
    setTranslationError("");
    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "selection",
          articleSlug,
          selection: sourceSelection,
          targetLanguage: translationTarget,
          style: translationStyle,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to translate the selected text.");
      if (currentSelectionRef.current === sourceSelection) {
        setSelectedTranslation({
          text: result.translation,
          targetLanguage: translationTarget,
          style: translationStyle,
          unchanged: Boolean(result.unchanged),
          sourceSelection,
        });
        setShowSelectedTranslation(true);
      }
    } catch (requestError) {
      setTranslationError(requestError instanceof Error ? requestError.message : "Unable to translate the selected text.");
    } finally {
      setTranslatingSelection(false);
    }
  }

  async function clearConversation() {
    setError("");
    setNotice("");
    if (conversationId) {
      try {
        const response = await fetch(`/api/reader/conversations/${conversationId}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          const result = await response.json();
          throw new Error(result.error || "Unable to clear the saved conversation.");
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to clear the saved conversation.");
        return;
      }
    }
    setConversationId("");
    setMessages([]);
    setTranslationError("");
    setResponseTranslations({});
    setSelectedTranslation(null);
    setNotice("Conversation cleared.");
  }

  const selectionTooLong = selection.length > 6000;
  const currentSelectedTranslation = selectedTranslation?.sourceSelection === selection
    ? selectedTranslation
    : null;

  return (
    <section className="assistant-chat-card" aria-label="Cybersecurity learning assistant">
      <header className="assistant-chat-header">
        <div className="assistant-title">
          <span className="assistant-icon"><Bot size={19} /></span>
          <div>
            <h2>Learning assistant</h2>
            <p>Local AI · Answers stay on your configured server</p>
          </div>
        </div>
        <button className="assistant-icon-button" type="button" onClick={clearConversation} disabled={busy || Boolean(translatingMessageId) || translatingSelection || (!messages.length && !notice)} aria-label="Clear conversation" title="Clear conversation">
          <Trash2 size={16} />
        </button>
      </header>

      <div className="assistant-controls">
        <label>
          <span>Learning task</span>
          <select value={task} onChange={(event) => setTask(event.target.value)}>
            {taskOptions.filter(([value]) => value !== "article_question" || articleSlug).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
            {articleSlug && <option value="article_question">Ask about this article</option>}
          </select>
        </label>
        <label>
          <span>Teaching mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            {teachingModes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            {languages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="assistant-translation-settings">
        <label>
          <span>Translate responses to</span>
          <select value={translationTarget} onChange={(event) => setTranslationTarget(event.target.value)}>
            <option value="bangla">Bangla</option>
            <option value="english">English</option>
          </select>
        </label>
        <label>
          <span>Bangla translation style</span>
          <select value={translationStyle} onChange={(event) => setTranslationStyle(event.target.value)} disabled={translationTarget === "english"}>
            {translationStyles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {selection && (
        <div className="assistant-selection">
          <div className="assistant-selection-heading">
            <strong>Selected article text</strong>
            <span>{selection.length.toLocaleString()} characters</span>
          </div>
          <p>{selection.length > 360 ? `${selection.slice(0, 360)}…` : selection}</p>
          <div className="assistant-quick-actions">
            <button type="button" onClick={() => askAboutSelection("selection_explain")} disabled={busy || selectionTooLong}>Explain</button>
            <button type="button" onClick={() => askAboutSelection("selection_simplify")} disabled={busy || selectionTooLong}>Simplify</button>
            <button type="button" onClick={translateSelectedText} disabled={!articleSlug || translatingSelection || selection.length > 12000}>
              {translatingSelection ? "Translating…" : "Translate"}
            </button>
            <button type="button" onClick={() => askAboutSelection("selection_code")} disabled={busy || selectionTooLong}>Explain code</button>
          </div>
          {selectionTooLong && selection.length <= 12000 && (
            <span className="assistant-selection-warning">AI explanations support up to 6,000 characters; translation supports up to 12,000.</span>
          )}
          {selection.length > 12000 && (
            <span className="assistant-selection-warning">Select 12,000 characters or fewer to translate this passage.</span>
          )}
          {currentSelectedTranslation && (
            <div className="assistant-selection-result">
              <button type="button" onClick={() => setShowSelectedTranslation((value) => !value)}>
                {showSelectedTranslation ? "Show original selection" : "Show translated selection"}
              </button>
              {currentSelectedTranslation.unchanged && <span> Code and commands are kept unchanged.</span>}
              <p>{showSelectedTranslation ? currentSelectedTranslation.text : selection}</p>
            </div>
          )}
        </div>
      )}

      <div className="assistant-transcript" role="log" aria-label="Conversation history" aria-live="polite">
        {!messages.length && (
          <div className="assistant-welcome">
            <Sparkles size={20} />
            <strong>What would you like to learn?</strong>
            <p>Ask a question, paste a command or code snippet, or choose a study task above.</p>
          </div>
        )}
        {messages.map((message, index) => (
          <article className={`assistant-message assistant-message-${message.role}`} key={message.id}>
            <div className="assistant-message-meta">
              <strong>{message.role === "assistant" ? "CipherBrief AI" : "You"}</strong>
              <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
            </div>
            <div className="assistant-markdown">
              <ReactMarkdown>
                {responseTranslations[message.id]?.visible
                  ? responseTranslations[message.id].text
                  : message.content}
              </ReactMarkdown>
            </div>
            {message.role === "assistant" && (
              <div className="assistant-message-actions">
                <button
                  type="button"
                  onClick={() => copyAnswer(responseTranslations[message.id]?.visible ? responseTranslations[message.id].text : message.content)}
                  aria-label="Copy response"
                >
                  <Copy size={14} /> Copy
                </button>
                <button
                  type="button"
                  onClick={() => translateResponse(message)}
                  disabled={Boolean(translatingMessageId)}
                  aria-label={responseTranslations[message.id]?.visible ? "Show original response" : "Translate response"}
                >
                  {translatingMessageId === message.id
                    ? <LoaderCircle size={14} className="assistant-spinner" />
                    : responseTranslations[message.id]?.visible
                      ? <EyeOff size={14} />
                      : responseTranslations[message.id]?.targetLanguage === translationTarget
                        && responseTranslations[message.id]?.style === translationStyle
                        ? <Eye size={14} />
                        : <Languages size={14} />}
                  {translatingMessageId === message.id
                    ? "Translating…"
                    : responseTranslations[message.id]?.visible
                      ? "Show original"
                      : responseTranslations[message.id]?.targetLanguage === translationTarget
                        && responseTranslations[message.id]?.style === translationStyle
                        ? "Show translation"
                        : "Translate"}
                </button>
                {index === messages.length - 1 && (
                  <button type="button" onClick={regenerateLastAnswer} disabled={busy}><RotateCcw size={14} /> Regenerate</button>
                )}
              </div>
            )}
          </article>
        ))}
        {busy && (
          <div className="assistant-thinking" role="status">
            <LoaderCircle size={16} className="assistant-spinner" /> The local model is preparing an answer…
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {error && <p className="workspace-alert workspace-alert-error" role="alert">{error}</p>}
      {translationError && <p className="workspace-alert workspace-alert-error" role="alert">{translationError}</p>}
      {notice && <p className="assistant-notice" role="status">{notice}</p>}

      <form className="assistant-composer" onSubmit={submitQuestion}>
        <label className="sr-only" htmlFor="assistant-question">Your question</label>
        <textarea
          id="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a cybersecurity question…"
          maxLength={4000}
          rows={3}
        />
        <div className="assistant-composer-footer">
          <span>{question.length.toLocaleString()} / 4,000</span>
          <button type="submit" className="primary-button" disabled={busy || !question.trim()}>
            {busy ? <LoaderCircle size={16} className="assistant-spinner" /> : <Send size={16} />}
            Send
          </button>
        </div>
      </form>

      <p className="assistant-safety-note">
        For learning and defense. Practical activities should stay offline and use synthetic data.
      </p>
    </section>
  );
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
