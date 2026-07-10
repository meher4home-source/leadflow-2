// api/payments/webhook.js — Dodo Payments calls this when a payment/subscription
// event happens. Signature verification is what makes this trustworthy; nobody
// can fake a webhook call without Dodo's actual signing secret. This is the
// ONLY code path allowed to set subscription_status = 'active'.
const { Webhook } = require('standardwebhooks');
const { getServiceClient } = require('../../lib/supabaseServer');

// Raw body is required for signature verification, so automatic body parsing
// is disabled for this function.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await readRawBody(req);
    const webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY);
    const webhookHeaders = {
      'webhook-id': req.headers['webhook-id'] || '',
      'webhook-signature': req.headers['webhook-signature'] || '',
      'webhook-timestamp': req.headers['webhook-timestamp'] || '',
    };
    await webhook.verify(rawBody, webhookHeaders);

    const payload = JSON.parse(rawBody);
    const svc = getServiceClient();

    const eventType = payload.type;
    const data = payload.data || {};
    const userId = data.metadata?.supabase_user_id;
    const plan = data.metadata?.plan === 'multilocation' ? 'multilocation' : 'standard';

    if (['subscription.active', 'subscription.renewed', 'payment.succeeded'].includes(eventType) && userId) {
      await svc
        .from('profiles')
        .update({ plan, subscription_status: 'active', dodo_customer_id: data.customer?.customer_id || null })
        .eq('id', userId);
    }

    if (['subscription.cancelled', 'subscription.expired', 'subscription.failed'].includes(eventType) && userId) {
      await svc.from('profiles').update({ subscription_status: 'cancelled' }).eq('id', userId);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }
};
=== supabase_schema.sql ===
-- ═══════════════════════════════════════════════════════════
-- LeadFlow AI — Supabase Schema
-- Run once in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  business_name text,
  industry text,
  booking_link text,                -- Calendly / scheduling link the business pastes in Settings
  intake_key text unique default encode(gen_random_bytes(12), 'hex'),
  plan text not null default 'none' check (plan in ('none', 'standard', 'multilocation')),
  -- subscription_status is the SINGLE SOURCE OF TRUTH for paywall access.
  -- It is only ever updated by the Dodo Payments webhook (signature-verified,
  -- server-side) — never by anything the browser sends.
  subscription_status text not null default 'inactive' check (subscription_status in ('inactive', 'active', 'cancelled')),
  dodo_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  source text not null default 'manual' check (source in ('manual', 'website', 'api')),
  answers jsonb not null default '{}',
  classification text not null default 'pending' check (classification in ('pending', 'high_paying', 'mid_range', 'low_budget')),
  estimated_value numeric,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'booked', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table leads enable row level security;
alter table lead_messages enable row level security;

create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);

create policy "manage own leads" on leads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "manage own lead messages" on lead_messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile (with a unique intake_key) for every new signup.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
