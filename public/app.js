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
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
camera.position.set(4.5, 3.4, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 18;

scene.add(new THREE.HemisphereLight(0xffffff, 0x223329, 2.3));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(5, 8, 6);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x77ffad, 1.4);
rimLight.position.set(-5, 4, -5);
scene.add(rimLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(4.5, 64),
  new THREE.MeshStandardMaterial({ color: 0x101813, roughness: 1, transparent: true, opacity: 0.7 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

let avatarRoot = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function setLoading(loading) {
  loaderEl.hidden = !loading;
  loadButton.disabled = loading;
}

function clearAvatar() {
  if (!avatarRoot) return;
  scene.remove(avatarRoot);
  avatarRoot.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
  avatarRoot = null;
}

function frameAvatar(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.x -= center.x;
  object.position.y -= box.min.y;
  object.position.z -= center.z;

  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = Math.max(4.2, maxDim * 1.75);
  camera.position.set(distance * 0.72, Math.max(size.y * 0.58, 2.4), distance);
  controls.target.set(0, Math.max(size.y * 0.48, 1.8), 0);
  controls.minDistance = Math.max(maxDim * 0.72, 2.6);
  controls.maxDistance = Math.max(maxDim * 4, 12);
  controls.update();
}

function patchMaterialTextures(materials) {
  const applyTextureSettings = (texture) => {
    if (!texture) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
  };

  const originalCreate = materials.create.bind(materials);
  materials.create = (name) => {
    const material = originalCreate(name);
    applyTextureSettings(material.map);
    applyTextureSettings(material.emissiveMap);
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
    return material;
  };
}

async function loadAvatarModel(data) {
  const mtlLoader = new MTLLoader();
  mtlLoader.setResourcePath('/api/cdn/');
  const materials = await mtlLoader.loadAsync(`/api/cdn/${encodeURIComponent(data.mtl)}`);
  patchMaterialTextures(materials);
  materials.preload();

  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  const object = await objLoader.loadAsync(`/api/cdn/${encodeURIComponent(data.obj)}`);

  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
  });

  clearAvatar();
  avatarRoot = object;
  scene.add(object);
  frameAvatar(object);
}

async function loadOfficialPreview(url) {
  if (!url) throw new Error('O Roblox não retornou a imagem oficial do avatar.');

  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const group = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.45, 3.45),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
  );
  plane.position.y = 1.72;
  group.add(plane);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.65, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0x18241c, roughness: 0.75, metalness: 0.15 })
  );
  pedestal.position.y = 0.08;
  group.add(pedestal);

  clearAvatar();
  avatarRoot = group;
  scene.add(group);

  camera.position.set(0, 2.1, 6.2);
  controls.target.set(0, 1.75, 0);
  controls.minDistance = 3.8;
  controls.maxDistance = 10;
  controls.update();
}

async function fetchAvatar(username, retry = 0) {
  const response = await fetch(`/api/avatar?username=${encodeURIComponent(username)}`);
  const data = await response.json().catch(() => ({}));

  if (response.status === 202 && retry < 3) {
    setStatus('O Roblox ainda está gerando o modelo 3D. Tentando novamente…');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return fetchAvatar(username, retry + 1);
  }

  if (!response.ok) throw new Error(data.error || `Falha HTTP ${response.status}`);
  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim().replace(/^@/, '');
  if (!username) return;

  setLoading(true);
  setStatus('Buscando usuário, aparência e itens equipados…');

  try {
    const data = await fetchAvatar(username);

    displayNameEl.textContent = data.user.displayName || data.user.name;
    const itemCount = Array.isArray(data.wearing) ? data.wearing.length : 0;
    accountNameEl.textContent = `@${data.user.name} · ID ${data.user.id} · ${itemCount} itens equipados`;

    if (data.previewUrl) {
      previewEl.src = data.previewUrl;
      previewEl.hidden = false;
    } else {
      previewEl.hidden = true;
    }
    userCard.hidden = false;

    if (data.mode === '3d' && data.obj && data.mtl) {
      await loadAvatarModel(data);
      setStatus('Avatar 3D carregado com a aparência atual do Roblox.');
    } else {
      await loadOfficialPreview(data.previewUrl);
      setStatus('Aparência atual carregada pela API pública do Roblox. O endpoint 3D Beta está indisponível sem autenticação compatível.');
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Não foi possível carregar o avatar.', true);
  } finally {
    setLoading(false);
  }
});

function resize() {
  const parent = canvas.parentElement;
  const width = Math.max(parent.clientWidth, 1);
  const height = Math.max(parent.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
