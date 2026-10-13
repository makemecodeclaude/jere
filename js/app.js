/* M31 Planung – App-Rahmen: Topbar, Navigation, Routing, Popover, Einstellungen */
(function () {
  'use strict';
  const P = window.P;
  const { $, esc, icon } = P;

  P.PAGES = {
    woche: { label: 'Wochenplan', rail: 'Woche', icon: 'week' },
    monat: { label: 'Monatsübersicht', rail: 'Monat', icon: 'month' },
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
  P.nowShift = () => P.shiftAt(new Date());

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

  /* staff picker: toggles ids in a list (partners come along), calls back with the new list; saves + re-renders once it closes */
  P.pickStaff = function (anchor, selected, onChange, opt = {}) {
    const sel = new Set(selected);
    const staff = P.db.staff.slice().sort((a, b) => (a.group || 'Z').localeCompare(b.group || 'Z'));
    const list = () => staff.map((p) => { const pt = P.partnerOf(p.id); return `<label class="pk-row"><input type="checkbox" value="${p.id}"${sel.has(p.id) ? ' checked' : ''}>${P.avatar(p)}<span>${esc(p.name)}${pt ? `<em>mit ${esc(pt.short || pt.name)}</em>` : ''}</span>${p.group ? P.groupChip(p.group, true) : ''}</label>`; }).join('');
    P.pop(anchor, `<div class="pop-h">${esc(opt.title || 'Personen wählen')}</div><div class="pk-list">${list() || '<p class="empty">Noch keine Mitarbeitenden. Unter «Team» erfassen.</p>'}</div><div class="pop-f small muted">Paare werden gemeinsam an- und abgewählt.${opt.reset ? ` <button class="link" data-reset>${esc(opt.reset)}</button>` : ''}</div>`, (el) => {
      el.querySelectorAll('input').forEach((i) => (i.onchange = () => {
        const pt = P.partnerOf(i.value);
        i.checked ? sel.add(i.value) : sel.delete(i.value);
        if (pt) { i.checked ? sel.add(pt.id) : sel.delete(pt.id); const pi = el.querySelector(`input[value="${pt.id}"]`); if (pi) pi.checked = i.checked; }
        onChange(P.db.staff.map((p) => p.id).filter((id) => sel.has(id)));
        el._onClose = () => { P.save(); P.render(); };
      }));
      const r = el.querySelector('[data-reset]');
      if (r) r.onclick = () => { opt.onReset(); P.closePop(); };
    });
  };

  P.groupChip = (gid, small) => { const g = P.group(gid); return g ? `<span class="grp${small ? ' sm' : ''}" style="--c:${esc(g.color)}" title="${esc(g.name)}">${esc(small ? g.id : g.name)}</span>` : ''; };
  P.avatar = (p, cls = '') => p ? `<span class="av ${cls}" style="--c:${esc(p.color)}" title="${esc(p.name)}">${esc(p.short || p.name.slice(0, 2))}</span>` : '';

  /* ---------------------------------------------------------------- settings */
  $('#tb-gear').onclick = function () {
    const s = P.db.settings;
    const grid = `<div class="wd-grid"><span></span>${P.SHIFTS.map((x) => `<b>${x.k}</b>`).join('')}${[1, 2, 3, 4, 5, 6, 0].map((d) => `<span>${P.WDL[d]}</span>${P.SHIFTS.map((x) => `<input type="checkbox" name="wd-${d}-${x.k}" aria-label="${P.WDL[d]} ${x.label}"${(s.workdays[d] || []).includes(x.k) ? ' checked' : ''}>`).join('')}`).join('')}</div>`;
    const preset = (P.PATTERNS.find((x) => x.pattern === s.pattern) || {}).k || 'custom';
    P.modal({
      title: 'Einstellungen', wide: true,
      body: `
        <div class="fld-row">
          <label class="fld"><span>Anlage / Linie</span><input name="line" value="${esc(s.line || 'M31')}" maxlength="20"></label>
          <div class="fld"><span>Darstellung</span><div class="seg">${[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<label><input type="radio" name="theme" value="${k}"${P.ui.theme === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        </div>

        <h3 class="set-h">${icon('clock')}Schichtzeiten</h3>
        <div class="fld-row">${P.SHIFTS.map((x) => `<div class="fld"><span>${x.label}</span><div class="time-row"><input type="time" name="t-${x.k}-from" value="${esc(s.times[x.k].from)}" aria-label="${x.label} Beginn"><span>–</span><input type="time" name="t-${x.k}-to" value="${esc(s.times[x.k].to)}" aria-label="${x.label} Ende"></div></div>`).join('')}</div>
        <small class="muted">Gilt für alle Wochen. Die Zeiten bestimmen auch, welche Schicht gerade «jetzt» ist.</small>

        <h3 class="set-h">${icon('users')}Schichtsystem (4 Gruppen)</h3>
        <div class="fld-row">${s.groups.map((g) => `<div class="fld grp-fld"><span>Gruppe ${g.id}</span><div class="time-row"><input type="color" name="g-${g.id}-color" value="${esc(g.color)}" aria-label="Farbe Gruppe ${g.id}"><input name="g-${g.id}-name" value="${esc(g.name)}" maxlength="24"></div></div>`).join('')}</div>
        <div class="fld-row">
          <label class="fld grow2"><span>Rhythmus</span><select name="preset">${P.PATTERNS.map((x) => `<option value="${x.k}"${preset === x.k ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}<option value="custom"${preset === 'custom' ? ' selected' : ''}>Eigenes Muster</option></select></label>
          <label class="fld"><span>Start (Gruppe A beginnt)</span><input type="date" name="patternStart" value="${esc(s.patternStart)}"></label>
        </div>
        <label class="fld"><span>Muster für Gruppe A – ein Zeichen pro Tag (F, S, N, - = frei)</span><input name="pattern" value="${esc(s.pattern)}" spellcheck="false" autocomplete="off" class="mono"></label>
        <small class="muted">Die Gruppen B, C und D laufen jeweils um ein Viertel der Musterlänge versetzt. Der Rhythmus läuft ab dem Startdatum endlos weiter.</small>
        <div><div id="rot-prev" class="rot-prev"></div></div>

        <h3 class="set-h">${icon('week')}Anlage in Betrieb</h3>
        <div class="fld">${grid}<small class="muted">An nicht angekreuzten Schichten ist die Anlage standardmässig frei. Einzelne Schichten lassen sich im Wochenplan auf Stillstand oder Frei umstellen.</small></div>

        <h3 class="set-h">${icon('download')}Daten</h3>
        <div class="fld"><div class="btn-row">
          <button type="button" class="btn btn-ghost sm" id="set-exp">${icon('download')}Sicherung herunterladen</button>
          <label class="btn btn-ghost sm">${icon('upload')}Sicherung laden<input type="file" accept="application/json,.json" id="set-imp" hidden></label>
          <button type="button" class="btn btn-bad sm" id="set-reset">${icon('trash')}Auf Beispieldaten zurücksetzen</button>
        </div><small class="muted">Alle Daten werden nur auf diesem PC gespeichert. Mit der Sicherung lassen sie sich auf einen anderen PC übertragen.</small></div>`,
      onOk: (f) => {
        const d = P.formData(f);
        const pat = (d.pattern || '').toUpperCase().replace(/[^FSN-]/g, '');
        if (!pat) { f.pattern.classList.add('bad'); f.pattern.focus(); return false; }
        P.ui.theme = f.querySelector('[name=theme]:checked').value;
        P.mutate((db) => {
          const st = db.settings;
          st.line = d.line || 'M31';
          for (const wd of [0, 1, 2, 3, 4, 5, 6]) st.workdays[wd] = P.SHIFTS.filter((x) => d[`wd-${wd}-${x.k}`]).map((x) => x.k);
          for (const x of P.SHIFTS) st.times[x.k] = { from: d[`t-${x.k}-from`] || P.DEFAULT_TIMES[x.k].from, to: d[`t-${x.k}-to`] || P.DEFAULT_TIMES[x.k].to };
          for (const g of st.groups) { g.name = d[`g-${g.id}-name`] || 'Gruppe ' + g.id; g.color = d[`g-${g.id}-color`] || g.color; }
          st.pattern = pat;
          st.patternStart = d.patternStart || st.patternStart;
        }, 'Einstellungen gespeichert.');
      },
    });
    const form = $('#modal form');
    const preview = () => {
      const pat = form.pattern.value.toUpperCase().replace(/[^FSN-]/g, ''), start = form.patternStart.value || P.today();
      const tmp = Object.assign({}, s, { pattern: pat, patternStart: start });
      const real = P.db.settings; P.db.settings = tmp;
      const from = P.monday(P.today()), days = [...Array(14)].map((_, i) => P.addDays(from, i));
      const html = `<table class="rot"><thead><tr><th></th>${days.map((d) => `<th${d === P.today() ? ' class="today"' : ''}>${P.WD[P.wd(d)]}<small>${P.fmtShort(d)}</small></th>`).join('')}</tr></thead><tbody>${tmp.groups.map((g) => `<tr><th>${P.groupChip(g.id)}</th>${days.map((d) => { const c = pat ? P.groupShift(g.id, d) : '-'; return `<td class="rc rc-${c === '-' ? 'X' : c}">${c === '-' ? '' : c}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
      P.db.settings = real;
      $('#rot-prev').innerHTML = pat ? html : '<p class="txt-bad small">Muster fehlt.</p>';
    };
    form.preset.onchange = () => { const x = P.PATTERNS.find((q) => q.k === form.preset.value); if (x) form.pattern.value = x.pattern; preview(); };
    form.pattern.oninput = () => { form.preset.value = (P.PATTERNS.find((q) => q.pattern === form.pattern.value.toUpperCase()) || {}).k || 'custom'; preview(); };
    form.patternStart.onchange = preview;
    preview();
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
        if (!d || (d.v !== 1 && d.v !== 2) || !Array.isArray(d.daily)) { P.toast('Datei ist keine gültige Sicherung.'); return; }
        P.closeModal();
        P.mutate((db) => { Object.keys(db).forEach((k) => delete db[k]); Object.assign(db, P.migrate(d)); }, 'Sicherung geladen.', true);
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
