/* VERIFYX shared profile logic.
   Frontend demonstration only: localStorage is NOT secure storage.
   Never store passwords or real biometric data here. */
(function () {
  'use strict';

  var USER_KEY = 'verifyx_user';
  var PREFS_KEY = 'verifyx_preferences';

  var DEFAULT_PREFS = {
    notifyAttendance: true,
    notifyExam: true,
    notifySecurity: true,
    notifyAnnouncements: false,
    sessionNotifications: true
  };

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function readSession() {
    try { return safeParse(sessionStorage.getItem('verifyxUser')); } catch (e) { return null; }
  }

  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s'-])([a-z])/g, function (m, a, b) {
      return a + b.toUpperCase();
    });
  }

  function hashNumber(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
    return h;
  }

  /* Build a default demo profile from the sign-in session (if any). */
  function buildDefaultUser(session) {
    var loginId = session && session.id ? String(session.id) : 'guest';
    var firstName = 'Demo';
    var lastName = 'Student';
    var email = 'demo.student@example.edu';
    if (loginId.indexOf('@') > -1) {
      var local = loginId.split('@')[0];
      var parts = local.split(/[._-]+/).filter(Boolean);
      if (parts.length) { firstName = titleCase(parts[0]); }
      if (parts.length > 1) { lastName = titleCase(parts[parts.length - 1]); }
      email = loginId;
    }
    var isEmployee = /^emp/i.test(loginId);
    if (isEmployee) { lastName = 'Employee'; }
    return {
      loginId: loginId,
      firstName: firstName,
      middleName: '',
      lastName: lastName,
      studentId: loginId.indexOf('@') > -1 ? '' : loginId,
      email: email,
      contact: '',
      college: '',
      program: '',
      yearLevel: '',
      accountType: isEmployee ? 'Employee' : 'Student',
      role: session && session.role ? session.role : 'user',
      userId: 'VX-' + String(100000 + (hashNumber(loginId) % 900000)),
      accountStatus: 'Active',
      registeredAt: new Date().toISOString(),
      photo: null
    };
  }

  function writeUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadUser() {
    var session = readSession();
    var stored = null;
    try { stored = safeParse(localStorage.getItem(USER_KEY)); } catch (e) { stored = null; }
    var sessionId = session && session.id ? String(session.id) : null;
    var valid = stored && typeof stored === 'object' && typeof stored.firstName === 'string';
    /* A different sign-in identity starts a fresh demo profile. */
    if (!valid || (sessionId && stored.loginId && stored.loginId !== sessionId)) {
      var fresh = buildDefaultUser(session);
      writeUser(fresh);
      return fresh;
    }
    var merged = buildDefaultUser(session);
    Object.keys(stored).forEach(function (k) { merged[k] = stored[k]; });
    return merged;
  }

  function saveUser(patch) {
    var user = loadUser();
    Object.keys(patch || {}).forEach(function (k) { user[k] = patch[k]; });
    var ok = writeUser(user);
    if (ok) { refreshAll(); }
    return { ok: ok, user: user };
  }

  function fullName(user, includeMiddle) {
    user = user || loadUser();
    var parts = [user.firstName];
    if (includeMiddle && user.middleName) { parts.push(user.middleName); }
    parts.push(user.lastName);
    return parts.filter(function (p) { return p && String(p).trim(); }).join(' ').trim();
  }

  /* Initials from first and last name (middle names are ignored). */
  function getInitials(user) {
    user = user || loadUser();
    var f = String(user.firstName || '').trim();
    var l = String(user.lastName || '').trim();
    if (f && l) { return (f.charAt(0) + l.charAt(0)).toUpperCase(); }
    var single = f || l;
    if (single) { return single.slice(0, 2).toUpperCase(); }
    return '?';
  }

  /* Also usable with a single full-name string. */
  function initialsFromName(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) { return '?'; }
    if (parts.length === 1) { return parts[0].slice(0, 2).toUpperCase(); }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function renderAvatar(el, user, overrides) {
    if (!el) { return; }
    user = user || loadUser();
    var photo = overrides && 'photo' in overrides ? overrides.photo : user.photo;
    var initials = overrides && overrides.initials ? overrides.initials : getInitials(user);
    var name = fullName(user);
    while (el.firstChild) { el.removeChild(el.firstChild); }
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', name ? name + ' profile picture' : 'Profile picture');
    if (photo) {
      var img = document.createElement('img');
      img.src = photo;
      img.alt = '';
      el.appendChild(img);
      el.classList.add('has-photo');
    } else {
      var span = document.createElement('span');
      span.className = 'initials';
      span.textContent = initials;
      el.appendChild(span);
      el.classList.remove('has-photo');
    }
  }

  function updateAvatars(user) {
    user = user || loadUser();
    var nodes = document.querySelectorAll('[data-user-avatar], .app-top .avatar');
    for (var i = 0; i < nodes.length; i++) {
      /* The profile page manages its own large avatar while editing. */
      if (nodes[i].hasAttribute('data-avatar-manual')) { continue; }
      renderAvatar(nodes[i], user);
    }
  }

  function updateTopNav(user) {
    user = user || loadUser();
    var name = fullName(user);
    var nameNodes = document.querySelectorAll('.app-top #displayName, [data-user-name]');
    for (var i = 0; i < nameNodes.length; i++) { nameNodes[i].textContent = name; }
    var idNodes = document.querySelectorAll('.app-top #displayId, [data-user-id]');
    for (var j = 0; j < idNodes.length; j++) {
      idNodes[j].textContent = user.studentId || user.userId;
    }
    var greet = document.querySelectorAll('[data-user-first]');
    for (var k = 0; k < greet.length; k++) { greet[k].textContent = user.firstName || 'there'; }
    updateAvatars(user);
  }

  function refreshAll() {
    var user = loadUser();
    updateTopNav(user);
    document.dispatchEvent(new CustomEvent('verifyx:profile-updated', { detail: user }));
  }

  /* Preferences */
  function getPrefs() {
    var stored = null;
    try { stored = safeParse(localStorage.getItem(PREFS_KEY)); } catch (e) { stored = null; }
    var prefs = {};
    Object.keys(DEFAULT_PREFS).forEach(function (k) {
      prefs[k] = stored && typeof stored[k] === 'boolean' ? stored[k] : DEFAULT_PREFS[k];
    });
    return prefs;
  }

  function savePrefs(patch) {
    var prefs = getPrefs();
    Object.keys(patch || {}).forEach(function (k) {
      if (k in DEFAULT_PREFS) { prefs[k] = !!patch[k]; }
    });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      return { ok: true, prefs: prefs };
    } catch (e) {
      return { ok: false, prefs: prefs };
    }
  }

  /* Validation shared by the profile form */
  function validateProfile(values) {
    var errors = {};
    var nameRe = /^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F .'-]*$/;
    var first = String(values.firstName || '').trim();
    var middle = String(values.middleName || '').trim();
    var last = String(values.lastName || '').trim();
    var id = String(values.studentId || '').trim();
    var email = String(values.email || '').trim();
    var contact = String(values.contact || '').replace(/[\s-]/g, '');

    if (!first) { errors.firstName = 'First name is required.'; }
    else if (first.length > 50 || !nameRe.test(first)) { errors.firstName = 'Use letters, spaces, apostrophes, periods, or hyphens only.'; }
    if (middle && (middle.length > 50 || !nameRe.test(middle))) { errors.middleName = 'Use letters, spaces, apostrophes, periods, or hyphens only.'; }
    if (!last) { errors.lastName = 'Last name is required.'; }
    else if (last.length > 50 || !nameRe.test(last)) { errors.lastName = 'Use letters, spaces, apostrophes, periods, or hyphens only.'; }
    if (!id) { errors.studentId = 'Student or employee ID is required.'; }
    else if (!/^[A-Za-z0-9-]{3,20}$/.test(id)) { errors.studentId = 'Use 3 to 20 letters, numbers, or hyphens.'; }
    if (!email) { errors.email = 'Email address is required.'; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { errors.email = 'Enter a valid email address.'; }
    if (contact && !/^(\+?63|0)9\d{9}$/.test(contact)) { errors.contact = 'Use a Philippine mobile number, for example 0917 123 4567.'; }
    return errors;
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return '-'; }
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* Sidebar: highlight the active page without relying on per-page markup. */
  function markActiveNav() {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var links = document.querySelectorAll('.sidebar .side-nav a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = (links[i].getAttribute('href') || '').split('#')[0].toLowerCase();
      if (!href || href === '#') { continue; }
      var isActive = href === page;
      links[i].classList.toggle('active', isActive);
      if (isActive) { links[i].setAttribute('aria-current', 'page'); }
      else { links[i].removeAttribute('aria-current'); }
    }
  }

  function init() {
    updateTopNav(loadUser());
    markActiveNav();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('storage', function (e) {
    if (e.key === USER_KEY) { refreshAll(); }
  });

  window.VX = {
    USER_KEY: USER_KEY,
    PREFS_KEY: PREFS_KEY,
    loadUser: loadUser,
    saveUser: saveUser,
    fullName: fullName,
    getInitials: getInitials,
    initialsFromName: initialsFromName,
    renderAvatar: renderAvatar,
    updateAvatars: updateAvatars,
    updateTopNav: updateTopNav,
    getPrefs: getPrefs,
    savePrefs: savePrefs,
    validateProfile: validateProfile,
    formatDate: formatDate
  };
})();
