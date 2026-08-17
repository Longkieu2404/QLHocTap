import { firebaseConfig } from './firebase-config.js';
import { cloudinaryConfig } from './cloudinary-config.js';
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc, arrayUnion, serverTimestamp,
  writeBatch
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
// Bộ icon có sẵn để phụ huynh chọn khi tự tạo môn học (không còn danh sách
// môn học cố định — phụ huynh tạo/sửa/xoá môn học tuỳ ý cho từng bé).
const SUBJECT_ICONS = {
  book: `<svg viewBox="0 0 60 60" fill="none"><path d="M12 15 C22 10 30 10 30 15 L30 46 C30 41 22 41 12 46 Z" fill="currentColor" opacity="0.9"/><path d="M48 15 C38 10 30 10 30 15 L30 46 C30 41 38 41 48 46 Z" fill="currentColor" opacity="0.6"/></svg>`,
  cross: `<svg viewBox="0 0 60 60" fill="none"><rect x="10" y="10" width="40" height="40" rx="8" fill="currentColor" opacity="0.25"/><path d="M18 18 L42 42 M42 18 L18 42" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="30" r="4" fill="currentColor"/></svg>`,
  globe: `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="19" fill="currentColor" opacity="0.85"/><path d="M11 30 H49 M30 11 C22 20 22 40 30 49 C38 40 38 20 30 11Z" stroke="currentColor" stroke-width="2.4" fill="none" opacity="0.5"/></svg>`,
  star: `<svg viewBox="0 0 60 60" fill="none"><path d="M30 8 L36 24 L53 24 L39 34 L44 51 L30 41 L16 51 L21 34 L7 24 L24 24 Z" fill="currentColor"/></svg>`,
  flask: `<svg viewBox="0 0 60 60" fill="none"><path d="M24 8 H36 V22 L48 46 C50 50 47 54 43 54 H17 C13 54 10 50 12 46 L24 22 Z" fill="currentColor" opacity="0.85"/><path d="M18 40 H42" stroke="#fff" stroke-width="3" opacity="0.5"/></svg>`,
  calc: `<svg viewBox="0 0 60 60" fill="none"><rect x="14" y="8" width="32" height="44" rx="6" fill="currentColor" opacity="0.25"/><rect x="19" y="14" width="22" height="10" rx="2" fill="currentColor"/><circle cx="22" cy="34" r="3" fill="currentColor"/><circle cx="30" cy="34" r="3" fill="currentColor"/><circle cx="38" cy="34" r="3" fill="currentColor"/><circle cx="22" cy="44" r="3" fill="currentColor"/><circle cx="30" cy="44" r="3" fill="currentColor"/><circle cx="38" cy="44" r="3" fill="currentColor"/></svg>`,
  music: `<svg viewBox="0 0 60 60" fill="none"><circle cx="18" cy="46" r="7" fill="currentColor"/><circle cx="42" cy="40" r="7" fill="currentColor"/><path d="M25 46 V14 L49 8 V40" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  palette: `<svg viewBox="0 0 60 60" fill="none"><path d="M30 8 C15 8 6 19 6 31 C6 40 13 44 19 41 C22 39 27 40 27 44 C27 49 31 52 36 52 C48 52 54 41 54 30 C54 17 44 8 30 8Z" fill="currentColor" opacity="0.3"/><circle cx="18" cy="26" r="4" fill="currentColor"/><circle cx="30" cy="18" r="4" fill="currentColor"/><circle cx="42" cy="24" r="4" fill="currentColor"/><circle cx="20" cy="38" r="4" fill="currentColor"/></svg>`,
  ball: `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="22" fill="currentColor" opacity="0.85"/><path d="M30 14 L38 22 L35 32 L25 32 L22 22 Z M30 14 V8 M22 22 L14 18 M38 22 L46 18 M25 32 L20 44 M35 32 L40 44" stroke="#fff" stroke-width="2" opacity="0.6" fill="none"/></svg>`,
  puzzle: `<svg viewBox="0 0 60 60" fill="none"><path d="M14 14 H28 C28 10 32 8 34 10 C36 12 34 16 34 16 V14 H46 V26 C50 26 52 30 50 32 C48 34 44 32 44 32 V38 H32 C32 42 28 44 26 42 C24 40 26 36 26 36 H14 Z" fill="currentColor" opacity="0.85"/></svg>`
};
// Bảng màu để phụ huynh chọn cho môn học tự tạo.
const SUBJECT_COLORS = ["#FF6B6B","#FFB100","#3FC9BE","#8B6FD6","#FF9EAA","#6EC6FF","#59C36A","#FF8F5E"];
const AVATAR_COLORS = ["#FF6B6B","#FFB100","#3FC9BE","#8B6FD6","#FF9EAA","#6EC6FF"];

function shadeColor(hex, percent){
  hex = (hex||'#8B6FD6').replace('#','');
  let r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
  r = Math.max(0, Math.min(255, Math.round(r*(1+percent))));
  g = Math.max(0, Math.min(255, Math.round(g*(1+percent))));
  b = Math.max(0, Math.min(255, Math.round(b*(1+percent))));
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function hexToRgba(hex, alpha){
  hex = (hex||'#8B6FD6').replace('#','');
  const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------- state ---------- */
let state = {
  user: null,
  userDoc: null,
  children: [],
  currentChildId: null,
  currentChildName: null,
  currentSubject: null,
  subjects: [],
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
        await loadSubjectsFor(user.uid);
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
    state = { ...state, userDoc:null, children:[], currentChildId:null, currentSubject:null, subjects:[], view:'login' };
  }
  $loading.classList.add('hidden');
  $app.classList.remove('hidden');
  render();
});

async function loadChildren(){
  // Luôn lấy lại hồ sơ phụ huynh MỚI NHẤT từ Firestore trước, vì mảng "children"
  // trong bộ nhớ (state.userDoc) có thể đã lỗi thời sau khi vừa thêm/xoá con —
  // nếu không làm bước này, giao diện sẽ không cập nhật cho tới khi tải lại trang.
  const freshSnap = await getDoc(doc(db,'users', state.user.uid));
  if(freshSnap.exists()){ state.userDoc = freshSnap.data(); }

  const ids = state.userDoc.children || [];
  const results = [];
  for(const id of ids){
    const s = await getDoc(doc(db,'users',id));
    if(s.exists()) results.push({ uid:id, ...s.data() });
  }
  state.children = results;
}

async function loadSubjectsFor(childId){
  const q1 = query(collection(db,'subjects'), where('studentId','==', childId));
  const snap = await getDocs(q1);
  state.subjects = snap.docs.map(d => ({ id:d.id, ...d.data() }));
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
  // Nếu môn học đang xem vừa bị xoá (vd: phụ huynh xoá rồi quay lại), quay về danh sách môn học.
  if(state.view === 'assignments' && !state.subjects.find(x=>x.id===state.currentSubject)){
    state.view = 'subjects';
  }
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
  const cards = state.children.map(c => {
    const parentCount = (c.parentIds||[]).length;
    return `
    <div class="child-card" data-child="${c.uid}" data-name="${escapeHtml(c.name)}">
      <button class="invite-icon-btn" data-invite="${c.uid}" data-invitename="${escapeHtml(c.name)}" title="Mời đồng phụ huynh">👥</button>
      <div class="child-avatar" style="background:${uidColor(c.name)}">${initials(c.name)}</div>
      <h4>${escapeHtml(c.name)}</h4>
      <div class="meta">${escapeHtml(c.email)}</div>
      ${parentCount > 1 ? `<div class="parent-count-tag">👥 ${parentCount} phụ huynh quản lý</div>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="hero">
      <h2>Chào ${escapeHtml(state.userDoc.name)}! 👋</h2>
      <p>Chọn một bé để xem bài tập, hoặc thêm tài khoản con mới</p>
      <button class="link-btn" id="joinFamilyBtn">🔗 Tham gia bằng mã mời</button>
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
      $loading.classList.remove('hidden'); $app.classList.add('hidden');
      await loadSubjectsFor(state.currentChildId);
      $loading.classList.add('hidden'); $app.classList.remove('hidden');
      state.view = 'subjects';
      render();
    };
  });
  document.querySelectorAll('[data-invite]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openInviteChildModal(btn.dataset.invite, btn.dataset.invitename);
    };
  });
  const addBtn = document.getElementById('addChildBtn');
  if(addBtn) addBtn.onclick = openAddChildModal;
  const joinBtn = document.getElementById('joinFamilyBtn');
  if(joinBtn) joinBtn.onclick = openJoinFamilyModal;
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
      role:'student', name, email, parentIds:[state.user.uid], createdAt: serverTimestamp()
    });
    await updateDoc(doc(db,'users', state.user.uid), { children: arrayUnion(childUid) });
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondaryApp);
  }
}

/* ================= ĐỒNG PHỤ HUYNH (mã mời) ================= */
// Sinh mã mời ngẫu nhiên 6 ký tự, bỏ các ký tự dễ nhầm lẫn (0/O, 1/I...).
function generateInviteCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for(let i=0;i<6;i++) code += chars[bytes[i] % chars.length];
  return code;
}

// Phụ huynh đang quản lý bé tạo 1 mã mời để chia sẻ cho phụ huynh khác.
async function createInviteForChild(childId, childName){
  const code = generateInviteCode();
  await setDoc(doc(db,'invites',code), {
    studentId: childId,
    studentName: childName,
    createdBy: state.user.uid,
    createdAt: serverTimestamp()
  });
  return code;
}

// Một phụ huynh (đã có tài khoản Phụ huynh) nhập mã mời để tự liên kết mình
// làm đồng phụ huynh của bé tương ứng. Ghi cùng lúc (batch) vào hồ sơ bé
// (thêm mình vào parentIds) và hồ sơ chính mình (thêm bé vào children).
// LƯU Ý: không được đọc trước hồ sơ users/{studentId} ở đây để "kiểm tra đã
// liên kết chưa" — theo Firestore Rules, phụ huynh CHƯA liên kết không có
// quyền đọc hồ sơ của bé đó, nên việc đọc trước sẽ luôn bị permission-denied.
async function acceptInviteCode(code){
  const inviteSnap = await getDoc(doc(db,'invites',code));
  if(!inviteSnap.exists()) throw new Error('invite-not-found');
  const { studentId } = inviteSnap.data();

  const batch = writeBatch(db);
  batch.update(doc(db,'users', studentId), {
    parentIds: arrayUnion(state.user.uid),
    lastJoinCode: code
  });
  batch.update(doc(db,'users', state.user.uid), {
    children: arrayUnion(studentId)
  });
  await batch.commit();
}

function openInviteChildModal(childId, childName){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>👥 Mời đồng phụ huynh cho ${escapeHtml(childName)}</h3>
        <p class="field-hint" style="margin-bottom:14px;">Chia sẻ mã bên dưới cho phụ huynh kia. Họ cần có sẵn (hoặc tạo mới) một tài khoản Phụ huynh, sau đó bấm "Tham gia bằng mã mời" và nhập mã này để cùng quản lý bé.</p>
        <div id="inviteBox" class="invite-code-box">Đang tạo mã...</div>
        <div id="iErr"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cancelBtn">Đóng</button>
          <button class="btn-save" id="copyBtn" disabled>Sao chép mã</button>
        </div>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('ov').onclick = (e)=>{ if(e.target.id==='ov') closeModal(); };

  let currentCode = '';
  createInviteForChild(childId, childName).then(code => {
    currentCode = code;
    document.getElementById('inviteBox').textContent = code;
    const copyBtn = document.getElementById('copyBtn');
    copyBtn.disabled = false;
    copyBtn.onclick = async () => {
      try{
        await navigator.clipboard.writeText(currentCode);
        showToast('Đã sao chép mã mời! 📋');
      }catch(e){
        showToast('Không sao chép được, hãy chọn và copy mã thủ công.');
      }
    };
  }).catch((e)=>{
    // Log lỗi thật ra console để dễ chẩn đoán (vd: permission-denied nghĩa là
    // Firestore Rules trên Firebase Console chưa được cập nhật bản mới nhất).
    console.error('Lỗi khi tạo mã mời:', e);
    const box = document.getElementById('iErr');
    if(box) box.innerHTML = `<div class="error-msg">Không tạo được mã mời, thử lại nhé.${e?.code === 'permission-denied' ? ' (Có thể Firestore Rules chưa được cập nhật — kiểm tra Firebase Console.)' : ''}</div>`;
  });
}

function openJoinFamilyModal(){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>🔗 Tham gia bằng mã mời</h3>
        <p class="field-hint" style="margin-bottom:14px;">Nhập mã mời mà một phụ huynh khác đã chia sẻ với bạn để cùng quản lý bé đó.</p>
        <div class="field"><label>Mã mời</label><input id="jCode" placeholder="VD: A3F7QZ" maxlength="6" style="text-transform:uppercase;letter-spacing:2px;"/></div>
        <div id="jErr"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cancelBtn">Huỷ</button>
          <button class="btn-save" id="saveBtn">Tham gia</button>
        </div>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('ov').onclick = (e)=>{ if(e.target.id==='ov') closeModal(); };
  document.getElementById('saveBtn').onclick = async () => {
    const code = document.getElementById('jCode').value.trim().toUpperCase();
    const errBox = document.getElementById('jErr');
    if(!code){ errBox.innerHTML = `<div class="error-msg">Vui lòng nhập mã mời.</div>`; return; }
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang tham gia...';
    try{
      await acceptInviteCode(code);
      await loadChildren();
      closeModal(); render();
      showToast('Đã tham gia quản lý bé! 🎉');
    }catch(e){
      console.error('Lỗi khi tham gia bằng mã mời:', e);
      const msgMap = {
        'invite-not-found': 'Mã mời không tồn tại hoặc đã hết hạn.'
      };
      const fallback = e?.code === 'permission-denied'
        ? 'Không tham gia được — mã có thể sai/đã bị thu hồi, hoặc bạn đã là phụ huynh của bé này rồi. (Nếu vừa cập nhật Firestore Rules, hãy chắc chắn đã bấm Publish và thử lại.)'
        : 'Không tham gia được, kiểm tra lại mã và thử lại.';
      errBox.innerHTML = `<div class="error-msg">${escapeHtml(msgMap[e.message] || fallback)}</div>`;
      saveBtn.disabled = false; saveBtn.textContent = 'Tham gia';
    }
  };
}

/* ================= SUBJECTS ================= */
function renderSubjects(){
  const isParent = state.userDoc.role === 'parent';
  const list = [...state.subjects].sort((a,b)=> (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));

  const cards = list.map(s => {
    const icon = SUBJECT_ICONS[s.icon] || SUBJECT_ICONS.book;
    const deep = shadeColor(s.color, -0.22);
    return `
    <div class="door-card" data-subject="${s.id}" style="background:linear-gradient(160deg, ${s.color} 0%, ${deep} 100%);">
      ${isParent ? `
        <div class="door-actions">
          <button class="door-icon-btn" data-edit-subject="${s.id}" title="Sửa môn học">✏️</button>
          <button class="door-icon-btn" data-delete-subject="${s.id}" title="Xoá môn học">🗑️</button>
        </div>` : ''}
      <svg class="blob" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#fff"/></svg>
      <div class="icon" style="color:#fff">${icon}</div>
      <h3>${escapeHtml(s.name)}</h3>
      <div class="desc">Xem bài tập môn ${escapeHtml(s.name.toLowerCase())}</div>
    </div>`;
  }).join('');

  const addCard = isParent ? `
    <div class="door-card add-subject-card" id="addSubjectBtn">
      <div class="plus">＋</div>
      <div>Tạo môn học</div>
    </div>` : '';

  const crumbs = isParent ? `
    <div class="crumbs">
      <button class="crumb-btn" id="toHomeBtn">👨‍👩‍👧 Các con</button>
      <span class="crumb-sep">›</span>
      <span class="crumb-btn" style="background:var(--purple);color:#fff;">${escapeHtml(state.currentChildName)}</span>
    </div>` : '';

  const gridOrEmpty = (list.length || isParent) ? `
    <div class="subject-grid">${cards}${addCard}</div>` : `
    <div class="empty">
      <svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="46" fill="#F1EEFB"/><path d="M35 45 Q50 35 65 45" stroke="var(--purple)" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="40" cy="55" r="4" fill="var(--purple)"/><circle cx="60" cy="55" r="4" fill="var(--purple)"/></svg>
      <p>Ba mẹ chưa tạo môn học nào cho con cả 🎈</p>
    </div>`;

  return `
    ${crumbs}
    <div class="hero">
      <h2>${isParent ? escapeHtml(state.currentChildName)+' học môn gì hôm nay?' : 'Chào bạn nhỏ! Học môn gì nào? 🎈'}</h2>
      <p>${isParent ? 'Chọn một cánh cửa để xem bài tập, hoặc tạo môn học mới' : 'Chọn một cánh cửa để xem bài tập'}</p>
    </div>
    ${gridOrEmpty}`;
}

function attachSubjectsHandlers(){
  const toHome = document.getElementById('toHomeBtn');
  if(toHome) toHome.onclick = () => { state.view = 'parent-home'; render(); };

  document.querySelectorAll('.door-card[data-subject]').forEach(el => {
    el.onclick = async (e) => {
      if(e.target.closest('[data-edit-subject]') || e.target.closest('[data-delete-subject]')) return;
      state.currentSubject = el.dataset.subject;
      $loading.classList.remove('hidden'); $app.classList.add('hidden');
      await loadAssignmentsFor(state.currentChildId);
      $loading.classList.add('hidden'); $app.classList.remove('hidden');
      state.view = 'assignments';
      render();
    };
  });
  document.querySelectorAll('[data-edit-subject]').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); openEditSubjectModal(btn.dataset.editSubject); };
  });
  document.querySelectorAll('[data-delete-subject]').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); confirmDeleteSubject(btn.dataset.deleteSubject); };
  });
  const addBtn = document.getElementById('addSubjectBtn');
  if(addBtn) addBtn.onclick = openCreateSubjectModal;
}

function iconPickerHtml(selected){
  return Object.keys(SUBJECT_ICONS).map(key => `
    <button type="button" class="icon-pick-btn ${key===selected?'active':''}" data-icon="${key}">${SUBJECT_ICONS[key]}</button>
  `).join('');
}
function colorPickerHtml(selected){
  return SUBJECT_COLORS.map(c => `
    <button type="button" class="color-pick-btn ${c===selected?'active':''}" data-color="${c}" style="background:${c};"></button>
  `).join('');
}
function wirePickers(getSelected, setIcon, setColor){
  document.querySelectorAll('#iconPicker [data-icon]').forEach(b => {
    b.onclick = () => {
      setIcon(b.dataset.icon);
      document.querySelectorAll('#iconPicker [data-icon]').forEach(x => x.classList.toggle('active', x===b));
    };
  });
  document.querySelectorAll('#colorPicker [data-color]').forEach(b => {
    b.onclick = () => {
      setColor(b.dataset.color);
      document.querySelectorAll('#colorPicker [data-color]').forEach(x => x.classList.toggle('active', x===b));
    };
  });
}

/* ---- create subject (parent-only) ---- */
function openCreateSubjectModal(){
  let selectedIcon = 'book';
  let selectedColor = SUBJECT_COLORS[0];
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>📚 Tạo môn học mới</h3>
        <div class="field"><label>Tên môn học</label><input id="sName" placeholder="Ví dụ: Toán, Vẽ, Âm nhạc, Khoa học..." maxlength="40"/></div>
        <div class="field"><label>Chọn biểu tượng</label><div class="icon-picker" id="iconPicker">${iconPickerHtml(selectedIcon)}</div></div>
        <div class="field"><label>Chọn màu sắc</label><div class="color-picker" id="colorPicker">${colorPickerHtml(selectedColor)}</div></div>
        <div id="sErr"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cancelBtn">Huỷ</button>
          <button class="btn-save" id="saveBtn">Tạo môn học</button>
        </div>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('ov').onclick = (e)=>{ if(e.target.id==='ov') closeModal(); };
  wirePickers(null, (v)=>selectedIcon=v, (v)=>selectedColor=v);

  document.getElementById('saveBtn').onclick = async () => {
    const name = document.getElementById('sName').value.trim();
    const errBox = document.getElementById('sErr');
    if(!name){ errBox.innerHTML = `<div class="error-msg">Vui lòng nhập tên môn học.</div>`; return; }
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...';
    try{
      await addDoc(collection(db,'subjects'), {
        name,
        icon: selectedIcon,
        color: selectedColor,
        studentId: state.currentChildId,
        createdBy: state.user.uid,
        createdAt: serverTimestamp()
      });
      await loadSubjectsFor(state.currentChildId);
      closeModal(); render();
      showToast('Đã tạo môn học mới! 🎉');
    }catch(e){
      errBox.innerHTML = `<div class="error-msg">Không lưu được, thử lại nhé.</div>`;
      saveBtn.disabled = false; saveBtn.textContent = 'Tạo môn học';
    }
  };
}

/* ---- edit subject (parent-only) ---- */
function openEditSubjectModal(subjectId){
  const subj = state.subjects.find(x=>x.id===subjectId);
  if(!subj) return;
  let selectedIcon = subj.icon;
  let selectedColor = subj.color;
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>✏️ Sửa môn học</h3>
        <div class="field"><label>Tên môn học</label><input id="sName" value="${escapeHtml(subj.name)}" maxlength="40"/></div>
        <div class="field"><label>Chọn biểu tượng</label><div class="icon-picker" id="iconPicker">${iconPickerHtml(selectedIcon)}</div></div>
        <div class="field"><label>Chọn màu sắc</label><div class="color-picker" id="colorPicker">${colorPickerHtml(selectedColor)}</div></div>
        <div id="sErr"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="cancelBtn">Huỷ</button>
          <button class="btn-save" id="saveBtn">Lưu thay đổi</button>
        </div>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('ov').onclick = (e)=>{ if(e.target.id==='ov') closeModal(); };
  wirePickers(null, (v)=>selectedIcon=v, (v)=>selectedColor=v);

  document.getElementById('saveBtn').onclick = async () => {
    const name = document.getElementById('sName').value.trim();
    const errBox = document.getElementById('sErr');
    if(!name){ errBox.innerHTML = `<div class="error-msg">Vui lòng nhập tên môn học.</div>`; return; }
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...';
    try{
      await updateDoc(doc(db,'subjects',subjectId), { name, icon: selectedIcon, color: selectedColor });
      await loadSubjectsFor(state.currentChildId);
      closeModal(); render();
      showToast('Đã cập nhật môn học! ✅');
    }catch(e){
      errBox.innerHTML = `<div class="error-msg">Không lưu được, thử lại nhé.</div>`;
      saveBtn.disabled = false; saveBtn.textContent = 'Lưu thay đổi';
    }
  };
}

async function confirmDeleteSubject(subjectId){
  const subj = state.subjects.find(x=>x.id===subjectId);
  if(!subj) return;
  if(!confirm(`Xoá môn học "${subj.name}"? Toàn bộ bài tập trong môn này cũng sẽ bị xoá. Hành động này không thể hoàn tác.`)) return;
  try{
    // Chỉ lọc theo studentId (index đơn) rồi lọc "subject" ở phía client,
    // để không cần tạo composite index trên Firestore.
    const snap = await getDocs(query(collection(db,'assignments'), where('studentId','==', state.currentChildId)));
    const toDelete = snap.docs.filter(d => d.data().subject === subjectId);
    for(const d of toDelete){
      await deleteDoc(doc(db,'assignments', d.id));
      try{ await deleteDoc(doc(db,'submissions', d.id)); }catch(e){}
    }
    await deleteDoc(doc(db,'subjects', subjectId));
    await loadSubjectsFor(state.currentChildId);
    render();
    showToast('Đã xoá môn học');
  }catch(e){
    console.error('Lỗi khi xoá môn học:', e);
    showToast('Không xoá được môn học, thử lại nhé.');
  }
}

/* ================= ASSIGNMENTS ================= */
function renderAssignments(){
  const s = state.subjects.find(x=>x.id===state.currentSubject);
  const icon = SUBJECT_ICONS[s.icon] || SUBJECT_ICONS.book;
  const badgeBg = hexToRgba(s.color, 0.18);
  const list = state.assignments
    .filter(a => a.subject === state.currentSubject)
    .sort((a,b)=> (a.dueDate||'').localeCompare(b.dueDate||''));

  const crumbs = `
    <div class="crumbs">
      ${state.userDoc.role==='parent' ? `<button class="crumb-btn" id="toHomeBtn">👨‍👩‍👧 Các con</button><span class="crumb-sep">›</span>` : ''}
      <button class="crumb-btn" id="toSubjectsBtn">${state.userDoc.role==='parent' ? escapeHtml(state.currentChildName) : '🏠 Môn học'}</button>
      <span class="crumb-sep">›</span>
      <span class="crumb-btn" style="background:${s.color};color:#fff;">${escapeHtml(s.name)}</span>
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
      <svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="46" fill="${badgeBg}"/><path d="M35 45 Q50 35 65 45" stroke="${s.color}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="40" cy="55" r="4" fill="${s.color}"/><circle cx="60" cy="55" r="4" fill="${s.color}"/></svg>
      <p>${state.userDoc.role==='parent' ? 'Chưa có bài tập nào — hãy tạo bài đầu tiên!' : 'Chưa có bài tập nào ở đây cả 🎉'}</p>
    </div>`;

  return `
    ${crumbs}
    <div class="subject-header">
      <div class="subject-title">
        <div class="icon-badge" style="background:${badgeBg}; color:${s.color};">
          <svg width="26" height="26" viewBox="0 0 60 60">${icon}</svg>
        </div>
        <h2>${escapeHtml(s.name)}</h2>
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
  const s = state.subjects.find(x=>x.id===state.currentSubject);
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal">
        <h3>✏️ Tạo bài tập — ${escapeHtml(s.name)}</h3>
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