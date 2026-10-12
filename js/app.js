/* M31 Planung – App-Rahmen: Topbar, Navigation, Routing, Popover, Einstellungen */
(function () {
  'use strict';
  const P = window.P;
  const { $, esc, icon } = P;

  P.PAGES = {
    woche: { label: 'Wochenplan', rail: 'Woche', icon: 'week' },
    schicht: { label: 'Tägliche Arbeiten', rail: 'Schicht', icon: 'list' },
    wartung: { label: 'Wartungsplan', rail: 'Wartung', icon: 'wrench' },
    revision: { label: 'Revision', icon: 'revision' },
    team: { label: 'Team', icon: 'users' },
    aufgaben: { label: 'Aufgaben verwalten', rail: 'Aufgaben', icon: 'tasks' },
  };

  P.go = function (page, opt = {}) {
    if (!P.PAGES[page]) page = 'woche';
    P.ui.page = page;
    if (opt.date) P.ui.date = opt.date;
    if (opt.shift) P.ui.shift = opt.shift;
    if (location.hash.slice(1) !== page) history.replaceState(null, '', '#' + page);
    P.render();
    const m = $('#main'); if (m) m.scrollTop = 0;
  };
  window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (P.PAGES[p] && p !== P.ui.page) P.go(p); });

  /* current shift by clock */
  P.nowShift = () => {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return { dk: P.today(), sh: 'F' };
    if (h >= 14 && h < 22) return { dk: P.today(), sh: 'S' };
    return { dk: h < 6 ? P.addDays(P.today(), -1) : P.today(), sh: 'N' };
  };

  P.render = function () {
    P.saveUi();
    P.closePop();
    if (!P.ui.date) P.ui.date = P.today();
    if (!P.ui.shift) P.ui.shift = P.nowShift().sh;
    document.body.dataset.page = P.ui.page;
    applyTheme();
    renderTop();
    renderRail();
    P.pages[P.ui.page]($('#main'));
  };

  function renderTop() {
    const t = P.today(), { w } = P.isoWeek(t), ns = P.nowShift();
    $('#tb-now').innerHTML = `${icon(P.SHIFT[ns.sh].icon)}<span>${P.WD[P.wd(t)]} ${P.fmtShort(t)} · KW ${w} · ${P.SHIFT[ns.sh].label}</span>`;
    $('#tb-name').innerHTML = `<b>${esc(P.db.settings.line || 'M31')}</b> Planung`;
    document.title = `${P.db.settings.line || 'M31'} Planung`;
  }
  $('#tb-now').onclick = () => { const ns = P.nowShift(); P.go('schicht', { date: ns.dk, shift: ns.sh }); };

  function badge(page) {
    if (page === 'schicht') {
      const ns = P.nowShift();
      return P.shiftItems(ns.dk, ns.sh).filter((i) => i.status === 'due' || i.status === 'late').length;
    }
    if (page === 'wartung') return P.weekMaint(P.today()).filter((m) => m.status === 'late').length;
    return 0;
  }
  function renderRail() {
    $('#rail').innerHTML = Object.entries(P.PAGES).map(([k, p]) => {
      const b = badge(k);
      return `<a class="rail-i${P.ui.page === k ? ' on' : ''}" href="#${k}" data-p="${k}"${P.ui.page === k ? ' aria-current="page"' : ''}>${icon(p.icon)}<span>${esc(p.rail || p.label)}</span>${b ? `<i class="rail-b${k === 'wartung' ? '' : ' info'}">${b}</i>` : ''}</a>`;
    }).join('');
    P.$$('#rail [data-p]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); P.go(a.dataset.p); }));
  }

  /* ---------------------------------------------------------------- theme */
  function applyTheme() {
    const t = P.ui.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }

  /* ---------------------------------------------------------------- popover */
  P.pop = function (anchor, html, mount) {
    P.closePop();
    const el = document.createElement('div');
    el.className = 'pop';
    el.id = 'pop';
    el.innerHTML = html;
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    if (mount) mount(el);
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    function outside(e) { if (!el.contains(e.target) && !anchor.contains(e.target)) P.closePop(); }
    el._off = () => document.removeEventListener('mousedown', outside);
    const f = el.querySelector('input, button'); if (f) f.focus();
    return el;
  };
  P.closePop = () => {
    const el = $('#pop');
    if (!el) return;
    el._off && el._off();
    el.remove();
    if (el._onClose) el._onClose();
  };

  /* staff picker: toggles ids in a list, calls back with the new list; saves + re-renders once it closes */
  P.pickStaff = function (anchor, selected, onChange, opt = {}) {
    const sel = new Set(selected);
    const list = () => P.db.staff.map((p) => `<label class="pk-row"><input type="checkbox" value="${p.id}"${sel.has(p.id) ? ' checked' : ''}>${P.avatar(p)}<span>${esc(p.name)}</span>${p.group ? `<small>${p.group}</small>` : ''}</label>`).join('');
    P.pop(anchor, `<div class="pop-h">${esc(opt.title || 'Personen wählen')}</div><div class="pk-list">${list() || '<p class="empty">Noch keine Mitarbeitenden. Unter «Team» erfassen.</p>'}</div>${opt.reset ? `<div class="pop-f"><button class="link" data-reset>${esc(opt.reset)}</button></div>` : ''}`, (el) => {
      el.querySelectorAll('input').forEach((i) => (i.onchange = () => {
        i.checked ? sel.add(i.value) : sel.delete(i.value);
        onChange(P.db.staff.map((p) => p.id).filter((id) => sel.has(id)));
        el._onClose = () => { P.save(); P.render(); };
      }));
      const r = el.querySelector('[data-reset]');
      if (r) r.onclick = () => { opt.onReset(); P.closePop(); };
    });
  };

  P.avatar = (p, cls = '') => p ? `<span class="av ${cls}" style="--c:${esc(p.color)}" title="${esc(p.name)}">${esc(p.short || p.name.slice(0, 2))}</span>` : '';

  /* ---------------------------------------------------------------- settings */
  $('#tb-gear').onclick = function () {
    const s = P.db.settings;
    const grid = `<div class="wd-grid"><span></span>${P.SHIFTS.map((x) => `<b>${x.k}</b>`).join('')}${[1, 2, 3, 4, 5, 6, 0].map((d) => `<span>${P.WDL[d]}</span>${P.SHIFTS.map((x) => `<input type="checkbox" name="wd-${d}-${x.k}" aria-label="${P.WDL[d]} ${x.label}"${(s.workdays[d] || []).includes(x.k) ? ' checked' : ''}>`).join('')}`).join('')}</div>`;
    P.modal({
      title: 'Einstellungen', wide: true,
      body: `
        <label class="fld"><span>Anlage / Linie</span><input name="line" value="${esc(s.line || 'M31')}" maxlength="20"></label>
        <div class="fld"><span>Darstellung</span><div class="seg">${[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<label><input type="radio" name="theme" value="${k}"${P.ui.theme === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        <div class="fld"><span>Standard-Schichten (Anlage in Betrieb)</span>${grid}<small class="muted">Einzelne Schichten lassen sich im Wochenplan auf Stillstand oder Frei umstellen.</small></div>
        <div class="fld"><span>Daten</span><div class="btn-row">
          <button type="button" class="btn btn-ghost sm" id="set-exp">${icon('download')}Sicherung herunterladen</button>
          <label class="btn btn-ghost sm">${icon('upload')}Sicherung laden<input type="file" accept="application/json,.json" id="set-imp" hidden></label>
          <button type="button" class="btn btn-bad sm" id="set-reset">${icon('trash')}Auf Beispieldaten zurücksetzen</button>
        </div><small class="muted">Alle Daten werden nur in diesem Browser gespeichert. Mit der Sicherung lassen sie sich auf einen anderen PC übertragen.</small></div>`,
      onOk: (f) => {
        const d = P.formData(f);
        P.ui.theme = f.querySelector('[name=theme]:checked').value;
        P.mutate((db) => {
          db.settings.line = d.line || 'M31';
          for (const wd of [0, 1, 2, 3, 4, 5, 6]) db.settings.workdays[wd] = P.SHIFTS.filter((x) => d[`wd-${wd}-${x.k}`]).map((x) => x.k);
        }, 'Einstellungen gespeichert.');
      },
    });
    $('#set-exp').onclick = () => {
      const blob = new Blob([JSON.stringify(P.db, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `${P.db.settings.line || 'M31'}-planung-${P.today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
    };
    $('#set-imp').onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      file.text().then((txt) => {
        let d; try { d = JSON.parse(txt); } catch (err) { d = null; }
        if (!d || d.v !== 1 || !Array.isArray(d.daily)) { P.toast('Datei ist keine gültige Sicherung.'); return; }
        P.closeModal();
        P.mutate((db) => { Object.keys(db).forEach((k) => delete db[k]); Object.assign(db, d); }, 'Sicherung geladen.', true);
      });
    };
    $('#set-reset').onclick = () => {
      P.closeModal();
      P.confirm('Auf Beispieldaten zurücksetzen?', 'Alle Einteilungen, Erledigt-Häkchen, Mitarbeitenden und Änderungen an Aufgaben werden ersetzt.', 'Zurücksetzen', () => {
        P.mutate((db) => { const s = P.seed(); Object.keys(db).forEach((k) => delete db[k]); Object.assign(db, s); }, 'Beispieldaten geladen.', true);
      });
    };
  };

  /* ---------------------------------------------------------------- boot */
  P.load();
  const h = location.hash.slice(1);
  if (P.PAGES[h]) P.ui.page = h;
  P.ui.date = P.today();
  P.render();
  if (P.storageWarn) P.toast('Speichern im Browser ist blockiert – Änderungen gehen beim Schliessen verloren.');
  /* re-render when the shift changes while the page stays open */
  let lastShift = P.nowShift().sh;
  setInterval(() => { const s = P.nowShift().sh; if (s !== lastShift) { lastShift = s; renderTop(); renderRail(); } }, 60000);
})();
