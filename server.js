import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || '';

function cdnUrl(hash) {
  if (!/^[A-Za-z0-9-]{16,128}$/.test(hash)) throw new Error('Invalid CDN hash');
  let shard = 31;
  for (const char of hash) shard ^= char.charCodeAt(0);
  return `https://t${shard % 8}.rbxcdn.com/${hash}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!response.ok) {
    const error = new Error(`Roblox request failed (${response.status})`);
    error.status = response.status;
    error.body = data ?? text;
    throw error;
  }
  return data;
}

async function resolveUsername(username) {
  const payload = await fetchJson('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
  });

  const user = payload?.data?.[0];
  if (!user) {
    const error = new Error('Usuário Roblox não encontrado');
    error.status = 404;
    throw error;
  }
  return user;
}

async function fetchAvatarDefinition(userId) {
  try {
    return await fetchJson(`https://avatar.roblox.com/v4/avatar/users/${encodeURIComponent(userId)}`);
  } catch {
    return fetchJson(`https://avatar.roblox.com/v1/users/${encodeURIComponent(userId)}/avatar`);
  }
}

async function fetchCurrentlyWearing(userId) {
  try {
    const data = await fetchJson(`https://avatar.roblox.com/v1/users/${encodeURIComponent(userId)}/currently-wearing`);
    return Array.isArray(data?.assetIds) ? data.assetIds : [];
  } catch {
    return [];
  }
}

async function fetch3DDescriptor(userId) {
  const url = `https://thumbnails.roblox.com/v1/users/avatar-3d?userId=${encodeURIComponent(userId)}&useGltf=false`;
  const headers = { accept: 'application/json' };
  if (ROBLOX_API_KEY) headers['x-api-key'] = ROBLOX_API_KEY;
  return fetchJson(url, { headers });
}

async function getFullBodyPreview(userId) {
  try {
    const data = await fetchJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
    return data?.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

app.get('/api/avatar', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Digite um username Roblox válido.' });
    }

    const user = await resolveUsername(username);
    const [avatarDefinition, wearing, previewUrl] = await Promise.all([
      fetchAvatarDefinition(user.id),
      fetchCurrentlyWearing(user.id),
      getFullBodyPreview(user.id)
    ]);

    const base = {
      user: { id: user.id, name: user.name, displayName: user.displayName },
      previewUrl,
      avatar: avatarDefinition,
      wearing,
      mode: 'official-preview'
    };

    try {
      const descriptor = await fetch3DDescriptor(user.id);
      const state = descriptor?.state || descriptor?.data?.[0]?.state;
      const imageUrl = descriptor?.imageUrl || descriptor?.data?.[0]?.imageUrl;

      if (state && state !== 'Completed') {
        return res.status(202).json({ ...base, state, error: `Avatar 3D ainda está sendo gerado (${state}).` });
      }

      if (imageUrl) {
        const model = await fetchJson(imageUrl, { headers: { accept: 'application/json' } });
        if (model?.obj && model?.mtl) {
          return res.json({
            ...base,
            mode: '3d',
            camera: model.camera || null,
            aabb: model.aabb || null,
            obj: model.obj,
            mtl: model.mtl,
            textures: Array.isArray(model.textures) ? model.textures : []
          });
        }
      }
    } catch (error) {
      // The Roblox avatar-3d route is Beta and may reject server requests without
      // an authentication method exposed to this application. The public avatar
      // definition and official thumbnail remain usable, so we degrade gracefully.
      console.warn('avatar-3d unavailable, using public avatar definition fallback:', error.status || error.message);
    }

    return res.json(base);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Falha ao carregar avatar.' });
  }
});

app.get('/api/cdn/:hash', async (req, res) => {
  try {
    const url = cdnUrl(req.params.hash);
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).send('CDN asset unavailable');
    const contentType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    if (contentType) res.setHeader('content-type', contentType);
    if (contentLength) res.setHeader('content-length', contentLength);
    res.setHeader('cache-control', 'public, max-age=3600');
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.send(bytes);
  } catch (error) {
    console.error(error);
    res.status(400).send('Invalid CDN request');
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`DES Roblox Avatar running on :${PORT}`));
