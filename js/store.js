/* M31 Planung – Speicherung im Browser, Sync zwischen Tabs, Planungslogik */
(function () {
  'use strict';
  const P = window.P;
  const DB_KEY = 'm31-plan-db-v1', UI_KEY = 'm31-plan-ui-v1';

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  };
  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

  P.ui = Object.assign({ page: 'woche', date: null, shift: null, theme: 'system', aufgabenTab: 'daily', layers: {} }, parse(ls.get(UI_KEY)) || {});
  P.saveUi = P.debounce(() => ls.set(UI_KEY, JSON.stringify(P.ui)), 150);

  /* bring older saves up to the current shape */
  P.migrate = function (db) {
    const def = P.defaultSettings();
    db.settings = Object.assign({}, def, db.settings || {});
    db.settings.times = Object.assign({}, def.times, db.settings.times || {});
    if (!Array.isArray(db.settings.groups) || db.settings.groups.length !== 4) db.settings.groups = def.groups;
    if (!db.settings.since) db.settings.since = P.today();
    if (db.v === 1) {
      // Schichtgruppen F/S/N → A/B/C, Wartungs-Häkchen → Erledigt-Liste je Aufgabe
      const map = { F: 'A', S: 'B', N: 'C' };
      for (const p of db.staff) { p.group = map[p.group] || ''; p.partner = p.partner || ''; }
      for (const t of db.maint) t.done = t.done || [];
      for (const [k, o] of Object.entries(db.occ)) {
        if (!k.startsWith('m|')) continue;
        const [, tid, planned] = k.split('|');
        const t = db.maint.find((x) => x.id === tid);
        if (t && o.done) t.done.push({ date: o.date || (o.at || '').slice(0, 10) || planned, slot: o.slot || '', who: o.who || [], weight: o.weight ?? null, at: o.at || '' });
        if (o.done) delete db.occ[k];
      }
      delete db.settings.autoRoster; delete db.settings.rotate;
      db.v = 2;
    }
    for (const t of db.maint) t.done = t.done || [];
    for (const p of db.staff) if (p.partner && !db.staff.some((x) => x.id === p.partner)) p.partner = '';
    return db;
  };

  P.load = function () {
    const s = parse(ls.get(DB_KEY));
    P.db = s && (s.v === 1 || s.v === 2) ? P.migrate(s) : P.seed();
    P.save(true);
  };

  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('m31-plan') : null;
  const tab = P.uid('t');
  P.rev = 0;
  P.save = function (silent) {
    P.rev++;
    if (!ls.set(DB_KEY, JSON.stringify(P.db))) P.storageWarn = true;
    if (!silent && chan) chan.postMessage({ from: tab });
  };
  const remote = () => { const s = parse(ls.get(DB_KEY)); if (s) { P.db = P.migrate(s); P.rev++; P.render(); } };
  if (chan) chan.onmessage = (e) => { if (e.data && e.data.from !== tab) remote(); };

  /* every write goes through here */
  P.mutate = function (fn, msg, undoable) {
    const before = undoable ? JSON.stringify(P.db) : null;
    fn(P.db);
    P.save();
    P.render();
    if (msg) P.toast(msg, before ? () => { P.db = JSON.parse(before); P.save(); P.render(); } : null);
  };
  P.newId = (p) => p + P.db.seq++;

  /* ---------------------------------------------------------------- lookups */
  P.person = (id) => P.db.staff.find((s) => s.id === id);
  P.partnerOf = (id) => { const p = P.person(id); return p && p.partner ? P.person(p.partner) : null; };
  P.slot = (dk, sh) => `${dk}|${sh}`;
  P.group = (gid) => P.db.settings.groups.find((g) => g.id === gid);

  /* shift times from the settings */
  P.shiftTime = (sh) => { const t = P.db.settings.times[sh] || P.DEFAULT_TIMES[sh]; return `${t.from}–${t.to}`; };
  const mins = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  P.shiftAt = (date = new Date()) => {
    const now = date.getHours() * 60 + date.getMinutes(), dk = P.dk(date);
    for (const s of P.SHIFTS) {
      const t = P.db.settings.times[s.k], a = mins(t.from), b = mins(t.to);
      if (a < b ? now >= a && now < b : now >= a) return { dk, sh: s.k };
      if (a >= b && now < b) return { dk: P.addDays(dk, -1), sh: s.k };
    }
    return { dk, sh: 'F' };
  };

  /* plant state for a shift: B (Betrieb), S (Stillstand), X (frei / keine Schicht) */
  P.state = (dk, sh) => {
    const o = P.db.plant[P.slot(dk, sh)];
    if (o) return o;
    return (P.db.settings.workdays[P.wd(dk)] || []).includes(sh) ? 'B' : 'X';
  };

  /* ---------------------------------------------------------------- shift groups (rotation) */
  P.groupShift = (gid, dk) => {
    const s = P.db.settings, pat = (s.pattern || '').toUpperCase();
    if (!pat) return '-';
    const i = P.GROUP_IDS.indexOf(gid);
    if (i < 0) return '-';
    const L = pat.length, off = Math.round((L / 4) * i);
    const idx = (((P.dayNum(dk) - P.dayNum(s.patternStart || dk) - off) % L) + L) % L;
    const c = pat[idx];
    return 'FSN'.includes(c) ? c : '-';
  };
  P.groupsOn = (dk, sh) => P.GROUP_IDS.filter((g) => P.groupShift(g, dk) === sh);
  P.crew = (dk, sh) => {
    const ex = P.db.roster[P.slot(dk, sh)];
    if (ex) return ex.filter((id) => P.person(id));
    if (P.state(dk, sh) === 'X') return [];
    const gs = P.groupsOn(dk, sh);
    return P.db.staff.filter((p) => gs.includes(p.group)).map((p) => p.id);
  };
  /* crew as units: pairs stay together */
  P.units = (ids) => {
    const seen = new Set(), out = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const pt = P.partnerOf(id);
      if (pt && ids.includes(pt.id) && !seen.has(pt.id)) { seen.add(pt.id); out.push([id, pt.id]); } else out.push([id]);
    }
    return out;
  };
  /* adds or removes a person together with the partner (if the partner is on the same shift) */
  P.toggleWithPartner = (list, id, crew) => {
    const pt = P.partnerOf(id), on = list.includes(id);
    const ids = [id].concat(pt && (!crew || crew.includes(pt.id)) ? [pt.id] : []);
    return on ? list.filter((x) => !ids.includes(x)) : [...new Set([...list, ...ids])];
  };

  /* ---------------------------------------------------------------- daily tasks */
  const SH_IDX = { F: 0, S: 1, N: 2 };
  P.dailyDue = (t, dk, sh) => {
    if (P.state(dk, sh) === 'X') return false;
    switch (t.interval) {
      case 'jede': return true;
      case 'jede2': return (P.dayNum(dk) * 3 + SH_IDX[sh]) % 2 === 0;
      case 'tag': return P.SHIFTS.find((s) => P.state(dk, s.k) !== 'X').k === sh;
      default: return t.interval === sh;
    }
  };

  /* ---------------------------------------------------------------- maintenance
     The cycle restarts from the date the work was actually done:
     planned KW 41, done in KW 40, cycle 4 weeks → next KW 44. */
  P.maintStartDk = (t) => P.weekMonday(t.year || new Date().getFullYear(), Math.max(1, Math.min(53, t.kw || 1)));
  /* k-th due week after an anchor date (counted from the anchor, so month lengths don't drift) */
  P.nthAfter = (t, anchor, k) => {
    const c = Math.max(1, t.cycle || 1);
    return t.unit === 'M' ? P.monday(P.addMonths(anchor, c * k)) : P.addDays(P.monday(anchor), 7 * c * k);
  };
  P.cycleAdd = (t, dk) => P.nthAfter(t, dk, 1);
  P.cycleShort = (t) => `${t.cycle} ${t.unit === 'W' ? (t.cycle > 1 ? 'Wochen' : 'Woche') : (t.cycle > 1 ? 'Monate' : 'Monat')}`;
  P.cycleLabel = (t) => t.cycle > 1 ? `alle ${t.cycle} ${t.unit === 'W' ? 'Wochen' : 'Monate'}` : (t.unit === 'W' ? 'jede Woche' : 'jeden Monat');
  const sinceMon = () => P.monday(P.db.settings.since || P.today());
  P.tracked = (dk) => P.dayNum(dk) >= P.dayNum(sinceMon());
  const lt = (a, b) => P.dayNum(a) < P.dayNum(b);

  /* chain of completions → { done: [{planned, c}], next: planned Monday of the open occurrence } */
  const chainCache = new Map();
  P.chain = (t) => {
    const ck = `${P.rev}|${t.id}|${t.kw}|${t.year}|${t.cycle}|${t.unit}|${(t.done || []).length}`;
    if (chainCache.has(ck)) return chainCache.get(ck);
    if (chainCache.size > 2000) chainCache.clear();
    const list = (t.done || []).slice().sort((a, b) => P.dayNum(a.date) - P.dayNum(b.date));
    let anchor = P.maintStartDk(t), k = 0, planned = anchor;
    const done = [];
    for (const c of list) { done.push({ planned, c }); anchor = c.date; k = 1; planned = P.nthAfter(t, anchor, 1); }
    // before the first use of the app the static plan applies (no overdue backlog)
    while (lt(planned, sinceMon()) && k < 600) planned = P.nthAfter(t, anchor, ++k);
    const r = { done, next: planned, anchor, k };
    chainCache.set(ck, r);
    return r;
  };
  P.nextDue = (t) => P.chain(t).next;

  P.kMaint = (t, mondayDk) => `m|${t.id}|${mondayDk}`;
  P.kComp = (t, c) => `c|${t.id}|${c.date}|${c.at || ''}`;

  /* what happens with task t in the week starting mon: done / due / late / null (projected weeks are 'due' with proj) */
  P.maintInWeek = (t, mon) => {
    const ch = P.chain(t), cur = P.monday(P.today());
    const doneHere = ch.done.filter((d) => P.monday(d.c.date) === mon);
    const res = doneHere.map((d) => ({ kind: 'maint', t, key: P.kComp(t, d.c), comp: d.c, week: d.planned, status: 'done', o: { who: d.c.who || [], done: true, at: d.c.at, slot: d.c.slot, weight: d.c.weight, date: d.c.date }, std: t.std, ma: t.ma }));
    const next = ch.next;
    const mk = (planned, status, extra = {}) => { const key = P.kMaint(t, planned); return Object.assign({ kind: 'maint', t, key, week: planned, status, o: P.occ(key), std: t.std, ma: t.ma }, extra); };
    if (next === mon) res.push(mk(next, lt(mon, cur) ? 'late' : 'due'));
    else if (lt(next, mon) && mon === cur) res.push(mk(next, 'late'));
    else if (lt(next, mon) && lt(cur, mon)) {
      // projection for future weeks: assume the open one gets done in its week (or this week if overdue)
      const anchor = lt(next, cur) ? cur : ch.anchor;
      let j = lt(next, cur) ? 1 : ch.k + 1, p = P.nthAfter(t, anchor, j);
      while (lt(p, mon) && j < 900) p = P.nthAfter(t, anchor, ++j);
      if (p === mon) res.push(mk(p, 'due', { proj: true }));
    }
    return res;
  };

  /* all maintenance for the week of dk */
  P.weekMaint = (dk) => {
    const mon = P.monday(dk), out = [];
    for (const t of P.db.maint) out.push(...P.maintInWeek(t, mon));
    return out;
  };
  /* open maintenance planned in the next 14 days after the week of dk – can be done earlier */
  P.upcomingMaint = (dk) => {
    const mon = P.monday(dk), lim = P.addDays(mon, 14), out = [];
    for (const t of P.db.maint) {
      const n = P.chain(t).next;
      if (lt(mon, n) && !lt(lim, n)) { const key = P.kMaint(t, n); out.push({ kind: 'maint', t, key, week: n, status: 'early', o: P.occ(key), std: t.std, ma: t.ma }); }
    }
    return out;
  };

  /* mark maintenance done on a date (completes the open occurrence and restarts the cycle) */
  P.completeMaint = (t, date, slot, srcKey) => {
    const openKey = P.kMaint(t, P.chain(t).next);
    const src = P.db.occ[srcKey] || P.db.occ[openKey] || {};
    t.done.push({ date, slot: slot || '', who: (src.who || []).slice(), weight: src.weight ?? null, at: P.stamp() });
    if (srcKey) delete P.db.occ[srcKey];
    delete P.db.occ[openKey];
  };
  P.uncompleteMaint = (t, comp) => { t.done = t.done.filter((c) => c !== comp); };

  /* ---------------------------------------------------------------- occurrences */
  P.kDaily = (t, dk, sh) => `d|${t.id}|${dk}|${sh}`;
  P.occ = (k) => P.db.occ[k] || { who: [], done: false };
  P.setOcc = (k, patch) => {
    const cur = Object.assign({ who: [], done: false }, P.db.occ[k], patch);
    if (!cur.done && !cur.who.length && cur.weight == null) delete P.db.occ[k];
    else P.db.occ[k] = cur;
  };
  /* who-lists live in different places depending on the key type */
  const findComp = (k) => { const [, tid, date, at] = k.split('|'); const t = P.db.maint.find((x) => x.id === tid); return t && t.done.find((c) => c.date === date && (c.at || '') === at); };
  P.getWho = (k) => {
    if (k.startsWith('r|')) return (P.db.rev.find((x) => 'r|' + x.id === k) || {}).who || [];
    if (k.startsWith('c|')) return (findComp(k) || {}).who || [];
    return P.occ(k).who || [];
  };
  P.setWho = (k, ids) => {
    if (k.startsWith('r|')) { const r = P.db.rev.find((x) => 'r|' + x.id === k); if (r) r.who = ids; return; }
    if (k.startsWith('c|')) { const c = findComp(k); if (c) c.who = ids; return; }
    P.setOcc(k, { who: ids });
  };
  P.setWeight = (item, v) => { if (item.comp) item.comp.weight = v; else P.setOcc(item.key, { weight: v }); };

  /* tick / untick any item (daily, maintenance) from a shift on dk/sh */
  P.toggleItem = (item, checked, dk, sh) => {
    if (item.kind === 'maint') {
      if (!checked && item.comp) P.uncompleteMaint(item.t, item.comp);
      else if (checked && !item.comp) P.completeMaint(item.t, dk || P.today(), dk && sh ? P.slot(dk, sh) : '', item.key);
      return;
    }
    P.setOcc(item.key, { done: checked, at: checked ? P.stamp() : '', slot: checked ? P.slot(dk, sh) : '' });
  };

  /* All items for one shift. status: done | due | wait (braucht Stillstand) | late (überfällig) | week (diese Woche, anderer Tag) */
  P.shiftItems = function (dk, sh) {
    const st = P.state(dk, sh), items = [];
    if (st === 'X') return items;
    for (const t of P.db.daily) {
      if (!P.dailyDue(t, dk, sh)) continue;
      const key = P.kDaily(t, dk, sh), o = P.occ(key);
      const status = o.done ? 'done' : (t.sb === 'S' && st !== 'S' ? 'wait' : 'due');
      items.push({ kind: 'daily', t, key, o, status, std: t.std, ma: t.ma });
    }
    items.push(...P.weekMaint(dk).map((m) => {
      const here = (!m.t.weekday || Number(m.t.weekday) === P.wd(dk)) && (!m.t.shift || m.t.shift === sh);
      let status = m.status;
      if (status === 'due' && !here) status = 'week';
      if ((status === 'due' || status === 'week') && m.t.sb === 'S' && st !== 'S') status = 'wait';
      return Object.assign({}, m, { status });
    }));
    for (const r of P.db.rev) {
      if (r.date !== dk || (r.shift && r.shift !== sh)) continue;
      const total = r.steps.filter((s) => !/^[#!]/.test(s)).length;
      const done = Object.values(r.checked).filter(Boolean).length;
      items.push({ kind: 'rev', t: r, key: 'r|' + r.id, o: { who: r.who, done: !!r.doneAt }, status: r.doneAt ? 'done' : (st === 'S' ? 'due' : 'wait'), progress: [done, total] });
    }
    return items;
  };

  /* summary of a shift for the week grid: daily + revision items, maintenance only if planned or done here */
  P.summary = function (dk, sh) {
    const slot = P.slot(dk, sh), cnt = { total: 0, done: 0, open: 0, wait: 0 };
    for (const i of P.shiftItems(dk, sh)) {
      if (i.kind === 'maint') {
        const planned = i.status === 'due' && (i.t.weekday || i.t.shift);
        const doneHere = i.status === 'done' && i.o.slot === slot;
        if (!planned && !doneHere) continue;
      }
      cnt.total++;
      if (i.status === 'done') cnt.done++;
      else if (i.status === 'wait') cnt.wait++;
      else cnt.open++;
    }
    cnt.missed = P.dayNum(dk) < P.dayNum(P.today()) && P.dayNum(dk) >= P.dayNum(P.db.settings.since || dk) ? cnt.open : 0;
    return cnt;
  };

  /* hours per person in a shift (fallback 0.25 h per task without Std.) */
  P.personHours = function (pid, items) {
    let h = 0;
    for (const i of items) if (i.o.who && i.o.who.includes(pid) && i.status !== 'week') h += (i.std || 0.25) / Math.max(1, i.o.who.length);
    return h;
  };

  /* distribute open, unassigned items of a shift across its crew – pairs get their tasks together */
  P.autoAssign = function (dk, sh) {
    const crew = P.crew(dk, sh);
    if (!crew.length) return 0;
    const items = P.shiftItems(dk, sh);
    const units = P.units(crew);
    const load = units.map((u) => u.reduce((s, id) => s + P.personHours(id, items), 0) / u.length);
    let n = 0;
    for (const i of items) {
      if (i.status !== 'due' || i.kind === 'rev' || (i.o.who && i.o.who.length)) continue;
      const need = Math.max(1, i.ma || 1);
      const order = units.map((u, x) => x).sort((a, b) => load[a] - load[b]);
      const pick = [];
      for (const x of order) { if (pick.length >= need) break; pick.push(...units[x]); load[x] += (i.std || 0.25); }
      P.setWho(i.key, pick);
      n++;
    }
    return n;
  };
})();
