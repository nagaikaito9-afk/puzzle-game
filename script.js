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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
// -------------------------------------------------------------------

let currentMode = 'home';
let bgmVol = 0.5;
let seVol = 0.5;
let currentBlockType = 'normal'; 
let currentSpeed = 0.1; // プレイヤーの移動速度

window.addEventListener('contextmenu', e => e.preventDefault());

let myCourses = JSON.parse(localStorage.getItem('myCourses')) || [];
let worldCourses = [];

database.ref('worldCourses').on('value', (snapshot) => {
    worldCourses = [];
    const data = snapshot.val();
    if (data) {
        Object.keys(data).forEach(key => worldCourses.push(data[key]));
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

    targetCourses.forEach((course) => {
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
    courseData.forEach(block => placeBlock(block.type, new THREE.Vector3(block.x, block.y, block.z), false));
    resetPlayerPosition();
}

function publishCourse() {
    const courseName = prompt("コースの名前を入力してください", "マイコース");
    if (courseName) {
        myCourses.push({ name: courseName, data: currentCourseData });
        localStorage.setItem('myCourses', JSON.stringify(myCourses));
        
        database.ref('worldCourses').push({ name: courseName, data: currentCourseData }).then(() => {
            alert("世界に公開しました！");
            showScreen('home-screen');
        });
    }
}

function selectBlock(type) { currentBlockType = type; }

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
let customKeys = [];
let customDoors = [];
let customGoal = null;            
let customStart = null;
let placedPositions = new Set(); 
let meshList = []; 
let hasKey = false; // 鍵を持っているか

function clearScene() {
    meshList.forEach(mesh => scene.remove(mesh));
    solidBlocks = [];
    customDeathBlocks = [];
    customKeys = [];
    customDoors = [];
    customGoal = null;
    customStart = null;
    placedPositions.clear();
    meshList = [];
    hasKey = false;
}

function removeOldSpecialBlock(type) {
    let targetMesh = (type === 'goal') ? customGoal : customStart;
    if (!targetMesh) return;
    scene.remove(targetMesh);
    solidBlocks = solidBlocks.filter(b => b !== targetMesh);
    meshList = meshList.filter(b => b !== targetMesh);
    placedPositions.delete(`${targetMesh.position.x},${targetMesh.position.y},${targetMesh.position.z}`);
    currentCourseData = currentCourseData.filter(d => !(d.x === targetMesh.position.x && d.y === targetMesh.position.y && d.z === targetMesh.position.z));
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
    let isSolid = true;

    // 新規ブロックの設定
    if (type === 'normal') blockMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); 
    else if (type === 'wood') blockMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); 
    else if (type === 'brick') blockMat = new THREE.MeshLambertMaterial({ color: 0xB22222 }); 
    else if (type === 'glass') blockMat = new THREE.MeshLambertMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.6 }); 
    else if (type === 'fake') { blockMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); isSolid = false; } // すり抜け
    else if (type === 'jump') blockMat = new THREE.MeshLambertMaterial({ color: 0xadff2f }); 
    else if (type === 'conveyor') blockMat = new THREE.MeshLambertMaterial({ color: 0x800080 }); 
    else if (type === 'speed') blockMat = new THREE.MeshLambertMaterial({ color: 0x0000ff }); 
    else if (type === 'slow') blockMat = new THREE.MeshLambertMaterial({ color: 0x006400 }); 
    else if (type === 'death') blockMat = new THREE.MeshLambertMaterial({ color: 0xff0000 }); 
    else if (type === 'key') { blockMat = new THREE.MeshLambertMaterial({ color: 0xffd700 }); isSolid = false; }
    else if (type === 'door') blockMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); 
    else if (type === 'goal') blockMat = new THREE.MeshLambertMaterial({ color: 0xffff00 }); 
    else if (type === 'start') blockMat = new THREE.MeshLambertMaterial({ color: 0xffa500 }); 

    const mesh = new THREE.Mesh(blockGeo, blockMat);
    mesh.position.copy(pos);
    mesh.userData = { type: type, collected: false, opened: false };
    scene.add(mesh);
    meshList.push(mesh); // エディタ用に全ブロックを記録
    placedPositions.add(posKey); 
    
    if (isSolid) solidBlocks.push(mesh);
    
    if (type === 'death') customDeathBlocks.push(mesh);
    else if (type === 'key') customKeys.push(mesh);
    else if (type === 'door') customDoors.push(mesh);
    else if (type === 'goal') customGoal = mesh;
    else if (type === 'start') customStart = mesh;

    if (saveToData) currentCourseData.push({ type: type, x: pos.x, y: pos.y, z: pos.z });
}

window.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || event.target !== renderer.domElement || currentMode !== 'editor') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    // 床と全ブロック（すり抜け含む）の上に設置可能にする
    const intersects = raycaster.intersectObjects([floor, ...meshList]);

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
    hasKey = false;
    document.getElementById('key-status').innerText = "";
    document.getElementById('clear-message').classList.add('hidden');
    document.getElementById('publish-btn').classList.add('hidden');

    // 取得したカギや壊したドアを復活させる
    customKeys.forEach(k => { k.visible = true; k.userData.collected = false; });
    customDoors.forEach(d => { d.visible = true; d.userData.opened = false; });
}

function checkWallCollision() {
    for (let b of solidBlocks) {
        if (b.userData.opened) continue; // 開いたドアは無視

        let diffX = Math.abs(player.position.x - b.position.x);
        let diffZ = Math.abs(player.position.z - b.position.z);
        let diffY = player.position.y - b.position.y;
        
        if (diffX < 0.8 && diffZ < 0.8 && diffY > -0.5 && diffY < 0.8) {
            // カギを持っていてドアにぶつかったら開ける！
            if (b.userData.type === 'door' && hasKey) {
                b.visible = false;
                b.userData.opened = true;
                hasKey = false; // カギを消費
                document.getElementById('key-status').innerText = "";
                continue;
            }
            return true;
        }
    }
    return false;
}

function moveWithCollision(dx, dz) {
    player.position.x += dx;
    if (checkWallCollision()) player.position.x -= dx; 

    player.position.z += dz;
    if (checkWallCollision()) player.position.z -= dz; 
}

function updatePhysics() {
    velocityY -= 0.01; 
    player.position.y += velocityY;
    isGrounded = false;
    let standingOn = null;

    if (floor.visible && player.position.y <= 0.4) {
        player.position.y = 0.4;
        velocityY = 0;
        isGrounded = true;
    }

    for (let b of solidBlocks) {
        if (b.userData.opened) continue;

        let diffX = Math.abs(player.position.x - b.position.x);
        let diffZ = Math.abs(player.position.z - b.position.z);
        let diffY = player.position.y - b.position.y;

        if (diffX < 0.75 && diffZ < 0.75) {
            if (diffY > 0 && diffY < 1.0 && velocityY <= 0) {
                player.position.y = b.position.y + 0.9; 
                velocityY = 0;
                isGrounded = true;
                standingOn = b.userData.type; // 何の上に立っているか記録
            }
        }
    }

    // --- ギミックブロックの効果 ---
    currentSpeed = 0.1; // 基本スピード
    if (standingOn === 'speed') currentSpeed = 0.2;
    if (standingOn === 'slow') currentSpeed = 0.05;
    
    if (standingOn === 'conveyor') {
        player.position.z -= 0.05; // 奥に向かって流される
        if (checkWallCollision()) player.position.z += 0.05;
    }

    if (standingOn === 'jump') {
        velocityY = 0.4; // 大ジャンプ！
        isGrounded = false;
    } else if (keys.Space && isGrounded) {
        velocityY = 0.22;
        keys.Space = false; 
    }

    if (player.position.y < -5) {
        alert("落ちてしまった！");
        resetPlayerPosition();
    }
}

function checkGameEvents() {
    // ゴール
    if (customGoal && player.position.distanceTo(customGoal.position) < 1.2) {
        document.getElementById('clear-message').classList.remove('hidden');
        if (currentMode === 'test') document.getElementById('publish-btn').classList.remove('hidden');
    }
    
    // 即死ブロック
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

    // カギの取得
    for (let k of customKeys) {
        if (!k.userData.collected && player.position.distanceTo(k.position) < 1.0) {
            k.userData.collected = true;
            k.visible = false;
            hasKey = true;
            document.getElementById('key-status').innerText = "🔑 カギを持っています！";
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (currentMode === 'play' || currentMode === 'test') {
        // --- ★カメラの向きに合わせたWASD移動 ---
        let inputX = 0;
        let inputZ = 0;

        if (keys.ArrowUp || keys.KeyW) inputZ -= 1;
        if (keys.ArrowDown || keys.KeyS) inputZ += 1;
        if (keys.ArrowLeft || keys.KeyA) inputX -= 1;
        if (keys.ArrowRight || keys.KeyD) inputX += 1;

        let dx = 0;
        let dz = 0;

        if (inputX !== 0 || inputZ !== 0) {
            // 斜め移動が速くならないように補正
            let len = Math.sqrt(inputX * inputX + inputZ * inputZ);
            inputX /= len;
            inputZ /= len;

            // カメラの角度(camTheta)を使って移動方向を計算
            dx = (inputX * Math.cos(camTheta) + inputZ * Math.sin(camTheta)) * currentSpeed;
            dz = (-inputX * Math.sin(camTheta) + inputZ * Math.cos(camTheta)) * currentSpeed;
        }

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