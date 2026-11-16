
let stream = null, detectTimer = null, faceApiReady = false;

async function startCamera(prefix = 'camera') {
  const video = document.getElementById(prefix + 'Video'),
        status = document.getElementById(prefix + 'Status'),
        placeholder = document.getElementById(prefix + 'Placeholder');
  if (!video) { if (typeof toast === 'function') toast('Camera preview is unavailable on this page.'); return; }
  if (!navigator.mediaDevices?.getUserMedia) { if (status) status.textContent = 'Camera access is not supported in this browser.'; return; }
  try {
    if (status) status.textContent = 'Requesting camera permission…';
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    if (placeholder) placeholder.classList.add('hidden');
    if (status) status.textContent = 'Camera active. Initializing face overlay…';
    const live = document.getElementById(prefix + 'Live');
    if (live) live.classList.remove('hidden');
    await loadFaceDetection(prefix);
  } catch (err) {
    if (status) status.textContent = err.name === 'NotAllowedError'
      ? 'Camera permission denied. Allow camera access in your browser settings.'
      : 'Unable to start camera: ' + err.message;
    if (typeof toast === 'function') toast('Camera could not be started.');
  }
}

async function stopCamera(prefix = 'camera') {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (detectTimer) clearInterval(detectTimer);
  const v = document.getElementById(prefix + 'Video');
  if (v) v.srcObject = null;
  const p = document.getElementById(prefix + 'Placeholder');
  if (p) p.classList.remove('hidden');
  const s = document.getElementById(prefix + 'Status');
  if (s) s.textContent = 'Camera stopped.';
  const l = document.getElementById(prefix + 'Live');
  if (l) l.classList.add('hidden');
}

async function loadFaceDetection(prefix) {
  const status = document.getElementById(prefix + 'Status');
  try {
    if (!window.faceapi) {
      await new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
        sc.onload = resolve; sc.onerror = reject; document.head.append(sc);
      });
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
    faceApiReady = true;
    if (status) status.textContent = 'Camera active. Face overlay ready. Use the action button to run LBPH recognition.';
    detectTimer = setInterval(async () => {
      const video = document.getElementById(prefix + 'Video');
      if (!video || video.readyState < 2) return;
      try {
        const result = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: .45 }));
        const s = document.getElementById(prefix + 'Status');
        const live = document.getElementById(prefix + 'Live');
        if (result.length) {
          if (s && !s.dataset.busy) s.textContent = 'Face detected in preview. Ready for LBPH recognition.';
          if (live) live.textContent = '● FACE DETECTED';
        } else {
          if (s && !s.dataset.busy) s.textContent = 'Camera active. No face detected in preview.';
          if (live) live.textContent = '● LIVE SCANNING';
        }
      } catch (e) {
        if (status && !status.dataset.busy) status.textContent = 'Camera active. Preview overlay unavailable.';
      }
    }, 900);
  } catch (e) {
    if (status) status.textContent = 'Camera active. Preview overlay could not load; LBPH recognition still works.';
  }
}

function setBusyStatus(prefix, msg) {
  const s = document.getElementById(prefix + 'Status');
  if (s) { s.dataset.busy = '1'; s.textContent = msg; }
}
function clearBusyStatus(prefix, msg) {
  const s = document.getElementById(prefix + 'Status');
  if (s) { delete s.dataset.busy; if (msg) s.textContent = msg; }
}

function renderRecognitionResult(containerId, kind, result, extra) {
  const el = document.getElementById(containerId);
  if (!el) return;
  extra = extra || {};
  const r = result || {};
  const accepted = !!r.accepted;
  const faceFound = !!r.face_found;
  const dist = (r.distance != null) ? Number(r.distance).toFixed(2) : 'n/a';
  const thr = (r.threshold != null) ? Number(r.threshold).toFixed(2) : 'n/a';
  const title = !faceFound ? 'NO FACE DETECTED'
              : accepted ? 'IDENTITY MATCHED (LBPH)'
              : 'NO CONFIDENT MATCH';
  const cls = accepted ? 'lime' : (faceFound ? 'accent' : 'warn');
  const who = r.name || 'Unknown';
  const label = (r.label != null) ? r.label : 'n/a';
  const note = r.message || '';
  const eventLine = extra.event ? `<p><b>Event:</b> ${extra.event}</p>` : '';
  const saved = extra.saved ? `<p><b>Record:</b> ${extra.saved}</p>` : '';
  el.innerHTML =
    `<h4 class="${cls}">${title}</h4>` +
    eventLine +
    `<p><b>Recognized identity:</b> ${who} <span class="muted">(label ${label})</span></p>` +
    `<p><b>LBPH distance:</b> ${dist} &nbsp; <b>Threshold:</b> ${thr} &nbsp; <b>Face found:</b> ${faceFound ? 'Yes' : 'No'}</p>` +
    (note ? `<p class="muted">${note}</p>` : '') +
    saved +
    `<p class="muted" style="margin-top:8px;font-size:12px">Local LBPH recognizer trained on enrolled faces. Lower distance means a closer match; accepted when distance ≤ threshold.</p>`;
}

async function captureAndRecognize(kind) {
  const prefix = 'camera';
  const video = document.getElementById(prefix + 'Video');
  if (!video || !video.srcObject) {
    if (typeof toast === 'function') toast('Start the camera first.');
    return null;
  }
  if (!window.VXAPI) {
    if (typeof toast === 'function') toast('API client not loaded. Refresh the page served by the VERIFYX backend.');
    return null;
  }
  const frame = window.VXAPI.captureFrame(video);
  if (!frame) { if (typeof toast === 'function') toast('Could not capture a frame. Is the camera active?'); return null; }
  return frame;
}

// Backward-compatible fallback if called directly
function demoVerify(kind) {
  if (typeof toast === 'function') toast('Use the backend-powered action buttons to run LBPH recognition.');
}
