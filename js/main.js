/* VERIFYX shared UI helpers and client-side session guard.
   The Flask backend is authoritative: dashboard pages and APIs check the
   HttpOnly session cookie. This guard keeps the UI in sync and redirects early. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ADMIN_ONLY_PAGES = new Set(['admin-dashboard.html', 'attendance.html', 'examination-verification.html']);
const USER_ONLY_PAGES = new Set(['user-dashboard.html']);
const ADMIN_ONLY_LINKS = ['admin-dashboard.html', 'attendance.html', 'examination-verification.html'];

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

function handleVerificationRedirect() {
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  if (params.get('verified') !== '1') return;
  var message = 'Email successfully verified. You may now log in';
  try {
    var stored = sessionStorage.getItem('verifyxToast');
    if (stored) { message = stored; sessionStorage.removeItem('verifyxToast'); }
  } catch (e) {}
  toast(message);
  params.delete('verified');
  var query = params.toString();
  try { history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash); } catch (e) {}
}

function initScrollSpy() {
  var nav = document.getElementById('navLinks');
  if (!nav) return;

  var items = [];
  $$('a', nav).forEach(function (link) {
    var href = link.getAttribute('href') || '';
    var section = null;
    if (href.charAt(0) === '#' && href.length > 1) section = document.getElementById(href.slice(1));
    else if (href.indexOf('index.html') === 0 || href === '') section = document.querySelector('.hero') || document.querySelector('main');
    if (section) items.push({ link: link, section: section });
  });
  if (!items.length) return;

  var hovered = null;

  function setActive(item) {
    items.forEach(function (entry) { entry.link.classList.toggle('active', entry === item); });
  }

  function scrollActive() {
    var header = document.querySelector('.topnav');
    var marker = window.scrollY + (header ? header.offsetHeight : 76) + Math.round(window.innerHeight * 0.25);
    var active = items[0];
    items.forEach(function (entry) {
      if (entry.section.getBoundingClientRect().top + window.scrollY <= marker) active = entry;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      active = items[items.length - 1];
    }
    return active;
  }

  function refresh() { setActive(hovered || scrollActive()); }

  items.forEach(function (entry) {
    entry.section.addEventListener('mouseenter', function () { hovered = entry; setActive(entry); });
    entry.section.addEventListener('mouseleave', function () {
      if (hovered === entry) { hovered = null; refresh(); }
    });
  });

  window.addEventListener('scroll', function () { hovered = null; refresh(); }, { passive: true });
  window.addEventListener('resize', refresh);
  refresh();
}

function wireCommon() {
  $$('.modal-backdrop').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));
  $$('[data-modal]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.modal)));
  $$('[data-close-modal]').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.modal-backdrop')?.id)));
  $$('[data-toast]').forEach(b => b.addEventListener('click', () => toast(b.dataset.toast)));
  const toggle = $('#mobileToggle');
  if (toggle) toggle.addEventListener('click', () => $('#navLinks')?.classList.toggle('open'));
}

function currentUser() {
  try { return JSON.parse(sessionStorage.getItem('verifyxUser') || 'null'); }
  catch (e) { return null; }
}

function sessionFromServer(user) {
  return {
    id: user.student_id || user.email,
    name: user.full_name,
    role: user.role,
    verified: user.verified,
    email: user.email,
    student_id: user.student_id,
    account_type: user.account_type,
    department: user.department,
    program: user.program,
    user_id: user.user_id
  };
}

async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const data = await res.json();
    return data && data.authenticated ? data.user : null;
  } catch (e) {
    return null;
  }
}

function requireLogin() {
  const user = currentUser();
  if (!user) {
    const page = (location.pathname.split('/').pop() || '').toLowerCase();
    location.replace('signin.html?next=' + encodeURIComponent(page));
    return false;
  }
  return true;
}

async function logout() {
  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
  } catch (e) { /* Still clear the local session if the server is unreachable. */ }
  sessionStorage.removeItem('verifyxUser');
  try { localStorage.removeItem('verifyx_user'); } catch (e) {}
  location.replace('signin.html');
}

function applyRoleBasedUI(user) {
  const isAdmin = user.role === 'admin';
  if (!isAdmin) {
    ADMIN_ONLY_LINKS.forEach(function (href) {
      $$('a[href="' + href + '"]').forEach(function (link) { link.remove(); });
    });
    $$('a[href="attendance-history.html"] .nav-text').forEach(function (node) {
      if (node.textContent.trim() === 'Attendance History') node.textContent = 'My Records';
    });
  } else {
    $$('a[href="user-dashboard.html"]').forEach(function (link) {
      link.href = 'admin-dashboard.html';
      const text = link.querySelector('.nav-text');
      if (text && text.textContent.trim() === 'Overview') link.title = 'Admin overview';
    });
  }
  $$('[data-admin-only]').forEach(function (node) { if (!isAdmin) node.remove(); });
}

function applyUserToPage(user) {
  const session = sessionFromServer(user);
  sessionStorage.setItem('verifyxUser', JSON.stringify(session));
  const nameNode = $('#displayName');
  if (nameNode) nameNode.textContent = session.name;
  const idNode = $('#displayId');
  if (idNode) idNode.textContent = session.student_id || session.email;
  const roleNode = $('#displayRole');
  if (roleNode) roleNode.textContent = (session.role || '').toUpperCase();
  applyRoleBasedUI(user);
  setupAdminRequestCard(user);
  if (window.VX && typeof window.VX.refreshAll === 'function') window.VX.refreshAll();
  document.dispatchEvent(new CustomEvent('verifyx:auth-ready', { detail: user }));
}

async function setupAdminRequestCard(user) {
  const card = document.getElementById('adminRequestCard');
  var requestTypes = ['University Personnel', 'Faculty'];
  if (!card || user.role === 'admin' || requestTypes.indexOf(user.account_type) === -1) return;

  card.classList.remove('hidden');
  const statusNode = document.getElementById('adminRequestStatus');
  const messageNode = document.getElementById('adminRequestMessage');
  const errorNode = document.getElementById('adminRequestError');
  const button = document.getElementById('requestAdminBtn');
  const refresh = document.getElementById('refreshAdminRequestBtn');
  const passField = document.getElementById('adminRequestPasscodeField');
  const passInput = document.getElementById('adminRequestPasscode');
  let currentStatus = null;
  let passcodeRequired = false;

  try {
    const configRes = await fetch('/api/auth/config', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const config = await configRes.json();
    passcodeRequired = !!(config && (config.admin_request_passcode_required || config.faculty_passcode_required));
    if (passcodeRequired && passField) passField.classList.remove('hidden');
  } catch (e) { /* The backend will still validate any supplied passcode. */ }

  async function loadStatus() {
    try {
      const res = await fetch('/api/auth/admin-request', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const data = await res.json();
      const request = data && data.request;
      currentStatus = request ? request.status : null;
      if (!request) {
        if (statusNode) { statusNode.textContent = 'NOT SENT'; statusNode.className = 'status warn'; }
        if (messageNode) messageNode.textContent = 'Verify your email, then request administrator access. Your approval links will be emailed to the administrator.';
        if (button) { button.disabled = false; button.textContent = 'Request Admin Access'; }
        return;
      }
      if (statusNode) {
        statusNode.textContent = request.status.toUpperCase();
        statusNode.className = 'status ' + (request.status === 'approved' ? 'ok' : request.status === 'rejected' ? 'bad' : 'warn');
      }
      if (messageNode) {
        if (request.status === 'pending') {
          messageNode.textContent = 'Request ' + request.request_id + ' is awaiting administrator review. Approval links expire ' + request.expires_at_iso + '. You can resend the email if needed.';
        } else if (request.status === 'approved') {
          messageNode.textContent = 'Administrator access approved. Reload the dashboard to see administrator features.';
        } else if (request.status === 'rejected') {
          messageNode.textContent = 'The last request was rejected. You may submit a new request if needed.';
        } else {
          messageNode.textContent = 'The last request expired. Submit a new request to continue.';
        }
      }
      if (button) {
        button.disabled = false;
        button.textContent = request.status === 'approved' ? 'Reload dashboard'
          : request.status === 'pending' ? 'Resend approval email'
          : request.status === 'rejected' ? 'Request Again' : 'Submit New Request';
      }
    } catch (e) {
      if (errorNode) errorNode.textContent = 'Could not load the request status.';
    }
  }

  if (button) button.addEventListener('click', async function () {
    if (errorNode) errorNode.textContent = '';
    if (currentStatus === 'approved') { location.reload(); return; }
    const payload = {};
    if (passcodeRequired && passInput) payload.admin_passcode = passInput.value.trim();
    if (passcodeRequired && !payload.admin_passcode) {
      if (errorNode) errorNode.textContent = 'Enter the administrator access passcode.';
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      const res = await fetch('/api/auth/request-admin', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data && (data.error || data.message)) || 'Request failed.');
      if (passInput) passInput.value = '';
      toast('Approval links were sent to the administrator.');
    } catch (e) {
      if (errorNode) errorNode.textContent = e.message || 'Could not send the request.';
    } finally {
      button.disabled = false;
      button.textContent = original;
      await loadStatus();
    }
  });

  if (refresh) refresh.addEventListener('click', loadStatus);
  await loadStatus();
}

async function initAuthGuard() {
  // Only application pages (they all use .app-shell) require a session.
  if (!document.querySelector('.app-shell')) return;

  const user = await fetchCurrentUser();
  if (!user) {
    const page = (location.pathname.split('/').pop() || '').toLowerCase();
    location.replace('signin.html?next=' + encodeURIComponent(page));
    return;
  }

  const page = (location.pathname.split('/').pop() || '').toLowerCase();
  if (ADMIN_ONLY_PAGES.has(page) && user.role !== 'admin') { location.replace('user-dashboard.html'); return; }
  if (USER_ONLY_PAGES.has(page) && user.role !== 'user') { location.replace('admin-dashboard.html'); return; }

  applyUserToPage(user);
}

document.addEventListener('DOMContentLoaded', () => {
  wireCommon();
  handleVerificationRedirect();
  initScrollSpy();
  initAuthGuard();
});

window.VXAuth = { currentUser, fetchCurrentUser, requireLogin, logout };
