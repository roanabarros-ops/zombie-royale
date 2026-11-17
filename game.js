import * as THREE from 'three';
import { movementDelta, consumeRound, refillMagazine, waveSize, applyDamage, chooseChestLoot } from './logic.js';

const $ = (id) => document.getElementById(id);
const root = $('game-root');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9db4a7');
scene.fog = new THREE.FogExp2('#9db4a7', 0.0085);
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 170);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
root.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const aimNdc = new THREE.Vector2(0, 0);
const keys = new Set();
const obstacles = [];
const zombies = [];
const chests = [];
const effects = [];
const shared = {};
let state = 'menu';
let elapsed = 0;
let wave = 1;
let score = 0;
let kills = 0;
let health = 100;
let medkits = 0;
let yaw = 0;
let pitch = 0.11;
let firing = false;
let isAiming = false;
let nextShotAt = 0;
let reloadEndsAt = 0;
let waveSpawnLeft = 0;
let spawnTimer = 0;
let intermission = 0;
let lastPromptChest = null;
let muted = false;
let audio = null;
let lastSurvivalScore = 0;
let hitMarkerTimer = 0;
let hudAccumulator = 0;

const player = { position: new THREE.Vector3(0, 0, 7), velocity: new THREE.Vector3(), group: null, weaponGroup: null };
const cameraForward = new THREE.Vector3();
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const tempVec = new THREE.Vector3();
const rayTargets = [];

const weapons = [
  { id: 'pistol', label: 'PISTOLA', mode: 'SEMIAUTO', damage: 34, rate: 0.28, magSize: 12, mag: 12, reserve: 72, reload: 1.15, range: 50, pellets: 1, spread: 0.004, color: '#c4a16c' },
  { id: 'shotgun', label: 'ESCOPETA', mode: 'PUMP ACTION', damage: 14, rate: 0.85, magSize: 6, mag: 6, reserve: 36, reload: 1.65, range: 22, pellets: 8, spread: 0.075, color: '#82634b' },
  { id: 'rifle', label: 'RIFLE DE ASSALTO', mode: 'AUTOMÁTICO', damage: 22, rate: 0.105, magSize: 30, mag: 30, reserve: 150, reload: 1.7, range: 65, pellets: 1, spread: 0.013, color: '#71806b' },
  { id: 'sniper', label: 'SNIPER', mode: 'FERROLHO', damage: 135, rate: 1.05, magSize: 5, mag: 5, reserve: 25, reload: 2.0, range: 100, pellets: 1, spread: 0.001, color: '#9d7b55' }
];
let weaponIndex = 0;

// Palette and shared geometry keep the low-poly city light enough for laptops.
const mat = (color, roughness = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
shared.grass = mat('#657d55'); shared.grassDark = mat('#506448'); shared.road = mat('#4d5550');
shared.concrete = mat('#777d73'); shared.ruin = mat('#706d5d'); shared.glass = mat('#81968d', 0.35, { metalness: 0.2 });
shared.bark = mat('#5a4937'); shared.leaf1 = mat('#405d3d'); shared.leaf2 = mat('#527044');
shared.zSkin = mat('#96a87b'); shared.zDark = mat('#556247'); shared.zCloth = mat('#525a49');
shared.playerTop = mat('#c5a05d'); shared.playerPants = mat('#394b49'); shared.playerSkin = mat('#e0b18a');
shared.backpack = mat('#485944'); shared.weapon = mat('#292e2b', 0.55, { metalness: 0.46 }); shared.ammo = mat('#f2cf67', 0.45, { emissive: '#6b4615', emissiveIntensity: 0.25 });

buildScene();
makePlayer();
bindUi();
resize();
hideLoading();
renderer.setAnimationLoop(animate);

function buildScene() {
  scene.add(new THREE.HemisphereLight('#e1eddb', '#414c38', 2.1));
  const sun = new THREE.DirectionalLight('#fff0d3', 3.0);
  sun.position.set(-28, 42, 22); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -48; sun.shadow.camera.right = 48; sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
  sun.shadow.bias = -0.00025; scene.add(sun);
  const fill = new THREE.DirectionalLight('#9ab4bf', 0.75); fill.position.set(30, 15, -35); scene.add(fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), shared.grass);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  addRoad(0, -8, 8, 130); addRoad(0, -8, 120, 7); addRoad(-22, -24, 33, 6);
  addDistrictLabel('ABANDONED CITY', -11, -10, '#eedaa0');
  addDistrictLabel('DARKWOOD FOREST', 29, 4, '#d3ed9d');
  addDistrictLabel('EVACUATION CAMP', -20, 26, '#e6b687');

  // A compact abandoned town, with collision volumes matching the buildings.
  building(-22, -27, 12, 10, 9, '#726b5a', 'store');
  building(-7, -29, 10, 12, 13, '#7f8177', 'apartment');
  building(9, -29, 13, 10, 8, '#776c5b', 'store');
  building(25, -25, 12, 12, 11, '#666e65', 'apartment');
  building(-25, -11, 11, 10, 7, '#80765f', 'house');
  building(-8, -11, 12, 9, 10, '#777b70', 'house');
  building(11, -10, 12, 10, 8, '#6d7068', 'house');
  building(29, -9, 12, 12, 15, '#73776d', 'apartment');
  building(-24, 15, 10, 11, 8, '#746c5d', 'house');
  building(-9, 15, 14, 11, 5, '#726c5f', 'ruin');
  building(8, 18, 10, 12, 8, '#777363', 'house');

  // The evacuation camp has a watchtower, a torn tent and stacked supplies.
  addCamp();
  makeForest();
  addStreetDetails();
  makeChests();
}

function addRoad(x, z, width, depth) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), shared.road);
  road.rotation.x = -Math.PI / 2; road.position.set(x, 0.018, z); road.receiveShadow = true; scene.add(road);
  if (depth > width) {
    for (let p = z - depth / 2 + 4; p < z + depth / 2; p += 7) addBox(x, 0.035, p, 0.12, 0.025, 2.3, '#c6b77b', { cast: false });
  } else {
    for (let p = x - width / 2 + 4; p < x + width / 2; p += 7) addBox(p, 0.035, z, 2.3, 0.025, 0.12, '#c6b77b', { cast: false });
  }
}

function building(x, z, w, d, h, color, kind) {
  const bodyMat = mat(color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.set(x, h / 2, z); body.castShadow = true; body.receiveShadow = true; scene.add(body);
  const roofColor = kind === 'ruin' ? '#5a584c' : '#4e554d';
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.45, d + 0.6), mat(roofColor));
  roof.position.set(x, h + 0.15, z); roof.castShadow = true; scene.add(roof);
  obstacles.push({ x1: x - w / 2 - 0.2, x2: x + w / 2 + 0.2, z1: z - d / 2 - 0.2, z2: z + d / 2 + 0.2 });
  const floors = Math.max(1, Math.floor(h / 3.1));
  for (let floor = 0; floor < floors; floor++) {
    const y = 1.55 + floor * 3;
    for (let i = 0; i < Math.max(1, Math.floor(w / 3)); i++) {
      const wx = x - w / 2 + 1.8 + i * 3;
      if (kind === 'ruin' && (i + floor) % 2) continue;
      const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.12, 0.08), shared.glass);
      windowMesh.position.set(wx, y, z + d / 2 + 0.04); scene.add(windowMesh);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.18), mat('#4e554d'));
      sill.position.set(wx, y - 0.62, z + d / 2 + 0.08); scene.add(sill);
    }
  }
  addBox(x - w * 0.18, 1.05, z + d / 2 + 0.07, 1.4, 2.1, 0.16, '#342f28');
  if (kind === 'apartment') {
    addBox(x + w / 2 + 0.18, h * 0.55, z - d / 2 + 1, 0.35, 2.2, 1.1, '#8e7651');
    addBox(x + w / 2 + 0.18, h * 0.55 - 1.2, z - d / 2 + 1, 0.35, 0.12, 1.1, '#8e7651');
  }
  if (kind === 'ruin') {
    addBox(x + w * .3, 1, z + d * .4, 3, 2, 1.3, '#514e43');
    addBox(x - w * .2, 2.1, z - d * .1, 4, 0.35, 4, '#4c4a41');
  }
}

function addCamp() {
  const tower = new THREE.Group(); tower.position.set(-28, 0, 28); scene.add(tower);
  for (const x of [-1.8, 1.8]) for (const z of [-1.8, 1.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.2, 0.22), mat('#6f6048')); post.position.set(x, 3.1, z); post.castShadow = true; tower.add(post);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 4.6), mat('#8a7655')); deck.position.y = 4.6; tower.add(deck);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2.5, 4), mat('#4f5949')); roof.position.y = 7; roof.rotation.y = Math.PI / 4; tower.add(roof);
  addBox(-18, 0.5, 29, 5, 0.8, 4, '#75654b'); addBox(-13, 0.4, 31, 3.7, 0.65, 3.1, '#555f4b');
  obstacles.push({ x1: -21, x2: -17, z1: 27, z2: 31 });
  const tent = new THREE.Mesh(new THREE.ConeGeometry(4, 3.7, 4), mat('#a05f49')); tent.position.set(-20, 1.8, 19); tent.rotation.y = Math.PI / 4; tent.castShadow = true; scene.add(tent);
}

function makeForest() {
  let seed = 68291;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 170; i++) {
    const x = 17 + random() * 41, z = -45 + random() * 90;
    if (Math.hypot(x - 31, z - 4) < 10 || Math.abs(z + 8) < 4 || obstacles.some((o) => x > o.x1 - 2 && x < o.x2 + 2 && z > o.z1 - 2 && z < o.z2 + 2)) continue;
    const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.rotation.y = random() * Math.PI; scene.add(tree);
    const trunkH = 2.4 + random() * 2.4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, trunkH, 5), shared.bark); trunk.position.y = trunkH / 2; trunk.castShadow = true; tree.add(trunk);
    for (let layer = 0; layer < 3; layer++) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.4 + random() * 0.55, 2.4 + random() * 0.7, 6), layer % 2 ? shared.leaf1 : shared.leaf2);
      crown.position.y = trunkH * 0.53 + layer * 1.25; crown.rotation.y = random() * Math.PI; crown.castShadow = layer === 1; tree.add(crown);
    }
  }
}

function addStreetDetails() {
  for (const [x, z] of [[-16,-17],[2,-17],[18,-16],[-17,3],[19,6],[-34,-5],[35,-32]]) {
    const pole = new THREE.Group(); pole.position.set(x, 0, z); scene.add(pole);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,5,6),mat('#454a42')); stem.position.y=2.5; pole.add(stem);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5,.08,.08),mat('#454a42')); arm.position.set(.7,4.7,0); pole.add(arm);
    const bulb = new THREE.PointLight('#f4d38c', 0.5, 8); bulb.position.set(1.2,4.5,0); pole.add(bulb);
    addBox(x+0.7,4.7,z,0.5,.14,.32,'#8c886a',{emissive:'#54431f'});
  }
  for (let i = 0; i < 35; i++) {
    const x = -58 + Math.random() * 116, z = -58 + Math.random() * 116;
    if (Math.abs(z + 8) < 4 || (x > 17 && z > -35 && z < 38)) continue;
    const grass = new THREE.Mesh(new THREE.ConeGeometry(.08 + Math.random()*.12, .55 + Math.random()*.4, 3), shared.grassDark);
    grass.position.set(x,.25,z); grass.rotation.z=(Math.random()-.5)*.3; scene.add(grass);
  }
}

function addDistrictLabel(text, x, z, color) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const c = canvas.getContext('2d'); c.fillStyle = '#0d140f99'; c.fillRect(0,0,512,96);
  c.strokeStyle = '#d8e7c244'; c.lineWidth=3; c.strokeRect(4,4,504,88);
  c.fillStyle=color; c.font='800 38px Arial'; c.textAlign='center'; c.fillText(text,256,61);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(8.5,1.6),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  label.rotation.x=-Math.PI/2; label.position.set(x,.035,z); scene.add(label);
}

function addBox(x, y, z, w, h, d, color, options = {}) {
  const material = typeof color === 'string' ? mat(color, .9, options.emissive ? { emissive: options.emissive } : {}) : color;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material); mesh.position.set(x,y,z);
  mesh.castShadow = options.cast !== false; mesh.receiveShadow = true; scene.add(mesh); return mesh;
}

function makeChests() {
  [[-19,-21],[-2,-20],[15,-19],[31,-1],[-18,23],[6,27],[33,28]].forEach(([x,z], i) => {
    const group = new THREE.Group(); group.position.set(x,0,z); scene.add(group);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2,.7,.82),mat(i%2?'#8f754c':'#a1804c')); base.position.y=.38; base.castShadow=true; group.add(base);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.24,.13,.88),shared.ammo); band.position.y=.44; group.add(band);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.23,.28,.85),mat('#6c5d40')); lid.position.set(0,.82,0); lid.castShadow=true; group.add(lid);
    const glow = new THREE.PointLight('#e8cf70',1.1,4); glow.position.y=1.4; group.add(glow);
    const chest = { group, opened:false, position:group.position, index:i }; chests.push(chest);
  });
}

function makePlayer() {
  const group = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(.24,.72,4,8),shared.playerPants); legs.position.y=.64; legs.castShadow=true; group.add(legs);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.38,.62,5,10),shared.playerTop); torso.position.y=1.55; torso.castShadow=true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.27,12,10),shared.playerSkin); head.position.y=2.26; head.castShadow=true; group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.275,12,8,0,Math.PI*2,0,Math.PI*.48),mat('#342f28')); hair.position.y=2.31; group.add(hair);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(.56,.65,.26),shared.backpack); backpack.position.set(0,1.48,.43); backpack.castShadow=true; group.add(backpack);
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(.92,.26,.33),mat('#a3834d')); shoulder.position.set(0,1.83,0); group.add(shoulder);
  const weaponGroup = makeWeaponModel(); weaponGroup.position.set(.39,1.6,-.16); group.add(weaponGroup);
  player.group=group; player.weaponGroup=weaponGroup; group.position.copy(player.position); scene.add(group);
}

function makeWeaponModel() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.19,.18,.72),shared.weapon); body.castShadow=true; group.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.48,8),mat('#171b19',.48,{metalness:.65})); barrel.rotation.x=Math.PI/2; barrel.position.z=-.54; group.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.14,.34,.16),mat('#514839')); grip.position.set(0,-.22,.12); grip.rotation.x=-.22; group.add(grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(.18,.2,.32),mat('#544a37')); stock.position.z=.48; group.add(stock);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(.06,.1,.1),shared.weapon); sight.position.set(0,.13,-.1); group.add(sight);
  return group;
}

function makeZombie(position, currentWave) {
  const group = new THREE.Group(); group.position.copy(position); scene.add(group);
  const skin = shared.zSkin, cloth = currentWave % 2 ? shared.zCloth : shared.zDark;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34,.62,4,8),cloth); body.position.y=1.05; body.castShadow=true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.27,10,8),skin); head.position.y=1.76; head.castShadow=true; group.add(head);
  const eyeMat = mat('#d7e69b',.3,{emissive:'#72843d',emissiveIntensity:.5});
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(.045,6,6),eyeMat); eye1.position.set(-.09,1.79,-.235); group.add(eye1);
  const eye2 = eye1.clone(); eye2.position.x=.09; group.add(eye2);
  const armGeo = new THREE.CapsuleGeometry(.12,.53,3,6);
  const arm1 = new THREE.Mesh(armGeo,skin); arm1.position.set(-.42,1.28,-.1); arm1.rotation.z=-.82; group.add(arm1);
  const arm2 = new THREE.Mesh(armGeo,skin); arm2.position.set(.42,1.28,-.1); arm2.rotation.z=.82; group.add(arm2);
  const legGeo = new THREE.CapsuleGeometry(.14,.48,3,6);
  const leg1 = new THREE.Mesh(legGeo,cloth); leg1.position.set(-.16,.38,0); group.add(leg1);
  const leg2 = new THREE.Mesh(legGeo,cloth); leg2.position.set(.16,.38,0); group.add(leg2);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.72,8,6),new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false})); hit.position.y=1.1; hit.userData.zombie=group; group.add(hit);
  const healthBack = new THREE.Mesh(new THREE.PlaneGeometry(.8,.08),new THREE.MeshBasicMaterial({color:'#20251f',side:THREE.DoubleSide})); healthBack.position.set(0,2.24,0); group.add(healthBack);
  const healthFill = new THREE.Mesh(new THREE.PlaneGeometry(.76,.055),new THREE.MeshBasicMaterial({color:'#a9e15c',side:THREE.DoubleSide})); healthFill.position.set(0,2.24,-.01); group.add(healthFill);
  const zombie = { group, hit, hp:100 + (currentWave-1)*22, maxHp:100 + (currentWave-1)*22, speed:1.15 + Math.min(currentWave*.08,1.3), attackAt:0, phase:Math.random()*8, healthFill, arm1, arm2, leg1, leg2, alive:true };
  group.traverse((o)=>{if(o.isMesh && o!==hit && o!==healthBack && o!==healthFill)o.castShadow=true;});
  zombies.push(zombie); rayTargets.push(hit); return zombie;
}

function bindUi() {
  $('play').addEventListener('click', startGame);
  $('restart').addEventListener('click', startGame);
  $('main-menu').addEventListener('click', () => { $('defeat').hidden=true; $('menu').hidden=false; state='menu'; });
  $('resume').addEventListener('click', () => { state='playing'; requestLock(); $('pause').hidden=true; });
  $('quit').addEventListener('click', () => { $('pause').hidden=true; $('menu').hidden=false; $('hud').hidden=true; state='menu'; unlockPointer(); });
  $('sound').addEventListener('click', () => { muted=!muted; $('sound').textContent=muted?'SOM: DESLIGADO':'SOM: LIGADO'; });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e)=>keys.delete(e.code));
  renderer.domElement.addEventListener('mousedown',(e)=>{if(state==='playing'&&e.button===0)firing=true;});
  window.addEventListener('mouseup',(e)=>{if(e.button===0)firing=false;});
  renderer.domElement.addEventListener('contextmenu',(e)=>e.preventDefault());
  renderer.domElement.addEventListener('mousedown',(e)=>{if(state==='playing'&&e.button===2)isAiming=true;});
  window.addEventListener('mouseup',(e)=>{if(e.button===2)isAiming=false;});
  document.addEventListener('mousemove',(e)=>{
    if(state!=='playing'||document.pointerLockElement!==renderer.domElement)return;
    yaw-=e.movementX*.0024; pitch=THREE.MathUtils.clamp(pitch+e.movementY*.0017,-.32,.68);
  });
  renderer.domElement.addEventListener('click',()=>{if(state==='playing'&&document.pointerLockElement!==renderer.domElement)requestLock();});
  document.addEventListener('pointerlockchange',()=>{
    if(state==='playing'&&document.pointerLockElement!==renderer.domElement){state='paused';$('pause').hidden=false;firing=false;}
  });
  window.addEventListener('resize',resize);
}

function onKeyDown(e) {
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);
  if(e.repeat)return;
  if(state==='playing'){
    if(e.code==='KeyR')reload();
    if(e.code==='KeyE')openNearestChest();
    if(e.code==='KeyQ')useMedkit();
    if(e.code==='Digit1')selectWeapon(0); if(e.code==='Digit2')selectWeapon(1); if(e.code==='Digit3')selectWeapon(2); if(e.code==='Digit4')selectWeapon(3);
    if(e.code==='Escape'){state='paused';$('pause').hidden=false;unlockPointer();}
  }
}

function startGame() {
  $('menu').hidden=true; $('pause').hidden=true; $('defeat').hidden=true; $('hud').hidden=false;
  clearRun(); state='playing'; player.position.set(0,0,7); yaw=0; pitch=.11; health=100;medkits=0; score=0;kills=0;elapsed=0;wave=1;weaponIndex=0;
  weapons[0].mag=12;weapons[0].reserve=72;weapons[1].mag=6;weapons[1].reserve=36;weapons[2].mag=30;weapons[2].reserve=150;weapons[3].mag=5;weapons[3].reserve=25;
  chests.forEach((chest)=>{chest.opened=false;chest.group.visible=true;});
  startWave(); updateWeaponHud(); updateHud(); requestLock(); toast('ONDA 1 — ELES SENTIRAM SEU CHEIRO');
}

function clearRun() {
  zombies.splice(0).forEach(removeZombieObject); rayTargets.splice(0);
  effects.splice(0).forEach((effect)=>scene.remove(effect.object));
  chests.forEach((chest)=>{chest.opened=false;chest.group.visible=true;});
  reloadEndsAt=0;nextShotAt=0;lastSurvivalScore=0;intermission=0;waveSpawnLeft=0;spawnTimer=0;
}

function startWave() {
  waveSpawnLeft=waveSize(wave); spawnTimer=.8; intermission=0;
  $('wave').textContent=String(wave).padStart(2,'0');
  $('objective').textContent=`ONDA ${String(wave).padStart(2,'0')} — ${waveSpawnLeft} INFECTADOS DETECTADOS`;
  toast(`ONDA ${wave} — HORDA SE APROXIMANDO`);
}

function spawnZombie() {
  const angle=Math.random()*Math.PI*2, dist=18+Math.random()*9;
  const pos=new THREE.Vector3(player.position.x+Math.cos(angle)*dist,0,player.position.z+Math.sin(angle)*dist);
  pos.x=THREE.MathUtils.clamp(pos.x,-57,57);pos.z=THREE.MathUtils.clamp(pos.z,-57,57);
  makeZombie(pos,wave);
}

function updateWaves(dt) {
  if(waveSpawnLeft>0){spawnTimer-=dt;if(spawnTimer<=0){spawnZombie();waveSpawnLeft--;spawnTimer=Math.max(.38,1.2-wave*.045);}}
  else if(zombies.length===0){if(intermission===0){intermission=4;$('objective').textContent='ZONA TEMPORARIAMENTE SEGURA';score+=150;toast('ÁREA LIMPA +150 PONTOS');}else{intermission-=dt;if(intermission<=0){wave++;startWave();}}}
}

function updatePlayer(dt) {
  const delta=movementDelta(keys,yaw,dt,keys.has('ShiftLeft')||keys.has('ShiftRight'));
  movePlayerAxis(delta.x,0);movePlayerAxis(0,delta.z);
  player.group.position.copy(player.position); player.group.rotation.y=yaw;
  const weapon=weapons[weaponIndex];
  if(weapon.mag<=0&&weapon.reserve>0&&reloadEndsAt===0)reload();
  if(reloadEndsAt>0&&elapsed>=reloadEndsAt)finishReload();
}

function movePlayerAxis(dx,dz) {
  const radius=.48,nx=player.position.x+dx,nz=player.position.z+dz;
  const blocked=(x,z)=>obstacles.some((o)=>x+radius>o.x1&&x-radius<o.x2&&z+radius>o.z1&&z-radius<o.z2);
  if(Math.abs(nx)<60&&!blocked(nx,player.position.z))player.position.x=nx;
  if(Math.abs(nz)<60&&!blocked(player.position.x,nz))player.position.z=nz;
}

function updateCamera(dt) {
  const forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw);
  const zoom=isAiming&&weapons[weaponIndex].id==='sniper'?4.0:6.4;
  const height=isAiming&&weapons[weaponIndex].id==='sniper'?2.35:2.9;
  tempVec.set(player.position.x-forwardX*zoom,player.position.y+height+pitch*2,player.position.z-forwardZ*zoom);
  camera.position.lerp(tempVec,1-Math.exp(-dt*9));
  const lookDistance=12;
  camera.lookAt(player.position.x+forwardX*lookDistance,player.position.y+1.25+pitch*5,player.position.z+forwardZ*lookDistance);
  camera.updateMatrixWorld();
  camera.fov= isAiming&&weapons[weaponIndex].id==='sniper'?35:66;camera.updateProjectionMatrix();
}

function updateZombies(dt) {
  const playerPos=player.position;
  zombies.forEach((z)=>{
    if(!z.alive)return;
    z.phase+=dt*7;z.arm1.rotation.x=Math.sin(z.phase)*.18;z.arm2.rotation.x=-Math.sin(z.phase)*.18;
    z.leg1.rotation.x=Math.sin(z.phase)*.34;z.leg2.rotation.x=-Math.sin(z.phase)*.34;
    z.healthBack?.quaternion?.copy(camera.quaternion);z.healthFill.quaternion.copy(camera.quaternion);
    const dx=playerPos.x-z.group.position.x,dz=playerPos.z-z.group.position.z,dist=Math.hypot(dx,dz)||.001;
    z.group.rotation.y=Math.atan2(-dx,-dz);
    if(dist>1.35){const step=z.speed*dt;z.group.position.x+=dx/dist*step;z.group.position.z+=dz/dist*step;}
    else if(elapsed>=z.attackAt){z.attackAt=elapsed+Math.max(.55,1.05-wave*.025);health=Math.max(0,health-(7+wave*1.25));sfx('hurt');updateHud();if(health<=0)defeat();}
  });
}

function shoot() {
  const weapon=weapons[weaponIndex];
  if(!consumeRound(weapon)){if(weapon.reserve<=0)toast('SEM MUNIÇÃO — PROCURE UM BAÚ');return;}
  scene.updateMatrixWorld(true);
  nextShotAt=elapsed+weapon.rate;
  updateWeaponHud();sfx(weapon.id==='shotgun'?'shotgun':'shoot');
  const muzzle=new THREE.Vector3();player.weaponGroup.getWorldPosition(muzzle);muzzle.y+=.07;
  let hitSomething=false;
  let endPoint;
  let bestTarget=null,bestDistance=Infinity;
  for(let pellet=0;pellet<weapon.pellets;pellet++){
    const spreadX=(Math.random()-.5)*weapon.spread,spreadY=(Math.random()-.5)*weapon.spread;
    raycaster.setFromCamera(new THREE.Vector2(spreadX,spreadY),camera);raycaster.far=weapon.range;
    const hits=raycaster.intersectObjects(rayTargets,false);
    if(hits.length&&hits[0].distance<bestDistance){bestDistance=hits[0].distance;bestTarget=hits[0].object.userData.zombie;endPoint=hits[0].point.clone();}
  }
  if(bestTarget&&bestTarget.userData.alive!==false){
    const target=zombies.find((z)=>z.group===bestTarget);if(target){const dead=applyDamage(target,weapon.damage);target.healthFill.scale.x=Math.max(.02,target.hp/target.maxHp);target.healthFill.position.x=-(1-target.hp/target.maxHp)*.38;hitSomething=true;
      if(dead){killZombie(target);score+=100+wave*15;kills++;}}
  }
  if(!endPoint){raycaster.setFromCamera(aimNdc,camera);endPoint=raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(Math.min(weapon.range,36)));}
  makeTracer(muzzle,endPoint,weapon.id==='sniper'?'#fff4af':'#ffd47a');
  if(hitSomething){showHitMarker();sfx('hit');}
}

function makeTracer(from,to,color) {
  const geometry=new THREE.BufferGeometry().setFromPoints([from,to]);
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.92}));
  scene.add(line);effects.push({object:line,geometry,material:line.material,life:.07});
  const flash=new THREE.PointLight('#ffbd5d',2.2,2.4);flash.position.copy(from);scene.add(flash);effects.push({object:flash,life:.045});
}

function killZombie(z) {
  if(!z.alive)return;z.alive=false;const index=zombies.indexOf(z);if(index>=0)zombies.splice(index,1);
  const targetIndex=rayTargets.indexOf(z.hit);if(targetIndex>=0)rayTargets.splice(targetIndex,1);
  z.group.rotation.z=Math.PI/2;z.group.position.y=.15;
  const corpse=z.group;effects.push({object:corpse,life:2.5,fade:true});
}

function removeZombieObject(z) { scene.remove(z.group); }

function reload() {
  const w=weapons[weaponIndex];
  if(reloadEndsAt>0||w.mag>=w.magSize||w.reserve<=0)return;
  reloadEndsAt=elapsed+w.reload;toast('RECARREGANDO…');sfx('reload');
}
function finishReload() {
  const w=weapons[weaponIndex],needed=w.magSize-w.mag,load=Math.min(needed,w.reserve);
  refillMagazine(w);reloadEndsAt=0;updateWeaponHud();
}
function selectWeapon(index) { if(reloadEndsAt>0)reloadEndsAt=0;weaponIndex=index;isAiming=false;updateWeaponHud();toast(weapons[index].label); }

function makeChestGlow(chest) {
  const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.08,.55,3.7,10,1,true),new THREE.MeshBasicMaterial({color:'#d7f17a',transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));
  beacon.position.y=2.1;chest.group.add(beacon);chest.beacon=beacon;
}
chests.forEach(makeChestGlow);

function openNearestChest() {
  let nearest=null,distance=Infinity;
  chests.forEach((c)=>{if(c.opened)return;const d=Math.hypot(player.position.x-c.position.x,player.position.z-c.position.z);if(d<distance){nearest=c;distance=d;}});
  if(!nearest||distance>2.7){toast('NENHUM BAÚ POR PERTO');return;}
  nearest.opened=true;nearest.group.visible=false;
  const loot=chooseChestLoot(Math.random());
  if(loot==='ammo'){const weapon=weapons[Math.floor(Math.random()*weapons.length)];weapon.reserve+=weapon.magSize*(weapon.id==='shotgun'?2:3);toast(`BAÚ: +MUNIÇÃO DE ${weapon.label}`);}
  else if(loot==='medkit'){medkits++;toast('BAÚ: KIT MÉDICO +1 (Q PARA USAR)');}
  else if(loot==='weapon'){const weapon=weapons[Math.floor(Math.random()*weapons.length)];weapon.mag=weapon.magSize;weapon.reserve+=weapon.magSize*2;weaponIndex=weapons.indexOf(weapon);updateWeaponHud();toast(`BAÚ: ${weapon.label} RARO`);}
  else{score+=250;toast('BAÚ: SUPRIMENTO ÉPICO +250 PONTOS');}
  score+=50;sfx('chest');updateHud();
}

function updatePrompt() {
  let nearest=null,distance=Infinity;
  chests.forEach((c)=>{if(c.opened)return;const d=Math.hypot(player.position.x-c.position.x,player.position.z-c.position.z);if(d<distance){nearest=c;distance=d;}});
  const prompt=$('prompt');prompt.hidden=!(nearest&&distance<3.2);
  if(nearest&&distance<3.2&&nearest!==lastPromptChest){lastPromptChest=nearest;}else if(!nearest||distance>=3.2)lastPromptChest=null;
}

function useMedkit() {
  if(medkits<=0){toast('SEM KIT MÉDICO');return;}
  if(health>=100){toast('SUA VIDA JÁ ESTÁ CHEIA');return;}
  medkits--;health=Math.min(100,health+45);sfx('chest');toast('KIT MÉDICO USADO +45 VIDA');updateHud();
}

function updateEffects(dt) {
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;
    if(e.fade)e.object.position.y=Math.min(.28,e.object.position.y+dt*.08);
    if(e.life<=0){scene.remove(e.object);e.geometry?.dispose();e.material?.dispose();effects.splice(i,1);}
  }
  if(hitMarkerTimer>0){hitMarkerTimer-=dt;if(hitMarkerTimer<=0)$('hit-marker').classList.remove('show');}
}

function updateHud() {
  $('health-value').textContent=Math.ceil(health);$('health-fill').style.width=`${health}%`;
  $('health-fill').style.background=health<30?'linear-gradient(90deg,#c43d36,#fa8066)':'linear-gradient(90deg,#a2ce50,#d3f26e)';
  $('score').textContent=String(score).padStart(4,'0');$('kill-count').textContent=kills;
  $('zombies').textContent=zombies.length+waveSpawnLeft;
  $('time').textContent=formatTime(elapsed);
  $('medkits').textContent=medkits;
  updateWeaponHud();
}
function updateWeaponHud() {
  const w=weapons[weaponIndex];$('weapon-name').textContent=w.label;$('weapon-mode').textContent=w.mode;
  $('ammo').textContent=reloadEndsAt>0?'…':w.mag;$('reserve').textContent=w.reserve;
  $('ammo-fill').style.width=`${100*w.mag/w.magSize}%`;
  document.querySelectorAll('.weapon-slots span').forEach((el,i)=>el.classList.toggle('selected',i===weaponIndex));
}
function formatTime(seconds) { const s=Math.floor(seconds);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function showHitMarker(){const el=$('hit-marker');el.classList.add('show');hitMarkerTimer=.12;}
let toastTimer=0;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1500);}

function defeat() {
  if(state==='defeated')return;state='defeated';firing=false;unlockPointer();$('hud').hidden=true;
  $('final-wave').textContent=wave;$('final-kills').textContent=kills;$('final-time').textContent=formatTime(elapsed);
  $('defeat-summary').textContent=`Você fez ${score.toLocaleString('pt-BR')} pontos e segurou a posição por ${formatTime(elapsed)}.`;
  $('defeat').hidden=false;
}

function requestLock() { renderer.domElement.requestPointerLock?.(); }
function unlockPointer() { if(document.pointerLockElement)document.exitPointerLock?.(); }
function sfx(type) {
  if(muted)return;
  try{
    audio ||= new AudioContext();if(audio.state==='suspended')audio.resume();
    const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
    const settings={shoot:[150,70,.055,'square'],shotgun:[110,45,.12,'sawtooth'],hit:[740,410,.07,'triangle'],hurt:[95,48,.18,'sawtooth'],reload:[370,620,.13,'triangle'],chest:[520,980,.22,'sine']};
    const [from,to,duration,waveType]=settings[type]||settings.shoot;osc.type=waveType;osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration);
    gain.gain.setValueAtTime(type==='hurt'?.075:.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+duration);
  }catch(_){/* Audio is optional; play continues when the browser blocks it. */}
}

function animate() {
  const dt=Math.min(clock.getDelta(),.05);
  if(state==='playing'){
    elapsed+=dt;updatePlayer(dt);updateCamera(dt);if(firing&&elapsed>=nextShotAt)shoot();updateZombies(dt);updateWaves(dt);updatePrompt();updateEffects(dt);
    const whole=Math.floor(elapsed/5);if(whole>lastSurvivalScore){score+=10*(whole-lastSurvivalScore);lastSurvivalScore=whole;}
    hudAccumulator+=dt;if(hudAccumulator>=.12){hudAccumulator=0;updateHud();}
  }else if(state==='menu'||state==='paused'||state==='defeated'){
    if(state==='menu'){camera.position.lerp(new THREE.Vector3(9,7,16),.008);camera.lookAt(-7,1,-7);}
    updateEffects(dt);
  }
  renderer.render(scene,camera);
}

function resize() {
  const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.8));renderer.setSize(w,h,false);
}
function hideLoading(){requestAnimationFrame(()=>{const loading=$('loading');loading.style.opacity='0';setTimeout(()=>loading.remove(),550);});}
