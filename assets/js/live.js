/*
 * SCE CENTRAL DEV: sambungan ke backend DEV (P1-3).
 * Dimuatkan SEBELUM app.js. Menyediakan window.SCE_LIVE:
 *  - login/logout sebenar (emel + password) ke projek Apps Script "SCE CENTRAL - DEV" (baca sahaja)
 *  - api(action) untuk data sebenar Program dan Order Signboard
 * Mod pratonton UI dengan data contoh sahaja: tambah ?demo=1 pada URL.
 * Token disimpan dalam sessionStorage (hilang apabila tab ditutup).
 */
(function () {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbxYxl2vb0bc1gCQ0RqsyOXHvydXcmQy8m59bfqpyAXkWXQTFpM9Z_zLDGkE5IyLjhag/exec";
  const K_TOKEN = "sce-live-token", K_USER = "sce-live-user";
  const ROLE_LABEL = { SUPER_ADMIN: "SUPER ADMIN", MANAGEMENT: "MANAGEMENT", PROJECT_MANAGER: "PROJECT MANAGER", STAFF: "STAFF", VIEWER: "VIEWER" };

  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* tiada storan */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* tiada storan */ } }
  };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const demo = new URLSearchParams(location.search).get("demo") === "1";

  function user() {
    if (demo) return null;
    try {
      const u = JSON.parse(ss.get(K_USER) || "null");
      return u && ss.get(K_TOKEN) && ROLE_LABEL[u.role] ? u : null;
    } catch (e) { return null; }
  }

  function clear() { ss.del(K_TOKEN); ss.del(K_USER); }

  async function post(body) {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow", credentials: "omit" });
    if (!res.ok) throw new Error("Pelayan tidak dapat dihubungi (" + res.status + ").");
    return res.json();
  }

  /** Panggil action backend dengan token sesi. Sesi tamat → kembali ke skrin login. */
  async function api(action, extra) {
    const out = await post(Object.assign({ action: action, token: ss.get(K_TOKEN) || "" }, extra || {}));
    if (!out.ok && (out.code === "SESI_TAMAT")) { clear(); location.reload(); throw new Error(out.error); }
    if (!out.ok) { const e = new Error(out.error || "Ralat."); e.code = out.code; throw e; }
    return out;
  }

  async function logout() {
    try { await post({ action: "auth.logout", token: ss.get(K_TOKEN) || "" }); } catch (e) { /* tetap log keluar di pelayar */ }
    clear();
    location.hash = "";
    location.reload();
  }

  function renderLogin() {
    document.title = "Log Masuk · SCE CENTRAL";
    const app = document.querySelector(".app");
    if (app) app.hidden = true;
    const box = document.createElement("main");
    box.className = "login-screen";
    box.innerHTML =
      '<form class="login-card" novalidate>' +
        '<div class="login-brand"><span class="brand-mark" aria-hidden="true">SCE</span><div><strong>SCE CENTRAL</strong><small>Sri Cheras Enterprise · DEV</small></div></div>' +
        '<h1>Log masuk</h1>' +
        '<p class="login-note">Persekitaran DEV. Data Program dan Order Signboard dibaca daripada rekod sebenar secara baca sahaja.</p>' +
        '<div class="login-msg" role="alert" hidden></div>' +
        '<div class="field"><label for="login-emel">Emel</label><input id="login-emel" type="email" autocomplete="username" required maxlength="254"></div>' +
        '<div class="field"><label for="login-pw">Password</label><input id="login-pw" type="password" autocomplete="current-password" required maxlength="200"></div>' +
        '<button type="submit" class="btn primary login-btn">Log masuk</button>' +
        '<p class="login-foot">Notis PDPA: emel dan rekod cubaan log masuk diproses untuk kawalan akses dan audit keselamatan sahaja. <a href="?demo=1">Pratonton UI dengan data contoh</a></p>' +
      "</form>";
    document.body.appendChild(box);
    const form = box.querySelector("form"), msg = box.querySelector(".login-msg"), btn = box.querySelector(".login-btn");
    const show = (t) => { msg.textContent = t; msg.hidden = false; };
    box.querySelector("#login-emel").focus();
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const emel = form.querySelector("#login-emel").value.trim(), pw = form.querySelector("#login-pw").value;
      if (!emel || !pw) { show("Sila isi emel dan password."); return; }
      btn.disabled = true; btn.textContent = "Mengesahkan…"; msg.hidden = true;
      try {
        const out = await post({ action: "auth.login", emel: emel, password: pw });
        if (!out.ok) { show(out.error || "Log masuk gagal."); return; }
        ss.set(K_TOKEN, out.token);
        ss.set(K_USER, JSON.stringify(out.user));
        location.reload();
      } catch (e) {
        show("Tidak dapat menghubungi pelayan. Semak sambungan internet dan cuba lagi.");
      } finally {
        btn.disabled = false; btn.textContent = "Log masuk";
        form.querySelector("#login-pw").value = "";
      }
    });
  }

  document.addEventListener("click", (ev) => { if (ev.target.closest("[data-live-logout]")) { ev.preventDefault(); logout(); } });

  window.SCE_LIVE = Object.freeze({ demo: demo, user: user, api: api, logout: logout, renderLogin: renderLogin, roleLabel: (r) => ROLE_LABEL[r] || r, esc: esc });
})();
