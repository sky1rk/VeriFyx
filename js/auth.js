/* VERIFYX authentication UI: real sign-up, email OTP verification and sign-in. */
(function () {
  'use strict';

  var accountType = 'user';
  var pendingEmail = '';
  var adminPasscodeRequired = false;
  var ADMIN_ONLY_PAGES = ['admin-dashboard.html', 'attendance.html', 'examination-verification.html'];
  var USER_ONLY_PAGES = ['user-dashboard.html'];

  function el(id) { return document.getElementById(id); }
  function setText(id, text) { var node = el(id); if (node) node.textContent = text || ''; }
  function clearErrors() { ['loginError', 'signupError', 'otpError'].forEach(function (id) { setText(id, ''); }); }

  function updateAdminPasscodeField() {
    var select = el('accountType');
    var field = el('adminPasscodeField');
    var input = el('adminPasscode');
    if (!select || !field) return;
    var personnel = select.value === 'University Personnel';
    field.classList.toggle('hidden', !personnel);
    if (input) {
      input.disabled = !personnel;
      if (!personnel) input.value = '';
    }
  }

  async function post(path, payload) {
    var res;
    try {
      res = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload || {})
      });
    } catch (e) {
      var offline = new Error('Cannot reach the VERIFYX backend. Start it from the project root with: .\\.venv\\Scripts\\python.exe backend\\app.py');
      offline.code = 'backend_unavailable';
      throw offline;
    }
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error((data && (data.error || data.message)) || 'Request failed (' + res.status + ')');
      err.code = data && data.code;
      err.status = res.status;
      err.data = data || {};
      throw err;
    }
    return data;
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    button.disabled = !!busy;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = label;
    } else if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }

  function setAccountType(type) {
    accountType = type === 'admin' ? 'admin' : 'user';
    $$('.switcher button').forEach(function (b) { b.classList.toggle('active', b.dataset.type === accountType); });
    setText('authHeading', accountType === 'admin' ? 'Administrator sign in' : 'Welcome back');
    setText('identityLabel', accountType === 'admin' ? 'Administrator email or ID' : 'Student number / Employee ID');
    var reg = el('registerLink');
    if (reg) reg.classList.toggle('hidden', accountType === 'admin');
    setText('authDescription', accountType === 'admin'
      ? 'Sign in with your authorized administrator account.'
      : 'Sign in to access your VERIFYX account.');
    clearErrors();
  }

  function storeSession(user) {
    sessionStorage.setItem('verifyxUser', JSON.stringify({
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
    }));
  }

  function redirectFor(user) {
    var allowed = [
      'user-dashboard.html', 'admin-dashboard.html', 'face-enrollment.html',
      'attendance.html', 'examination-verification.html', 'attendance-history.html',
      'my-profile.html', 'settings.html'
    ];
    var next = new URLSearchParams(location.search).get('next') || '';
    var adminOnly = ADMIN_ONLY_PAGES.indexOf(next) !== -1;
    var userOnly = USER_ONLY_PAGES.indexOf(next) !== -1;
    if (allowed.indexOf(next) !== -1 && (!adminOnly || user.role === 'admin') && (!userOnly || user.role === 'user')) {
      location.href = next;
      return;
    }
    location.href = user.role === 'admin' ? 'admin-dashboard.html' : 'user-dashboard.html';
  }

  function showOtpPanel(email, message) {
    pendingEmail = email || pendingEmail;
    setText('otpEmail', pendingEmail);
    setText('otpStatus', message || 'Enter the 6-digit code sent to your email.');
    var panel = el('otpPanel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    ['loginForm', 'signupForm'].forEach(function (id) {
      var form = el(id);
      if (form) form.classList.add('hidden');
    });
    var code = el('otpCode');
    if (code) code.focus();
  }

  function startCooldown(seconds) {
    var button = el('resendOtp');
    if (!button) return;
    var remaining = Math.max(1, Math.ceil(Number(seconds) || 60));
    var label = button.dataset.label || button.textContent;
    button.dataset.label = label;
    button.dataset.cooldown = '1';
    button.disabled = true;
    button.textContent = 'Resend in ' + remaining + 's';
    var timer = setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        delete button.dataset.cooldown;
        button.disabled = false;
        button.textContent = button.dataset.label || label;
      } else {
        button.textContent = 'Resend in ' + remaining + 's';
      }
    }, 1000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    $$('.switcher button').forEach(function (b) {
      b.addEventListener('click', function () { setAccountType(b.dataset.type); });
    });
    var next = new URLSearchParams(location.search).get('next') || '';
    if (next.indexOf('admin-') === 0 && el('loginForm')) setAccountType('admin');

    if (el('signupForm')) {
      var category = el('accountType');
      if (category) category.addEventListener('change', updateAdminPasscodeField);
      updateAdminPasscodeField();
      fetch('/api/auth/config', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (config) {
          if (!config) return;
          adminPasscodeRequired = !!(config.admin_request_passcode_required || config.faculty_passcode_required);
          var label = document.querySelector('#adminPasscodeField label');
          if (label) label.textContent = adminPasscodeRequired ? 'Access passcode *' : 'Access passcode (optional)';
        })
        .catch(function () {});
    }

    var login = el('loginForm');
    if (login) login.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors();
      var identity = el('identity').value.trim();
      var password = el('password').value;
      if (!identity || !password) { setText('loginError', 'Please enter your ID or email and password.'); return; }
      var button = login.querySelector('[type="submit"]');
      setBusy(button, true, 'Signing in…');
      try {
        var data = await post('/api/auth/signin', { identity: identity, password: password, role: accountType });
        storeSession(data.user);
        toast('Signed in successfully.');
        redirectFor(data.user);
      } catch (err) {
        if (err.code === 'email_not_verified' && err.data.email) {
          showOtpPanel(err.data.email, 'Your account is not verified yet. Enter the code sent to your email to activate it.');
        } else if (err.code === 'wrong_account_type') {
          setText('loginError', 'Use the ' + (accountType === 'admin' ? 'USER' : 'ADMIN') + ' tab for this account.');
        } else {
          setText('loginError', err.message);
        }
      } finally {
        setBusy(button, false);
      }
    });

    var signup = el('signupForm');
    if (signup) signup.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors();
      var password = el('newPassword').value;
      var category = el('accountType').value;
      var adminPasscode = el('adminPasscode') ? el('adminPasscode').value.trim() : '';
      if (password !== el('confirmPassword').value) { setText('signupError', 'Passwords do not match.'); return; }
      if (category === 'University Personnel' && adminPasscodeRequired && !adminPasscode) {
        setText('signupError', 'Access passcode is required for University Personnel registration.');
        return;
      }
      if (!el('agreeTerms').checked) { setText('signupError', 'Please review and accept the Terms and Conditions.'); return; }

      var payload = {
        full_name: el('fullName').value.trim(),
        student_id: el('studentId').value.trim(),
        account_type: category,
        email: el('email').value.trim(),
        department: el('department').value.trim(),
        program: el('program').value.trim(),
        password: password,
        confirm_password: el('confirmPassword').value
      };
      if (category === 'University Personnel' && adminPasscode) payload.admin_passcode = adminPasscode;
      var button = signup.querySelector('[type="submit"]');
      setBusy(button, true, 'Creating account…');
      try {
        var data = await post('/api/auth/signup', payload);
        showOtpPanel(data.email, 'Account created. Enter the one-time PIN sent to your email to verify it.');
      } catch (err) {
        setText('signupError', err.message);
      } finally {
        setBusy(button, false);
      }
    });

    var otpForm = el('otpForm');
    if (otpForm) otpForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors();
      var code = (el('otpCode').value || '').trim();
      if (!/^\d{6}$/.test(code)) { setText('otpError', 'Enter the 6-digit code from your email.'); return; }
      var button = otpForm.querySelector('[type="submit"]');
      setBusy(button, true, 'Verifying…');
      try {
        await post('/api/auth/verify-otp', { email: pendingEmail, code: code });
        setText('otpStatus', 'Email verified successfully. Redirecting to sign in…');
        var done = el('otpDone');
        if (done) done.classList.remove('hidden');
        try { sessionStorage.setItem('verifyxToast', 'Email successfully verified. You may now log in'); } catch (e) {}
        location.href = 'signin.html?verified=1';
      } catch (err) {
        setText('otpError', err.message);
      } finally {
        setBusy(button, false);
      }
    });

    var resend = el('resendOtp');
    if (resend) resend.addEventListener('click', async function () {
      if (!pendingEmail || resend.dataset.cooldown) return;
      var retryAfter = null;
      var resent = false;
      var button = resend;
      setBusy(button, true, 'Sending…');
      try {
        var data = await post('/api/auth/resend-otp', { email: pendingEmail });
        setText('otpStatus', 'A new code was sent to ' + data.email + '.');
        resent = true;
      } catch (err) {
        if (err.code === 'otp_throttled') {
          retryAfter = err.data.retry_after || 60;
          setText('otpStatus', 'Please wait before requesting another code.');
        } else {
          setText('otpError', err.message);
        }
      } finally {
        setBusy(button, false);
        if (retryAfter !== null) startCooldown(retryAfter);
        else if (resent) startCooldown(60);
      }
    });

    var otpBack = el('otpBack');
    if (otpBack) otpBack.addEventListener('click', function () { location.href = 'signin.html'; });

    $$('.toggle-password').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = document.getElementById(b.dataset.target);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        b.textContent = input.type === 'password' ? 'Show' : 'Hide';
      });
    });
  });
})();
