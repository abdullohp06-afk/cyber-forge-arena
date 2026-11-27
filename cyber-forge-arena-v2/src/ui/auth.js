// Вход / регистрация (self-hosted build only). Its own dialog; the game keeps running behind it.
import {register, login, logout} from '../services/cloud.js';

const SKIP_KEY = 'cf_auth_skip';
/** First visit in this tab without a session: offer the dialog once (the player can always open it from «Квесты»). */
export const shouldOffer = () => { try { return !sessionStorage.getItem(SKIP_KEY); } catch { return true; } };

export function openAuth(onDone = () => {}) {
  if (document.querySelector('.auth-modal')) return;
  const prevFocus = document.activeElement;
  const el = document.createElement('div');
  el.className = 'auth-modal';
  el.innerHTML = `<form class="auth-box" role="dialog" aria-modal="true" aria-labelledby="authTitle" novalidate>
      <div class="auth-title" id="authTitle">АККАУНТ</div>
      <p class="auth-note">Войди, и прогресс будет храниться на сервере: на любом устройстве продолжишь с того же места.</p>
      <label class="auth-field">Имя<input name="name" autocomplete="username" autocapitalize="off" spellcheck="false" minlength="3" maxlength="24" required></label>
      <label class="auth-field">Пароль<input name="password" type="password" autocomplete="current-password" minlength="6" maxlength="128" required></label>
      <p class="auth-err" role="alert" aria-live="assertive"></p>
      <div class="auth-actions">
        <button class="btn" name="mode" value="login">Войти</button>
        <button class="btn ghost" name="mode" value="register">Создать аккаунт</button>
      </div>
      <button type="button" class="btn ghost wide auth-skip">Играть без аккаунта</button>
    </form>`;
  document.body.append(el);
  const form = el.querySelector('form'), err = el.querySelector('.auth-err'), buttons = el.querySelectorAll('button');
  const nameIn = el.querySelector('input[name="name"]'), passIn = el.querySelector('input[name="password"]');   // form.name is the form's own attribute
  const close = () => { el.remove(); prevFocus?.focus?.(); };
  const skip = () => { try { sessionStorage.setItem(SKIP_KEY, '1'); } catch { /* storage blocked */ } close(); };
  el.querySelector('.auth-skip').addEventListener('click', skip);
  el.addEventListener('keydown', e => { if (e.key === 'Escape') skip(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const mode = e.submitter?.value ?? 'login', name = nameIn.value.trim(), password = passIn.value;
    if (name.length < 3) { err.textContent = 'Имя — минимум 3 символа'; nameIn.focus(); return; }
    if (password.length < 6) { err.textContent = 'Пароль — минимум 6 символов'; passIn.focus(); return; }
    err.textContent = '';
    buttons.forEach(b => { b.disabled = true; });
    const r = await (mode === 'register' ? register(name, password) : login(name, password));
    buttons.forEach(b => { b.disabled = false; });
    if (r.error) { err.textContent = r.error; return; }
    if (r.reload) { location.reload(); return; }                 // the account's saved progress replaced this device's
    close(); onDone(mode);
  });
  nameIn.focus();
}

export async function doLogout() {
  await logout();
  location.reload();
}
