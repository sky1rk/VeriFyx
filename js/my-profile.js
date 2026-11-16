/* My Profile page: personal information form and profile photo. */
(function () {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024;
  var ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  var FIELDS = ['firstName', 'middleName', 'lastName', 'studentId', 'email', 'contact', 'college', 'program', 'yearLevel'];
  var editing = false;
  var pendingPhoto;

  function $(id) { return document.getElementById(id); }

  function setText(id, text) { var el = $(id); if (el) { el.textContent = text; } }

  function currentValues() {
    var v = {};
    FIELDS.forEach(function (f) { v[f] = $(f).value; });
    return v;
  }

  function fillForm(user) {
    FIELDS.forEach(function (f) { $(f).value = user[f] || ''; });
  }

  function clearErrors() {
    FIELDS.forEach(function (f) {
      var e = $('err-' + f);
      if (e) { e.textContent = ''; }
      $(f).closest('.field').classList.remove('has-error');
      $(f).removeAttribute('aria-invalid');
    });
  }

  function showErrors(errors) {
    var first = null;
    Object.keys(errors).forEach(function (f) {
      $('err-' + f).textContent = errors[f];
      $(f).closest('.field').classList.add('has-error');
      $(f).setAttribute('aria-invalid', 'true');
      if (!first) { first = f; }
    });
    if (first) { $(first).focus(); }
  }

  function renderSummary(user) {
    var isEmployee = user.accountType === 'Employee';
    setText('pfName', VX.fullName(user, true));
    setText('pfIdLabel', isEmployee ? 'Employee ID' : 'Student ID');
    setText('pfId', user.studentId || '-');
    setText('pfType', user.accountType);
    setText('pfEmail', user.email || '-');
    setText('pfStatus', user.accountStatus);
    setText('headStatus', user.accountStatus);
    setText('acType', user.accountType);
    setText('acUserId', user.userId);
    setText('acRegistered', VX.formatDate(user.registeredAt));
    setText('acStatus', user.accountStatus);
    setText('studentIdLabel', isEmployee ? 'Employee ID' : 'Student ID');
    setText('programLabel', isEmployee ? 'Position' : 'Program');
    $('yearField').classList.toggle('hidden', isEmployee);
    $('uploadBtn').textContent = user.photo ? 'Change Photo' : 'Upload Photo';
    $('removeBtn').classList.toggle('hidden', !user.photo);
    VX.renderAvatar($('profileAvatar'), user);
  }

  function setEditing(on) {
    editing = on;
    FIELDS.forEach(function (f) { $(f).disabled = !on; });
    $('editBtn').classList.toggle('hidden', on);
    $('formActions').classList.toggle('hidden', !on);
    if (on) { $('firstName').focus(); }
  }

  /* Live avatar preview while the name is being edited. */
  function previewInitials() {
    if (!editing) { return; }
    var user = VX.loadUser();
    var draft = { firstName: $('firstName').value, lastName: $('lastName').value, middleName: $('middleName').value };
    VX.renderAvatar($('profileAvatar'), user, { initials: VX.getInitials(draft) });
  }

  function onSubmit(e) {
    e.preventDefault();
    clearErrors();
    var values = currentValues();
    var errors = VX.validateProfile(values);
    if (Object.keys(errors).length) { showErrors(errors); toast('Please fix the highlighted fields.'); return; }
    var patch = {};
    FIELDS.forEach(function (f) { patch[f] = String(values[f]).trim(); });
    patch.contact = patch.contact.replace(/\s+/g, ' ');
    var res = VX.saveUser(patch);
    if (!res.ok) { toast('Could not save. Browser storage may be full or disabled.'); return; }
    setEditing(false);
    renderSummary(res.user);
    toast('Profile updated successfully.');
  }

  function onCancel() {
    clearErrors();
    var user = VX.loadUser();
    fillForm(user);
    setEditing(false);
    renderSummary(user);
    toast('Changes discarded.');
  }

  function photoMessage(text) { setText('photoMsg', text || ''); }

  /* Center-crop to a square and downscale so the saved image stays small. */
  function resizeToDataUrl(img) {
    var size = 360;
    var side = Math.min(img.naturalWidth, img.naturalHeight);
    var sx = (img.naturalWidth - side) / 2;
    var sy = (img.naturalHeight - side) / 2;
    var canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.88);
  }

  function onPhotoSelected(e) {
    var input = e.target;
    var file = input.files && input.files[0];
    input.value = '';
    photoMessage('');
    if (!file) { return; }
    var okType = ALLOWED.indexOf(file.type) > -1 && /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!okType) { photoMessage('Unsupported file. Please choose a JPG, JPEG, PNG, or WEBP image.'); return; }
    if (file.size > MAX_BYTES) { photoMessage('That image is too large. Please choose one under 5 MB.'); return; }

    var reader = new FileReader();
    reader.onerror = function () { photoMessage('The image could not be read. Please try another file.'); };
    reader.onload = function () {
      var previous = VX.loadUser();
      /* Immediate preview from the raw file. */
      VX.renderAvatar($('profileAvatar'), previous, { photo: reader.result });
      var img = new Image();
      img.onerror = function () {
        VX.renderAvatar($('profileAvatar'), previous);
        photoMessage('That file is not a valid image.');
      };
      img.onload = function () {
        var data;
        try { data = resizeToDataUrl(img); } catch (err) { data = reader.result; }
        var res = VX.saveUser({ photo: data });
        if (!res.ok) {
          VX.renderAvatar($('profileAvatar'), previous);
          photoMessage('The image could not be saved. Browser storage may be full or disabled.');
          return;
        }
        renderSummary(res.user);
        toast('Profile photo updated.');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    var res = VX.saveUser({ photo: null });
    if (!res.ok) { toast('Could not update the photo.'); return; }
    photoMessage('');
    renderSummary(res.user);
    toast('Profile photo removed.');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var user = VX.loadUser();
    fillForm(user);
    renderSummary(user);
    setEditing(false);

    $('uploadBtn').addEventListener('click', function () { $('photoInput').click(); });
    $('photoInput').addEventListener('change', onPhotoSelected);
    $('confirmRemove').addEventListener('click', removePhoto);
    $('editBtn').addEventListener('click', function () { setEditing(true); });
    $('cancelBtn').addEventListener('click', onCancel);
    $('profileForm').addEventListener('submit', onSubmit);
    ['firstName', 'middleName', 'lastName'].forEach(function (f) { $(f).addEventListener('input', previewInitials); });
    FIELDS.forEach(function (f) {
      $(f).addEventListener('input', function () {
        var e = $('err-' + f);
        if (e && e.textContent) { e.textContent = ''; $(f).closest('.field').classList.remove('has-error'); $(f).removeAttribute('aria-invalid'); }
      });
    });
    document.addEventListener('verifyx:profile-updated', function (ev) {
      if (!editing) { fillForm(ev.detail); renderSummary(ev.detail); }
    });
  });
})();
