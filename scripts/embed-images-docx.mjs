// Post-process an extracted .docx directory: embed PNG diagrams at the
// @@IMG:erd@@ / @@IMG:context@@ placeholders. Patches [Content_Types].xml,
// word/_rels/document.xml.rels, word/document.xml. PNGs must already be at
// word/media/erd.png and word/media/context.png.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node embed-images-docx.mjs <extracted-docx-dir>'); process.exit(1); }

const EMU_PER_IN = 914400;
const MAX_W_EMU = Math.round(6.3 * EMU_PER_IN); // content width ~6.3in

function pngSize(path) {
    const b = readFileSync(path);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function extent(path) {
    const { w, h } = pngSize(path);
    const cx = MAX_W_EMU, cy = Math.round(MAX_W_EMU * h / w);
    return { cx, cy };
}

function drawingPara(rid, name, cx, cy, id) {
    return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>` +
        `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
        `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${name}"/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/>` +
        `<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
        `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

// 1) [Content_Types].xml — ensure png default
const ctPath = join(dir, '[Content_Types].xml');
let ct = readFileSync(ctPath, 'utf8');
if (!/Extension="png"/.test(ct)) {
    ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
    writeFileSync(ctPath, ct);
}

// 2) document.xml.rels — add image relationships
const relPath = join(dir, 'word/_rels/document.xml.rels');
let rel = readFileSync(relPath, 'utf8');
const addRel = (id, target) => {
    if (rel.includes(`Id="${id}"`)) return;
    rel = rel.replace('</Relationships>', `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`);
};
addRel('rId901', 'media/erd.png');
addRel('rId902', 'media/context.png');
writeFileSync(relPath, rel);

// 3) document.xml — replace placeholder paragraphs with image paragraphs
const docPath = join(dir, 'word/document.xml');
let doc = readFileSync(docPath, 'utf8');
const replaceImg = (token, rid, file, name, id) => {
    const mediaPath = join(dir, 'word/media', file);
    if (!existsSync(mediaPath)) { console.error('missing', mediaPath); return; }
    const { cx, cy } = extent(mediaPath);
    const re = new RegExp(`<w:p\\b[^>]*>(?:(?!</w:p>)[\\s\\S])*?${token}(?:(?!</w:p>)[\\s\\S])*?</w:p>`);
    if (!re.test(doc)) { console.error('placeholder not found:', token); return; }
    doc = doc.replace(re, drawingPara(rid, name, cx, cy, id));
};
replaceImg('@@IMG:erd@@', 'rId901', 'erd.png', 'ER-Diagramm', 901);
replaceImg('@@IMG:context@@', 'rId902', 'context.png', 'Prozess-Kontext', 902);
writeFileSync(docPath, doc);

console.log('patched docx dir:', dir);
