/* M31 Planung – Ausgangsdaten aus «Tägliche Arbeiten M31», «Arbeits- und Wartungsplan M31» und «M31_Revision.xlsx».
   Die Mitarbeitenden sind Beispiele und können unter «Team» ersetzt werden. */
(function () {
  'use strict';
  const P = window.P;

  P.SHIFTS = [
    { k: 'F', label: 'Frühschicht', time: '06–14', icon: 'sun' },
    { k: 'S', label: 'Spätschicht', time: '14–22', icon: 'sunset' },
    { k: 'N', label: 'Nachtschicht', time: '22–06', icon: 'moon' },
  ];
  P.SHIFT = Object.fromEntries(P.SHIFTS.map((s) => [s.k, s]));

  P.INTERVALS = [
    ['jede', 'Jede Schicht'],
    ['jede2', 'Jede 2. Schicht'],
    ['F', 'Nur Frühschicht (F)'],
    ['S', 'Nur Spätschicht (S)'],
    ['N', 'Nur Nachtschicht (N)'],
    ['tag', 'Einmal pro Tag'],
  ];
  P.INTERVAL = Object.fromEntries(P.INTERVALS);
  P.INTERVAL_SHORT = { jede: 'Jede Schicht', jede2: 'Jede 2. Schicht', F: 'F', S: 'S', N: 'N', tag: '1× pro Tag' };

  P.STATES = { B: 'Betrieb', S: 'Stillstand', X: 'Frei' };
  P.COLORS = ['#D9480F', '#1971C2', '#2B8A3E', '#9C36B5', '#C2255C', '#0B7285', '#E67700', '#5C7CFA', '#495057', '#A61E4D'];

  P.seed = function () {
    const year = new Date().getFullYear();
    let n = 1;
    const id = (p) => p + n++;
    const daily = [
      ['Boden um Anlage saugen / kehren', 'jede2'],
      ['Ordnung und Sauberkeit Arbeitsplatz', 'jede'],
      ['Werkzeug vorhanden und an richtigem Ort', 'jede'],
      ['Mülleimer leeren', 'jede'],
      ['Behälter für Lösemittel leeren', 'F'],
      ['Dokumenten-Schredder leeren', 'S'],
    ].map(([name, interval]) => ({ id: id('d'), name, interval, std: null, ma: 1, sb: 'B', note: '' }));

    const maint = [
      ['Bereich Allgemein', 'Boden mit Putzmaschine reinigen + Schmutzwasser leeren', '', 1, 'W', 25],
      ['Bereich Allgemein', 'Container leeren', 'Gewicht eintragen', 1, 'M', 28],
      ['Bereich Allgemein', 'Bürotisch reinigen', '', 1, 'W', 25],
      ['Bereich Allgemein', 'Rohstoffe an richtigem Ort?', '', 1, 'W', 25],
      ['Bereich Allgemein', 'Reinigen Streckanlage', '(M32)', 1, 'W', 25],
      ['Extruder', 'Vakuumbehälter entleeren (in Kessel)', 'Kessel in 1000-L-Tank kippen', 1, 'M', 25],
      ['Extruder', 'Siebwechsler reinigen', 'Siebwechsler ganz ausfahren!', 1, 'W', 26],
      ['Extruder', 'Düse reinigen', 'Unterseite beachten!', 2, 'M', 27],
      ['Wasserpumpe', 'Rückschlag Wasserpumpe reinigen', 'Compo-Produktion ohne Vakuum', 1, 'M', 29],
      ['Wasserpumpe', 'Wasserreservoir entleeren', 'Staubsauger mit Pumpe', 2, 'M', 25],
    ].map(([comp, desc, aid, cycle, unit, kw]) => ({ id: id('m'), comp, desc, aid, cycle, unit, kw, year, weekday: '', shift: '', std: null, ma: 1, sb: 'B', needWeight: /Gewicht/.test(aid) }));

    const walze = {
      steps: [
        'Absperrorgane: Kühlwasserzufluss, Kühlwasser-Rücklauf, Kühlwasser-Befüllung, Vorlauf, Rücklauf',
        'Sensoren: Niveausonde',
        'Ventile, Wegeventile: Kühlwasserzufluss, Befüllung, Rückschlagventil → Befüllung',
        'Behälter: Ausdehnungsbehälter, Heizung',
        'Pumpe', 'Motor', 'Gebläse',
        'Schmutzfänger: Kühlwasserzufluss, Befüllung, Rücklauf',
        'Wärmetauscher', 'Anzeigen: Vorlauf', 'Leitungen',
      ],
      docs: 'Inbetriebnahme: Druck vor Schmutzfänger kontrollieren und bei Druckanstieg Schmutzfänger erneut reinigen. Nach Abschluss der Inbetriebnahme Schmutzfänger nochmals reinigen. Kein Druckanstieg! Temperaturanstieg an der Walze kontrollieren!',
    };
    const rev = [
      { comp: 'Walze 1', ...walze },
      { comp: 'Walze 2', ...walze },
      { comp: 'Walze 3', ...walze },
      {
        comp: 'Wassertank Vakuumpumpe',
        steps: [
          '# Reinigung Wassertank Vakuumpumpe',
          'Wassertank von Vakuumpumpe reinigen (durchspülen)',
          'Abwasserauffangbehälter unter Vakuumpumpe und Niveauschwimmer reinigen',
          '# Vakuumeinrichtung',
          'Wälzlager Wasserringpumpe nachschmieren, je 10 g / Lager Blaser Blasolube 512',
          'Schmutzfänger in Kühlwassernachspeisung: ausbauen, reinigen',
          'Kugel-Rückschlagventil in Saugleitung (Zchng. Nr. 127.00340.51.01): ausbauen, reinigen',
          'Abscheidekübel und Leitungen: reinigen',
        ],
        docs: 'Unterlagen siehe 31.5, Kap. 05, in Ordner 1',
      },
      {
        comp: 'RV Granulattrockner',
        steps: [
          '! Atemschutzmaske und Schutzkleidung tragen, wenn die Gewebefilter ausgebaut werden',
          '! Herausgenommene Filter nie stauchen oder klopfen',
          '# F1 Rücklauf-Filter',
          '! Filtergehäuse niemals ausblasen! Staub darf nicht in das Trockenmittel geblasen werden',
          'Trockner ausschalten',
          'Gehäusedeckel abschrauben',
          'Filter herausdrehen',
          'Filter mit Druckluft von innen nach aussen ausblasen',
          'Filter einsetzen',
          'Gehäusedeckel anschrauben – darauf achten, dass das Filtergehäuse dicht geschlossen ist',
          '# F2 Regenerations-Filter',
          'Gehäusedeckel abschrauben',
          'Filtermatte herausnehmen und abklopfen',
          'Gereinigte Filtermatte wieder auflegen',
          'Gehäusedeckel anschrauben',
        ],
        docs: 'Siehe auch Betriebsanleitung unter 31.15.050.100. Bild vom Trockner in der Dokumentation (CO).',
      },
      {
        comp: 'Förderluftfilter Fördergeräte (alle)',
        steps: [
          'Förderluftfilter reinigen, auf Beschädigung überprüfen, ev. ersetzen',
          'Schalldämpfer ausbauen und reinigen (waschen oder ausblasen)',
          'Rückschlagklappe auf Beschädigung überprüfen (nur bei 1 und 2)',
          'Förderleitungen auf Verschleiss überprüfen (Sichtkontrolle), ev. reinigen',
        ],
        docs: 'Siehe 31.23 Ordner 2, Kap. 3, Bedienungsanleitung Mann & Hummel. Geräteliste: Fördergerät 1 KFG 224.52 · Fördergerät 2 KFG 224.52 · Fördergerät 4 Hurricane MKII SP',
      },
      {
        comp: 'Transportwassersystem TWS 60/600',
        steps: [
          '# Internen Kreislauf entkalken',
          'Wasserkreislauf in Betrieb setzen',
          'Kalklösendes Mittel beigeben: Acidcleaner AZN 20 (40 kg)',
          'Wasserkreislauf ca. 6–7 h in Betrieb lassen, Mittel nach Bedarf nachfüllen (Vorsicht vor Überschäumen)',
          'Säure neutralisieren auf pH-Wert 6.5–9.5',
          'Kreislaufwasser ablassen, alle Einbauten (Siebe) im Wasserabscheider ausbauen und reinigen',
          'Ganzes Transportwassersystem sauber ausspülen und wieder mit frischem Wasser auffüllen',
        ],
        docs: 'Unterlagen siehe 31.60, Betriebsanleitungen TWS 60/600. Verbrauch: Waterdos ENT53 0.25 L · Natronlauge 25 kg · Acidcleaner AZN 20 40 kg. Anleitung Entkalken: AA 031 009 Compositesystem Entkalken.',
      },
      {
        comp: 'SD-Linie komplett: Schmierplan',
        steps: [
          '! Anlage aus Sicherheitsgründen nur im Stillstand oder Wartungsbetrieb schmieren!',
          '# 3-Walzen-Glättwerk',
          'Hydr. Zylinder Walze 1, Walze 2 und Prägewalze – total 12 Schmiernippel an Befestigungsaugen (Blasolube 512)',
          'Walzenlager Walze 1, 2 und 3 – total 6 Schmiernippel (Blasolube 512)',
          'Lager Gummiwalze – 6 Schmiernippel, Stahlwalze und kleine Gegenwalze (Blasolube 512)',
          '# Kühlstation',
          'Lager Kühlwalzen – total 6 Stk. (Blasolube 512)',
          'Drehdichtköpfe – 3 Stk. (Blasolube 512)',
          '# Schneid- und Haltewerk',
          'Messerverstellung links/rechts (Blasolube 512)',
          'Lager Pendelwalze – 2 Stk. (Blasolube 512)',
          'Lager Haltewerk – total 4 Stk. (Blasolube 512)',
          '# Aufwickler',
          'Umlenkbürstenwalze (Breitstrecker) – 2 Schmiernippel (Blasolube 512)',
        ],
        docs: 'Schmiermittel: Blaser Blasolube 512. Unterlagen im Ordner 2 Kap. 5–7 und Ordner 3.',
      },
    ].map((r) => ({ id: id('r'), comp: r.comp, steps: r.steps, docs: r.docs, date: '', shift: '', who: [], checked: {}, doneAt: '' }));

    const staff = [
      ['Beispiel Anna', 'AB'], ['Beispiel Ben', 'BB'], ['Beispiel Carla', 'CB'],
      ['Beispiel David', 'DB'], ['Beispiel Elif', 'EB'], ['Beispiel Fabio', 'FB'],
    ].map(([name, short], i) => ({ id: id('p'), name, short, color: P.COLORS[i], group: ['F', 'S', 'N'][i % 3] }));

    return {
      v: 1, seq: n, daily, maint, rev, staff,
      roster: {}, // 'YYYY-MM-DD|F' -> [staffId]
      plant: {}, // 'YYYY-MM-DD|F' -> 'B' | 'S' | 'X' (Abweichung vom Standard)
      occ: {}, // Vorkommen-Schlüssel -> { who: [], done: bool, at, weight }
      settings: {
        // Standard-Schichten je Wochentag (0 = So)
        workdays: { 0: [], 1: ['F', 'S', 'N'], 2: ['F', 'S', 'N'], 3: ['F', 'S', 'N'], 4: ['F', 'S', 'N'], 5: ['F', 'S', 'N'], 6: [] },
        autoRoster: true, // Team nach Schichtgruppe automatisch einteilen
        line: 'M31',
        since: P.today(), // ab hier gelten offene Vorkommen als überfällig
      },
    };
  };
})();
