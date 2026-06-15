// --- ★【超重要】ここに自分のFirebaseの設定を貼り付けてください！ ---
const firebaseConfig = {
  apiKey: "AIzaSyC4PbfPRoIMdz2K7mYW_s7pjr7K7rmSxQU",
  authDomain: "my-3d-game-83ac7.firebaseapp.com",
  projectId: "my-3d-game-83ac7",
  storageBucket: "my-3d-game-83ac7.firebasestorage.app",
  messagingSenderId: "481443120933",
  appId: "1:481443120933:web:54f499ce24fd4c683e3ccc"
};
// Firebaseの初期化
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
// -------------------------------------------------------------------

let currentMode = 'home';
let bgmVol = 0.5;
let seVol = 0.5;
let currentBlockType = 'normal'; 

window.addEventListener('contextmenu', e => e.preventDefault());

let myCourses = JSON.parse(localStorage.getItem('myCourses')) || [];

// ★世界のコースはデータベースから自動取得するため最初は空にします
let worldCourses = [];

// ★クラウド上のデータベースから世界のコースを自動で読み込む（追加されたらリアルタイムに更新されます）
database.ref('worldCourses').on('value', (snapshot) => {
    worldCourses = [];
    const data = snapshot.val();
    if (data) {
        Object.keys(data).forEach(key => {
            worldCourses.push(data[key]);
        });
    }
});

let currentCourseData = []; 

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    
    if (['home-screen', 'settings-screen', 'play-select-screen', 'course-list-screen'].includes(screenId)) {
        document.getElementById('canvas-container').style.display = 'none';
        currentMode = 'menu';
    } else {
        document.getElementById('canvas-container').style.display = 'block';
    }
}

function updateVolume() {
    bgmVol = document.getElementById('bgm-volume').value / 100;
    seVol = document.getElementById('se-volume').value / 100;
    document.getElementById('bgm-val').innerText = document.getElementById('bgm-volume').value;
    document.getElementById('se-val').innerText = document.getElementById('se-volume').value;
}

function showCourseList(type) {
    showScreen('course-list-screen');
    const container = document.getElementById('course-list-container');
    const title = document.getElementById('course-list-title');
    container.innerHTML = ''; 

    let targetCourses = type === 'world' ? worldCourses : myCourses;
    title.innerText = type === 'world' ? "世界のコース" : "自分のコース";

    if (targetCourses.length === 0) {
        container.innerHTML = '<p style="text-align:center;">コースがありません</p>';
        return;
    }

    targetCourses.forEach((course, index) => {
        const btn = document.createElement('button');
        btn.innerText = course.name;
        btn.onclick = () => loadAndPlayCourse(course.data);
        container.appendChild(btn);
    });
}

function startEditor() {
    showScreen('editor-screen');
    currentMode = 'editor';
    floor.visible = true;
    clearScene(); 
    currentCourseData = [];
    resetPlayerPosition();
}

function testPlay() {
    alert("クリアチェックを開始します！");
    showScreen('game-screen');
    currentMode = 'test';
    floor.visible = false;
    resetPlayerPosition();
}

function loadAndPlayCourse(courseData) {
    showScreen('game-screen');
    currentMode = 'play';
    floor.visible = false;
    clearScene();
    
    courseData.forEach(block => {
        placeBlock(block.type, new THREE.Vector3(block.x, block.y, block.z), false);
    });
    
    resetPlayerPosition();
}

// ★修正: 世界のデータベースに自動保存する仕組みに変更しました
function publishCourse() {
    const courseName = prompt("コースの名前を入力してください", "マイコース");
    if (courseName) {
        // 1. 自分のブラウザ(ローカル)にも保存
        myCourses.push({ name: courseName, data: currentCourseData });
        localStorage.setItem('myCourses', JSON.stringify(myCourses));
        
        // 2. クラウドデータベースに自動送信して世界に公開！
        database.ref('worldCourses').push({
            name: courseName,
            data: currentCourseData
        }).then(() => {
            alert("世界に公開しました！他の人の「世界のコースをプレイ」のリストにもリアルタイムで追加されます。");
            showScreen('home-screen');
        }).catch((error) => {
            alert("公開に失敗しました。Firebaseの設定やセキュリティルールを確認してください。\nエラー: " + error.message);
        });
    }
}

function selectBlock(type) {
    currentBlockType = type;
}

// --- Three.js 3Dゲーム基礎 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x606060));

const playerGeo = new THREE.SphereGeometry(0.4, 32, 32); 
const playerMat = new THREE.MeshLambertMaterial({ color: 0x0000ff });
const player = new THREE.Mesh(playerGeo, playerMat);
scene.add(player);

const floorGeo = new THREE.PlaneGeometry(30, 30);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// --- カメラ操作 ---
let isRightDragging = false;
let camTheta = 0;
let camPhi = 1.0;
let camRadius = 12;
let prevMouseX = 0;
let prevMouseY = 0;

function updateCameraPosition() {
    camera.position.x = player.position.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta);
    camera.position.y = player.position.y + camRadius * Math.cos(camPhi);
    camera.position.z = player.position.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta);
    camera.lookAt(player.position);
}

window.addEventListener('mousedown', (e) => {
    if (e.target !== renderer.domElement) return;
    if (e.button === 2) {
        isRightDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
    }
});
window.addEventListener('mousemove', (e) => {
    if (isRightDragging) {
        camTheta -= (e.clientX - prevMouseX) * 0.01;
        camPhi -= (e.clientY - prevMouseY) * 0.01;
        if (camPhi < 0.1) camPhi = 0.1;
        if (camPhi > Math.PI / 2.1) camPhi = Math.PI / 2.1;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
    }
});
window.addEventListener('mouseup', (e) => { if (e.button === 2) isRightDragging = false; });


// --- ブロック管理・エディタ機能 ---
let solidBlocks = []; 
let customDeathBlocks = [];     
let customGoal = null;            
let customStart = null;
let placedPositions = new Set(); 
let meshList = []; 

function clearScene() {
    meshList.forEach(mesh => scene.remove(mesh));
    solidBlocks = [];
    customDeathBlocks = [];
    customGoal = null;
    customStart = null;
    placedPositions.clear();
    meshList = [];
}

function removeOldSpecialBlock(type) {
    let targetMesh = (type === 'goal') ? customGoal : customStart;
    if (!targetMesh) return;

    scene.remove(targetMesh);
    solidBlocks = solidBlocks.filter(b => b !== targetMesh);
    meshList = meshList.filter(b => b !== targetMesh);
    
    const posKey = `${targetMesh.position.x},${targetMesh.position.y},${targetMesh.position.z}`;
    placedPositions.delete(posKey);
    
    currentCourseData = currentCourseData.filter(d => 
        !(d.x === targetMesh.position.x && d.y === targetMesh.position.y && d.z === targetMesh.position.z)
    );
    
    if (type === 'goal') customGoal = null;
    if (type === 'start') customStart = null;
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function placeBlock(type, pos, saveToData = true) {
    const posKey = `${pos.x},${pos.y},${pos.z}`;
    if (placedPositions.has(posKey)) return;

    if (type === 'goal') removeOldSpecialBlock('goal');
    if (type === 'start') removeOldSpecialBlock('start');

    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    let blockMat;

    if (type === 'normal') blockMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); 
    else if (type === 'wood') blockMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); 
    else if (type === 'brick') blockMat = new THREE.MeshLambertMaterial({ color: 0xB22222 }); 
    else if (type === 'glass') blockMat = new THREE.MeshLambertMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.6 }); 
    else if (type === 'death') blockMat = new THREE.MeshLambertMaterial({ color: 0xff0000 }); 
    else if (type === 'goal') blockMat = new THREE.MeshLambertMaterial({ color: 0xffff00 }); 
    else if (type === 'start') blockMat = new THREE.MeshLambertMaterial({ color: 0xffa500 }); 

    const mesh = new THREE.Mesh(blockGeo, blockMat);
    mesh.position.copy(pos);
    scene.add(mesh);
    meshList.push(mesh);
    
    solidBlocks.push(mesh);
    placedPositions.add(posKey); 
    
    if (type === 'death') customDeathBlocks.push(mesh);
    else if (type === 'goal') customGoal = mesh;
    else if (type === 'start') customStart = mesh;

    if (saveToData) {
        currentCourseData.push({ type: type, x: pos.x, y: pos.y, z: pos.z });
    }
}

window.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || event.target !== renderer.domElement || currentMode !== 'editor') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([floor, ...solidBlocks]);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const pos = new THREE.Vector3().copy(intersect.point).add(intersect.face.normal.clone().multiplyScalar(0.5));
        pos.x = Math.round(pos.x);
        pos.y = Math.floor(pos.y) + 0.5;
        pos.z = Math.round(pos.z);

        placeBlock(currentBlockType, pos, true);
    }
});

// --- 物理エンジン（重力・衝突・移動） ---
const keys = { 
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    KeyW: false, KeyS: false, KeyA: false, KeyD: false, Space: false
};
window.addEventListener('keydown', (e) => { if(keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.code)) keys[e.code] = false; });

let velocityY = 0;
let isGrounded = false;

function resetPlayerPosition() {
    if (customStart) {
        player.position.set(customStart.position.x, customStart.position.y + 1.0, customStart.position.z);
    } else {
        player.position.set(0, 1.0, 0); 
    }
    velocityY = 0;
    document.getElementById('clear-message').classList.add('hidden');
    document.getElementById('publish-btn').classList.add('hidden');
}

function moveWithCollision(dx, dz) {
    player.position.x += dx;
    if (checkWallCollision()) player.position.x -= dx; 

    player.position.z += dz;
    if (checkWallCollision()) player.position.z -= dz; 
}

function checkWallCollision() {
    for (let b of solidBlocks) {
        let diffX = Math.abs(player.position.x - b.position.x);
        let diffZ = Math.abs(player.position.z - b.position.z);
        let diffY = player.position.y - b.position.y;
        
        if (diffX < 0.8 && diffZ < 0.8 && diffY > -0.5 && diffY < 0.8) {
            return true;
        }
    }
    return false;
}

function updatePhysics() {
    velocityY -= 0.01; 
    player.position.y += velocityY;
    isGrounded = false;

    if (floor.visible && player.position.y <= 0.4) {
        player.position.y = 0.4;
        velocityY = 0;
        isGrounded = true;
    }

    for (let b of solidBlocks) {
        let diffX = Math.abs(player.position.x - b.position.x);
        let diffZ = Math.abs(player.position.z - b.position.z);
        let diffY = player.position.y - b.position.y;

        if (diffX < 0.75 && diffZ < 0.75) {
            if (diffY > 0 && diffY < 1.0 && velocityY <= 0) {
                player.position.y = b.position.y + 0.9; 
                velocityY = 0;
                isGrounded = true;
            }
        }
    }

    if (keys.Space && isGrounded) {
        velocityY = 0.22;
        keys.Space = false; 
    }

    if (player.position.y < -5) {
        alert("落ちてしまった！");
        resetPlayerPosition();
    }
}

function checkGameEvents() {
    if (customGoal && player.position.distanceTo(customGoal.position) < 1.2) {
        document.getElementById('clear-message').classList.remove('hidden');
        if (currentMode === 'test') {
            document.getElementById('publish-btn').classList.remove('hidden');
        }
    }
    
    for (let i = 0; i < customDeathBlocks.length; i++) {
        let diffX = Math.abs(player.position.x - customDeathBlocks[i].position.x);
        let diffZ = Math.abs(player.position.z - customDeathBlocks[i].position.z);
        let diffY = Math.abs(player.position.y - customDeathBlocks[i].position.y);
        
        if (diffX < 0.8 && diffZ < 0.8 && diffY < 1.0) {
            alert("死んでしまった！");
            resetPlayerPosition();
            break; 
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (currentMode === 'play' || currentMode === 'test') {
        const speed = 0.1;
        let dx = 0;
        let dz = 0;

        if (keys.ArrowUp || keys.KeyW) dz -= speed;
        if (keys.ArrowDown || keys.KeyS) dz += speed;
        if (keys.ArrowLeft || keys.KeyA) dx -= speed;
        if (keys.ArrowRight || keys.KeyD) dx += speed;

        moveWithCollision(dx, dz); 
        updatePhysics();           
        checkGameEvents();         
    }

    updateCameraPosition(); 

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

showScreen('home-screen');
animate();