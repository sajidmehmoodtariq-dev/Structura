import React, { useState, useRef, useEffect, useCallback } from 'react';
import { streamGemini, MODEL } from '../services/geminiService';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'structura_gemini_key';

const STEP_LABELS = {
  SET_VARIABLE: 'Variable assigned',
  UPDATE_ARRAY_ELEMENT: 'Array element updated',
  PUSH_FRAME: 'Function entered',
  POP_FRAME: 'Function exited',
  CALL: 'Function called',
  PARAM_INIT: 'Parameter initialized',
  RETURN: 'Return statement reached',
  RETURN_FROM_CALL: 'Returned to caller',
  IF_STATEMENT: 'Condition evaluated',
  SWITCH_STATEMENT: 'Switch evaluated',
  LOG_OUTPUT: 'Output printed',
  ALLOCATE_HEAP: 'Heap memory allocated',
  FREE_HEAP: 'Heap memory freed',
};

const TABS = [
  { id: 'analyzer', label: 'Analyze' },
  { id: 'explainer', label: 'Explain' },
  { id: 'chat', label: 'Chat' },
];

// ─── Prompt builders ──────────────────────────────────────────────────────────

const ANALYZER_SYSTEM = `You are an expert C++ tutor embedded in Structura, a C++ memory visualization tool for students.

Analyze the given C++ code and respond with exactly these four sections using markdown:

## Logic Issues
Any bugs, incorrect logic, or off-by-one errors. If none, write "None found."

## Memory Safety
Pointer misuse, memory leaks, dangling pointers, buffer overflows, undefined behavior. If none, write "None found."

## Edge Cases
Inputs or conditions that could cause crashes or unexpected results. If none, write "None found."

## Infinite Loop Risk
Loops that might not terminate under certain inputs. If none, write "None found."

Be direct and use simple language. Keep the total response under 350 words.`;

function buildExplainerPrompt(code, step, vizState) {
  const topFrame = vizState.stack[vizState.stack.length - 1];
  const frameVars = topFrame && Object.keys(topFrame.variables).length > 0
    ? Object.entries(topFrame.variables)
        .map(([n, d]) => `  ${n} (${d.type}) = ${JSON.stringify(d.value)}`)
        .join('\n')
    : '  (no variables in scope yet)';

  return `You are a C++ tutor inside Structura, a memory visualization tool.

The student is stepping through this C++ code:
\`\`\`cpp
${code}
\`\`\`

Current execution state:
- Step type: ${STEP_LABELS[step.type] ?? step.type} — line ${step.line}
- Step data: ${JSON.stringify(step.data)}
- Active function: ${topFrame?.name ?? 'none'}
- Variables currently in scope:
${frameVars}

In 2–3 sentences, explain plainly what just happened at this step.
Speak directly to the student ("you", not "the code"). Don't mention step-type jargon.
Focus on what changed in memory and why it matters conceptually.`;
}

function buildChatSystem(code, currentStep, totalSteps, vizState) {
  const topFrame = vizState.stack[vizState.stack.length - 1];
  const frameVars = topFrame && Object.keys(topFrame.variables).length > 0
    ? Object.entries(topFrame.variables)
        .map(([n, d]) => `${n}=${JSON.stringify(d.value)}`)
        .join(', ')
    : 'none yet';

  return `You are an expert C++ tutor embedded in Structura, a memory visualization tool for students.

The student is working with this C++ code:
\`\`\`cpp
${code}
\`\`\`

Current state: step ${currentStep} of ${totalSteps}. Active function: ${topFrame?.name ?? 'none'}. Variables: ${frameVars}.

Guide the student with concise, friendly answers. Don't write code for them — help them understand.
When relevant, connect your explanation to what they can see in the visualization.
Keep responses under 200 words unless the question genuinely requires more detail.`;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function InlineText({ text }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
          return <code key={i} className="bg-[#0d1117] px-1 rounded text-cyan-300 font-mono text-[10px]">{part.slice(1, -1)}</code>;
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
          return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <em key={i} className="text-gray-200">{part.slice(1, -1)}</em>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MarkdownText({ text }) {
  if (!text) return null;

  const codeBlockRegex = /(```[\s\S]*?```)/g;
  const segments = text.split(codeBlockRegex);

  return (
    <div className="text-[11px] text-gray-300 leading-relaxed">
      {segments.map((seg, si) => {
        if (seg.startsWith('```')) {
          const code = seg.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          return (
            <pre key={si} className="bg-[#0d1117] rounded p-2 my-2 text-[10px] text-green-300 overflow-x-auto font-mono whitespace-pre-wrap border border-[#30363d]">
              {code}
            </pre>
          );
        }

        return seg.split('\n').map((line, li) => {
          const key = `${si}-${li}`;
          if (!line.trim()) return <div key={key} className="h-1.5" />;

          if (line.startsWith('## '))
            return <div key={key} className="text-white font-bold text-[11px] mt-3 mb-1 border-b border-[#30363d] pb-0.5"><InlineText text={line.slice(3)} /></div>;
          if (line.startsWith('### '))
            return <div key={key} className="text-gray-200 font-semibold text-[11px] mt-2 mb-0.5"><InlineText text={line.slice(4)} /></div>;

          const bulletMatch = line.match(/^[-*] (.*)/);
          if (bulletMatch)
            return <div key={key} className="flex gap-1.5 my-0.5"><span className="text-cyan-400 shrink-0">•</span><span><InlineText text={bulletMatch[1]} /></span></div>;

          const numMatch = line.match(/^(\d+)\. (.*)/);
          if (numMatch)
            return <div key={key} className="flex gap-1.5 my-0.5"><span className="text-cyan-400 shrink-0 font-mono">{numMatch[1]}.</span><span><InlineText text={numMatch[2]} /></span></div>;

          return <p key={key} className="my-0.5"><InlineText text={line} /></p>;
        });
      })}
    </div>
  );
}

// ─── Streaming cursor ─────────────────────────────────────────────────────────

function StreamingCursor() {
  return <span className="inline-block w-0.5 h-3 bg-cyan-400 ml-0.5 align-middle animate-pulse" />;
}

// ─── Key setup screen ─────────────────────────────────────────────────────────

function KeySetup({ onSave }) {
  const [input, setInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    const key = input.trim();
    if (!key) { setErr('Please enter an API key.'); return; }
    setValidating(true);
    setErr('');
    // Quick validation: try a minimal non-streaming request
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 1 } }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? `Error ${res.status}`);
      }
      localStorage.setItem(STORAGE_KEY, key);
      onSave(key);
    } catch (e) {
      setErr(e.message);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-5 py-8 text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mb-1">
        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>

      <div>
        <p className="text-white font-semibold text-sm mb-1">Connect Gemini</p>
        <p className="text-gray-400 text-[11px] leading-relaxed">
          Paste your Gemini API key to enable AI analysis, step explanations, and chat.
        </p>
      </div>

      <div className="w-full space-y-2">
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={input}
            onChange={e => { setInput(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="AIza..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[11px] text-white font-mono placeholder-gray-600 focus:outline-none focus:border-purple-500 pr-8"
          />
          <button
            onClick={() => setShowKey(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            title={showKey ? 'Hide' : 'Show'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showKey
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              }
            </svg>
          </button>
        </div>

        {err && <p className="text-red-400 text-[10px] text-left">{err}</p>}

        <button
          onClick={handleSave}
          disabled={validating || !input.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold py-2 rounded-md transition-colors"
        >
          {validating ? 'Verifying...' : 'Save & Connect'}
        </button>

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          className="block text-purple-400 hover:text-purple-300 text-[10px] transition-colors"
        >
          Get a free API key at Google AI Studio ↗
        </a>
      </div>

      <div className="w-full bg-[#0d1117] rounded-md p-3 border border-[#30363d] text-left">
        <p className="text-[10px] text-gray-500 flex items-start gap-1.5">
          <span className="text-green-400 shrink-0">🔐</span>
          Your key is stored only in this browser and sent directly to Google. Structura never sees it.
        </p>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AITutorPanel({ isOpen, onClose, code, steps, currentStep, vizState }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [showKeyEdit, setShowKeyEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('analyzer');
  const [isStreaming, setIsStreaming] = useState(false);

  // Per-tab output
  const [analyzerOutput, setAnalyzerOutput] = useState('');
  const [analyzerError, setAnalyzerError] = useState('');
  const [explainerOutput, setExplainerOutput] = useState('');
  const [explainerError, setExplainerError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatError, setChatError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');

  const abortRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingMessage]);

  // Abort in-flight stream when panel closes
  useEffect(() => {
    if (!isOpen) abortRef.current?.abort();
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const startStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsStreaming(true);
    return abortRef.current.signal;
  }, []);

  // ── Analyzer ────────────────────────────────────────────────────────────────

  const runAnalyzer = useCallback(async () => {
    setAnalyzerOutput('');
    setAnalyzerError('');
    const signal = startStream();
    let accumulated = '';

    await streamGemini({
      apiKey,
      systemPrompt: ANALYZER_SYSTEM,
      messages: [{ role: 'user', text: `Analyze this C++ code:\n\`\`\`cpp\n${code}\n\`\`\`` }],
      onChunk: (chunk) => { accumulated += chunk; setAnalyzerOutput(accumulated); },
      onDone: () => setIsStreaming(false),
      onError: (msg) => { setAnalyzerError(msg); setIsStreaming(false); },
      signal,
    });
  }, [apiKey, code, startStream]);

  // ── Step Explainer ───────────────────────────────────────────────────────────

  const currentStepData = steps[currentStep - 1] ?? null;

  const runExplainer = useCallback(async () => {
    if (!currentStepData) return;
    setExplainerOutput('');
    setExplainerError('');
    const signal = startStream();
    let accumulated = '';

    await streamGemini({
      apiKey,
      messages: [{ role: 'user', text: buildExplainerPrompt(code, currentStepData, vizState) }],
      onChunk: (chunk) => { accumulated += chunk; setExplainerOutput(accumulated); },
      onDone: () => setIsStreaming(false),
      onError: (msg) => { setExplainerError(msg); setIsStreaming(false); },
      signal,
    });
  }, [apiKey, code, currentStepData, vizState, startStream]);

  // ── Chat ─────────────────────────────────────────────────────────────────────

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isStreaming) return;

    setChatInput('');
    setChatError('');
    const userMsg = { role: 'user', text };
    const history = [...chatMessages, userMsg];
    setChatMessages(history);

    const signal = startStream();
    setStreamingMessage('');
    let accumulated = '';

    await streamGemini({
      apiKey,
      systemPrompt: buildChatSystem(code, currentStep, steps.length, vizState),
      messages: history,
      onChunk: (chunk) => { accumulated += chunk; setStreamingMessage(accumulated); },
      onDone: () => {
        setChatMessages(prev => [...prev, { role: 'model', text: accumulated }]);
        setStreamingMessage('');
        setIsStreaming(false);
      },
      onError: (msg) => {
        setChatError(msg);
        setStreamingMessage('');
        setIsStreaming(false);
      },
      signal,
    });
  }, [apiKey, chatInput, chatMessages, code, currentStep, steps, vizState, isStreaming, startStream]);

  const handleChatKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  };

  // ── Key management ───────────────────────────────────────────────────────────

  const handleKeySaved = (key) => {
    setApiKey(key);
    setShowKeyEdit(false);
  };

  const handleKeyRemove = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey('');
    setShowKeyEdit(false);
    abortRef.current?.abort();
    setIsStreaming(false);
    setAnalyzerOutput('');
    setExplainerOutput('');
    setChatMessages([]);
    setStreamingMessage('');
  };

  const hasKey = !!apiKey;
  const showSetup = !hasKey || showKeyEdit;

  // ── Tab switching ─────────────────────────────────────────────────────────────

  const switchTab = (tab) => {
    setActiveTab(tab);
    setAnalyzerError('');
    setExplainerError('');
    setChatError('');
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-[#161b22] border-l border-[#30363d] shrink-0 overflow-hidden transition-[width] duration-300"
      style={{ width: isOpen ? '320px' : '0' }}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0 bg-[#0d1117]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-xs font-semibold text-white">AI Tutor</span>
              {hasKey && (
                <span className="text-[9px] text-gray-500 font-mono bg-[#161b22] px-1.5 py-0.5 rounded border border-[#30363d]">
                  {MODEL}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasKey && (
                <button
                  onClick={() => setShowKeyEdit(v => !v)}
                  title="API key settings"
                  className={`p-1.5 rounded hover:bg-[#30363d] transition-colors ${showKeyEdit ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-[#30363d] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Key setup / edit */}
          {showSetup ? (
            <div className="flex flex-col flex-1 overflow-y-auto">
              <KeySetup onSave={handleKeySaved} />
              {showKeyEdit && hasKey && (
                <div className="px-5 pb-5">
                  <button
                    onClick={handleKeyRemove}
                    className="w-full border border-red-500/40 text-red-400 hover:bg-red-500/10 text-[11px] py-1.5 rounded-md transition-colors"
                  >
                    Remove saved key
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex border-b border-[#30363d] shrink-0">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => switchTab(tab.id)}
                    className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-white border-b-2 border-purple-500 bg-[#0d1117]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-[#0d1117]/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex flex-col flex-1 overflow-hidden">

                {/* ── Analyzer ───────────────────────────────────────────────── */}
                {activeTab === 'analyzer' && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#30363d] shrink-0">
                      <p className="text-[11px] text-gray-400 mb-2.5">
                        Scan your C++ for logic bugs, memory issues, and edge cases.
                      </p>
                      <button
                        onClick={runAnalyzer}
                        disabled={isStreaming || !code.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold py-2 rounded-md transition-colors"
                      >
                        {isStreaming && activeTab === 'analyzer' ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Analyze Code
                          </>
                        )}
                      </button>
                      {analyzerError && (
                        <p className="mt-2 text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
                          {analyzerError}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3">
                      {analyzerOutput ? (
                        <>
                          <MarkdownText text={analyzerOutput} />
                          {isStreaming && <StreamingCursor />}
                        </>
                      ) : (
                        !isStreaming && (
                          <p className="text-[11px] text-gray-600 italic text-center mt-8">
                            Analysis results will appear here.
                          </p>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step Explainer ─────────────────────────────────────────── */}
                {activeTab === 'explainer' && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#30363d] shrink-0">
                      {currentStepData ? (
                        <>
                          {/* Current step summary */}
                          <div className="bg-[#0d1117] rounded-md p-2.5 mb-2.5 border border-[#30363d]">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                              <span className="text-[10px] font-semibold text-cyan-400 font-mono">
                                Step {currentStep} — Line {currentStepData.line}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-300">
                              {STEP_LABELS[currentStepData.type] ?? currentStepData.type}
                              {currentStepData.data?.name ? ` — ${currentStepData.data.name}` : ''}
                            </p>
                            {currentStepData.data && (
                              <div className="mt-1.5 text-[10px] text-gray-500 font-mono leading-relaxed">
                                {Object.entries(currentStepData.data)
                                  .filter(([k]) => !['indexText', 'valueText'].includes(k))
                                  .slice(0, 4)
                                  .map(([k, v]) => (
                                    <div key={k}>{k}: <span className="text-gray-400">{JSON.stringify(v)}</span></div>
                                  ))
                                }
                              </div>
                            )}
                          </div>
                          <button
                            onClick={runExplainer}
                            disabled={isStreaming}
                            className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold py-2 rounded-md transition-colors"
                          >
                            {isStreaming && activeTab === 'explainer' ? (
                              <>
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                Explaining...
                              </>
                            ) : '💡 Explain This Step'}
                          </button>
                          {explainerError && (
                            <p className="mt-2 text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
                              {explainerError}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="bg-[#0d1117] rounded-md p-3 border border-[#30363d] text-center">
                          <p className="text-[11px] text-gray-500">
                            Step forward through your code to use the explainer.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3">
                      {explainerOutput ? (
                        <>
                          <MarkdownText text={explainerOutput} />
                          {isStreaming && <StreamingCursor />}
                        </>
                      ) : (
                        !isStreaming && currentStepData && (
                          <p className="text-[11px] text-gray-600 italic text-center mt-8">
                            Explanation will appear here.
                          </p>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* ── Chat ───────────────────────────────────────────────────── */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Message list */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                      {chatMessages.length === 0 && !streamingMessage && (
                        <div className="text-center mt-6">
                          <p className="text-[11px] text-gray-600 italic">
                            Ask anything about your code, the visualization, or C++ concepts.
                          </p>
                        </div>
                      )}

                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.role === 'model' ? (
                            <div className="max-w-[90%] bg-[#0d1117] border border-[#30363d] rounded-lg rounded-tl-sm px-3 py-2">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                <span className="text-[9px] text-purple-400 font-semibold">AI Tutor</span>
                              </div>
                              <MarkdownText text={msg.text} />
                            </div>
                          ) : (
                            <div className="max-w-[85%] bg-purple-600/80 rounded-lg rounded-tr-sm px-3 py-2">
                              <p className="text-[11px] text-white leading-relaxed">{msg.text}</p>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Streaming response */}
                      {streamingMessage && (
                        <div className="flex justify-start">
                          <div className="max-w-[90%] bg-[#0d1117] border border-[#30363d] rounded-lg rounded-tl-sm px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                              <span className="text-[9px] text-purple-400 font-semibold">AI Tutor</span>
                            </div>
                            <MarkdownText text={streamingMessage} />
                            <StreamingCursor />
                          </div>
                        </div>
                      )}

                      {/* Typing indicator when streaming starts */}
                      {isStreaming && !streamingMessage && (
                        <div className="flex justify-start">
                          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
                            {[0, 1, 2].map(i => (
                              <span
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                                style={{ animationDelay: `${i * 150}ms` }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {chatError && (
                        <p className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20 mx-1">
                          {chatError}
                        </p>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-[#30363d] px-3 py-2.5 shrink-0 bg-[#0d1117]">
                      <div className="flex gap-2 items-end">
                        <textarea
                          ref={chatInputRef}
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={handleChatKey}
                          placeholder="Ask about your code..."
                          rows={2}
                          className="flex-1 bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-2 text-[11px] text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500 leading-relaxed"
                          style={{ minHeight: '52px', maxHeight: '120px' }}
                        />
                        <button
                          onClick={sendChat}
                          disabled={isStreaming || !chatInput.trim()}
                          className="p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors shrink-0"
                          title="Send (Enter)"
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-[9px] text-gray-600 mt-1">Enter to send · Shift+Enter for new line</p>
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
