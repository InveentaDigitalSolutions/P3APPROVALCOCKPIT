# Projektdokumentation-Builder — Playbook & Agenten-Leitfaden

> **Zweck:** Wiederverwendbare Anleitung, um für **beliebige künftige Projekte** eine Projektdokumentation in derselben
> Qualität, Struktur und im selben P3-Branding zu erstellen wie das Referenz-Dokument
> [`PROJEKTDOKUMENTATION.md`](PROJEKTDOKUMENTATION.md) (Projekt „FreigabecockpitNEXT"). Dieses Playbook kann direkt als
> Agenten-Instruktion verwendet werden (z. B. unter `.claude/agents/projektdokumentation-builder.md`) oder als
> Onboarding-Dokument für Berater.
>
> **Referenzbeispiel:** `docs/PROJEKTDOKUMENTATION.md` + erzeugte Artefakte `PROJEKTDOKUMENTATION.pdf` / `PROJEKTDOKUMENTATION.docx`,
> Diagramme `erd.svg` / `context.svg`, Toolchain in `../scripts/`, Build-Anleitung in
> [`README.md`](README.md).

---

## 1. Mission

Aus den verfügbaren Projektquellen (Code, Datenmodell, Kundendokumente, Gesprächsnotizen) ein **vollständiges,
beschreibendes, professionell gestaltetes Projektdokumentation** erzeugen, das

1. den **Ist-Stand** der Lösung präzise dokumentiert (was existiert, wie es funktioniert),
2. das **Zielbild** des Kunden vollständig abbildet (Quell-/Zielsysteme, Funktionssäulen, Backlog),
3. **jede Kundenanforderung bewertet** (umgesetzt / teilweise / offen / blockiert — mit Begründung),
4. als **PDF** (gebrandet, präsentationsreif) **und als editierbares DOCX** ausgeliefert wird.

Das Ergebnis muss so klar sein, dass ein Kunde ohne Vorwissen versteht, was geliefert wurde und was noch offen ist.

---

## 2. Arbeitsprinzipien (das macht es gut)

- **Alles belegen, nichts erfinden.** Jede Aussage aus Code, Daten oder Kundendokument ableiten. Vor dem
  Schreiben das Repo lesen (Seiten/Komponenten, Datenmodule, Datenbank-Tabellen, ETL/Dataflows). Bei
  LLM-/Tool-Fragen die echte Quelle prüfen statt aus dem Gedächtnis.
- **Zielbild ≠ Ist-Stand strikt trennen.** Soll-Umfang (Kundenvision) und tatsächlicher Umsetzungsstand sind
  getrennte, klar gekennzeichnete Abschnitte. Niemals Geplantes als „fertig" darstellen.
- **Status ehrlich klassifizieren** (4-stufige Taxonomie, siehe §4).
- **Saubere, neutrale Fachsprache — keine KI-/Reverse-Engineering-Spuren.** Verboten:
  „abgeleitet aus dem Quellcode", „aus Code-Kommentaren abgeleitet", Verweise auf das Vorgehen des Modells,
  interne Dateipfade/Hook-Namen/`localStorage`-Keys als Beleg. Stattdessen fachliche Begriffe
  („Datenmodul", „Zugriffsdienst", „lokaler Browser-Speicher"). Durable Systemfakten (Tabellennamen,
  Dataflow-Namen) dürfen genannt werden.
- **Beschreibend statt stichwortartig.** Jede Anforderung mit Auslöser, Verhalten, zugrunde liegender Regel
  und Sonderfällen. Lieber mehr Seiten als gedrängt.
- **Konsistente Kennungen & Terminologie.** Glossar führen; Begriffe einmal definieren, dann konsequent nutzen.

---

## 3. Benötigte Eingaben (zuerst sammeln)

| Input | Wofür |
|---|---|
| Quellcode-Zugang (Repo) | Ist-Stand: Screens, Funktionen, Datenmodule, Build/Deploy |
| Datenbank-/Dataverse-Schema | Datenmodell (§2, §10) |
| ETL-/Dataflow-Definitionen (z. B. Power Query `.pq`) | Datenfluss (§3) |
| Kunden-Anforderungsdokument(e) | Zielbild, Funktionssäulen, Backlog, Rollen (§9, §11) |
| Kunden-Anforderungsliste (nummeriert) | Anforderungsbewertung (§9) |
| Aufwands-/Leistungsübersicht (Tage je Rolle) | Executive Summary |
| Branding-Guideline | Farben, Schrift, Logo (§6 dieses Playbooks) |

Fehlt etwas davon → **explizit erfragen**, nicht raten (besonders Branding-Werte und Aufwände).

---

## 4. Status-Taxonomie (für Anforderungsbewertung)

Genau diese vier Stufen verwenden, jeweils mit kurzer Begründung:

- **Umgesetzt** — vollständig vorhanden und nutzbar.
- **Teilweise** — Grundfunktion/UI vorhanden; produktive Quelle/Anbindung fehlt noch.
- **Offen** — fachlich vorgesehen, noch nicht umgesetzt.
- **Blockiert** — abhängig von einer externen Schnittstelle, die derzeit nicht verfügbar ist.

Faustregel für die Zusammenfassung: Trennen, was **durch die Anwendung** limitiert ist vs. **durch externe
Schnittstellen**. Letzteres klar als nicht-app-bedingt ausweisen.

---

## 5. Dokumentstruktur (Vorlage)

Reihenfolge wie im Referenz-Projektdokumentation. Abschnitte projektneutral anpassen; Nummerierung von §1 an
beibehalten, „Executive Summary" unnummeriert voranstellen.

1. **Deckblatt** (dunkel, Marke) — Dokumenttyp, Titel, Untertitel, Version, Datum, Status, Klassifizierung,
   Herausgeber.
2. **Dokumentinformationen** (Steuertabelle) — Projekt, Plattform, IDs, Version/Datum/Status/Klassifizierung.
3. **Inhaltsverzeichnis** (automatisch aus den Überschriften).
4. **Executive Summary** *(unnummeriert, ganz vorne)* — Ausgangslage & Auftrag · Was geliefert wurde ·
   Umsetzungsstand · **Erbrachte Leistung nach Liefergegenständen** (Aufwandstabelle in Tagen je Rolle,
   inkl. Gesamt) · Ausblick. *So geschrieben, dass der Kunde alles Gelieferte sofort versteht.*
5. **§1 Zweck, Kontext & Zielsetzung** — Ausgangslage, Lösungsidee, messbare Geschäftsziele,
   Automatisierungs-Zielbild (Verweis auf Zielbild-Abschnitt).
6. **§2 Fachliches Glossar & Datenmodell** — alle Begriffe mit Format/Beispiel; verbindliche Kern-Geschäftslogik.
7. **§3 Daten- & Integrationsarchitektur** — Tabellen/Entitäten, Datenfluss-Stufen, **ETL-Dataflow im Detail**
   (jede Query mit Schritten; Beobachtungen/Risiken/hartkodierte Werte).
8. **§4 Funktionale Anforderungen** — je Bereich/Screen, Kennung `F-XXX-n`, beschreibend (Auslöser, Verhalten,
   Regeln, Sonderfälle).
9. **§5 Nicht-funktionale Anforderungen** — Plattform, Technik, Sprache/UI, Performance, Robustheit, Wartbarkeit.
10. **§6 Abgrenzung** — was bewusst NICHT enthalten ist.
11. **§7 Offene Punkte & Roadmap** — `R-n` mit Begründung.
12. **§8 Rollen** — Tabelle Rolle → Verantwortung.
13. **§9 Kundenanforderungen & Umsetzungsstand** — den Kundenkatalog 1:1 aufnehmen, je Position Status +
    technische Bewertung; Abschluss-Zusammenfassung (app- vs. schnittstellenbedingt).
14. **§10 Datenmodell (ER-Diagramm)** — Abb. + Entitätstabelle (PK/FK) + Beziehungstabelle
    (Kardinalität/Art) + Mermaid-Quelltext.
15. **§11 Zielbild & Systemlandschaft (Gesamtscope)** — Prozess-Skizze (Abb.), Funktionssäulen (je mit „Bezug
    zum aktuellen Stand"), Quell-/Zielsysteme im Detail, Schlüsselkonzepte/Berechnungslogiken,
    Epic-/Feature-Backlog mit Umsetzungsstand.

---

## 6. Konventionen

- **Anforderungs-IDs:** `F-<BEREICH>-<n>` (z. B. `F-TL-9`), Roadmap `R-n`, Epics `E0…E7` / Features `ExFy`.
- **Abbildungen:** durchnummeriert (Abb. 1 = ER-Diagramm, Abb. 2 = Prozess-Skizze) mit Bildunterschrift.
- **Tabellen** für Glossar, Rollen, Anforderungsbewertung, Beziehungen, Aufwände, Backlog.
- **Sprache:** Deutsch, sachlich, Aktiv; deutsche Anführungszeichen „…". Einheitliches KW-Format `YYYY-WW`.
- **Mengen/IDs** als verifizierte Fakten (z. B. echte Tabellen-/Spaltennamen, Zeilenzahlen aus dem Datenstand).
- **Keine** verirrten Tags/Artefakte im Markdown (vor Build prüfen: `grep -n "</content>\|TODO\|FIXME"`).

---

## 7. Diagramme

Zwei Diagramme als eigenständige, vektorbasierte **SVGs** programmatisch erzeugen (keine externen Tools nötig):

- **ER-Diagramm** (`scripts/build-erd.mjs` → `docs/erd.svg`): Entitäten als Datenstruktur im Script (Felder mit
  PK/FK-Flag, Typ-Klasse real/lokal/exploded), Beziehungen in **Krähenfuß-Notation** mit Kardinalitätslabels +
  Legende. Für neues Projekt: das `E`-Objekt (Entitäten) und `REL`-Array (Beziehungen) ersetzen.
- **Prozess-/Systemkontext** (`scripts/build-context.mjs` → `docs/context.svg`): Quellsysteme → App-Phasen →
  Zielsysteme, Rollen-Akteure, ein-/ausgehende Pfeile, Legende. Boxen/Pfeile sind fixe Koordinaten — Inhalte
  (Quell-/Zielsysteme, Phasen) im Script anpassen.

Einbettung: im Markdown an der gewünschten Stelle den Platzhalter `[[ERD]]` bzw. `[[CONTEXT]]` setzen — der
PDF-Builder ersetzt ihn durch das SVG, der Word-Builder durch `@@IMG:…@@` → eingebettetes PNG.

---

## 8. Branding (P3 FORGE)

Quelle der Wahrheit: die Kunden-/Hausguideline. Für P3 FORGE gilt: **Neon-Lime `#dbff55` auf Deep-Indigo
`#00002d`**, Schrift **Inter** (Fallback SF Pro/Segoe), Radien 8/12/16/20.

| Rolle | Hex |
|---|---|
| Primärakzent (Lime) | `#dbff55` |
| Hintergrund / Navy | `#00002d` |
| Flächen | `#12124a`, `#303090` |
| Olive (3. Kategorie) | `#76a700` |
| Text (auf hell) | `#181833`; muted `#6a6a8a` |
| Text auf Lime | `#00002d` (dunkel — Kontrastregel!) |

**Regel:** Lime nur als Fläche/Linie/Akzent, **nie als Text auf Weiß** (Kontrast). Deckblatt dunkel, Body hell
und gut lesbar.

Anpassbar an **drei Stellen**: `scripts/md-to-pdf.mjs` (CSS-`:root` + Deckblatt/Tabellen),
`scripts/print-pdf.mjs` (Kopf-/Fußzeile), `scripts/build-erd.mjs` + `scripts/build-context.mjs` (Diagrammfarben).

---

## 9. Layout-Regeln

- **Jeder Hauptabschnitt (`##`) beginnt auf einer neuen Seite** (`page-break-before: always`).
- Großzügige Abstände (Zeilenhöhe ~1.6, Absatz-/Listen-/Tabellen-Padding) — lieber mehr Seiten als gedrängt.
- Tabellen brechen mit **wiederholtem Kopf** um (`thead { display: table-header-group }`), Zeilen nie zerreißen.
- **Seitenfuß auf jeder Seite** mit Seitenzahl („Seite X von Y") via Chrome-DevTools-Protokoll
  (`print-pdf.mjs`) — die einfache `--print-to-pdf`-CLI kann das nicht.

---

## 10. Toolchain & Build (Pipeline)

Siehe ausführlich [`README.md`](README.md). Kurzfassung:

```bash
# 1) Diagramme
node scripts/build-erd.mjs docs/erd.svg
node scripts/build-context.mjs docs/context.svg
qlmanage -t -s 2200 -o docs docs/erd.svg && mv docs/erd.svg.png docs/erd.png
qlmanage -t -s 2200 -o docs docs/context.svg && mv docs/context.svg.png docs/context.png

# 2) PDF (gebrandet)
node scripts/md-to-pdf.mjs docs/PROJEKTDOKUMENTATION.md docs/PROJEKTDOKUMENTATION.html
node scripts/print-pdf.mjs docs/PROJEKTDOKUMENTATION.html docs/PROJEKTDOKUMENTATION.pdf

# 3) DOCX (editierbar, mit eingebetteten Diagrammen)
node scripts/build-word.mjs docs/PROJEKTDOKUMENTATION.md docs/PROJEKTDOKUMENTATION.word.html
cd docs && textutil -convert docx PROJEKTDOKUMENTATION.word.html -output _tmp.docx
rm -rf _docx && mkdir _docx && (cd _docx && unzip -q ../_tmp.docx)
mkdir -p _docx/word/media && cp erd.png context.png _docx/word/media/
node ../scripts/embed-images-docx.mjs _docx
rm -f PROJEKTDOKUMENTATION.docx && (cd _docx && zip -q -X -r ../PROJEKTDOKUMENTATION.docx '[Content_Types].xml' _rels word docProps && zip -q -r ../PROJEKTDOKUMENTATION.docx . -x '[Content_Types].xml')
rm -rf _docx _tmp.docx PROJEKTDOKUMENTATION.word.html
```

**Voraussetzungen:** Node ≥ 22, Google Chrome (PDF), `textutil` + `qlmanage` (macOS, für DOCX/PNG). Die
Skripte sind dependency-frei (eigener Markdown-Parser, SVG-Generatoren, DOCX-Bildeinbettung).

---

## 11. Schritt-für-Schritt-Workflow

1. **Sammeln** (siehe §3): Repo lesen, Schema/ETL erfassen, Kundendokumente und Aufwände beschaffen.
2. **Datenmodell rekonstruieren** → `build-erd.mjs` anpassen.
3. **Systemkontext skizzieren** → `build-context.mjs` anpassen.
4. **`PROJEKTDOKUMENTATION.md` schreiben** entlang der Struktur (§5 dieses Playbooks); Begriffe ins Glossar, Platzhalter
   `[[ERD]]`/`[[CONTEXT]]` setzen.
5. **Kundenkatalog aufnehmen** (§9) — jede Position mit Status + Begründung.
6. **Executive Summary** zuletzt schreiben (sie fasst alles zusammen) — inkl. Aufwandstabelle.
7. **Bauen** (PDF + DOCX), **visuell prüfen** (Deckblatt, TOC, Diagramm-Seiten, Tabellen, Footer).
8. **Qualitäts-Check** (§12).
9. **Ausliefern** + Quelle (`*.md`) und Toolchain versionieren (Git-Commit).

---

## 12. Qualitäts-Checkliste (vor Auslieferung)

- [ ] Keine KI-/Reverse-Engineering-Formulierungen (grep nach „abgeleitet aus", „im Code", Dateipfaden).
- [ ] Keine verirrten Artefakte (`</content>`, TODO, Platzhalter-Reste `@@IMG`, `[[…]]`).
- [ ] Branding korrekt (Farben/Schrift/Footer), Deckblatt sauber, Logo/Marke richtig (kein falscher Name).
- [ ] Jede Kundenanforderung hat Status + Begründung; Zielbild vs. Ist-Stand getrennt.
- [ ] Beide Diagramme rendern (PDF eingebettet, DOCX als Bild), Bildunterschriften nummeriert.
- [ ] Tabellen mit wiederholtem Kopf, kein halbleerer Seitenumbruch, Footer mit korrekter Seitenzahl.
- [ ] PDF- und DOCX-Build erfolgreich; DOCX öffnet (QuickLook-Vorschau / `unzip -t`).
- [ ] Executive Summary verständlich für fachfremde Leser; Aufwandssumme stimmt.
- [ ] Datei-Duplikate/Intermediates nicht mit-committet (`*.html`, „… copy.*").

---

## 13. Datei- & Asset-Konventionen

```
docs/
  PROJEKTDOKUMENTATION.md            # Quelle (editieren)
  PROJEKTDOKUMENTATION.pdf           # gebrandetes PDF (generiert)
  PROJEKTDOKUMENTATION.docx          # editierbares Word (generiert)
  erd.svg / erd.png        # Datenmodell-Diagramm
  context.svg / context.png# Prozess-Skizze
  README.md                # Build-Anleitung
  PROJEKTDOKUMENTATION_PLAYBOOK.md   # dieses Dokument
scripts/
  build-erd.mjs  build-context.mjs
  md-to-pdf.mjs  print-pdf.mjs
  build-word.mjs embed-images-docx.mjs
.gitignore: docs/PROJEKTDOKUMENTATION.html, docs/*.word.html  (regenerierbare Intermediates)
```
</content>
