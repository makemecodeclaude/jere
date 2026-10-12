/* M31 Planung – Seiten */
(function () {
  'use strict';
  const P = window.P;
  const { $, $$, esc, icon } = P;
  P.pages = {};

  const SB = { B: 'Betrieb', S: 'Stillstand' };
  const stateChip = (st, attrs = '') => `<button class="state st-${st}" ${attrs} title="Anlage: ${P.STATES[st]} – klicken zum Ändern">${st === 'X' ? 'Frei' : st === 'S' ? icon('pause') + 'Stillstand' : icon('play') + 'Betrieb'}</button>`;
  const nextState = (st) => ({ B: 'S', S: 'X', X: 'B' }[st]);
  const setState = (dk, sh, st) => P.mutate((db) => {
    const k = P.slot(dk, sh);
    const def = (db.settings.workdays[P.wd(dk)] || []).includes(sh) ? 'B' : 'X';
    if (st === def) delete db.plant[k]; else db.plant[k] = st;
  });
  const legend = () => `<div class="legend">
    <span><i class="lg lg-due"></i>Muss auf dieser Schicht erledigt werden</span>
    <span><i class="lg lg-done"></i>Wurde erledigt</span>
    <span><i class="lg lg-late"></i>Überfällig / offen geblieben</span>
    <span><i class="lg lg-wait"></i>Nur bei Stillstand</span>
  </div>`;
  const whoCell = (item, crew) => {
    const who = item.o.who || [];
    const ids = [...new Set([...crew, ...who])];
    return `<div class="who">${ids.map((id) => { const p = P.person(id); return p ? `<button class="av-t${who.includes(id) ? ' on' : ''}" data-who="${id}" data-key="${esc(item.key)}" aria-pressed="${who.includes(id)}" title="${esc(p.name)} ${who.includes(id) ? 'entfernen' : 'zuteilen'}">${P.avatar(p)}</button>` : ''; }).join('')}<button class="icon-btn sm" data-who-more="${esc(item.key)}" aria-label="Andere Person zuteilen">${icon('plus')}</button></div>`;
  };

  /* toggles a person on an occurrence */
  function bindWho(root) {
    $$('[data-who]', root).forEach((b) => (b.onclick = () => {
      const k = b.dataset.key, id = b.dataset.who;
      P.mutate(() => {
        if (k.startsWith('r|')) { const r = P.db.rev.find((x) => 'r|' + x.id === k); r.who = r.who.includes(id) ? r.who.filter((x) => x !== id) : [...r.who, id]; return; }
        const who = P.occ(k).who || [];
        P.setOcc(k, { who: who.includes(id) ? who.filter((x) => x !== id) : [...who, id] });
      });
    }));
    $$('[data-who-more]', root).forEach((b) => (b.onclick = () => {
      const k = b.dataset.whoMore;
      const cur = k.startsWith('r|') ? P.db.rev.find((x) => 'r|' + x.id === k).who : (P.occ(k).who || []);
      P.pickStaff(b, cur, (ids) => {
        if (k.startsWith('r|')) P.db.rev.find((x) => 'r|' + x.id === k).who = ids;
        else P.setOcc(k, { who: ids });
      }, { title: 'Zuteilen' });
    }));
  }

  /* ==================================================================== WOCHENPLAN */
  P.pages.woche = function (main) {
    const mon = P.monday(P.ui.date), days = [...Array(7)].map((_, i) => P.addDays(mon, i));
    const { w, y } = P.isoWeek(mon), today = P.today();
    const maint = P.weekMaint(mon);
    const revs = P.db.rev.filter((r) => r.date && r.date >= mon && r.date <= days[6]);

    main.innerHTML = `<div class="page">
      <div class="page-h">
        <div><p class="eyebrow">Wochenplan ${esc(P.db.settings.line)}</p><h1>KW ${w} <span class="muted">· ${P.fmtShort(mon)} – ${P.fmtShort(days[6])}${y}</span></h1></div>
        <div class="page-h-r">
          <div class="daynav"><button class="icon-btn" id="w-prev" aria-label="Vorherige Woche">${icon('chevL')}</button><button class="btn btn-ghost sm" id="w-today">Heute</button><button class="icon-btn" id="w-next" aria-label="Nächste Woche">${icon('chevR')}</button></div>
          <button class="btn btn-ghost" id="w-copy" title="Personal-Einteilung und Anlagenstatus der Vorwoche übernehmen">${icon('copy')}Vorwoche übernehmen</button>
          <button class="btn btn-ghost" id="w-auto" title="Offene Aufgaben der ganzen Woche auf das eingeteilte Personal verteilen">${icon('wand')}Woche verteilen</button>
          <button class="btn btn-ghost" id="w-xlsx">${icon('download')}Excel</button>
          <button class="btn btn-ghost" onclick="print()">${icon('print')}Drucken</button>
        </div>
      </div>
      ${legend()}
      <div class="wk" role="grid" aria-label="Schichten KW ${w}">
        <div class="wk-c wk-corner">Schicht</div>
        ${days.map((d) => `<div class="wk-c wk-day${d === today ? ' today' : ''}${P.wd(d) % 6 === 0 ? ' we' : ''}"><b>${P.WD[P.wd(d)]}</b><span>${P.fmtShort(d)}</span></div>`).join('')}
        ${P.SHIFTS.map((s) => `<div class="wk-c wk-sh">${icon(s.icon)}<b>${s.label}</b><small>${s.time}</small></div>${days.map((d) => cell(d, s.k)).join('')}`).join('')}
      </div>

      <div class="cols2">
        <section class="card">
          <div class="card-h"><h2>${icon('wrench')}Wartung KW ${w}</h2><button class="link" data-go="wartung">Wartungsplan →</button></div>
          ${maint.length ? `<ul class="mlist">${maint.map((m) => `<li class="st-${m.status}">
            <label class="chk"><input type="checkbox" data-mdone="${esc(m.key)}"${m.o.done ? ' checked' : ''}><span><b>${esc(m.t.desc)}</b><small>${esc(m.t.comp)}${m.t.aid ? ' · ' + esc(m.t.aid) : ''}${m.status === 'late' ? ` · <em>überfällig seit KW ${P.isoWeek(m.week).w}</em>` : ''}${m.t.weekday || m.t.shift ? ` · geplant ${m.t.weekday ? P.WD[m.t.weekday] : ''} ${m.t.shift || ''}` : ''}</small></span></label>
            <span class="who-s">${(m.o.who || []).map((id) => P.avatar(P.person(id))).join('')}</span></li>`).join('')}</ul>` : '<p class="empty">Diese Woche ist keine Wartung fällig.</p>'}
        </section>
        <section class="card">
          <div class="card-h"><h2>${icon('revision')}Revision diese Woche</h2><button class="link" data-go="revision">Revision →</button></div>
          ${revs.length ? `<ul class="mlist">${revs.map((r) => { const tot = r.steps.filter((x) => !/^[#!]/.test(x)).length, dn = Object.values(r.checked).filter(Boolean).length; return `<li class="st-${r.doneAt ? 'done' : P.state(r.date, r.shift || 'F') === 'S' ? 'due' : 'wait'}"><span><b>${esc(r.comp)}</b><small>${P.fmtDate(r.date)}${r.shift ? ' · ' + P.SHIFT[r.shift].label : ''} · ${dn}/${tot} Punkte</small></span><span class="who-s">${r.who.map((id) => P.avatar(P.person(id))).join('')}</span></li>`; }).join('')}</ul>` : '<p class="empty">Keine Revision eingeplant. Unter «Revision» ein Datum setzen.</p>'}
        </section>
      </div>
    </div>`;

    function cell(dk, sh) {
      const st = P.state(dk, sh), crew = P.crew(dk, sh);
      if (st === 'X') return `<div class="wk-c wk-cell off">${stateChip(st, `data-st="${dk}|${sh}"`)}<span class="muted small">Keine Schicht</span></div>`;
      const c = P.summary(dk, sh);
      const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
      const tone = c.missed ? 'late' : c.total && c.done === c.total ? 'done' : c.open ? 'due' : 'none';
      return `<div class="wk-c wk-cell st-${st}${dk === today && sh === P.nowShift().sh ? ' now' : ''}">
        <div class="wk-top">${stateChip(st, `data-st="${dk}|${sh}"`)}<button class="icon-btn sm" data-crew="${dk}|${sh}" aria-label="Personal einteilen">${icon('users')}</button></div>
        <div class="crew">${crew.length ? crew.map((id) => P.avatar(P.person(id))).join('') : '<span class="txt-bad small">Kein Personal</span>'}</div>
        <button class="wk-open tone-${tone}" data-open="${dk}|${sh}">
          <span class="bar"><i style="width:${pct}%"></i></span>
          <span>${c.done}/${c.total} erledigt${c.missed ? ` · <b>${c.missed} offen</b>` : ''}${c.wait ? ` · ${c.wait} Stillst.` : ''}</span>
        </button>
      </div>`;
    }

    $('#w-prev').onclick = () => { P.ui.date = P.addDays(mon, -7); P.render(); };
    $('#w-next').onclick = () => { P.ui.date = P.addDays(mon, 7); P.render(); };
    $('#w-today').onclick = () => { P.ui.date = P.today(); P.render(); };
    $$('[data-go]', main).forEach((b) => (b.onclick = () => P.go(b.dataset.go)));
    $$('[data-st]', main).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [dk, sh] = b.dataset.st.split('|'); setState(dk, sh, nextState(P.state(dk, sh))); }));
    $$('[data-open]', main).forEach((b) => (b.onclick = () => { const [dk, sh] = b.dataset.open.split('|'); P.go('schicht', { date: dk, shift: sh }); }));
    $$('[data-crew]', main).forEach((b) => (b.onclick = () => crewPicker(b, ...b.dataset.crew.split('|'))));
    $$('[data-mdone]', main).forEach((i) => (i.onchange = () => P.mutate(() => P.setOcc(i.dataset.mdone, { done: i.checked, at: i.checked ? P.stamp() : '' }))));
    $('#w-copy').onclick = () => P.mutate((db) => {
      for (const d of days) for (const s of P.SHIFTS) {
        const src = P.slot(P.addDays(d, -7), s.k), dst = P.slot(d, s.k);
        if (db.roster[src]) db.roster[dst] = db.roster[src].slice(); else delete db.roster[dst];
        if (db.plant[src]) db.plant[dst] = db.plant[src]; else delete db.plant[dst];
      }
    }, 'Einteilung der Vorwoche übernommen.', true);
    $('#w-auto').onclick = () => {
      let n = 0;
      P.mutate(() => { for (const d of days) if (d >= today) for (const s of P.SHIFTS) n += P.autoAssign(d, s.k); });
      P.toast(n ? `${n} Aufgaben verteilt.` : 'Keine offenen, unverteilten Aufgaben ab heute.');
    };
    $('#w-xlsx').onclick = () => exportWeek(days, w);
  };

  function crewPicker(anchor, dk, sh) {
    P.pickStaff(anchor, P.crew(dk, sh), (ids) => { P.db.roster[P.slot(dk, sh)] = ids; }, {
      title: `${P.WD[P.wd(dk)]} ${P.fmtShort(dk)} · ${P.SHIFT[sh].label}`,
      reset: P.db.settings.autoRoster ? 'Standard nach Schichtgruppe' : null,
      onReset: () => P.mutate((db) => delete db.roster[P.slot(dk, sh)]),
    });
  }

  function exportWeek(days, w) {
    const rows = [['Datum', 'Tag', 'Schicht', 'Anlage', 'Personal', 'Art', 'Komponente', 'Aufgabe', 'Std.', 'MA', 'S/B', 'Zugeteilt', 'Status']];
    const stTxt = { done: 'erledigt', due: 'offen', wait: 'nur bei Stillstand', late: 'überfällig', week: 'diese Woche' };
    for (const d of days) for (const s of P.SHIFTS) {
      const st = P.state(d, s.k);
      if (st === 'X') continue;
      const crew = P.crew(d, s.k).map((id) => P.person(id)?.name).filter(Boolean).join(', ');
      const items = P.shiftItems(d, s.k).filter((i) => i.kind !== 'maint' || i.status === 'due' || (i.status === 'done' && i.o.slot === P.slot(d, s.k)));
      if (!items.length) rows.push([P.fmtShort(d), P.WD[P.wd(d)], s.k, P.STATES[st], crew, '', '', '', '', '', '', '', '']);
      for (const i of items) {
        rows.push([P.fmtShort(d), P.WD[P.wd(d)], s.k, P.STATES[st], crew, { daily: 'Täglich', maint: 'Wartung', rev: 'Revision' }[i.kind],
          i.kind === 'daily' ? '' : i.t.comp, i.kind === 'daily' ? i.t.name : i.kind === 'maint' ? i.t.desc : 'Revision',
          i.std ?? '', i.ma ?? '', i.t.sb || '', (i.o.who || []).map((id) => P.person(id)?.name).filter(Boolean).join(', '), stTxt[i.status]]);
      }
    }
    P.downloadXlsx(`${P.db.settings.line}-Wochenplan-KW${w}.xlsx`, `KW ${w}`, rows);
  }

  /* ==================================================================== SCHICHT */
  P.pages.schicht = function (main) {
    const dk = P.ui.date, sh = P.ui.shift, st = P.state(dk, sh), crew = P.crew(dk, sh);
    const items = P.shiftItems(dk, sh);
    const daily = items.filter((i) => i.kind === 'daily');
    const maint = items.filter((i) => i.kind === 'maint');
    const rev = items.filter((i) => i.kind === 'rev');
    const { w } = P.isoWeek(dk);
    const open = items.filter((i) => i.status === 'due' || i.status === 'late').length;

    const row = (i, cells) => `<tr class="st-${i.status}">
      <td class="t-chk"><input type="checkbox" data-done="${esc(i.key)}"${i.o.done ? ' checked' : ''} aria-label="Erledigt"${i.status === 'wait' ? ' title="Nur bei Stillstand"' : ''}></td>
      ${cells}
      <td class="num">${i.std ? P.hrs(i.std) : '–'}</td><td class="num">${i.ma || 1}</td><td><span class="sb sb-${i.t.sb}" title="${SB[i.t.sb]}">${i.t.sb}</span></td>
      <td>${whoCell(i, crew)}</td></tr>`;

    main.innerHTML = `<div class="page">
      <div class="page-h">
        <div><p class="eyebrow">Tägliche Arbeiten ${esc(P.db.settings.line)}</p><h1>${P.fmtLong(dk)}</h1>
          <p class="lead">KW ${w} · ${P.SHIFT[sh].label} ${P.SHIFT[sh].time} Uhr · ${st === 'X' ? 'keine Schicht' : open ? `<b>${open} offen</b>` : 'alles erledigt'}</p></div>
        <div class="page-h-r">
          <div class="daynav"><button class="icon-btn" id="s-prev" aria-label="Vorherige Schicht">${icon('chevL')}</button>
            <label class="date-btn">${icon('today')}<input type="date" id="s-date" value="${dk}" aria-label="Datum"></label>
            <button class="icon-btn" id="s-next" aria-label="Nächste Schicht">${icon('chevR')}</button></div>
          <div class="seg" role="radiogroup" aria-label="Schicht">${P.SHIFTS.map((s) => `<label><input type="radio" name="sh" value="${s.k}"${s.k === sh ? ' checked' : ''}><span>${icon(s.icon)}${s.k}</span></label>`).join('')}</div>
          <button class="btn btn-ghost" id="s-now">Jetzt</button>
          <button class="btn btn-ghost" onclick="print()">${icon('print')}Drucken</button>
        </div>
      </div>

      <div class="shift-bar">
        <div class="sb-i"><small>Anlage</small>${stateChip(st, 'id="s-state"')}</div>
        <div class="sb-i grow"><small>Personal</small><div class="crew big">${crew.map((id) => { const p = P.person(id); return p ? `<span class="crew-p">${P.avatar(p)}<span>${esc(p.name)}<em>${P.hrs(P.personHours(id, items))}</em></span></span>` : ''; }).join('') || '<span class="txt-bad">Niemand eingeteilt</span>'}
          <button class="btn btn-ghost sm" id="s-crew">${icon('users')}Einteilen</button></div></div>
        <div class="sb-i"><small>&nbsp;</small><button class="btn btn-primary" id="s-auto"${!crew.length || st === 'X' ? ' disabled' : ''}>${icon('wand')}Automatisch verteilen</button></div>
      </div>
      ${legend()}

      ${st === 'X' ? `<div class="banner tone-neutral">${icon('info')}<span>Für diese Schicht ist die Anlage nicht eingeplant. Über den Status «Frei» lässt sie sich aktivieren.</span></div>` : `
      <h2 class="h2">${icon('list')}Tägliche Arbeiten <span class="count">${daily.length}</span></h2>
      ${daily.length ? `<div class="tbl-wrap"><table class="tbl plan">
        <thead><tr><th class="t-chk">✓</th><th>Aufgabe</th><th>Intervall</th><th class="num">Std.</th><th class="num">MA</th><th>S/B</th><th>Zugeteilt</th></tr></thead>
        <tbody>${daily.map((i) => row(i, `<td><b>${esc(i.t.name)}</b>${i.t.note ? `<small class="block muted">${esc(i.t.note)}</small>` : ''}${i.o.done && i.o.at ? `<small class="block muted">erledigt ${esc(i.o.at.slice(11))}</small>` : ''}</td><td class="nowrap">${esc(P.INTERVAL_SHORT[i.t.interval])}</td>`)).join('')}</tbody>
      </table></div>` : '<p class="empty">Auf dieser Schicht sind keine täglichen Arbeiten fällig.</p>'}

      <h2 class="h2">${icon('wrench')}Wartung KW ${w} <span class="count">${maint.length}</span><small>fällig diese Woche – auf einer beliebigen Schicht erledigen</small></h2>
      ${maint.length ? `<div class="tbl-wrap"><table class="tbl plan">
        <thead><tr><th class="t-chk">✓</th><th>Komponente</th><th>Beschreibung</th><th>Hilfsmittel</th><th>Zyklus</th><th class="num">Std.</th><th class="num">MA</th><th>S/B</th><th>Zugeteilt</th></tr></thead>
        <tbody>${maint.map((i) => row(i, `<td>${esc(i.t.comp)}</td><td><b>${esc(i.t.desc)}</b>${i.status === 'late' ? `<small class="block txt-bad">überfällig seit KW ${P.isoWeek(i.week).w}</small>` : ''}${i.t.weekday || i.t.shift ? `<small class="block muted">geplant ${i.t.weekday ? P.WDL[i.t.weekday] : ''} ${i.t.shift ? P.SHIFT[i.t.shift].label : ''}</small>` : ''}${i.o.done && i.o.at ? `<small class="block muted">erledigt ${esc(i.o.at)}</small>` : ''}${i.t.needWeight ? `<label class="weight">Gewicht <input type="number" step="0.1" min="0" data-weight="${esc(i.key)}" value="${i.o.weight ?? ''}"> kg</label>` : ''}</td><td class="muted">${esc(i.t.aid || '')}</td><td class="nowrap">${P.cycleLabel(i.t)}</td>`)).join('')}</tbody>
      </table></div>` : '<p class="empty">Diese Woche ist keine Wartung fällig.</p>'}

      ${rev.length ? `<h2 class="h2">${icon('revision')}Revision</h2><div class="tbl-wrap"><table class="tbl plan"><tbody>${rev.map((i) => `<tr class="st-${i.status}"><td><b>${esc(i.t.comp)}</b><small class="block muted">${i.progress[0]}/${i.progress[1]} Punkte erledigt${i.status === 'wait' ? ' · Anlage muss im Stillstand sein' : ''}</small></td><td>${whoCell(i, crew)}</td><td class="t-act"><button class="btn btn-soft sm" data-go-rev="${i.t.id}">Checkliste öffnen</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      `}
    </div>`;

    const step = (n) => {
      const order = ['F', 'S', 'N'];
      let i = order.indexOf(sh) + n, d = dk;
      if (i < 0) { i = 2; d = P.addDays(d, -1); }
      if (i > 2) { i = 0; d = P.addDays(d, 1); }
      P.ui.date = d; P.ui.shift = order[i]; P.render();
    };
    $('#s-prev').onclick = () => step(-1);
    $('#s-next').onclick = () => step(1);
    $('#s-date').onchange = (e) => { if (e.target.value) { P.ui.date = e.target.value; P.render(); } };
    $('#s-now').onclick = () => { const n = P.nowShift(); P.ui.date = n.dk; P.ui.shift = n.sh; P.render(); };
    $$('[name=sh]', main).forEach((r) => (r.onchange = () => { P.ui.shift = r.value; P.render(); }));
    $('#s-state').onclick = () => setState(dk, sh, nextState(st));
    $('#s-crew').onclick = (e) => crewPicker(e.currentTarget, dk, sh);
    $('#s-auto').onclick = () => { let n = 0; P.mutate(() => { n = P.autoAssign(dk, sh); }); P.toast(n ? `${n} Aufgaben verteilt.` : 'Alle offenen Aufgaben sind bereits zugeteilt.'); };
    $$('[data-done]', main).forEach((c) => (c.onchange = () => P.mutate(() => P.setOcc(c.dataset.done, { done: c.checked, at: c.checked ? P.stamp() : '', slot: c.checked ? P.slot(dk, sh) : '' }))));
    $$('[data-weight]', main).forEach((i) => (i.onchange = () => P.mutate(() => P.setOcc(i.dataset.weight, { weight: i.value === '' ? null : Number(i.value) }), 'Gewicht gespeichert.')));
    $$('[data-go-rev]', main).forEach((b) => (b.onclick = () => { P.ui.revFocus = b.dataset.goRev; P.go('revision'); }));
    bindWho(main);
  };

  /* ==================================================================== WARTUNGSPLAN */
  P.pages.wartung = function (main) {
    const base = P.monday(P.ui.wDate || P.today());
    const weeks = [...Array(12)].map((_, i) => P.addDays(base, (i - 2) * 7));
    const nowMon = P.monday(P.today());
    const rows = P.db.maint;
    const late = P.weekMaint(P.today()).filter((m) => m.status === 'late');

    main.innerHTML = `<div class="page">
      <div class="page-h">
        <div><p class="eyebrow">Arbeits- und Wartungsplan ${esc(P.db.settings.line)}</p><h1>Wartungsplan</h1>
          <p class="lead">Gelb = in dieser KW fällig, grün = erledigt, rot = überfällig. Feld anklicken, um es abzuhaken.</p></div>
        <div class="page-h-r">
          <div class="daynav"><button class="icon-btn" id="m-prev" aria-label="Früher">${icon('chevL')}</button><button class="btn btn-ghost sm" id="m-today">Aktuelle KW</button><button class="icon-btn" id="m-next" aria-label="Später">${icon('chevR')}</button></div>
          <button class="btn btn-ghost" id="m-add">${icon('plus')}Wartungsarbeit</button>
          <button class="btn btn-ghost" onclick="print()">${icon('print')}Drucken</button>
        </div>
      </div>
      ${late.length ? `<div class="banner tone-bad">${icon('alert')}<span><b>${late.length} überfällig:</b> ${late.map((m) => esc(m.t.desc)).join(' · ')}</span></div>` : ''}
      <div class="tbl-wrap"><table class="tbl mplan">
        <thead><tr><th>Komponente</th><th>Beschreibung</th><th>Hilfsmittel / Beschreibung</th><th>Zyklus</th><th class="num">KW Start</th><th>Wann</th><th class="num">Std.</th><th class="num">MA</th><th>S/B</th>
          ${weeks.map((wk) => `<th class="kw${wk === nowMon ? ' now' : ''}">KW ${P.isoWeek(wk).w}<small>${P.fmtShort(wk)}</small></th>`).join('')}</tr></thead>
        <tbody>${rows.map((t) => `<tr>
          <td class="nowrap">${esc(t.comp)}</td><td><button class="link" data-edit="${t.id}">${esc(t.desc)}</button></td><td class="muted">${esc(t.aid || '')}</td>
          <td class="nowrap">${P.cycleShort(t)}</td><td class="num">${t.kw}</td>
          <td class="nowrap small">${t.weekday || t.shift ? `${t.weekday ? P.WD[t.weekday] : ''} ${t.shift || ''}` : '<span class="muted">flexibel</span>'}</td>
          <td class="num">${t.std ? P.hrs(t.std) : '–'}</td><td class="num">${t.ma || 1}</td><td><span class="sb sb-${t.sb}">${t.sb}</span></td>
          ${weeks.map((wk) => {
            if (!P.maintDue(t, P.absWeek(wk))) return `<td class="kc${wk === nowMon ? ' now' : ''}"></td>`;
            const k = P.kMaint(t, wk), o = P.occ(k);
            const s = o.done ? 'done' : P.dayNum(wk) >= P.dayNum(nowMon) ? 'due' : P.tracked(wk) ? 'late' : 'past';
            return `<td class="kc${wk === nowMon ? ' now' : ''}"><button class="kbtn st-${s}" data-k="${esc(k)}" title="${esc(t.desc)} · KW ${P.isoWeek(wk).w}: ${s === 'done' ? 'erledigt ' + (o.at || '') : s === 'late' ? 'überfällig' : s === 'past' ? 'vor Beginn der Planung' : 'fällig'}${o.weight != null ? ' · ' + o.weight + ' kg' : ''}">${s === 'done' ? icon('check') : ''}${o.who && o.who.length ? `<i>${o.who.map((id) => esc(P.person(id)?.short || '')).join(' ')}</i>` : ''}</button></td>`;
          }).join('')}
        </tr>`).join('') || `<tr><td colspan="${9 + weeks.length}" class="empty">Noch keine Wartungsarbeiten erfasst.</td></tr>`}</tbody>
      </table></div>
    </div>`;

    $('#m-prev').onclick = () => { P.ui.wDate = P.addDays(base, -28); P.render(); };
    $('#m-next').onclick = () => { P.ui.wDate = P.addDays(base, 28); P.render(); };
    $('#m-today').onclick = () => { P.ui.wDate = null; P.render(); };
    $('#m-add').onclick = () => P.editMaint();
    $$('[data-edit]', main).forEach((b) => (b.onclick = () => P.editMaint(P.db.maint.find((t) => t.id === b.dataset.edit))));
    $$('[data-k]', main).forEach((b) => (b.onclick = () => {
      const k = b.dataset.k, done = !P.occ(k).done;
      P.mutate(() => P.setOcc(k, { done, at: done ? P.stamp() : '' }));
    }));
  };

  /* ==================================================================== REVISION */
  P.pages.revision = function (main) {
    main.innerHTML = `<div class="page">
      <div class="page-h">
        <div><p class="eyebrow">Revision ${esc(P.db.settings.line)}</p><h1>Revision</h1>
          <p class="lead">Arbeiten während des Stillstands. Datum und Schicht setzen, Personen zuteilen und die Punkte abhaken. Geplante Revisionen erscheinen auch in der Schicht-Ansicht.</p></div>
        <div class="page-h-r"><button class="btn btn-ghost" id="r-add">${icon('plus')}Revisionsarbeit</button><button class="btn btn-ghost" onclick="print()">${icon('print')}Drucken</button></div>
      </div>
      <div class="rgrid">${P.db.rev.map(card).join('') || '<p class="empty">Noch keine Revisionsarbeiten erfasst.</p>'}</div>
    </div>`;

    function card(r) {
      const tot = r.steps.filter((s) => !/^[#!]/.test(s)).length, dn = r.steps.filter((s, i) => !/^[#!]/.test(s) && r.checked[i]).length;
      const st = r.doneAt ? 'done' : r.date ? 'due' : 'none';
      const notS = r.date && !r.doneAt && P.state(r.date, r.shift || 'F') !== 'S';
      return `<article class="rcard st-${st}" id="rev-${r.id}">
        <header><div><h2>${esc(r.comp)}</h2><small>${dn}/${tot} Punkte${r.doneAt ? ' · erledigt ' + esc(r.doneAt) : ''}</small></div>
          <span class="chip tone-${st === 'done' ? 'ok' : st === 'due' ? 'warn' : 'muted'}">${st === 'done' ? 'Erledigt' : st === 'due' ? 'Geplant' : 'Nicht geplant'}</span>
          <button class="icon-btn sm" data-redit="${r.id}" aria-label="Bearbeiten">${icon('edit')}</button></header>
        <div class="bar"><i style="width:${tot ? Math.round((dn / tot) * 100) : 0}%"></i></div>
        <div class="rplan">
          <label>Datum <input type="date" data-rdate="${r.id}" value="${esc(r.date)}"></label>
          <label>Schicht <select data-rshift="${r.id}"><option value="">ganzer Tag</option>${P.SHIFTS.map((s) => `<option value="${s.k}"${r.shift === s.k ? ' selected' : ''}>${s.label}</option>`).join('')}</select></label>
          <div class="who-s">${r.who.map((id) => P.avatar(P.person(id))).join('')}<button class="icon-btn sm" data-who-more="r|${r.id}" aria-label="Personen zuteilen">${icon('users')}</button></div>
        </div>
        ${notS ? `<div class="banner tone-warn small">${icon('alert')}<span>Anlage ist an diesem Datum nicht im Stillstand.</span><button class="btn btn-ghost sm" data-rstill="${r.id}">Stillstand setzen</button></div>` : ''}
        <ul class="steps">${r.steps.map((s, i) => s.startsWith('#') ? `<li class="st-h">${esc(s.slice(1).trim())}</li>` : s.startsWith('!') ? `<li class="st-w">${icon('alert')}${esc(s.slice(1).trim())}</li>` : `<li><label class="chk"><input type="checkbox" data-step="${r.id}|${i}"${r.checked[i] ? ' checked' : ''}><span>${esc(s)}</span></label></li>`).join('')}</ul>
        ${r.docs ? `<p class="docs">${icon('doc')}<span>${esc(r.docs)}</span></p>` : ''}
        <footer>${r.doneAt || dn ? `<button class="btn btn-ghost sm" data-rreset="${r.id}">Zurücksetzen</button>` : ''}${!r.doneAt ? `<button class="btn btn-primary sm" data-rdone="${r.id}"${dn < tot ? ' title="Noch nicht alle Punkte abgehakt"' : ''}>${icon('check')}Als erledigt markieren</button>` : ''}</footer>
      </article>`;
    }
    const R = (id) => P.db.rev.find((r) => r.id === id);
    $('#r-add').onclick = () => P.editRev();
    $$('[data-redit]', main).forEach((b) => (b.onclick = () => P.editRev(R(b.dataset.redit))));
    $$('[data-rdate]', main).forEach((i) => (i.onchange = () => P.mutate(() => { R(i.dataset.rdate).date = i.value; })));
    $$('[data-rshift]', main).forEach((i) => (i.onchange = () => P.mutate(() => { R(i.dataset.rshift).shift = i.value; })));
    $$('[data-rstill]', main).forEach((b) => (b.onclick = () => { const r = R(b.dataset.rstill); P.mutate((db) => { (r.shift ? [r.shift] : ['F', 'S', 'N']).forEach((s) => (db.plant[P.slot(r.date, s)] = 'S')); }, 'Stillstand im Wochenplan gesetzt.', true); }));
    $$('[data-step]', main).forEach((c) => (c.onchange = () => P.mutate(() => {
      const [id, i] = c.dataset.step.split('|'), r = R(id);
      if (c.checked) r.checked[i] = true; else delete r.checked[i];
    })));
    $$('[data-rdone]', main).forEach((b) => (b.onclick = () => P.mutate(() => { R(b.dataset.rdone).doneAt = P.stamp(); }, 'Revision als erledigt markiert.', true)));
    $$('[data-rreset]', main).forEach((b) => (b.onclick = () => P.mutate(() => { const r = R(b.dataset.rreset); r.checked = {}; r.doneAt = ''; }, 'Checkliste zurückgesetzt.', true)));
    bindWho(main);
    if (P.ui.revFocus) { const el = $('#rev-' + P.ui.revFocus); P.ui.revFocus = null; if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); } }
  };

  /* ==================================================================== TEAM */
  P.pages.team = function (main) {
    const mon = P.monday(P.ui.date), days = [...Array(7)].map((_, i) => P.addDays(mon, i));
    const { w } = P.isoWeek(mon), s = P.db.settings;
    const stats = Object.fromEntries(P.db.staff.map((p) => [p.id, { shifts: 0, tasks: 0, hrs: 0 }]));
    for (const d of days) for (const sh of P.SHIFTS) {
      if (P.state(d, sh.k) === 'X') continue;
      const items = P.shiftItems(d, sh.k);
      for (const id of P.crew(d, sh.k)) if (stats[id]) stats[id].shifts++;
      for (const i of items) for (const id of i.o.who || []) if (stats[id] && (i.kind !== 'maint' || i.status !== 'week')) { stats[id].tasks++; stats[id].hrs += (i.std || 0.25) / i.o.who.length; }
    }

    main.innerHTML = `<div class="page">
      <div class="page-h">
        <div><p class="eyebrow">Team ${esc(s.line)}</p><h1>Mitarbeitende</h1><p class="lead">Die Schichtgruppe bestimmt, wer standardmässig auf welcher Schicht eingeteilt ist. Einzelne Schichten passt du im Wochenplan an.</p></div>
        <div class="page-h-r"><button class="btn btn-primary" id="t-add">${icon('plus')}Person erfassen</button></div>
      </div>
      <section class="card opts">
        <label class="chk"><input type="checkbox" id="t-auto"${s.autoRoster ? ' checked' : ''}><span><b>Automatisch nach Schichtgruppe einteilen</b><small class="block muted">Wer der Gruppe F, S oder N angehört, erscheint auf jeder aktiven Schicht dieser Gruppe.</small></span></label>
        <label class="chk"><input type="checkbox" id="t-rot"${s.rotate ? ' checked' : ''}${s.autoRoster ? '' : ' disabled'}><span><b>Schichtgruppen wöchentlich rotieren</b><small class="block muted">Jede Woche wechselt die Gruppe: Früh → Spät → Nacht.</small></span></label>
      </section>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th></th><th>Name</th><th>Schichtgruppe</th><th class="num">Schichten KW ${w}</th><th class="num">Aufgaben KW ${w}</th><th class="num">Std. (geschätzt)</th><th></th></tr></thead>
        <tbody>${P.db.staff.map((p) => `<tr>
          <td style="width:44px">${P.avatar(p)}</td><td><b>${esc(p.name)}</b></td>
          <td>${p.group ? `${P.SHIFT[p.group].label}${s.rotate ? ` <small class="muted">(KW ${w}: ${P.groupFor(p, mon)})</small>` : ''}` : '<span class="muted">keine (nur manuell)</span>'}</td>
          <td class="num">${stats[p.id].shifts}</td><td class="num">${stats[p.id].tasks}</td><td class="num">${P.hrs(stats[p.id].hrs)}</td>
          <td class="t-act"><button class="icon-btn sm" data-pedit="${p.id}" aria-label="Bearbeiten">${icon('edit')}</button><button class="icon-btn sm" data-pdel="${p.id}" aria-label="Löschen">${icon('trash')}</button></td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty">Noch niemand erfasst.</td></tr>'}</tbody>
      </table></div>
      <p class="muted small">Für Aufgaben ohne Std.-Angabe werden 15 Minuten gerechnet.</p>
    </div>`;

    $('#t-add').onclick = () => editPerson();
    $('#t-auto').onchange = (e) => P.mutate((db) => { db.settings.autoRoster = e.target.checked; });
    $('#t-rot').onchange = (e) => P.mutate((db) => { db.settings.rotate = e.target.checked; });
    $$('[data-pedit]', main).forEach((b) => (b.onclick = () => editPerson(P.person(b.dataset.pedit))));
    $$('[data-pdel]', main).forEach((b) => (b.onclick = () => {
      const p = P.person(b.dataset.pdel);
      P.mutate((db) => { db.staff = db.staff.filter((x) => x.id !== p.id); }, `${p.name} gelöscht.`, true);
    }));
  };

  function editPerson(p) {
    const used = P.db.staff.map((x) => x.color);
    const color = p ? p.color : P.COLORS.find((c) => !used.includes(c)) || P.COLORS[0];
    P.modal({
      title: p ? 'Person bearbeiten' : 'Person erfassen',
      body: `<label class="fld"><span>Name</span><input name="name" required value="${esc(p?.name || '')}" placeholder="Vorname Nachname"></label>
        <div class="fld-row"><label class="fld"><span>Kürzel</span><input name="short" maxlength="3" value="${esc(p?.short || '')}" placeholder="z. B. MS"></label>
        <label class="fld"><span>Farbe</span><input type="color" name="color" value="${esc(color)}"></label></div>
        <label class="fld"><span>Schichtgruppe</span><select name="group"><option value="">keine (nur manuell einteilen)</option>${P.SHIFTS.map((s) => `<option value="${s.k}"${p?.group === s.k ? ' selected' : ''}>${s.label} (${s.k})</option>`).join('')}</select></label>`,
      onOk: (f) => {
        const d = P.formData(f);
        if (!d.name) { f.name.focus(); f.name.classList.add('bad'); return false; }
        d.short = (d.short || d.name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2)).toUpperCase();
        P.mutate((db) => { if (p) Object.assign(p, d); else db.staff.push(Object.assign({ id: P.newId('p') }, d)); }, p ? 'Gespeichert.' : `${d.name} erfasst.`);
      },
    });
  }

  /* ==================================================================== AUFGABEN */
  P.pages.aufgaben = function (main) {
    const tab = P.ui.aufgabenTab;
    const tabs = [['daily', 'Tägliche Arbeiten', P.db.daily.length], ['maint', 'Wartung', P.db.maint.length], ['rev', 'Revision', P.db.rev.length]];
    let tbl = '';
    if (tab === 'daily') tbl = `<table class="tbl"><thead><tr><th>Tägliche Arbeit</th><th>Intervall</th><th class="num">Std.</th><th class="num">MA</th><th>S/B</th><th></th></tr></thead><tbody>
      ${P.db.daily.map((t) => `<tr><td><b>${esc(t.name)}</b>${t.note ? `<small class="block muted">${esc(t.note)}</small>` : ''}</td><td>${esc(P.INTERVAL[t.interval])}</td><td class="num">${t.std ? P.hrs(t.std) : '–'}</td><td class="num">${t.ma || 1}</td><td><span class="sb sb-${t.sb}">${t.sb}</span></td>${acts(t.id)}</tr>`).join('') || '<tr><td colspan="6" class="empty">Keine Einträge.</td></tr>'}</tbody></table>`;
    if (tab === 'maint') tbl = `<table class="tbl"><thead><tr><th>Komponente</th><th>Beschreibung</th><th>Hilfsmittel</th><th>Zyklus</th><th class="num">KW Start</th><th>Nächste</th><th class="num">Std.</th><th class="num">MA</th><th>S/B</th><th></th></tr></thead><tbody>
      ${P.db.maint.map((t) => { const n = P.nextDue(t, P.today()); return `<tr><td>${esc(t.comp)}</td><td><b>${esc(t.desc)}</b></td><td class="muted">${esc(t.aid || '')}</td><td class="nowrap">${P.cycleLabel(t)}</td><td class="num">${t.kw} / ${t.year}</td><td class="nowrap">${n ? 'KW ' + P.isoWeek(n).w : '–'}</td><td class="num">${t.std ? P.hrs(t.std) : '–'}</td><td class="num">${t.ma || 1}</td><td><span class="sb sb-${t.sb}">${t.sb}</span></td>${acts(t.id)}</tr>`; }).join('') || '<tr><td colspan="10" class="empty">Keine Einträge.</td></tr>'}</tbody></table>`;
    if (tab === 'rev') tbl = `<table class="tbl"><thead><tr><th>Komponente</th><th class="num">Punkte</th><th>Unterlagen</th><th></th></tr></thead><tbody>
      ${P.db.rev.map((r) => `<tr><td><b>${esc(r.comp)}</b></td><td class="num">${r.steps.filter((s) => !/^[#!]/.test(s)).length}</td><td class="muted small">${esc(r.docs || '')}</td>${acts(r.id)}</tr>`).join('') || '<tr><td colspan="4" class="empty">Keine Einträge.</td></tr>'}</tbody></table>`;

    main.innerHTML = `<div class="page">
      <div class="page-h">
        <div><p class="eyebrow">Stammdaten ${esc(P.db.settings.line)}</p><h1>Aufgaben verwalten</h1><p class="lead">Hier legst du fest, welche Arbeiten es gibt und wie oft sie fällig sind. Die Pläne berechnen sich daraus automatisch.</p></div>
        <div class="page-h-r"><button class="btn btn-primary" id="a-add">${icon('plus')}Neue Aufgabe</button></div>
      </div>
      <div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" class="tab${k === tab ? ' on' : ''}" aria-selected="${k === tab}" data-tab="${k}">${l}<span class="count">${n}</span></button>`).join('')}</div>
      <div class="tbl-wrap">${tbl}</div>
    </div>`;

    function acts(id) { return `<td class="t-act"><button class="icon-btn sm" data-aedit="${id}" aria-label="Bearbeiten">${icon('edit')}</button><button class="icon-btn sm" data-adel="${id}" aria-label="Löschen">${icon('trash')}</button></td>`; }
    const list = { daily: 'daily', maint: 'maint', rev: 'rev' }[tab];
    const edit = { daily: P.editDaily, maint: P.editMaint, rev: P.editRev }[tab];
    $$('[data-tab]', main).forEach((b) => (b.onclick = () => { P.ui.aufgabenTab = b.dataset.tab; P.render(); }));
    $('#a-add').onclick = () => edit();
    $$('[data-aedit]', main).forEach((b) => (b.onclick = () => edit(P.db[list].find((t) => t.id === b.dataset.aedit))));
    $$('[data-adel]', main).forEach((b) => (b.onclick = () => {
      const t = P.db[list].find((x) => x.id === b.dataset.adel);
      P.mutate((db) => { db[list] = db[list].filter((x) => x.id !== t.id); }, `«${t.name || t.desc || t.comp}» gelöscht.`, true);
    }));
  };

  const sbSelect = (v) => `<label class="fld"><span>S/B</span><select name="sb"><option value="B"${v !== 'S' ? ' selected' : ''}>B – im Betrieb möglich</option><option value="S"${v === 'S' ? ' selected' : ''}>S – nur im Stillstand</option></select></label>`;
  const stdMa = (t) => `<label class="fld"><span>Std. (Dauer in h)</span><input type="number" name="std" min="0" step="0.05" value="${t?.std ?? ''}" placeholder="z. B. 0.25"></label>
    <label class="fld"><span>MA (Anzahl Personen)</span><input type="number" name="ma" min="1" max="10" step="1" value="${t?.ma ?? 1}"></label>`;

  P.editDaily = function (t) {
    P.modal({
      title: t ? 'Tägliche Arbeit bearbeiten' : 'Neue tägliche Arbeit',
      body: `<label class="fld"><span>Tägliche Arbeit</span><input name="name" value="${esc(t?.name || '')}" placeholder="z. B. Boden um Anlage kehren"></label>
        <label class="fld"><span>Intervall</span><select name="interval">${P.INTERVALS.map(([k, l]) => `<option value="${k}"${(t?.interval || 'jede') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="fld-row">${stdMa(t)}${sbSelect(t?.sb)}</div>
        <label class="fld"><span>Hinweis (optional)</span><input name="note" value="${esc(t?.note || '')}"></label>`,
      onOk: (f) => {
        const d = P.formData(f);
        if (!d.name) { f.name.classList.add('bad'); f.name.focus(); return false; }
        P.mutate((db) => { if (t) Object.assign(t, d); else db.daily.push(Object.assign({ id: P.newId('d') }, d)); }, t ? 'Gespeichert.' : 'Aufgabe erfasst.');
      },
    });
  };

  P.editMaint = function (t) {
    const nowW = P.isoWeek(P.today());
    P.modal({
      title: t ? 'Wartungsarbeit bearbeiten' : 'Neue Wartungsarbeit', wide: true,
      body: `<div class="fld-row"><label class="fld"><span>Komponente</span><input name="comp" list="comp-list" value="${esc(t?.comp || '')}" placeholder="z. B. Extruder"></label>
        <datalist id="comp-list">${[...new Set(P.db.maint.map((m) => m.comp))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <label class="fld grow2"><span>Beschreibung Reinigungs- resp. Wartungsarbeit</span><input name="desc" value="${esc(t?.desc || '')}"></label></div>
        <label class="fld"><span>Hilfsmittel / Beschreibung</span><input name="aid" value="${esc(t?.aid || '')}"></label>
        <div class="fld-row">
          <label class="fld"><span>Zyklus</span><input type="number" name="cycle" min="1" max="52" value="${t?.cycle ?? 1}"></label>
          <label class="fld"><span>Einheit</span><select name="unit"><option value="W"${t?.unit !== 'M' ? ' selected' : ''}>Wochen</option><option value="M"${t?.unit === 'M' ? ' selected' : ''}>Monate</option></select></label>
          <label class="fld"><span>KW Start</span><input type="number" name="kw" min="1" max="53" value="${t?.kw ?? nowW.w}"></label>
          <label class="fld"><span>Jahr</span><input type="number" name="year" min="2020" max="2100" value="${t?.year ?? nowW.y}"></label>
        </div>
        <div class="fld-row">
          <label class="fld"><span>Wochentag (optional)</span><select name="weekday"><option value="">flexibel</option>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}"${String(t?.weekday) === String(d) ? ' selected' : ''}>${P.WDL[d]}</option>`).join('')}</select></label>
          <label class="fld"><span>Schicht (optional)</span><select name="shift"><option value="">flexibel</option>${P.SHIFTS.map((s) => `<option value="${s.k}"${t?.shift === s.k ? ' selected' : ''}>${s.label}</option>`).join('')}</select></label>
          ${stdMa(t)}${sbSelect(t?.sb)}
        </div>
        <label class="chk"><input type="checkbox" name="needWeight"${t?.needWeight ? ' checked' : ''}><span>Gewicht beim Erledigen eintragen</span></label>`,
      onOk: (f) => {
        const d = P.formData(f);
        if (!d.desc) { f.desc.classList.add('bad'); f.desc.focus(); return false; }
        d.cycle = Math.max(1, d.cycle || 1); d.kw = Math.min(53, Math.max(1, d.kw || 1)); d.year = d.year || nowW.y;
        P.mutate((db) => { if (t) Object.assign(t, d); else db.maint.push(Object.assign({ id: P.newId('m') }, d)); }, t ? 'Gespeichert.' : 'Wartungsarbeit erfasst.');
      },
    });
  };

  P.editRev = function (r) {
    P.modal({
      title: r ? 'Revisionsarbeit bearbeiten' : 'Neue Revisionsarbeit', wide: true,
      body: `<label class="fld"><span>Komponente</span><input name="comp" value="${esc(r?.comp || '')}" placeholder="z. B. Walze 1"></label>
        <label class="fld"><span>Arbeitsschritte – eine Zeile pro Punkt</span><textarea name="steps" rows="10" placeholder="# Überschrift&#10;! Sicherheitshinweis&#10;Filter reinigen">${esc((r?.steps || []).join('\n'))}</textarea>
          <small class="muted">Zeilen mit <b>#</b> werden zur Überschrift, Zeilen mit <b>!</b> zum Warnhinweis.</small></label>
        <label class="fld"><span>Unterlagen / Bemerkungen</span><textarea name="docs" rows="3">${esc(r?.docs || '')}</textarea></label>`,
      onOk: (f) => {
        const d = P.formData(f);
        if (!d.comp) { f.comp.classList.add('bad'); f.comp.focus(); return false; }
        const steps = f.steps.value.split('\n').map((s) => s.trim()).filter(Boolean);
        P.mutate((db) => {
          if (r) { if (steps.join('\n') !== r.steps.join('\n')) r.checked = {}; Object.assign(r, { comp: d.comp, docs: d.docs, steps }); }
          else db.rev.push({ id: P.newId('r'), comp: d.comp, docs: d.docs, steps, date: '', shift: '', who: [], checked: {}, doneAt: '' });
        }, r ? 'Gespeichert.' : 'Revisionsarbeit erfasst.');
      },
    });
  };
})();
