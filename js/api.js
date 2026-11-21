/* VERIFYX frontend API client (dynamic enrollment). */
(function () {
  'use strict';

  var BASE = window.VERIFYX_API_BASE || '';

  async function request(path, options) {
    options = options || {};
    var url = BASE + path;
    var res;
    try {
      res = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { 'Accept': 'application/json' } }, options));
    } catch (e) {
      var err = new Error('Cannot reach VERIFYX backend. Start it with: .\\.venv\\Scripts\\python.exe backend\\app.py (from project root), then open http://127.0.0.1:5000/');
      err.cause = e;
      throw err;
    }
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      var msg = (data && (data.error || data.message)) || ('Request failed (' + res.status + ')');
      var ex = new Error(msg);
      ex.status = res.status;
      ex.data = data;
      throw ex;
    }
    return data;
  }

  async function get(path) { return request(path, { method: 'GET' }); }
  async function post(path, body) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body || {})
    });
  }

  function captureFrame(video) {
    if (!video || video.readyState < 2) return null;
    var w = video.videoWidth || 640;
    var h = video.videoHeight || 480;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.92);
  }

  function getProfileMeta() {
    try {
      if (window.VX && typeof window.VX.loadUser === 'function') {
        var u = window.VX.loadUser();
        return {
          user_id: u.studentId || u.loginId || u.userId,
          user_name: window.VX.fullName ? window.VX.fullName(u) : ((u.firstName || '') + ' ' + (u.lastName || '')).trim(),
          profile: u
        };
      }
    } catch (e) {}
    try {
      var s = JSON.parse(sessionStorage.getItem('verifyxUser') || 'null');
      if (s) return { user_id: s.id || 'anonymous', user_name: s.name || s.id || 'User', profile: s };
    } catch (e) {}
    return { user_id: 'anonymous', user_name: 'Anonymous', profile: {} };
  }

  window.VXAPI = {
    get: get,
    post: post,
    request: request,
    captureFrame: captureFrame,
    getProfileMeta: getProfileMeta,
    health: function () { return get('/api/health'); },
    me: function () { return get('/api/auth/me'); },
    signin: function (identity, password, role) { return post('/api/auth/signin', { identity: identity, password: password, role: role || 'user' }); },
    signup: function (profile) { return post('/api/auth/signup', profile); },
    verifyOtp: function (email, code) { return post('/api/auth/verify-otp', { email: email, code: code }); },
    resendOtp: function (email) { return post('/api/auth/resend-otp', { email: email }); },
    signout: function () { return post('/api/auth/signout', {}); },
    changePassword: function (currentPassword, newPassword) { return post('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword }); },
    modelInfo: function () { return get('/api/model/info'); },
    recognize: function (image, extra) { return post('/api/recognize', Object.assign({ image: image }, extra || {})); },
    // Dynamic enrollment: requires name; person_id optional (re-enroll/add samples)
    enroll: function (image, payload) {
      payload = payload || {};
      if (typeof payload === 'string') payload = { name: payload };
      return post('/api/enroll', Object.assign({ image: image }, payload));
    },
    listPeople: function () { return get('/api/people'); },
    getPerson: function (personId) { return get('/api/people/' + encodeURIComponent(personId)); },
    getEnrollment: function (personId) { return get('/api/enrollment/' + encodeURIComponent(personId)); },
    recordAttendance: function (image, meta) { return post('/api/attendance', { image: image, meta: meta || {} }); },
    verifyExam: function (image, meta) { return post('/api/verify-exam', { image: image, meta: meta || {} }); },
    listAttendance: function (personId) { return get('/api/attendance' + (personId ? ('?person_id=' + encodeURIComponent(personId)) : '')); }
  };
})();