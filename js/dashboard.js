document.addEventListener('DOMContentLoaded', () => {
  const u = typeof currentUser === 'function' ? currentUser() : null;
  if (u) {
    const n = $('#displayName'); if (n) n.textContent = u.name || n.textContent;
    const id = $('#displayId'); if (id) id.textContent = u.id || id.textContent;
    const role = $('#displayRole'); if (role) role.textContent = (u.role || '').toUpperCase();
  }
  $$('[data-logout]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); if (typeof logout === 'function') logout(); }));

  $$('[data-search]').forEach(inp => inp.addEventListener('input', () => {
    const target = document.getElementById(inp.dataset.search);
    if (!target) return;
    const q = inp.value.toLowerCase();
    $$('tbody tr', target).forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none');
  }));

  // Try to hydrate dashboard stats from backend
  loadDashboardStats();

  $$('[data-export]').forEach(b => b.addEventListener('click', async () => {
    if (window.VXAPI) {
      try {
        const res = await window.VXAPI.listAttendance();
        const recs = (res && res.records) || [];
        if (!recs.length) { toast('No records to export.'); return; }
        const header = ['Created At', 'User', 'Event Type', 'Status', 'Predicted Identity', 'Distance', 'Threshold', 'Method'];
        const rows = recs.map(r => [r.created_at || '', r.user_name || r.user_id || '', r.event_type || '', r.status || '', r.model_name || '', r.distance ?? '', r.threshold ?? '', r.method || '']);
        const csv = [header, ...rows].map(r => r.map(v => {
          const s = String(v == null ? '' : v);
          return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }));
        a.download = 'verifyx-records-export.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        toast('Exported ' + recs.length + ' records from backend.');
        return;
      } catch (e) { /* fall through */ }
    }
    const rows = [['User', 'ID', 'Type', 'Status'], ['(no backend data)', '-', '-', '-']];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'verifyx-export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Exported (backend unavailable).');
  }));
});

async function loadDashboardStats() {
  if (!window.VXAPI) return;
  try {
    const [healthRes, attRes, enrRes] = await Promise.allSettled([
      window.VXAPI.health(),
      window.VXAPI.listAttendance(),
      window.VXAPI.request('/api/enrollments', { method: 'GET' }).catch(() => null)
    ]);
    const records = (attRes.status === 'fulfilled' && attRes.value && attRes.value.records) ? attRes.value.records : [];
    const enrollments = (enrRes.status === 'fulfilled' && enrRes.value && enrRes.value.enrollments) ? enrRes.value.enrollments : [];
    const total = records.length;
    const verified = records.filter(r => r.status === 'Verified' || r.accepted).length;
    const rejected = records.filter(r => r.status === 'Rejected').length;
    const noFace = records.filter(r => r.status === 'No Face Detected').length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('statTotalRecords', total);
    set('statVerified', verified);
    set('statRejected', rejected);
    set('statNoFace', noFace);
    set('statEnrollments', enrollments.length);

    // Generic stat cards if present by data attribute
    document.querySelectorAll('[data-stat="total"]').forEach(el => el.textContent = total);
    document.querySelectorAll('[data-stat="verified"]').forEach(el => el.textContent = verified);
    document.querySelectorAll('[data-stat="rejected"]').forEach(el => el.textContent = rejected);
    document.querySelectorAll('[data-stat="enrollments"]').forEach(el => el.textContent = enrollments.length);

    // Populate recent records table if a known table body exists
    const tbody = document.getElementById('recentRecordsBody') || document.querySelector('[data-records-body]');
    if (tbody) {
      tbody.innerHTML = '';
      const recent = records.slice(0, 8);
      if (!recent.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" class="muted">No recognition records yet. Use Attendance or Examination Verification to create records.</td>';
        tbody.appendChild(tr);
      } else {
        recent.forEach(r => {
          const tr = document.createElement('tr');
          const dt = r.created_at ? new Date(r.created_at) : null;
          const when = dt && !isNaN(dt) ? dt.toLocaleString() : (r.created_at || '-');
          const status = r.status || (r.accepted ? 'Verified' : 'Rejected');
          const cls = status === 'Verified' ? 'ok' : (status === 'Rejected' ? 'bad' : 'warn');
          tr.innerHTML = `<td>${when}</td><td>${r.user_name || r.user_id || '-'}</td><td>${r.event_type || '-'}</td><td>${r.model_name || '-'}</td><td>${r.distance != null ? Number(r.distance).toFixed(2) : '-'}</td><td><span class="status ${cls}">${status}</span></td>`;
          tbody.appendChild(tr);
        });
      }
    }
  } catch (e) {
    console.warn('Dashboard stats unavailable:', e.message);
  }
}
