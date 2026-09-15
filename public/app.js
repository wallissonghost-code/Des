import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

const canvas = document.getElementById('viewer');
const form = document.getElementById('avatar-form');
const usernameInput = document.getElementById('username');
const loadButton = document.getElementById('load-button');
const statusEl = document.getElementById('status');
const loaderEl = document.getElementById('loader');
const userCard = document.getElementById('user-card');
const previewEl = document.getElementById('preview');
const displayNameEl = document.getElementById('display-name');
const accountNameEl = document.getElementById('account-name');

const scene = new THREE.Scene();
const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
camera.position.set(4.5, 3.4, 8);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .06; controls.enablePan = false;
scene.add(new THREE.HemisphereLight(0xffffff, 0x223329, 2.3));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2); keyLight.position.set(5,8,6); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x77ffad, 1.4); rimLight.position.set(-5,4,-5); scene.add(rimLight);
const ground = new THREE.Mesh(new THREE.CircleGeometry(4.5,64), new THREE.MeshStandardMaterial({color:0x101813,roughness:1,transparent:true,opacity:.7}));
ground.rotation.x=-Math.PI/2; ground.position.y=-.02; scene.add(ground);

let avatarRoot=null;
let animator=null;
function setStatus(m,e=false){statusEl.textContent=m;statusEl.classList.toggle('error',e)}
function setLoading(v){loaderEl.hidden=!v;loadButton.disabled=v}
function clearAvatar(){animator=null;if(!avatarRoot)return;scene.remove(avatarRoot);avatarRoot.traverse(c=>{if(c.isMesh){c.geometry?.dispose?.();const ms=Array.isArray(c.material)?c.material:[c.material];ms.forEach(m=>{m?.map?.dispose?.();m?.dispose?.()})}});avatarRoot=null}
function frameAvatar(o){const b=new THREE.Box3().setFromObject(o),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;const d=Math.max(4.2,Math.max(s.x,s.y,s.z)*1.75);camera.position.set(d*.72,Math.max(s.y*.58,2.4),d);controls.target.set(0,Math.max(s.y*.48,1.8),0);controls.minDistance=Math.max(Math.max(s.x,s.y,s.z)*.72,2.6);controls.maxDistance=Math.max(Math.max(s.x,s.y,s.z)*4,12);controls.update()}
function patchMaterialTextures(materials){const original=materials.create.bind(materials);materials.create=n=>{const m=original(n);for(const t of [m.map,m.emissiveMap])if(t){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();t.needsUpdate=true}m.side=THREE.DoubleSide;return m}}
async function loadAvatarModel(data){const ml=new MTLLoader();ml.setResourcePath('/api/cdn/');const mats=await ml.loadAsync(`/api/cdn/${encodeURIComponent(data.mtl)}`);patchMaterialTextures(mats);mats.preload();const ol=new OBJLoader();ol.setMaterials(mats);const o=await ol.loadAsync(`/api/cdn/${encodeURIComponent(data.obj)}`);clearAvatar();avatarRoot=o;scene.add(o);frameAvatar(o)}

function box(name,size,pos,material,parent){const pivot=new THREE.Group();pivot.name=name;pivot.position.copy(pos);parent.add(pivot);const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.y=-size[1]/2;pivot.add(mesh);return pivot}
async function loadAnimatedR15(data){
  clearAvatar();
  const root=new THREE.Group();root.name='R15AnimatedAvatar';
  const bodyMat=new THREE.MeshStandardMaterial({color:0xd6b28a,roughness:.78});
  const shirtMat=new THREE.MeshStandardMaterial({color:0x30343b,roughness:.7});
  const pantsMat=new THREE.MeshStandardMaterial({color:0x181b20,roughness:.8});
  const shoeMat=new THREE.MeshStandardMaterial({color:0x111315,roughness:.85});
  const torso=box('UpperTorso',[1.45,1.25,.68],new THREE.Vector3(0,4.65,0),shirtMat,root);
  box('LowerTorso',[1.2,.75,.62],new THREE.Vector3(0,3.45,0),shirtMat,root);
  const head=box('Head',[1.05,1.05,1.0],new THREE.Vector3(0,5.95,0),bodyMat,root);
  const la=box('LeftUpperArm',[.48,1.15,.5],new THREE.Vector3(-.98,4.75,0),shirtMat,root);
  const lla=box('LeftLowerArm',[.43,1.05,.45],new THREE.Vector3(0,-1.05,0),bodyMat,la);box('LeftHand',[.44,.48,.46],new THREE.Vector3(0,-.98,0),bodyMat,lla);
  const ra=box('RightUpperArm',[.48,1.15,.5],new THREE.Vector3(.98,4.75,0),shirtMat,root);
  const rla=box('RightLowerArm',[.43,1.05,.45],new THREE.Vector3(0,-1.05,0),bodyMat,ra);box('RightHand',[.44,.48,.46],new THREE.Vector3(0,-.98,0),bodyMat,rla);
  const ll=box('LeftUpperLeg',[.58,1.35,.62],new THREE.Vector3(-.38,3.02,0),pantsMat,root);const lll=box('LeftLowerLeg',[.52,1.22,.56],new THREE.Vector3(0,-1.25,0),pantsMat,ll);box('LeftFoot',[.56,.42,.9],new THREE.Vector3(0,-1.12,.12),shoeMat,lll);
  const rl=box('RightUpperLeg',[.58,1.35,.62],new THREE.Vector3(.38,3.02,0),pantsMat,root);const rll=box('RightLowerLeg',[.52,1.22,.56],new THREE.Vector3(0,-1.25,0),pantsMat,rl);box('RightFoot',[.56,.42,.9],new THREE.Vector3(0,-1.12,.12),shoeMat,rll);
  // Use the user's official Roblox appearance as a front texture so the animated rig
  // remains visually tied to the selected account while the public APIs don't expose
  // a directly browser-loadable skinned R15 model.
  if(data.previewUrl){try{const tex=await new THREE.TextureLoader().loadAsync(data.previewUrl);tex.colorSpace=THREE.SRGBColorSpace;const badge=new THREE.Mesh(new THREE.PlaneGeometry(1.02,1.02),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));badge.position.set(0,-.62,.351);torso.add(badge)}catch{}}
  root.scale.setScalar(.82);scene.add(root);avatarRoot=root;frameAvatar(root);
  animator={root,torso,head,la,ra,ll,rl,lla,rla,lll,rll};
}
function updateWalk(t){if(!animator)return;const a=animator;const phase=t*5.2,s=Math.sin(phase),c=Math.cos(phase);a.ll.rotation.x=s*.62;a.rl.rotation.x=-s*.62;a.la.rotation.x=-s*.55;a.ra.rotation.x=s*.55;a.lla.rotation.x=Math.max(0,s)*-.35;a.rla.rotation.x=Math.max(0,-s)*-.35;a.lll.rotation.x=Math.max(0,-s)*.42;a.rll.rotation.x=Math.max(0,s)*.42;a.torso.rotation.y=s*.035;a.head.rotation.y=-s*.025;a.root.position.y=Math.abs(c)*.035}
async function fetchAvatar(username,retry=0){const r=await fetch(`/api/avatar?username=${encodeURIComponent(username)}`);const d=await r.json().catch(()=>({}));if(r.status===202&&retry<3){await new Promise(x=>setTimeout(x,1500));return fetchAvatar(username,retry+1)}if(!r.ok)throw new Error(d.error||`Falha HTTP ${r.status}`);return d}
form.addEventListener('submit',async e=>{e.preventDefault();const username=usernameInput.value.trim().replace(/^@/,'');if(!username)return;setLoading(true);setStatus('Buscando usuário e preparando rig R15 animado…');try{const data=await fetchAvatar(username);displayNameEl.textContent=data.user.displayName||data.user.name;const n=Array.isArray(data.wearing)?data.wearing.length:0;accountNameEl.textContent=`@${data.user.name} · ID ${data.user.id} · ${n} itens equipados`;if(data.previewUrl){previewEl.src=data.previewUrl;previewEl.hidden=false}else previewEl.hidden=true;userCard.hidden=false;if(data.mode==='3d'&&data.obj&&data.mtl){await loadAvatarModel(data);setStatus('Modelo 3D Roblox carregado. Esta malha é estática; use o modo R15 para locomoção.')}else{await loadAnimatedR15(data);setStatus('Rig R15 animado carregado: caminhada ativa. Próxima etapa é reconstruir cada asset do avatar no rig.')}}catch(err){console.error(err);setStatus(err.message||'Não foi possível carregar o avatar.',true)}finally{setLoading(false)}});
function resize(){const p=canvas.parentElement,w=Math.max(p.clientWidth,1),h=Math.max(p.clientHeight,1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);const t=clock.getElapsedTime();updateWalk(t);controls.update();renderer.render(scene,camera)}animate();
