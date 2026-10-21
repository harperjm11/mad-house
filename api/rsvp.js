// Vercel serverless function: each RSVP is (1) emailed to the hosts via Resend and
// (2) added as a row to a Google Sheet via a Google Apps Script web app.
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY      your Resend API key
//   RSVP_TO             comma-separated recipients, e.g. djharper@me.com,julia_harper@hotmail.com
//   RSVP_FROM           sender on your verified domain, e.g. The Mad House <rsvp@120littlelonsdale.com>
//   SHEET_WEBHOOK_URL   the Apps Script web app URL (ends in /exec)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function sendEmail({ name, yes, drink, note, when }) {
  if (!process.env.RESEND_API_KEY || !process.env.RSVP_TO) return 'skipped';
  const html = `<div style="font-family:Georgia,serif;font-size:16px;color:#1b1814">
    <p style="font-size:22px;margin:0 0 12px">${esc(name)} ${yes ? 'will be attending 🎉' : 'can’t make it'}</p>
    ${drink ? `<p>Poison of choice: <b>${esc(drink)}</b></p>` : ''}
    ${note ? `<p>Message: ${esc(note)}</p>` : ''}
    <p style="color:#7a7164;font-size:13px">Received ${esc(when)} (Melbourne)</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RSVP_FROM || 'The Mad House <onboarding@resend.dev>',
      to: process.env.RSVP_TO.split(',').map(s => s.trim()).filter(Boolean),
      subject: `RSVP: ${name} ${yes ? 'is attending' : 'sends regrets'}`,
      html,
    }),
  });
  if (!r.ok) throw new Error('email ' + (await r.text()));
  return 'sent';
}

async function addToSheet(row) {
  if (!process.env.SHEET_WEBHOOK_URL) return 'skipped';
  const r = await fetch(process.env.SHEET_WEBHOOK_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(row), redirect: 'follow',
  });
  if (!r.ok) throw new Error('sheet ' + r.status);
  return 'added';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  const name = String(b?.name || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ ok: false, error: 'name required' });
  const yes = b.answer === 'yes';
  const drink = String(b.drink || '').slice(0, 80);
  const note = String(b.note || '').slice(0, 1000);
  const when = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
  const results = await Promise.allSettled([
    sendEmail({ name, yes, drink, note, when }),
    addToSheet({ when, name, answer: yes ? 'Attending' : 'Regrets', drink, note }),
  ]);
  results.forEach(r => r.status === 'rejected' && console.error(r.reason));
  const ok = results.some(r => r.status === 'fulfilled' && r.value !== 'skipped');
  return res.status(ok ? 200 : 502).json({ ok });
};
