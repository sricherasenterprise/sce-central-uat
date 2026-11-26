/* SCE CENTRAL: tema Cerah / Gelap / Ikut peranti (26/11/2026). Dimuat dalam <head> sebelum halaman dilukis supaya tiada kelipan.
 * Pilihan disimpan dalam localStorage pelayar sahaja ("sce.tema" = cerah | gelap | auto). Cetakan sentiasa cerah (CSS @media print). */
(function () {
  "use strict";
  const KUNCI = "sce.tema", mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  let ingatan = null; // jika localStorage disekat, pilihan kekal untuk sesi ini sahaja
  const baca = () => { let v = ingatan; try { v = localStorage.getItem(KUNCI) || ingatan; } catch (e) { /* guna ingatan */ } return v === "cerah" || v === "gelap" ? v : "auto"; };
  function guna() {
    const p = baca(), gelap = p === "gelap" || (p === "auto" && !!(mq && mq.matches));
    document.documentElement.setAttribute("data-theme", gelap ? "dark" : "light");
    document.documentElement.setAttribute("data-tema-pilih", p);
    try { window.dispatchEvent(new Event("sce-tema")); } catch (e) { /* pelayar lama */ }
  }
  guna();
  if (mq) { const f = () => { if (baca() === "auto") guna(); }; if (mq.addEventListener) mq.addEventListener("change", f); else if (mq.addListener) mq.addListener(f); }
  window.SCE_TEMA = {
    pilihan: baca,
    tetap: function (v) { ingatan = v; try { localStorage.setItem(KUNCI, v === "cerah" || v === "gelap" ? v : "auto"); } catch (e) { /* pelayar sekat simpanan: tema hanya untuk sesi ini */ } guna(); }
  };
})();
