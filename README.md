# M31 Planung

Windows-Applikation für die Schicht- und Arbeitsplanung an der Anlage M31. Grundlage sind die Pläne
«Tägliche Arbeiten M31», «Arbeits- und Wartungsplan M31» und «M31_Revision.xlsx».

## Bereiche

| Bereich | Inhalt |
|---|---|
| **Woche** | Wochenraster Früh-/Spät-/Nachtschicht: Anlagenstatus (Betrieb / Stillstand / Frei), Schichtgruppe, eingeteiltes Personal (Paare zusammen), Fortschritt je Schicht, fällige Wartung |
| **Monat** | Monatskalender mit allen Schichten (welche Gruppe wann), Wartungsarbeiten je Woche und Revisionen. Schichten, Gruppen, Wartung und Revision lassen sich ein- und ausblenden |
| **Schicht** | Die «Tägliche Arbeiten»-Liste einer Schicht wie im Excel: gelb = muss erledigt werden, grün = erledigt. Aufgaben zuteilen, abhaken, automatisch verteilen; Wartung der nächsten 2 Wochen lässt sich vorziehen |
| **Wartung** | Wartungsplan mit KW-Spalten. Wird eine Arbeit früher oder später erledigt, beginnt der Zyklus ab diesem Datum neu (geplant KW 41, erledigt KW 40, Zyklus 4 Wochen → nächste KW 44) |
| **Revision** | Checklisten aus der Revisionsdatei, mit Datum, Schicht und Personen planbar |
| **Team** | 4 Schichtgruppen (A–D) mit Mitgliedern; Personen, die meist zusammenarbeiten, werden als Paar verbunden und gemeinsam eingeteilt |
| **Aufgaben** | Tägliche Arbeiten, Wartungs- und Revisionsarbeiten erfassen, ändern, löschen |

Unter **Einstellungen** (Zahnrad) werden die Schichtzeiten, Namen und Farben der Gruppen sowie der Schichtrhythmus
festgelegt (z. B. wöchentlich Früh → Spät → Nacht → frei). Der Rhythmus läuft ab dem Startdatum endlos weiter.

Die Spalten der Excel-Vorlagen sind übernommen: Intervall, Std., MA, S/B, Zyklus, Einheit, KW Start, Wochentag, Schicht.
Aufgaben mit **S** erscheinen erst, wenn die Anlage auf der Schicht im Stillstand ist.

## Installation

Die `.exe` wird bei jedem Push automatisch von GitHub Actions auf Windows gebaut
(Workflow «Windows-App bauen» → Artefakt **M31-Planung-Windows**):

- `M31-Planung-Setup-<Version>.exe` – Installer mit Startmenü- und Desktop-Verknüpfung
- `M31-Planung-<Version>-portable.exe` – ohne Installation, direkt startbar (z. B. vom USB-Stick)

Zusätzlich landen beide Dateien in einem öffentlichen GitHub-Release – Download ohne GitHub-Konto:
**https://github.com/makemecodeclaude/jere/releases/latest**

Für eine neue Version die `version` in `package.json` erhöhen; der nächste Push erstellt dann ein neues Release.

Die Programme sind nicht signiert; Windows SmartScreen zeigt beim ersten Start deshalb einen Hinweis
(«Weitere Informationen» → «Trotzdem ausführen»).

## Daten

Alle Daten bleiben lokal auf dem PC (Benutzerprofil, `%APPDATA%\M31 Planung`). Unter
**Einstellungen → Sicherung herunterladen / laden** lassen sie sich als JSON-Datei sichern oder auf einen anderen PC übertragen.
Der Wochenplan lässt sich als Excel-Datei exportieren und jede Ansicht drucken.

## Entwicklung

```bash
npm install
npm start        # App im Entwicklungsmodus starten
npm run dist     # Windows-Installer und portable .exe nach dist/ bauen (auf Windows)
```

`index.html` läuft auch direkt im Browser, ohne Electron.
