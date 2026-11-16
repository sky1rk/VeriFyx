document.addEventListener('DOMContentLoaded', () => {
  $('#startCamera')?.addEventListener('click', () => startCamera('camera'));
  $('#stopCamera')?.addEventListener('click', () => stopCamera('camera'));

  $('#startVerify')?.addEventListener('click', () => runExamVerification());
  $('#recordAttendance')?.addEventListener('click', () => runAttendance());
  $('#startEnroll')?.addEventListener('click', async () => { await startCamera('camera'); toast('Camera opened. Enter a name and capture to enroll.'); });
  $('#captureFace')?.addEventListener('click', () => runEnrollment());

  refreshEnrollmentUI();
  checkBackend();
});

async function checkBackend() {
  if (!window.VXAPI) return;
  try {
    const h = await window.VXAPI.health();
    const m = h.model || {};
    if (m.mode === 'dynamic_enrollment') {
      console.info('VERIFYX dynamic enrollment backend ready.', m);
    }
  } catch (e) {
    console.warn('Backend not reachable yet:', e.message);
  }
}

function getEventMeta() {
  const course = $('#attendanceCourse')?.value || $('#course')?.value || $('#examCourse')?.value || '';
  const date = $('#attendanceDate')?.value || $('#examDate')?.value || '';
  const time = $('#attendanceTime')?.value || $('#examTime')?.value || '';
  const venue = $('#examVenue')?.value || $('#venue')?.value || '';
  const type = $('#attendanceType')?.value || '';
  return { course, date, time, venue, attendance_type: type };
}

async function runEnrollment() {
  if (!window.VXAPI) { toast('API client not available.'); return; }
  const video = document.getElementById('cameraVideo');
  if (!video || !video.srcObject) { toast('Start the camera before capturing.'); return; }

  const nameInput = document.getElementById('enrollName');
  const idInput = document.getElementById('enrollPersonId');
  const name = (nameInput?.value || '').trim();
  const personId = (idInput?.value || '').trim();
  if (!name) {
    toast('Please enter a name to assign to this face.');
    nameInput?.focus();
    return;
  }

  const btn = $('#captureFace');
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Enrolling…'; }
  setBusyStatus('camera', `Capturing and enrolling face for "${name}"…`);
  try {
    const frame = window.VXAPI.captureFrame(video);
    if (!frame) throw new Error('Could not capture frame from camera.');
    const res = await window.VXAPI.enroll(frame, { name: name, person_id: personId || undefined });
    const result = res.result || {};
    const person = res.person || {};
    renderRecognitionResult('verificationResult', 'enrollment', result, {
      event: 'Face Enrollment',
      saved: res.enrolled ? `Enrolled "${person.name || name}" (samples: ${person.sample_count || 1}). Model retrained.` : 'Enrollment not saved.'
    });
    clearBusyStatus('camera', 'Enrollment saved. You can capture more samples to improve accuracy.');
    toast(`Face enrolled for ${person.name || name}.`);
    // keep name for multiple samples, clear person id field (backend resolves by name/id)
    if (idInput && person.person_id) idInput.value = person.person_id;
    refreshEnrollmentUI(person.person_id);
  } catch (e) {
    clearBusyStatus('camera', 'Enrollment failed.');
    const data = e.data || {};
    if (data.result) {
      renderRecognitionResult('verificationResult', 'enrollment', data.result, { event: 'Face Enrollment' });
    } else {
      const el = document.getElementById('verificationResult');
      if (el) el.innerHTML = `<h4 class="warn">ENROLLMENT ERROR</h4><p>${(e.message || 'Unknown error')}</p>`;
    }
    toast(e.message || 'Enrollment failed.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig || 'Capture & Enroll'; }
  }
}

async function runAttendance() {
  if (!window.VXAPI) { toast('API client not available.'); return; }
  const video = document.getElementById('cameraVideo');
  if (!video || !video.srcObject) { toast('Start the camera before recording attendance.'); return; }
  const btn = $('#recordAttendance');
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
  setBusyStatus('camera', 'Capturing and recognizing enrolled identity…');
  try {
    const frame = window.VXAPI.captureFrame(video);
    if (!frame) throw new Error('Could not capture frame from camera.');
    const eventMeta = getEventMeta();
    const meta = Object.assign({}, eventMeta, { event_type: eventMeta.attendance_type ? ('Attendance - ' + eventMeta.attendance_type) : 'Attendance' });
    const res = await window.VXAPI.recordAttendance(frame, meta);
    const result = res.result || {};
    renderRecognitionResult('verificationResult', 'attendance', result, {
      event: meta.event_type || 'Attendance',
      saved: res.attendance ? `Attendance logged for ${res.attendance.recognized_name || res.attendance.user_name || 'Unknown'} (${res.attendance.status}).` : ''
    });
    clearBusyStatus('camera', result.accepted ? `Recognized: ${result.name}. Attendance logged.` : 'Attendance attempt recorded.');
    toast(result.accepted ? `Attendance logged: ${result.name}` : 'Attendance attempt recorded.');
  } catch (e) {
    clearBusyStatus('camera', 'Attendance verification failed.');
    toast(e.message || 'Attendance verification failed.');
    const el = document.getElementById('verificationResult');
    if (el) el.innerHTML = `<h4 class="warn">VERIFICATION ERROR</h4><p>${(e.message || 'Unknown error')}</p>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig || 'Record Attendance'; }
  }
}

async function runExamVerification() {
  if (!window.VXAPI) { toast('API client not available.'); return; }
  const video = document.getElementById('cameraVideo');
  if (!video || !video.srcObject) { toast('Start the camera before verification.'); return; }
  const btn = $('#startVerify');
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
  setBusyStatus('camera', 'Capturing and recognizing enrolled examinee…');
  try {
    const frame = window.VXAPI.captureFrame(video);
    if (!frame) throw new Error('Could not capture frame from camera.');
    const eventMeta = getEventMeta();
    const meta = Object.assign({}, eventMeta, { event_type: 'Examination Verification' });
    const res = await window.VXAPI.verifyExam(frame, meta);
    const result = res.result || {};
    renderRecognitionResult('verificationResult', 'exam', result, {
      event: 'Examination Verification',
      saved: res.verification ? `Verification logged for ${res.verification.recognized_name || res.verification.user_name || 'Unknown'} (${res.verification.status}).` : ''
    });
    clearBusyStatus('camera', result.accepted ? `Recognized: ${result.name}.` : 'Verification attempt recorded.');
    toast(result.accepted ? `Verified: ${result.name}` : 'Verification attempt recorded.');
  } catch (e) {
    clearBusyStatus('camera', 'Examination verification failed.');
    toast(e.message || 'Examination verification failed.');
    const el = document.getElementById('verificationResult');
    if (el) el.innerHTML = `<h4 class="warn">VERIFICATION ERROR</h4><p>${(e.message || 'Unknown error')}</p>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig || 'Verify Identity'; }
  }
}

async function refreshEnrollmentUI(highlightPersonId) {
  const badge = document.getElementById('enrollmentStatusBadge');
  const detail = document.getElementById('enrollmentStatusDetail');
  const stat = document.getElementById('enrollmentStatusStat');
  const match = document.getElementById('enrollmentMatchStat');
  const dateEl = document.getElementById('enrollmentDateStat');
  const listEl = document.getElementById('enrolledPeopleList');
  const countEl = document.getElementById('enrolledCountStat');
  if (!window.VXAPI) return;
  try {
    const res = await window.VXAPI.listPeople();
    const people = (res && res.people) ? res.people : [];
    if (countEl) countEl.textContent = String(people.length);

    if (listEl) {
      if (!people.length) {
        listEl.innerHTML = '<p class="muted">No people enrolled yet. Enter a name and capture face samples to register someone.</p>';
      } else {
        listEl.innerHTML = '<ul style="margin:8px 0 0 16px;padding:0">' + people.map(p => {
          const hi = (highlightPersonId && p.person_id === highlightPersonId) ? ' style="font-weight:600"' : '';
          const when = p.updated_at ? new Date(p.updated_at).toLocaleString() : '';
          return `<li${hi}>${escapeHtml(p.name)} <span class="muted">(${p.sample_count || 0} sample${(p.sample_count||0)==1?'':'s'}${when ? ', updated '+escapeHtml(when):''})</span></li>`;
        }).join('') + '</ul>';
      }
    }

    if (people.length) {
      const latest = people.slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0];
      const when = latest.updated_at ? new Date(latest.updated_at).toLocaleString() : '-';
      if (badge) { badge.textContent = `${people.length} enrolled`; badge.className = 'status ok'; }
      if (detail) { detail.textContent = `${people.length} person(s) enrolled. Latest: ${latest.name} (${latest.sample_count || 0} samples).`; }
      if (stat) stat.textContent = 'Active';
      if (match) match.textContent = latest.name || '-';
      if (dateEl) dateEl.textContent = when;
    } else {
      if (badge) { badge.textContent = 'No enrollments'; badge.className = 'status pending'; }
      if (detail) { detail.textContent = 'No enrolled faces yet. Enter a name and capture samples to register someone for attendance.'; }
      if (stat) stat.textContent = 'Not enrolled';
      if (match) match.textContent = '-';
      if (dateEl) dateEl.textContent = '-';
    }
  } catch (e) {
    if (badge) { badge.textContent = 'Backend offline'; badge.className = 'status warn'; }
    if (detail) { detail.textContent = 'Could not reach the VERIFYX backend. Start the backend server to enable enrollment.'; }
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// Back-compat alias
async function refreshEnrollmentStatus() { return refreshEnrollmentUI(); }
