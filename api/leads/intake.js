
// api/leads/intake.js — creates a new lead and sends the first qualifying SMS.
// Two ways in:
//  1. Authenticated (Authorization: Bearer <token>) — used by the dashboard's "+ Add Lead"
//  2. Public webhook (?key=<intake_key>) — used by the business's own website contact form
const { getUserFromToken, getUserClient, getServiceClient } = require('../../lib/supabaseServer');
const { sendSms } = require('../../lib/twilio');
const { runQualifyingStep } = require('../../lib/ai');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required.' });

  let userId, profile, db;
  const authHeader = req.headers.authorization;

  try {
    if (authHeader) {
      // Path 1 — signed-in dashboard user adding a lead manually
      const token = authHeader.replace('Bearer ', '');
      const user = await getUserFromToken(token);
      if (!user) return res.status(401).json({ error: 'Not signed in.' });
      db = getUserClient(token);
      userId = user.id;
      const { data } = await db.from('profiles').select('*').eq('id', userId).single();
      profile = data;
    } else {
      // Path 2 — public webhook from the business's own website form
      const key = req.query.key;
      if (!key) return res.status(401).json({ error: 'Missing intake key.' });
      const svc = getServiceClient();
      const { data } = await svc.from('profiles').select('*').eq('intake_key', key).single();
      if (!data) return res.status(404).json({ error: 'Invalid intake key.' });
      profile = data;
      userId = profile.id;
      db = svc; // public path uses the service client since there's no user session
    }

    if (!profile) return res.status(404).json({ error: 'Business profile not found.' });

    const { data: lead, error: leadErr } = await db
      .from('leads')
      .insert({ user_id: userId, name, phone, email: email || null, source: authHeader ? 'manual' : 'website' })
      .select()
      .single();
    if (leadErr) throw leadErr;

    // Kick off the AI qualifying conversation with an opening message.
    const step = await runQualifyingStep({
      industryKey: profile.industry || 'other',
      businessName: profile.business_name || 'our team',
      bookingLink: profile.booking_link,
      conversation: [],
    });

    try {
      await sendSms(phone, step.reply);
    } catch (smsErr) {
      // Twilio not configured yet — don't fail the whole request, just log
      // the message so the demo/testing flow still works end-to-end.
      console.warn('SMS send failed (check Twilio env vars):', smsErr.message);
    }

    await db.from('lead_messages').insert({ lead_id: lead.id, user_id: userId, direction: 'outbound', body: step.reply });
    await db.from('leads').update({ status: 'contacted' }).eq('id', lead.id);

    return res.status(200).json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Could not process lead.' });
  }
};

