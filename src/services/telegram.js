// Telegram Mini App SDK bridge: user profile, native Haptics, deep links (duel & P2P trade).
const BOT_USERNAME = 'CyberForgeArenaBot'; // Замени на @username своего бота в BotFather

export const tg = typeof window !== 'undefined' ? (window.Telegram?.WebApp || null) : null;

export function initTelegram() {
  if (!tg) {
    const p = new URLSearchParams(location.search);
    return {
      isTg: false,
      user: null,
      startParam: p.get('startapp') || p.get('trade') ? (p.get('startapp') || `trade_${p.get('trade')}`) : null,
    };
  }
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#070b14');
    tg.setBackgroundColor?.('#070b14');
  } catch { /* ignore older clients */ }

  const u = tg.initDataUnsafe?.user || null;
  return {
    isTg: true,
    user: u ? {
      id: String(u.id),
      name: u.username ? `@${u.username}` : (u.first_name || 'Кузнец'),
      photo: u.photo_url || null,
    } : null,
    startParam: tg.initDataUnsafe?.start_param || null,
  };
}

export function tgHaptic(type = 'impact', style = 'medium', enabled = true) {
  if (!enabled) return;
  const hf = tg?.HapticFeedback;
  if (hf) {
    try {
      if (type === 'impact') hf.impactOccurred(style);
      else if (type === 'notify') hf.notificationOccurred(style);
      else if (type === 'select') hf.selectionChanged();
      return;
    } catch { /* fallback below */ }
  }
  try { navigator.vibrate?.(style === 'heavy' || style === 'error' ? [30, 30, 40] : 14); } catch {}
}

export function shareTradeLink(tradeCode, offerSummary = 'редкое оружие') {
  const url = tg
    ? `https://t.me/${BOT_USERNAME}?startapp=trade_${tradeCode}`
    : `${location.origin}${location.pathname}?trade=${tradeCode}`;
  const text = `🔥 Заходи в Кибер-Кузню на P2P-трейд (код ${tradeCode})! Предлагаю: ${offerSummary}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
  else if (navigator.clipboard) {
    navigator.clipboard.writeText(`${text} ${url}`).catch(() => {});
    window.open(shareUrl, '_blank');
  } else window.open(shareUrl, '_blank');
  return url;
}

export function shareDuelLink(userId, power) {
  const url = tg
    ? `https://t.me/${BOT_USERNAME}?startapp=duel_${userId}`
    : `${location.origin}${location.pathname}?duel=${userId}`;
  const text = `⚔️ Вызываю тебя на Кибер-Арену! Мощь моего отряда: ${Math.floor(power).toLocaleString('ru-RU')}. Сможешь пробить?`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
  else {
    navigator.clipboard?.writeText(`${text} ${url}`).catch(() => {});
    window.open(shareUrl, '_blank');
  }
  return url;
}
