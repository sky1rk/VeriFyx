/* Attendance History page - loads records from VERIFYX backend (LBPH-powered). */
(function () {
  'use strict';

  var PAGE_SIZE = 10;
  var STATUS_CLASS = { 'Verified': 'ok', 'Present': 'ok', 'Late': 'warn', 'Rejected': 'bad', 'Absent': 'bad', 'No Face Detected': 'warn', 'Pending Verification': 'pending' };

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseIso(s) { var p = (s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function prettyDate(s) { if (!s) return '-'; var d = parseIso(s); if (isNaN(d)) return s; return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }

  var ALL = [];
  var state = { q: '', status: '', from: '', to: '', sort: 'desc', page: 1 };

  function normalizeRecord(r) {
    var created = r.created_at || r.date || '';
    var dt = created ? new Date(created) : null;
    var dateStr = (dt && !isNaN(dt)) ? iso(dt) : (r.date || '');
    var dayName = (dt && !isNaN(dt)) ? DAYS[dt.getDay()] : (r.day || '-');
    var timeStr = (dt && !isNaN(dt)) ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (r.timeIn || '-');
    var type = r.event_type || r.type || 'Attendance';
    var status = r.status || (r.accepted ? 'Verified' : 'Rejected');
    var method = r.method || 'Facial Recognition (LBPH)';
    var name = r.recognized_name || r.model_name || r.user_name || '-';
    var dist = (r.distance != null) ? Number(r.distance).toFixed(2) : '-';
    return {
      id: r.id || '',
      date: dateStr,
      day: dayName,
      timeIn: timeStr,
      timeOut: r.timeOut || '-',
      type: type,
      status: status,
      method: method,
      modelName: name,
      distance: dist,
      user: r.recognized_name || r.user_name || r.person_id || r.user_id || '-',
      raw: r
    };
  }

  async function loadRecords() {
    ALL = [];
    if (!window.VXAPI) return;
    try {
      var meta = window.VXAPI.getProfileMeta ? window.VXAPI.getProfileMeta() : {};
      // Load all records (admin-like view shows all; can filter by user if desired)
      var res = await window.VXAPI.listAttendance();
      var recs = (res && res.records) ? res.records : [];
      ALL = recs.map(normalizeRecord);
    } catch (e) {
      console.warn('Failed to load attendance records:', e.message);
      ALL = [];
    }
  }

  function matches(r) {
    if (state.status && r.status !== state.status) { return false; }
    if (state.from && r.date && r.date < state.from) { return false; }
    if (state.to && r.date && r.date > state.to) { return false; }
    if (state.q) {
      var hay = [r.date, prettyDate(r.date), r.day, r.type, r.status, r.modelName, r.user].join(' ').toLowerCase();
      if (hay.indexOf(state.q) === -1) { return false; }
    }
    return true;
  }

  function filtered() {
    var out = ALL.filter(matches);
    out.sort(function (a, b) {
      var ad = a.date || '', bd = b.date || '';
      return state.sort === 'asc' ? (ad < bd ? -1 : ad > bd ? 1 : 0) : (ad < bd ? 1 : ad > bd ? -1 : 0);
    });
    return out;
  }

  function cell(text, cls) {
    var td = document.createElement('td');
    td.textContent = text == null ? '' : String(text);
    if (cls) { td.className = cls; }
    return td;
  }

  function renderSummary() {
    var c = { Verified: 0, Rejected: 0, 'No Face Detected': 0 };
    ALL.forEach(function (r) { if (r.status in c) { c[r.status]++; } else if (r.status === 'Present') { c.Verified++; } });
    if ($('sumTotal')) $('sumTotal').textContent = ALL.length;
    if ($('sumPresent')) $('sumPresent').textContent = c.Verified || 0;
    if ($('sumLate')) $('sumLate').textContent = c['No Face Detected'] || 0;
    if ($('sumAbsent')) $('sumAbsent').textContent = c.Rejected || 0;
  }

  function pageList(total, current) {
    var pages = [];
    for (var i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - current) <= 1) { pages.push(i); }
      else if (pages[pages.length - 1] !== '...') { pages.push('...'); }
    }
    return pages;
  }

  function render() {
    var rows = filtered();
    var totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (state.page > totalPages) { state.page = totalPages; }
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = rows.slice(start, start + PAGE_SIZE);

    var body = $('recordsBody');
    if (!body) return;
    while (body.firstChild) { body.removeChild(body.firstChild); }
    slice.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(prettyDate(r.date)));
      tr.appendChild(cell(r.day));
      tr.appendChild(cell(r.timeIn));
      tr.appendChild(cell(r.modelName));
      tr.appendChild(cell(r.type));
      var st = document.createElement('td');
      var badge = document.createElement('span');
      badge.className = 'status ' + (STATUS_CLASS[r.status] || 'pending');
      badge.textContent = r.status;
      st.appendChild(badge);
      tr.appendChild(st);
      tr.appendChild(cell(r.method));
      body.appendChild(tr);
    });

    var empty = rows.length === 0;
    if ($('tableWrap')) $('tableWrap').classList.toggle('hidden', empty);
    if ($('pager')) $('pager').classList.toggle('hidden', empty);
    if ($('emptyState')) $('emptyState').classList.toggle('hidden', !empty);
    if ($('exportCsv')) $('exportCsv').disabled = empty;
    if (empty) {
      var none = ALL.length === 0;
      if ($('emptyTitle')) $('emptyTitle').textContent = none ? 'No recognition records yet' : 'No matching records';
      if ($('emptyText')) $('emptyText').textContent = none ? 'Attendance and verification attempts recorded by the backend will appear here.' : 'Try a different search, status, or date range.';
      if ($('emptyReset')) $('emptyReset').classList.toggle('hidden', none);
    }

    if ($('pagerInfo')) $('pagerInfo').textContent = empty ? '' : 'Showing ' + (start + 1) + ' to ' + (start + slice.length) + ' of ' + rows.length + ' records';
    var pg = $('pagerPages');
    if (pg) {
      while (pg.firstChild) { pg.removeChild(pg.firstChild); }
      function btn(label, page, opts) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'pg'; b.textContent = label;
        if (opts && opts.disabled) { b.disabled = true; }
        if (opts && opts.current) { b.classList.add('current'); b.setAttribute('aria-current', 'page'); }
        if (opts && opts.aria) { b.setAttribute('aria-label', opts.aria); }
        if (page) { b.addEventListener('click', function () { state.page = page; render(); }); }
        pg.appendChild(b);
      }
      if (totalPages > 1) {
        btn('Prev', state.page - 1, { disabled: state.page === 1, aria: 'Previous page' });
        pageList(totalPages, state.page).forEach(function (p) {
          if (p === '...') { btn('...', 0, { disabled: true }); }
          else { btn(String(p), p, { current: p === state.page, aria: 'Page ' + p }); }
        });
        btn('Next', state.page + 1, { disabled: state.page === totalPages, aria: 'Next page' });
      }
    }

    if ($('sortArrow')) $('sortArrow').textContent = state.sort === 'asc' ? '↑' : '↓';
    if ($('dateTh')) $('dateTh').setAttribute('aria-sort', state.sort === 'asc' ? 'ascending' : 'descending');
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    var rows = filtered();
    if (!rows.length) { if (typeof toast === 'function') toast('There are no records to export.'); return; }
    var lines = [['Date', 'Day', 'Time', 'Predicted Identity', 'Event Type', 'Status', 'Method', 'Distance', 'User']];
    rows.forEach(function (r) { lines.push([r.date, r.day, r.timeIn, r.modelName, r.type, r.status, r.method, r.distance, r.user]); });
    var csv = '\uFEFF' + lines.map(function (l) { return l.map(csvCell).join(','); }).join('\r\n');
    var a = document.createElement('a');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.href = url;
    a.download = 'verifyx-records-' + iso(new Date()) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    if (typeof toast === 'function') toast('Exported ' + rows.length + ' record' + (rows.length === 1 ? '' : 's') + ' to CSV.');
  }

  function resetFilters() {
    state.q = ''; state.status = ''; state.from = ''; state.to = ''; state.sort = 'desc'; state.page = 1;
    if ($('searchInput')) $('searchInput').value = '';
    if ($('statusFilter')) $('statusFilter').value = '';
    if ($('dateFrom')) $('dateFrom').value = '';
    if ($('dateTo')) $('dateTo').value = '';
    if ($('sortOrder')) $('sortOrder').value = 'desc';
    render();
  }

  async function init() {
    await loadRecords();
    renderSummary();
    $('searchInput')?.addEventListener('input', function (e) { state.q = e.target.value.trim().toLowerCase(); state.page = 1; render(); });
    $('statusFilter')?.addEventListener('change', function (e) { state.status = e.target.value; state.page = 1; render(); });
    $('dateFrom')?.addEventListener('change', function (e) { state.from = e.target.value; state.page = 1; render(); });
    $('dateTo')?.addEventListener('change', function (e) { state.to = e.target.value; state.page = 1; render(); });
    $('sortOrder')?.addEventListener('change', function (e) { state.sort = e.target.value; state.page = 1; render(); });
    $('sortBtn')?.addEventListener('click', function () {
      state.sort = state.sort === 'desc' ? 'asc' : 'desc';
      if ($('sortOrder')) $('sortOrder').value = state.sort; state.page = 1; render();
    });
    $('resetFilters')?.addEventListener('click', resetFilters);
    $('emptyReset')?.addEventListener('click', resetFilters);
    $('exportCsv')?.addEventListener('click', exportCsv);
    $('refreshRecords')?.addEventListener('click', async function () { await loadRecords(); renderSummary(); render(); if (typeof toast === 'function') toast('Records refreshed.'); });
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
