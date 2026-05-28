export const MODEL = 'gemini-2.0-flash';
const SSE_ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${key}`;

/**
 * Stream a response from the Gemini API.
 *
 * @param {object}   opts
 * @param {string}   opts.apiKey
 * @param {string}   [opts.systemPrompt]
 * @param {{ role: 'user'|'model', text: string }[]} opts.messages
 * @param {(chunk: string) => void} opts.onChunk   - called for each text token
 * @param {() => void}              [opts.onDone]  - called when stream ends cleanly
 * @param {(msg: string) => void}   [opts.onError] - called on network/API error
 * @param {AbortSignal}             [opts.signal]
 */
export async function streamGemini({ apiKey, systemPrompt, messages, onChunk, onDone, onError, signal }) {
  const body = {
    contents: messages.map(({ role, text }) => ({ role, parts: [{ text }] })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  if (systemPrompt) {
    body.system_instruction = { parts: [{ text: systemPrompt }] };
  }

  let response;
  try {
    response = await fetch(SSE_ENDPOINT(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name !== 'AbortError') onError?.(err.message);
    return;
  }

  if (!response.ok) {
    try {
      const errBody = await response.json();
      onError?.(errBody.error?.message ?? `API error ${response.status}`);
    } catch {
      onError?.(`API error ${response.status}`);
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const parseSSELine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    // handle both "data: {}" and "data:{}" (no space)
    const json = trimmed.slice(trimmed.startsWith('data: ') ? 6 : 5).trim();
    if (!json || json === '[DONE]') return;
    try {
      const parsed = JSON.parse(json);
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) onChunk(text);
    } catch { /* malformed chunk */ }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) parseSSELine(line);
    }
    // Flush anything left in the buffer that didn't end with \n
    if (buffer.trim()) parseSSELine(buffer);
  } catch (err) {
    if (err.name !== 'AbortError') onError?.(err.message);
    return;
  }

  onDone?.();
}
