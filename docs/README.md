# Projektdokumentation — Build & Pflege

Dieses Verzeichnis enthält die **Projektdokumentation FreigabecockpitNEXT** samt Toolchain. Quelle der Wahrheit ist
`PROJEKTDOKUMENTATION.md`; PDF, DOCX und die Diagramme werden daraus generiert.

## Dateien
| Datei | Rolle |
|---|---|
| `PROJEKTDOKUMENTATION.md` | **Quelltext** der Projektdokumentation — hier wird inhaltlich editiert. |
| `PROJEKTDOKUMENTATION.pdf` | Generiertes, P3-gebrandetes PDF (Deckblatt, TOC, Diagramme, Seitenfuß). |
| `PROJEKTDOKUMENTATION.docx` | Generierte, editierbare Word-Datei (Überschriften als Formatvorlagen, Diagramme eingebettet). |
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
node scripts/md-to-pdf.mjs docs/PROJEKTDOKUMENTATION.md docs/PROJEKTDOKUMENTATION.html
node scripts/print-pdf.mjs docs/PROJEKTDOKUMENTATION.html docs/PROJEKTDOKUMENTATION.pdf
```

**Word (.docx):**
```bash
node scripts/build-word.mjs docs/PROJEKTDOKUMENTATION.md docs/PROJEKTDOKUMENTATION.word.html
cd docs && textutil -convert docx PROJEKTDOKUMENTATION.word.html -output _tmp.docx
rm -rf _docx && mkdir _docx && (cd _docx && unzip -q ../_tmp.docx)
mkdir -p _docx/word/media && cp erd.png context.png _docx/word/media/
node ../scripts/embed-images-docx.mjs _docx
rm -f PROJEKTDOKUMENTATION.docx && (cd _docx && zip -q -X -r ../PROJEKTDOKUMENTATION.docx '[Content_Types].xml' _rels word docProps && zip -q -r ../PROJEKTDOKUMENTATION.docx . -x '[Content_Types].xml')
rm -rf _docx _tmp.docx PROJEKTDOKUMENTATION.word.html
```

## Branding (P3 FORGE)
Markenwerte zentral: Neon-Lime `#dbff55` auf Deep-Indigo `#00002d`, Inter-Schrift. Anpassbar an drei Stellen:
- `scripts/md-to-pdf.mjs` → CSS-Block (`:root`-Tokens, Deckblatt, Tabellen).
- `scripts/print-pdf.mjs` → Kopf-/Fußzeile.
- `scripts/build-erd.mjs` & `scripts/build-context.mjs` → Diagramm-Farben.

Voraussetzungen: Node ≥ 22, Google Chrome (für PDF), `textutil`/`qlmanage` (macOS-Bordmittel, für DOCX/PNG).
