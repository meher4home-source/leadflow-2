// api/sms/webhook.js — Twilio calls this every time a lead replies by text.
const { getServiceClient } = require('../../lib/supabaseServer');
const { sendSms } = require('../../lib/twilio');
const { runQualifyingStep } = require('../../lib/ai');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/xml');

  try {
    const from = req.body.From;
    const body = req.body.Body;
    if (!from || !body) return res.status(200).send('<Response></Response>');

    const svc = getServiceClient();

    // Find this lead's most recent open conversation on this phone number.
    const { data: lead } = await svc
      .from('leads')
      .select('*')
      .eq('phone', from)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lead) return res.status(200).send('<Response></Response>');

    await svc.from('lead_messages').insert({ lead_id: lead.id, user_id: lead.user_id, direction: 'inbound', body });

    const { data: profile } = await svc.from('profiles').select('*').eq('id', lead.user_id).single();
    const { data: messages } = await svc
      .from('lead_messages')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    const step = await runQualifyingStep({
      industryKey: profile.industry || 'other',
      businessName: profile.business_name || 'our team',
      bookingLink: profile.booking_link,
      conversation: messages,
    });

    await sendSms(from, step.reply);
    await svc.from('lead_messages').insert({ lead_id: lead.id, user_id: lead.user_id, direction: 'outbound', body: step.reply });

    if (step.done) {
      await svc
        .from('leads')
        .update({
          classification: step.classification || 'mid_range',
          estimated_value: step.estimated_value,
          status: 'qualified',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);
    }

    return res.status(200).send('<Response></Response>');
  } catch (err) {
    console.error(err);
    return res.status(200).send('<Response></Response>');
  }
};
