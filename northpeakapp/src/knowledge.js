// src/knowledge.js — scrape a site, chunk it, store per client, retrieve relevant bits.
import { embed, hasEmbeddings } from './ai.js';

/* ---------- very small HTML -> text ---------- */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameHost(a, b) {
  try { return new URL(a).host === new URL(b).host; } catch { return false; }
}

/* ---------- crawl a few pages of a site ---------- */
export async function scrapeSite(startUrl, maxPages = 8) {
  const visited = new Set();
  const queue = [startUrl];
  const pages = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NorthpeakAssistant/1.0; +https://northpeak.solutions)' }, redirect: 'follow' });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) continue;
      const html = await res.text();
      const text = htmlToText(html);
      if (text.length > 200) pages.push({ url, text });

      // discover a few internal links
      const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
      for (const href of links) {
        let abs;
        try { abs = new URL(href, url).href; } catch { continue; }
        if (sameHost(abs, startUrl) && !visited.has(abs) && queue.length < maxPages * 2) {
          if (!/\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|css|js)$/i.test(abs)) queue.push(abs);
        }
      }
    } catch { /* skip page */ }
  }
  return pages;
}

/* ---------- chunk text ---------- */
export function chunkText(text, size = 900, overlap = 150) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

/* ---------- build a knowledge base for a client ---------- */
export async function buildKnowledge(startUrl) {
  const pages = await scrapeSite(startUrl);
  if (!pages.length) throw new Error('Could not read any pages from that URL.');

  const chunks = [];
  for (const p of pages) {
    for (const c of chunkText(p.text)) chunks.push({ text: c, source: p.url });
  }

  // attach embeddings if we have them (batched)
  if (hasEmbeddings) {
    for (let i = 0; i < chunks.length; i += 64) {
      const batch = chunks.slice(i, i + 64);
      const vecs = await embed(batch.map((c) => c.text));
      batch.forEach((c, j) => { c.vec = vecs[j]; });
    }
  }
  return { pages: pages.length, chunks, mode: hasEmbeddings ? 'embeddings' : 'keyword' };
}

/* ---------- retrieval ---------- */
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
function keywordScore(query, text) {
  const q = new Set(query.toLowerCase().match(/[a-z0-9]+/g) || []);
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  let hits = 0;
  for (const w of words) if (q.has(w)) hits++;
  return hits / Math.sqrt(words.length || 1);
}

export async function retrieve(query, kb, topK = 4) {
  const chunks = kb.chunks || [];
  if (!chunks.length) return [];
  let scored;
  if (kb.mode === 'embeddings' && hasEmbeddings) {
    const [qv] = await embed([query]);
    scored = chunks.map((c) => ({ c, s: c.vec ? cosine(qv, c.vec) : 0 }));
  } else {
    scored = chunks.map((c) => ({ c, s: keywordScore(query, c.text) }));
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, topK).map((x) => x.c);
}
