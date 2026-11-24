// Cloud saves for the self-hosted build (`vite build --mode server`, see server/). Everywhere else
// (Yandex Games, the APK, the single HTML file) CLOUD is false and every function here is a no-op.
import {SAVE_KEY} from '../config/gameData.js';

export const CLOUD = import.meta.env?.VITE_CLOUD === 'on';
let user = null, timer = 0, pending = null, frozen = false, warned = false, notify = () => {};

export const currentUser = () => user;
/** While true the game must not write its save: a login/logout is swapping it and is about to reload the page. */
export const isFrozen = () => frozen;
export const onCloudNotice = fn => { notify = fn; };

async function api(method, path, body, keepalive = false) {
  try {
    const r = await fetch(path, {method, credentials: 'same-origin', keepalive,
      headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
    let data = null; try { data = await r.json(); } catch { /* empty body */ }
    return {ok: r.ok, status: r.status, data};
  } catch { return {ok: false, status: 0, data: {error: 'Сервер недоступен'}}; }
}
const localSave = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } };
const writeLocal = data => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage blocked */ } };

/** Before the game boots. Logged in on this device → the newer of the two copies wins (another device may have played). */
export async function initCloud() {
  if (!CLOUD) return;
  const me = await api('GET', '/api/me');
  if (!me.ok || !me.data?.name) return;                       // not logged in, or the server is down: play locally
  user = me.data.name;
  const remote = await api('GET', '/api/save'), local = localSave();
  if (remote.ok && remote.data?.data && (remote.data.savedAt ?? 0) > (local?.savedAt ?? 0)) writeLocal(remote.data.data);
  else if (local) await api('PUT', '/api/save', {data: local});
}

/** Called on every game save; uploads at most every 2.5 s. */
export function cloudPush(state) {
  if (!CLOUD || !user || frozen) return;
  pending = state;
  clearTimeout(timer);
  timer = setTimeout(flush, 2500);
}

/** Upload now. keepalive lets it finish while the tab is closing. */
export function flush(keepalive = false) {
  clearTimeout(timer);
  if (!pending || !user) return;
  const data = JSON.parse(JSON.stringify(pending));          // a snapshot: the game keeps mutating its state
  pending = null;
  api('PUT', '/api/save', {data}, keepalive).then(r => {
    if (r.status === 409 && !warned) { warned = true; notify('На другом устройстве прогресс новее. Перезагрузи страницу, чтобы забрать его'); }
    else if (r.status === 401) { user = null; notify('Сессия закончилась. Войди снова в разделе «Квесты»'); }
    else if (r.status === 0) pending = pending ?? data;       // offline: the next save retries
  });
}

/** New account: the progress played on this device so far goes with it. */
export async function register(name, password) {
  const r = await api('POST', '/api/register', {name, password});
  if (!r.ok) return {error: r.data?.error ?? 'Не получилось создать аккаунт'};
  user = r.data.name;
  const local = localSave();
  if (local) await api('PUT', '/api/save', {data: local});
  return {reload: false};
}

/** Existing account: its saved progress replaces this device's (the page reloads); with none on the server, this device's goes up. */
export async function login(name, password) {
  const r = await api('POST', '/api/login', {name, password});
  if (!r.ok) return {error: r.data?.error ?? 'Не получилось войти'};
  user = r.data.name;
  const remote = await api('GET', '/api/save');
  if (remote.ok && remote.data?.data) { frozen = true; pending = null; writeLocal(remote.data.data); return {reload: true}; }
  const local = localSave();
  if (local) await api('PUT', '/api/save', {data: local});
  return {reload: false};
}

/** Uploads the latest progress, ends the session and clears this device, so the next person starts clean. */
export async function logout() {
  if (pending) { const data = JSON.parse(JSON.stringify(pending)); pending = null; await api('PUT', '/api/save', {data}); }
  frozen = true;
  await api('POST', '/api/logout', {});
  user = null;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ }
}
