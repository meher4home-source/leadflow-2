// lib/ai.js — calls the Groq API to conduct and score the qualifying
// conversation with a lead. Groq is used instead of NVIDIA NIM because
// NVIDIA's free/trial tier explicitly excludes production use serving real
// end-users — Groq's free tier has no such restriction.
const industries = require('./industries');

/**
 * Given the conversation so far, decide the next message to send AND
 * whether enough information has been gathered to classify the lead.
 *
 * Returns: { reply, done, classification, estimated_value }
 * - classification is one of 'high_paying' | 'mid_range' | 'low_budget' (only when done)
 * - reply is always the next thing to text the lead
 */
async function runQualifyingStep({ industryKey, businessName, bookingLink, conversation }) {
  const industry = industries[industryKey] || industries.other;
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemPrompt = `You are an SMS assistant for "${businessName}", a ${industry.label}.
Your job is to have a short, friendly text conversation with a new lead to find out how
serious and high-value they are, then hand them off correctly.

Reference questions for this industry (use your judgment on which ones matter most,
don't necessarily ask all of them, and never ask more than one question per message):
${industry.questions.map((q) => '- ' + q).join('\n')}

Classification rules:
- "high_paying": clearly realistic budget/urgency for a full-price, ready-to-move-forward deal
- "mid_range": interested and plausible, but budget or timeline is uncertain or moderate
- "low_budget": unrealistic budget expectations, "just looking," or no real urgency

When you have enough information (usually after 1-3 exchanges), stop asking questions and
classify. If classification is "high_paying" or "mid_range", your final reply should thank
them and share this booking link so they can grab a time: ${bookingLink || '(no booking link set)'}.
If "low_budget", your final reply should be brief and polite, without pushing a booking link.

Respond with ONLY a JSON object, no other text, in this exact shape:
{"reply": "...", "done": false, "classification": null, "estimated_value": null}
or, when finishing:
{"reply": "...", "done": true, "classification": "high_paying", "estimated_value": 15000}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversation.map((m) => ({
      role: m.direction === 'outbound' ? 'assistant' : 'user',
      content: m.body,
    })),
  ];

  if (!apiKey) {
    // No AI key configured yet — fall back to a simple static first question
    // so the product still works end-to-end during setup/testing.
    return {
      reply: `Hi! Thanks for reaching out to ${businessName}. ${industry.questions[0]}`,
      done: false,
      classification: null,
      estimated_value: null,
    };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 300,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '';

  try {
    const cleaned = raw.trim().replace(/^```json/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      reply: parsed.reply || "Thanks for the info — we'll follow up shortly.",
      done: !!parsed.done,
      classification: parsed.classification || null,
      estimated_value: parsed.estimated_value || null,
    };
  } catch (err) {
    return {
      reply: raw || "Thanks for reaching out — we'll follow up shortly.",
      done: false,
      classification: null,
      estimated_value: null,
    };
  }
}

module.exports = { runQualifyingStep };
