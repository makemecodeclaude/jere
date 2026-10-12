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

  P.ui = Object.assign({ page: 'woche', date: null, shift: null, theme: 'system', aufgabenTab: 'daily' }, parse(ls.get(UI_KEY)) || {});
  P.saveUi = P.debounce(() => ls.set(UI_KEY, JSON.stringify(P.ui)), 150);

  P.load = function () {
    const s = parse(ls.get(DB_KEY));
    P.db = s && s.v === 1 ? s : P.seed();
    const def = P.seed().settings;
    P.db.settings = Object.assign({}, def, P.db.settings || {});
    if (!P.db.settings.since) P.db.settings.since = P.today();
    if (!s) P.save(true);
  };

  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('m31-plan') : null;
  const tab = P.uid('t');
  P.save = function (silent) {
    if (!ls.set(DB_KEY, JSON.stringify(P.db))) P.storageWarn = true;
    if (!silent && chan) chan.postMessage({ from: tab });
  };
  const remote = () => { const s = parse(ls.get(DB_KEY)); if (s) { P.db = s; P.render(); } };
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
  P.slot = (dk, sh) => `${dk}|${sh}`;

  /* plant state for a shift: B (Betrieb), S (Stillstand), X (frei / keine Schicht) */
  P.state = (dk, sh) => {
    const o = P.db.plant[P.slot(dk, sh)];
    if (o) return o;
    return (P.db.settings.workdays[P.wd(dk)] || []).includes(sh) ? 'B' : 'X';
  };
  P.groupFor = (person, dk) => {
    if (!person.group) return '';
    if (!P.db.settings.rotate) return person.group;
    const order = ['F', 'S', 'N'];
    const i = order.indexOf(person.group);
    if (i < 0) return person.group;
    const w = ((P.absWeek(dk) % 3) + 3) % 3;
    return order[(i + w) % 3];
  };
  P.crew = (dk, sh) => {
    if (P.state(dk, sh) === 'X') return P.db.roster[P.slot(dk, sh)] || [];
    const ex = P.db.roster[P.slot(dk, sh)];
    if (ex) return ex.filter((id) => P.person(id));
    if (!P.db.settings.autoRoster) return [];
    return P.db.staff.filter((p) => P.groupFor(p, dk) === sh).map((p) => p.id);
  };

  /* ---------------------------------------------------------------- due logic */
  const SH_IDX = { F: 0, S: 1, N: 2 };

  /* daily task: due on this shift? */
  P.dailyDue = (t, dk, sh) => {
    if (P.state(dk, sh) === 'X') return false;
    switch (t.interval) {
      case 'jede': return true;
      case 'jede2': return (P.dayNum(dk) * 3 + SH_IDX[sh]) % 2 === 0;
      case 'tag': return P.SHIFTS.find((s) => P.state(dk, s.k) !== 'X').k === sh;
      default: return t.interval === sh;
    }
  };

  /* maintenance: set of absolute weeks in which the task is due (cached) */
  const weekCache = new Map();
  P.maintStartDk = (t) => P.weekMonday(t.year || new Date().getFullYear(), Math.max(1, Math.min(53, t.kw || 1)));
  P.maintDue = (t, absW) => {
    const start = P.maintStartDk(t), sw = P.absWeek(start), cyc = Math.max(1, t.cycle || 1);
    if (absW < sw) return false;
    if (t.unit === 'W') return (absW - sw) % cyc === 0;
    const ck = `${t.id}|${start}|${cyc}`;
    let set = weekCache.get(ck);
    if (!set) {
      set = new Set();
      for (let k = 0; k < 400; k++) set.add(P.absWeek(P.addMonths(start, cyc * k)));
      weekCache.set(ck, set);
    }
    return set.has(absW);
  };
  P.weekKey = (dk) => { const { y, w } = P.isoWeek(dk); return `${y}-W${String(w).padStart(2, '0')}`; };
  P.cycleShort = (t) => `${t.cycle} ${t.unit === 'W' ? (t.cycle > 1 ? 'Wochen' : 'Woche') : (t.cycle > 1 ? 'Monate' : 'Monat')}`;
  P.cycleLabel = (t) => `alle ${t.cycle > 1 ? t.cycle + ' ' : ''}${t.unit === 'W' ? (t.cycle > 1 ? 'Wochen' : 'Woche') : (t.cycle > 1 ? 'Monate' : 'Monat')}`;
  P.nextDue = (t, fromDk) => {
    const w0 = P.absWeek(fromDk);
    for (let w = w0; w < w0 + 260; w++) if (P.maintDue(t, w)) return P.addDays(P.monday(fromDk), (w - w0) * 7);
    return null;
  };

  /* only occurrences from the first use on count as overdue */
  P.tracked = (dk) => P.dayNum(dk) >= P.dayNum(P.monday(P.db.settings.since || P.today()));

  /* occurrence keys + state */
  P.kDaily = (t, dk, sh) => `d|${t.id}|${dk}|${sh}`;
  P.kMaint = (t, mondayDk) => `m|${t.id}|${mondayDk}`;
  P.occ = (k) => P.db.occ[k] || { who: [], done: false };
  P.setOcc = (k, patch) => {
    const cur = Object.assign({ who: [], done: false }, P.db.occ[k], patch);
    if (!cur.done && !cur.who.length && !cur.weight) delete P.db.occ[k];
    else P.db.occ[k] = cur;
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

  /* maintenance due in the week of dk (+ overdue from the last 8 weeks that are still open) */
  P.weekMaint = function (dk) {
    const mon = P.monday(dk), aw = P.absWeek(dk), out = [];
    for (const t of P.db.maint) {
      if (P.maintDue(t, aw)) {
        const key = P.kMaint(t, mon), o = P.occ(key);
        out.push({ kind: 'maint', t, key, o, status: o.done ? 'done' : 'due', week: mon, std: t.std, ma: t.ma });
      }
      for (let b = 1; b <= 8; b++) {
        if (!P.maintDue(t, aw - b)) continue;
        const wm = P.addDays(mon, -7 * b), key = P.kMaint(t, wm), o = P.occ(key);
        if (!o.done && P.dayNum(wm) < P.dayNum(P.monday(P.today())) && P.tracked(wm))
          out.push({ kind: 'maint', t, key, o, status: 'late', week: wm, std: t.std, ma: t.ma });
        break;
      }
    }
    return out;
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

  /* distribute open, unassigned items of a shift across its crew */
  P.autoAssign = function (dk, sh) {
    const crew = P.crew(dk, sh);
    if (!crew.length) return 0;
    const items = P.shiftItems(dk, sh);
    const load = Object.fromEntries(crew.map((id) => [id, P.personHours(id, items)]));
    let n = 0;
    for (const i of items) {
      if (i.status !== 'due' || i.kind === 'rev' || (i.o.who && i.o.who.length)) continue;
      const need = Math.min(crew.length, Math.max(1, i.ma || 1));
      const pick = crew.slice().sort((a, b) => load[a] - load[b]).slice(0, need);
      pick.forEach((id) => (load[id] += (i.std || 0.25) / need));
      P.setOcc(i.key, { who: pick });
      n++;
    }
    return n;
  };
})();
