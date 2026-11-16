
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
function toast(msg){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.append(t)}t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),3200)}
function openModal(id){const el=document.getElementById(id);if(el)el.classList.add('open')}
function closeModal(id){const el=document.getElementById(id);if(el)el.classList.remove('open')}
function wireCommon(){ $$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));$$('[data-modal]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.modal)));$$('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>closeModal(b.closest('.modal-backdrop')?.id)));$$('[data-toast]').forEach(b=>b.addEventListener('click',()=>toast(b.dataset.toast)));const toggle=$('#mobileToggle');if(toggle)toggle.addEventListener('click',()=>$('#navLinks')?.classList.toggle('open'))}
document.addEventListener('DOMContentLoaded',wireCommon);
function logout(){sessionStorage.removeItem('verifyxUser');location.href='signin.html'}
function currentUser(){try{return JSON.parse(sessionStorage.getItem('verifyxUser')||'null')}catch{return null}}
function requireLogin(){if(!currentUser())location.href='signin.html'}
