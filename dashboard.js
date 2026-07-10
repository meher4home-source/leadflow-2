/* dashboard.js — sidebar nav, stats, lead lists, calls/WhatsApp, settings */

let _profile = null;
let _allLeads = [];
let _currentFilter = 'all';

const PAGE_INFO = {
  dashboard: { title: 'Dashboard', sub: 'Overview of your leads' },
  leads: { title: 'All Leads', sub: 'Every lead, all statuses' },
  calls: { title: 'Calls & WhatsApp', sub: 'Reach out to your leads directly' },
  settings: { title: 'Settings', sub: 'Manage your business and account' },
};

function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.sb-item[data-tab]').forEach((b) => {
    b.classList.toggle('act', b.dataset.tab === tab);
  });
  document.getElementById('pageTitle').textContent = PAGE_INFO[tab].title;
  document.getElementById('pageSub').textContent = PAGE_INFO[tab].sub;
  if (tab === 'calls') populateToolSelects();
}

function badgeFor(classification) {
  if (classification === 'high_paying') return { cls: 'badge-high', text: 'High-Paying' };
  if (classification === 'mid_range') return { cls: 'badge-mid', text: 'Mid-Range' };
  if (classification === 'low_budget') return { cls: 'badge-low', text: 'Low-Budget' };
  return { cls: 'badge-low', text: 'Pending' };
}

function statusLabel(status) {
  const map = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', booked: 'Booked', closed: 'Closed' };
  return map[status] || status;
}

function leadRowHtml(lead) {
  const badge = badgeFor(lead.classification);
  return `
    <div class="lead-row" onclick="openLeadDetail('${lead.id}')">
      <div style="flex:1">
        <div class="lead-name">${escapeHtml(lead.name)}</div>
        <div class="lead-meta">${escapeHtml(lead.phone)} · ${statusLabel(lead.status)}</div>
      </div>
      <span class="badge ${badge.cls}">${badge.text}</span>
      <span class="lead-value">${lead.estimated_value ? '$' + Number(lead.estimated_value).toLocaleString() : '—'}</span>
    </div>`;
}

function renderDashboardTab() {
  const recent = _allLeads.slice(0, 8);
  const el = document.getElementById('dashLeadsList');
  el.innerHTML = recent.length ? recent.map(leadRowHtml).join('') : '<div class="empty">No leads yet. Add one to see LeadFlow in action.</div>';

  document.getElementById('statHigh').textContent = _allLeads.filter((l) => l.classification === 'high_paying').length;
  document.getElementById('statMid').textContent = _allLeads.filter((l) => l.classification === 'mid_range').length;
  document.getElementById('statLow').textContent = _allLeads.filter((l) => l.classification === 'low_budget').length;
  document.getElementById('statTotal').textContent = _allLeads.length;

  const highCount = _allLeads.filter((l) => l.classification === 'high_paying' && l.status !== 'closed').length;
  const badgeEl = document.getElementById('highBadge');
  if (highCount > 0) {
    badgeEl.style.display = 'inline-block';
    badgeEl.textContent = highCount;
  } else {
    badgeEl.style.display = 'none';
  }
}

function filterLeads(filter) {
  _currentFilter = filter;
  document.querySelectorAll('.filter-btn[data-filter]').forEach((b) => {
    b.classList.toggle('act', b.dataset.filter === filter);
  });
  renderLeadsTab();
}

function renderLeadsTab() {
  const el = document.getElementById('leadsList');
  const leads = _currentFilter === 'all' ? _allLeads : _allLeads.filter((l) => l.classification === _currentFilter);
  el.innerHTML = leads.length ? leads.map(leadRowHtml).join('') : '<div class="empty">No leads in this category yet.</div>';
}

async function loadLeads(userId) {
  const { data } = await LF.client
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  _allLeads = data || [];
  renderDashboardTab();
  renderLeadsTab();
}

async function openLeadDetail(leadId) {
  const lead = _allLeads.find((l) => l.id === leadId);
  if (!lead) return;
  await LFChat.open(lead);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openAddLead() {
  document.getElementById('addLeadOverlay').classList.add('open');
}

async function submitAddLead() {
  const name = document.getElementById('newLeadName').value.trim();
  const phone = document.getElementById('newLeadPhone').value.trim();
  const email = document.getElementById('newLeadEmail').value.trim();
  if (!name || !phone) {
    document.getElementById('addLeadErr').innerHTML = '<div class="msg-box msg-error">Name and phone are required.</div>';
    return;
  }
  const { data: sessionData } = await LF.client.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch('/api/leads/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, phone, email, source: 'manual' }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('addLeadErr').innerHTML = `<div class="msg-box msg-error">${data.error || 'Could not add lead.'}</div>`;
    return;
  }
  closeModal('addLeadOverlay');
  document.getElementById('newLeadName').value = '';
  document.getElementById('newLeadPhone').value = '';
  document.getElementById('newLeadEmail').value = '';
  await loadLeads(_profile.id);
}

async function sendManualMessage() {
  const input = document.getElementById('manualMsg');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  await LFChat.send(message);
}

async function saveSettings() {
  const business_name = document.getElementById('setBizName').value.trim();
  const booking_link = document.getElementById('setBooking').value.trim();
  await LF.client.from('profiles').update({ business_name, booking_link }).eq('id', _profile.id);
  document.getElementById('bizNameTag').textContent = business_name;
}

function copyIntakeUrl() {
  const text = document.getElementById('intakeUrl').textContent;
  navigator.clipboard.writeText(text);
  alert('Copied!');
}

/* ── Calls & WhatsApp ── */
function populateToolSelects() {
  const options = _allLeads.map((l) => `<option value="${l.id}">${escapeHtml(l.name)} — ${escapeHtml(l.phone)}</option>`).join('');
  document.getElementById('callLeadSelect').innerHTML = options || '<option>No leads yet</option>';
  document.getElementById('waLeadSelect').innerHTML = options || '<option>No leads yet</option>';
}

function toolsMsg(html) {
  document.getElementById('toolsMsg').innerHTML = html;
}

async function authedFetch(url, body) {
  const { data: sessionData } = await LF.client.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json() };
}

async function startCall() {
  const leadId = document.getElementById('callLeadSelect').value;
  const yourPhone = document.getElementById('callYourPhone').value.trim();
  if (!leadId || !yourPhone) return toolsMsg('<div class="msg-box msg-error">Select a lead and enter your phone number.</div>');
  toolsMsg('<div class="msg-box msg-info">Calling your phone now — stay on the line to be connected...</div>');
  const { res, data } = await authedFetch('/api/calls/start', { leadId, yourPhone });
  if (!res.ok) return toolsMsg(`<div class="msg-box msg-error">${data.error || 'Could not start the call.'}</div>`);
  toolsMsg('<div class="msg-box msg-info">Call started — answer your phone to connect.</div>');
}

async function sendWhatsApp() {
  const leadId = document.getElementById('waLeadSelect').value;
  const message = document.getElementById('waMessage').value.trim();
  if (!leadId || !message) return toolsMsg('<div class="msg-box msg-error">Select a lead and write a message.</div>');
  const { res, data } = await authedFetch('/api/whatsapp/send', { leadId, message });
  if (!res.ok) return toolsMsg(`<div class="msg-box msg-error">${data.error || 'Could not send WhatsApp message.'}</div>`);
  toolsMsg('<div class="msg-box msg-info">WhatsApp message sent.</div>');
  document.getElementById('waMessage').value = '';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function waitForActivationIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') !== 'success') return;
  const user = await LF.getSession();
  if (!user) return;
  for (let i = 0; i < 15; i++) {
    const profile = await LF.getProfile(user.id);
    if (profile && profile.subscription_status === 'active') return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

(async function init() {
  await waitForActivationIfNeeded();

  const result = await LF.requireActiveSubscription();
  if (!result) return;
  _profile = result.profile;

  document.getElementById('bizNameTag').textContent = _profile.business_name || '';
  document.getElementById('userNameTag').textContent = _profile.full_name || _profile.business_name || 'Account';
  document.getElementById('userAvatar').textContent = (_profile.full_name || _profile.business_name || '?').charAt(0).toUpperCase();
  document.getElementById('userPlanTag').textContent = _profile.plan === 'multilocation' ? 'Multi-Location Plan' : 'Standard Plan';

  document.getElementById('setBizName').value = _profile.business_name || '';
  document.getElementById('setBooking').value = _profile.booking_link || '';
  document.getElementById('setPlanText').textContent =
    _profile.plan === 'multilocation' ? 'Multi-Location — $4,997/month' : 'Standard — $1,997/month';
  document.getElementById('intakeUrl').textContent =
    `${window.location.origin}/api/leads/intake?key=${_profile.intake_key}`;

  await loadLeads(_profile.id);
})();
