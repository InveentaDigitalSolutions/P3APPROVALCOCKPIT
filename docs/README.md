# Lastenheft — Build & Pflege

Dieses Verzeichnis enthält das **Lastenheft FreigabecockpitNEXT** samt Toolchain. Quelle der Wahrheit ist
`LASTENHEFT.md`; PDF, DOCX und die Diagramme werden daraus generiert.

## Dateien
| Datei | Rolle |
|---|---|
| `LASTENHEFT.md` | **Quelltext** des Lastenhefts — hier wird inhaltlich editiert. |
| `LASTENHEFT.pdf` | Generiertes, P3-gebrandetes PDF (Deckblatt, TOC, Diagramme, Seitenfuß). |
| `LASTENHEFT.docx` | Generierte, editierbare Word-Datei (Überschriften als Formatvorlagen, Diagramme eingebettet). |
| `erd.svg` / `erd.png` | ER-Diagramm (Datenmodell), erzeugt aus `scripts/build-erd.mjs`. |
| `context.svg` / `context.png` | Prozess-/Systemkontext-Skizze, erzeugt aus `scripts/build-context.mjs`. |
| `dataflow/` | FGC_DATA Power-Query-Exporte (git-ignoriert, da groß). |

## Toolchain (in `../scripts/`)
| Script | Zweck |
|---|---|
| `build-erd.mjs` | erzeugt `docs/erd.svg` (Entitäten/Beziehungen als Daten im Script). |
| `build-context.mjs` | erzeugt `docs/context.svg` (Prozess-Skizze). |
| `md-to-pdf.mjs` | Markdown → gestyltes HTML (enthält das **P3-Brand-CSS**, Deckblatt, TOC; bettet `erd.svg`/`context.svg` ein). |
| `print-pdf.mjs` | HTML → PDF über Headless-Chrome (DevTools-Protokoll; Seitenfuß mit Seitenzahlen). |
| `build-word.mjs` | Markdown → Word-freundliches HTML (Platzhalter `@@IMG:…@@` für Diagramme). |
| `embed-images-docx.mjs` | bettet die Diagramm-PNGs ins von `textutil` erzeugte DOCX ein. |

## Neu generieren

**Diagramme (nach Datenmodell-/Prozess-Änderung):**
```bash
node scripts/build-erd.mjs docs/erd.svg
node scripts/build-context.mjs docs/context.svg
# PNGs (für Word) aus den SVGs:
qlmanage -t -s 2200 -o docs docs/erd.svg && mv docs/erd.svg.png docs/erd.png
qlmanage -t -s 2200 -o docs docs/context.svg && mv docs/context.svg.png docs/context.png
```

**PDF:**
```bash
node scripts/md-to-pdf.mjs docs/LASTENHEFT.md docs/LASTENHEFT.html
node scripts/print-pdf.mjs docs/LASTENHEFT.html docs/LASTENHEFT.pdf
```

**Word (.docx):**
```bash
node scripts/build-word.mjs docs/LASTENHEFT.md docs/LASTENHEFT.word.html
cd docs && textutil -convert docx LASTENHEFT.word.html -output _tmp.docx
rm -rf _docx && mkdir _docx && (cd _docx && unzip -q ../_tmp.docx)
mkdir -p _docx/word/media && cp erd.png context.png _docx/word/media/
node ../scripts/embed-images-docx.mjs _docx
rm -f LASTENHEFT.docx && (cd _docx && zip -q -X -r ../LASTENHEFT.docx '[Content_Types].xml' _rels word docProps && zip -q -r ../LASTENHEFT.docx . -x '[Content_Types].xml')
rm -rf _docx _tmp.docx LASTENHEFT.word.html
```

## Branding (P3 FORGE)
Markenwerte zentral: Neon-Lime `#dbff55` auf Deep-Indigo `#00002d`, Inter-Schrift. Anpassbar an drei Stellen:
- `scripts/md-to-pdf.mjs` → CSS-Block (`:root`-Tokens, Deckblatt, Tabellen).
- `scripts/print-pdf.mjs` → Kopf-/Fußzeile.
- `scripts/build-erd.mjs` & `scripts/build-context.mjs` → Diagramm-Farben.

Voraussetzungen: Node ≥ 22, Google Chrome (für PDF), `textutil`/`qlmanage` (macOS-Bordmittel, für DOCX/PNG).
