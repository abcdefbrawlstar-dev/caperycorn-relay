const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DIR = path.join(__dirname, 'cape_store');
fs.mkdirSync(CACHE_DIR, { recursive: true });

// uuid -> { equipped: boolean, hash: string | null, ext: string | null, updatedAt: number }
const playerStates = new Map();

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/cape', express.json({ limit: '5mb' }), (req, res) => {
  const { uuid, equipped, hash, ext, imageBase64 } = req.body;
  if (!uuid || typeof equipped !== 'boolean') {
    return res.status(400).json({ error: 'Missing uuid or equipped' });
  }

  if (!equipped || !hash) {
    playerStates.set(uuid, {
      equipped: false,
      hash: null,
      ext: null,
      updatedAt: Date.now()
    });
    return res.json({ ok: true });
  }

  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return res.status(400).json({ error: 'Invalid hash' });
  }

  const cleanExt = ext === 'gif' ? 'gif' : 'png';
  const filePath = path.join(CACHE_DIR, `${hash}.${cleanExt}`);

  if (imageBase64) {
    const buf = Buffer.from(imageBase64, 'base64');
    const actualHash = crypto.createHash('sha256').update(buf).digest('hex');
    if (actualHash !== hash) {
      return res.status(400).json({ error: 'Hash mismatch' });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buf);
    }
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'NEED_UPLOAD' });
  }

  playerStates.set(uuid, {
    equipped: true,
    hash,
    ext: cleanExt,
    updatedAt: Date.now()
  });

  return res.json({ ok: true });
});

app.post('/api/lookup', express.json({ limit: '256kb' }), (req, res) => {
  const { uuids } = req.body;
  if (!Array.isArray(uuids)) {
    return res.status(400).json({ error: 'uuids must be an array' });
  }

  const result = {};
  for (const uuid of uuids.slice(0, 100)) {
    if (typeof uuid === 'string' && playerStates.has(uuid)) {
      result[uuid] = playerStates.get(uuid);
    }
  }
  return res.json(result);
});

app.get('/api/texture/:hash.:ext', (req, res) => {
  const { hash, ext } = req.params;
  if (!/^[a-f0-9]{64}$/.test(hash) || !['png', 'gif'].includes(ext)) {
    return res.status(400).end();
  }
  const filePath = path.join(CACHE_DIR, `${hash}.${ext}`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  return res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Caperycorn relay listening on http://localhost:${PORT}`);
});