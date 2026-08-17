import { firebaseConfig } from './firebase-config.js';
import { cloudinaryConfig } from './cloudinary-config.js';
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- firebase init ---------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- upload ảnh lên Cloudinary (free, không cần thẻ) ---------- */
async function uploadToCloudinary(file){
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  formData.append('folder', 'submissions');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
    method: 'POST',
    body: formData
  });
  if(!res.ok){
    const errText = await res.text();
    throw new Error('Cloudinary upload failed: ' + errText);
  }
  const data = await res.json();
  return data.secure_url;
}

/* ---------- constants ---------- */
const SUBJECTS = {
  toan: { name: "Toán", cls: "math", color: "#FF6B6B", badgeBg: "#FFE3E3",
    icon: `<svg viewBox="0 0 60 60" fill="none"><rect x="10" y="10" width="40" height="40" rx="8" fill="currentColor" opacity="0.25"/><path d="M18 18 L42 42 M42 18 L18 42" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="30" r="4" fill="currentColor"/></svg>` },
  tv: { name: "Tiếng Việt", cls: "viet", color: "#FFB100", badgeBg: "#FFF1D2",
    icon: `<svg viewBox="0 0 60 60" fill="none"><path d="M12 15 C22 10 30 10 30 15 L30 46 C30 41 22 41 12 46 Z" fill="currentColor" opacity="0.9"/><path d="M48 15 C38 10 30 10 30 15 L30 46 C30 41 38 41 48 46 Z" fill="currentColor" opacity="0.6"/></svg>` },
  ta: { name: "Tiếng Anh", cls: "eng", color: "#3FC9BE", badgeBg: "#DFF6F4",
    icon: `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="19" fill="currentColor" opacity="0.85"/><path d="M11 30 H49 M30 11 C22 20 22 40 30 49 C38 40 38 20 30 11Z" stroke="currentColor" stroke-width="2.4" fill="none" opacity="0.5"/></svg>` }
};
const AVATAR_COLORS = ["#FF6B6B","#FFB100","#3FC9BE","#8B6FD6","#FF9EAA","#6EC6FF"];

/* ---------- state ---------- */
let state = {
  user: null,
  userDoc: null,
  children: [],
  currentChildId: null,
  currentChildName: null,
  currentSubject: null,
  assignments: [],
  submissions: {},
  view: 'login'
};

const $app = document.getElementById('app');
const $loading = document.getElementById('loading');
const uidColor = (str) => AVATAR_COLORS[[...(str||'x')].reduce((a,c)=>a+c.charCodeAt(0),0) % AVATAR_COLORS.length];
const initials = (name) => (name||'?').trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() || '?';

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(()=>t.classList.remove('show'), 2400);
}
function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function formatDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/* ---------- auth state ---------- */
onAuthStateChanged(auth, async (user) => {
  $loading.classList.remove('hidden');
  $app.classList.add('hidden');
  state.user = user;
  if(user){
    try{
      const snap = await getDoc(doc(db,'users',user.uid));
      if(!snap.exists()){
        // Tài khoản Auth tồn tại nhưng KHÔNG có hồ sơ trong Firestore (users/{uid}).
        // Trường hợp này xảy ra khi đăng nhập bằng một tài khoản chưa từng được
        // tạo đúng quy trình (vd: qua "Đăng ký (Phụ huynh)" hoặc "Thêm con").
        // => Không cho vào app, luôn đăng xuất ngay lập tức.
        showToast('Tài khoản này chưa có hồ sơ hợp lệ. Học sinh cần được phụ huynh tạo tài khoản trước.');
        state.user = null;
        await signOut(auth);
        $loading.classList.add('hidden');
        $app.classList.remove('hidden');
        render();
        return;
      }
      state.userDoc = snap.data();
      if(state.userDoc.role === 'student'){
        state.currentChildId = user.uid;
        state.currentChildName = state.userDoc.name;
        state.view = 'subjects';
      } else if(state.userDoc.role === 'parent'){
        await loadChildren();
        state.view = 'parent-home';
      } else {
        // role không hợp lệ / dữ liệu bất thường — không cho vào app.
        showToast('Tài khoản không hợp lệ.');
        state.user = null;
        await signOut(auth);
        $loading.classList.add('hidden');
        $app.classList.remove('hidden');
        render();
        return;
      }
    }catch(e){
      // Bất kỳ lỗi nào khi xác thực hồ sơ (mạng, quyền truy cập Firestore,...)
      // đều phải chặn truy cập — không có ngoại lệ "mở cửa" nào cả.
      console.error('Lỗi khi tải hồ sơ người dùng:', e);
      showToast('Không xác thực được tài khoản, vui lòng đăng nhập lại.');
      state.user = null;
      try{ await signOut(auth); }catch(_e){}
      $loading.classList.add('hidden');
      $app.classList.remove('hidden');
      render();
      return;
    }
  } else {
    state = { ...state, userDoc:null, children:[], currentChildId:null, currentSubject:null, view:'login' };
  }
  $loading.classList.add('hidden');
  $app.classList.remove('hidden');
  render();
});

async function loadChildren(){
  const ids = state.userDoc.children || [];
  const results = [];
  for(const id of ids){
    const s = await getDoc(doc(db,'users',id));
    if(s.exists()) results.push({ uid:id, ...s.data() });
  }
  state.children = results;
}

async function loadAssignmentsFor(childId){
  const q1 = query(collection(db,'assignments'), where('studentId','==', childId));
  const snap = await getDocs(q1);
  state.assignments = snap.docs.map(d => ({ id:d.id, ...d.data() }));

  const q2 = query(collection(db,'submissions'), where('studentId','==', childId));
  const subSnap = await getDocs(q2);
  state.submissions = {};
  subSnap.docs.forEach(d => { state.submissions[d.id] = { id:d.id, ...d.data() }; });
}

/* ---------- top bar ---------- */
function renderTopbar(){
  if(!state.user) return '';
  const name = state.userDoc?.name || state.user.email;
  const roleLabel = state.userDoc?.role === 'parent' ? 'Phụ huynh' : 'Học sinh';
  return `
    <div class="topbar">
      <div class="brand">
        <svg class="mascot" viewBox="0 0 100 100"><circle cx="50" cy="52" r="38" fill="#FFD166"/><circle cx="36" cy="46" r="6" fill="#3A3358"/><circle cx="64" cy="46" r="6" fill="#3A3358"/><path d="M36 66 Q50 78 64 66" stroke="#3A3358" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M32 20 Q50 2 68 20" stroke="#FFD166" stroke-width="10" fill="none" stroke-linecap="round"/></svg>
        <div>
          <h1>Vườn Học Tập</h1>
          <div class="sub">Học vui mỗi ngày 🌈</div>
        </div>
      </div>
      <div class="user-pill">
        <div class="avatar" style="background:${uidColor(name)}">${initials(name)}</div>
        <div>
          <div class="name">${escapeHtml(name)}</div>
          <div class="role-tag">${roleLabel}</div>
        </div>
        <button class="logout-btn" id="logoutBtn">Đăng xuất</button>
      </div>
    </div>`;
}
function attachTopbarHandlers(){
  const b = document.getElementById('logoutBtn');
  if(b) b.onclick = () => signOut(auth);
}

/* ---------- main render router ---------- */
function render(){
  if(state.view === 'login'){ $app.innerHTML = renderLogin(); attachLoginHandlers(); return; }
  let body = '';
  if(state.view === 'parent-home') body = renderParentHome();
  else if(state.view === 'subjects') body = renderSubjects();
  else if(state.view === 'assignments') body = renderAssignments();

  $app.innerHTML = `<div class="wrap">${renderTopbar()}${body}<p style="text-align:center;font-size:12px;color:#9A93B5;font-weight:600;margin-top:30px;">Dữ liệu được đồng bộ an toàn qua Firebase ☁️</p></div>`;
  attachTopbarHandlers();
  if(state.view === 'parent-home') attachParentHomeHandlers();
  else if(state.view === 'subjects') attachSubjectsHandlers();
  else if(state.view === 'assignments') attachAssignmentsHandlers();
}

/* ================= LOGIN / REGISTER ================= */
let authTab = 'login';
let authError = '';

function renderLogin(){
  return `
    <div class="auth-shell">
      <div class="auth-card">
        <svg class="mascot-big" viewBox="0 0 100 100"><circle cx="50" cy="52" r="38" fill="#FFD166"/><circle cx="36" cy="46" r="6" fill="#3A3358"/><circle cx="64" cy="46" r="6" fill="#3A3358"/><path d="M36 66 Q50 78 64 66" stroke="#3A3358" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M32 20 Q50 2 68 20" stroke="#FFD166" stroke-width="10" fill="none" stroke-linecap="round"/></svg>
        <h1>Vườn Học Tập</h1>
        <div class="tag">Đăng nhập để bắt đầu học nhé!</div>
        <div class="tabs">
          <button data-tab="login" class="${authTab==='login'?'active':''}">Đăng nhập</button>
          <button data-tab="register" class="${authTab==='register'?'active':''}">Đăng ký (Phụ huynh)</button>
        </div>
        ${authError ? `<div class="error-msg">${escapeHtml(authError)}</div>` : ''}
        ${authTab === 'login' ? `
          <div class="field"><label>Email</label><input id="loginEmail" type="email" placeholder="ban@email.com"/></div>
          <div class="field"><label>Mật khẩu</label><input id="loginPass" type="password" placeholder="••••••••"/></div>
          <button class="primary-btn" id="loginBtn">Đăng nhập</button>
          <p class="field-hint" style="text-align:center;margin-top:14px;">Học sinh dùng email/mật khẩu do phụ huynh tạo sẵn trong mục "Thêm con".</p>
        ` : `
          <div class="field"><label>Tên phụ huynh</label><input id="regName" placeholder="Nguyễn Văn A"/></div>
          <div class="field"><label>Email</label><input id="regEmail" type="email" placeholder="ban@email.com"/></div>
          <div class="field"><label>Mật khẩu (tối thiểu 6 ký tự)</label><input id="regPass" type="password" placeholder="••••••••"/></div>
          <button class="primary-btn" id="registerBtn">Tạo tài khoản Phụ huynh</button>
        `}
      </div>
    </div>`;
}

function attachLoginHandlers(){
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { authTab = b.dataset.tab; authError=''; render(); });

  const loginBtn = document.getElementById('loginBtn');
  if(loginBtn) loginBtn.onclick = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    if(!email || !pass){ authError = 'Vui lòng nhập email và mật khẩu.'; render(); return; }
    loginBtn.disabled = true; loginBtn.textContent = 'Đang đăng nhập...';
    try{
      await signInWithEmailAndPassword(auth, email, pass);
      authError='';
    }catch(e){
      authError = friendlyAuthError(e);
      // Phòng vệ: đảm bảo chắc chắn không còn phiên đăng nhập nào sót lại.
      try{ await signOut(auth); }catch(_e){}
      render();
    }
  };

  const regBtn = document.getElementById('registerBtn');
  if(regBtn) regBtn.onclick = async () => {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;
    if(!name || !email || !pass){ authError = 'Vui lòng điền đầy đủ thông tin.'; render(); return; }
    if(pass.length < 6){ authError = 'Mật khẩu cần tối thiểu 6 ký tự.'; render(); return; }
    regBtn.disabled = true; regBtn.textContent = 'Đang tạo tài khoản...';
    try{
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db,'users',cred.user.uid), {
        role:'parent', name, email, children: [], createdAt: serverTimestamp()
      });
      authError='';
    }catch(e){
      authError = friendlyAuthError(e);
      render();
    }
  };
}

function friendlyAuthError(e){
  const code = e?.code || '';
  const map = {
    'auth/invalid-email':'Email không hợp lệ.',
    'auth/user-not-found':'Không tìm thấy tài khoản với email này.',
    'auth/wrong-password':'Sai mật khẩu.',
    'auth/invalid-credential':'Email hoặc mật khẩu không đúng.',
    'auth/email-already-in-use':'Email này đã được sử dụng.',
    'auth/weak-password':'Mật khẩu quá yếu (tối thiểu 6 ký tự).',
    'auth/network-request-failed':'Lỗi kết nối mạng, thử lại nhé.'
  };
  return map[code] || 'Có lỗi xảy ra, vui lòng thử lại.';
}

/* ================= PARENT HOME (children list) ================= */
function renderParentHome(){
  const cards = state.children.map(c => `
    <div class="child-card" data-child="${c.uid}" data-name="${escapeHtml(c.name)}">
      <div class="child-avatar" style="background:${uidColor(c.name)}">${initials(c.name)}</div>
      <h4>${escapeHtml(c.name)}</h4>
      <div class="meta">${escapeHtml(c.email)}</div>
    </div>`).join('');

  return `
    <div class="hero">
      <h2>Chào ${escapeHtml(state.userDoc.name)}! 👋</h2>
      <p>Chọn một bé để xem bài tập, hoặc thêm tài khoản con mới</p>
    </div>
    <div class="children-grid">
      ${cards}
      <div class="add-child-card" id="addChildBtn">
        <div class="plus">＋</div>
        <div>Thêm con</div>
      </div>
    </div>`;
}

function attachParentHomeHandlers(){
  document.querySelectorAll('.child-card').forEach(el => {
    el.onclick = async () => {
      state.currentChildId = el.dataset.child;
      state.currentChildName = el.dataset.name;
      state.view = 'subjects';
      render();
    };
  });
  const addBtn = document.getElementById('addChildBtn');
  if(addBtn) addBtn.onclick = openAddChildModal;
}

function openAddChildModal(){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>👶 Thêm tài khoản con</h3>
        <div class="field"><label>Tên bé</label><input id="cName" placeholder="Bé An"/></div>
        <div class="field"><label>Email đăng nhập cho bé</label><input id="cEmail" type="email" placeholder="be-an@email.com"/></div>
        <div class="field"><label>Mật khẩu cho bé (tối thiểu 6 ký tự)</label><input id="cPass" type="password" placeholder="••••••••"/></div>
        <div class="field-hint" style="margin-bottom:10px;">Ba mẹ nhớ lại email/mật khẩu này để đăng nhập giúp bé nhé.</div>
        <div id="cErr"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cancelBtn">Huỷ</button>
          <button class="btn-save" id="saveBtn">Tạo tài khoản</button>
        </div>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('ov').onclick = (e)=>{ if(e.target.id==='ov') closeModal(); };
  document.getElementById('saveBtn').onclick = async () => {
    const name = document.getElementById('cName').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const pass = document.getElementById('cPass').value;
    const errBox = document.getElementById('cErr');
    if(!name || !email || !pass || pass.length < 6){
      errBox.innerHTML = `<div class="error-msg">Vui lòng điền đầy đủ thông tin (mật khẩu tối thiểu 6 ký tự).</div>`;
      return;
    }
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang tạo...';
    try{
      await addChildAccount(name, email, pass);
      await loadChildren();
      closeModal();
      render();
      showToast('Đã thêm tài khoản cho bé! 🎉');
    }catch(e){
      errBox.innerHTML = `<div class="error-msg">${escapeHtml(friendlyAuthError(e))}</div>`;
      saveBtn.disabled = false; saveBtn.textContent = 'Tạo tài khoản';
    }
  };
}

async function addChildAccount(name, email, password){
  // Use a secondary, temporary Firebase app instance so creating the child's
  // auth account does NOT sign the parent out of their current session.
  const secondaryApp = initializeApp(firebaseConfig, 'secondary-' + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  try{
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const childUid = cred.user.uid;
    await setDoc(doc(db,'users',childUid), {
      role:'student', name, email, parentId: state.user.uid, createdAt: serverTimestamp()
    });
    await updateDoc(doc(db,'users', state.user.uid), { children: arrayUnion(childUid) });
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondaryApp);
  }
}

/* ================= SUBJECTS ================= */
function renderSubjects(){
  const cards = Object.entries(SUBJECTS).map(([key, s]) => `
    <div class="door-card ${s.cls}" data-subject="${key}">
      <svg class="blob" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#fff"/></svg>
      <div class="icon" style="color:#fff">${s.icon}</div>
      <h3>${s.name}</h3>
      <div class="desc">Xem bài tập môn ${s.name.toLowerCase()}</div>
    </div>`).join('');

  const crumbs = state.userDoc.role === 'parent' ? `
    <div class="crumbs">
      <button class="crumb-btn" id="toHomeBtn">👨‍👩‍👧 Các con</button>
      <span class="crumb-sep">›</span>
      <span class="crumb-btn" style="background:var(--purple);color:#fff;">${escapeHtml(state.currentChildName)}</span>
    </div>` : '';

  return `
    ${crumbs}
    <div class="hero">
      <h2>${state.userDoc.role==='parent' ? escapeHtml(state.currentChildName)+' học môn gì hôm nay?' : 'Chào bạn nhỏ! Học môn gì nào? 🎈'}</h2>
      <p>Chọn một cánh cửa để xem bài tập</p>
    </div>
    <div class="subject-grid">${cards}</div>`;
}

function attachSubjectsHandlers(){
  const toHome = document.getElementById('toHomeBtn');
  if(toHome) toHome.onclick = () => { state.view = 'parent-home'; render(); };
  document.querySelectorAll('.door-card').forEach(el => {
    el.onclick = async () => {
      state.currentSubject = el.dataset.subject;
      $loading.classList.remove('hidden'); $app.classList.add('hidden');
      await loadAssignmentsFor(state.currentChildId);
      $loading.classList.add('hidden'); $app.classList.remove('hidden');
      state.view = 'assignments';
      render();
    };
  });
}

/* ================= ASSIGNMENTS ================= */
function renderAssignments(){
  const s = SUBJECTS[state.currentSubject];
  const list = state.assignments
    .filter(a => a.subject === state.currentSubject)
    .sort((a,b)=> (a.dueDate||'').localeCompare(b.dueDate||''));

  const crumbs = `
    <div class="crumbs">
      ${state.userDoc.role==='parent' ? `<button class="crumb-btn" id="toHomeBtn">👨‍👩‍👧 Các con</button><span class="crumb-sep">›</span>` : ''}
      <button class="crumb-btn" id="toSubjectsBtn">${state.userDoc.role==='parent' ? escapeHtml(state.currentChildName) : '🏠 Môn học'}</button>
      <span class="crumb-sep">›</span>
      <span class="crumb-btn" style="background:${s.color};color:#fff;">${s.name}</span>
    </div>`;

  const itemsHtml = list.length ? list.map(a => {
    const sub = state.submissions[a.id];
    const done = !!sub;
    const graded = done && (sub.grade !== null && sub.grade !== undefined);
    let statusHtml;
    if(graded) statusHtml = `<span class="status-pill graded">🏆 Đã chấm: ${sub.grade}/10</span>`;
    else if(done) statusHtml = `<span class="status-pill done">✅ Đã nộp, chờ chấm</span>`;
    else statusHtml = `<span class="status-pill pending">⏳ Chưa nộp</span>`;

    let submissionBlock = '';
    if(done){
      submissionBlock = `
        <div class="submission-block">
          ${sub.photoURL ? `<img src="${sub.photoURL}" class="submission-photo" data-zoom="${sub.photoURL}"/>` : ''}
          <div class="submission-meta">
            ${sub.note ? `<div class="note">"${escapeHtml(sub.note)}"</div>` : ''}
            ${graded ? `
              <div class="grade-badge">⭐ ${sub.grade}/10</div>
              ${sub.feedback ? `<div class="feedback-text">💬 ${escapeHtml(sub.feedback)}</div>` : ''}
            ` : `<div class="field-hint">${state.userDoc.role==='parent' ? 'Chưa chấm điểm bài này.' : 'Ba mẹ chưa chấm bài này.'}</div>`}
          </div>
        </div>`;
    }

    let actions = '';
    if(state.userDoc.role === 'student' && !done){
      actions = `<div class="assign-actions"><button class="action-btn" data-submit="${a.id}">📷 Nộp bài bằng ảnh</button></div>`;
    }
    if(state.userDoc.role === 'parent'){
      actions = `<div class="assign-actions">
        ${done ? `<button class="action-btn secondary" data-grade="${a.id}">${graded ? '✏️ Sửa điểm' : '📝 Chấm điểm'}</button>` : ''}
        <button class="del-btn" data-delete="${a.id}">Xoá bài tập</button>
      </div>`;
    }

    return `
      <div class="assign-card">
        <div class="assign-top">
          <div>
            <h4>${escapeHtml(a.title)}</h4>
            <p class="desc-text">${escapeHtml(a.description||'')}</p>
            ${a.dueDate ? `<span class="due">📅 Hạn nộp: ${formatDate(a.dueDate)}</span>` : ''}
          </div>
          ${statusHtml}
        </div>
        ${submissionBlock}
        ${actions}
      </div>`;
  }).join('') : `
    <div class="empty">
      <svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="46" fill="${s.badgeBg}"/><path d="M35 45 Q50 35 65 45" stroke="${s.color}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="40" cy="55" r="4" fill="${s.color}"/><circle cx="60" cy="55" r="4" fill="${s.color}"/></svg>
      <p>${state.userDoc.role==='parent' ? 'Chưa có bài tập nào — hãy tạo bài đầu tiên!' : 'Chưa có bài tập nào ở đây cả 🎉'}</p>
    </div>`;

  return `
    ${crumbs}
    <div class="subject-header">
      <div class="subject-title">
        <div class="icon-badge" style="background:${s.badgeBg}; color:${s.color};">
          <svg width="26" height="26" viewBox="0 0 60 60">${s.icon}</svg>
        </div>
        <h2>${s.name}</h2>
      </div>
      ${state.userDoc.role==='parent' ? `<button class="add-btn" id="openCreate">+ Tạo bài tập</button>` : ''}
    </div>
    <div class="assign-list">${itemsHtml}</div>`;
}

function attachAssignmentsHandlers(){
  const toHome = document.getElementById('toHomeBtn');
  if(toHome) toHome.onclick = () => { state.view = 'parent-home'; render(); };
  const toSubjects = document.getElementById('toSubjectsBtn');
  if(toSubjects) toSubjects.onclick = () => { state.view = 'subjects'; render(); };

  const openCreate = document.getElementById('openCreate');
  if(openCreate) openCreate.onclick = openCreateAssignmentModal;

  document.querySelectorAll('[data-submit]').forEach(btn => btn.onclick = () => openSubmitModal(btn.dataset.submit));
  document.querySelectorAll('[data-grade]').forEach(btn => btn.onclick = () => openGradeModal(btn.dataset.grade));
  document.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = () => confirmDeleteAssignment(btn.dataset.delete));
  document.querySelectorAll('[data-zoom]').forEach(img => img.onclick = () => openZoom(img.dataset.zoom));
}

function openZoom(url){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="zoom-overlay" id="zov"><img src="${url}"/></div>`;
  document.getElementById('zov').onclick = closeModal;
}

/* ---- create assignment ---- */
function openCreateAssignmentModal(){
  const s = SUBJECTS[state.currentSubject];
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>✏️ Tạo bài tập — ${s.name}</h3>
        <div class="field"><label>Tên bài tập</label><input id="fTitle" placeholder="Ví dụ: Làm 10 phép cộng trang 12" maxlength="80"/></div>
        <div class="field"><label>Mô tả / yêu cầu</label><textarea id="fDesc" placeholder="Mô tả ngắn gọn cho bé..." maxlength="300"></textarea></div>
        <div class="field"><label>Hạn nộp</label><input id="fDue" type="date"/></div>
        <div id="fErr"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cancelBtn">Huỷ</button>
          <button class="btn-save" id="saveBtn">Lưu bài tập</button>
        </div>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('ov').onclick = (e)=>{ if(e.target.id==='ov') closeModal(); };
  document.getElementById('saveBtn').onclick = async () => {
    const title = document.getElementById('fTitle').value.trim();
    if(!title){ document.getElementById('fErr').innerHTML = `<div class="error-msg">Vui lòng nhập tên bài tập.</div>`; return; }
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...';
    try{
      await addDoc(collection(db,'assignments'), {
        subject: state.currentSubject,
        title,
        description: document.getElementById('fDesc').value.trim(),
        dueDate: document.getElementById('fDue').value,
        studentId: state.currentChildId,
        createdBy: state.user.uid,
        createdAt: serverTimestamp()
      });
      await loadAssignmentsFor(state.currentChildId);
      closeModal(); render();
      showToast('Đã tạo bài tập mới! 🎉');
    }catch(e){
      document.getElementById('fErr').innerHTML = `<div class="error-msg">Không lưu được, thử lại nhé.</div>`;
      saveBtn.disabled = false; saveBtn.textContent = 'Lưu bài tập';
    }
  };
}

async function confirmDeleteAssignment(id){
  if(!confirm('Xoá bài tập này? Hành động này không thể hoàn tác.')) return;
  await deleteDoc(doc(db,'assignments',id));
  try{ await deleteDoc(doc(db,'submissions',id)); }catch(e){}
  await loadAssignmentsFor(state.currentChildId);
  render();
  showToast('Đã xoá bài tập');
}

/* ---- student: submit via photo ---- */
function openSubmitModal(assignmentId){
  const a = state.assignments.find(x=>x.id===assignmentId);
  let selectedFile = null;
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>📷 Nộp bài: ${escapeHtml(a.title)}</h3>
        <img id="preview" class="photo-preview hidden"/>
        <label class="photo-input-btn" id="pickBtn">📸 Chụp hoặc chọn ảnh bài làm
          <input type="file" accept="image/*" capture="environment" id="fileInput" style="display:none;"/>
        </label>
        <div class="field"><label>Ghi chú cho ba mẹ (không bắt buộc)</label><textarea id="fNote" placeholder="Con đã làm xong bài này..." maxlength="300"></textarea></div>
        <div class="upload-progress hidden" id="progWrap"><div class="upload-progress-bar" id="progBar"></div></div>
        <div id="sErr"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cancelBtn">Huỷ</button>
          <button class="btn-save" id="saveBtn">Nộp bài ✅</button>
        </div>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('ov').onclick = (e)=>{ if(e.target.id==='ov') closeModal(); };

  const fileInput = document.getElementById('fileInput');
  fileInput.onchange = () => {
    const f = fileInput.files[0];
    if(!f) return;
    selectedFile = f;
    const preview = document.getElementById('preview');
    preview.src = URL.createObjectURL(f);
    preview.classList.remove('hidden');
  };

  document.getElementById('saveBtn').onclick = async () => {
    const errBox = document.getElementById('sErr');
    if(!selectedFile){ errBox.innerHTML = `<div class="error-msg">Vui lòng chọn hoặc chụp một ảnh bài làm.</div>`; return; }
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang tải ảnh...';
    document.getElementById('progWrap').classList.remove('hidden');
    try{
      document.getElementById('progBar').style.width = '40%';
      const url = await uploadToCloudinary(selectedFile);
      document.getElementById('progBar').style.width = '100%';
      await setDoc(doc(db,'submissions',assignmentId), {
        assignmentId,
        studentId: state.user.uid,
        photoURL: url,
        note: document.getElementById('fNote').value.trim(),
        submittedAt: serverTimestamp(),
        grade: null,
        feedback: null
      });
      await loadAssignmentsFor(state.currentChildId);
      closeModal(); render();
      showToast('Tuyệt vời! Bé đã nộp bài 🌟');
    }catch(e){
      errBox.innerHTML = `<div class="error-msg">Không nộp được bài, kiểm tra kết nối mạng và thử lại.</div>`;
      saveBtn.disabled = false; saveBtn.textContent = 'Nộp bài ✅';
    }
  };
}

/* ---- parent: grade + feedback ---- */
function openGradeModal(assignmentId){
  const a = state.assignments.find(x=>x.id===assignmentId);
  const sub = state.submissions[assignmentId] || {};
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>📝 Chấm điểm: ${escapeHtml(a.title)}</h3>
        ${sub.photoURL ? `<img src="${sub.photoURL}" class="photo-preview" style="cursor:zoom-in;" id="gradePhoto"/>` : ''}
        ${sub.note ? `<p class="field-hint" style="margin-bottom:10px;">Ghi chú của bé: "${escapeHtml(sub.note)}"</p>` : ''}
        <div class="field"><label>Điểm (0–10)</label><input id="gGrade" type="number" min="0" max="10" step="0.5" value="${sub.grade ?? ''}"/></div>
        <div class="field"><label>Nhận xét</label><textarea id="gFeedback" placeholder="Con làm rất tốt! Lần sau chú ý..." maxlength="300">${escapeHtml(sub.feedback||'')}</textarea></div>
        <div id="gErr"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cancelBtn">Huỷ</button>
          <button class="btn-save" id="saveBtn">Lưu chấm điểm</button>
        </div>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('ov').onclick = (e)=>{ if(e.target.id==='ov') closeModal(); };
  const photo = document.getElementById('gradePhoto');
  if(photo) photo.onclick = () => openZoom(sub.photoURL);

  document.getElementById('saveBtn').onclick = async () => {
    const gradeVal = parseFloat(document.getElementById('gGrade').value);
    const errBox = document.getElementById('gErr');
    if(isNaN(gradeVal) || gradeVal < 0 || gradeVal > 10){
      errBox.innerHTML = `<div class="error-msg">Điểm phải từ 0 đến 10.</div>`; return;
    }
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...';
    try{
      await updateDoc(doc(db,'submissions',assignmentId), {
        grade: gradeVal,
        feedback: document.getElementById('gFeedback').value.trim(),
        gradedAt: serverTimestamp()
      });
      await loadAssignmentsFor(state.currentChildId);
      closeModal(); render();
      showToast('Đã lưu điểm & nhận xét! 🏆');
    }catch(e){
      errBox.innerHTML = `<div class="error-msg">Không lưu được, thử lại nhé.</div>`;
      saveBtn.disabled = false; saveBtn.textContent = 'Lưu chấm điểm';
    }
  };
}

function closeModal(){ document.getElementById('modalRoot').innerHTML = ''; }