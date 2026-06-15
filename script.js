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
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const database = firebase.database();
// -------------------------------------------------------------------

// --- BGM・SE システム ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgmVol = 0.5; let seVol = 0.5; let isBgmPlaying = false; let bgmInterval = null; let bgmStep = 0;
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
        }, 400);
        isBgmPlaying = true;
    } else if (!play && isBgmPlaying) { clearInterval(bgmInterval); isBgmPlaying = false; }
}

function playSE(type) {
    if (seVol <= 0) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination); const t = audioCtx.currentTime;

    if (type === 'place') { osc.type = 'square'; osc.frequency.setValueAtTime(400, t); gain.gain.setValueAtTime(seVol * 0.3, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); osc.start(t); osc.stop(t + 0.1); }
    else if (type === 'jump') { osc.type = 'square'; osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(600, t + 0.1); gain.gain.setValueAtTime(seVol * 0.3, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); osc.start(t); osc.stop(t + 0.1); }
    else if (type === 'death') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, t); osc.frequency.exponentialRampToValueAtTime(50, t + 0.3); gain.gain.setValueAtTime(seVol * 0.5, t); gain.gain.linearRampToValueAtTime(0, t + 0.3); osc.start(t); osc.stop(t + 0.3); }
    else if (type === 'clear') { osc.type = 'triangle'; [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => osc.frequency.setValueAtTime(freq, t + i * 0.1)); gain.gain.setValueAtTime(seVol * 0.5, t); gain.gain.linearRampToValueAtTime(0, t + 0.6); osc.start(t); osc.stop(t + 0.6); }
    else if (type === 'key') { osc.type = 'sine'; osc.frequency.setValueAtTime(880, t); osc.frequency.setValueAtTime(1760, t + 0.1); gain.gain.setValueAtTime(seVol * 0.4, t); gain.gain.linearRampToValueAtTime(0, t + 0.2); osc.start(t); osc.stop(t + 0.2); }
}

let currentUser = null; let currentMode = 'login'; let currentBlockType = 'normal'; let isFirstPerson = false; 
window.addEventListener('contextmenu', e => e.preventDefault());

// --- アカウント・UI制御 ---
function togglePass(inputId) { const el = document.getElementById(inputId); el.type = el.type === "password" ? "text" : "password"; }
function login() {
    const id = document.getElementById('login-id').value; const pass = document.getElementById('login-pass').value;
    if (!id || !pass) return alert("入力してください");
    database.ref('users/' + id).once('value', snapshot => {
        if (snapshot.exists() && snapshot.val().password === pass) { currentUser = id; document.getElementById('player-name-display').innerText = currentUser; if (audioCtx.state === 'suspended') audioCtx.resume(); toggleBGM(true); showScreen('home-screen'); }
        else alert("IDかパスワードが違います");
    });
}
function register() {
    let accCount = parseInt(localStorage.getItem('accountCreateCount') || '0'); if (accCount >= 5) return alert("上限(5個)に達しました");
    const id = document.getElementById('reg-id').value; const pass = document.getElementById('reg-pass').value;
    if (!id || !pass) return alert("入力してください"); if (pass.length < 6) return alert("6文字以上必要です");
    database.ref('users/' + id).once('value', snapshot => {
        if (snapshot.exists()) return alert("既に使われています");
        database.ref('users/' + id).set({ password: pass, friends: [] }).then(() => { localStorage.setItem('accountCreateCount', (accCount + 1).toString()); currentUser = id; document.getElementById('player-name-display').innerText = currentUser; if (audioCtx.state === 'suspended') audioCtx.resume(); toggleBGM(true); showScreen('home-screen'); });
    });
}
function deleteAccount() {
    if (confirm("本当にアカウントを削除しますか？")) { database.ref('users/' + currentUser).remove().then(() => { let accCount = parseInt(localStorage.getItem('accountCreateCount') || '0'); if (accCount > 0) localStorage.setItem('accountCreateCount', (accCount - 1).toString()); currentUser = null; toggleBGM(false); showScreen('login-screen'); }); }
}
function sendFriendRequest() { const targetId = prompt("リクエストを送るアカウント名"); if (!targetId) return; if (targetId === currentUser) return; database.ref('users/' + targetId).once('value', snapshot => { if (snapshot.exists()) { database.ref(`users/${targetId}/friendRequests/${currentUser}`).set(true); alert("送信しました！"); } else alert("見つかりませんでした"); }); }
function acceptRequest(fromId) { database.ref(`users/${currentUser}/friends/${fromId}`).set(true); database.ref(`users/${fromId}/friends/${currentUser}`).set(true); database.ref(`users/${currentUser}/friendRequests/${fromId}`).remove(); }
function rejectRequest(fromId) { database.ref(`users/${currentUser}/friendRequests/${fromId}`).remove(); }
function removeFriend(friendId) { if (confirm("削除しますか？")) { database.ref(`users/${currentUser}/friends/${friendId}`).remove(); database.ref(`users/${friendId}/friends/${currentUser}`).remove(); } }
function showFriendsScreen() {
    showScreen('friends-screen'); const reqC = document.getElementById('friend-requests-container'); const frC = document.getElementById('friends-list-container');
    database.ref(`users/${currentUser}/friendRequests`).on('value', snap => { reqC.innerHTML = ''; if (!snap.exists()) return reqC.innerHTML = '<p>なし</p>'; snap.forEach(child => { const div = document.createElement('div'); div.innerHTML = `<span>👤 ${child.key}</span> <div><button onclick="acceptRequest('${child.key}')">承認</button><button onclick="rejectRequest('${child.key}')">拒否</button></div>`; reqC.appendChild(div); }); });
    database.ref(`users/${currentUser}/friends`).on('value', snap => { frC.innerHTML = ''; if (!snap.exists()) return frC.innerHTML = '<p>なし</p>'; snap.forEach(child => { const div = document.createElement('div'); div.innerHTML = `<button onclick="showCourseList('friend', null, '${child.key}')">👤 ${child.key} のコース</button><button onclick="removeFriend('${child.key}')">削除</button>`; frC.appendChild(div); }); });
}

let myCourses = JSON.parse(localStorage.getItem('myCourses')) || [];
let viewingCourseKey = null; let viewingCourseData = null; let viewingCourseType = null; let viewingCourseIndex = null; let backScreenFromList = 'play-select-screen'; let currentLoadedCourses = [];

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden')); document.getElementById(screenId).classList.remove('hidden');
    document.getElementById('canvas-container').style.display = (screenId === 'editor-screen' || screenId === 'game-screen') ? 'block' : 'none'; currentMode = screenId.replace('-screen', '');
}
function goBackFromList() { showScreen(backScreenFromList); }

function showCourseList(type, sortOrder, friendId = null) {
    showScreen('course-list-screen'); viewingCourseType = type; backScreenFromList = (type === 'friend') ? 'friends-screen' : 'play-select-screen';
    const c = document.getElementById('course-list-container'); const t = document.getElementById('course-list-title'); const s = document.getElementById('course-search');
    c.innerHTML = '読込中...'; s.style.display = type === 'world' ? 'block' : 'none'; s.value = '';
    const render = (courses) => { currentLoadedCourses = courses.map((co, i) => ({ ...co, originalIndex: i })); filterCourses(); };
    
    if (type === 'world') { 
        t.innerText = sortOrder === 'popular' ? "世界のコース(人気順)" : "世界のコース(新着順)"; 
        database.ref('worldCourses').once('value', snap => { 
            let cs = []; snap.forEach(ch => { cs.push({ key: ch.key, ...ch.val() }); }); 
            if (sortOrder === 'popular') cs.sort((a, b) => (b.likes || 0) - (a.likes || 0)); else cs.reverse(); render(cs); 
        }); 
    } 
    else if (type === 'my') { t.innerText = "自分のコース"; render(myCourses); } 
    else if (type === 'friend') { 
        t.innerText = `${friendId} のコース`; 
        database.ref('worldCourses').orderByChild('author').equalTo(friendId).once('value', snap => { 
            let cs = []; snap.forEach(ch => { cs.push({ key: ch.key, ...ch.val() }); }); 
            cs.reverse(); render(cs); 
        }); 
    }
}

function filterCourses() {
    const q = document.getElementById('course-search').value.toLowerCase(); const c = document.getElementById('course-list-container'); c.innerHTML = '';
    const f = currentLoadedCourses.filter(co => (co.name && co.name.toLowerCase().includes(q)) || (co.author && co.author.toLowerCase().includes(q)));
    if (f.length === 0) return c.innerHTML = '<p>見つかりません</p>';
    f.forEach((co) => { const b = document.createElement('button'); b.innerText = `${co.name} (❤️${co.likes || 0}) / 作者: ${co.author || '自分'}`; b.onclick = () => { viewingCourseIndex = co.originalIndex; showCourseDetail(co); }; c.appendChild(b); });
}

function showCourseDetail(course) {
    viewingCourseKey = course.key || null; viewingCourseData = course.data;
    document.getElementById('detail-title').innerText = course.name; document.getElementById('detail-author').innerText = course.author || "自分";
    document.getElementById('detail-likes').innerText = course.likes || 0; document.getElementById('detail-plays').innerText = course.plays || 0;
    document.getElementById('detail-clear-rate').innerText = course.plays > 0 ? Math.floor(((course.clears||0)/course.plays)*100) : 0;
    const l = document.getElementById('like-btn'); l.innerText = "❤️ いいね！"; l.disabled = false;
    if (viewingCourseKey) { database.ref(`worldCourses/${viewingCourseKey}/likedUsers/${currentUser}`).once('value', s => { if (s.exists()) l.innerText = "💔 いいね解除"; }); } else l.style.display = 'none';
    document.getElementById('delete-course-btn').style.display = (viewingCourseType === 'my' || (viewingCourseType === 'world' && course.author === currentUser)) ? 'inline-block' : 'none';
    const cS = document.getElementById('comment-section'); cS.innerHTML = ''; if (course.comments) Object.values(course.comments).forEach(c => cS.innerHTML += `<div class="comment"><b>${c.user}</b>: ${c.text}</div>`);
    showScreen('course-detail-screen');
}

function deleteCourse() { if (confirm("削除しますか？")) { if (viewingCourseType === 'world') { database.ref(`worldCourses/${viewingCourseKey}`).remove().then(() => showCourseList('world', 'new')); } else { myCourses.splice(viewingCourseIndex, 1); localStorage.setItem('myCourses', JSON.stringify(myCourses)); showCourseList('my', 'new'); } } }

function likeCourse() {
    if (!viewingCourseKey) return; const r = database.ref(`worldCourses/${viewingCourseKey}`); const l = document.getElementById('like-btn'); l.disabled = true;
    r.child(`likedUsers/${currentUser}`).once('value', snap => {
        if (!snap.exists()) { r.child(`likedUsers/${currentUser}`).set(true); r.child('likes').transaction(likes => (likes || 0) + 1); l.innerText = "💔 いいね解除"; document.getElementById('detail-likes').innerText = (parseInt(document.getElementById('detail-likes').innerText) || 0) + 1; }
        else { r.child(`likedUsers/${currentUser}`).remove(); r.child('likes').transaction(likes => Math.max((likes || 0) - 1, 0)); l.innerText = "❤️ いいね！"; document.getElementById('detail-likes').innerText = Math.max((parseInt(document.getElementById('detail-likes').innerText) || 0) - 1, 0); }
        l.disabled = false;
    });
}

function postComment() { if (!viewingCourseKey) return; const t = document.getElementById('comment-select').value; database.ref(`worldCourses/${viewingCourseKey}/comments`).push({ user: currentUser, text: t }); document.getElementById('comment-section').innerHTML += `<div class="comment"><b>${currentUser}</b>: ${t}</div>`; document.getElementById('post-comment-btn').innerText = "送信完了！"; setTimeout(() => { document.getElementById('post-comment-btn').innerText = "コメント送信"; }, 1500); }
function startPlayFromDetail() { if (viewingCourseKey) database.ref(`worldCourses/${viewingCourseKey}/plays`).transaction(p => (p || 0) + 1); loadAndPlayCourse(viewingCourseData, false); }
function editCourseFromDetail() { showScreen('editor-screen'); floor.visible = true; clearScene(); currentCourseData = []; viewingCourseData.forEach(b => { let wId = b.warpTargetId || (['warp','locked_warp'].includes(b.type) ? b.linkId : null); let lId = b.lockId || (['key','door','locked_warp'].includes(b.type) ? b.linkId : null); placeBlock(b.type, new THREE.Vector3(b.x, b.y, b.z), true, false, b.uuid, wId, lId); }); resetPlayerPosition(); camPanX = 0; camPanZ = 0; drawLinkLines(); }

let currentCourseData = [];
function startEditor() { 
    showScreen('editor-screen'); floor.visible = true; 
    clearScene(); currentCourseData = []; camPanX = 0; camPanZ = 0; selectBlock('normal'); 
    placeBlock('start', new THREE.Vector3(0, 0.5, 0), true, false); 
    resetPlayerPosition(); 
}

function testPlay() { showScreen('game-screen'); currentMode = 'test'; floor.visible = false; resetPlayerPosition(); }
function loadAndPlayCourse(courseData, isTest = false) { 
    showScreen('game-screen'); floor.visible = false; clearScene(); 
    courseData.forEach(b => { let wId = b.warpTargetId || (['warp','locked_warp'].includes(b.type) ? b.linkId : null); let lId = b.lockId || (['key','door','locked_warp'].includes(b.type) ? b.linkId : null); placeBlock(b.type, new THREE.Vector3(b.x, b.y, b.z), false, false, b.uuid, wId, lId); });
    resetPlayerPosition(); 
}
function quitPlay() { isFirstPerson = false; if (currentMode === 'test') { showScreen('editor-screen'); floor.visible = true; resetPlayerPosition(); drawLinkLines(); } else { showScreen('home-screen'); } }
function saveLocalCourse() { const name = prompt("コース名を入力", "マイコース"); if (name) { myCourses.push({ name: name, data: JSON.parse(JSON.stringify(currentCourseData)) }); localStorage.setItem('myCourses', JSON.stringify(myCourses)); alert("保存しました！"); quitPlay(); } }
function publishCourse() { if (!currentUser) return alert("ログインが必要です"); const name = prompt("公開するコース名", "マイコース"); if (name) { const d = JSON.parse(JSON.stringify(currentCourseData)); myCourses.push({ name: name, data: d }); localStorage.setItem('myCourses', JSON.stringify(myCourses)); database.ref('worldCourses').push({ name: name, author: currentUser, data: d, likes: 0, plays: 0, clears: 0 }).then(() => { alert("世界に公開しました！"); quitPlay(); }).catch(err => { alert("エラー: " + err.message); quitPlay(); }); } }

// --- Three.js 準備 ---
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x87CEEB); 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); document.getElementById('canvas-container').appendChild(renderer.domElement);
const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(10, 20, 10); scene.add(light); scene.add(new THREE.AmbientLight(0x606060));
const player = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), new THREE.MeshLambertMaterial({ color: 0x0000ff })); scene.add(player);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshLambertMaterial({ color: 0x228B22 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let linkLinesGroup = new THREE.Group(); scene.add(linkLinesGroup); 
let camTheta = 0, camPhi = 1.0, camRadius = 12, camPanX = 0, camPanZ = 0;

function updateCam() {
    let targetX = player.position.x; let targetZ = player.position.z;
    if (currentMode === 'editor') { targetX += camPanX; targetZ += camPanZ; }
    if (isFirstPerson && (currentMode === 'game' || currentMode === 'test')) {
        player.visible = false; camera.position.set(player.position.x, player.position.y + 0.4, player.position.z);
        camera.lookAt(player.position.x - Math.sin(camPhi) * Math.sin(camTheta), player.position.y + 0.4 - Math.cos(camPhi), player.position.z - Math.sin(camPhi) * Math.cos(camTheta));
    } else {
        player.visible = true; camera.position.set(targetX + camRadius * Math.sin(camPhi) * Math.sin(camTheta), player.position.y + camRadius * Math.cos(camPhi), targetZ + camRadius * Math.sin(camPhi) * Math.cos(camTheta));
        if (!isNaN(targetX) && !isNaN(player.position.y) && !isNaN(targetZ)) camera.lookAt(targetX, player.position.y, targetZ); else resetPlayerPosition(); 
    }
}

// --- 50種類のブロック定義とテクスチャ生成 ---
const textureCache = {};
function getCanvasTexture(type) {
    if (textureCache[type]) return textureCache[type];
    let c = document.createElement('canvas'); c.width = 64; c.height = 64; let ctx = c.getContext('2d');
    if (type === 'fake') {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#555'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(10,10); ctx.lineTo(54,54); ctx.moveTo(54,10); ctx.lineTo(10,54); ctx.stroke();
    } else if (type === 'door') {
        ctx.fillStyle='#8B4513'; ctx.fillRect(0,0,64,64); ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(32, 24, 8, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(26,44); ctx.lineTo(38,44); ctx.lineTo(34,24); ctx.lineTo(30,24); ctx.fill();
    } else if (type === 'warp' || type === 'locked_warp') {
        ctx.fillStyle = type==='warp' ? '#440088' : '#880000'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.beginPath(); for(let i=1;i<20;i++){ ctx.arc(32,32, i*1.5, 0, Math.PI*2); } ctx.stroke();
    } else if (type === 'ice') {
        ctx.fillStyle='#add8e6'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(32,10); ctx.lineTo(32,54); ctx.moveTo(10,32); ctx.lineTo(54,32); ctx.moveTo(16,16); ctx.lineTo(48,48); ctx.moveTo(48,16); ctx.lineTo(16,48); ctx.stroke();
    } else if (type.startsWith('conv_')) {
        ctx.fillStyle='#444'; ctx.fillRect(0,0,64,64); ctx.fillStyle='#ff0'; ctx.font="40px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; 
        let txt = '↑'; if(type==='conv_s') txt='↓'; else if(type==='conv_e') txt='→'; else if(type==='conv_w') txt='←'; ctx.fillText(txt, 32, 36);
    } else if (type === 'sand') {
        ctx.fillStyle='#f4a460'; ctx.fillRect(0,0,64,64); ctx.fillStyle='#d2691e'; for(let i=0;i<50;i++){ ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2); }
    } else if (type === 'metal') {
        ctx.fillStyle='#aaa'; ctx.fillRect(0,0,64,64); ctx.strokeStyle='#ddd'; ctx.lineWidth=4; ctx.strokeRect(4,4,56,56); ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(8,8,3,0,7); ctx.arc(56,8,3,0,7); ctx.arc(8,56,3,0,7); ctx.arc(56,56,3,0,7); ctx.fill();
    } else { ctx.fillStyle='#888'; ctx.fillRect(0,0,64,64); }
    textureCache[type] = new THREE.CanvasTexture(c);
    return textureCache[type];
}

const BLOCKS = [
    {id:'normal', n:'通常ブロック', d:'普通の足場', c:0x888888}, {id:'fake', n:'すり抜け', d:'×印の罠', tx:'fake', pass:true},
    {id:'start', n:'スタート', d:'開始地点', type:'start'}, {id:'goal', n:'ゴール', d:'旗(クリア)', type:'goal'},
    {id:'key', n:'カギ', d:'右クリックでペア化', type:'key', pass:true}, {id:'door', n:'ドア', d:'カギで開く', tx:'door'},
    {id:'warp', n:'ワープ', d:'右クリックでペア化', tx:'warp'}, {id:'locked_warp', n:'カギ付ワープ', d:'カギが必要', tx:'locked_warp'},
    {id:'jump_s', n:'小ジャンプ', d:'少し跳ねる', c:0xadff2f}, {id:'jump_m', n:'中ジャンプ', d:'普通に跳ねる', c:0x32cd32}, {id:'jump_l', n:'大ジャンプ', d:'高く跳ねる', c:0x00ff00},
    {id:'speed_1', n:'ダッシュ', d:'少し速い', c:0x1e90ff}, {id:'speed_2', n:'超ダッシュ', d:'とても速い', c:0x0000ff}, {id:'slow', n:'泥', d:'足が遅くなる', c:0x8b4513},
    {id:'ice', n:'氷', d:'滑る', tx:'ice'}, {id:'sand', n:'砂', d:'少し沈む', tx:'sand'},
    {id:'conv_n', n:'コンベア(北)', d:'奥へ流れる', tx:'conv_n'}, {id:'conv_s', n:'コンベア(南)', d:'手前へ流れる', tx:'conv_s'}, {id:'conv_e', n:'コンベア(東)', d:'右へ流れる', tx:'conv_e'}, {id:'conv_w', n:'コンベア(西)', d:'左へ流れる', tx:'conv_w'},
    {id:'death', n:'即死(マグマ)', d:'触れるとアウト', c:0xff0000}, {id:'death_w', n:'即死(毒沼)', d:'触れるとアウト', c:0x800080},
    {id:'wood', n:'木材', d:'装飾用', c:0x8B4513}, {id:'brick', n:'レンガ', d:'装飾用', c:0xB22222}, {id:'metal', n:'鉄', d:'装飾用', tx:'metal'}, {id:'glass', n:'ガラス', d:'半透明', c:0xadd8e6, op:0.6},
    {id:'c_red', n:'赤ブロック', d:'装飾用', c:0xff5555}, {id:'c_blue', n:'青ブロック', d:'装飾用', c:0x5555ff}, {id:'c_green', n:'緑ブロック', d:'装飾用', c:0x55ff55}, {id:'c_yellow', n:'黄ブロック', d:'装飾用', c:0xffff55},
    {id:'c_purple', n:'紫ブロック', d:'装飾用', c:0xcc55ff}, {id:'c_pink', n:'桃ブロック', d:'装飾用', c:0xff88ff}, {id:'c_orange', n:'橙ブロック', d:'装飾用', c:0xffaa55}, {id:'c_cyan', n:'水色ブロック', d:'装飾用', c:0x55ffff},
    {id:'c_white', n:'白ブロック', d:'装飾用', c:0xffffff}, {id:'c_black', n:'黒ブロック', d:'装飾用', c:0x222222},
    {id:'l_red', n:'ライト赤', d:'装飾', c:0xffaaaa}, {id:'l_blue', n:'ライト青', d:'装飾', c:0xaaaaff}, {id:'l_green', n:'ライト緑', d:'装飾', c:0xaaffaa}, {id:'l_yellow', n:'ライト黄', d:'装飾', c:0xffffaa},
    {id:'d_red', n:'ダーク赤', d:'装飾', c:0x880000}, {id:'d_blue', n:'ダーク青', d:'装飾', c:0x000088}, {id:'d_green', n:'ダーク緑', d:'装飾', c:0x008800}, {id:'d_yellow', n:'ダーク黄', d:'装飾', c:0x888800},
    {id:'p_wood', n:'白木', d:'装飾', c:0xdeb887}, {id:'p_stone', n:'石畳', d:'装飾', c:0x708090}, {id:'p_gold', n:'金塊', d:'装飾', c:0xffd700}, {id:'p_dirt', n:'土', d:'装飾', c:0xa0522d},
    {id:'p_leaf', n:'葉っぱ', d:'装飾', c:0x228b22}, {id:'p_cloud', n:'雲', d:'装飾', c:0xf0f8ff}
];

function initSidebar() {
    const c = document.getElementById('block-list-container'); if(!c) return; c.innerHTML = '';
    
    const eb = document.createElement('button');
    eb.id = "btn-eraser"; eb.className = "block-btn";
    eb.onclick = () => selectBlock('eraser');
    eb.style.cssText = "width:100%; text-align:left; padding:8px; margin-bottom:15px; background-color:#d9534f; color:white; border:2px solid transparent; border-radius:5px; cursor:pointer;";
    eb.innerHTML = `<span style="font-weight:bold; font-size:15px; display:block;">🧹 消しゴム</span><span style="font-size:11px; color:#ccc;">クリックで削除</span>`;
    c.appendChild(eb);

    BLOCKS.forEach(b => {
        c.innerHTML += `<button id="btn-${b.id}" class="block-btn" onclick="selectBlock('${b.id}')" style="width:100%; text-align:left; padding:8px; margin-bottom:5px; background-color:#333; color:white; border:2px solid transparent; border-radius:5px; cursor:pointer;"><span style="font-weight:bold; font-size:15px; display:block;">${b.n}</span><span style="font-size:11px; color:#ccc;">${b.d}</span></button>`;
    });
}
initSidebar();

function selectBlock(type) { 
    currentBlockType = type; 
    document.querySelectorAll('[id^="btn-"]').forEach(b => b.style.borderColor = 'transparent');
    const btn = document.getElementById('btn-' + type); if(btn) btn.style.borderColor = '#4CAF50';
}
setTimeout(() => selectBlock('normal'), 100);

let solidBlocks=[], customDeathBlocks=[], customWarps=[], customGoal=null, customStart=null, placed=new Set(), meshList=[];
let customKeys=[], customDoors=[], hasKeys=[]; 

function clearScene() { meshList.forEach(m => scene.remove(m)); solidBlocks=[]; customDeathBlocks=[]; customWarps=[]; customGoal=null; customStart=null; customKeys=[]; customDoors=[]; placed.clear(); meshList=[]; hasKeys=[]; linkLinesGroup.clear();}

function getBlockMaterial(b) {
    if (b.tx) return new THREE.MeshLambertMaterial({ map: getCanvasTexture(b.tx), transparent: !!b.op, opacity: b.op||1 });
    return new THREE.MeshLambertMaterial({ color: b.c||0x888888, transparent: !!b.op, opacity: b.op||1 });
}

function createMesh(bDef) {
    if (bDef.type === 'goal') {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2), new THREE.MeshLambertMaterial({color:0xcccccc})); pole.position.y=1; g.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.6), new THREE.MeshLambertMaterial({color:0xff0000, side:THREE.DoubleSide})); flag.position.set(0.4, 1.7, 0); g.add(flag);
        return g;
    }
    if (bDef.type === 'start') {
        const g = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.2), new THREE.MeshLambertMaterial({color:0xffa500})); pad.position.y=0.1; g.add(pad);
        return g;
    }
    if (bDef.type === 'key') {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.6), new THREE.MeshLambertMaterial({color:0xffd700})); body.rotation.z = Math.PI/2; g.add(body);
        const head = new THREE.Mesh(new THREE.TorusGeometry(0.15,0.05,8,16), new THREE.MeshLambertMaterial({color:0xffd700})); head.position.x = -0.4; g.add(head);
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.2,0.05), new THREE.MeshLambertMaterial({color:0xffd700})); tooth.position.set(0.2, -0.15, 0); g.add(tooth);
        g.position.y = 0.5; 
        return g;
    }
    return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), getBlockMaterial(bDef));
}

function removeBlockMesh(m) {
    scene.remove(m); meshList = meshList.filter(b => b !== m); solidBlocks = solidBlocks.filter(b => b !== m); customDeathBlocks = customDeathBlocks.filter(b => b !== m);
    customWarps = customWarps.filter(b => b !== m); customKeys = customKeys.filter(b => b !== m); customDoors = customDoors.filter(b => b !== m);
    if (customGoal === m) customGoal = null; if (customStart === m) customStart = null;
    placed.delete(`${m.position.x},${m.position.y},${m.position.z}`);
    currentCourseData = currentCourseData.filter(d => d.uuid !== m.userData.uuid);
    drawLinkLines();
}

function placeBlock(type, pos, save=true, playSound=true, loadUuid=null, loadWarpTargetId=null, loadLockId=null) {
    const posKey = `${pos.x},${pos.y},${pos.z}`;
    if (type === 'eraser') {
        if (placed.has(posKey)) { const m = meshList.find(b => b.position.x === pos.x && b.position.y === pos.y && b.position.z === pos.z); if (m) { removeBlockMesh(m); playSE('place'); } } return;
    }
    if (placed.has(posKey)) return;
    if (['goal','start'].includes(type)) { let ex = type==='goal'?customGoal:customStart; if(ex) removeBlockMesh(ex); }

    const bDef = BLOCKS.find(b => b.id === type) || BLOCKS[0];
    const mesh = createMesh(bDef); mesh.position.copy(pos); 
    
    const uuid = loadUuid || Math.random().toString(36).substring(2);
    mesh.userData = { type: type, uuid: uuid, warpTargetId: loadWarpTargetId || null, lockId: loadLockId || null, opened: false, collected: false, bDef: bDef };
    scene.add(mesh); meshList.push(mesh); placed.add(posKey);
    
    if (playSound) playSE('place');
    
    if (!bDef.pass && !['goal','key'].includes(bDef.type)) solidBlocks.push(mesh);
    if (type.startsWith('death')) customDeathBlocks.push(mesh);
    if (type==='goal') customGoal=mesh; else if (type==='start') customStart=mesh;
    else if (type==='key') customKeys.push(mesh); else if (type==='door') customDoors.push(mesh);
    else if (type.includes('warp')) customWarps.push(mesh);
    
    if(save) currentCourseData.push({type:type, x:pos.x, y:pos.y, z:pos.z, uuid:uuid, warpTargetId:mesh.userData.warpTargetId, lockId:mesh.userData.lockId});
}

let linkSourceMesh = null;
function handleRightClickLink(cx, cy) {
    mouse.set((cx/window.innerWidth)*2-1, -(cy/window.innerHeight)*2+1);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meshList, true);
    if (intersects.length > 0) {
        let m = intersects[0].object; while(m.parent && m.parent.type==='Group') m=m.parent;
        const t = m.userData.type; const bDef = BLOCKS.find(b => b.id === t) || {}; const bt = bDef.type || t; 
        
        if (['key','door','warp','locked_warp'].includes(t) || ['key','door','warp','locked_warp'].includes(bt)) {
            if (!linkSourceMesh) {
                if (m.userData.warpTargetId || m.userData.lockId) {
                    if (confirm("🔗 このブロックに設定されているペアを解除しますか？")) {
                        if (m.userData.warpTargetId) { let target = meshList.find(b => b.userData.uuid === m.userData.warpTargetId); if (target) target.userData.warpTargetId = null; m.userData.warpTargetId = null; }
                        if (m.userData.lockId) { let target = meshList.find(b => b.userData.uuid === m.userData.lockId); if (target) target.userData.lockId = null; m.userData.lockId = null; }
                        updateCourseDataLinks(); drawLinkLines(); return alert("💔 ペアを解除しました！");
                    }
                }
                linkSourceMesh = m; alert("【ペア元を選択しました】\nもう一度、対応させたいブロックを右クリックしてください。");
            } else {
                if (linkSourceMesh === m) { linkSourceMesh=null; return alert("キャンセルしました"); }
                const t1 = linkSourceMesh.userData.type; const t2 = m.userData.type; let success = false;
                if (['warp', 'locked_warp'].includes(t1) && ['warp', 'locked_warp'].includes(t2)) { linkSourceMesh.userData.warpTargetId = m.userData.uuid; m.userData.warpTargetId = linkSourceMesh.userData.uuid; success = true; }
                else if ((t1 === 'key' && ['door', 'locked_warp'].includes(t2)) || (t2 === 'key' && ['door', 'locked_warp'].includes(t1))) { linkSourceMesh.userData.lockId = m.userData.uuid; m.userData.lockId = linkSourceMesh.userData.uuid; success = true; }
                if (success) { updateCourseDataLinks(); alert("🔗 ペアを構築しました！"); linkSourceMesh = null; drawLinkLines(); } 
                else { alert("⚠️ その組み合わせではペアを組めません。\n(ワープ同士、またはカギとドア/鍵付きワープのみ可能です)"); linkSourceMesh = null; }
            }
        }
    } else { linkSourceMesh = null; }
}

function updateCourseDataLinks() { meshList.forEach(m => { let d = currentCourseData.find(cd => cd.uuid === m.userData.uuid); if (d) { d.warpTargetId = m.userData.warpTargetId; d.lockId = m.userData.lockId; } }); }

function drawLinkLines() {
    linkLinesGroup.clear();
    if (currentMode !== 'editor') return;
    const drawnWarp = new Set(); const drawnLock = new Set();
    meshList.forEach(m1 => {
        if (m1.userData.warpTargetId && !drawnWarp.has(m1.userData.uuid)) {
            const m2 = meshList.find(b => b.userData.uuid === m1.userData.warpTargetId);
            if (m2) {
                const geo = new THREE.BufferGeometry().setFromPoints([m1.position, m2.position]);
                linkLinesGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0xff0000, linewidth: 3})));
                drawnWarp.add(m1.userData.uuid); drawnWarp.add(m2.userData.uuid);
            }
        }
        if (m1.userData.lockId && !drawnLock.has(m1.userData.uuid)) {
            const m2 = meshList.find(b => b.userData.uuid === m1.userData.lockId);
            if (m2) {
                const geo = new THREE.BufferGeometry().setFromPoints([m1.position, m2.position]);
                linkLinesGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0xffaa00, linewidth: 3})));
                drawnLock.add(m1.userData.uuid); drawnLock.add(m2.userData.uuid);
            }
        }
    });
}

let isDragging = false, prevX = 0, prevY = 0;
let rightClickStart = 0, rightClickPos = {x:0, y:0};

window.addEventListener('mousedown', e => { 
    if (e.target.tagName !== 'CANVAS') return;

    if (e.button === 2) { 
        isDragging = true; prevX = e.clientX; prevY = e.clientY; 
        rightClickStart = Date.now(); rightClickPos = {x: e.clientX, y: e.clientY}; 
        return; 
    }
    
    if (e.button === 0 && currentMode === 'editor') {
        mouse.set((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1);
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([floor, ...meshList], true);
        
        if (intersects.length > 0) {
            let hit = intersects[0].object; 
            while(hit.parent && hit.parent.type === 'Group') hit = hit.parent; 
            
            if (currentBlockType === 'eraser') {
                if (hit !== floor) { removeBlockMesh(hit); playSE('place'); }
            } else {
                // ★修正: b.userData.type を安全に取得するようにしました！
                let n = new THREE.Vector3(0, 1, 0);
                if (intersects[0].face) {
                    n.copy(intersects[0].face.normal);
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersects[0].object.matrixWorld);
                    n.applyMatrix3(normalMatrix).normalize();
                    if (Math.abs(n.x) > Math.abs(n.y) && Math.abs(n.x) > Math.abs(n.z)) { n.set(Math.sign(n.x), 0, 0); }
                    else if (Math.abs(n.y) > Math.abs(n.x) && Math.abs(n.y) > Math.abs(n.z)) { n.set(0, Math.sign(n.y), 0); }
                    else { n.set(0, 0, Math.sign(n.z)); }
                }

                let p;
                if (hit === floor) {
                    p = new THREE.Vector3().copy(intersects[0].point).add(n.multiplyScalar(0.5));
                    p.x = Math.round(p.x); p.y = 0.5; p.z = Math.round(p.z);
                } else {
                    p = new THREE.Vector3().copy(hit.position).add(n);
                    p.x = Math.round(p.x); p.y = Math.round(p.y - 0.5) + 0.5; p.z = Math.round(p.z);
                }
                
                placeBlock(currentBlockType, p);
            }
        }
    }
});

window.addEventListener('mousemove', e => {
    if (isDragging) {
        if (e.shiftKey && currentMode === 'editor') {
            let dx = (e.clientX - prevX) * 0.05; let dy = (e.clientY - prevY) * 0.05;
            camPanX -= dx * Math.cos(camTheta) + dy * Math.sin(camTheta); 
            camPanZ -= -dx * Math.sin(camTheta) + dy * Math.cos(camTheta);
        } else {
            camTheta -= (e.clientX - prevX)*0.01; camPhi -= (e.clientY - prevY)*0.01;
            if (camPhi < 0.1) camPhi = 0.1; if (camPhi > Math.PI/2.1) camPhi = Math.PI/2.1;
        }
        prevX = e.clientX; prevY = e.clientY;
    }
});

window.addEventListener('mouseup', e => { 
    isDragging = false; 
    if (e.button === 2 && currentMode === 'editor') {
        let dist = Math.abs(e.clientX - rightClickPos.x) + Math.abs(e.clientY - rightClickPos.y);
        if (Date.now() - rightClickStart < 250 && dist < 5) handleRightClickLink(e.clientX, e.clientY);
    }
});

// --- 操作と物理 ---
const keys = { w:false, s:false, a:false, d:false, space:false };
window.addEventListener('keydown', e => { let k=e.key.toLowerCase(); if(k==='w'||k==='s'||k==='a'||k==='d'||k==='arrowup'||k==='arrowdown'||k==='arrowleft'||k==='arrowright') keys[k.replace('arrow','')]=true; if(e.code==='Space') keys.space=true; if(k==='v') isFirstPerson = !isFirstPerson; });
window.addEventListener('keyup', e => { let k=e.key.toLowerCase(); if(k==='w'||k==='s'||k==='a'||k==='d'||k==='arrowup'||k==='arrowdown'||k==='arrowleft'||k==='arrowright') keys[k.replace('arrow','')]=false; if(e.code==='Space') keys.space=false; });

let velocityY=0, isGrounded=false, warpCooldown=0;
function resetPlayerPosition() {
    player.position.set(customStart?customStart.position.x:0, customStart?customStart.position.y+1.0:1.0, customStart?customStart.position.z:0);
    velocityY=0; hasKeys=[]; document.getElementById('clear-message').classList.add('hidden'); warpCooldown=0;
    customKeys.forEach(k => { k.visible = true; k.userData.collected = false; }); customDoors.forEach(d => { d.visible = true; d.userData.opened = false; });
}

// ★修正: t を取得する際に安全な方法を使用
function checkWall() {
    for (let b of solidBlocks) {
        if (b.userData.opened) continue;
        if (Math.abs(player.position.x - b.position.x)<0.8 && Math.abs(player.position.z - b.position.z)<0.8 && player.position.y - b.position.y > -0.5 && player.position.y - b.position.y < 0.8) {
            let t = b.userData.type;
            if (t === 'door') {
                let lId = b.userData.lockId || b.userData.linkId;
                if (hasKeys.includes(lId) || (!lId && hasKeys.length>0)) {
                    b.visible = false; b.userData.opened = true; playSE('place'); continue; 
                }
            }
            return true;
        }
    } return false;
}

function updatePhysics() {
    velocityY -= 0.01; player.position.y += velocityY; isGrounded = false; let onBlock = null;
    if (floor.visible && player.position.y<=0.4) { player.position.y=0.4; velocityY=0; isGrounded=true; }
    for (let b of solidBlocks) {
        if (b.userData.opened) continue;
        if (Math.abs(player.position.x-b.position.x)<0.75 && Math.abs(player.position.z-b.position.z)<0.75 && player.position.y-b.position.y>0 && player.position.y-b.position.y<1.0 && velocityY<=0) {
            player.position.y = b.position.y+0.9; velocityY=0; isGrounded=true; onBlock = b;
        }
    }
    
    let moveSpd = 0.1;
    if (onBlock) {
        let t = onBlock.userData.type;
        if(t==='speed_1') moveSpd=0.2; if(t==='speed_2') moveSpd=0.35; if(t==='slow'||t==='sand') moveSpd=0.03;
        if(t.startsWith('conv_')) {
            if(t==='conv_n') player.position.z-=0.05; if(t==='conv_s') player.position.z+=0.05; if(t==='conv_e') player.position.x+=0.05; if(t==='conv_w') player.position.x-=0.05;
            if(checkWall()) { player.position.x=Math.round(player.position.x); player.position.z=Math.round(player.position.z); } 
        }
        if(t==='jump_s') { velocityY=0.25; isGrounded=false; playSE('jump'); }
        if(t==='jump_m') { velocityY=0.4; isGrounded=false; playSE('jump'); }
        if(t==='jump_l') { velocityY=0.6; isGrounded=false; playSE('jump'); }
    }
    
    if(keys.space && isGrounded) { velocityY=0.22; keys.space=false; playSE('jump'); }
    if (player.position.y < -10 || isNaN(player.position.y)) { playSE('death'); resetPlayerPosition(); }

    if (warpCooldown > 0) warpCooldown--;
    if (warpCooldown <= 0) {
        for (let w of customWarps) {
            if (Math.abs(player.position.x-w.position.x)<0.8 && Math.abs(player.position.z-w.position.z)<0.8 && Math.abs(player.position.y-w.position.y)<1.0) {
                let t = w.userData.type;
                if (t === 'locked_warp') {
                    let lId = w.userData.lockId || w.userData.linkId;
                    if (lId ? !hasKeys.includes(lId) : hasKeys.length===0) continue; 
                }
                let targetId = w.userData.warpTargetId || w.userData.linkId;
                if (targetId) {
                    let target = customWarps.find(tw => tw.userData.uuid === targetId);
                    if (target) { player.position.set(target.position.x, target.position.y + 1, target.position.z); warpCooldown = 60; playSE('jump'); break; }
                }
            }
        }
    }
    return moveSpd;
}

function animate() {
    requestAnimationFrame(animate);
    const isCleared = !document.getElementById('clear-message').classList.contains('hidden');

    if ((currentMode==='game' || currentMode==='test') && !isCleared) {
        let ix=0, iz=0; if(keys.up||keys.w) iz-=1; if(keys.down||keys.s) iz+=1; if(keys.left||keys.a) ix-=1; if(keys.right||keys.d) ix+=1;
        let speed = updatePhysics(); 
        if(ix!==0 || iz!==0) {
            let l=Math.sqrt(ix*ix+iz*iz); ix/=l; iz/=l;
            let dx=(ix*Math.cos(camTheta)+iz*Math.sin(camTheta))*speed, dz=(-ix*Math.sin(camTheta)+iz*Math.cos(camTheta))*speed;
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
        for (let b of customDeathBlocks) { if(Math.abs(player.position.x-b.position.x)<0.8 && Math.abs(player.position.z-b.position.z)<0.8 && Math.abs(player.position.y-b.position.y)<1.0) { playSE('death'); resetPlayerPosition(); break; } }
        for (let k of customKeys) { if (!k.userData.collected && player.position.distanceTo(k.position) < 1.0) { k.userData.collected = true; k.visible = false; hasKeys.push(k.userData.uuid); playSE('key'); } }
    }
    updateCam(); renderer.render(scene, camera);
}
showScreen('login-screen'); animate();