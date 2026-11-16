/* Settings page: account, notifications, privacy and appearance. */
(function () {
  'use strict';

  var PREF_IDS = ['notifyAttendance', 'notifyExam', 'notifySecurity', 'notifyAnnouncements', 'sessionNotifications'];

  function $(id) { return document.getElementById(id); }

  function browserInfo() {
    var ua = navigator.userAgent || '';
    var browser = 'Browser';
    if (/Edg\//.test(ua)) { browser = 'Microsoft Edge'; }
    else if (/OPR\//.test(ua)) { browser = 'Opera'; }
    else if (/Firefox\//.test(ua)) { browser = 'Firefox'; }
    else if (/Chrome\//.test(ua)) { browser = 'Chrome'; }
    else if (/Safari\//.test(ua)) { browser = 'Safari'; }
    var os = 'Unknown OS';
    if (/Windows/.test(ua)) { os = 'Windows'; }
    else if (/Android/.test(ua)) { os = 'Android'; }
    else if (/iPhone|iPad|iPod/.test(ua)) { os = 'iOS'; }
    else if (/Mac OS X/.test(ua)) { os = 'macOS'; }
    else if (/Linux/.test(ua)) { os = 'Linux'; }
    return browser + ' on ' + os;
  }

  function sessionStart() {
    var key = 'verifyx_session_started';
    var v = null;
    try { v = sessionStorage.getItem(key); } catch (e) { v = null; }
    if (!v) {
      v = new Date().toISOString();
      try { sessionStorage.setItem(key, v); } catch (e) { /* ignore */ }
    }
    var d = new Date(v);
    return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function loadSession() {
    var user = VX.loadUser();
    $('accEmail').value = user.email || '';
    $('sesUser').textContent = user.studentId || user.userId;
    $('sesDevice').textContent = browserInfo() + ' (this device)';
    $('sesStart').textContent = sessionStart();
  }

  function applyPrefs() {
    var prefs = VX.getPrefs();
    PREF_IDS.forEach(function (id) { $(id).checked = !!prefs[id]; });
  }

  function collectPrefs() {
    var p = {};
    PREF_IDS.forEach(function (id) { p[id] = $(id).checked; });
    return p;
  }

  function setErr(id, text) {
    $('err-' + id).textContent = text || '';
    $(id).closest('.field').classList.toggle('has-error', !!text);
    if (text) { $(id).setAttribute('aria-invalid', 'true'); } else { $(id).removeAttribute('aria-invalid'); }
  }

  function onPassword(e) {
    e.preventDefault();
    var cur = $('currentPassword').value;
    var nw = $('newPassword').value;
    var cf = $('confirmPassword').value;
    var bad = null;
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(function (id) { setErr(id, ''); });
    if (!cur) { setErr('currentPassword', 'Enter your current password.'); bad = bad || 'currentPassword'; }
    if (!nw) { setErr('newPassword', 'Enter a new password.'); bad = bad || 'newPassword'; }
    else if (nw.length < 8 || !/[A-Za-z]/.test(nw) || !/[0-9]/.test(nw)) { setErr('newPassword', 'Use at least 8 characters with a letter and a number.'); bad = bad || 'newPassword'; }
    else if (cur && nw === cur) { setErr('newPassword', 'The new password must be different from the current one.'); bad = bad || 'newPassword'; }
    if (!cf) { setErr('confirmPassword', 'Confirm your new password.'); bad = bad || 'confirmPassword'; }
    else if (nw && cf !== nw) { setErr('confirmPassword', 'Passwords do not match.'); bad = bad || 'confirmPassword'; }
    if (bad) { $(bad).focus(); return; }
    /* Demo only: nothing is stored or transmitted. */
    $('passwordForm').reset();
    toast('Password change accepted (demo). No password was stored or sent.');
  }

  function showSaved(ok) {
    var el = $('saveMsg');
    el.textContent = ok ? 'Settings saved successfully.' : 'Could not save settings. Browser storage may be full or disabled.';
    el.style.color = ok ? '' : '#ff8e8e';
    clearTimeout(showSaved.t);
    showSaved.t = setTimeout(function () { el.textContent = ''; }, 4000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadSession();
    applyPrefs();
    /* Toggles persist as soon as they change. */
    PREF_IDS.forEach(function (id) {
      $(id).addEventListener('change', function () {
        var res = VX.savePrefs(collectPrefs());
        if (!res.ok) { toast('Could not save this preference.'); }
      });
    });
    $('saveSettings').addEventListener('click', function () {
      var res = VX.savePrefs(collectPrefs());
      showSaved(res.ok);
      if (res.ok) { toast('Settings saved successfully.'); }
    });
    $('passwordForm').addEventListener('submit', onPassword);
    $('logoutBtn').addEventListener('click', function () { logout(); });
    document.addEventListener('verifyx:profile-updated', loadSession);
  });
})();
