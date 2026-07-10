/* chat.js — conversation thread (SMS exchange) for a single lead */

window.LFChat = window.LFChat || {};
let _currentLeadId = null;

LFChat.open = async function (lead) {
  _currentLeadId = lead.id;
  document.getElementById('leadDetailName').textContent = lead.name;
  document.getElementById('leadDetailMeta').textContent =
    `${lead.phone} · ${classificationLabel(lead.classification)}${lead.estimated_value ? ' · Est. $' + Number(lead.estimated_value).toLocaleString() : ''}`;

  const { data: messages } = await LF.client
    .from('lead_messages')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: true });

  LFChat.renderThread(messages || []);
  document.getElementById('leadDetailOverlay').classList.add('open');
};

LFChat.renderThread = function (messages) {
  const el = document.getElementById('leadThread');
  if (!messages.length) {
    el.innerHTML = '<p style="font-size:12.5px;color:var(--muted);text-align:center">No messages yet — LeadFlow will reach out shortly.</p>';
    return;
  }
  el.innerHTML = messages
    .map((m) => `<div class="bubble ${m.direction === 'outbound' ? 'out' : 'in'}">${escapeHtml(m.body)}</div>`)
    .join('');
  el.scrollTop = el.scrollHeight;
};

LFChat.send = async function (message) {
  if (!_currentLeadId || !message.trim()) return;
  const { data: sessionData } = await LF.client.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch('/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ leadId: _currentLeadId, message }),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Could not send message. Check your Twilio setup.');
    return;
  }
  const { data: messages } = await LF.client
    .from('lead_messages')
    .select('*')
    .eq('lead_id', _currentLeadId)
    .order('created_at', { ascending: true });
  LFChat.renderThread(messages || []);
};

function classificationLabel(c) {
  if (c === 'high_paying') return 'High-Paying Lead';
  if (c === 'mid_range') return 'Mid-Range Lead';
  if (c === 'low_budget') return 'Low-Budget Lead';
  return 'Pending Qualification';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
=== api/whatsapp/send.js ===
// api/whatsapp/send.js — sends a manual WhatsApp follow-up message to a lead.
const { getUserFromToken, getUserClient } = require('../../lib/supabaseServer');
const { sendWhatsApp } = require('../../lib/twilio');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not signed in.' });

  try {
    const token = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Not signed in.' });

    const { leadId, message } = req.body || {};
    if (!leadId || !message) return res.status(400).json({ error: 'leadId and message are required.' });

    const db = getUserClient(token);
    const { data: lead } = await db.from('leads').select('*').eq('id', leadId).single();
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    await sendWhatsApp(lead.phone, message);
    await db.from('lead_messages').insert({ lead_id: leadId, user_id: user.id, direction: 'outbound', body: `[WhatsApp] ${message}` });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Could not send WhatsApp message. Check your Twilio WhatsApp setup.' });
  }
};
=== api/calls/start.js ===
// api/calls/start.js — rings the business owner's phone, then bridges in the lead.
const { getUserFromToken, getUserClient } = require('../../lib/supabaseServer');
const { startBridgedCall } = require('../../lib/twilio');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not signed in.' });

  try {
    const token = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Not signed in.' });

    const { leadId, yourPhone } = req.body || {};
    if (!leadId || !yourPhone) return res.status(400).json({ error: 'leadId and yourPhone are required.' });

    const db = getUserClient(token);
    const { data: lead } = await db.from('leads').select('*').eq('id', leadId).single();
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    await startBridgedCall(yourPhone, lead.phone);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Could not start the call. Check your Twilio setup.' });
  }
};
