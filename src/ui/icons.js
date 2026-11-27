// Stroke icons (24×24, currentColor). Decorative: buttons carry their own text or aria-label.
const P = {
  hammer: 'M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8',
  swords: 'M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5L21 18v3h-3l-3.5-3.5',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  cart: 'M3 3h2l2.4 12.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6M9 21h.01M18 21h.01',
  target: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  play: 'M6 4l14 8-14 8z',
  sound: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  coin: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9 9h4.5a1.5 1.5 0 0 1 0 3H10.5a1.5 1.5 0 0 0 0 3H15M12 7v2M12 15v2',
  close: 'M6 6l12 12M18 6L6 18',
  medal: 'M8 2h8l-2 6h-4zM12 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM12 11l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 13.3l2-.3z',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4M12 2v2m0 16v2',
};
export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[name]}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
