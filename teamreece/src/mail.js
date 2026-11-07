// src/mail.js — optional email via Resend (https://resend.com).
// With no RESEND_API_KEY set, every function quietly does nothing, and entries are still saved.

const KEY = () => process.env.RESEND_API_KEY;
const FROM = () => process.env.MAIL_FROM || 'Team Reece <onboarding@resend.dev>';
export const mailEnabled = () => !!KEY();

async function send(payload) {
  if (!KEY()) return { skipped: true };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM(), ...payload }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Alert the campaign inbox (NOTIFY_EMAIL) about a new entry. Never throws. */
export function notify(subject, lines, replyTo) {
  if (!KEY() || !process.env.NOTIFY_EMAIL) return;
  send({
    to: process.env.NOTIFY_EMAIL.split(',').map((s) => s.trim()),
    subject: `[Team Reece] ${subject}`,
    text: lines.filter(Boolean).join('\n'),
    ...(replyTo ? { reply_to: replyTo } : {}),
  }).catch((e) => console.error('notify failed:', e.message));
}

/** Email one person (confirmation/welcome). Only when SEND_CONFIRMATIONS=1 and your domain is verified in Resend. */
export function confirm(to, subject, text) {
  if (!KEY() || process.env.SEND_CONFIRMATIONS !== '1') return;
  send({ to, subject, text }).catch((e) => console.error('confirmation failed:', e.message));
}

/** Send a newsletter, one email per subscriber (each gets their own unsubscribe link). */
export async function sendNewsletter(subscribers, subject, body, siteUrl) {
  if (!KEY()) throw new Error('Email is not set up yet. Add RESEND_API_KEY and MAIL_FROM.');
  let sent = 0, failed = 0;
  for (let i = 0; i < subscribers.length; i += 100) {
    const batch = subscribers.slice(i, i + 100).map((s) => {
      const unsub = `${siteUrl}/unsubscribe?t=${encodeURIComponent(s.token)}`;
      const hi = s.first ? `Hi ${s.first},\n\n` : '';
      return {
        from: FROM(), to: s.email, subject,
        text: `${hi}${body}\n\n—\nTeam Reece · The movement starts here.\nUnsubscribe: ${unsub}`,
        headers: { 'List-Unsubscribe': `<${unsub}>` },
      };
    });
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (r.ok) sent += batch.length; else { failed += batch.length; console.error('batch failed:', await r.text()); }
  }
  return { sent, failed };
}
