// api/sms/send.js — lets a business owner send a manual follow-up SMS to a lead.
const { getUserFromToken, getUserClient } = require('../../lib/supabaseServer');
const { sendSms } = require('../../lib/twilio');

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
    // RLS ensures this only succeeds if the lead actually belongs to this user.
    const { data: lead } = await db.from('leads').select('*').eq('id', leadId).single();
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    await sendSms(lead.phone, message);
    await db.from('lead_messages').insert({ lead_id: leadId, user_id: user.id, direction: 'outbound', body: message });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Could not send message. Check your Twilio setup.' });
  }
};
