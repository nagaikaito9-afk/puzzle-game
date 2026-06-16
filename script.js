// --- Firebase設定 ---
const firebaseConfig = {
    apiKey: "AIzaSyC4PbfPRoIMdz2K7mYW_s7pjr7K7rmSxQU",
    authDomain: "my-3d-game-83ac7.firebaseapp.com",
    databaseURL: "https://my-3d-game-83ac7-default-rtdb.firebaseio.com",
    projectId: "my-3d-game-83ac7",
    storageBucket: "my-3d-game-83ac7.firebasestorage.app",
    messagingSenderId: "481443120933",
    appId: "1:481443120933:web:54f499ce24fd4c683e3ccc"
};
if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}
const database = firebase.database();

// --- 共通変数・ゲーム進行用変数 ---
let currentUser = null, currentMode = 'login', currentBlockType = 'normal', isFirstPerson = false;
let gameCourseMode = '3D';
let myCourses = JSON.parse(localStorage.getItem('myCourses')) || [];
let viewingCourseKey = null, viewingCourseData = null, viewingCourseType = null, viewingCourseIndex = null;
let backScreenFromList = 'play-select-screen', currentLoadedCourses = [], currentCourseData = [];

// ライフと2D軸システム
const maxLife = 3;
let life = 3;
let activeCheckpoint = null; 
let current2DAxis = 'X'; 
let plane2DX = 0, plane2DZ = 0; 

// --- BGM・SE システム ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgmVol = 0.5, seVol = 0.5, isBgmPlaying = false, bgmInterval = null, bgmStep = 0;
const bgmNotes = [261.63, 329.63, 392.00, 329.63, 261.63, 392.00, 440.00, 392.00];

function updateVolume() {
    bgmVol = document.getElementById('bgm-volume').value / 100;
    seVol = document.getElementById('se-volume').value / 100;
    document.getElementById('bgm-val').innerText = document.getElementById('bgm-volume').value;
    document.getElementById('se-val').innerText = document.getElementById('se-volume').value;
    if (bgmVol <= 0) toggleBGM(false); else if (!isBgmPlaying && currentUser) toggleBGM(true);
}

function toggleBGM(play) {
    if (play && !isBgmPlaying && bgmVol > 0) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        bgmInterval = setInterval(() => {
            if (bgmVol <= 0) return;
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = 'triangle'; osc.frequency.setValueAtTime(bgmNotes[bgmStep % bgmNotes.length] / 2, audioCtx.currentTime);
            gain.gain.setValueAtTime(bgmVol * 0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.4); bgmStep++;
        }, 400); isBgmPlaying = true;
    } else if (!play && isBgmPlaying) { clearInterval(bgmInterval); isBgmPlaying = false; }
}

function playSE(type) {
    if (seVol <= 0) return; if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination); const t = audioCtx.currentTime;
    if (type === 'place') { osc.type = 'square'; osc.frequency.setValueAtTime(400, t); gain.gain.setValueAtTime(seVol * 0.3, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); osc.start(t); osc.stop(t + 0.1); }
    else if (type === 'jump') { osc.type = 'square'; osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(600, t + 0.1); gain.gain.setValueAtTime(seVol * 0.3, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); osc.start(t); osc.stop(t + 0.1); }
    else if (type === 'death') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, t); osc.frequency.exponentialRampToValueAtTime(50, t + 0.3); gain.gain.setValueAtTime(seVol * 0.5, t); gain.gain.linearRampToValueAtTime(0, t + 0.3); osc.start(t); osc.stop(t + 0.3); }
    else if (type === 'clear') { osc.type = 'triangle'; [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => osc.frequency.setValueAtTime(freq, t + i * 0.1)); gain.gain.setValueAtTime(seVol * 0.5, t); gain.gain.linearRampToValueAtTime(0, t + 0.6); osc.start(t); osc.stop(t + 0.6); }
    else if (type === 'key') { osc.type = 'sine'; osc.frequency.setValueAtTime(880, t); osc.frequency.setValueAtTime(1760, t + 0.1); gain.gain.setValueAtTime(seVol * 0.4, t); gain.gain.linearRampToValueAtTime(0, t + 0.2); osc.start(t); osc.stop(t + 0.2); }
}

// --- 自作UIダイアログ ---
function showCustomDialog(type, msg, defaultText = "") {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-dialog-overlay'), msgEl = document.getElementById('dialog-msg'), input = document.getElementById('dialog-input'), btnOk = document.getElementById('dialog-btn-ok'), btnCancel = document.getElementById('dialog-btn-cancel');
        msgEl.innerText = msg; overlay.classList.remove('hidden'); btnOk.onclick = null; btnCancel.onclick = null;
        if (type === 'alert') { input.classList.add('hidden'); btnCancel.classList.add('hidden'); btnOk.onclick = () => { overlay.classList.add('hidden'); resolve(true); }; } 
        else if (type === 'confirm') { input.classList.add('hidden'); btnCancel.classList.remove('hidden'); btnOk.onclick = () => { overlay.classList.add('hidden'); resolve(true); }; btnCancel.onclick = () => { overlay.classList.add('hidden'); resolve(false); }; } 
        else if (type === 'prompt') { input.classList.remove('hidden'); btnCancel.classList.remove('hidden'); input.value = defaultText; input.focus(); btnOk.onclick = () => { overlay.classList.add('hidden'); resolve(input.value); }; btnCancel.onclick = () => { overlay.classList.add('hidden'); resolve(null); }; }
    });
}
window.addEventListener('contextmenu', e => e.preventDefault());

// --- ★ 100種類のコメント初期化 ---
const PRESET_COMMENTS = [
    "おもしろい！", "楽しい！", "神コース！", "最高！", "天才！", "すごい！", "いいね！", "また遊びたい！", "お気に入り！", "おすすめ！",
    "難しい..", "激ムズ！", "鬼畜すぎる！", "簡単！", "ちょうどいい！", "歯ごたえあり！", "初見殺し！", "罠がエグい！", "絶妙な難易度！", "リトライ必須！",
    "笑った！", "泣いた..", "びっくり！", "焦った！", "ドキドキした！", "スッキリ！", "悔しい！", "癒された！", "熱中した！", "感動した！",
    "クオリティ高い！", "作り込みがすごい！", "発想に脱帽！", "センスある！", "プロの犯行！", "芸術的！", "素晴らしい！", "良作！", "名作！", "傑作！",
    "ギミックが面白い！", "ワープが楽しい！", "コンベア難しい！", "ジャンプがシビア！", "スイッチの使い方が上手い！", "謎解きが深い！", "アスレチック最高！", "ルートが綺麗！", "隠しルート見つけた！", "構成が上手い！",
    "ネコかわいい！", "にゃーん！", "お魚ゲット！", "ネコチャン！", "癒やしネコ！", "しゃがみネコ可愛い！", "ネコまっしぐら！", "にゃんこ！", "ネコの動きが良い！", "ネコ好きにはたまらない！",
    "クリアできた！", "惜しい！", "あと少し！", "ギブアップ..", "ついにクリア！", "なんとかクリア！", "余裕でクリア！", "奇跡のクリア！", "クリアタイム更新！", "何度も死んだ..",
    "時間泥棒！", "何回もやっちゃう！", "気づいたらこんな時間！", "徹夜でやった！", "100回は死んだ！", "一発クリア！", "ノーミスクリア！", "TAしたくなる！", "友達におすすめしたい！", "家族で遊んだ！",
    "デザインが好き！", "色が綺麗！", "BGMが良い！", "効果音が気持ちいい！", "雰囲気が最高！", "景色が良い！", "かわいい世界観！", "ドット絵っぽい！", "ピコピコ音が良い！", "レトロ感ある！",
    "勉強になる！", "参考にします！", "自分も作りたい！", "新作待ってます！", "続編希望！", "アップデート期待！", "応援してます！", "ありがとう！", "おつかれさま！", "GG！(Good Game)"
];

function initComments() {
    const select = document.getElementById('comment-select');
    if (!select) return;
    select.innerHTML = ''; // HTMLの中身を空にする
    PRESET_COMMENTS.forEach(text => {
        const opt = document.createElement('option');
        opt.value = text;
        opt.innerText = text;
        select.appendChild(opt);
    });
}
initComments(); // スクリプト読み込み時に100種を追加

// --- アカウント・UI制御 ---
function togglePass(inputId) { const el = document.getElementById(inputId); el.type = el.type === "password" ? "text" : "password"; }
function login() { const id = document.getElementById('login-id').value, pass = document.getElementById('login-pass').value; if (!id || !pass) return showCustomDialog('alert', "入力してください"); database.ref('users/' + id).once('value', snapshot => { if (snapshot.exists() && snapshot.val().password === pass) { currentUser = id; document.getElementById('player-name-display').innerText = currentUser; if (audioCtx.state === 'suspended') audioCtx.resume(); toggleBGM(true); showScreen('home-screen'); } else showCustomDialog('alert', "IDかパスワードが違います"); }); }
function register() { let accCount = parseInt(localStorage.getItem('accountCreateCount') || '0'); if (accCount >= 5) return showCustomDialog('alert', "上限に達しました"); const id = document.getElementById('reg-id').value, pass = document.getElementById('reg-pass').value; if (!id || !pass) return showCustomDialog('alert', "入力してください"); if (pass.length < 6) return showCustomDialog('alert', "6文字以上必要です"); database.ref('users/' + id).once('value', snapshot => { if (snapshot.exists()) return showCustomDialog('alert', "その名前は使われています"); database.ref('users/' + id).set({ password: pass, friends: [] }).then(() => { localStorage.setItem('accountCreateCount', (accCount + 1).toString()); currentUser = id; document.getElementById('player-name-display').innerText = currentUser; if (audioCtx.state === 'suspended') audioCtx.resume(); toggleBGM(true); showScreen('home-screen'); }); }); }
async function deleteAccount() { if (await showCustomDialog('confirm', "本当に削除しますか？")) { database.ref('users/' + currentUser).remove().then(() => { let accCount = parseInt(localStorage.getItem('accountCreateCount') || '0'); if (accCount > 0) localStorage.setItem('accountCreateCount', (accCount - 1).toString()); currentUser = null; toggleBGM(false); showScreen('login-screen'); }); } }
async function sendFriendRequest() { const targetId = await showCustomDialog('prompt', "アカウント名"); if (!targetId || targetId === currentUser) return; database.ref('users/' + targetId).once('value', snapshot => { if (snapshot.exists()) { database.ref(`users/${targetId}/friendRequests/${currentUser}`).set(true); showCustomDialog('alert', "送信しました！"); } else showCustomDialog('alert', "見つかりませんでした"); }); }
function acceptRequest(fromId) { database.ref(`users/${currentUser}/friends/${fromId}`).set(true); database.ref(`users/${fromId}/friends/${currentUser}`).set(true); database.ref(`users/${currentUser}/friendRequests/${fromId}`).remove(); }
function rejectRequest(fromId) { database.ref(`users/${currentUser}/friendRequests/${fromId}`).remove(); }
async function removeFriend(friendId) { if (await showCustomDialog('confirm', "削除しますか？")) { database.ref(`users/${currentUser}/friends/${friendId}`).remove(); database.ref(`users/${friendId}/friends/${currentUser}`).remove(); } }
function showFriendsScreen() { showScreen('friends-screen'); const reqC = document.getElementById('friend-requests-container'), frC = document.getElementById('friends-list-container'); database.ref(`users/${currentUser}/friendRequests`).on('value', snap => { reqC.innerHTML = ''; if (!snap.exists()) return reqC.innerHTML = '<p>なし</p>'; snap.forEach(child => { const div = document.createElement('div'); div.innerHTML = `<span>👤 ${child.key}</span> <div><button onclick="acceptRequest('${child.key}')">承認</button><button onclick="rejectRequest('${child.key}')" style="background:#d9534f;">拒否</button></div>`; reqC.appendChild(div); }); }); database.ref(`users/${currentUser}/friends`).on('value', snap => { frC.innerHTML = ''; if (!snap.exists()) return frC.innerHTML = '<p>フレンドがいません</p>'; snap.forEach(child => { const div = document.createElement('div'); div.innerHTML = `<button onclick="showCourseList('friend', null, '${child.key}')">👤 ${child.key} のコース</button><button onclick="removeFriend('${child.key}')" style="background:#d9534f;">削除</button>`; frC.appendChild(div); }); }); }

function showScreen(screenId) { document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden')); document.getElementById(screenId).classList.remove('hidden'); document.getElementById('canvas-container').style.display = (screenId === 'editor-screen' || screenId === 'game-screen') ? 'block' : 'none'; currentMode = screenId.replace('-screen', ''); }
function goBackFromList() { showScreen(backScreenFromList); }
function showCourseList(type, sortOrder, friendId = null) { showScreen('course-list-screen'); viewingCourseType = type; backScreenFromList = (type === 'friend') ? 'friends-screen' : 'play-select-screen'; const c = document.getElementById('course-list-container'), t = document.getElementById('course-list-title'), s = document.getElementById('course-search'); c.innerHTML = '読込中...'; s.style.display = type === 'world' ? 'block' : 'none'; s.value = ''; const render = (courses) => { currentLoadedCourses = courses.map((co, i) => ({ ...co, originalIndex: i })); filterCourses(); }; if (type === 'world') { t.innerText = sortOrder === 'popular' ? "世界のコース(人気順)" : "世界のコース(新着順)"; database.ref('worldCourses').once('value', snap => { let cs = []; snap.forEach(ch => { cs.push({ key: ch.key, ...ch.val() }); }); if (sortOrder === 'popular') cs.sort((a, b) => (b.likes || 0) - (a.likes || 0)); else cs.reverse(); render(cs); }); } else if (type === 'my') { t.innerText = "自分のコース"; render(myCourses); } else if (type === 'friend') { t.innerText = `${friendId} のコース`; database.ref('worldCourses').orderByChild('author').equalTo(friendId).once('value', snap => { let cs = []; snap.forEach(ch => { cs.push({ key: ch.key, ...ch.val() }); }); cs.reverse(); render(cs); }); } }
function filterCourses() { const q = document.getElementById('course-search').value.toLowerCase(); const c = document.getElementById('course-list-container'); c.innerHTML = ''; const f = currentLoadedCourses.filter(co => (co.name && co.name.toLowerCase().includes(q)) || (co.author && co.author.toLowerCase().includes(q))); if (f.length === 0) return c.innerHTML = '<p>見つかりません</p>'; f.forEach((co) => { const b = document.createElement('button'); b.innerText = `[${co.gameMode||'3D'}] ${co.name} (❤️${co.likes || 0}) / 作者: ${co.author || '自分'}`; b.onclick = () => { viewingCourseIndex = co.originalIndex; showCourseDetail(co); }; c.appendChild(b); }); }
function showCourseDetail(course) { viewingCourseKey = course.key || null; viewingCourseData = course.data; gameCourseMode = course.gameMode || '3D'; document.getElementById('detail-title').innerText = course.name; document.getElementById('detail-author').innerText = course.author || "自分"; document.getElementById('detail-mode').innerText = gameCourseMode; document.getElementById('detail-likes').innerText = course.likes || 0; document.getElementById('detail-plays').innerText = course.plays || 0; document.getElementById('detail-clear-rate').innerText = course.plays > 0 ? Math.floor(((course.clears||0)/course.plays)*100) : 0; const l = document.getElementById('like-btn'); l.innerText = "❤️ いいね！"; l.disabled = false; if (viewingCourseKey) { database.ref(`worldCourses/${viewingCourseKey}/likedUsers/${currentUser}`).once('value', s => { if (s.exists()) l.innerText = "💔 いいね解除"; }); } else l.style.display = 'none'; document.getElementById('delete-course-btn').style.display = (viewingCourseType === 'my' || (viewingCourseType === 'world' && course.author === currentUser)) ? 'inline-block' : 'none'; const cS = document.getElementById('comment-section'); cS.innerHTML = ''; if (course.comments) Object.values(course.comments).forEach(c => cS.innerHTML += `<div class="comment"><b>${c.user}</b>: ${c.text}</div>`); showScreen('course-detail-screen'); }
async function deleteCourse() { if (await showCustomDialog('confirm', "本当に削除しますか？")) { if (viewingCourseType === 'world') { database.ref(`worldCourses/${viewingCourseKey}`).remove().then(() => showCourseList('world', 'new')); } else { myCourses.splice(viewingCourseIndex, 1); localStorage.setItem('myCourses', JSON.stringify(myCourses)); showCourseList('my', 'new'); } } }
function likeCourse() { if (!viewingCourseKey) return; const r = database.ref(`worldCourses/${viewingCourseKey}`); const l = document.getElementById('like-btn'); l.disabled = true; r.child(`likedUsers/${currentUser}`).once('value', snap => { if (!snap.exists()) { r.child(`likedUsers/${currentUser}`).set(true); r.child('likes').transaction(likes => (likes || 0) + 1); l.innerText = "💔 いいね解除"; document.getElementById('detail-likes').innerText = (parseInt(document.getElementById('detail-likes').innerText) || 0) + 1; } else { r.child(`likedUsers/${currentUser}`).remove(); r.child('likes').transaction(likes => Math.max((likes || 0) - 1, 0)); l.innerText = "❤️ いいね！"; document.getElementById('detail-likes').innerText = Math.max((parseInt(document.getElementById('detail-likes').innerText) || 0) - 1, 0); } l.disabled = false; }); }
function postComment() { if (!viewingCourseKey) return; const t = document.getElementById('comment-select').value; database.ref(`worldCourses/${viewingCourseKey}/comments`).push({ user: currentUser, text: t }); document.getElementById('comment-section').innerHTML += `<div class="comment"><b>${currentUser}</b>: ${t}</div>`; document.getElementById('post-comment-btn').innerText = "送信完了！"; setTimeout(() => { document.getElementById('post-comment-btn').innerText = "コメント送信"; }, 1500); }

// --- ゲーム開始・エディタ開始 ---
function startPlayFromDetail() { 
    if (viewingCourseKey) database.ref(`worldCourses/${viewingCourseKey}/plays`).transaction(p => (p || 0) + 1); 
    activeCheckpoint = null; current2DAxis = 'X'; plane2DX = 0; plane2DZ = 0;
    loadAndPlayCourse(viewingCourseData, false); 
}
function editCourseFromDetail() { 
    showScreen('editor-screen'); floor.visible = true; clearScene(); currentCourseData = []; document.getElementById('editor-mode-display').innerText = `モード: エディタ (${gameCourseMode})`; initSidebar(); 
    viewingCourseData.forEach(b => { placeBlock(b.type, new THREE.Vector3(b.x, b.y, b.z), true, false, b.uuid, b.warpTargetId, b.lockId, b.dir, b.axis2D, b.planeX, b.planeZ); }); 
    current2DAxis = 'X'; plane2DX = 0; plane2DZ = 0; resetPlayerPosition(); drawLinkLines(); updateEditorPlane(); 
}
function startEditor(mode) { 
    gameCourseMode = mode; showScreen('editor-screen'); floor.visible = true; clearScene(); currentCourseData = []; document.getElementById('editor-mode-display').innerText = `モード: エディタ (${gameCourseMode})`;
    camPanX = 0; camPanZ = 0; camPanY = 0; camTheta = 0; camPhi = gameCourseMode === '2D' ? Math.PI/2 : 1.0; camRadius = 15;
    current2DAxis = 'X'; plane2DX = 0; plane2DZ = 0;
    initSidebar(); selectBlock('normal'); placeBlock('start', new THREE.Vector3(0, 0.5, 0), true, false); resetPlayerPosition(); updateEditorPlane();
}
function testPlay() { 
    showScreen('game-screen'); currentMode = 'test'; floor.visible = false; gridHelper2D.visible = false; plane2D.visible = false; 
    activeCheckpoint = null; current2DAxis = 'X'; plane2DX = 0; plane2DZ = 0;
    resetPlayerPosition(); 
}
function loadAndPlayCourse(courseData, isTest = false) { 
    showScreen('game-screen'); floor.visible = false; gridHelper2D.visible = false; plane2D.visible = false; clearScene(); 
    courseData.forEach(b => placeBlock(b.type, new THREE.Vector3(b.x, b.y, b.z), false, false, b.uuid, b.warpTargetId, b.lockId, b.dir, b.axis2D, b.planeX, b.planeZ)); 
    resetPlayerPosition(); 
}
function quitPlay() { 
    isFirstPerson = false; document.getElementById('gameover-message').classList.add('hidden');
    if (currentMode === 'test') { showScreen('editor-screen'); floor.visible = true; resetPlayerPosition(); drawLinkLines(); updateEditorPlane(); } 
    else { showScreen('home-screen'); } 
}
function retryPlay() { document.getElementById('gameover-message').classList.add('hidden'); resetPlayerPosition(); }

async function saveLocalCourse() { const name = await showCustomDialog('prompt', "コース名を入力", "マイコース"); if (name) { myCourses.push({ name: name, gameMode: gameCourseMode, data: JSON.parse(JSON.stringify(currentCourseData)) }); localStorage.setItem('myCourses', JSON.stringify(myCourses)); showCustomDialog('alert', "保存しました！"); quitPlay(); } }
async function publishCourse() { if (!currentUser) return showCustomDialog('alert', "ログインが必要です"); const name = await showCustomDialog('prompt', "公開するコース名", "マイコース"); if (name) { const d = JSON.parse(JSON.stringify(currentCourseData)); myCourses.push({ name: name, gameMode: gameCourseMode, data: d }); localStorage.setItem('myCourses', JSON.stringify(myCourses)); database.ref('worldCourses').push({ name: name, author: currentUser, gameMode: gameCourseMode, data: d, likes: 0, plays: 0, clears: 0 }).then(() => { showCustomDialog('alert', "世界に公開しました！"); quitPlay(); }).catch(err => { showCustomDialog('alert', "エラー: " + err.message); quitPlay(); }); } }

// --- Three.js 初期化 ---
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffebcd);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); document.getElementById('canvas-container').appendChild(renderer.domElement);
const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(10, 20, 10); scene.add(light); scene.add(new THREE.AmbientLight(0x808080));

window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); });

const player = new THREE.Group();
const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffa500 });
const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), bodyMat); player.add(head);
const earGeo = new THREE.ConeGeometry(0.15, 0.3, 16);
const earL = new THREE.Mesh(earGeo, bodyMat); earL.position.set(-0.2, 0.3, 0); earL.rotation.z = Math.PI/8; player.add(earL);
const earR = new THREE.Mesh(earGeo, bodyMat); earR.position.set(0.2, 0.3, 0); earR.rotation.z = -Math.PI/8; player.add(earR);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), eyeMat); eyeL.position.set(-0.15, 0.1, 0.35); player.add(eyeL);
const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), eyeMat); eyeR.position.set(0.15, 0.1, 0.35); player.add(eyeR);
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff6666 })); nose.position.set(0, 0, 0.38); player.add(nose);
scene.add(player);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshLambertMaterial({ color: 0x7cfc00 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);

const plane2D = new THREE.Mesh(new THREE.PlaneGeometry(200, 100), new THREE.MeshBasicMaterial({ visible: false })); scene.add(plane2D);
const gridHelper2D = new THREE.GridHelper(100, 100, 0xffaa44, 0xffcc88); scene.add(gridHelper2D);

const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let linkLinesGroup = new THREE.Group(); scene.add(linkLinesGroup); 
let camTheta = 0, camPhi = 1.0, camRadius = 12, camPanX = 0, camPanZ = 0, camPanY = 0;

function updateEditorPlane() {
    if (gameCourseMode === '2D' && currentMode === 'editor') {
        gridHelper2D.visible = true; plane2D.visible = true;
        if (current2DAxis === 'X') {
            plane2D.rotation.set(0, 0, 0); plane2D.position.set(0, 0, plane2DZ);
            gridHelper2D.rotation.set(Math.PI/2, 0, 0); gridHelper2D.position.set(0.5, 0, plane2DZ - 0.51);
        } else {
            plane2D.rotation.set(0, Math.PI/2, 0); plane2D.position.set(plane2DX, 0, 0);
            gridHelper2D.rotation.set(Math.PI/2, 0, Math.PI/2); gridHelper2D.position.set(plane2DX - 0.51, 0, 0.5);
        }
    } else {
        gridHelper2D.visible = false; plane2D.visible = false;
    }
}

function updateCam() {
    let targetX = player.position.x; let targetY = player.position.y; let targetZ = player.position.z;
    if (currentMode === 'editor') { targetX += camPanX; targetY += camPanY; targetZ += camPanZ; }
    
    if (gameCourseMode === '2D') {
        player.visible = true; 
        if (current2DAxis === 'X') {
            camera.position.set(targetX, targetY + 2, plane2DZ + 15); camera.lookAt(targetX, targetY + 2, plane2DZ);
        } else {
            camera.position.set(plane2DX + 15, targetY + 2, targetZ); camera.lookAt(plane2DX, targetY + 2, targetZ);
        }
    } else {
        if (isFirstPerson && (currentMode === 'game' || currentMode === 'test')) {
            player.visible = false; camera.position.set(player.position.x, player.position.y + (player.scale.y===0.5 ? -0.1 : 0.4), player.position.z);
            camera.lookAt(player.position.x - Math.sin(camPhi) * Math.sin(camTheta), player.position.y + (player.scale.y===0.5 ? -0.1 : 0.4) - Math.cos(camPhi), player.position.z - Math.sin(camPhi) * Math.cos(camTheta));
        } else {
            player.visible = true; camera.position.set(targetX + camRadius * Math.sin(camPhi) * Math.sin(camTheta), targetY + camRadius * Math.cos(camPhi), targetZ + camRadius * Math.sin(camPhi) * Math.cos(camTheta));
            if (!isNaN(targetX)) camera.lookAt(targetX, targetY, targetZ); else resetPlayerPosition(); 
        }
    }
}

// --- ブロック定義 ---
const textureCache = {};
function getCanvasTexture(type) {
    if (textureCache[type]) return textureCache[type];
    let c = document.createElement('canvas'); c.width = 64; c.height = 64; let ctx = c.getContext('2d');
    if (type === 'fake') { ctx.fillStyle='#333'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#ff66b2'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(10,10); ctx.lineTo(54,54); ctx.moveTo(54,10); ctx.lineTo(10,54); ctx.stroke(); } 
    else if (type === 'door') { ctx.fillStyle='#d2b48c'; ctx.fillRect(0,0,64,64); ctx.fillStyle='#553311'; ctx.beginPath(); ctx.arc(32, 24, 8, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(26,44); ctx.lineTo(38,44); ctx.lineTo(34,24); ctx.lineTo(30,24); ctx.fill(); } 
    else if (type === 'warp' || type === 'locked_warp') { ctx.fillStyle = type==='warp' ? '#ffb6c1' : '#ff4500'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.beginPath(); for(let i=1;i<20;i++){ ctx.arc(32,32, i*1.5, 0, Math.PI*2); } ctx.stroke(); } 
    else if (type === 'ice') { ctx.fillStyle='#e0ffff'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(32,10); ctx.lineTo(32,54); ctx.moveTo(10,32); ctx.lineTo(54,32); ctx.moveTo(16,16); ctx.lineTo(48,48); ctx.moveTo(48,16); ctx.lineTo(16,48); ctx.stroke(); } 
    else if (type === 'conveyor') { ctx.fillStyle='#ffb347'; ctx.fillRect(0,0,64,64); ctx.fillStyle='#fff'; ctx.font="40px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText('↑', 32, 36); } 
    else if (type === 'sand') { ctx.fillStyle='#f5deb3'; ctx.fillRect(0,0,64,64); ctx.fillStyle='#cd853f'; for(let i=0;i<50;i++){ ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2); } } 
    else if (type === 'metal') { ctx.fillStyle='#dcdcdc'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.strokeRect(4,4,56,56); ctx.fillStyle='#a9a9a9'; ctx.beginPath(); ctx.arc(8,8,3,0,7); ctx.arc(56,8,3,0,7); ctx.arc(8,56,3,0,7); ctx.arc(56,56,3,0,7); ctx.fill(); } 
    else if (type === 'axis_switch') { ctx.fillStyle='#ff1493'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#fff'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(32, 32, 16, 0, Math.PI*1.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(32, 6); ctx.lineTo(44, 16); ctx.lineTo(20, 16); ctx.fill(); }
    else { ctx.fillStyle='#ffcc99'; ctx.fillRect(0,0,64,64); }
    textureCache[type] = new THREE.CanvasTexture(c); return textureCache[type];
}

const baseBlocks = [
    {id:'normal', n:'通常ブロック', c:0xffcc99}, {id:'fake', n:'すり抜け罠', tx:'fake', pass:true},
    {id:'start', n:'スタート', type:'start'}, {id:'goal', n:'ゴール', type:'goal'},
    {id:'checkpoint', n:'中間地点(旗)', type:'checkpoint'}, {id:'axis_switch', n:'縦横切替(2D用)', type:'axis_switch', tx:'axis_switch'},
    {id:'key', n:'お魚(カギ)', type:'key', pass:true}, {id:'door', n:'ドア', tx:'door'},
    {id:'warp', n:'ワープ', tx:'warp'}, {id:'locked_warp', n:'カギ付ワープ', tx:'locked_warp'},
    {id:'conveyor', n:'コンベア(回転)', tx:'conveyor'},
    {id:'jump_s', n:'小ジャンプ', c:0x98fb98}, {id:'jump_m', n:'中ジャンプ', c:0x32cd32}, {id:'jump_l', n:'大ジャンプ', c:0x00ff00},
    {id:'speed_1', n:'ダッシュ', c:0x87cefa}, {id:'speed_2', n:'超ダッシュ', c:0x00bfff}, {id:'slow', n:'泥', c:0x8b4513},
    {id:'ice', n:'氷', tx:'ice'}, {id:'sand', n:'砂', tx:'sand'},
    {id:'death', n:'即死(マグマ)', c:0xff4500}, {id:'death_w', n:'即死(毒沼)', c:0x8a2be2},
    {id:'wood', n:'木材', c:0xdeb887}, {id:'brick', n:'レンガ', c:0xcd5c5c}, {id:'metal', n:'鉄', tx:'metal'}, {id:'glass', n:'ガラス', c:0xe0ffff, op:0.6},
    {id:'c_red', n:'赤色', c:0xff6b6b}, {id:'c_blue', n:'青色', c:0x6495ed}, {id:'c_green', n:'緑色', c:0x98fb98}, {id:'c_yellow', n:'黄色', c:0xffe4b5},
    {id:'c_purple', n:'紫色', c:0xdda0dd}, {id:'c_pink', n:'桃色', c:0xffb6c1}, {id:'c_orange', n:'橙色', c:0xffa07a}, {id:'c_cyan', n:'水色', c:0xafeeee},
    {id:'c_white', n:'白色', c:0xfffaf0}, {id:'c_black', n:'黒色', c:0x696969}
];
let BLOCKS = [...baseBlocks];
const extraColors = [{id:'l_red', c:0xffb6c1}, {id:'l_blue', c:0xb0e0e6}, {id:'l_green', c:0x98fb98}, {id:'l_yellow', c:0xfffacd},{id:'d_red', c:0xcd5c5c}, {id:'d_blue', c:0x4169e1}, {id:'d_green', c:0x2e8b57}, {id:'d_yellow', c:0xdaa520},{id:'p_wood', c:0xf5deb3}, {id:'p_stone', c:0x778899}, {id:'p_gold', c:0xffd700}, {id:'p_dirt', c:0xd2b48c},{id:'p_leaf', c:0x3cb371}, {id:'p_cloud', c:0xf8f8ff}, {id:'p_neon', c:0x39ff14}, {id:'p_choco', c:0xd2691e}, {id:'p_mint', c:0xf5fffa}, {id:'p_cherry', c:0xff1493}, {id:'p_plum', c:0xdda0dd}, {id:'p_navy', c:0x000080}, {id:'p_olive', c:0x6b8e23}, {id:'p_teal', c:0x008080}, {id:'p_silver', c:0xc0c0c0}, {id:'p_bronze', c:0xcd7f32}];
extraColors.forEach(e => BLOCKS.push({id: e.id, n: '装飾 '+e.id, c: e.c}));

let solidBlocks=[], customDeathBlocks=[], customWarps=[], customCheckpoints=[], customSwitches=[], customGoal=null, customStart=null;
let placed=new Set(), meshList=[], customKeys=[], customDoors=[], hasKeys=[]; 

function clearScene() { meshList.forEach(m => scene.remove(m)); solidBlocks=[]; customDeathBlocks=[]; customWarps=[]; customCheckpoints=[]; customSwitches=[]; customGoal=null; customStart=null; customKeys=[]; customDoors=[]; placed.clear(); meshList=[]; hasKeys=[]; linkLinesGroup.clear();}

function initSidebar() {
    const c = document.getElementById('block-list-container'); if(!c) return; c.innerHTML = '';
    let activeBlocks = [...BLOCKS];
    if (gameCourseMode === '2D') { BLOCKS.forEach(base => { if (!base.pass && !['start','goal','key','door','checkpoint','axis_switch'].includes(base.id) && !base.id.includes('warp')) { activeBlocks.push({...base, id: base.id + '_half', n: base.n + '(ハーフ)', half: true}); } }); }
    activeBlocks.forEach(b => {
        if (b.id === 'axis_switch' && gameCourseMode !== '2D') return; 
        const btn = document.createElement('button'); btn.id = "btn-" + b.id; btn.className = "block-btn"; btn.onclick = () => selectBlock(b.id); btn.innerHTML = `<span class="block-title">${b.n}</span>`; c.appendChild(btn);
    });
}
function selectBlock(type) { currentBlockType = type; document.querySelectorAll('[id^="btn-"]').forEach(b => b.style.borderColor = 'transparent'); const btn = document.getElementById('btn-' + type); if(btn) btn.style.borderColor = '#4CAF50'; }
function getBlockMaterial(b) { if (b.tx) return new THREE.MeshLambertMaterial({ map: getCanvasTexture(b.tx), transparent: !!b.op, opacity: b.op||1 }); return new THREE.MeshLambertMaterial({ color: b.c||0x888888, transparent: !!b.op, opacity: b.op||1 }); }

function createMesh(bDef) {
    if (bDef.type === 'goal') { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2), new THREE.MeshLambertMaterial({color:0xffaa44})); p.position.y=1; g.add(p); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.6), new THREE.MeshLambertMaterial({color:0xff66b2, side:THREE.DoubleSide})); f.position.set(0.4, 1.7, 0); g.add(f); return g; }
    if (bDef.type === 'start') { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.2), new THREE.MeshLambertMaterial({color:0xffaa44})); p.position.y=0.1; g.add(p); return g; }
    if (bDef.type === 'checkpoint') { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.5), new THREE.MeshLambertMaterial({color:0xcccccc})); p.position.y=0.75; g.add(p); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.4), new THREE.MeshLambertMaterial({color:0x0000ff, side:THREE.DoubleSide})); f.position.set(0.3, 1.3, 0); g.add(f); return g; }
    if (bDef.type === 'key') { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.ConeGeometry(0.15,0.4,16), new THREE.MeshLambertMaterial({color:0x87cefa})); b.rotation.z = -Math.PI/2; g.add(b); const t = new THREE.Mesh(new THREE.ConeGeometry(0.1,0.2,16), new THREE.MeshLambertMaterial({color:0x87cefa})); t.rotation.z = Math.PI/2; t.position.x = -0.25; g.add(t); g.position.y = 0.5; return g; }
    if (bDef.half) { const m = new THREE.Mesh(new THREE.BoxGeometry(1,0.5,1), getBlockMaterial(bDef)); m.position.y -= 0.25; return m; }
    return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), getBlockMaterial(bDef));
}

function removeBlockMesh(m) {
    scene.remove(m); meshList = meshList.filter(b => b !== m); solidBlocks = solidBlocks.filter(b => b !== m); customDeathBlocks = customDeathBlocks.filter(b => b !== m);
    customWarps = customWarps.filter(b => b !== m); customKeys = customKeys.filter(b => b !== m); customDoors = customDoors.filter(b => b !== m);
    customCheckpoints = customCheckpoints.filter(b => b !== m); customSwitches = customSwitches.filter(b => b !== m);
    if (customGoal === m) customGoal = null; if (customStart === m) customStart = null;
    placed.delete(`${m.position.x},${m.position.y},${m.position.z}`);
    currentCourseData = currentCourseData.filter(d => d.uuid !== m.userData.uuid);
    drawLinkLines();
}

function placeBlock(type, pos, save=true, playSound=true, loadUuid=null, loadWarp=null, loadLock=null, loadDir=0, loadAxis=null, loadPx=null, loadPz=null) {
    const posKey = `${pos.x},${pos.y},${pos.z}`;
    if (type === 'eraser') { if (placed.has(posKey)) { const m = meshList.find(b => b.position.x === pos.x && b.position.y === pos.y && b.position.z === pos.z); if (m) { removeBlockMesh(m); playSE('place'); } } return; }
    if (placed.has(posKey)) return;
    if (['goal','start'].includes(type)) { let ex = type==='goal'?customGoal:customStart; if(ex) removeBlockMesh(ex); }

    let baseId = type.replace('_half','');
    const bDef = BLOCKS.find(b => b.id === baseId) || BLOCKS[0];
    const isHalf = type.includes('_half');
    const fullDef = {...bDef, half: isHalf};
    const mesh = createMesh(fullDef); mesh.position.copy(pos); 
    
    if (baseId === 'conveyor') { mesh.rotation.y = -loadDir * Math.PI/2; }
    
    let ax = loadAxis || current2DAxis;
    let px = loadPx !== null ? loadPx : plane2DX;
    let pz = loadPz !== null ? loadPz : plane2DZ;

    const uuid = loadUuid || Math.random().toString(36).substring(2);
    mesh.userData = { 
        type: type, uuid: uuid, warpTargetId: loadWarp, lockId: loadLock, 
        opened: false, collected: false, bDef: fullDef, dir: loadDir,
        axis2D: ax, planeX: px, planeZ: pz
    };
    scene.add(mesh); meshList.push(mesh); placed.add(posKey);
    
    if (playSound) playSE('place');
    if (!fullDef.pass && !['goal','key','checkpoint'].includes(fullDef.type)) solidBlocks.push(mesh);
    if (baseId.startsWith('death')) customDeathBlocks.push(mesh);
    if (baseId==='goal') customGoal=mesh; else if (baseId==='start') customStart=mesh;
    else if (baseId==='key') customKeys.push(mesh); else if (baseId==='door') customDoors.push(mesh);
    else if (baseId.includes('warp')) customWarps.push(mesh);
    else if (baseId==='checkpoint') customCheckpoints.push(mesh);
    else if (baseId==='axis_switch') customSwitches.push(mesh);
    
    if(save) {
        currentCourseData.push({
            type:type, x:pos.x, y:pos.y, z:pos.z, 
            uuid:uuid, warpTargetId:loadWarp, lockId:loadLock, dir:loadDir,
            axis2D: ax, planeX: px, planeZ: pz
        });
    }
}

// リンク（ペア）＆右クリック動作
let linkSourceMesh = null;
async function handleRightClickLink(cx, cy) {
    mouse.set((cx/window.innerWidth)*2-1, -(cy/window.innerHeight)*2+1); raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meshList, true);
    if (intersects.length > 0) {
        let m = intersects[0].object; while(m.parent && m.parent.type==='Group') m=m.parent;
        const t = m.userData.type.replace('_half','');
        
        if (t === 'conveyor') {
            m.userData.dir = ((m.userData.dir || 0) + 1) % 4; m.rotation.y = -m.userData.dir * Math.PI/2;
            let d = currentCourseData.find(cd => cd.uuid === m.userData.uuid); if(d) d.dir = m.userData.dir;
            playSE('place'); return;
        }

        if (t === 'axis_switch' && gameCourseMode === '2D') {
            current2DAxis = current2DAxis === 'X' ? 'Z' : 'X';
            plane2DX = Math.round(m.position.x); plane2DZ = Math.round(m.position.z);
            updateEditorPlane(); playSE('key'); return;
        }

        if (['key','door','warp','locked_warp'].includes(t)) {
            if (!linkSourceMesh) {
                if (m.userData.warpTargetId || m.userData.lockId) {
                    if (await showCustomDialog('confirm', "🔗 ペアを解除しますか？")) {
                        if (m.userData.warpTargetId) { let tgt = meshList.find(b => b.userData.uuid === m.userData.warpTargetId); if (tgt) tgt.userData.warpTargetId = null; m.userData.warpTargetId = null; }
                        if (m.userData.lockId) { let tgt = meshList.find(b => b.userData.uuid === m.userData.lockId); if (tgt) tgt.userData.lockId = null; m.userData.lockId = null; }
                        updateCourseDataLinks(); drawLinkLines(); return showCustomDialog('alert', "💔 ペアを解除しました！");
                    }
                }
                linkSourceMesh = m; showCustomDialog('alert', "【ペア元を選択しました】\n対応させたいブロックを右クリックしてください。");
            } else {
                if (linkSourceMesh === m) { linkSourceMesh=null; return showCustomDialog('alert', "キャンセルしました"); }
                const t1 = linkSourceMesh.userData.type.replace('_half',''); const t2 = m.userData.type.replace('_half',''); let success = false;
                if (['warp', 'locked_warp'].includes(t1) && ['warp', 'locked_warp'].includes(t2)) { linkSourceMesh.userData.warpTargetId = m.userData.uuid; m.userData.warpTargetId = linkSourceMesh.userData.uuid; success = true; }
                else if ((t1 === 'key' && ['door', 'locked_warp'].includes(t2)) || (t2 === 'key' && ['door', 'locked_warp'].includes(t1))) { linkSourceMesh.userData.lockId = m.userData.uuid; m.userData.lockId = linkSourceMesh.userData.uuid; success = true; }
                if (success) { updateCourseDataLinks(); showCustomDialog('alert', "🔗 ペアを構築しました！"); linkSourceMesh = null; drawLinkLines(); } 
                else { showCustomDialog('alert', "⚠️ その組み合わせではペアを組めません"); linkSourceMesh = null; }
            }
        }
    } else { linkSourceMesh = null; }
}

function updateCourseDataLinks() { meshList.forEach(m => { let d = currentCourseData.find(cd => cd.uuid === m.userData.uuid); if (d) { d.warpTargetId = m.userData.warpTargetId; d.lockId = m.userData.lockId; } }); }

function drawLinkLines() {
    linkLinesGroup.clear(); if (currentMode !== 'editor') return;
    const dW = new Set(), dL = new Set();
    meshList.forEach(m1 => {
        if (m1.userData.warpTargetId && !dW.has(m1.userData.uuid)) {
            const m2 = meshList.find(b => b.userData.uuid === m1.userData.warpTargetId);
            if (m2) { linkLinesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([m1.position, m2.position]), new THREE.LineBasicMaterial({color: 0xff0000, linewidth: 3}))); dW.add(m1.userData.uuid); dW.add(m2.userData.uuid); }
        }
        if (m1.userData.lockId && !dL.has(m1.userData.uuid)) {
            const m2 = meshList.find(b => b.userData.uuid === m1.userData.lockId);
            if (m2) { linkLinesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([m1.position, m2.position]), new THREE.LineBasicMaterial({color: 0xffaa00, linewidth: 3}))); dL.add(m1.userData.uuid); dL.add(m2.userData.uuid); }
        }
    });
}

let isDragging = false, prevX = 0, prevY = 0, rightClickStart = 0, rightClickPos = {x:0, y:0};
window.addEventListener('mousedown', e => { 
    if (e.target.tagName !== 'CANVAS') return;
    if (e.button === 2) { isDragging = true; prevX = e.clientX; prevY = e.clientY; rightClickStart = Date.now(); rightClickPos = {x: e.clientX, y: e.clientY}; return; }
    if (e.button === 0 && currentMode === 'editor') {
        mouse.set((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1); raycaster.setFromCamera(mouse, camera);
        const targets = gameCourseMode === '2D' ? [plane2D, floor, ...meshList] : [floor, ...meshList];
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length > 0) {
            let hit = intersects[0].object; while(hit.parent && hit.parent.type === 'Group') hit = hit.parent; 
            if (currentBlockType === 'eraser') { if (hit !== floor && hit !== plane2D) { removeBlockMesh(hit); playSE('place'); } } 
            else {
                let p;
                if (hit === floor || hit === plane2D) {
                    p = new THREE.Vector3().copy(intersects[0].point); p.x = Math.round(p.x); 
                    if (gameCourseMode === '2D') {
                        if (current2DAxis === 'X') { p.z = plane2DZ; } else { p.x = plane2DX; p.z = Math.round(p.z); }
                        const isHalf = currentBlockType.includes('_half');
                        let decimalY = p.y % 1; if(decimalY < 0) decimalY += 1;
                        if (isHalf) p.y = Math.floor(p.y) + (decimalY > 0.5 ? 0.75 : 0.25); else p.y = Math.floor(p.y) + 0.5;
                    } else { p.y = 0.5; p.z = Math.round(p.z); }
                } else {
                    let n = new THREE.Vector3(0, 1, 0);
                    if (intersects[0].face) { n.copy(intersects[0].face.normal); const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersects[0].object.matrixWorld); n.applyMatrix3(normalMatrix).normalize(); if (Math.abs(n.x) > Math.abs(n.y) && Math.abs(n.x) > Math.abs(n.z)) { n.set(Math.sign(n.x), 0, 0); } else if (Math.abs(n.y) > Math.abs(n.x) && Math.abs(n.y) > Math.abs(n.z)) { n.set(0, Math.sign(n.y), 0); } else { n.set(0, 0, Math.sign(n.z)); } }
                    if (gameCourseMode === '2D') { if (current2DAxis === 'X') n.z = 0; else n.x = 0; }
                    const isHalf = currentBlockType.includes('_half'); let py = intersects[0].point.y; let ny = n.y;
                    p = new THREE.Vector3().copy(intersects[0].point).add(n.multiplyScalar(0.1));
                    
                    if (gameCourseMode === '2D') {
                        if (current2DAxis === 'X') { p.x = Math.round(p.x); p.z = plane2DZ; } else { p.x = plane2DX; p.z = Math.round(p.z); }
                    } else { p.x = Math.round(p.x); p.z = Math.round(p.z); }
                    
                    if (isHalf) { let decimalY = py % 1; if(decimalY < 0) decimalY += 1; if (ny === 1) p.y = Math.floor(py) + 0.25; else if (ny === -1) p.y = Math.floor(py) - 0.25; else p.y = Math.floor(py) + (decimalY > 0.5 ? 0.75 : 0.25); } 
                    else { p.y = Math.floor(p.y) + 0.5; }
                }
                placeBlock(currentBlockType, p);
            }
        }
    }
});

window.addEventListener('mousemove', e => {
    if (isDragging) {
        if (gameCourseMode === '2D') { 
            if (current2DAxis === 'X') { camPanX -= (e.clientX - prevX) * 0.03; camPanY += (e.clientY - prevY) * 0.03; }
            else { camPanZ += (e.clientX - prevX) * 0.03; camPanY += (e.clientY - prevY) * 0.03; }
        } else {
            if (e.shiftKey && currentMode === 'editor') { let dx = (e.clientX - prevX) * 0.05; let dy = (e.clientY - prevY) * 0.05; camPanX -= dx * Math.cos(camTheta) + dy * Math.sin(camTheta); camPanZ -= -dx * Math.sin(camTheta) + dy * Math.cos(camTheta); } 
            else { camTheta -= (e.clientX - prevX)*0.01; camPhi -= (e.clientY - prevY)*0.01; if (camPhi < 0.1) camPhi = 0.1; if (camPhi > Math.PI/2.1) camPhi = Math.PI/2.1; }
        }
        prevX = e.clientX; prevY = e.clientY;
    }
});

window.addEventListener('mouseup', e => { isDragging = false; if (e.button === 2 && currentMode === 'editor') { let dist = Math.abs(e.clientX - rightClickPos.x) + Math.abs(e.clientY - rightClickPos.y); if (Date.now() - rightClickStart < 250 && dist < 5) handleRightClickLink(e.clientX, e.clientY); } });

// --- キー操作・ライフ・物理演算 ---
const keys = { w:false, s:false, a:false, d:false, space:false, shift:false, left:false, right:false, up:false, down:false };
window.addEventListener('keydown', e => { let k=e.key.toLowerCase(); if(k==='w'||k==='s'||k==='a'||k==='d') keys[k]=true; if(k==='arrowup') keys.up=true; if(k==='arrowdown') keys.down=true; if(k==='arrowleft') keys.left=true; if(k==='arrowright') keys.right=true; if(e.code==='Space') keys.space=true; if(e.key==='Shift') keys.shift=true; if(k==='v') isFirstPerson = !isFirstPerson; });
window.addEventListener('keyup', e => { let k=e.key.toLowerCase(); if(k==='w'||k==='s'||k==='a'||k==='d') keys[k]=false; if(k==='arrowup') keys.up=false; if(k==='arrowdown') keys.down=false; if(k==='arrowleft') keys.left=false; if(k==='arrowright') keys.right=false; if(e.code==='Space') keys.space=false; if(e.key==='Shift') keys.shift=false; });

let velocityY=0, isGrounded=false, warpCooldown=0, switchCooldown=0, isCrouching=false;

function updateLifeDisplay() {
    let html = '';
    for(let i=0; i<maxLife; i++) { if (i < life) html += '❤️'; else html += '🖤'; }
    const d = document.getElementById('life-display'); if(d) d.innerHTML = html;
}

function die() {
    playSE('death'); life--; updateLifeDisplay();
    if (life <= 0) {
        document.getElementById('gameover-message').classList.remove('hidden');
    } else {
        respawnPlayer();
    }
}

function respawnPlayer() {
    if (activeCheckpoint) {
        player.position.set(activeCheckpoint.x, activeCheckpoint.y, activeCheckpoint.z);
        if (gameCourseMode === '2D') { 
            current2DAxis = activeCheckpoint.axis; 
            plane2DX = activeCheckpoint.planeX; 
            plane2DZ = activeCheckpoint.planeZ; 
            updateEditorPlane(); 
        }
    } else {
        player.position.set(customStart?customStart.position.x:0, customStart?customStart.position.y+1.0:1.0, customStart?customStart.position.z:0);
        if (gameCourseMode === '2D') { 
            current2DAxis = customStart ? (customStart.userData.axis2D || 'X') : 'X'; 
            plane2DX = customStart ? (customStart.userData.planeX || 0) : 0; 
            plane2DZ = customStart ? (customStart.userData.planeZ || 0) : 0; 
            updateEditorPlane(); 
        }
    }
    velocityY=0; isCrouching=false; player.scale.y = 1.0; warpCooldown=0; switchCooldown=0;
}

function resetPlayerPosition() {
    life = maxLife; updateLifeDisplay(); activeCheckpoint = null; hasKeys=[]; 
    document.getElementById('clear-message').classList.add('hidden'); 
    document.getElementById('gameover-message').classList.add('hidden');
    customKeys.forEach(k => { k.visible = true; k.userData.collected = false; }); 
    customDoors.forEach(d => { d.visible = true; d.userData.opened = false; });
    customCheckpoints.forEach(cp => { cp.userData.collected = false; if(cp.children[1]) cp.children[1].material.color.setHex(0x0000ff); });
    respawnPlayer();
}

function checkWall() {
    let pRadius = isCrouching ? 0.2 : 0.4;
    let pY = player.position.y;
    for (let b of solidBlocks) {
        if (b.userData.opened) continue;
        let isHalf = b.userData.bDef && b.userData.bDef.half; 
        let bHeight = isHalf ? 0.5 : 1.0; 
        let bY = isHalf ? b.position.y + 0.25 : b.position.y;
        
        if (Math.abs(player.position.x - b.position.x)<0.8 && Math.abs(player.position.z - b.position.z)<0.8) {
            if (pY - pRadius < bY + bHeight/2 - 0.05 && pY + pRadius > bY - bHeight/2 + 0.05) {
                let t = b.userData.bDef ? b.userData.bDef.type : b.userData.type;
                if (t === 'door') { 
                    let lId = b.userData.lockId || b.userData.linkId; 
                    if (hasKeys.includes(lId) || (!lId && hasKeys.length>0)) { 
                        b.visible = false; b.userData.opened = true; playSE('place'); continue; 
                    } 
                }
                return true;
            }
        }
    } return false;
}

function updatePhysics() {
    if ((keys.s || keys.down || keys.shift) && isGrounded) { 
        if(!isCrouching){ player.scale.y = 0.5; player.position.y -= 0.2; isCrouching = true; } 
    } else { 
        if(isCrouching){ 
            player.scale.y = 1.0; player.position.y += 0.2; isCrouching = false; 
            if(checkWall()){ player.scale.y = 0.5; player.position.y -= 0.2; isCrouching = true; } 
        } 
    }

    velocityY -= 0.01; player.position.y += velocityY; isGrounded = false; let onBlock = null; 
    let pRadius = isCrouching ? 0.2 : 0.4;
    
    if (floor.visible && player.position.y <= pRadius) { player.position.y = pRadius; velocityY=0; isGrounded=true; }
    for (let b of solidBlocks) {
        if (b.userData.opened) continue;
        let isHalf = b.userData.bDef && b.userData.bDef.half; 
        let bHeight = isHalf ? 0.5 : 1.0; 
        let bY = isHalf ? b.position.y + 0.25 : b.position.y;
        
        if (Math.abs(player.position.x-b.position.x)<0.75 && Math.abs(player.position.z-b.position.z)<0.75) {
            if (player.position.y - pRadius - velocityY >= bY + bHeight/2 - 0.1 && player.position.y - pRadius <= bY + bHeight/2 + 0.2 && velocityY <= 0) {
                player.position.y = bY + bHeight/2 + pRadius; velocityY=0; isGrounded=true; onBlock = b;
            }
        }
    }
    
    let moveSpd = 0.1;
    if (onBlock) {
        let t = onBlock.userData.type.replace('_half','');
        if(t==='speed_1') moveSpd=0.2; if(t==='speed_2') moveSpd=0.35; if(t==='slow'||t==='sand') moveSpd=0.03;
        if(t==='conveyor') {
            let dir = onBlock.userData.dir || 0;
            if(dir===0) player.position.z-=0.05; if(dir===2) player.position.z+=0.05; if(dir===1) player.position.x+=0.05; if(dir===3) player.position.x-=0.05;
            if(checkWall()) { player.position.x=Math.round(player.position.x); player.position.z=Math.round(player.position.z); } 
        }
        if(t==='jump_s') { velocityY=0.25; isGrounded=false; playSE('jump'); }
        if(t==='jump_m') { velocityY=0.4; isGrounded=false; playSE('jump'); }
        if(t==='jump_l') { velocityY=0.6; isGrounded=false; playSE('jump'); }
    }
    
    if((keys.space || (gameCourseMode==='2D' && (keys.w || keys.up))) && isGrounded && !isCrouching) { velocityY=0.22; keys.space=false; keys.w=false; keys.up=false; playSE('jump'); }
    if (player.position.y < -10 || isNaN(player.position.y)) { die(); }

    if (warpCooldown > 0) warpCooldown--;
    if (warpCooldown <= 0) {
        for (let w of customWarps) {
            if (Math.abs(player.position.x-w.position.x)<0.8 && Math.abs(player.position.z-w.position.z)<0.8 && Math.abs(player.position.y-w.position.y)<1.0) {
                let t = w.userData.type.replace('_half','');
                if (t === 'locked_warp') { let lId = w.userData.lockId || w.userData.linkId; if (lId ? !hasKeys.includes(lId) : hasKeys.length===0) continue; }
                let targetId = w.userData.warpTargetId || w.userData.linkId;
                if (targetId) { 
                    let target = customWarps.find(tw => tw.userData.uuid === targetId); 
                    if (target) { 
                        player.position.set(target.position.x, target.position.y + 1, target.position.z); 
                        if (gameCourseMode === '2D') {
                            current2DAxis = target.userData.axis2D || 'X';
                            plane2DX = target.userData.planeX || 0;
                            plane2DZ = target.userData.planeZ || 0;
                            updateEditorPlane(); 
                        }
                        warpCooldown = 60; playSE('jump'); break; 
                    } 
                }
            }
        }
    }
    
    if (switchCooldown > 0) switchCooldown--;
    if (switchCooldown <= 0 && gameCourseMode === '2D') {
        for (let sw of customSwitches) {
            if (Math.abs(player.position.x-sw.position.x)<0.5 && Math.abs(player.position.z-sw.position.z)<0.5 && Math.abs(player.position.y-sw.position.y)<1.0) {
                current2DAxis = current2DAxis === 'X' ? 'Z' : 'X';
                plane2DX = Math.round(sw.position.x); plane2DZ = Math.round(sw.position.z);
                player.position.x = plane2DX; player.position.z = plane2DZ; 
                updateEditorPlane(); switchCooldown = 30; playSE('key'); break;
            }
        }
    }

    for (let cp of customCheckpoints) {
        if (!cp.userData.collected && Math.abs(player.position.x-cp.position.x)<0.8 && Math.abs(player.position.z-cp.position.z)<0.8 && Math.abs(player.position.y-cp.position.y)<1.0) {
            cp.userData.collected = true;
            activeCheckpoint = { 
                x: cp.position.x, y: cp.position.y + 1, z: cp.position.z, 
                axis: cp.userData.axis2D || 'X', 
                planeX: cp.userData.planeX || Math.round(cp.position.x), 
                planeZ: cp.userData.planeZ || Math.round(cp.position.z) 
            };
            if(cp.children[1]) cp.children[1].material.color.setHex(0x00ff00); 
            playSE('clear');
        }
    }

    return isCrouching ? moveSpd * 0.5 : moveSpd;
}

function animate() {
    requestAnimationFrame(animate);
    const isCleared = !document.getElementById('clear-message').classList.contains('hidden');
    const isGameOver = !document.getElementById('gameover-message').classList.contains('hidden');

    if ((currentMode==='game' || currentMode==='test') && !isCleared && !isGameOver) {
        let ix=0, iz=0; 
        if (gameCourseMode === '2D') { 
            if(keys.left||keys.a) ix-=1; if(keys.right||keys.d) ix+=1; 
            if (current2DAxis === 'X') player.position.z = plane2DZ; else player.position.x = plane2DX; 
        } else { 
            if(keys.up||keys.w) iz-=1; if(keys.down||keys.s) iz+=1; if(keys.left||keys.a) ix-=1; if(keys.right||keys.d) ix+=1; 
        }
        
        let speed = updatePhysics(); 
        if(ix!==0 || iz!==0) {
            let l=Math.sqrt(ix*ix+iz*iz); ix/=l; iz/=l; let dx=0, dz=0;
            if (gameCourseMode === '2D') { 
                if (current2DAxis === 'X') { dx = ix * speed; player.rotation.y = ix > 0 ? Math.PI/2 : -Math.PI/2; }
                else { dz = -ix * speed; player.rotation.y = ix > 0 ? Math.PI : 0; }
            } else { 
                dx = (ix*Math.cos(camTheta)+iz*Math.sin(camTheta))*speed; dz = (-ix*Math.sin(camTheta)+iz*Math.cos(camTheta))*speed; 
                player.rotation.y = Math.atan2(dx, dz); 
            } 
            player.position.x+=dx; if(checkWall()) player.position.x-=dx;
            player.position.z+=dz; if(checkWall()) player.position.z-=dz;
        }
        
        if (customGoal && player.position.distanceTo(customGoal.position)<1.2) {
            const msg = document.getElementById('clear-message');
            if (msg.classList.contains('hidden')) {
                playSE('clear'); msg.classList.remove('hidden');
                if (currentMode==='test') { document.getElementById('btn-save-local').classList.remove('hidden'); document.getElementById('btn-publish').classList.remove('hidden'); document.getElementById('btn-back-home').classList.add('hidden'); } 
                else { document.getElementById('btn-save-local').classList.add('hidden'); document.getElementById('btn-publish').classList.add('hidden'); document.getElementById('btn-back-home').classList.remove('hidden'); if (viewingCourseKey) database.ref(`worldCourses/${viewingCourseKey}/clears`).transaction(c => (c||0)+1); }
            }
        }
        for (let b of customDeathBlocks) { if(Math.abs(player.position.x-b.position.x)<0.8 && Math.abs(player.position.z-b.position.z)<0.8 && Math.abs(player.position.y-b.position.y)<1.0) { die(); break; } }
        for (let k of customKeys) { if (!k.userData.collected && player.position.distanceTo(k.position) < 1.0) { k.userData.collected = true; k.visible = false; hasKeys.push(k.userData.uuid); playSE('key'); } }
    }
    updateCam(); renderer.render(scene, camera);
}
showScreen('login-screen'); animate();