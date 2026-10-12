# M31 Planung

Windows-Applikation für die Schicht- und Arbeitsplanung an der Anlage M31. Grundlage sind die Pläne
«Tägliche Arbeiten M31», «Arbeits- und Wartungsplan M31» und «M31_Revision.xlsx».

## Bereiche

| Bereich | Inhalt |
|---|---|
| **Woche** | Wochenraster Früh-/Spät-/Nachtschicht: Anlagenstatus (Betrieb / Stillstand / Frei), eingeteiltes Personal, Fortschritt je Schicht, fällige Wartung der Woche |
| **Schicht** | Die «Tägliche Arbeiten»-Liste einer Schicht wie im Excel: gelb = muss erledigt werden, grün = erledigt. Aufgaben zuteilen, abhaken, automatisch verteilen |
| **Wartung** | Wartungsplan mit KW-Spalten. Fälligkeit aus Zyklus, Einheit und KW-Start; überfällige Arbeiten rot |
| **Revision** | Checklisten aus der Revisionsdatei, mit Datum, Schicht und Personen planbar |
| **Team** | Mitarbeitende mit Schichtgruppe (F/S/N), optional wöchentliche Rotation |
| **Aufgaben** | Tägliche Arbeiten, Wartungs- und Revisionsarbeiten erfassen, ändern, löschen |

Die Spalten der Excel-Vorlagen sind übernommen: Intervall, Std., MA, S/B, Zyklus, Einheit, KW Start, Wochentag, Schicht.
Aufgaben mit **S** erscheinen erst, wenn die Anlage auf der Schicht im Stillstand ist.

## Installation

Die `.exe` wird bei jedem Push automatisch von GitHub Actions auf Windows gebaut
(Workflow «Windows-App bauen» → Artefakt **M31-Planung-Windows**):

- `M31-Planung-Setup-1.0.0.exe` – Installer mit Startmenü- und Desktop-Verknüpfung
- `M31-Planung-1.0.0-portable.exe` – ohne Installation, direkt startbar (z. B. vom USB-Stick)

Wird ein Tag `v*` gepusht (z. B. `v1.0.0`), werden beide Dateien zusätzlich an ein GitHub-Release angehängt.

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
