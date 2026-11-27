// P2P Trade engine with Dual-Lock anti-scam, live /api/trade sync, and solo Black Market Broker mode.
import {forge, evaluate} from './forge.js';

export function createTradeSession(myUser, roomCode = null) {
  const code = (roomCode || Math.random().toString(36).slice(2, 7)).toUpperCase();
  return {
    code,
    status: 'OPEN',
    mode: 'P2P', // P2P | BROKER
    taxRate: 0.05,
    me: {id: myUser?.id || 'me', name: myUser?.name || 'Ты', items: [], credits: 0, locked: false},
    partner: {id: null, name: 'Ожидание игрока...', items: [], credits: 0, locked: false},
  };
}

export function toggleTradeItem(session, item) {
  if (session.status !== 'OPEN') return session;
  const idx = session.me.items.findIndex(x => x.id === item.id);
  if (idx >= 0) session.me.items.splice(idx, 1);
  else if (session.me.items.length < 3) session.me.items.push(item);
  session.me.locked = false;
  if (session.mode === 'P2P') session.partner.locked = false;
  else refreshBrokerOffer(session);
  return session;
}

export function setTradeCredits(session, amount, maxCredits) {
  if (session.status !== 'OPEN') return session;
  session.me.credits = Math.max(0, Math.min(Math.floor(amount || 0), Math.floor(maxCredits)));
  session.me.locked = false;
  if (session.mode === 'P2P') session.partner.locked = false;
  else refreshBrokerOffer(session);
  return session;
}

export function connectBroker(session, locId = 'neo') {
  session.mode = 'BROKER';
  session.partner.id = 'broker_ai';
  session.partner.name = '@NEO_BROKER (Бот)';
  session.locId = locId;
  refreshBrokerOffer(session);
  return session;
}

export function refreshBrokerOffer(session) {
  const myVal = session.me.items.reduce((s, x) => s + x.power * 2, 0) + session.me.credits;
  if (myVal <= 0) {
    session.partner.items = [];
    session.partner.credits = 0;
    session.partner.locked = false;
    return;
  }
  // Generate a tempting counter-offer: 1 forged weapon of comparable/higher power + credits
  const raw = forge(session.locId || 'neo', 0.45);
  const ev = evaluate(raw);
  const targetPow = Math.max(ev.power, Math.round((myVal / 2) * (0.92 + Math.random() * 0.28)));
  const brokerItem = {...raw, id: Date.now() + Math.floor(Math.random() * 999), tier: Math.max(ev.tier, 2), score: ev.score, power: targetPow, oc: Math.random() < 0.35 ? 3 : 0};
  session.partner.items = [brokerItem];
  session.partner.credits = Math.max(0, Math.round(myVal * 0.15));
  session.partner.locked = true;
}

export function canFinalize(session) {
  const hasAny = session.me.items.length > 0 || session.me.credits > 0 || session.partner.items.length > 0 || session.partner.credits > 0;
  return session.status === 'OPEN' && hasAny && session.me.locked && session.partner.locked;
}

export function finalizeTradeLocal(session, state) {
  if (!canFinalize(session)) return {ok: false, reason: 'NOT_LOCKED'};
  if (state.credits < session.me.credits) return {ok: false, reason: 'NO_CREDITS'};

  const givenIds = new Set(session.me.items.map(x => x.id));
  state.arsenal = state.arsenal.filter(x => !givenIds.has(x.id));
  for (const item of session.partner.items) {
    state.arsenal.push({...item, id: state.nextId++});
  }
  const netIn = Math.floor(session.partner.credits * (1 - session.taxRate));
  state.credits = state.credits - session.me.credits + netIn;
  session.status = 'COMPLETED';
  return {ok: true, netCredits: netIn - session.me.credits, received: session.partner.items.length};
}

export async function syncTradeRemote(session) {
  if (session.mode !== 'P2P') return session;
  try {
    const res = await fetch('/api/trade', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({code: session.code, player: session.me}),
    });
    if (!res.ok) return session;
    const data = await res.json();
    if (data?.partner) session.partner = data.partner;
    if (data?.status) session.status = data.status;
  } catch { /* offline or no backend yet */ }
  return session;
}
