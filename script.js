// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyAVTAj0DqipnXFz6CC4EWUU6g-bbeD-87M",
  authDomain: "ultah-c6ecb.firebaseapp.com",
  projectId: "ultah-c6ecb",
  storageBucket: "ultah-c6ecb.firebasestorage.app",
  messagingSenderId: "788535742870",
  appId: "1:788535742870:web:6c33b0ab679216291f8db7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const APP_DOC = db.collection('app').doc('data');

// ===== STATE =====
let data = {
  birthdayName: 'Nama',
  messages: [],
  photos: [],
  adminPassword: 'admin123',
  profilePhoto: null
};

let bookOpen = false;
let bookPage = 0;
let isAdmin = false;
const ADMIN_PAGE_SIZE = 10;
let adminMsgVisible = ADMIN_PAGE_SIZE;
let adminPhotoVisible = ADMIN_PAGE_SIZE;
const colors = ['balloon-c1','balloon-c2','balloon-c3','balloon-c4'];
let flipping = false;
const FLIP_DURATION = 700;
let partyEffectsStarted = false;

// ===== FIRESTORE =====
async function loadAppData() {
  const doc = await APP_DOC.get();
  if (doc.exists) {
    const d = doc.data();
    data.birthdayName = d.birthdayName || 'Nama';
    data.adminPassword = d.adminPassword || 'admin123';
    data.profilePhoto = d.profilePhoto || null;
    data.photos = d.photos || [];
  } else {
    await saveAppData();
  }
}

async function saveAppData() {
  await APP_DOC.set({
    birthdayName: data.birthdayName,
    adminPassword: data.adminPassword,
    profilePhoto: data.profilePhoto || null,
    photos: data.photos
  });
}

function listenMessages() {
  db.collection('messages').orderBy('ts').onSnapshot(snap => {
    data.messages = snap.docs.map(d => ({
      _id: d.id,
      from: d.data().from,
      text: d.data().text,
      ts: d.data().ts
    }));
    renderBalloons();
    renderAdminMessages();
  });
}

// ===== INIT =====
async function init() {
  try {
    await loadAppData();
    listenMessages();
  } catch (e) {
    console.error(e);
    alert('Gagal konek ke database. Cek koneksi internet.');
  }
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('ask-name').textContent = data.birthdayName;
  document.getElementById('write-name').textContent = data.birthdayName;
  document.getElementById('admin-name-input').value = data.birthdayName;
  renderCoverIcon();
  renderProfilePreview();
  renderAlbum();
  renderAdminPhotos();
}

// ===== UI =====
function renderCoverIcon() {
  const el = document.getElementById('cover-icon');
  if (data.profilePhoto) {
    el.innerHTML = `<img src="${data.profilePhoto}" alt="${escapeHtml(data.birthdayName)}">`;
  } else {
    el.textContent = '📔';
  }
}

function renderProfilePreview() {
  const el = document.getElementById('profile-preview');
  if (data.profilePhoto) {
    el.style.backgroundImage = `url('${data.profilePhoto}')`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = '👤';
  }
}

function goTo(screen) {
  ['ask','celebration','write'].forEach(s => {
    document.getElementById('screen-' + s).classList.toggle('hidden', s !== screen);
  });
  if (screen === 'celebration') { renderBalloons(); renderAlbum(); initPartyEffects(); }
  if (screen === 'write') resetWriteForm();
}

function renderBalloons() {
  const field = document.getElementById('balloon-field');
  field.innerHTML = '';
  if (data.messages.length === 0) {
    field.innerHTML = '<div class="empty-state">Belum ada pesan masuk. Yuk minta teman-teman buat ngirim ucapan! 🎈</div>';
    return;
  }
  const total = data.messages.length;
  const baseRadius = 38;
  const ringGap = 17;
  const perRingBase = 8;
  const perRingGrowth = 5;

  const rings = [];
  let remaining = total;
  let ringIndex = 0;
  while (remaining > 0) {
    const capacity = perRingBase + ringIndex * perRingGrowth;
    const count = Math.min(remaining, capacity);
    rings.push(count);
    remaining -= count;
    ringIndex++;
  }

  let msgIndex = 0;
  rings.forEach((count, ring) => {
    const radius = baseRadius + ring * ringGap;
    const angleOffset = -Math.PI / 2 + (ring % 2 === 1 ? Math.PI / count : 0);
    for (let i = 0; i < count; i++) {
      const m = data.messages[msgIndex];
      const b = document.createElement('div');
      b.className = 'balloon ' + colors[msgIndex % colors.length];
      b.title = 'Klik untuk baca pesan';
      b.onclick = () => openPopup(m);
      const angle = (i / count) * 2 * Math.PI + angleOffset;
      const left = 50 + radius * Math.cos(angle);
      const top = 50 + radius * Math.sin(angle) * 1.05;
      b.style.left = `calc(${left}% - 45px)`;
      b.style.top = `calc(${top}% - 55px)`;
      b.innerHTML = '<div class="balloon-float"><div class="balloon-shape"></div><div class="string"></div></div>';
      field.appendChild(b);
      msgIndex++;
    }
  });
}

function openPopup(m) {
  document.getElementById('popup-from').textContent = 'Dari: ' + (m.from && m.from.trim() ? m.from : 'Anonim');
  document.getElementById('popup-msg').textContent = m.text;
  document.getElementById('popup').classList.remove('hidden');
}

function closePopup() {
  document.getElementById('popup').classList.add('hidden');
}

function toggleAnon() {
  const isAnon = document.getElementById('anon-check').checked;
  document.getElementById('from-field').classList.toggle('hidden', isAnon);
}

function resetWriteForm() {
  document.getElementById('write-form').classList.remove('hidden');
  document.getElementById('write-success').classList.add('hidden');
  document.getElementById('from-input').value = '';
  document.getElementById('msg-input').value = '';
  document.getElementById('anon-check').checked = false;
  document.getElementById('from-field').classList.remove('hidden');
  const btn = document.querySelector('#write-form .btn-primary');
  if (btn) { btn.disabled = false; btn.textContent = 'Kirim Pesan 🎈'; }
}

async function submitMessage() {
  const isAnon = document.getElementById('anon-check').checked;
  const from = isAnon ? '' : document.getElementById('from-input').value.trim();
  const text = document.getElementById('msg-input').value.trim();
  if (!text) { alert('Pesannya jangan kosong ya bre 😅'); return; }

  const btn = document.querySelector('#write-form .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';

  try {
    await db.collection('messages').add({ from, text, ts: Date.now() });
    document.getElementById('write-form').classList.add('hidden');
    document.getElementById('write-success').classList.remove('hidden');
  } catch (e) {
    alert('Gagal kirim pesan. Coba lagi.');
    btn.disabled = false;
    btn.textContent = 'Kirim Pesan 🎈';
  }
}

// ===== ADMIN =====
function openAdmin() {
  if (isAdmin) {
    showAdminPanel();
  } else {
    document.getElementById('admin-pass-input').value = '';
    document.getElementById('admin-login-error').textContent = '';
    document.getElementById('admin-login').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-pass-input').focus(), 50);
  }
}

function closeAdminLogin() {
  document.getElementById('admin-login').classList.add('hidden');
}

function checkAdminPass() {
  const val = document.getElementById('admin-pass-input').value;
  if (val === data.adminPassword) {
    isAdmin = true;
    closeAdminLogin();
    showAdminPanel();
  } else {
    document.getElementById('admin-login-error').textContent = 'Password salah, coba lagi.';
  }
}

function showAdminPanel() {
  document.getElementById('admin-panel').classList.add('open');
  document.getElementById('admin-overlay').classList.remove('hidden');
  renderAdminMessages();
  renderAdminPhotos();
}

function closeAdmin() {
  document.getElementById('admin-panel').classList.remove('open');
  document.getElementById('admin-overlay').classList.add('hidden');
}

async function saveBirthdayName() {
  const val = document.getElementById('admin-name-input').value.trim();
  if (!val) { alert('Nama jangan kosong'); return; }
  data.birthdayName = val;
  try {
    await saveAppData();
    document.getElementById('ask-name').textContent = val;
    document.getElementById('write-name').textContent = val;
    renderCoverIcon();
    alert('Profil berhasil disimpan!');
  } catch (e) {
    alert('Gagal simpan. Coba lagi.');
  }
}

function handleProfilePhotoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  compressImage(file, 400, 0.8)
    .then(async (compressed) => {
      const backup = data.profilePhoto;
      data.profilePhoto = compressed;
      try {
        await saveAppData();
        renderProfilePreview();
        renderCoverIcon();
      } catch (err) {
        data.profilePhoto = backup;
        alert('Gagal simpan foto profil. Coba foto lain yang lebih kecil.');
      }
    })
    .catch(() => alert('Gagal memproses foto. Coba file lain.'));
  event.target.value = '';
}

function renderAdminMessages() {
  const list = document.getElementById('admin-msg-list');
  const loadMoreBtn = document.getElementById('load-more-messages');
  document.getElementById('msg-count').textContent = data.messages.length;
  list.innerHTML = '';
  if (data.messages.length === 0) {
    list.innerHTML = '<div class="no-msg">Belum ada pesan masuk.</div>';
    loadMoreBtn.classList.add('hidden');
    return;
  }
  const reversed = [...data.messages].reverse();
  const visible = reversed.slice(0, adminMsgVisible);
  visible.forEach((m) => {
    const item = document.createElement('div');
    item.className = 'msg-item';
    item.dataset.id = m._id;
    item.innerHTML = `
      <div class="msg-from">${escapeHtml(m.from && m.from.trim() ? m.from : 'Anonim')}</div>
      <div class="msg-text">${escapeHtml(m.text)}</div>
      <div class="msg-actions">
        <button class="delete-btn" onclick="confirmDeleteMessage(this)">Hapus</button>
        <button class="confirm-delete-btn hidden" onclick="deleteMessage(this)">Yakin hapus?</button>
        <button class="cancel-delete-btn hidden" onclick="cancelDeleteMessage(this)">Batal</button>
      </div>
    `;
    list.appendChild(item);
  });
  if (reversed.length > adminMsgVisible) {
    loadMoreBtn.classList.remove('hidden');
    loadMoreBtn.textContent = `Lihat lebih banyak (${reversed.length - adminMsgVisible} lagi)`;
  } else {
    loadMoreBtn.classList.add('hidden');
  }
}

function loadMoreMessages() {
  adminMsgVisible += ADMIN_PAGE_SIZE;
  renderAdminMessages();
}

function confirmDeleteMessage(btn) {
  const actions = btn.parentElement;
  btn.classList.add('hidden');
  actions.querySelector('.confirm-delete-btn').classList.remove('hidden');
  actions.querySelector('.cancel-delete-btn').classList.remove('hidden');
}

function cancelDeleteMessage(btn) {
  const actions = btn.parentElement;
  actions.querySelector('.delete-btn').classList.remove('hidden');
  actions.querySelector('.confirm-delete-btn').classList.add('hidden');
  actions.querySelector('.cancel-delete-btn').classList.add('hidden');
}

async function deleteMessage(btn) {
  const id = btn.closest('.msg-item').dataset.id;
  try {
    await db.collection('messages').doc(id).delete();
  } catch (e) {
    alert('Gagal hapus pesan.');
  }
}

async function bulkDeleteMessages() {
  try {
    const snap = await db.collection('messages').get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    adminMsgVisible = ADMIN_PAGE_SIZE;
    cancelBulkDelete('messages');
  } catch (e) {
    alert('Gagal hapus semua pesan.');
  }
}

// ===== ALBUM =====
function renderAlbum() {
  const pages = document.getElementById('book-pages');
  const book = document.getElementById('book');
  const total = data.photos.length;
  if (total === 0) {
    pages.innerHTML = '<div class="book-empty" id="book-empty">Belum ada foto di album.<br>Admin bisa tambahin lewat panel ⚙️</div>';
    book.classList.remove('open');
    bookOpen = false;
    bookPage = 0;
    return;
  }
  if (bookPage >= total) bookPage = 0;
  if (!bookOpen) {
    pages.innerHTML = '';
    book.classList.remove('open');
    return;
  }
  const isOdd = total % 2 === 1;
  const offset = isOdd ? 1 : 0;
  const leftIdx = bookPage - offset;
  const rightIdx = bookPage - offset + 1;
  const leftHtml = (leftIdx >= 0 && leftIdx < total)
    ? `<div class="book-page book-page-left"><img class="book-page-img" src="${data.photos[leftIdx]}" alt="Foto kenangan"><div class="book-page-num">${leftIdx + 1}</div></div>`
    : `<div class="book-page book-page-left is-empty">🎂</div>`;
  const rightHtml = (rightIdx >= 0 && rightIdx < total)
    ? `<div class="book-page book-page-right"><img class="book-page-img" src="${data.photos[rightIdx]}" alt="Foto kenangan"><div class="book-page-num">${rightIdx + 1}</div></div>`
    : `<div class="book-page book-page-right is-empty">🎉</div>`;
  pages.innerHTML = leftHtml + rightHtml;
  book.classList.add('open');
}

function toggleBook() {
  if (data.photos.length === 0) return;
  bookOpen = true;
  bookPage = 0;
  document.getElementById('book').classList.add('open');
  renderAlbum();
}

function bookNext(e) {
  e.stopPropagation();
  const total = data.photos.length;
  if (total === 0) return;
  if (!bookOpen) { toggleBook(); return; }
  if (flipping) return;
  const offset = total % 2 === 1 ? 1 : 0;
  const rightIdx = bookPage - offset + 1;
  if (rightIdx < total - 1) {
    const outgoingSrc = (rightIdx >= 0 && rightIdx < total) ? data.photos[rightIdx] : null;
    const incomingSrc = (rightIdx + 1 < total) ? data.photos[rightIdx + 1] : null;
    const leftIdx = bookPage - offset;
    const oldLeftSrc = (leftIdx >= 0 && leftIdx < total) ? data.photos[leftIdx] : null;
    bookPage += 2;
    renderAlbum();
    flipPage('right', outgoingSrc, incomingSrc, oldLeftSrc);
  } else {
    bookOpen = false;
    document.getElementById('book').classList.remove('open');
    renderAlbum();
    setTimeout(() => { bookPage = 0; bookOpen = true; renderAlbum(); }, 650);
  }
}

function bookPrev(e) {
  e.stopPropagation();
  const total = data.photos.length;
  if (total === 0) return;
  if (!bookOpen) return;
  if (flipping) return;
  const offset = total % 2 === 1 ? 1 : 0;
  const leftIdx = bookPage - offset;
  if (leftIdx > 0 || (leftIdx === 0 && offset === 0 && bookPage - 2 >= 0)) {
    const outgoingSrc = (leftIdx >= 0 && leftIdx < total) ? data.photos[leftIdx] : null;
    const incomingSrc = (leftIdx - 1 >= 0) ? data.photos[leftIdx - 1] : null;
    const rightIdx = bookPage - offset + 1;
    const oldRightSrc = (rightIdx >= 0 && rightIdx < total) ? data.photos[rightIdx] : null;
    bookPage -= 2;
    renderAlbum();
    flipPage('left', outgoingSrc, incomingSrc, oldRightSrc);
  } else if (leftIdx <= 0) {
    bookOpen = false;
    document.getElementById('book').classList.remove('open');
    renderAlbum();
  }
}

function flipPage(direction, frontSrc, backSrc, coverSrc) {
  flipping = true;
  const pages = document.getElementById('book-pages');
  const overlay = document.createElement('div');
  overlay.className = 'flip-overlay flip-' + direction;
  const front = document.createElement('div');
  front.className = 'flip-face flip-front';
  if (frontSrc) front.style.backgroundImage = `url('${frontSrc}')`;
  const back = document.createElement('div');
  back.className = 'flip-face flip-back';
  if (backSrc) back.style.backgroundImage = `url('${backSrc}')`;
  overlay.appendChild(front);
  overlay.appendChild(back);
  pages.appendChild(overlay);
  const cover = document.createElement('div');
  cover.className = 'flip-cover flip-cover-' + (direction === 'right' ? 'left' : 'right');
  if (coverSrc) cover.style.backgroundImage = `url('${coverSrc}')`;
  pages.appendChild(cover);
  setTimeout(() => { overlay.remove(); cover.remove(); flipping = false; }, FLIP_DURATION);
}

function compressImage(file, maxDim = 600, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function handlePhotoUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  Promise.all(files.map(f => compressImage(f)))
    .then(async (compressed) => {
      const backup = data.photos;
      data.photos = [...data.photos, ...compressed];
      try {
        await saveAppData();
        renderAdminPhotos();
        renderAlbum();
      } catch (err) {
        data.photos = backup;
        alert('Gagal simpan foto: ukuran terlalu besar. Coba hapus foto lama dulu atau upload lebih sedikit.');
      }
    })
    .catch(() => alert('Gagal memproses foto. Coba file lain.'));
  event.target.value = '';
}

function renderAdminPhotos() {
  const list = document.getElementById('photo-thumb-list');
  const loadMoreBtn = document.getElementById('load-more-photos');
  list.innerHTML = '';
  const visibleCount = Math.min(adminPhotoVisible, data.photos.length);
  for (let idx = 0; idx < visibleCount; idx++) {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML = `
      <img src="${data.photos[idx]}" alt="Foto">
      <button class="photo-delete" onclick="confirmDeletePhoto(this, ${idx})">✕</button>
      <div class="photo-confirm hidden">
        <button class="confirm-delete-btn" onclick="deletePhoto(${idx})">Yakin?</button>
        <button class="cancel-delete-btn" onclick="cancelDeletePhoto(this)">Batal</button>
      </div>
    `;
    list.appendChild(thumb);
  }
  if (data.photos.length > adminPhotoVisible) {
    loadMoreBtn.classList.remove('hidden');
    loadMoreBtn.textContent = `Lihat lebih banyak (${data.photos.length - adminPhotoVisible} lagi)`;
  } else {
    loadMoreBtn.classList.add('hidden');
  }
}

function loadMorePhotos() {
  adminPhotoVisible += ADMIN_PAGE_SIZE;
  renderAdminPhotos();
}

function confirmDeletePhoto(btn, idx) {
  btn.classList.add('hidden');
  btn.parentElement.querySelector('.photo-confirm').classList.remove('hidden');
}

function cancelDeletePhoto(btn) {
  const thumb = btn.closest('.photo-thumb');
  thumb.querySelector('.photo-delete').classList.remove('hidden');
  thumb.querySelector('.photo-confirm').classList.add('hidden');
}

async function deletePhoto(idx) {
  data.photos.splice(idx, 1);
  if (bookPage >= data.photos.length) bookPage = Math.max(0, data.photos.length - (data.photos.length % 2 === 1 ? 1 : 2));
  try {
    await saveAppData();
    renderAdminPhotos();
    renderAlbum();
  } catch (e) {
    alert('Gagal hapus foto.');
  }
}

async function bulkDeletePhotos() {
  data.photos = [];
  bookPage = 0;
  bookOpen = false;
  adminPhotoVisible = ADMIN_PAGE_SIZE;
  try {
    await saveAppData();
    renderAdminPhotos();
    renderAlbum();
    cancelBulkDelete('photos');
  } catch (e) {
    alert('Gagal hapus semua foto.');
  }
}

function confirmBulkDelete(type) {
  const row = document.getElementById('bulk-delete-' + type);
  row.querySelector('.bulk-delete-btn').classList.add('hidden');
  row.querySelector('.bulk-confirm').classList.remove('hidden');
}

function cancelBulkDelete(type) {
  const row = document.getElementById('bulk-delete-' + type);
  row.querySelector('.bulk-delete-btn').classList.remove('hidden');
  row.querySelector('.bulk-confirm').classList.add('hidden');
}

async function changeAdminPass() {
  const val = document.getElementById('admin-newpass-input').value.trim();
  if (!val) { alert('Password jangan kosong'); return; }
  data.adminPassword = val;
  try {
    await saveAppData();
    document.getElementById('admin-newpass-input').value = '';
    alert('Password admin berhasil diganti!');
  } catch (e) {
    alert('Gagal simpan password.');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== PARTY EFFECTS =====
function initPartyEffects() {
  if (partyEffectsStarted) return;
  partyEffectsStarted = true;
  spawnFireworks();
  spawnConfetti();
  spawnSparkStream('spark-stream-left', 1);
  spawnSparkStream('spark-stream-right', -1);
}

const fireworkColors = ['#FF6B6B', '#FFD93D', '#4ECDC4', '#B57BFF', '#FF8E8E'];

function spawnFireworks() {
  const layer = document.getElementById('fireworks-layer');
  function burstOnce() {
    const burst = document.createElement('div');
    burst.className = 'firework';
    burst.style.left = (10 + Math.random() * 80) + '%';
    burst.style.top = (5 + Math.random() * 35) + '%';
    burst.style.color = fireworkColors[Math.floor(Math.random() * fireworkColors.length)];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'firework-burst';
      const angle = (i / 14) * 2 * Math.PI;
      const dist = 28 + Math.random() * 22;
      p.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
      p.style.setProperty('--dy', (Math.sin(angle) * dist) + 'px');
      p.style.animationDelay = (Math.random() * 0.15) + 's';
      burst.appendChild(p);
    }
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 1900);
  }
  burstOnce();
  setTimeout(burstOnce, 350);
  setTimeout(burstOnce, 800);
  setInterval(() => { burstOnce(); if (Math.random() > 0.5) setTimeout(burstOnce, 300); }, 2200);
}

const confettiColors = ['#FF6B6B', '#FFD93D', '#4ECDC4', '#B57BFF', '#FF8E8E', '#FFFFFF'];

function spawnConfetti() {
  const layer = document.getElementById('confetti-layer');
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    piece.style.animationDuration = (6 + Math.random() * 6) + 's';
    piece.style.animationDelay = '-' + (Math.random() * 10) + 's';
    const size = 6 + Math.random() * 6;
    piece.style.width = size + 'px';
    piece.style.height = (size * 1.6) + 'px';
    if (Math.random() > 0.5) piece.style.borderRadius = '50%';
    layer.appendChild(piece);
  }
}

function spawnSparkStream(elId, direction) {
  const stream = document.getElementById(elId);
  if (!stream) return;
  function shootOnce() {
    const p = document.createElement('div');
    p.className = 'spark-particle';
    const angle = ((90 - (15 + Math.random() * 35)) * Math.PI) / 180;
    const dist = 60 + Math.random() * 80;
    p.style.setProperty('--sx', (direction * Math.cos(angle) * dist) + 'px');
    p.style.setProperty('--sy', (-Math.sin(angle) * dist) + 'px');
    p.style.animationDuration = (1 + Math.random() * 0.6) + 's';
    stream.appendChild(p);
    setTimeout(() => p.remove(), 1700);
  }
  setInterval(() => { for (let i = 0; i < 2; i++) setTimeout(shootOnce, i * 60); }, 150);
}

init();
