// src/ai.js — provider-swappable AI layer.
// Picks Anthropic if ANTHROPIC_API_KEY is set, else OpenAI if OPENAI_API_KEY is set.
// Exposes: chat({system, user}) -> string, and embed(texts) -> number[][].
// Embeddings use OpenAI when available; otherwise we fall back to a simple
// keyword-overlap score in retrieval, so the system still works with only an
// Anthropic key.

const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const OPENAI = process.env.OPENAI_API_KEY;

export const provider =
  ANTHROPIC ? 'anthropic' : OPENAI ? 'openai' : 'none';

export const hasEmbeddings = !!OPENAI; // only OpenAI embeddings wired in v1

export async function chat({ system, user, maxTokens = 600 }) {
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!r.ok) throw new Error(`Anthropic error ${r.status}: ${await r.text()}`);
    const data = await r.json();
    return data.content.map((c) => c.text || '').join('').trim();
  }

  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${await r.text()}`);
    const data = await r.json();
    return data.choices[0].message.content.trim();
  }

  throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
}

export async function embed(texts) {
  if (!hasEmbeddings) return null; // caller falls back to keyword scoring
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  });
  if (!r.ok) throw new Error(`OpenAI embeddings error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.data.map((d) => d.embedding);
}
