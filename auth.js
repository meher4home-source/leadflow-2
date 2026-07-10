/* auth.js — shared Supabase auth helpers, loaded on every page.
   Requires the Supabase UMD script to be loaded first (see <head> of each HTML file). */

// ── Replace these two values with your own Supabase project's API settings ──
// (Project Settings → API in your Supabase dashboard). The anon key is safe
// to expose in client-side code — Row Level Security is the real boundary.
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.LF = window.LF || {};

LF.client = sb;

LF.signUp = async function (name, email, password) {
  return sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${window.location.origin}/onboarding.html`,
    },
  });
};

LF.signIn = async function (email, password) {
  return sb.auth.signInWithPassword({ email, password });
};

LF.signInWithGoogle = async function () {
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/onboarding.html` },
  });
};

LF.forgotPassword = async function (email) {
  return sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`,
  });
};

LF.signOut = async function () {
  await sb.auth.signOut();
  window.location.href = '/index.html';
};

LF.getSession = async function () {
  const { data } = await sb.auth.getUser();
  return data.user || null;
};

LF.getProfile = async function (userId) {
  const { data } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
};

// Toggle a password input between hidden/visible. Pass the input's id and the
// toggle button element itself.
LF.togglePassword = function (inputId, btn) {
  const el = document.getElementById(inputId);
  const isHidden = el.type === 'password';
  el.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? 'Hide' : 'Show';
};

// Guard used at the top of dashboard.html — redirects to onboarding if the
// person isn't signed in, or to the pricing step if they haven't paid yet.
// This check is a UX convenience only; the real enforcement lives server-side
// in every /api/* function, which re-verifies subscription_status itself.
LF.requireActiveSubscription = async function () {
  const user = await LF.getSession();
  if (!user) {
    window.location.href = '/onboarding.html';
    return null;
  }
  const profile = await LF.getProfile(user.id);
  if (!profile || profile.subscription_status !== 'active') {
    window.location.href = '/onboarding.html?step=pricing';
    return null;
  }
  return { user, profile };
};
=== lib/supabaseServer.js ===
// lib/supabaseServer.js — server-side Supabase client helpers.
const { createClient } = require('@supabase/supabase-js');

// A client scoped to the requesting user's own JWT — Row Level Security
// applies exactly as it would in the browser. Use this for anything a
// user does themselves (adding a lead, sending a manual message).
function getUserClient(accessToken) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

async function getUserFromToken(accessToken) {
  const client = getUserClient(accessToken);
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user;
}

// Bypasses Row Level Security entirely. ONLY use inside server code that has
// already verified the request through other means (the Dodo Payments
// webhook, or the public lead-intake endpoint after validating intake_key).
function getServiceClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = { getUserClient, getUserFromToken, getServiceClient };
=== lib/twilio.js ===
// lib/twilio.js — thin wrapper around the Twilio SDK.
const twilio = require('twilio');

function getClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendSms(to, body) {
  const client = getClient();
  return client.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER,
    body,
  });
}

// Click-to-call: rings the business owner's phone first; once they answer,
// Twilio dials the lead and bridges the two calls together.
async function startBridgedCall(yourPhone, leadPhone) {
  const client = getClient();
  return client.calls.create({
    to: yourPhone,
    from: process.env.TWILIO_PHONE_NUMBER,
    twiml: `<Response><Say>Connecting you now.</Say><Dial>${leadPhone}</Dial></Response>`,
  });
}

async function sendWhatsApp(to, body) {
  const client = getClient();
  return client.messages.create({
    to: `whatsapp:${to}`,
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER}`,
    body,
  });
}

module.exports = { sendSms, startBridgedCall, sendWhatsApp };

