// Fonts are bundled (no Google Fonts request): the APK and Yandex Games build work offline.
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/800.css';
import './ui/style.css';
import './ui/v2.css';
import {start} from './ui/app.js';
import {CLOUD, initCloud, currentUser} from './services/cloud.js';
import {openAuth, shouldOffer} from './ui/auth.js';
import {loadPlatformSave} from './services/adBridge.js';
import {SAVE_KEY} from './config/gameData.js';

/** Yandex Games: the save in the player's account wins when it is newer than this device's. Elsewhere: nothing. */
async function initPlatformSave() {
  const remote = await loadPlatformSave();
  if (!remote) return;
  let local = null;
  try { local = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* broken or blocked */ }
  if ((remote.savedAt ?? 0) > (local?.savedAt ?? 0)) try { localStorage.setItem(SAVE_KEY, JSON.stringify(remote)); } catch { /* blocked */ }
}

// Pick up the newest progress (own server or Yandex account) before the game reads its save. Elsewhere this resolves at once.
Promise.allSettled([initCloud(), initPlatformSave()]).finally(() => {
  start();
  if (CLOUD && !currentUser() && shouldOffer()) openAuth();
});
