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

let currentUser = null;
let currentMode = 'login';
let currentBlockType = 'normal'; 
let currentSpeed = 0.1;
let isMobileMode = false;

window.addEventListener('contextmenu', e => e.preventDefault());

// --- アカウント・ログインシステム ---
function login() {
    const id = document.getElementById('login-id').value;
    const pass = document.getElementById('login-pass').value;
    if (!id || !pass) return alert("入力してください");
    
    database.ref('users/' + id).once('value', snapshot => {
        if (snapshot.exists() && snapshot.val().password === pass) {
            currentUser = id;
            document.getElementById('player-name-display').innerText = currentUser;
            showScreen('home-screen');
        } else {
            alert("IDかパスワードが違います");
        }
    });
}

function register() {
    let accCount = parseInt(localStorage.getItem('accountCreateCount') || '0');
    if (accCount >= 5) return alert("この端末で作成できるアカウントの上限(5個)に達しました");

    const id = document.getElementById('reg-id').value;
    const pass = document.getElementById('reg-pass').value;
    if (!id || !pass) return alert("入力してください");

    database.ref('users/' + id).once('value', snapshot => {
        if (snapshot.exists()) return alert("その名前はすでに使われています");
        database.ref('users/' + id).set({ password: pass, friends: [] }).then(() => {
            localStorage.setItem('accountCreateCount', (accCount + 1).toString());
            currentUser = id;
            document.getElementById('player-name-display').innerText = currentUser;
            showScreen('home-screen');
        });
    });
}

function deleteAccount() {
    if (confirm("本当にアカウントを削除しますか？\n（あなたが作ったコースは残りますが、二度とログインできなくなります）")) {
        database.ref('users/' + currentUser).remove().then(() => {
            let accCount = parseInt(localStorage.getItem('accountCreateCount') || '0');
            if (accCount > 0) localStorage.setItem('accountCreateCount', (accCount - 1).toString());
            currentUser = null;
            showScreen('login-screen');
        });
    }
}

// --- フレンドシステム ---
function addFriend() {
    const friendId = prompt("追加したいフレンドのアカウント名を入力してください");
    if (!friendId) return;
    if (friendId === currentUser) return alert("自分自身は追加できません");

    database.ref('users/' + friendId).once('value', snapshot => {
        if (snapshot.exists()) {
            database.ref('users/' + currentUser + '/friends/' + friendId).set(true);
            alert(`${friendId} さんをフレンドに追加しました！`);
        } else {
            alert("入力されたアカウントが見つかりませんでした");
        }
    });
}

function showFriendsScreen() {
    showScreen('friends-screen');
    const container = document.getElementById('friends-list-container');
    container.innerHTML = '読み込み中...';

    database.ref('users/' + currentUser + '/friends').on('value', snapshot => {
        container.innerHTML = '';
        if (!snapshot.exists()) return container.innerHTML = '<p style="text-align:center;">フレンドがいません</p>';
        snapshot.forEach(child => {
            const btn = document.createElement('button');
            btn.innerText = `👤 ${child.key} のコースを見る`;
            btn.onclick = () => showCourseList('friend', null, child.key);
            container.appendChild(btn);
        });
    });
}

// --- コース一覧・ソート・詳細・削除 ---
let myCourses = JSON.parse(localStorage.getItem('myCourses')) || [];
let viewingCourseKey = null;
let viewingCourseData = null;
let viewingCourseType = null; 
let viewingCourseIndex = null;
let backScreenFromList = 'play-select-screen';
let currentLoadedCourses = [];

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    document.getElementById('canvas-container').style.display = (screenId === 'editor-screen' || screenId === 'game-screen') ? 'block' : 'none';
    currentMode = screenId.replace('-screen', '');
}

function toggleMobileMode() { isMobileMode = document.getElementById('mobile-mode-check').checked; }
function goBackFromList() { showScreen(backScreenFromList); }

function showCourseList(type, sortOrder, friendId = null) {
    showScreen('course-list-screen');
    viewingCourseType = type;
    backScreenFromList = (type === 'friend') ? 'friends-screen' : 'play-select-screen';
    
    const container = document.getElementById('course-list-container');
    const title = document.getElementById('course-list-title');
    const searchInput = document.getElementById('course-search');
    
    container.innerHTML = '読み込み中...';
    
    if (type === 'world') {
        searchInput.style.display = 'block';
        searchInput.value = '';
    } else {
        searchInput.style.display = 'none';
    }

    const renderList = (courses) => {
        // 元の配列の位置を保存してから検索・表示に渡す
        currentLoadedCourses = courses.map((c, i) => ({ ...c, originalIndex: i }));
        filterCourses();
    };
    
    if (type === 'world') {
        title.innerText = sortOrder === 'popular' ? "世界のコース (人気順)" : "世界のコース (新着順)";
        database.ref('worldCourses').once('value', snapshot => {
            let courses = [];
            snapshot.forEach(child => courses.push({ key: child.key, ...child.val() }));
            if (sortOrder === 'popular') courses.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            else courses.reverse(); 
            renderList(courses);
        });
    } else if (type === 'my') {
        title.innerText = "自分のコース(ローカル)";
        renderList(myCourses); 
    } else if (type === 'friend') {
        title.innerText = `${friendId} のコース`;
        database.ref('worldCourses').orderByChild('author').equalTo(friendId).once('value', snapshot => {
            let courses = [];
            snapshot.forEach(child => courses.push({ key: child.key, ...child.val() }));
            courses.reverse(); renderList(courses);
        });
    }
}

function filterCourses() {
    const q = document.getElementById('course-search').value.toLowerCase();
    const container = document.getElementById('course-list-container');
    container.innerHTML = '';
    
    const filtered = currentLoadedCourses.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.author && c.author.toLowerCase().includes(q))
    );
    
    if (filtered.length === 0) return container.innerHTML = '<p style="text-align:center;">見つかりませんでした</p>';
    
    filtered.forEach((course) => {
        const btn = document.createElement('button');
        btn.innerText = `${course.name} (❤️${course.likes || 0}) / 作者: ${course.author || '自分'}`;
        btn.onclick = () => { viewingCourseIndex = course.originalIndex; showCourseDetail(course); };
        container.appendChild(btn);
    });
}

function showCourseDetail(course) {
    viewingCourseKey = course.key || null;
    viewingCourseData = course.data;
    document.getElementById('detail-title').innerText = course.name;
    document.getElementById('detail-author').innerText = course.author || "自分 (ローカル)";
    document.getElementById('detail-likes').innerText = course.likes || 0;
    document.getElementById('detail-plays').innerText = course.plays || 0;
    
    let plays = course.plays || 0; let clears = course.clears || 0;
    document.getElementById('detail-clear-rate').innerText = plays > 0 ? Math.floor((clears/plays)*100) : 0;

    // いいねボタンの制御（1人1回）
    const likeBtn = document.getElementById('like-btn');
    likeBtn.innerText = "❤️ いいね！";
    likeBtn.disabled = false;
    
    if (viewingCourseKey) {
        database.ref(`worldCourses/${viewingCourseKey}/likedUsers/${currentUser}`).once('value', snap => {
            if (snap.exists()) {
                likeBtn.innerText = "❤️ いいね済み";
                likeBtn.disabled = true;
            }
        });
    } else {
        likeBtn.style.display = 'none'; // ローカルは非表示
    }

    const delBtn = document.getElementById('delete-course-btn');
    if (viewingCourseType === 'my' || (viewingCourseType === 'world' && course.author === currentUser)) {
        delBtn.style.display = 'inline-block';
    } else {
        delBtn.style.display = 'none';
    }

    const cSec = document.getElementById('comment-section');
    cSec.innerHTML = '';
    if (course.comments) {
        Object.values(course.comments).forEach(c => cSec.innerHTML += `<div class="comment"><b>${c.user}</b>: ${c.text}</div>`);
    }
    showScreen('course-detail-screen');
}

function deleteCourse() {
    if (confirm("本当にこのコースを削除しますか？")) {
        if (viewingCourseType === 'world') {
            database.ref(`worldCourses/${viewingCourseKey}`).remove().then(() => showCourseList('world', 'new'));
        } else if (viewingCourseType === 'my') {
            myCourses.splice(viewingCourseIndex, 1);
            localStorage.setItem('myCourses', JSON.stringify(myCourses));
            showCourseList('my', 'new');
        }
    }
}

function likeCourse() {
    if (!viewingCourseKey) return;
    const courseRef = database.ref(`worldCourses/${viewingCourseKey}`);
    
    courseRef.child(`likedUsers/${currentUser}`).once('value', snap => {
        if (!snap.exists()) {
            courseRef.child(`likedUsers/${currentUser}`).set(true);
            courseRef.child('likes').transaction(likes => (likes || 0) + 1);
            
            // アラートなしで見た目を変更
            const likeBtn = document.getElementById('like-btn');
            likeBtn.innerText = "❤️ いいね済み";
            likeBtn.disabled = true;
            document.getElementById('detail-likes').innerText = (parseInt(document.getElementById('detail-likes').innerText) || 0) + 1;
        }
    });
}

function postComment() {
    if (!viewingCourseKey) return;
    const text = document.getElementById('comment-select').value;
    database.ref(`worldCourses/${viewingCourseKey}/comments`).push({ user: currentUser, text: text });
    
    // アラートなしで即座に反映
    document.getElementById('comment-section').innerHTML += `<div class="comment"><b>${currentUser}</b>: ${text}</div>`;
    const btn = document.getElementById('post-comment-btn');
    btn.innerText = "送信完了！";
    setTimeout(() => { btn.innerText = "コメント送信"; }, 1500);
}

function startPlayFromDetail() {
    if (viewingCourseKey) database.ref(`worldCourses/${viewingCourseKey}/plays`).transaction(p => (p || 0) + 1);
    loadAndPlayCourse(viewingCourseData, false);
}

// --- エディタとゲーム処理 ---
let currentCourseData = [];

function startEditor() {
    showScreen('editor-screen');
    floor.visible = true;
    clearScene(); currentCourseData = []; resetPlayerPosition();
    camPanX = 0; camPanZ = 0; 
}

function testPlay() {
    showScreen('game-screen');
    currentMode = 'test';
    document.getElementById('mobile-controls').classList.toggle('hidden', !isMobileMode);
    floor.visible = false; resetPlayerPosition();
}

function loadAndPlayCourse(courseData, isTest = false) {
    showScreen('game-screen');
    document.getElementById('mobile-controls').classList.toggle('hidden', !isMobileMode);
    floor.visible = false;
    clearScene();
    courseData.forEach(b => placeBlock(b.type, new THREE.Vector3(b.x, b.y, b.z), false));
    resetPlayerPosition();
}

function quitPlay() {
    if (currentMode === 'test') {
        showScreen('editor-screen'); 
        floor.visible = true;
        resetPlayerPosition();
    } else {
        showScreen('home-screen');
    }
}

function saveLocalCourse() {
    const name = prompt("コース名を入力", "マイコース");
    if (name) {
        myCourses.push({ name: name, data: currentCourseData });
        localStorage.setItem('myCourses', JSON.stringify(myCourses));
        quitPlay();
    }
}

function publishCourse() {
    const name = prompt("公開するコース名を入力", "マイコース");
    if (name) {
        database.ref('worldCourses').push({
            name: name, author: currentUser, data: currentCourseData,
            likes: 0, plays: 0, clears: 0
        }).then(() => { quitPlay(); });
    }
}

function selectBlock(type) { currentBlockType = type; }

// --- Three.js ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(10, 20, 10); scene.add(light);
scene.add(new THREE.AmbientLight(0x606060));

const player = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), new THREE.MeshLambertMaterial({ color: 0x0000ff }));
scene.add(player);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0x228B22 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);

// --- カメラ操作 ---
let isDragging = false, camTheta = 0, camPhi = 1.0, camRadius = 12, prevX = 0, prevY = 0;
let camPanX = 0, camPanZ = 0;

function updateCam() {
    let targetX = player.position.x;
    let targetZ = player.position.z;

    if (currentMode === 'editor') {
        targetX += camPanX;
        targetZ += camPanZ;
    }

    camera.position.set(
        targetX + camRadius * Math.sin(camPhi) * Math.sin(camTheta),
        player.position.y + camRadius * Math.cos(camPhi),
        targetZ + camRadius * Math.sin(camPhi) * Math.cos(camTheta)
    );
    if (!isNaN(targetX) && !isNaN(player.position.y) && !isNaN(targetZ)) {
        camera.lookAt(targetX, player.position.y, targetZ);
    } else {
        resetPlayerPosition(); 
    }
}

window.addEventListener('mousedown', e => { 
    if(e.button===2 || isMobileMode) { 
        isDragging=true; 
        prevX=e.clientX||e.touches?.[0].clientX; 
        prevY=e.clientY||e.touches?.[0].clientY; 
    }
});

window.addEventListener('mousemove', e => {
    if(isDragging) {
        let x = e.clientX||e.touches?.[0].clientX; let y = e.clientY||e.touches?.[0].clientY;
        if (e.shiftKey && currentMode === 'editor') {
            let dx = (x - prevX) * 0.05;
            let dy = (y - prevY) * 0.05;
            camPanX -= Math.cos(camTheta) * dx - Math.sin(camTheta) * dy;
            camPanZ -= -Math.sin(camTheta) * dx - Math.cos(camTheta) * dy;
        } else {
            camTheta -= (x - prevX)*0.01; camPhi -= (y - prevY)*0.01;
            if(camPhi<0.1) camPhi=0.1; if(camPhi>Math.PI/2.1) camPhi=Math.PI/2.1;
        }
        prevX=x; prevY=y;
    }
});
window.addEventListener('mouseup', () => isDragging=false);

window.addEventListener('touchstart', e => { if(isMobileMode && e.target===renderer.domElement) { isDragging=true; prevX=e.touches[0].clientX; prevY=e.touches[0].clientY; }});
window.addEventListener('touchmove', e => {
    if(isDragging && isMobileMode && e.target===renderer.domElement) {
        camTheta -= (e.touches[0].clientX - prevX)*0.01; camPhi -= (e.touches[0].clientY - prevY)*0.01;
        if(camPhi<0.1) camPhi=0.1; if(camPhi>Math.PI/2.1) camPhi=Math.PI/2.1;
        prevX=e.touches[0].clientX; prevY=e.touches[0].clientY;
    }
});
window.addEventListener('touchend', () => isDragging=false);


// --- ブロック管理 ---
let solidBlocks=[], customDeathBlocks=[], customGoal=null, customStart=null, placed=new Set(), meshList=[];
function clearScene() { meshList.forEach(m => scene.remove(m)); solidBlocks=[]; customDeathBlocks=[]; customGoal=null; customStart=null; placed.clear(); meshList=[]; }

function removeBlockMesh(m) {
    scene.remove(m);
    meshList = meshList.filter(b => b !== m);
    solidBlocks = solidBlocks.filter(b => b !== m);
    customDeathBlocks = customDeathBlocks.filter(b => b !== m);
    if (customGoal === m) customGoal = null;
    if (customStart === m) customStart = null;
    const posKey = `${m.position.x},${m.position.y},${m.position.z}`;
    placed.delete(posKey);
    currentCourseData = currentCourseData.filter(d => !(d.x === m.position.x && d.y === m.position.y && d.z === m.position.z));
}

const materials = {
    'normal': 0x888888, 'wood': 0x8B4513, 'glass': 0xadd8e6, 'fake': 0x111111,
    'color-red': 0xff5555, 'color-blue': 0x5555ff, 'color-green': 0x55ff55, 'color-pink': 0xff88ff,
    'jump': 0xadff2f, 'conveyor': 0x800080, 'speed': 0x0000ff, 'slow': 0x006400,
    'death': 0xff0000, 'goal': 0xffff00, 'start': 0xffa500, 'key': 0xffd700, 'door': 0x222222
};

const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
function placeBlock(type, pos, save=true) {
    const posKey = `${pos.x},${pos.y},${pos.z}`;
    if (placed.has(posKey)) return;
    if (type==='goal' && customGoal){ scene.remove(customGoal); customGoal=null; }
    if (type==='start' && customStart){ scene.remove(customStart); customStart=null; }

    const isSolid = (type !== 'fake' && type !== 'key');
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshLambertMaterial({color: materials[type], transparent: type==='glass', opacity: 0.6}));
    mesh.position.copy(pos); mesh.userData = {type: type, opened: false}; scene.add(mesh); meshList.push(mesh);
    placed.add(posKey);
    
    if (isSolid) solidBlocks.push(mesh);
    if(type==='death') customDeathBlocks.push(mesh); 
    else if(type==='goal') customGoal=mesh; 
    else if(type==='start') customStart=mesh;
    
    if(save) currentCourseData.push({type:type, x:pos.x, y:pos.y, z:pos.z});
}

// ★消しゴムのクリック判定を修正しました
window.addEventListener('mousedown', e => {
    if (e.button!==0 || e.target!==renderer.domElement || currentMode!=='editor') return;
    mouse.set((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([floor, ...meshList]);
    if (intersects.length>0) {
        if (currentBlockType === 'eraser') {
            const clickedMesh = intersects[0].object;
            if (clickedMesh !== floor) removeBlockMesh(clickedMesh); // ブロックを直接削除
        } else {
            const p = new THREE.Vector3().copy(intersects[0].point).add(intersects[0].face.normal.clone().multiplyScalar(0.5));
            p.set(Math.round(p.x), Math.floor(p.y)+0.5, Math.round(p.z));
            placeBlock(currentBlockType, p);
        }
    }
});

// --- 操作と物理 ---
const keys = { w:false, s:false, a:false, d:false, space:false };
window.addEventListener('keydown', e => { let k=e.key.toLowerCase(); if(k==='w'||k==='s'||k==='a'||k==='d'||k==='arrowup'||k==='arrowdown'||k==='arrowleft'||k==='arrowright') keys[k.replace('arrow','')]=true; if(e.code==='Space') keys.space=true; });
window.addEventListener('keyup', e => { let k=e.key.toLowerCase(); if(k==='w'||k==='s'||k==='a'||k==='d'||k==='arrowup'||k==='arrowdown'||k==='arrowleft'||k==='arrowright') keys[k.replace('arrow','')]=false; if(e.code==='Space') keys.space=false; });

const addTouch = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e=>{ e.preventDefault(); keys[key]=true; });
    el.addEventListener('touchend', e=>{ e.preventDefault(); keys[key]=false; });
};
addTouch('dpad-up','up'); addTouch('dpad-down','down'); addTouch('dpad-left','left'); addTouch('dpad-right','right'); addTouch('mobile-jump','space');

let velocityY=0, isGrounded=false;
function resetPlayerPosition() {
    player.position.set(customStart?customStart.position.x:0, customStart?customStart.position.y+1.0:1.0, customStart?customStart.position.z:0);
    velocityY=0; 
    document.getElementById('clear-message').classList.add('hidden');
}

function checkWall() {
    for (let b of solidBlocks) {
        if (Math.abs(player.position.x - b.position.x)<0.8 && Math.abs(player.position.z - b.position.z)<0.8 && player.position.y - b.position.y > -0.5 && player.position.y - b.position.y < 0.8) return true;
    } return false;
}

function updatePhysics() {
    velocityY -= 0.01; player.position.y += velocityY; isGrounded = false; let onType = null;
    if (floor.visible && player.position.y<=0.4) { player.position.y=0.4; velocityY=0; isGrounded=true; }
    for (let b of solidBlocks) {
        if (Math.abs(player.position.x-b.position.x)<0.75 && Math.abs(player.position.z-b.position.z)<0.75 && player.position.y-b.position.y>0 && player.position.y-b.position.y<1.0 && velocityY<=0) {
            player.position.y = b.position.y+0.9; velocityY=0; isGrounded=true; onType=b.userData.type;
        }
    }
    
    if(onType==='conveyor') { player.position.z-=0.05; if(checkWall()) player.position.z+=0.05; }
    if(onType==='jump') { velocityY=0.4; isGrounded=false; }
    else if(keys.space && isGrounded) { velocityY=0.22; keys.space=false; }
    
    if (player.position.y < -10 || isNaN(player.position.x) || isNaN(player.position.y) || isNaN(player.position.z)) { 
        resetPlayerPosition(); 
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (currentMode==='game' || currentMode==='test') {
        let ix=0, iz=0;
        if(keys.up||keys.w) iz-=1; if(keys.down||keys.s) iz+=1; if(keys.left||keys.a) ix-=1; if(keys.right||keys.d) ix+=1;
        if(ix!==0 || iz!==0) {
            let l=Math.sqrt(ix*ix+iz*iz); ix/=l; iz/=l;
            let dx=(ix*Math.cos(camTheta)+iz*Math.sin(camTheta))*0.1, dz=(-ix*Math.sin(camTheta)+iz*Math.cos(camTheta))*0.1;
            player.position.x+=dx; if(checkWall()) player.position.x-=dx;
            player.position.z+=dz; if(checkWall()) player.position.z-=dz;
        }
        updatePhysics();
        
        if (customGoal && player.position.distanceTo(customGoal.position)<1.2) {
            document.getElementById('clear-message').classList.remove('hidden');
            if (currentMode==='test') {
                document.getElementById('btn-save-local').classList.remove('hidden');
                document.getElementById('btn-publish').classList.remove('hidden');
                document.getElementById('btn-back-home').classList.add('hidden');
            } else {
                document.getElementById('btn-save-local').classList.add('hidden');
                document.getElementById('btn-publish').classList.add('hidden');
                document.getElementById('btn-back-home').classList.remove('hidden');
                if (viewingCourseKey) database.ref(`worldCourses/${viewingCourseKey}/clears`).transaction(c => (c||0)+1); 
            }
        }
        for (let b of customDeathBlocks) {
            if(Math.abs(player.position.x-b.position.x)<0.8 && Math.abs(player.position.z-b.position.z)<0.8 && Math.abs(player.position.y-b.position.y)<1.0) { resetPlayerPosition(); break; }
        }
    }
    updateCam(); renderer.render(scene, camera);
}
showScreen('login-screen'); animate();