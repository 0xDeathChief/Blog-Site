"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Check,
  Copy,
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

export default function AssistantChat({ articleSlug, selection = "" }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [task, setTask] = useState("chat");
  const [mode, setMode] = useState("beginner");
  const [language, setLanguage] = useState("english");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

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
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer,
          task: selectedTask,
          createdAt: result.createdAt,
        },
      ]);
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
      selection_translate: "Translate this selected passage into the selected language.",
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

  function clearConversation() {
    setMessages([]);
    setError("");
    setNotice("Conversation cleared.");
  }

  const selectionTooLong = selection.length > 6000;

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
        <button className="assistant-icon-button" type="button" onClick={clearConversation} disabled={busy || (!messages.length && !notice)} aria-label="Clear conversation" title="Clear conversation">
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

      {selection && (
        <div className="assistant-selection">
          <div className="assistant-selection-heading">
            <strong>Selected article text</strong>
            <span>{selection.length.toLocaleString()} characters</span>
          </div>
          <p>{selection.length > 360 ? `${selection.slice(0, 360)}…` : selection}</p>
          {selectionTooLong ? (
            <span className="assistant-selection-warning">Select 6,000 characters or fewer for a focused explanation.</span>
          ) : (
            <div className="assistant-quick-actions">
              <button type="button" onClick={() => askAboutSelection("selection_explain")} disabled={busy}>Explain</button>
              <button type="button" onClick={() => askAboutSelection("selection_simplify")} disabled={busy}>Simplify</button>
              <button type="button" onClick={() => askAboutSelection("selection_translate")} disabled={busy}>Translate</button>
              <button type="button" onClick={() => askAboutSelection("selection_code")} disabled={busy}>Explain code</button>
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
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            {message.role === "assistant" && (
              <div className="assistant-message-actions">
                <button type="button" onClick={() => copyAnswer(message.content)} aria-label="Copy response"><Copy size={14} /> Copy</button>
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
