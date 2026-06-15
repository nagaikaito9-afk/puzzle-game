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
    if (localStorage.getItem('hasAccountCreated')) return alert("この端末では既にアカウントを作成済みです（制限）");
    const id = document.getElementById('reg-id').value;
    const pass = document.getElementById('reg-pass').value;
    if (!id || !pass) return alert("入力してください");

    database.ref('users/' + id).once('value', snapshot => {
        if (snapshot.exists()) return alert("その名前はすでに使われています");
        database.ref('users/' + id).set({ password: pass, friends: [] }).then(() => {
            localStorage.setItem('hasAccountCreated', 'true');
            currentUser = id;
            document.getElementById('player-name-display').innerText = currentUser;
            alert("作成しました！");
            showScreen('home-screen');
        });
    });
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
        if (!snapshot.exists()) {
            container.innerHTML = '<p style="text-align:center;">フレンドがいません</p>';
            return;
        }
        snapshot.forEach(child => {
            const friendId = child.key;
            const btn = document.createElement('button');
            btn.innerText = `👤 ${friendId} のコースを見る`;
            btn.onclick = () => showCourseList('friend', null, friendId);
            container.appendChild(btn);
        });
    });
}

// --- コース一覧・ソート・詳細画面 ---
let viewingCourseKey = null;
let viewingCourseData = null;
let backScreenFromList = 'play-select-screen';

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    document.getElementById('canvas-container').style.display = (screenId === 'editor-screen' || screenId === 'game-screen') ? 'block' : 'none';
    currentMode = screenId.replace('-screen', '');
}

function toggleMobileMode() {
    isMobileMode = document.getElementById('mobile-mode-check').checked;
}

function goBackFromList() {
    showScreen(backScreenFromList);
}

function showCourseList(type, sortOrder, friendId = null) {
    showScreen('course-list-screen');
    backScreenFromList = (type === 'friend') ? 'friends-screen' : 'play-select-screen';
    
    const container = document.getElementById('course-list-container');
    const title = document.getElementById('course-list-title');
    container.innerHTML = '読み込み中...';

    const renderList = (courses) => {
        container.innerHTML = '';
        if (courses.length === 0) {
            container.innerHTML = '<p style="text-align:center;">公開されているコースがありません</p>';
            return;
        }
        courses.forEach(course => {
            const btn = document.createElement('button');
            btn.innerText = `${course.name} (❤️${course.likes || 0})`;
            btn.onclick = () => showCourseDetail(course);
            container.appendChild(btn);
        });
    };
    
    if (type === 'world') {
        title.innerText = sortOrder === 'popular' ? "世界のコース (人気順)" : "世界のコース (新着順)";
        database.ref('worldCourses').once('value', snapshot => {
            let courses = [];
            snapshot.forEach(child => { courses.push({ key: child.key, ...child.val() }); });
            if (sortOrder === 'popular') courses.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            else courses.reverse(); 
            renderList(courses);
        });
    } else if (type === 'my') {
        title.innerText = "自分のコース";
        database.ref('worldCourses').orderByChild('author').equalTo(currentUser).once('value', snapshot => {
            let courses = [];
            snapshot.forEach(child => { courses.push({ key: child.key, ...child.val() }); });
            courses.reverse();
            renderList(courses);
        });
    } else if (type === 'friend') {
        title.innerText = `${friendId} のコース`;
        database.ref('worldCourses').orderByChild('author').equalTo(friendId).once('value', snapshot => {
            let courses = [];
            snapshot.forEach(child => { courses.push({ key: child.key, ...child.val() }); });
            courses.reverse();
            renderList(courses);
        });
    }
}

function showCourseDetail(course) {
    viewingCourseKey = course.key;
    viewingCourseData = course.data;
    document.getElementById('detail-title').innerText = course.name;
    document.getElementById('detail-author').innerText = course.author || "名無し";
    document.getElementById('detail-likes').innerText = course.likes || 0;
    document.getElementById('detail-plays').innerText = course.plays || 0;
    
    let plays = course.plays || 0;
    let clears = course.clears || 0;
    document.getElementById('detail-clear-rate').innerText = plays > 0 ? Math.floor((clears/plays)*100) : 0;

    const cSec = document.getElementById('comment-section');
    cSec.innerHTML = '';
    if (course.comments) {
        Object.values(course.comments).forEach(c => {
            cSec.innerHTML += `<div class="comment"><b>${c.user}</b>: ${c.text}</div>`;
        });
    }
    showScreen('course-detail-screen');
}

function likeCourse() {
    if (!viewingCourseKey) return;
    database.ref(`worldCourses/${viewingCourseKey}/likes`).transaction(likes => (likes || 0) + 1);
    alert("いいねしました！");
}

function postComment() {
    const text = document.getElementById('comment-select').value;
    database.ref(`worldCourses/${viewingCourseKey}/comments`).push({ user: currentUser, text: text });
    alert("送信しました！");
    showScreen('course-list-screen'); 
}

function startPlayFromDetail() {
    database.ref(`worldCourses/${viewingCourseKey}/plays`).transaction(p => (p || 0) + 1);
    loadAndPlayCourse(viewingCourseData, false);
}

// --- エディタとゲーム処理 ---
let currentCourseData = [];

function startEditor() {
    showScreen('editor-screen');
    floor.visible = true;
    clearScene(); currentCourseData = []; resetPlayerPosition();
}

function testPlay() {
    showScreen('game-screen');
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

function publishCourse() {
    const name = prompt("コース名を入力", "マイコース");
    if (name) {
        database.ref('worldCourses').push({
            name: name, author: currentUser, data: currentCourseData,
            likes: 0, plays: 0, clears: 0
        }).then(() => { alert("公開しました！"); showScreen('home-screen'); });
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

// --- カメラ操作 (ドラッグ) ---
let isDragging = false, camTheta = 0, camPhi = 1.0, camRadius = 12, prevX = 0, prevY = 0;
function updateCam() {
    camera.position.set(player.position.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta),
                        player.position.y + camRadius * Math.cos(camPhi),
                        player.position.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta));
    camera.lookAt(player.position);
}
window.addEventListener('mousedown', e => { if(e.button===2 || isMobileMode) { isDragging=true; prevX=e.clientX||e.touches?.[0].clientX; prevY=e.clientY||e.touches?.[0].clientY; }});
window.addEventListener('mousemove', e => {
    if(isDragging) {
        let x = e.clientX||e.touches?.[0].clientX; let y = e.clientY||e.touches?.[0].clientY;
        camTheta -= (x - prevX)*0.01; camPhi -= (y - prevY)*0.01;
        if(camPhi<0.1) camPhi=0.1; if(camPhi>Math.PI/2.1) camPhi=Math.PI/2.1;
        prevX=x; prevY=y;
    }
});
window.addEventListener('mouseup', () => isDragging=false);

// スマホ用タッチ視点移動対応
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

const materials = {
    'normal': 0x888888, 'wood': 0x8B4513, 'glass': 0xadd8e6,
    'color-red': 0xff5555, 'color-blue': 0x5555ff, 'color-green': 0x55ff55, 'color-pink': 0xff88ff,
    'jump': 0xadff2f, 'conveyor': 0x800080, 'death': 0xff0000, 'goal': 0xffff00, 'start': 0xffa500
};

const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
function placeBlock(type, pos, save=true) {
    if (placed.has(`${pos.x},${pos.y},${pos.z}`)) return;
    if (type==='goal' && customGoal){ scene.remove(customGoal); customGoal=null; }
    if (type==='start' && customStart){ scene.remove(customStart); customStart=null; }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshLambertMaterial({color: materials[type], transparent: type==='glass', opacity: 0.6}));
    mesh.position.copy(pos); mesh.userData = {type: type}; scene.add(mesh); meshList.push(mesh);
    placed.add(`${pos.x},${pos.y},${pos.z}`);
    solidBlocks.push(mesh);
    if(type==='death') customDeathBlocks.push(mesh); else if(type==='goal') customGoal=mesh; else if(type==='start') customStart=mesh;
    if(save) currentCourseData.push({type:type, x:pos.x, y:pos.y, z:pos.z});
}

window.addEventListener('mousedown', e => {
    if (e.button!==0 || e.target!==renderer.domElement || currentMode!=='editor') return;
    mouse.set((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([floor, ...meshList]);
    if (intersects.length>0) {
        const p = new THREE.Vector3().copy(intersects[0].point).add(intersects[0].face.normal.clone().multiplyScalar(0.5));
        p.set(Math.round(p.x), Math.floor(p.y)+0.5, Math.round(p.z));
        placeBlock(currentBlockType, p);
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
    player.position.set(customStart?customStart.position.x:0, customStart?customStart.position.y+1:1, customStart?customStart.position.z:0);
    velocityY=0; document.getElementById('clear-message').classList.add('hidden');
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
    if (player.position.y < -5) { alert("落下した！"); resetPlayerPosition(); }
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
            if (currentMode==='test') document.getElementById('publish-btn').classList.remove('hidden');
            else if (viewingCourseKey && currentMode==='game') database.ref(`worldCourses/${viewingCourseKey}/clears`).transaction(c => (c||0)+1); 
        }
        for (let b of customDeathBlocks) {
            if(Math.abs(player.position.x-b.position.x)<0.8 && Math.abs(player.position.z-b.position.z)<0.8 && Math.abs(player.position.y-b.position.y)<1.0) { alert("死んだ！"); resetPlayerPosition(); break; }
        }
    }
    updateCam(); renderer.render(scene, camera);
}
showScreen('login-screen'); animate();