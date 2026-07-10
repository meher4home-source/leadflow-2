/* onboarding.js — multi-step signup → industry → business info → payment flow */

const INDUSTRIES = [
  { key: 'wholesaler', label: 'Real Estate Wholesaler' },
  { key: 'roofing', label: 'Roofing Contractor' },
  { key: 'hvac', label: 'HVAC / Solar Contractor' },
  { key: 'injury_law', label: 'Personal Injury Law Firm' },
  { key: 'dental', label: 'Dental Implant Clinic' },
  { key: 'mortgage', label: 'Mortgage Broker' },
  { key: 'insurance', label: 'Insurance Broker' },
  { key: 'moving', label: 'Moving Company' },
  { key: 'renovation', label: 'Home Renovation Contractor' },
  { key: 'wedding', label: 'Luxury Wedding Planner' },
  { key: 'auto', label: 'Luxury Auto Dealer' },
  { key: 'immigration', label: 'Immigration Consultant' },
  { key: 'other', label: 'Other High-Ticket Business' },
];

let state = { industry: null, plan: 'standard' };

function renderIndustryList() {
  const el = document.getElementById('industryList');
  el.innerHTML = INDUSTRIES.map(
    (i) => `<div class="industry-opt" data-key="${i.key}" onclick="pickIndustry('${i.key}')">${i.label}</div>`
  ).join('');
}

function pickIndustry(key) {
  state.industry = key;
  document.querySelectorAll('.industry-opt').forEach((el) => {
    el.classList.toggle('sel', el.dataset.key === key);
  });
  document.getElementById('industryNext').disabled = false;
}

function selectPlan(plan) {
  state.plan = plan;
  document.getElementById('planStandard').classList.toggle('sel', plan === 'standard');
  document.getElementById('planMulti').classList.toggle('sel', plan === 'multilocation');
}

function showLogin() {
  document.getElementById('step-signup').classList.remove('active');
  document.getElementById('step-login').classList.add('active');
}
function showSignup() {
  document.getElementById('step-login').classList.remove('active');
  document.getElementById('step-signup').classList.add('active');
}

function goStep(n) {
  document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
  const ids = { 1: 'step-signup', 2: 'step-industry', 3: 'step-business', 4: 'step-pricing' };
  document.getElementById(ids[n]).classList.add('active');
  for (let i = 1; i <= 4; i++) {
    document.getElementById('bar' + i).classList.toggle('done', i <= n);
  }
}

function showError(id, message) {
  document.getElementById(id).innerHTML = `<div class="msg-box msg-error">${message}</div>`;
}

async function onboardSignup() {
  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const password = document.getElementById('suPass').value;
  if (!name || !email || !password) return showError('signupErr', 'Please fill in all fields.');
  if (password.length < 6) return showError('signupErr', 'Password must be at least 6 characters.');
  const { error } = await LF.signUp(name, email, password);
  if (error) return showError('signupErr', error.message);
  showError('signupErr', '<div class="msg-box msg-info">Account created — check your email to confirm, then continue.</div>');
  goStep(2);
}

async function onboardLogin() {
  const email = document.getElementById('liEmail').value.trim();
  const password = document.getElementById('liPass').value;
  if (!email || !password) return showError('loginErr', 'Please fill in all fields.');
  const { error } = await LF.signIn(email, password);
  if (error) return showError('loginErr', error.message);
  await resumeAfterAuth();
}

async function onboardGoogle() {
  await LF.signInWithGoogle();
}

async function doForgotPassword() {
  const email = document.getElementById('liEmail').value.trim();
  if (!email) return showError('loginErr', 'Enter your email above first.');
  const { error } = await LF.forgotPassword(email);
  if (error) return showError('loginErr', error.message);
  showError('loginErr', '<div class="msg-box msg-info">Reset link sent — check your email.</div>');
}

async function saveBusinessInfo() {
  const business_name = document.getElementById('bizName').value.trim();
  const booking_link = document.getElementById('bizBooking').value.trim();
  const user = await LF.getSession();
  if (!user) return (window.location.href = '/onboarding.html');
  await LF.client.from('profiles').update({
    industry: state.industry,
    business_name,
    booking_link,
  }).eq('id', user.id);
  goStep(4);
}

async function startCheckout() {
  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true;
  btn.textContent = 'Redirecting…';
  const user = await LF.getSession();
  if (!user) {
    window.location.href = '/onboarding.html';
    return;
  }
  try {
    const { data: sessionData } = await LF.client.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: state.plan }),
    });
    const data = await res.json();
    if (data.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      showError('pricingErr', data.error || 'Could not start checkout. Check your Dodo Payments setup.');
      btn.disabled = false;
      btn.textContent = 'Continue to Payment →';
    }
  } catch (err) {
    showError('pricingErr', 'Something went wrong. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Continue to Payment →';
  }
}

async function resumeAfterAuth() {
  const user = await LF.getSession();
  if (!user) return;
  const profile = await LF.getProfile(user.id);
  if (profile && profile.subscription_status === 'active') {
    window.location.href = '/dashboard.html';
    return;
  }
  if (profile && profile.business_name) {
    goStep(4);
  } else {
    goStep(2);
  }
}

(async function init() {
  renderIndustryList();

  const params = new URLSearchParams(window.location.search);
  if (params.get('plan') === 'multilocation') selectPlan('multilocation');
  else selectPlan('standard');

  goStep(1);
  await resumeAfterAuth();

  if (params.get('step') === 'pricing') {
    const user = await LF.getSession();
    if (user) goStep(4);
  }
})();
