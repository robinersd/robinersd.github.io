const unavailable =
  'The chat service is temporarily unavailable. You can still ask about Robiner’s published skills, projects and education.';

// GitHub Pages serves static files; AI requests go to the portfolio's own backend.
export function resolveChatEndpoint(location = globalThis.location) {
  return location?.hostname === 'robinersd.github.io'
    ? 'https://robinersd.vercel.app/api/chat'
    : '/api/chat';
}

export async function requestChatReply(messages, attachments, { signal } = {}) {
  let response;
  try {
    response = await fetch(resolveChatEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ messages, attachments }),
      signal,
    });
  } catch (error) {
    if (['AbortError', 'TimeoutError'].includes(error.name)) throw error;
    throw new Error(unavailable);
  }
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) throw new Error(unavailable);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(unavailable);
  }
  if (!response.ok || typeof data?.reply !== 'string' || !data.reply.trim()) {
    const message =
      [400, 413, 429, 503].includes(response.status) && typeof data?.error === 'string'
        ? data.error
        : unavailable;
    throw new Error(message);
  }
  return data;
}
