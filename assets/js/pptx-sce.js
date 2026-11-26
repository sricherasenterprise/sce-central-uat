/* SCE CENTRAL: pembina PPTX Gambar Signboard (26/11/2026).
 * Meniru template pemilik "GAMBAR <tarikh>.pptx" (A4 menegak, 6858000 x 9906000 EMU):
 *   PENUH : satu gambar tapak memenuhi halaman.
 *   DUA   : potongan papan tanda (atas) + gambar tapak penuh lebih kecil (bawah).
 *   WEB   : imej laman web DBKL diputar 90° + teks "LAMAN WEB DBKL".
 * Zip ditulis sendiri (kaedah STORE + CRC32), tiada library luar. Bahagian master/layout/tema daripada pptx-asas.js.
 * Geometri juga dieksport untuk pratonton HTML / PDF supaya kedua-dua output sama. */
(function (root) {
  "use strict";
  const SLAID = { w: 6858000, h: 9906000 };
  const G = {
    PENUH: { x: 98323, y: 53259, w: 6656438, h: 9766709 },
    ATAS: { x: 98323, y: 53259, w: 6656438, h: 4154947 },
    BAWAH: { x: 1546313, y: 4286867, w: 3760457, h: 5516714 },
    WEB: { x: -1021223, y: 1818800, w: 8583668, h: 6268399 },
    WEB_TAJUK: { x: 5606898, y: 4768334, w: 1965158, h: 369332 }
  };

  /** Potongan "cover": pecahan {l,t,r,b} gambar supaya nisbahnya sama dengan bingkai (tiada herotan). */
  function cover(iw, ih, fw, fh) {
    const ri = iw / ih, rf = fw / fh;
    if (ri > rf) { const x = (1 - rf / ri) / 2; return { l: x, t: 0, r: x, b: 0 }; }
    const y = (1 - ri / rf) / 2; return { l: 0, t: y, r: 0, b: y };
  }
  /** Potongan papan tanda (halaman DUA, atas). o = 0 (paling atas) hingga 1 (paling bawah). */
  function potongAtas(iw, ih, o) {
    const c = cover(iw, ih, G.PENUH.w, G.PENUH.h), f = G.ATAS.h / G.PENUH.h, tinggi = 1 - c.t - c.b;
    const t = c.t + Math.max(0, Math.min(1, o || 0)) * (1 - f) * tinggi;
    return { l: c.l, r: c.r, t: t, b: Math.max(0, 1 - (t + f * tinggi)) };
  }
  /** Senarai elemen (bingkai, potongan, putaran) bagi satu halaman. Dikongsi oleh PPTX dan HTML. */
  function susun(h) {
    const im = h.img;
    if (h.jenis === "PENUH") return [{ img: im, f: G.PENUH, c: cover(im.w, im.h, G.PENUH.w, G.PENUH.h) }];
    if (h.jenis === "DUA") return [{ img: im, f: G.ATAS, c: potongAtas(im.w, im.h, h.potong) }, { img: im, f: G.BAWAH, c: cover(im.w, im.h, G.BAWAH.w, G.BAWAH.h) }];
    // WEB: imej melintang diputar 90° (macam template); imej menegak diletak terus di tengah.
    const landskap = im.w >= im.h;
    const f = landskap ? G.WEB : { x: Math.round((SLAID.w - G.WEB.h) / 2), y: Math.round((SLAID.h - G.WEB.w) / 2), w: G.WEB.h, h: G.WEB.w };
    return [{ img: im, f: f, c: cover(im.w, im.h, f.w, f.h), rot: landskap ? 90 : 0, garis: true }, { teks: "LAMAN WEB DBKL", f: G.WEB_TAJUK, rot: 90 }];
  }

  /* ---------- Zip (STORE) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(fail) {
    const enc = new TextEncoder(), bahagian = [], pusat = [];
    const d = new Date(), masa = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), tarikh = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    let ofs = 0;
    fail.forEach(([nama, isi]) => {
      const n = enc.encode(nama), data = typeof isi === "string" ? enc.encode(isi) : isi, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30 + n.length));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, masa, 2], [12, tarikh, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, n.length, 2], [28, 0, 2]]
        .forEach(([o, v, s]) => (s === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
      new Uint8Array(lh.buffer).set(n, 30);
      bahagian.push(new Uint8Array(lh.buffer), data);
      const ch = new DataView(new ArrayBuffer(46 + n.length));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, masa, 2], [14, tarikh, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, n.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, ofs, 4]]
        .forEach(([o, v, s]) => (s === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
      new Uint8Array(ch.buffer).set(n, 46);
      pusat.push(new Uint8Array(ch.buffer));
      ofs += 30 + n.length + data.length;
    });
    const saizPusat = pusat.reduce((a, x) => a + x.length, 0);
    const akhir = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, fail.length, 2], [10, fail.length, 2], [12, saizPusat, 4], [16, ofs, 4], [20, 0, 2]]
      .forEach(([o, v, s]) => (s === 4 ? akhir.setUint32(o, v, true) : akhir.setUint16(o, v, true)));
    return bahagian.concat(pusat, [new Uint8Array(akhir.buffer)]);
  }

  /* ---------- XML slaid ---------- */
  const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const pc = (v) => Math.max(0, Math.round(v * 100000));
  const escX = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function xmlSlaid(el, rid) {
    let id = 2;
    const isi = el.map((e) => {
      const xf = '<a:xfrm' + (e.rot ? ' rot="' + e.rot * 60000 + '"' : "") + '><a:off x="' + e.f.x + '" y="' + e.f.y + '"/><a:ext cx="' + e.f.w + '" cy="' + e.f.h + '"/></a:xfrm>';
      if (e.teks) return '<p:sp><p:nvSpPr><p:cNvPr id="' + id++ + '" name="TextBox"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>' + xf + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
        '<p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-MY" dirty="0"/><a:t>' + escX(e.teks) + "</a:t></a:r></a:p></p:txBody></p:sp>";
      const c = e.c;
      return '<p:pic><p:nvPicPr><p:cNvPr id="' + id++ + '" name="Picture ' + id + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
        '<p:blipFill><a:blip r:embed="' + rid(e.img) + '"/><a:srcRect l="' + pc(c.l) + '" t="' + pc(c.t) + '" r="' + pc(c.r) + '" b="' + pc(c.b) + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
        "<p:spPr>" + xf + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + (e.garis ? '<a:ln><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:ln>' : "") + "</p:spPr></p:pic>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ' + NS + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      isi + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  }

  /**
   * Bina PPTX. halaman: [{ jenis: "PENUH"|"DUA"|"WEB", img: { bait: Uint8Array, ext: "jpeg"|"png", w, h }, potong? }].
   * Pulangkan senarai Uint8Array (untuk new Blob([...])).
   */
  function bina(halaman, opsyen) {
    const asas = root.SCE_PPTX_ASAS; if (!asas) throw new Error("Aset PPTX belum dimuat.");
    const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
    const media = [], fail = [];
    const mediaNama = (img) => { let i = media.indexOf(img); if (i < 0) { media.push(img); i = media.length - 1; } return "image" + (i + 1) + "." + (img.ext === "png" ? "png" : "jpeg"); };
    halaman.forEach((h, n) => {
      const el = susun(h), rels = [];
      const rid = (img) => { const nm = mediaNama(img); let r = rels.find((x) => x.nm === nm); if (!r) { r = { id: "rId" + (rels.length + 2), nm: nm }; rels.push(r); } return r.id; };
      fail.push(["ppt/slides/slide" + (n + 1) + ".xml", xmlSlaid(el, rid)]);
      fail.push(["ppt/slides/_rels/slide" + (n + 1) + ".xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'slideLayout" Target="../slideLayouts/slideLayout2.xml"/>' +
        rels.map((r) => '<Relationship Id="' + r.id + '" Type="' + R + 'image" Target="../media/' + r.nm + '"/>').join("") + "</Relationships>"]);
    });
    media.forEach((img, i) => fail.push(["ppt/media/image" + (i + 1) + "." + (img.ext === "png" ? "png" : "jpeg"), img.bait]));
    const N = halaman.length;
    const pres = asas["ppt/presentation.xml"].replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, "<p:sldIdLst>" + halaman.map((_, i) => '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>').join("") + "</p:sldIdLst>")
      .replace(/<p:notesMasterId r:id="[^"]+"\/>/, '<p:notesMasterId r:id="rId90"/>');
    const presRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
      halaman.map((_, i) => '<Relationship Id="rId' + (i + 2) + '" Type="' + R + 'slide" Target="slides/slide' + (i + 1) + '.xml"/>').join("") +
      '<Relationship Id="rId90" Type="' + R + 'notesMaster" Target="notesMasters/notesMaster1.xml"/><Relationship Id="rId91" Type="' + R + 'presProps" Target="presProps.xml"/><Relationship Id="rId92" Type="' + R + 'viewProps" Target="viewProps.xml"/><Relationship Id="rId93" Type="' + R + 'theme" Target="theme/theme1.xml"/><Relationship Id="rId94" Type="' + R + 'tableStyles" Target="tableStyles.xml"/></Relationships>';
    const CT = "application/vnd.openxmlformats-officedocument.";
    const ov = (p, t) => '<Override PartName="/' + p + '" ContentType="' + t + '"/>';
    const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      ov("ppt/presentation.xml", CT + "presentationml.presentation.main+xml") + ov("ppt/slideMasters/slideMaster1.xml", CT + "presentationml.slideMaster+xml") +
      halaman.map((_, i) => ov("ppt/slides/slide" + (i + 1) + ".xml", CT + "presentationml.slide+xml")).join("") +
      Array.from({ length: 11 }, (_, i) => ov("ppt/slideLayouts/slideLayout" + (i + 1) + ".xml", CT + "presentationml.slideLayout+xml")).join("") +
      ov("ppt/notesMasters/notesMaster1.xml", CT + "presentationml.notesMaster+xml") + ov("ppt/presProps.xml", CT + "presentationml.presProps+xml") + ov("ppt/viewProps.xml", CT + "presentationml.viewProps+xml") +
      ov("ppt/theme/theme1.xml", CT + "theme+xml") + ov("ppt/theme/theme2.xml", CT + "theme+xml") + ov("ppt/tableStyles.xml", CT + "presentationml.tableStyles+xml") +
      ov("docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml") + ov("docProps/app.xml", CT + "extended-properties+xml") + "</Types>";
    const kini = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + escX((opsyen && opsyen.tajuk) || "Gambar Signboard") + "</dc:title><dc:creator>SCE CENTRAL</dc:creator><cp:lastModifiedBy>SCE CENTRAL</cp:lastModifiedBy><cp:revision>1</cp:revision>" +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + kini + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + kini + "</dcterms:modified></cp:coreProperties>";
    const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Office PowerPoint</Application><PresentationFormat>A4 Paper (210x297 mm)</PresentationFormat><Slides>' + N + "</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides></Properties>";
    const semua = [["[Content_Types].xml", types],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="' + R + 'extended-properties" Target="docProps/app.xml"/></Relationships>'],
      ["docProps/core.xml", core], ["docProps/app.xml", app], ["ppt/presentation.xml", pres], ["ppt/_rels/presentation.xml.rels", presRels]]
      .concat(Object.keys(asas).filter((k) => k !== "ppt/presentation.xml").map((k) => [k, asas[k]]), fail);
    return zip(semua);
  }

  root.SCE_PPTX = { SLAID: SLAID, G: G, cover: cover, potongAtas: potongAtas, susun: susun, bina: bina, crc32: crc32 };
})(typeof window !== "undefined" ? window : globalThis);
