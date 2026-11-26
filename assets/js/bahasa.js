/* SCE CENTRAL: dwibahasa BM / English (26/11/2026). Dimuat dalam <head>.
 * Mod BM (asal): tiada apa berlaku. Mod EN: teks paparan BM ditukar kepada English menggunakan kamus (kamus-en.js),
 * tepat (padanan penuh) atau melalui pola (teks dinamik seperti "3 daripada 5 fail").
 * TIDAK disentuh: data pengguna (nama, tajuk), medan input, dan kertas yang dicetak (quotation, slip, keratan akhbar, gambar).
 * Pilihan disimpan dalam localStorage pelayar ("sce.bahasa" = bm | en). Tukar bahasa = muat semula halaman. */
(function () {
  "use strict";
  const KUNCI = "sce.bahasa";
  let ingatan = null;
  const baca = () => { let v = ingatan; try { v = localStorage.getItem(KUNCI) || ingatan; } catch (e) { /* guna ingatan */ } return v === "en" ? "en" : "bm"; };
  const bahasa = baca();
  document.documentElement.setAttribute("lang", bahasa === "en" ? "en" : "ms");
  window.SCE_BAHASA = {
    semasa: bahasa,
    tetap: function (v) { ingatan = v; try { localStorage.setItem(KUNCI, v === "en" ? "en" : "bm"); } catch (e) { /* sesi sahaja */ } location.reload(); },
    t: function (s) { return s; }
  };
  if (bahasa !== "en") return;

  const LANGKAU = "#print-area,.slip-pratonton,.quo,.slip,.akh-hal,.gsb-hal,.lg-hal,script,style,textarea,[data-no-tr],[contenteditable]";
  const ATRIBUT = ["placeholder", "title", "aria-label", "data-label"]; // data-label = label jadual dalam paparan telefon (CSS ::before)
  const kamus = () => window.SCE_KAMUS_EN || {};
  const pola = () => window.SCE_POLA_EN || [];
  const cache = new Map();
  /** Terjemah satu rentetan (tanpa ruang hujung). Pulangkan null jika tiada padanan. */
  function terjemah(s) {
    if (!s || !/[A-Za-z]/.test(s)) return null;
    if (cache.has(s)) return cache.get(s);
    const k = kamus();
    let h = Object.prototype.hasOwnProperty.call(k, s) ? k[s] : null;
    if (h === null) {
      for (const [re, ganti] of pola()) {
        re.lastIndex = 0;
        if (re.test(s)) { re.lastIndex = 0; h = s.replace(re, typeof ganti === "function" ? (...a) => ganti(terjemahAtauAsal, ...a) : ganti); break; }
      }
    }
    if (cache.size > 5000) cache.clear();
    cache.set(s, h);
    return h;
  }
  const terjemahAtauAsal = (s) => { const t = terjemah(String(s).trim()); return t === null ? s : t; };
  window.SCE_BAHASA.t = terjemahAtauAsal;

  function teksNod(n) {
    const v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v)) return;
    const p = n.parentElement; if (!p || p.closest(LANGKAU)) return;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v), inti = m[2].replace(/\s+/g, " ");
    const t = terjemah(inti);
    if (t !== null && t !== inti) n.nodeValue = m[1] + t + m[3];
  }
  function elemen(el) {
    if (el.nodeType !== 1 || el.closest(LANGKAU)) return;
    ATRIBUT.forEach((a) => { const v = el.getAttribute(a); if (v) { const t = terjemah(v.replace(/\s+/g, " ").trim()); if (t !== null && t !== v) el.setAttribute(a, t); } });
    if (el.tagName === "INPUT" && (el.type === "button" || el.type === "submit") && el.value) { const t = terjemah(el.value.trim()); if (t !== null) el.value = t; }
  }
  function proses(akar) {
    if (!akar) return;
    if (akar.nodeType === 3) { teksNod(akar); return; }
    if (akar.nodeType !== 1 && akar.nodeType !== 9 && akar.nodeType !== 11) return;
    if (akar.nodeType === 1) { if (akar.closest(LANGKAU)) return; elemen(akar); }
    const w = document.createTreeWalker(akar, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === 1 && n.matches(LANGKAU) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) teksNod(n); else elemen(n); }
  }
  function tajuk() {
    const t = document.title, i = t.lastIndexOf(" · SCE CENTRAL");
    if (i > 0) { const tr = terjemah(t.slice(0, i)); if (tr !== null && tr + " · SCE CENTRAL" !== t) document.title = tr + " · SCE CENTRAL"; }
  }
  // Terjemah setiap kali DOM berubah (paparan, modal, toast). Perubahan kita sendiri tidak berulang kerana teks English tiada dalam kamus.
  const obs = new MutationObserver((senarai) => {
    for (const m of senarai) {
      if (m.type === "characterData") teksNod(m.target);
      else if (m.type === "attributes") elemen(m.target);
      else m.addedNodes.forEach(proses);
    }
    tajuk();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUT });
  document.addEventListener("DOMContentLoaded", () => { proses(document.body); tajuk(); });
  // Dialog asli (confirm / alert) juga diterjemah
  const asalConfirm = window.confirm.bind(window), asalAlert = window.alert.bind(window);
  window.confirm = (s) => asalConfirm(String(s).split("\n").map((x) => terjemahAtauAsal(x)).join("\n"));
  window.alert = (s) => asalAlert(String(s).split("\n").map((x) => terjemahAtauAsal(x)).join("\n"));
})();
