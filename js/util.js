/* M31 Planung – helpers: DOM, dates, icons, toasts, modal */
(function () {
  'use strict';
  const P = (window.P = {});

  P.$ = (s, r = document) => r.querySelector(s);
  P.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  P.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  P.uid = (p = 'id') => p + Math.random().toString(36).slice(2, 9);
  P.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------------------------------------------------------------- dates (local, keyed as YYYY-MM-DD) */
  const pad = (n) => String(n).padStart(2, '0');
  P.dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  P.parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  P.today = () => P.dk(new Date());
  P.addDays = (k, n) => { const d = P.parse(k); d.setDate(d.getDate() + n); return P.dk(d); };
  P.dayNum = (k) => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  P.wd = (k) => P.parse(k).getDay(); // 0 = Sonntag
  P.monday = (k) => P.addDays(k, -((P.wd(k) + 6) % 7));
  /* absolute week index: weeks since Monday 1970-01-05 */
  P.absWeek = (k) => Math.floor((P.dayNum(P.monday(k)) - 4) / 7);
  P.isoWeek = (k) => {
    const d = P.parse(k);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const y = d.getFullYear();
    const jan4 = new Date(y, 0, 4, 12);
    const w = 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return { y, w };
  };
  P.weekMonday = (y, w) => {
    const jan4 = P.dk(new Date(y, 0, 4, 12));
    return P.addDays(P.monday(jan4), (w - 1) * 7);
  };
  P.addMonths = (k, n) => {
    const d = P.parse(k), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return P.dk(d);
  };
  P.WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  P.WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  P.MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
  P.fmtShort = (k) => { const d = P.parse(k); return `${d.getDate()}.${d.getMonth() + 1}.`; };
  P.fmtDate = (k) => { const d = P.parse(k); return `${P.WD[d.getDay()]} ${d.getDate()}. ${P.MON[d.getMonth()]} ${d.getFullYear()}`; };
  P.fmtLong = (k) => { const d = P.parse(k); return `${P.WDL[d.getDay()]}, ${d.getDate()}. ${P.MON[d.getMonth()]} ${d.getFullYear()}`; };
  P.stamp = () => { const d = new Date(); return `${P.dk(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  P.hrs = (h) => (h ? (Math.round(h * 100) / 100).toLocaleString('de-CH') + ' h' : '–');

  /* ---------------------------------------------------------------- icons */
  const I = {
    week: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M9.2 13v4M14.8 13v4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.8 17a1.9 1.9 0 0 0 2.7 2.7l5.6-5.5a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.3-.4-.4-2.3 2.8-2.4z"/>',
    revision: '<path d="M4 7h10M4 12h7M4 17h6"/><circle cx="17" cy="15" r="3.5"/><path d="M17 9.5v2M17 18.5v2M11.5 15h2M20.5 15h2"/>',
    users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.7-3.4 3.2-5.3 6.2-5.3s5.5 1.9 6.2 5.3"/><path d="M15.5 4.9a3.4 3.4 0 0 1 0 6.3M17.6 14.6c1.8.8 3.1 2.4 3.6 4.9"/>',
    tasks: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8.5h8M8 12.5h8M8 16.5h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    chevL: '<path d="m14.5 6-6 6 6 6"/>',
    chevR: '<path d="m9.5 6 6 6-6 6"/>',
    chevD: '<path d="m6 9.5 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15"/>',
    upload: '<path d="M12 15.5v-11M7 9l5-5 5 5M4.5 19.5h15"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4h5v3"/>',
    wand: '<path d="m4 20 11-11M14 4v3M19.5 6.5l-2 2M20 10h-3M12 3.5l1 2M17 14l1 1"/><path d="m13 8 3 3"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    doc: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12.5h6M9 16h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    sunset: '<path d="M7 16a5 5 0 0 1 10 0M2.5 16h19M5.5 20h13M12 4v5M8.5 7.5 12 4l3.5 3.5"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>',
    today: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="12" cy="14.7" r="2" fill="currentColor"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  };
  P.icon = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

  /* ---------------------------------------------------------------- toasts */
  P.toast = function (text, undo) {
    const host = P.$('#toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${P.icon('check')}<span>${P.esc(text)}</span>${undo ? '<button class="link">Rückgängig</button>' : ''}`;
    if (undo) t.querySelector('button').onclick = () => { undo(); t.remove(); };
    host.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4200);
  };

  /* ---------------------------------------------------------------- modal */
  P.modal = function ({ title, body, wide, ok = 'Speichern', onOk, extra }) {
    P.closeModal();
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.id = 'modal';
    bg.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-t">
      <div class="modal-h"><h2 id="modal-t">${P.esc(title)}</h2><button class="icon-btn" data-x aria-label="Schliessen">${P.icon('x')}</button></div>
      <form class="modal-b form" novalidate>${body}</form>
      <div class="modal-f">${extra || ''}<span class="grow"></span><button class="btn btn-ghost" data-x type="button">Abbrechen</button>${onOk ? `<button class="btn btn-primary" data-ok type="button">${P.esc(ok)}</button>` : ''}</div>
    </div>`;
    document.body.appendChild(bg);
    const form = bg.querySelector('form');
    const submit = () => { if (onOk && onOk(form) !== false) P.closeModal(); };
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) P.closeModal(); });
    const okBtn = bg.querySelector('[data-ok]');
    if (okBtn) okBtn.onclick = submit;
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } });
    const first = form.querySelector('input, select, textarea');
    setTimeout(() => (first || okBtn || bg.querySelector('[data-x]')).focus(), 30);
    return bg;
  };
  P.closeModal = () => { const m = P.$('#modal'); if (m) m.remove(); };
  P.confirm = (title, text, ok, fn) => P.modal({ title, body: `<p class="muted">${P.esc(text)}</p>`, ok, onOk: () => { fn(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { P.closeModal(); P.closePop && P.closePop(); } });

  P.formData = (form) => {
    const o = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
      else o[el.name] = el.value.trim();
    }
    return o;
  };
})();
