// Vercel Serverless API for P2P Trade rooms (/api/trade)
// Uses Upstash Redis / Vercel KV if configured, with in-memory fallback for quick testing.
const MEM = globalThis.__cfTrades || (globalThis.__cfTrades = new Map());

async function getRoom(code) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && tok) {
    const r = await fetch(`${url}/get/trade:${code}`, {headers: {Authorization: `Bearer ${tok}`}});
    const j = await r.json();
    return j.result ? JSON.parse(j.result) : null;
  }
  return MEM.get(code) || null;
}

async function setRoom(code, room) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && tok) {
    await fetch(`${url}/set/trade:${code}/${encodeURIComponent(JSON.stringify(room))}?EX=900`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${tok}`},
    });
    return;
  }
  MEM.set(code, room);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const {code, player} = req.body || {};
  if (!code || !player?.id) return res.status(400).json({error: 'Missing code or player'});

  const room = (await getRoom(code)) || {code, players: {}, status: 'OPEN', updatedAt: Date.now()};
  const prev = room.players[player.id];

  // Anti-scam: if items or credits changed, unlock the other player too
  const changed = prev && (JSON.stringify(prev.items) !== JSON.stringify(player.items) || prev.credits !== player.credits);
  room.players[player.id] = player;
  if (changed) {
    for (const pid of Object.keys(room.players)) room.players[pid].locked = false;
  }
  room.updatedAt = Date.now();
  await setRoom(code, room);

  const partnerId = Object.keys(room.players).find(id => id !== player.id);
  return res.status(200).json({
    code,
    status: room.status,
    partner: partnerId ? room.players[partnerId] : null,
  });
}
