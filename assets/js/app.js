/*
 * SCE CENTRAL: Business Operations Platform (build DEV)
 * Semua data ialah DATA CONTOH fiksyen. Fail ini tidak memanggil API, Google Sheets atau perkhidmatan luar.
 * Pemilih role ialah DEV DEMO ONLY dan bukan pengesahan sebenar.
 * Titik integrasi backend: objek DAL (lapisan data berskop) dan PERMISSIONS (kebenaran berpusat).
 */
(function () {
  "use strict";

  /* ========== Mod LIVE (P1-3): login sebenar ke backend DEV. ?demo=1 = pratonton data contoh sahaja ========== */
  const LIVE = window.SCE_LIVE || null;
  const LIVE_USER = LIVE ? LIVE.user() : null;
  if (LIVE && !LIVE.demo && !LIVE_USER) { LIVE.renderLogin(); return; }
  if (LIVE_USER && LIVE.mustChange()) { LIVE.renderChangePassword(); return; }

  /* ========== Tarikh (ISO, GMT+8) ========== */
  const TZ = "Asia/Kuala_Lumpur";
  const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const YEAR = TODAY.slice(0, 4);
  const iso = (d) => d.toISOString().slice(0, 10);
  const plus = (n) => { const d = new Date(TODAY + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const stamp = (n, hm) => plus(n) + "T" + (hm || "09:00") + ":00+08:00";
  const nowIso = () => new Date().toISOString();
  const diffDays = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
  const MONTHS = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  const MONTHS_FULL = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
  const DAYS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  const fmtDate = (s) => { const [y, m, d] = s.split("-"); return d + "/" + m + "/" + y; };
  const tzDay = (s) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(s));
  const fmtDateTime = (s) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(s)).replace(",", "");
  const lastMonths = (n) => {
    const [y, m] = TODAY.split("-").map(Number);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
      return MONTHS[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2);
    });
  };

  /* ========== KEBENARAN BERPUSAT: satu-satunya tempat kebenaran role ditakrifkan ========== */
  const ROLES = ["SUPER ADMIN", "MANAGEMENT", "PROJECT MANAGER", "STAFF", "VIEWER"];
  const COMPANY_ROUTES = ["dashboard", "workspace", "projects", "tasks", "programs", "dbkl", "documents", "analytics", "finance", "access", "staff", "notifications"];
  const PERMISSIONS = {
    "SUPER ADMIN": {
      scope: "company", dashboard: "executive", taskApprove: "if-reviewer", audit: "full",
      routes: COMPANY_ROUTES.concat("settings"),
      caps: ["finance.view", "finance.write", "finance.approve", "finance.export", "project.request", "project.edit", "project.archive", "task.assign", "task.respond", "program.manage", "dbkl.manage", "dbkl.contractors", "dbkl.work", "doc.view", "doc.upload", "analytics.company", "analytics.export", "users.manage", "superadmin.manage", "roles.view", "instruction.send", "notifications.receive", "workspace.projects", "workspace.documents"]
    },
    MANAGEMENT: {
      scope: "company", dashboard: "management", taskApprove: "all", audit: "restricted",
      routes: COMPANY_ROUTES,
      caps: ["finance.view", "finance.write", "finance.approve", "finance.export", "project.request", "project.approve", "project.edit", "project.archive", "task.assign", "task.respond", "program.manage", "dbkl.manage", "dbkl.contractors", "dbkl.work", "doc.view", "doc.upload", "analytics.company", "analytics.export", "instruction.send", "notifications.receive", "workspace.projects", "workspace.documents"]
    },
    "PROJECT MANAGER": {
      scope: "assigned", dashboard: "pm", taskApprove: "own-projects", audit: "none",
      routes: ["dashboard", "workspace", "projects", "tasks", "programs", "dbkl", "documents", "analytics", "staff", "notifications"],
      caps: ["project.request", "project.edit", "task.assign", "task.respond", "program.manage", "dbkl.manage", "dbkl.contractors", "dbkl.work", "doc.view", "doc.upload", "notifications.receive", "workspace.projects", "workspace.documents"]
    },
    STAFF: {
      scope: "self", dashboard: "staff", taskApprove: "none", audit: "none",
      routes: ["dashboard", "workspace", "tasks", "programs", "dbkl", "notifications"],
      caps: ["task.respond", "dbkl.work", "notifications.receive"]
    },
    VIEWER: { scope: "summary", dashboard: "viewer", taskApprove: "none", audit: "none", routes: ["dashboard"], caps: [] }
  };
  // Keperluan kebenaran bagi tindakan; disemak di satu tempat sebelum tindakan dijalankan.
  const ACTION_CAPS = {
    "new-project": "project.request", "resubmit-project": "project.request", "approve-project": "project.approve", "reject-project": "project.approve", "edit-project": "project.edit", "archive-project": "project.archive",
    "new-task": "task.assign", "accept-task": "task.respond", "reject-task": "task.respond", "task-progress": "task.respond", "submit-review": "task.respond",
    "new-event": "program.manage", "edit-event": "program.manage", "new-permit": "dbkl.manage", "update-wo": "dbkl.work", "new-evidence": "dbkl.work",
    "task-comment": "task.respond", "task-attach": "task.respond",
    "new-doc": "doc.upload", "doc-version": "doc.upload", "dl-doc": "doc.view", "open-doc": "doc.view",
    "new-expense": "finance.write", "new-income": "finance.write", "approve-tx": "finance.approve", "export-fin": "finance.export", "export-analytics": "analytics.export",
    "new-user": "users.manage", "toggle-user": "users.manage", "change-role": "users.manage", "appoint-sa": "superadmin.manage", "remove-sa": "superadmin.manage", "new-instruction": "instruction.send"
  };

  /* ========== Storan demo (sessionStorage tab ini) ========== */
  const KEY_OPS = "sce-demo-ops-v3", KEY_FIN = "sce-demo-fin-v2", KEY_PERSONA = "sce-demo-persona", KEY_LOGIN = "sce-demo-login";
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* tiada storan */ } }
  };
  const parseJson = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

  /* ========== DATA OPERASI CONTOH ========== */
  const RM = (n) => Math.round(n * 100); // wang disimpan dalam sen (integer)
  const AMIR = "Amir", M1 = "Pengurus Contoh 1", M2 = "Pengurus Contoh 2", PM1 = "PM Contoh 1", PM2 = "PM Contoh 2", PM3 = "PM Contoh 3", V1 = "Pemerhati Contoh";
  const S = (n) => "Staf Contoh " + n;
  const projId = (n) => "SCE-PRJ-" + YEAR + "-" + String(n).padStart(4, "0");
  const PERSONAS = { amir: AMIR, mgmt: M1, pm: PM1, staff: S(1), viewer: V1 };

  function seedOps() {
    const seedHistory = (text, by, d) => [{ at: stamp(d), by, text }];
    const projects = [
      [1, "Projek Contoh Alfa", "ACTIVE", "ON TRACK", 62, PM1, [S(1), S(2)], -60, 40, "Tinggi"],
      [2, "Projek Contoh Bravo", "ACTIVE", "AT RISK", 38, PM1, [S(1)], -40, 12, "Tinggi"],
      [3, "Projek Contoh Charlie", "PLANNING", "ON TRACK", 10, PM2, [S(3)], -5, 90, "Sederhana"],
      [4, "Projek Contoh Delta", "ACTIVE", "ON TRACK", 74, PM1, [S(2)], -80, 25, "Tinggi"],
      [5, "Projek Contoh Echo", "COMPLETED", "ON TRACK", 100, PM3, [S(5)], -150, -14, "Rendah"],
      [6, "Projek Contoh Foxtrot", "ON HOLD", "DELAYED", 22, PM2, [], -90, 120, "Sederhana"],
      [7, "Projek Contoh Golf", "ACTIVE", "ON TRACK", 45, PM3, [S(3)], -35, 55, "Sederhana"],
      [8, "Projek Contoh Hotel", "ACTIVE", "DELAYED", 51, PM3, [S(3)], -70, 6, "Tinggi"],
      [9, "Projek Contoh India", "PLANNING", "ON TRACK", 5, PM1, [S(2)], -2, 110, "Rendah"],
      [10, "Projek Contoh Juliet", "COMPLETED", "ON TRACK", 100, PM1, [S(5)], -200, -30, "Sederhana"],
      [11, "Projek Contoh Kilo", "ACTIVE", "ON TRACK", 81, PM2, [S(2), S(3)], -100, 18, "Tinggi"],
      [12, "Projek Contoh Lima", "PLANNING", "ON TRACK", 15, PM3, [S(4)], -3, 75, "Rendah"],
      [13, "Permohonan Projek Contoh Mike", "PENDING APPROVAL", "ON TRACK", 0, PM1, [S(1)], 7, 150, "Sederhana"],
      [14, "Projek Contoh November (Arkib)", "ARCHIVED", "ON TRACK", 100, PM2, [], -300, -120, "Rendah"],
      [15, "Permohonan Projek Contoh Oscar", "REJECTED", "ON TRACK", 0, PM1, [S(2)], 14, 120, "Rendah"]
    ].map(([n, name, status, schedule, progress, pm, team, s, t, priority]) => ({
      id: projId(n), name, client: "Pemaju Contoh " + String.fromCharCode(64 + ((n % 4) + 1)), location: "Lokasi Contoh " + n,
      description: "Keterangan projek contoh untuk paparan DEV.", pm, team, start: plus(s), target: plus(t), priority, status, schedule, progress,
      approval: status === "PENDING APPROVAL" ? "PENDING" : status === "REJECTED" ? "REJECTED" : "APPROVED", requestedBy: pm, reason: "", requestLog: [],
      history: seedHistory(status === "PENDING APPROVAL" || status === "REJECTED" ? "Permohonan projek dihantar" : "Rekod projek contoh dicipta", pm, Math.min(s, -1, n >= 13 ? -4 : -1))
    }));
    // Rekod keputusan permohonan contoh (siapa, keputusan, masa, sebab).
    const reqLog = (action, by, role, d, hm, note) => ({ action, by, role, at: stamp(d, hm), note: note || "" });
    projects[12].requestLog = [reqLog("DIHANTAR", PM1, "PROJECT MANAGER", -1, "17:40")];
    const rejectNote = "Skop kerja dan sasaran siap perlu diperincikan (contoh).";
    projects[14].reason = rejectNote;
    projects[14].requestLog = [reqLog("DIHANTAR", PM1, "PROJECT MANAGER", -4, "10:00"), reqLog("DITOLAK", M1, "MANAGEMENT", -3, "15:20", rejectNote)];
    projects[14].history.unshift({ at: stamp(-3, "15:20"), by: M1, text: "Permohonan ditolak: " + rejectNote });

    const accepted = (names) => Object.fromEntries(names.map((n) => [n, { state: "ACCEPTED", reason: "" }]));
    const tasks = [
      ["TSK-101", "Semak draf laporan kemajuan", 2, "Laporan", PM1, S(1), [S(2)], "Tinggi", "IN PROGRESS", 60, -2],
      ["TSK-102", "Sahkan senarai ahli pasukan", 1, "Pentadbiran", PM1, S(1), [], "Sederhana", "TODO", 0, -1, "PENDING ACCEPTANCE"],
      ["TSK-103", "Kemas kini garis masa projek", 4, "Perancangan", M1, PM1, [], "Tinggi", "IN PROGRESS", 40, 0],
      ["TSK-104", "Sediakan minit mesyuarat", 1, "Pentadbiran", PM1, S(2), [S(1)], "Rendah", "TODO", 0, 1],
      ["TSK-105", "Semak permohonan permit contoh", 2, "DBKL", PM1, S(1), [], "Tinggi", "PENDING REVIEW", 100, 3],
      ["TSK-106", "Kumpul dokumen sokongan", 9, "Dokumentasi", PM1, S(2), [], "Sederhana", "TODO", 10, 3],
      ["TSK-107", "Hantar laporan bulanan", 4, "Laporan", M1, PM1, [], "Sederhana", "REVISION REQUIRED", 80, 9],
      ["TSK-108", "Tutup senarai semak akhir", 10, "Pentadbiran", PM1, S(5), [], "Rendah", "COMPLETED", 100, -8],
      ["TSK-109", "Jadualkan sesi libat urus", 7, "Program", PM3, S(3), [], "Sederhana", "IN PROGRESS", 30, 2],
      ["TSK-110", "Sediakan bahan taklimat", 3, "Program", PM2, S(3), [], "Rendah", "TODO", 0, 12],
      ["TSK-112", "Kemas kini daftar risiko", 8, "Perancangan", PM3, S(3), [], "Tinggi", "BLOCKED", 20, -3],
      ["TSK-113", "Lengkapkan laporan penutup", 5, "Laporan", PM3, S(5), [], "Sederhana", "COMPLETED", 100, -15],
      ["TSK-114", "Sediakan kertas cadangan", 12, "Dokumentasi", PM3, S(4), [], "Rendah", "TODO", 0, 20],
      ["TSK-115", "Sahkan lokasi pemasangan", 11, "DBKL", PM2, S(2), [], "Sederhana", "COMPLETED", 100, -5],
      ["TSK-116", "Semak arahan operasi contoh", null, "Pentadbiran", AMIR, S(5), [], "Sederhana", "PENDING REVIEW", 100, 4]
    ].map(([id, title, pn, category, assignedBy, primary, additional, priority, status, prog, d, primaryState]) => {
      const assign = accepted([primary].concat(additional));
      if (primaryState) assign[primary].state = primaryState;
      return { id, title, description: "Keterangan tugasan contoh.", project: pn ? projId(pn) : "", category, assignedBy, reviewer: assignedBy, primary, additional, start: plus(Math.min(d, 0) - 7), due: plus(d), priority, status, progress: prog, assign, notes: [], comments: [], attachments: [], history: seedHistory("Tugasan diberikan kepada " + primary, assignedBy, Math.min(d, 0) - 7) };
    });

    const events = [
      ["EVT-01", "Sesi Contoh COMSTRA 1", "COMSTRA", "Selesai", -41, 1, 1, [S(1)]],
      ["EVT-02", "Sesi Contoh SLU 1", "SLU", "Selesai", -33, 2, 2, [S(1)]],
      ["EVT-03", "Sesi Contoh SLU Parlimen 1", "SLU PARLIMEN", "Selesai", -27, 3, 7, [S(3)]],
      ["EVT-04", "Sesi Contoh COMSTRA 2", "COMSTRA", "Batal", -20, 1, 4, [S(2)]],
      ["EVT-05", "Sesi Contoh SLU 2", "SLU", "Selesai", -13, 4, 3, [S(3)]],
      ["EVT-06", "Sesi Contoh COMSTRA 3", "COMSTRA", "Dirancang", -4, 2, 1, [S(1)]],
      ["EVT-07", "Sesi Contoh SLU Parlimen 2", "SLU PARLIMEN", "Ditangguh", -2, 5, 8, [S(3)]],
      ["EVT-08", "Sesi Contoh SLU 3", "SLU", "Dirancang", 0, 3, 4, [S(1), S(2)]],
      ["EVT-09", "Sesi Contoh COMSTRA 4", "COMSTRA", "Dirancang", 2, 6, 11, [S(3)]],
      ["EVT-10", "Sesi Contoh SLU 4", "SLU", "Dirancang", 5, 1, 1, [S(1)]],
      ["EVT-11", "Sesi Contoh SLU Parlimen 3", "SLU PARLIMEN", "Dirancang", 11, 2, null, [S(2)]],
      ["EVT-12", "Sesi Contoh COMSTRA 5", "COMSTRA", "Dirancang", 19, 4, 9, [S(2)]],
      ["EVT-13", "Sesi Contoh SLU 5", "SLU", "Dirancang", 34, 5, 12, [S(4)]]
    ].map(([id, name, type, status, d, place, pn, assigned]) => ({ id, name, type, status, date: plus(d), place: "Lokasi Contoh " + place, project: pn ? projId(pn) : "", assigned }));

    const contractors = [["KTR-01", "Kontraktor Contoh A", "Aktif", 4], ["KTR-02", "Kontraktor Contoh B", "Aktif", 3], ["KTR-03", "Kontraktor Contoh C", "Aktif", 2], ["KTR-04", "Kontraktor Contoh D", "Tidak Aktif", 0], ["KTR-05", "Kontraktor Contoh E", "Aktif", 1]].map(([id, name, status, jobs]) => ({ id, name, status, jobs }));
    const permits = [
      ["PMT-201", "R3", "Kontraktor Contoh A", 1, 8, PM1, [S(2)]], ["PMT-202", "R5", "Kontraktor Contoh A", 2, 21, PM1, [S(2)]], ["PMT-203", "R7", "Kontraktor Contoh B", 3, -3, PM1, [S(1)]],
      ["PMT-204", "R3", "Kontraktor Contoh B", 4, 64, PM2, [S(3)]], ["PMT-205", "R3", "Kontraktor Contoh C", 5, 140, PM2, []], ["PMT-206", "R5", "Kontraktor Contoh C", 6, 92, PM3, []],
      ["PMT-207", "R7", "Kontraktor Contoh E", 7, 27, PM3, [S(2)]], ["PMT-208", "R5", "Kontraktor Contoh A", 8, 201, PM1, []], ["PMT-209", "R3", "Kontraktor Contoh B", 9, 76, PM2, []], ["PMT-210", "R5", "Kontraktor Contoh E", 10, 118, PM3, []]
    ].map(([id, category, contractor, place, d, pm, staff]) => ({ id, category, contractor, place: "Lokasi Contoh " + place, expiry: plus(d), pm, staff }));
    const workOrders = [
      ["WO-301", "PMT-201", "Pemasangan", "Dalam Proses", 4, PM1, [S(2)]], ["WO-302", "PMT-203", "Penurunan", "Belum Mula", 2, PM1, [S(1)]],
      ["WO-303", "PMT-205", "Penyelenggaraan", "Selesai", -6, PM2, []], ["WO-304", "PMT-207", "Pemasangan", "Semakan", 7, PM3, [S(2)]]
    ].map(([id, permit, work, status, d, pm, staff]) => ({ id, permit, contractor: permits.find((p) => p.id === permit).contractor, work, status, due: plus(d), pm, staff }));
    const displays = permits.map((p, i) => ({ id: "ADS-" + (401 + i), permit: p.id, category: p.category, contractor: p.contractor, place: p.place, status: diffDays(p.expiry, TODAY) < 0 ? "Tidak Aktif" : "Aktif", pm: p.pm, staff: p.staff }));
    const installations = [["INS-801", "WO-301", -2, "Dalam Proses"], ["INS-802", "WO-303", -6, "Selesai"], ["INS-803", "WO-304", -1, "Semakan"]].map(([id, wo, d, status]) => ({ id, wo, date: plus(d), status }));
    const evidence = [["EVD-851", "WO-301", "Foto Contoh Pemasangan 1.jpg", -2, S(2)], ["EVD-852", "WO-303", "Foto Contoh Penyelenggaraan.jpg", -6, PM2], ["EVD-853", "WO-304", "Foto Contoh Pemasangan 2.jpg", -1, S(2)]].map(([id, wo, file, d, by]) => ({ id, wo, file, date: plus(d), by }));

    const documents = [
      ["DOC-701", "Laporan Kemajuan Contoh.pdf", "Progress Reports", 1, PM1, 3, -1, "1.4 MB"], ["DOC-702", "Minit Mesyuarat Contoh.docx", "Meeting Minutes", 1, PM1, 1, -2, "86 KB"],
      ["DOC-703", "Kontrak Contoh A.pdf", "Contracts / Agreements", 3, PM2, 2, -7, "2.1 MB"], ["DOC-704", "Salinan Permit Contoh R3.pdf", "Other Documents", null, M1, 1, -9, "540 KB"],
      ["DOC-706", "Laporan Event Contoh.pdf", "Progress Reports", 7, PM3, 1, -13, "1.9 MB"], ["DOC-707", "Salinan Permit Contoh R5.pdf", "Other Documents", null, M1, 2, -16, "612 KB"],
      ["DOC-708", "Kertas Cadangan Contoh.docx", "Proposals / Working Papers", 12, PM3, 5, -21, "204 KB"], ["DOC-709", "Surat Lantikan Contoh.pdf", "Appointment / Instruction Letters", 4, M1, 1, -30, "120 KB"]
    ].map(([id, name, category, pn, owner, version, d, size]) => makeDoc(id, name, category, pn ? projId(pn) : "", owner, version, d, size));

    const users = [
      [AMIR, "Super Admin", "Pengurusan", "SUPER ADMIN", "Aktif"], [M1, "Pengurus", "Pengurusan", "MANAGEMENT", "Aktif"], [M2, "Pengurus", "Pengurusan", "MANAGEMENT", "Aktif"],
      [PM1, "Project Manager", "Operasi", "PROJECT MANAGER", "Aktif"], [PM2, "Project Manager", "Operasi", "PROJECT MANAGER", "Aktif"], [PM3, "Project Manager", "Operasi", "PROJECT MANAGER", "Aktif"],
      [S(1), "Pegawai Program", "Komunikasi", "STAFF", "Aktif"], [S(2), "Penyelaras Tapak", "Operasi", "STAFF", "Aktif"], [S(3), "Pegawai Program", "Komunikasi", "STAFF", "Aktif"],
      [S(4), "Eksekutif Pentadbiran", "Pentadbiran", "STAFF", "Tidak Aktif"], [S(5), "Eksekutif Pentadbiran", "Pentadbiran", "STAFF", "Aktif"], [V1, "Pemerhati", "Pentadbiran", "VIEWER", "Aktif"]
    ].map(([name, title, dept, role, status], i) => ({ name, title, dept, role, status, email: "pengguna" + (i + 1) + "@contoh.example" }));

    const seedNotif = (id, to, title, sub, route, ref, kind, d, hm) => ({ id, to, title, sub, route, ref, kind, at: stamp(d, hm), readBy: [], email: "NOT_CONFIGURED" });
    return {
      seq: 900, projectSeq: 15, projects, tasks, events, contractors, permits, workOrders, displays, installations, evidence, documents, users,
      tasksDone: [18, 22, 19, 25, 27, 24, 29, 31, 28, 33, 30, 35],
      updates: [{ text: "Contoh: Draf laporan kemajuan telah dihantar untuk semakan.", date: plus(-1), by: S(1) }],
      settings: { company: "Sri Cheras Enterprise", permitDays: 30, budgetWarn: 90, notifTasks: true, notifPermits: true, notifEvents: true },
      notifications: [
        seedNotif("n-seed-1", [S(1)], "Tugasan baharu: Sahkan senarai ahli pasukan", "Diberikan oleh " + PM1, "tasks", "TSK-102", "task", -8),
        seedNotif("n-seed-2", [PM1], "Tugasan dihantar untuk semakan: Semak permohonan permit contoh", "Daripada " + S(1), "tasks", "TSK-105", "task", -1),
        seedNotif("n-seed-3", [AMIR], "Tugasan dihantar untuk semakan: Semak arahan operasi contoh", "Daripada " + S(5), "tasks", "TSK-116", "task", -1),
        seedNotif("n-seed-4", [M1, M2], "Permohonan projek baharu: Permohonan Projek Contoh Mike", "Dihantar oleh " + PM1, "projects", projId(13), "project", 0, "08:30"),
        seedNotif("n-seed-5", [S(2)], "Kemas kini work order WO-301", "Status: Dalam Proses", "dbkl", "WO-301", "dbkl", -2)
      ],
      audit: [
        { id: "AUD-1003", at: stamp(-2, "16:10"), actor: AMIR, role: "SUPER ADMIN", action: "Tukar role pengguna", module: "Akses", ref: S(3), result: "BERJAYA", details: "STAFF dikekalkan selepas semakan (contoh)" },
        { id: "AUD-1002", at: stamp(-1, "11:20"), actor: PM1, role: "PROJECT MANAGER", action: "Kemas kini projek", module: "Projek", ref: projId(4), result: "BERJAYA", details: "Kemajuan 74% (contoh)" },
        { id: "AUD-1001", at: stamp(-1, "08:45"), actor: PM1, role: "PROJECT MANAGER", action: "Login (DEV demo)", module: "Sesi", ref: "—", result: "BERJAYA", details: "Rekod contoh" }
      ]
    };
  }
  function makeDoc(id, name, category, project, owner, version, d, size) {
    const versions = Array.from({ length: version }, (_, i) => ({ v: version - i, date: plus(d - i * 3), by: owner }));
    return { id, name, category, project, owner, version, date: plus(d), size, versions };
  }

  /* ========== Sesi: DEV DEMO ONLY, bukan pengesahan sebenar ========== */
  let D = parseJson(store.get(KEY_OPS));
  const firstSession = !D;
  if (!D) D = seedOps();
  function resolvePersona() {
    // Mod LIVE: role sebenar dari backend menentukan persona contoh yang sepadan (untuk modul yang masih data contoh).
    if (LIVE_USER) return { SUPER_ADMIN: "amir", MANAGEMENT: "mgmt", PROJECT_MANAGER: "pm", STAFF: "staff", VIEWER: "viewer" }[LIVE_USER.role] || "viewer";
    const key = store.get(KEY_PERSONA);
    const user = (k) => D.users.find((u) => u.name === PERSONAS[k] && u.status === "Aktif");
    if (key && PERSONAS[key] && user(key)) return key;
    return "amir";
  }
  const personaKey = resolvePersona();
  const sessionUser = D.users.find((u) => u.name === PERSONAS[personaKey]);
  // Role dibaca daripada rekod pengguna, jadi perubahan role berkuat kuasa selepas sesi dimuat semula.
  const SESSION = { persona: personaKey, name: sessionUser.name, title: sessionUser.title, role: sessionUser.role };
  const POLICY = PERMISSIONS[SESSION.role];
  // Fasa pertama (D1): kewangan ditangguh. Mod LIVE menafikan semua capability dan laluan kewangan.
  const LIVE_TIADA_CAP = ["finance.", "dbkl.", "program."]; // kewangan ditangguh; Program dan DBKL kini data sebenar baca sahaja
  const can = (cap) => POLICY.caps.includes(cap) && !(LIVE_USER && LIVE_TIADA_CAP.some((p) => cap.indexOf(p) === 0));
  Object.keys(PERMISSIONS).forEach((k) => { const r = PERMISSIONS[k].routes; if ((r.includes("programs") || r.includes("dbkl")) && !r.includes("operations")) r.push("operations"); });
  const canRoute = (r) => POLICY.routes.includes(r) && !(LIVE_USER && r === "finance");
  const me = SESSION.name;
  let F = null; // data kewangan: kekal null bagi role tanpa finance.view

  const state = {
    filters: { "finance.period": "6", "analytics.period": "6", "finance.tab": "Project Costing", "access.tab": "", "projects.status": "Semua", "tasks.view": "Semua", "documents.category": "Semua", "documents.mode": "Central", "documents.project": "", "staff.dept": "Semua", "programs.type": "Semua", "dbkl.tab": "", "audit.module": "Semua", "audit.user": "Semua", "audit.from": "", "audit.to": "", "audit.q": "", "notifications.view": "Semua" },
    cal: { y: +TODAY.slice(0, 4), m: +TODAY.slice(5, 7) - 1, sel: TODAY },
    pendingOpen: null
  };
  const f = (k) => state.filters[k] || "";
  const nextId = (p) => p + "-" + (++D.seq);
  const save = () => { store.set(KEY_OPS, JSON.stringify(D)); if (F) store.set(KEY_FIN, JSON.stringify(F)); };

  /* ========== Utiliti ========== */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (sen) => (sen < 0 ? "-" : "") + "RM " + (Math.abs(sen) / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const compact = (sen) => {
    const a = Math.abs(sen) / 100, s = sen < 0 ? "-" : "";
    if (a >= 1e6) return s + "RM " + (a / 1e6).toFixed(1) + "j";
    if (a >= 1e3) return s + "RM " + (a / 1e3).toFixed(1) + "k";
    return s + "RM " + a.toFixed(0);
  };
  const axisRM = (sen) => compact(sen).replace(".0k", "k").replace(".0j", "j");
  const sum = (a, g) => a.reduce((t, x) => t + (g ? g(x) : x), 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const unique = (a) => Array.from(new Set(a.filter(Boolean)));
  const projectById = (id) => D.projects.find((p) => p.id === id);
  const projectName = (id) => (projectById(id) || {}).name || "—";

  const TONE = {
    Selesai: "good", Aktif: "good", Dibayar: "good", Diluluskan: "good", "Dalam Had": "good", COMPLETED: "good", "ON TRACK": "good", ACCEPTED: "good", APPROVED: "good", BERJAYA: "good", DILULUSKAN: "good", Dibaca: "neutral",
    "Dalam Proses": "info", DIHANTAR: "info", "DIHANTAR SEMULA": "info", Semakan: "info", ACTIVE: "info", "IN PROGRESS": "info", "PENDING REVIEW": "info", PLANNING: "info",
    "Belum Mula": "neutral", Dirancang: "neutral", Rendah: "neutral", "Tidak Aktif": "neutral", DRAFT: "neutral", TODO: "neutral", ARCHIVED: "neutral", CANCELLED: "neutral",
    Ditangguh: "warn", "Hampir Tamat": "warn", Sederhana: "warn", "Menunggu Kelulusan": "warn", "Hampir Had": "warn", "ON HOLD": "warn", "AT RISK": "warn", PENDING: "warn", "PENDING ACCEPTANCE": "warn", "PENDING APPROVAL": "warn", "REVISION REQUIRED": "warn", "Belum Dibaca": "warn",
    Tamat: "bad", Batal: "bad", Tinggi: "bad", "Melebihi Had": "bad", DELAYED: "bad", BLOCKED: "bad", REJECTED: "bad", DITOLAK: "bad", GAGAL: "bad"
  };
  const badge = (t) => '<span class="badge ' + (TONE[t] || "neutral") + '">' + esc(t) + "</span>";
  const demoTag = '<span class="demo-tag">Data contoh</span>';
  const note = (t) => '<p class="note">' + esc(t) + "</p>";

  const ICON = {
    dashboard: '<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>',
    workspace: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.500 2 8 6"/>',
    projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    tasks: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="m3 6 1.500 1.500L7 5M3 12l1.500 1.500L7 11M3 18l1.500 1.500L7 17"/>',
    programs: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    dbkl: '<rect x="3" y="4" width="18" height="11" rx="1.500"/><path d="M8 15v6M16 15v6M7 9h10"/>',
    documents: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    analytics: '<path d="M4 20V4M4 20h16"/><path d="m8 15 3.500-4 3 2.500L20 7"/>',
    finance: '<circle cx="12" cy="12" r="9"/><path d="M15 8.500c-.7-.9-1.800-1.500-3-1.500-1.900 0-3.200 1.100-3.200 2.500S10.100 12 12 12s3.300 1 3.300 2.500S13.900 17 12 17c-1.300 0-2.400-.6-3.100-1.500M12 5.500v13"/>',
    access: '<path d="M12 3 4 6v6c0 4.500 3.300 7.800 8 9 4.700-1.200 8-4.500 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    staff: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c1-3.500 3.500-5 6.500-5s5.500 1.500 6.500 5"/><path d="M16 5a3.500 3.500 0 0 1 0 6.500M18 15c1.800.7 3 2.300 3.500 5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900 7 7M17 17l2.100 2.100M19.100 4.900 17 7M7 17l-2.100 2.100"/>',
    bell: '<path d="M6 10a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  ICON.operations = ICON.dbkl || ICON.programs;
  const icon = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + "</svg>";

  function panelHead(title, sub, action, tag) {
    return '<div class="panel-head"><div><div class="panel-title"><h2>' + esc(title) + "</h2>" + (tag == null ? demoTag : tag) + "</div>" +
      (sub ? '<p class="panel-sub">' + esc(sub) + "</p>" : "") + "</div>" + (action || "") + "</div>";
  }
  function pageHead(title, desc, actions) {
    return '<div class="page-head"><div><h1>' + esc(title) + "</h1><p>" + esc(desc) + '</p></div><div class="page-actions">' + (actions || "") + "</div></div>";
  }
  const btn = (label, action, cls, extra) => '<button type="button" class="btn ' + (cls || "") + '" data-action="' + action + '"' + (extra || "") + ">" + esc(label) + "</button>";
  const capBtn = (cap, label, action, cls, extra) => (can(cap) ? btn(label, action, cls, extra) : "");
  const routeLink = (route, label) => (canRoute(route) ? '<a class="btn small" href="#' + route + '">' + esc(label) + "</a>" : "");
  const chips = (key, options) => '<div class="chips" role="group">' + options.map((o) => {
    const [val, label] = Array.isArray(o) ? o : [o, o];
    return '<button type="button" class="chip" id="chip-' + esc(key + "-" + val).replace(/[^a-zA-Z0-9-]/g, "") + '" data-action="filter" data-key="' + esc(key) + '" data-val="' + esc(val) + '" aria-pressed="' + (f(key) === String(val)) + '">' + esc(label) + "</button>";
  }).join("") + "</div>";
  const searchBox = (key, label) => '<div class="search"><label class="sr" for="q-' + key + '">' + esc(label) + '</label><input id="q-' + key + '" type="search" placeholder="' + esc(label) + '" data-input="search" data-key="' + key + '" value="' + esc(f(key)) + '"></div>';
  const filterSelect = (key, label, options) => '<label class="filter-field"><span>' + esc(label) + '</span><select id="fs-' + esc(key) + '" class="inline-select" data-change="filter" data-key="' + esc(key) + '">' + options.map(([v, l]) => '<option value="' + esc(v) + '"' + (f(key) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>").join("") + "</select></label>";
  const filterDate = (key, label) => '<label class="filter-field"><span>' + esc(label) + '</span><input id="fd-' + esc(key) + '" class="inline-select" type="date" data-change="filter" data-key="' + esc(key) + '" value="' + esc(f(key)) + '"></label>';
  const empty = (msg, action) => '<div class="empty"><p>' + esc(msg) + "</p>" + (action || "") + "</div>";
  const progress = (v, tone) => '<div class="mini-progress"><div class="progress ' + (tone || "") + '"><i style="width:' + Math.min(100, v) + '%"></i></div><span>' + v + "%</span></div>";
  const detailList = (rows) => '<dl class="detail-list">' + rows.map(([k, v]) => "<div><dt>" + esc(k) + "</dt><dd>" + v + "</dd></div>").join("") + "</dl>";
  const timeline = (items, emptyMsg) => (items.length ? '<ul class="timeline">' + items.map((i) => "<li><strong>" + esc(i.text) + "</strong><span>" + esc(i.meta) + "</span></li>").join("") + "</ul>" : '<p class="muted small">' + esc(emptyMsg || "Tiada rekod.") + "</p>");

  function table(cols, rows, emptyHtml) {
    if (!rows.length) return emptyHtml || empty("Tiada rekod sepadan dengan penapis ini.");
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      cols.map((c) => '<th scope="col" class="' + (c.num ? "num" : "") + '">' + esc(c.h) + "</th>").join("") + "</tr></thead><tbody>" +
      rows.map((r) => '<tr class="' + (r._total ? "total" : "") + '">' + cols.map((c) => '<td class="' + (c.num ? "num" : "") + '" data-label="' + esc(c.h) + '">' + c.r(r) + "</td>").join("") + "</tr>").join("") +
      "</tbody></table></div>";
  }
  function dueText(due, done) {
    if (done) return '<span class="muted tnum">' + fmtDate(due) + "</span>";
    const d = diffDays(due, TODAY);
    if (d < 0) return '<span class="txt-bad">▲ Lewat ' + -d + " hari</span>";
    if (d === 0) return '<span class="txt-warn">Hari ini</span>';
    if (d === 1) return '<span class="txt-warn">Esok</span>';
    return '<span class="muted tnum">' + fmtDate(due) + "</span>";
  }

  /* ========== Audit (append-only) dan notifikasi ========== */
  // Tiada fungsi untuk mengubah atau memadam rekod audit dalam aplikasi ini.
  function audit(action, module, ref, result, details, financial) {
    const rec = Object.freeze({ id: "AUD-" + (++D.seq), at: nowIso(), actor: me, role: SESSION.role, action, module, ref: ref || "—", result: result || "BERJAYA", details: details || "" });
    (financial && F ? F.audit : D.audit).unshift(rec);
    save();
  }
  function notify(to, title, sub, route, ref, kind, financial) {
    const list = unique(to).filter((n) => n !== me);
    if (!list.length) return;
    (financial && F ? F.notifications : D.notifications).unshift({ id: nextId("n"), to: list, title, sub, route, ref: ref || "", kind, at: nowIso(), readBy: [], email: "NOT_CONFIGURED" });
    save();
  }
  const managementUsers = () => D.users.filter((u) => u.role === "MANAGEMENT" && u.status === "Aktif").map((u) => u.name);
  function deadlineNotifications() {
    const open = ["TODO", "IN PROGRESS", "REVISION REQUIRED", "BLOCKED"];
    const add = (id, to, title, sub, route, ref, kind) => {
      if (D.notifications.some((n) => n.id === id)) return;
      D.notifications.unshift({ id, to: unique(to), title, sub, route, ref, kind, at: nowIso(), readBy: [], email: "NOT_CONFIGURED" });
    };
    D.tasks.filter((t) => open.includes(t.status)).forEach((t) => {
      const d = diffDays(t.due, TODAY), to = activeAssignees(t);
      if (d < 0) add("dl-" + t.id + "-over-" + t.due, to.concat(t.assignedBy), "Tugasan lewat: " + t.title, "Tarikh akhir " + fmtDate(t.due), "tasks", t.id, "task");
      else if (d === 0) add("dl-" + t.id + "-today-" + t.due, to, "Tarikh akhir hari ini: " + t.title, "Tarikh akhir " + fmtDate(t.due), "tasks", t.id, "task");
      else if (d === 3) add("dl-" + t.id + "-3d-" + t.due, to, "Peringatan 3 hari: " + t.title, "Tarikh akhir " + fmtDate(t.due), "tasks", t.id, "task");
      else if (d > 3 && d <= 7) add("dl-" + t.id + "-soon-" + t.due, to, "Tarikh akhir hampir: " + t.title, "Tarikh akhir " + fmtDate(t.due), "tasks", t.id, "task");
    });
    D.permits.forEach((p) => {
      const st = permitStatus(p);
      if (st !== "Aktif") add("pm-" + p.id + "-" + st, [p.pm].concat(p.staff, managementUsers()), "Permit " + p.id + " " + st.toLowerCase(), p.category + " · tamat " + fmtDate(p.expiry), "dbkl", p.id, "permit");
    });
    D.events.filter((e) => e.status === "Dirancang" && diffDays(e.date, TODAY) >= 0 && diffDays(e.date, TODAY) <= 3).forEach((e) => {
      const p = projectById(e.project);
      add("ev-" + e.id + "-" + e.date, e.assigned.concat(p ? [p.pm] : []), e.name, e.type + " · " + fmtDate(e.date), "programs", e.id, "event");
    });
  }

  /* ========== Peraturan domain ========== */
  const TASK_STATUS = ["TODO", "IN PROGRESS", "PENDING REVIEW", "REVISION REQUIRED", "COMPLETED", "BLOCKED", "CANCELLED"];
  // Permohonan projek: PENDING APPROVAL -> (MANAGEMENT) PLANNING atau REJECTED -> pembetulan -> PENDING APPROVAL.
  const PROJECT_STATUS = ["PENDING APPROVAL", "REJECTED", "PLANNING", "ACTIVE", "ON HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"];
  const SCHEDULE = ["ON TRACK", "AT RISK", "DELAYED"];
  const PROGRAM_TYPES = ["COMSTRA", "SLU", "SLU PARLIMEN"];
  const DOC_BASE = ["Appointment / Instruction Letters", "Proposals / Working Papers", "Contracts / Agreements", "Meeting Minutes", "Progress Reports"];
  const FINANCIAL_DOC = "Financial Documents";
  const docCategories = () => DOC_BASE.concat(can("finance.view") ? [FINANCIAL_DOC] : [], ["Other Documents"]);
  const assignees = (t) => [t.primary].concat(t.additional);
  const activeAssignees = (t) => assignees(t).filter((n) => !t.assign[n] || t.assign[n].state !== "REJECTED");
  const myAssign = (t) => (t.assign[me] || {}).state;
  const isTaskClosed = (t) => ["COMPLETED", "CANCELLED"].includes(t.status);
  const isOverdue = (t) => !isTaskClosed(t) && t.due < TODAY;
  const isMine = (t) => assignees(t).includes(me);
  const ownsProject = (id) => { const p = projectById(id); return !!p && p.pm === me; };
  const canManageTask = (t) => POLICY.scope === "company" || (can("task.assign") && (ownsProject(t.project) || t.assignedBy === me));
  function canApproveTask(t) {
    if (t.status !== "PENDING REVIEW") return false;
    if (POLICY.taskApprove === "all") return true;
    if (POLICY.taskApprove === "own-projects") return ownsProject(t.project) && !isMine(t);
    if (POLICY.taskApprove === "if-reviewer") return t.reviewer === me || t.assignedBy === me;
    return false;
  }
  function taskMoves(t) {
    const moves = [];
    if (isMine(t) && myAssign(t) === "ACCEPTED") {
      if (t.status === "TODO") moves.push("IN PROGRESS");
      if (t.status === "IN PROGRESS") moves.push("TODO", "BLOCKED");
      if (t.status === "BLOCKED" || t.status === "REVISION REQUIRED") moves.push("IN PROGRESS");
    }
    if (canManageTask(t) && !isTaskClosed(t)) moves.push("CANCELLED");
    return moves;
  }
  const canWorkOnTask = (t) => isMine(t) && myAssign(t) === "ACCEPTED" && ["TODO", "IN PROGRESS", "REVISION REQUIRED", "BLOCKED"].includes(t.status);
  const canSubmitTask = (t) => t.primary === me && myAssign(t) === "ACCEPTED" && ["IN PROGRESS", "REVISION REQUIRED"].includes(t.status);
  // Hanya MANAGEMENT meluluskan; pemohon tidak boleh meluluskan permohonannya sendiri.
  const canDecideProject = (p) => can("project.approve") && p.approval === "PENDING" && p.requestedBy !== me;
  const canResubmitProject = (p) => can("project.request") && p.approval === "REJECTED" && p.requestedBy === me;
  const canEditProject = (p) => can("project.edit") && p.approval === "APPROVED" && p.status !== "ARCHIVED" && (POLICY.scope === "company" || p.pm === me);
  const canManageEvent = (e) => can("program.manage") && (POLICY.scope === "company" || ownsProject(e.project));
  const canUpdateWo = (w) => can("dbkl.work") && (POLICY.scope === "company" || w.pm === me || w.staff.includes(me));
  const permitStatus = (p) => { const d = diffDays(p.expiry, TODAY); return d < 0 ? "Tamat" : d <= D.settings.permitDays ? "Hampir Tamat" : "Aktif"; };
  const eventStatsFor = (list) => { const base = list.filter((e) => e.date <= TODAY && e.status !== "Batal" && e.status !== "Ditangguh"), done = base.filter((e) => e.status === "Selesai"); return { base: base.length, done: done.length, pct: pct(done.length, base.length) }; };
  const activeSuperAdmins = () => D.users.filter((u) => u.role === "SUPER ADMIN" && u.status === "Aktif");

  /* ========== DAL: semua paparan membaca data melalui sini. Gantikan kandungan dengan panggilan API backend. ========== */
  const inMyProjects = (id) => { const p = projectById(id); return !!p && (p.pm === me || p.team.includes(me)); };
  const myPermit = (p) => POLICY.scope === "company" || p.pm === me || p.staff.includes(me);
  const DAL = {
    projects() { return POLICY.scope === "company" ? D.projects : POLICY.scope === "assigned" ? D.projects.filter((p) => p.pm === me || p.team.includes(me)) : []; },
    tasks() {
      if (POLICY.scope === "company") return D.tasks.concat(F ? F.tasks : []);
      if (POLICY.scope === "assigned") return D.tasks.filter((t) => inMyProjects(t.project) || isMine(t) || t.assignedBy === me);
      if (POLICY.scope === "self") return D.tasks.filter(isMine);
      return [];
    },
    myOpenTasks() { return DAL.tasks().filter((t) => isMine(t) && !isTaskClosed(t) && myAssign(t) !== "REJECTED").sort((a, b) => a.due.localeCompare(b.due)); },
    events() {
      if (POLICY.scope === "company") return D.events;
      if (POLICY.scope === "assigned") return D.events.filter((e) => inMyProjects(e.project) || e.assigned.includes(me));
      if (POLICY.scope === "self") return D.events.filter((e) => e.assigned.includes(me));
      return [];
    },
    permits() { return POLICY.scope === "summary" ? [] : D.permits.filter(myPermit); },
    workOrders() { return POLICY.scope === "summary" ? [] : D.workOrders.filter(myPermit); },
    displays() { return POLICY.scope === "summary" ? [] : D.displays.filter(myPermit); },
    installations() { const ids = DAL.workOrders().map((w) => w.id); return D.installations.filter((i) => ids.includes(i.wo)); },
    evidence() { const ids = DAL.workOrders().map((w) => w.id); return D.evidence.filter((i) => ids.includes(i.wo)); },
    contractors() { if (!can("dbkl.contractors")) return []; if (POLICY.scope === "company") return D.contractors; const names = DAL.permits().map((p) => p.contractor); return D.contractors.filter((c) => names.includes(c.name)); },
    documents() {
      if (!can("doc.view")) return [];
      if (POLICY.scope === "company") return D.documents.concat(F ? F.documents : []);
      return D.documents.filter((d) => d.category !== FINANCIAL_DOC && (inMyProjects(d.project) || d.owner === me));
    },
    users() { return canRoute("staff") ? D.users : []; },
    notifications() {
      if (!can("notifications.receive")) return [];
      const s = D.settings, off = { task: !s.notifTasks, permit: !s.notifPermits, event: !s.notifEvents };
      return D.notifications.concat(F ? F.notifications : []).filter((n) => n.to.includes(me) && !off[n.kind]).sort((a, b) => b.at.localeCompare(a.at));
    },
    audit() {
      if (POLICY.audit === "none") return [];
      const all = D.audit.concat(F ? F.audit : []).slice().sort((a, b) => b.at.localeCompare(a.at));
      return POLICY.audit === "full" ? all : all.filter((a) => a.module !== "Akses" && a.module !== "Sesi");
    },
    // Agregat sahaja: satu-satunya sumber data dashboard VIEWER.
    summary() {
      const count = (list, key, keys) => keys.map((k) => ({ label: k, value: list.filter((x) => x[key] === k).length }));
      const projects = D.projects.filter((p) => p.status !== "ARCHIVED"), ev = eventStatsFor(D.events);
      return {
        projects: { total: projects.length, byStatus: count(projects, "status", PROJECT_STATUS.filter((s) => s !== "ARCHIVED")) },
        tasks: { total: D.tasks.length, overdue: D.tasks.filter(isOverdue).length, byStatus: count(D.tasks, "status", TASK_STATUS) },
        programs: { total: D.events.length, upcoming: D.events.filter((e) => e.date >= TODAY && e.status === "Dirancang").length, ev, byType: count(D.events, "type", PROGRAM_TYPES) },
        dbkl: { total: D.permits.length, byCategory: ["R3", "R5", "R7"].map((c) => ({ label: "Kategori " + c, value: D.permits.filter((p) => p.category === c).length })), soon: D.permits.filter((p) => permitStatus(p) === "Hampir Tamat").length, expired: D.permits.filter((p) => permitStatus(p) === "Tamat").length, openWo: D.workOrders.filter((w) => w.status !== "Selesai").length }
      };
    },
    finance() { return can("finance.view") ? F : null; }
  };

  /* ========== Pengiraan kewangan (hanya dipanggil oleh paparan role kewangan) ========== */
  const projFin = (p) => F.budgets[p.id] || { budget: 0, cost: 0 };
  const financeProjects = () => D.projects.filter((p) => p.status !== "ARCHIVED" && F.budgets[p.id]);
  const budget = () => { const list = financeProjects(), b = sum(list, (p) => projFin(p).budget), c = sum(list, (p) => projFin(p).cost); return { budget: b, cost: c, left: b - c, used: pct(c, b) }; };
  function finWindow(n) {
    const labels = lastMonths(n), off = 12 - n, m = F.months;
    return labels.map((label, i) => {
      const k = i + off, rev = m.rev[k], projek = m.projek[k], kontraktor = m.kontraktor[k], operasi = m.operasi[k], exp = projek + kontraktor + operasi;
      return { label, rev, projek, kontraktor, operasi, exp, profit: rev - exp };
    });
  }
  const budgetState = (p) => { const x = projFin(p), u = pct(x.cost, x.budget); return u > 100 ? "Melebihi Had" : u >= D.settings.budgetWarn ? "Hampir Had" : "Dalam Had"; };

  /* ========== Carta (HTML, tanpa pustaka luar) ========== */
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 4, 6, 8, 10]) if (v <= m * p) return m * p;
    return 10 * p;
  }
  function columnChart(opts) {
    const { labels, series, fmtAxis, fmtTip, ariaLabel } = opts;
    const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    const many = labels.length > 8;
    return (series.length > 1 ? '<div class="legend">' + series.map((s, i) => '<span><i class="s' + i + '"></i>' + esc(s.name) + "</span>").join("") + "</div>" : "") +
      '<div class="colchart" role="img" aria-label="' + esc(ariaLabel) + '"><div class="plot">' +
      ticks.map((t) => '<div class="gl' + (t === 0 ? " base" : "") + '" style="bottom:' + t * 100 + '%"><span>' + esc(fmtAxis(max * t)) + "</span></div>").join("") +
      '<div class="cols">' + labels.map((l, i) => {
        const tip = l + "\n" + series.map((s) => s.name + ": " + fmtTip(s.values[i])).join("\n");
        return '<div class="col" data-tip="' + esc(tip) + '">' + series.map((s, si) => '<span class="bar s' + si + '" style="height:' + (s.values[i] / max) * 100 + '%"></span>').join("") + "</div>";
      }).join("") + "</div></div>" +
      '<div class="col-labels' + (many ? " many" : "") + '">' + labels.map((l) => "<span>" + esc(l) + "</span>").join("") + "</div></div>" +
      '<details class="chart-table"><summary>Lihat data sebagai jadual</summary>' +
      table([{ h: "Bulan", r: (r) => esc(r.label) }].concat(series.map((s, i) => ({ h: s.name, num: true, r: (r) => esc(fmtTip(r.v[i])) }))),
        labels.map((label, i) => ({ label, v: series.map((s) => s.values[i]) }))) + "</details>";
  }
  function barList(items, ariaLabel) {
    const max = Math.max(1, ...items.map((i) => i.value));
    return '<div class="barlist" role="list" aria-label="' + esc(ariaLabel) + '">' + items.map((i) => {
      const inner = "<span>" + esc(i.label) + '</span><span class="track"><span class="fill ' + (i.tone || "") + '" style="width:' + (i.value / max) * 100 + '%"></span></span><span class="val">' + esc(i.display != null ? i.display : i.value) + "</span>";
      return i.go && canRoute(i.go[0])
        ? '<button type="button" role="listitem" class="barrow" data-action="go" data-route="' + i.go[0] + '" data-key="' + esc(i.go[1]) + '" data-val="' + esc(i.go[2]) + '" data-tip="' + esc(i.label + ": " + (i.display != null ? i.display : i.value) + "\nKlik untuk tapis") + '">' + inner + "</button>"
        : '<div role="listitem" class="barrow">' + inner + "</div>";
    }).join("") + "</div>";
  }

  /* ========== Kalendar & baris senarai ========== */
  function calendar(large) {
    const { y, m, sel } = state.cal;
    const first = new Date(Date.UTC(y, m, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const typeFilter = f("programs.type");
    const events = DAL.events().filter((e) => !large || typeFilter === "Semua" || e.type === typeFilter);
    let cells = "";
    for (let i = 0; i < lead; i++) cells += '<span class="cal-day blank" aria-hidden="true"></span>';
    for (let d = 1; d <= count; d++) {
      const key = iso(new Date(Date.UTC(y, m, d)));
      const evs = events.filter((e) => e.date === key);
      cells += '<button type="button" id="cal-' + key + '" class="cal-day' + (key === TODAY ? " today" : "") + '" data-action="cal-day" data-date="' + key + '" aria-pressed="' + (key === sel) + '" aria-label="' + fmtDate(key) + ", " + evs.length + ' event"><span class="d">' + d + "</span>" +
        '<span class="dots">' + evs.slice(0, 3).map(() => "<i></i>").join("") + "</span>" +
        (large ? evs.slice(0, 2).map((e) => '<span class="ev-chip' + (e.status === "Batal" || e.status === "Ditangguh" ? " off" : "") + '">' + esc(e.type) + "</span>").join("") : "") + "</button>";
    }
    const dow = ["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"].map((d) => '<span class="cal-dow">' + d + "</span>").join("");
    return '<div class="cal' + (large ? " cal-large" : "") + '"><div class="cal-grid">' + dow + cells + "</div></div>";
  }
  const calNav = () => '<div class="cal-head"><button type="button" id="cal-prev" class="icon-btn" data-action="cal-prev" aria-label="Bulan sebelum">' + icon("left") + '</button><span class="cal-title">' + MONTHS_FULL[state.cal.m] + " " + state.cal.y + '</span><button type="button" id="cal-next" class="icon-btn" data-action="cal-next" aria-label="Bulan seterusnya">' + icon("right") + "</button></div>";
  function eventRows(list, emptyMsg) {
    if (!list.length) return '<p class="muted small">' + esc(emptyMsg) + "</p>";
    return '<ul class="rows">' + list.map((e) => '<li class="event-row"><span class="event-date">' + fmtDate(e.date) + '</span><div><strong class="small">' + esc(e.name) + '</strong><div class="task-meta">' + esc(e.type) + " · " + esc(e.place) + "</div></div>" + badge(e.status) + "</li>").join("") + "</ul>";
  }
  const upcoming = (n) => DAL.events().filter((e) => e.date >= TODAY && e.status === "Dirancang").sort((a, b) => a.date.localeCompare(b.date)).slice(0, n);
  function taskRowActions(t) {
    if (isMine(t) && myAssign(t) === "PENDING ACCEPTANCE") return btn("Terima", "accept-task", "small primary", ' data-id="' + t.id + '"') + btn("Tolak", "reject-task", "small", ' data-id="' + t.id + '"');
    if (canSubmitTask(t)) return btn("Hantar Semakan", "submit-review", "small", ' data-id="' + t.id + '"');
    return "";
  }
  const taskRow = (t) => {
    const acts = taskRowActions(t);
    return '<li class="task task-plain"><div><button type="button" class="text-link task-title" data-action="open-task" data-id="' + t.id + '">' + esc(t.title) + '</button><div class="task-meta">' + t.id + (t.project ? " · " + esc(projectName(t.project)) : "") + " · " + esc(t.status) + "</div>" + (acts ? '<div class="row-actions">' + acts + "</div>" : "") + '</div><div class="task-side">' + dueText(t.due, isTaskClosed(t)) + badge(t.priority) + "</div></li>";
  };
  const permitRow = (p) => '<li class="event-row"><span class="event-date">' + fmtDate(p.expiry) + '</span><div><strong class="small">' + p.id + " · " + p.category + '</strong><div class="task-meta">' + esc(p.contractor) + "</div></div>" + badge(permitStatus(p)) + "</li>";
  const projectBtn = (p) => '<button type="button" id="open-' + p.id + '" class="text-link" data-action="open-project" data-id="' + p.id + '">' + esc(p.name) + "</button>";
  const projectTone = (p) => (p.schedule === "DELAYED" ? "bad" : p.schedule === "AT RISK" ? "warn" : "");

  /* ========== Dashboard: komponen dikongsi ========== */
  const kpi = (label, value, ctx, route) => {
    const inner = '<div class="kpi-top"><span class="kpi-label">' + esc(label) + "</span>" + demoTag + '</div><div class="kpi-value">' + esc(value) + '</div><div class="kpi-ctx">' + ctx + "</div>";
    return route && canRoute(route) ? '<a class="kpi" href="#' + route + '">' + inner + "</a>" : '<div class="kpi kpi-static">' + inner + "</div>";
  };
  const kpiRow = (cards, four) => '<div class="kpi-head"><h2>Petunjuk Utama</h2><span class="muted small">Semua angka ialah data contoh, bukan angka sebenar syarikat.</span></div><section class="kpis' + (four ? " kpis-4" : "") + '" aria-label="KPI">' + cards.join("") + "</section>";
  function banner(lead, roleLabel) {
    const hour = +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date());
    const greet = hour < 12 ? "Selamat pagi" : hour < 14 ? "Selamat tengah hari" : hour < 19 ? "Selamat petang" : "Selamat malam";
    const dayName = DAYS[new Date(TODAY + "T00:00:00Z").getUTCDay()];
    const quick = [["project.request", POLICY.scope === "company" ? "+ Projek Baharu" : "+ Mohon Projek", "new-project", "primary"], ["task.assign", "+ Tugasan Baharu", "new-task"], ["program.manage", "+ Event Baharu", "new-event"], ["doc.upload", "Muat Naik Dokumen", "new-doc"], ["dbkl.manage", "Daftar Permit DBKL", "new-permit"], ["instruction.send", "Arahan Pengurusan", "new-instruction"]].filter((q) => can(q[0]));
    return '<section class="banner" aria-labelledby="welcome"><p class="banner-eyebrow">' + dayName + ", " + fmtDate(TODAY) + " · " + esc(D.settings.company) + " · " + esc(roleLabel) + '</p><h1 id="welcome">' + greet + ", " + esc(me) + '</h1><p class="lead">' + lead + "</p>" +
      (quick.length ? '<div class="quick"><h2>Quick Actions</h2><div class="quick-row">' + quick.map((q) => btn(q[1], q[2], q[3])).join("") + "</div></div>" : "") + "</section>";
  }
  function panelProjectOverview() {
    const list = DAL.projects().filter((p) => p.status !== "ARCHIVED"), risky = list.filter((p) => ["AT RISK", "DELAYED"].includes(p.schedule) && p.status === "ACTIVE");
    const counts = PROJECT_STATUS.filter((s) => s !== "ARCHIVED").map((s) => ({ label: s, value: list.filter((p) => p.status === s).length, go: ["projects", "projects.status", s] }));
    return '<section class="panel c7">' + panelHead("Project Overview", list.length + " projek mengikut status", routeLink("projects", "Lihat semua")) + '<div class="split"><div><p class="sub-head">Status projek</p>' + barList(counts, "Bilangan projek mengikut status") + '</div><div><p class="sub-head">Perlu perhatian</p>' +
      (risky.length ? '<ul class="rows">' + risky.map((p) => '<li class="risk-row"><div class="top">' + projectBtn(p) + dueText(p.target) + '</div><div class="progress ' + projectTone(p) + '"><i style="width:' + p.progress + '%"></i></div><div class="task-meta">' + p.progress + "% siap · " + esc(p.pm) + " · " + esc(p.schedule) + "</div></li>").join("") + "</ul>" : '<p class="muted small">Tiada projek berisiko.</p>') + "</div></div></section>";
  }
  function panelTaskOverview() {
    const list = DAL.tasks(), late = list.filter(isOverdue), review = list.filter((t) => t.status === "PENDING REVIEW");
    return '<section class="panel c5">' + panelHead("Task Overview", list.length + " tugasan seluruh syarikat", routeLink("tasks", "Lihat semua")) + barList(TASK_STATUS.map((s) => ({ label: s, value: list.filter((t) => t.status === s).length, tone: s === "BLOCKED" ? "bad" : "" })), "Tugasan mengikut status") +
      '<p class="small muted" style="margin-top:12px"><span class="txt-bad">▲ ' + late.length + " lewat</span> · " + review.length + " menunggu semakan</p></section>";
  }
  function panelMyTasks(cls, limit) {
    const open = DAL.myOpenTasks(), n = limit || 5;
    return '<section class="panel ' + cls + '">' + panelHead("My Tasks", open.length + " tugasan terbuka", capBtn("task.assign", "+ Tambah", "new-task", "small")) + (open.length ? '<ul class="rows">' + open.slice(0, n).map(taskRow).join("") + "</ul>" : empty("Tiada tugasan terbuka.")) + (open.length > n ? '<p class="small" style="margin-top:12px"><a href="#workspace">Lihat ' + (open.length - n) + " lagi</a></p>" : "") + "</section>";
  }
  function panelCalendar(cls, title, sub) {
    const sel = DAL.events().filter((e) => e.date === state.cal.sel);
    return '<section class="panel ' + cls + '">' + panelHead(title, sub, calNav()) + '<div class="split"><div>' + calendar(false) + '</div><div><p class="sub-head">' + (sel.length ? "Event pada " + fmtDate(state.cal.sel) : "Akan datang") + "</p>" + eventRows(sel.length ? sel : upcoming(4), "Tiada event akan datang.") + "</div></div></section>";
  }
  function panelDbkl(cls, title) {
    const list = DAL.permits(), attention = list.filter((p) => permitStatus(p) !== "Aktif").sort((a, b) => a.expiry.localeCompare(b.expiry)).slice(0, 3);
    return '<section class="panel ' + cls + '">' + panelHead(title, list.length + " permit paparan iklan", routeLink("dbkl", "Buka modul")) + '<p class="sub-head">Permit mengikut kategori</p>' + barList(["R3", "R5", "R7"].map((c) => ({ label: "Kategori " + c, value: list.filter((p) => p.category === c).length })), "Permit mengikut kategori") + '<p class="sub-head" style="margin-top:16px">Tindakan segera</p>' + (attention.length ? '<ul class="rows">' + attention.map(permitRow).join("") + "</ul>" : '<p class="muted small">Tiada permit perlu tindakan.</p>') + "</section>";
  }
  function panelStaff(cls) {
    const users = DAL.users(), active = users.filter((u) => u.status === "Aktif"), depts = unique(users.map((u) => u.dept));
    return '<section class="panel ' + cls + '">' + panelHead("Staff", active.length + " pengguna aktif daripada " + users.length, routeLink("staff", "Direktori")) + barList(depts.map((d) => ({ label: d, value: active.filter((u) => u.dept === d).length })), "Staf aktif mengikut jabatan") + "</section>";
  }
  function financialOverview() {
    if (!DAL.finance()) return "";
    const fin = finWindow(6), revT = sum(fin, (r) => r.rev), expT = sum(fin, (r) => r.exp);
    return '<div class="grid"><section class="panel c12">' + panelHead("Financial Overview", "6 bulan terakhir", routeLink("finance", "Buka Financial Analytics")) +
      '<dl class="stats"><div class="stat"><dt>Pendapatan</dt><dd>' + money(revT) + '</dd></div><div class="stat"><dt>Perbelanjaan</dt><dd>' + money(expT) + '</dd></div><div class="stat"><dt>Untung bersih</dt><dd>' + money(revT - expT) + "</dd></div></dl>" +
      '<div style="margin-top:20px">' + columnChart({ labels: fin.map((r) => r.label), series: [{ name: "Pendapatan", values: fin.map((r) => r.rev) }, { name: "Perbelanjaan", values: fin.map((r) => r.exp) }], fmtAxis: axisRM, fmtTip: money, ariaLabel: "Pendapatan dan perbelanjaan bulanan, data contoh" }) + "</div></section></div>";
  }
  function companyKpis() {
    const list = DAL.projects(), active = list.filter((p) => p.status === "ACTIVE"), risky = active.filter((p) => p.schedule !== "ON TRACK"), tasks = DAL.tasks(), late = tasks.filter(isOverdue), ev = eventStatsFor(DAL.events());
    const permits = DAL.permits(), soon = permits.filter((p) => permitStatus(p) === "Hampir Tamat"), expired = permits.filter((p) => permitStatus(p) === "Tamat");
    const cards = [
      kpi("Projek Aktif", active.length, risky.length ? '<span class="txt-bad">▲ ' + risky.length + " berisiko</span>" : "Tiada projek berisiko", "projects"),
      kpi("Tugasan Lewat", late.length, "daripada " + tasks.filter((t) => !isTaskClosed(t)).length + " tugasan terbuka", "tasks"),
      kpi("Event Selesai", ev.pct + "%", ev.done + " daripada " + ev.base + " event layak", "programs"),
      kpi("Permit Hampir Tamat", soon.length, expired.length ? '<span class="txt-bad">▲ ' + expired.length + " sudah tamat</span>" : "Tiada permit tamat", "dbkl")
    ];
    if (DAL.finance()) { const bud = budget(); cards.push(kpi("Baki Belanjawan", compact(bud.left), bud.used + "% daripada " + compact(bud.budget) + " digunakan", "finance")); }
    return kpiRow(cards, cards.length === 4);
  }

  /* ========== Lima dashboard ========== */
  const companyLead = () => { const t = DAL.tasks(); return "Syarikat kini ada <b>" + DAL.projects().filter((p) => p.status === "ACTIVE").length + " projek aktif</b>, <b>" + t.filter(isOverdue).length + " tugasan lewat</b> dan <b>" + t.filter((x) => x.status === "PENDING REVIEW").length + " tugasan</b> menunggu semakan."; };
  function dashExecutive() {
    const admins = activeSuperAdmins(), inactive = D.users.filter((u) => u.status !== "Aktif").length, logs = DAL.audit().slice(0, 4);
    return banner(companyLead(), "Executive Overview") + companyKpis() +
      '<div class="grid">' + panelProjectOverview() + panelTaskOverview() + "</div>" +
      '<div class="grid">' + panelCalendar("c7", "Program & Event Calendar", "COMSTRA, SLU dan SLU Parlimen") + panelDbkl("c5", "DBKL Advertising") + "</div>" +
      financialOverview() +
      '<div class="grid">' + panelStaff("c6") + '<section class="panel c6">' + panelHead("Akses & Audit", admins.length + " Super Admin aktif · " + inactive + " akaun tidak aktif", routeLink("access", "Urus akses")) + timeline(logs.map((a) => ({ text: a.action + " · " + a.ref, meta: fmtDateTime(a.at) + " · " + a.actor }))) + "</section></div>";
  }
  function panelApprovals() {
    const req = D.projects.filter((p) => p.approval === "PENDING"), pay = F ? F.payments.filter((p) => p.status === "Menunggu Kelulusan") : [];
    return '<section class="panel c6">' + panelHead("Menunggu Kelulusan", req.length + " permohonan projek · " + pay.length + " bayaran", routeLink("projects", "Lihat projek")) +
      (req.length ? '<ul class="rows">' + req.map((p) => '<li class="risk-row"><div class="top">' + projectBtn(p) + badge(p.status) + '</div><div class="task-meta">Dimohon oleh ' + esc(p.requestedBy) + "</div></li>").join("") + "</ul>" : '<p class="muted small">Tiada permohonan projek menunggu.</p>') + "</section>";
  }
  function dashManagement() {
    return banner(companyLead(), "Management Overview") + companyKpis() +
      '<div class="grid">' + panelProjectOverview() + panelTaskOverview() + "</div>" +
      '<div class="grid">' + panelCalendar("c7", "Program & Event Calendar", "COMSTRA, SLU dan SLU Parlimen") + panelDbkl("c5", "DBKL Advertising") + "</div>" +
      financialOverview() + '<div class="grid">' + panelApprovals() + panelStaff("c6") + "</div>";
  }
  function panelDeadlines(cls) {
    const items = [];
    DAL.tasks().filter((t) => !isTaskClosed(t) && diffDays(t.due, TODAY) <= 7).forEach((t) => items.push({ date: t.due, html: '<button type="button" class="text-link small" data-action="open-task" data-id="' + t.id + '">' + esc(t.title) + "</button>", type: "Tugasan" }));
    DAL.projects().filter((p) => ["PLANNING", "ACTIVE", "ON HOLD"].includes(p.status) && diffDays(p.target, TODAY) <= 14).forEach((p) => items.push({ date: p.target, html: '<button type="button" class="text-link small" data-action="open-project" data-id="' + p.id + '">' + esc(p.name) + "</button>", type: "Sasaran projek" }));
    DAL.permits().filter((p) => permitStatus(p) !== "Aktif").forEach((p) => items.push({ date: p.expiry, html: '<strong class="small">Permit ' + p.id + "</strong>", type: "Permit " + permitStatus(p).toLowerCase() }));
    items.sort((a, b) => a.date.localeCompare(b.date));
    return '<section class="panel ' + cls + '">' + panelHead("Deadlines & Alerts", items.length + " perkara perlu perhatian") + (items.length ? '<ul class="rows">' + items.slice(0, 8).map((i) => '<li class="event-row"><span class="event-date">' + fmtDate(i.date) + "</span><div>" + i.html + '<div class="task-meta">' + esc(i.type) + "</div></div>" + (i.date < TODAY ? '<span class="txt-bad small">▲ Lewat</span>' : "<span></span>") + "</li>").join("") + "</ul>" : '<p class="muted small">Tiada perkara mendesak.</p>') + "</section>";
  }
  function dashPm() {
    const mine = DAL.projects().filter((p) => p.pm === me && p.status !== "ARCHIVED"), active = mine.filter((p) => p.status === "ACTIVE"), risky = active.filter((p) => p.schedule !== "ON TRACK");
    const open = DAL.myOpenTasks(), late = DAL.tasks().filter(isOverdue), review = DAL.tasks().filter(canApproveTask), coming = upcoming(99), permits = DAL.permits().filter((p) => permitStatus(p) !== "Aktif");
    return banner("Anda mengurus <b>" + active.length + " projek aktif</b>. <b>" + review.length + " tugasan</b> menunggu kelulusan anda dan <b>" + late.length + " tugasan</b> dalam projek anda lewat.", "Project Manager") +
      kpiRow([
        kpi("Projek Saya Aktif", active.length, risky.length ? '<span class="txt-bad">▲ ' + risky.length + " berisiko</span>" : "Tiada projek berisiko", "projects"),
        kpi("Tugasan Lewat", late.length, open.length + " tugasan saya terbuka", "tasks"),
        kpi("Program Akan Datang", coming.length, "Berkaitan projek anda", "programs"),
        kpi("Permit Perlu Tindakan", permits.length, "Ditugaskan kepada anda", "dbkl")
      ], true) +
      '<div class="grid"><section class="panel c7">' + panelHead("My Projects", mine.length + " projek", routeLink("projects", "Lihat semua")) + table([{ h: "Projek", r: projectBtn }, { h: "Status", r: (p) => badge(p.status) }, { h: "Jadual", r: (p) => badge(p.schedule) }, { h: "Kemajuan", r: (p) => progress(p.progress, projectTone(p)) }], mine) + "</section>" + panelMyTasks("c5") + "</div>" +
      '<div class="grid">' + panelCalendar("c7", "Programs", "Program berkaitan projek anda") + panelDeadlines("c5") + "</div>" +
      '<div class="grid">' + panelDbkl("c12", "DBKL Advertising Ditugaskan") + "</div>";
  }
  function panelNotifications(cls) {
    const list = DAL.notifications().slice(0, 5);
    return '<section class="panel ' + cls + '">' + panelHead("Notifications", DAL.notifications().filter((n) => !n.readBy.includes(me)).length + " belum dibaca", routeLink("notifications", "Semua")) + (list.length ? '<ul class="rows">' + list.map((n) => '<li><button type="button" class="text-link small" data-action="open-notif" data-id="' + esc(n.id) + '">' + esc(n.title) + '</button><div class="task-meta">' + esc(n.sub) + " · " + fmtDateTime(n.at) + "</div></li>").join("") + "</ul>" : '<p class="muted small">Tiada notifikasi.</p>') + "</section>";
  }
  function dashStaff() {
    const open = DAL.myOpenTasks(), pending = open.filter((t) => myAssign(t) === "PENDING ACCEPTANCE"), late = open.filter(isOverdue), programs = upcoming(99), wos = DAL.workOrders().filter((w) => w.status !== "Selesai");
    return banner("Anda ada <b>" + open.length + " tugasan terbuka</b>, <b>" + pending.length + " perlu diterima</b> dan <b>" + late.length + " lewat</b>.", "Staff") +
      kpiRow([kpi("Tugasan Terbuka", open.length, "Ditugaskan kepada anda", "tasks"), kpi("Perlu Diterima", pending.length, "Menunggu jawapan anda", "tasks"), kpi("Tugasan Lewat", late.length, "Melepasi tarikh akhir", "tasks"), kpi("Program Saya", programs.length, "Akan datang", "programs")], true) +
      '<div class="grid">' + panelMyTasks("c7", 6) + panelNotifications("c5") + "</div>" +
      '<div class="grid"><section class="panel c6">' + panelHead("My Programs", programs.length + " akan datang", routeLink("programs", "Kalendar")) + eventRows(programs.slice(0, 4), "Tiada program ditugaskan.") + "</section>" +
      '<section class="panel c6">' + panelHead("My DBKL Work", wos.length + " work order terbuka", routeLink("dbkl", "Buka")) + (wos.length ? '<ul class="rows">' + wos.map((w) => '<li class="event-row"><span class="event-date">' + w.id + '</span><div><strong class="small">' + esc(w.work) + '</strong><div class="task-meta">' + w.permit + " · " + fmtDate(w.due) + "</div></div>" + badge(w.status) + "</li>").join("") + "</ul>" : '<p class="muted small">Tiada kerja DBKL ditugaskan.</p>') + "</section></div>";
  }
  function dashViewer() {
    const s = DAL.summary();
    return banner("Ringkasan syarikat dalam mod <b>baca sahaja</b>. Butiran rekod tidak dipaparkan.", "Viewer · Baca sahaja") +
      kpiRow([kpi("Jumlah Projek", s.projects.total, "Tidak termasuk arkib"), kpi("Jumlah Tugasan", s.tasks.total, s.tasks.overdue + " lewat"), kpi("Program Akan Datang", s.programs.upcoming, "Daripada " + s.programs.total + " program"), kpi("Permit DBKL", s.dbkl.total, s.dbkl.soon + " hampir tamat · " + s.dbkl.expired + " tamat")], true) +
      '<div class="grid"><section class="panel c6">' + panelHead("Project Summary", s.projects.total + " projek") + barList(s.projects.byStatus, "Projek mengikut status") + "</section>" +
      '<section class="panel c6">' + panelHead("Task Summary", s.tasks.total + " tugasan") + barList(s.tasks.byStatus, "Tugasan mengikut status") + "</section></div>" +
      '<div class="grid"><section class="panel c6">' + panelHead("Program & Event Summary", "Event Selesai " + s.programs.ev.pct + "% (" + s.programs.ev.done + " daripada " + s.programs.ev.base + ")") + barList(s.programs.byType, "Program mengikut jenis") + "</section>" +
      '<section class="panel c6">' + panelHead("DBKL Operations Summary", s.dbkl.openWo + " work order terbuka") + barList(s.dbkl.byCategory, "Permit mengikut kategori") + "</section></div>";
  }
  /* P1-6: Ringkasan Operasi daripada data sebenar (dashboard.summary). Backend menapis ikut role:
   * VIEWER hanya menerima kiraan agregat (tiada Tetuan, No. Fail, lokasi). */
  function liveOpsSummary() {
    const head = '<div class="kpi-head"><h2>Ringkasan Operasi</h2>' + liveTag + "</div>";
    if (LD.err.ringkasan) return '<section class="live-summary">' + head + '<div class="panel"><div class="empty"><p>' + esc(LD.err.ringkasan) + '</p><button type="button" class="btn" data-action="live-reload" data-kind="ringkasan">Cuba lagi</button></div></div></section>';
    if (!LD.ringkasan) { liveLoad("ringkasan"); return '<section class="live-summary">' + head + '<div class="panel"><div class="empty" role="status"><p>Memuatkan ringkasan operasi…</p></div></div></section>'; }
    const r = LD.ringkasan, k = r.kategori || {};
    const aktif = r.jumlahProgram - (k.Batal || 0) - (k.Ditangguh || 0) - (k["Pertemuan Parlimen"] || 0);
    const tile = (label, val, sub, route) => '<article class="panel live-kpi">' + '<p class="small muted">' + esc(label) + '</p><p class="kpi-value">' + val + '</p><p class="small muted">' + esc(sub) + "</p>" + (route && canRoute(route) ? '<a class="text-link small" href="#' + route + '">Lihat</a>' : "") + "</article>";
    const j = r.ikutJenis || {};
    let html = '<section class="live-summary">' + head +
      '<div class="live-kpis">' +
        tile("Program direkod", r.jumlahProgram, "COMSTRA " + (j.COMSTRA || 0) + " · SLU " + (j.SLU || 0) + " · Parlimen " + (j["SLU PARLIMEN"] || 0), "programs") +
        tile("Event selesai", pct(k.Selesai || 0, aktif) + "%", (k.Selesai || 0) + " daripada " + aktif + " program aktif", "programs") +
        tile("Akan datang", k["Akan datang"] || 0, "Program bertarikh hari ini atau selepas", "programs") +
        tile("Perlu semak", k["Perlu semak"] || 0, "Tarikh lepas, event belum selesai", "programs") +
        tile("Order signboard aktif", r.orderAktif + " / " + r.orderJumlah, "Belum lengkap semua langkah", "dbkl") +
      "</div>";
    if (r.akanDatang) {
      const up = r.akanDatang.length ? '<ul class="live-list">' + r.akanDatang.map((p) => '<li><span class="tnum">' + fmtDate(p.tarikh) + "</span><span>" + esc(p.jenis) + " · " + esc(p.tetuan) + '</span><span class="muted small">' + esc(p.lokasi || "") + "</span></li>").join("") + "</ul>" : '<p class="muted small">Tiada program akan datang dalam rekod.</p>';
      const ord = r.orderTertunggak.length ? '<ul class="live-list">' + r.orderTertunggak.map((o) => '<li><span class="tnum">' + esc(o.id) + "</span><span>" + esc(o.tetuan) + " · " + esc(o.kaedah) + " · " + o.siap + "/" + o.perlu + '</span><span class="muted small">Seterusnya: ' + esc(o.seterusnya) + "</span></li>").join("") + "</ul>" : '<p class="muted small">Tiada order tertunggak.</p>';
      html += '<div class="grid" style="margin-top:12px"><section class="panel c6">' + panelHead("Program Akan Datang", r.akanDatang.length + " terdekat", routeLink("programs", "Buka"), liveTag) + up + "</section>" +
        '<section class="panel c6">' + panelHead("Order Signboard Tertunggak", r.orderTertunggak.length + " order", routeLink("dbkl", "Buka"), liveTag) + ord + "</section></div>";
    } else {
      html += note("Paparan ringkasan sahaja untuk role anda. Butiran rekod tidak dipaparkan.");
    }
    return html + "</section>";
  }
  /* UAT: dashboard mod LIVE hanya data sebenar (tiada persona atau panel contoh). */
  function liveDashboard() {
    const hour = +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date());
    const greet = hour < 12 ? "Selamat pagi" : hour < 14 ? "Selamat tengah hari" : hour < 19 ? "Selamat petang" : "Selamat malam";
    const dayName = DAYS[new Date(TODAY + "T00:00:00Z").getUTCDay()];
    const u = LIVE_USER, viewer = u.role === "VIEWER", me = u.emel;
    let lead = "Ringkasan operasi syarikat di bawah.", tugasanPanel = "", quick = [];
    if (!viewer) {
      if (!LD.tasks && !LD.err.tasks) liveLoad("tasks");
      const t = (LD.tasks && LD.tasks.tasks) || [];
      const buka = (x) => !["COMPLETED", "CANCELLED"].includes(x.status);
      const saya = t.filter((x) => buka(x) && [x.primary_assignee].concat(String(x.team || "").split(",")).includes(me));
      const terima = saya.filter((x) => x.acceptance === "PENDING" && x.primary_assignee === me);
      const lewat = saya.filter(ltOverdue);
      const semak = t.filter((x) => x.reviewer === me && x.status === "PENDING_REVIEW");
      lead = !LD.tasks ? "Memuatkan tugasan anda…" : "Anda ada <b>" + saya.length + " tugasan terbuka</b>, <b>" + terima.length + " perlu diterima</b>, <b>" + lewat.length + " lewat</b>" + (semak.length ? " dan <b>" + semak.length + " menunggu semakan anda</b>" : "") + ".";
      if (LD.tasks && LD.tasks.bolehCipta) quick.push(btn("+ Tugasan Baharu", "lt-new", "primary"));
      quick.push('<a class="btn" href="#tasks">Buka Tasks</a>');
      const senarai = semak.concat(saya.filter((x) => !semak.includes(x))).slice(0, 6);
      tugasanPanel = '<section class="panel" style="margin-top:16px">' + panelHead("Tugasan Saya", senarai.length + " perlu perhatian", routeLink("tasks", "Semua"), liveTagDev) +
        (!LD.tasks ? '<p class="muted small" role="status">Memuatkan…</p>' : senarai.length ? '<ul class="live-list">' + senarai.map((x) => '<li><button type="button" class="text-link tnum" data-action="lt-notif" data-id="' + esc(x.task_id) + '">' + esc(x.task_id) + "</button><span>" + esc(x.title) + " · " + ltBadge(x) + '</span><span class="muted small">' + (x.reviewer === me && x.status === "PENDING_REVIEW" ? "Menunggu semakan anda" : "Tarikh akhir " + (x.due_date ? fmtDate(x.due_date) : "—")) + "</span></li>").join("") + "</ul>" : '<p class="muted small">Tiada tugasan yang perlu perhatian. 👍</p>') + "</section>";
    }
    quick.push('<a class="btn" href="#operations">Buka Operations</a>');
    return '<section class="banner" aria-labelledby="welcome"><p class="banner-eyebrow">' + dayName + ", " + fmtDate(TODAY) + " · Sri Cheras Enterprise · " + esc(LIVE.roleLabel(u.role)) + (u.jawatan ? " · " + esc(u.jawatan) : "") + '</p><h1 id="welcome">' + greet + ", " + esc(u.nama || u.emel) + '</h1><p class="lead">' + lead + "</p>" +
      '<div class="quick"><div class="quick-row">' + quick.join("") + "</div></div></section>" + tugasanPanel + '<div style="margin-top:16px">' + liveOpsSummary() + "</div>";
  }
  const viewDashboard = () => (LIVE_USER ? liveDashboard() : ({ executive: dashExecutive, management: dashManagement, pm: dashPm, staff: dashStaff, viewer: dashViewer }[POLICY.dashboard])());

  /* ========== Paparan: My Workspace ========== */
  function viewWorkspace() {
    const u = sessionUser, mine = can("workspace.projects") ? DAL.projects().filter((p) => p.pm === me && p.status !== "ARCHIVED") : [], docs = can("workspace.documents") ? DAL.documents().filter((d) => d.owner === me) : [];
    const acts = D.audit.filter((a) => a.actor === me).slice(0, 5), updates = D.updates.filter((x) => x.by === me);
    return pageHead("My Workspace", "Tugasan dan aktiviti anda di satu tempat.", btn("Kemas Kini Kerja", "new-update", "primary")) +
      '<div class="grid"><section class="panel c4">' + panelHead("Staff Profile") + '<div class="profile-card"><span class="avatar" aria-hidden="true">' + esc(me.charAt(0)) + "</span><div><strong>" + esc(u.name) + '</strong><div class="task-meta">' + esc(u.title) + " · " + esc(u.dept) + '</div><div class="task-meta">' + esc(u.email) + "</div></div></div></section>" + panelMyTasks("c8", 20) + "</div>" +
      (can("workspace.projects") ? '<div class="grid"><section class="panel c12">' + panelHead("My Projects", mine.length + " projek") + table([{ h: "Projek", r: projectBtn }, { h: "Status", r: (p) => badge(p.status) }, { h: "Kemajuan", r: (p) => progress(p.progress, projectTone(p)) }, { h: "Sasaran", r: (p) => dueText(p.target, p.status === "COMPLETED") }], mine, empty("Tiada projek diuruskan oleh anda.")) + "</section></div>" : "") +
      '<div class="grid"><section class="panel c6">' + panelHead("Work Updates") + timeline(updates.map((x) => ({ text: x.text, meta: fmtDate(x.date) })), "Belum ada kemas kini.") + "</section>" +
      '<section class="panel c6">' + panelHead("My Activities") + timeline(acts.map((a) => ({ text: a.action + " · " + a.ref, meta: fmtDateTime(a.at) })), "Belum ada aktiviti.") + "</section></div>" +
      (can("workspace.documents") ? '<div class="grid"><section class="panel c12">' + panelHead("My Documents", docs.length + " dokumen", routeLink("documents", "Semua dokumen")) + table([{ h: "Nama", r: docBtn }, { h: "Kategori", r: (d) => esc(d.category) }, { h: "Versi", r: (d) => "v" + d.version }, { h: "Tarikh", r: (d) => fmtDate(d.date) }], docs, empty("Belum ada dokumen.", capBtn("doc.upload", "Muat Naik Dokumen", "new-doc", "small"))) + "</section></div>" : "");
  }

  /* ========== Paparan: Project Management ========== */
  function viewProjects() {
    const st = f("projects.status"), q = f("projects.q").toLowerCase(), all = DAL.projects();
    const rows = all.filter((p) => (st === "Semua" ? p.status !== "ARCHIVED" : p.status === st) && (!q || (p.name + p.id + p.pm + p.client).toLowerCase().includes(q)));
    const pending = can("project.approve") ? all.filter((p) => p.approval === "PENDING") : [];
    const mineReq = !can("project.approve") ? all.filter((p) => p.requestedBy === me && p.approval !== "APPROVED") : [];
    const addBtn = capBtn("project.request", POLICY.scope === "company" ? "+ Projek Baharu" : "+ Mohon Projek", "new-project", "primary");
    const decideCell = (p) => (canDecideProject(p) ? '<div class="row-actions">' + btn("Lulus", "approve-project", "small primary", ' data-id="' + p.id + '"') + btn("Tolak", "reject-project", "small", ' data-id="' + p.id + '"') + "</div>" : '<span class="muted small">Permohonan sendiri. Perlu MANAGEMENT lain.</span>');
    const myCell = (p) => (canResubmitProject(p) ? btn("Betulkan & Hantar Semula", "resubmit-project", "small", ' data-id="' + p.id + '"') : '<span class="muted small">Menunggu MANAGEMENT</span>');
    return pageHead("Project Management", "Permohonan, status, jadual dan kemajuan projek.", addBtn) +
      (pending.length ? '<section class="panel" style="margin-bottom:16px">' + panelHead("Permohonan Menunggu Kelulusan", pending.length + " permohonan · keputusan oleh MANAGEMENT") + table([{ h: "ID", r: (p) => '<span class="tnum muted">' + p.id + "</span>" }, { h: "Projek", r: projectBtn }, { h: "Pemohon", r: (p) => esc(p.requestedBy) }, { h: "Status", r: (p) => badge(p.status) }, { h: "Tindakan", r: decideCell }], pending) + "</section>" : "") +
      (mineReq.length ? '<section class="panel" style="margin-bottom:16px">' + panelHead("Permohonan Saya", mineReq.length + " permohonan belum diluluskan") + table([{ h: "ID", r: (p) => '<span class="tnum muted">' + p.id + "</span>" }, { h: "Projek", r: projectBtn }, { h: "Status", r: (p) => badge(p.status) }, { h: "Sebab penolakan", r: (p) => esc(p.reason || "—") }, { h: "Tindakan", r: myCell }], mineReq) + "</section>" : "") +
      '<section class="panel">' + panelHead("Senarai Projek", rows.length + " daripada " + all.length + " projek") + '<div class="toolbar">' + searchBox("projects.q", "Cari projek, pelanggan atau pengurus") + chips("projects.status", ["Semua"].concat(PROJECT_STATUS)) + "</div>" +
      table([
        { h: "ID", r: (p) => '<span class="tnum muted">' + p.id + "</span>" }, { h: "Projek", r: projectBtn }, { h: "Pengurus", r: (p) => esc(p.pm) },
        { h: "Status", r: (p) => badge(p.status) }, { h: "Jadual", r: (p) => badge(p.schedule) },
        { h: "Kemajuan", r: (p) => progress(p.progress, projectTone(p)) }, { h: "Sasaran", r: (p) => dueText(p.target, ["COMPLETED", "ARCHIVED", "CANCELLED"].includes(p.status)) }
      ], rows, empty("Tiada projek sepadan dengan penapis ini.", addBtn)) + "</section>";
  }
  function openProject(id) {
    const p = DAL.projects().find((x) => x.id === id);
    if (!p) { toast("Rekod ini tiada dalam skop akses anda."); return; }
    const tasks = DAL.tasks().filter((t) => t.project === p.id), events = DAL.events().filter((e) => e.project === p.id), docs = DAL.documents().filter((d) => d.project === p.id);
    const actions = [];
    if (canDecideProject(p)) actions.push(btn("Lulus", "approve-project", "primary", ' data-id="' + p.id + '"'), btn("Tolak", "reject-project", "", ' data-id="' + p.id + '"'));
    if (canResubmitProject(p)) actions.push(btn("Betulkan & Hantar Semula", "resubmit-project", "primary", ' data-id="' + p.id + '"'));
    const reqNote = p.approval === "PENDING" ? (can("project.approve") ? (p.requestedBy === me ? note("Ini permohonan anda sendiri. Keputusan mesti dibuat oleh pengguna MANAGEMENT lain.") : "") : note("Menunggu keputusan MANAGEMENT. Super Admin dan Project Manager tidak boleh meluluskan permohonan projek.")) : "";
    const log = p.requestLog || [];
    if (canEditProject(p)) actions.push(btn("Kemas Kini", "edit-project", "primary", ' data-id="' + p.id + '"'));
    if (can("project.archive") && p.status !== "ARCHIVED" && p.approval === "APPROVED") actions.push(btn("Arkib", "archive-project", "", ' data-id="' + p.id + '"'));
    if (can("doc.upload") && p.status !== "ARCHIVED") actions.push(btn("Muat Naik Dokumen", "new-doc", "", ' data-project="' + p.id + '"'));
    const docGroups = docCategories().map((c) => { const list = docs.filter((d) => d.category === c); return list.length ? '<p class="small"><strong>' + esc(c) + '</strong></p><ul class="doc-list">' + list.map((d) => "<li>" + docBtn(d) + ' <span class="muted small">v' + d.version + "</span></li>").join("") + "</ul>" : ""; }).join("");
    openInfo({ title: p.name, actions: actions.join(""), body: reqNote +
      detailList([["ID", p.id], ["Status", badge(p.status)], ["Jadual", badge(p.schedule)], ["Keutamaan", badge(p.priority)], ["Pelanggan / Pemaju", esc(p.client)], ["Lokasi", esc(p.location)], ["Pengurus Utama", esc(p.pm)], ["Ahli Pasukan", esc(p.team.join(", ") || "—")], ["Mula", fmtDate(p.start)], ["Sasaran Siap", fmtDate(p.target)], ["Kemajuan", p.progress + "%"]]) +
      '<p class="small" style="margin-bottom:12px">' + esc(p.description) + "</p>" + (p.approval === "REJECTED" && p.reason ? note("Sebab penolakan: " + p.reason) : "") +
      (log.length ? '<h3 class="sub-head">Rekod Permohonan</h3>' + table([{ h: "Masa", r: (l) => '<span class="tnum">' + fmtDateTime(l.at) + "</span>" }, { h: "Keputusan", r: (l) => badge(l.action) }, { h: "Oleh", r: (l) => esc(l.by) + ' <span class="muted small">' + esc(l.role) + "</span>" }, { h: "Catatan", r: (l) => esc(l.note || "—") }], log) : "") +
      '<h3 class="sub-head">Operasi Berkaitan</h3><p class="small muted" style="margin-bottom:12px">' + tasks.length + " tugasan · " + events.length + " program: " + esc(events.map((e) => e.name).join(", ") || "tiada") + "</p>" +
      '<h3 class="sub-head">Dokumen Projek</h3>' + (docGroups || '<p class="small muted" style="margin-bottom:12px">Belum ada dokumen.</p>') +
      '<h3 class="sub-head">Sejarah Aktiviti</h3>' + timeline(p.history.map((h) => ({ text: h.text, meta: fmtDateTime(h.at) + " · " + h.by })))
    });
  }

  /* ========== Paparan: Task Management ========== */
  /* ========== P2: Tasks SEBENAR (mod LIVE, SCE-DEV-TASKS) ========== */
  const LT_STATUS = (c) => String(c || "").replace(/_/g, " ");
  const LT_TINDAKAN = { accept: "Terima", reject: "Tolak", progress: "Kemas Kini Kemajuan", submit: "Hantar untuk Semakan", approve: "Luluskan", revise: "Minta Revisi", cancel: "Batalkan", comment: "Komen" };
  const LT_AKSI_SEJARAH = { CREATE: "Dicipta", ACCEPT: "Diterima", REJECT: "Ditolak", PROGRESS: "Kemajuan", STATUS: "Status", NOTE: "Nota", COMMENT: "Komen" };
  const ltBadge = (t) => (t.acceptance === "PENDING" && t.status === "TODO" ? badge("PENDING ACCEPTANCE") : t.acceptance === "REJECTED" ? badge("REJECTED") : badge(LT_STATUS(t.status)));
  const ltOverdue = (t) => !["COMPLETED", "CANCELLED"].includes(t.status) && t.due_date && t.due_date < TODAY;
  function ltReload() { LD.tasks = null; LD.err.tasks = null; liveLoad("tasks"); LD.notif = null; liveLoad("notif"); refresh(); }
  async function ltCall(action, body, ok) {
    try { await LIVE.api(action, body); toast(ok); }
    catch (e) { toast(e.message || "Ralat."); }
    ltReload();
  }
  function viewTasksLive() {
    const gate = liveGate("tasks"); if (gate) return pageHead("Tasks", "Tugasan staf dan kemajuan kerja.") + gate;
    const d = LD.tasks, all = d.tasks || [], me = LIVE_USER.emel;
    const views = ["Semua", "Saya", "Lewat", "Semakan Saya", "Selesai"];
    if (!views.includes(f("lt.view"))) state.filters["lt.view"] = "Semua";
    const v = f("lt.view"), q = f("lt.q").toLowerCase();
    const sasar = (t) => [t.primary_assignee].concat(String(t.team || "").split(",")).includes(me);
    const list = all.filter((t) => (v === "Semua" ? !["COMPLETED", "CANCELLED"].includes(t.status) : v === "Saya" ? sasar(t) : v === "Lewat" ? ltOverdue(t) : v === "Semakan Saya" ? t.reviewer === me && t.status === "PENDING_REVIEW" : t.status === "COMPLETED") &&
      (!q || [t.task_id, t.title, t.nama.primary, t.category].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => (a.due_date || "9").localeCompare(b.due_date || "9"));
    const kira = (fn) => all.filter(fn).length;
    return pageHead("Tasks", "Tugasan sebenar DEV, disimpan dalam SCE-DEV-TASKS. Tiada kelulusan sendiri; 100% tidak bermaksud selesai.", (d.bolehCipta ? btn("+ Tugasan Baharu", "lt-new", "primary") : "") + " " + liveTagDev) +
      '<section class="panel"><dl class="stats">' +
        '<div class="stat"><dt>Terbuka</dt><dd>' + kira((t) => !["COMPLETED", "CANCELLED"].includes(t.status)) + "</dd></div>" +
        '<div class="stat"><dt>Menunggu jawapan</dt><dd>' + kira((t) => t.acceptance === "PENDING") + "</dd></div>" +
        '<div class="stat"><dt>Lewat</dt><dd>' + kira(ltOverdue) + "</dd></div>" +
        '<div class="stat"><dt>Menunggu semakan</dt><dd>' + kira((t) => t.status === "PENDING_REVIEW") + "</dd></div>" +
      "</dl></section>" +
      '<section class="panel" style="margin-top:16px">' + panelHead("Senarai Tugasan", list.length + " tugasan", "", liveTagDev) +
      '<div class="toolbar">' + chips("lt.view", views) + searchBox("lt.q", "Cari ID, tajuk, assignee") + "</div>" +
      table([
        { h: "ID", r: (t) => '<button type="button" class="text-link tnum" data-action="lt-open" data-id="' + esc(t.task_id) + '">' + esc(t.task_id) + "</button>" },
        { h: "Tajuk", r: (t) => esc(t.title) },
        { h: "Assignee", r: (t) => esc(t.nama.primary) },
        { h: "Penyemak", r: (t) => esc(t.nama.reviewer) },
        { h: "Tarikh akhir", r: (t) => (t.due_date ? dueText(t.due_date, ["COMPLETED", "CANCELLED"].includes(t.status)) : "—") },
        { h: "Keutamaan", r: (t) => badge({ HIGH: "Tinggi", MEDIUM: "Sederhana", LOW: "Rendah" }[t.priority] || t.priority) },
        { h: "Status", r: ltBadge },
        { h: "Kemajuan", r: (t) => progress(Number(t.progress) || 0, t.status === "COMPLETED" ? "good" : "") }
      ], list, empty(all.length ? "Tiada tugasan sepadan dengan penapis ini." : "Belum ada tugasan. " + (d.bolehCipta ? "Klik + Tugasan Baharu untuk mula." : ""))) + "</section>";
  }
  function liveTaskNew() {
    const p = (LD.tasks && LD.tasks.pengguna) || [];
    const opt = p.map((u) => [u.emel, u.nama + " (" + LIVE.roleLabel(u.role) + ")"]);
    openForm({ live: true, title: "Tugasan Baharu", submit: "Cipta Tugasan", intro: note("Penyemak tidak boleh menjadi assignee. Assignee utama perlu menerima tugasan sebelum mula."), fields: [
      { name: "title", label: "Tajuk", required: true, maxlength: 200, full: true },
      { name: "description", label: "Keterangan", type: "textarea", full: true, maxlength: 2000 },
      { name: "primary_assignee", label: "Assignee utama", type: "select", options: opt, required: true },
      { name: "team", label: "Ahli tambahan (pilihan)", type: "multiselect", options: opt },
      { name: "reviewer", label: "Penyemak", type: "select", options: opt, value: LIVE_USER.emel, required: true },
      { name: "priority", label: "Keutamaan", type: "select", options: [["MEDIUM", "Sederhana"], ["HIGH", "Tinggi"], ["LOW", "Rendah"]], value: "MEDIUM" },
      { name: "start_date", label: "Tarikh mula", type: "date" },
      { name: "due_date", label: "Tarikh akhir", type: "date", required: true },
      { name: "category", label: "Kategori", maxlength: 60 }
    ], onSubmit: (dt) => { dt.team = (dt.team || []).join(","); ltCall("tasks.create", { data: dt }, "Tugasan dicipta."); } });
  }
  async function liveTaskOpen(id) {
    openInfo({ title: id, body: '<p class="muted" role="status">Memuatkan butiran…</p>' });
    let o;
    try { o = await LIVE.api("tasks.get", { task_id: id }); } catch (e) { openInfo({ title: id, body: note(e.message) }); return; }
    const t = o.task;
    const acts = t.tindakan.map((a) => btn(LT_TINDAKAN[a] || a, "lt-act", a === "approve" || a === "accept" || a === "submit" ? "primary" : "", ' data-id="' + esc(t.task_id) + '" data-t="' + esc(a) + '"')).join("");
    const sej = o.sejarah.slice().reverse().map((h) => ({ text: (LT_AKSI_SEJARAH[h.action] || h.action) + (h.to_value ? ": " + LT_STATUS(h.from_value) + (h.from_value ? " → " : "") + LT_STATUS(h.to_value) : "") + (h.note ? " · " + h.note : ""), meta: h.nama + " · " + fmtDateTime(h.at) }));
    openInfo({ title: t.task_id + " · " + t.title, actions: acts, body: detailList([
      ["Status", ltBadge(t)], ["Kemajuan", progress(Number(t.progress) || 0)], ["Assignee utama", esc(t.nama.primary)], ["Ahli tambahan", esc(t.team || "—")],
      ["Pemberi tugas", esc(t.nama.assigned_by)], ["Penyemak", esc(t.nama.reviewer)], ["Tarikh akhir", t.due_date ? dueText(t.due_date, ["COMPLETED", "CANCELLED"].includes(t.status)) : "—"],
      ["Keterangan", esc(t.description || "—")], ["Sebab tolak", esc(t.reject_reason || "—")]
    ]) + '<p class="sub-head" style="margin-top:16px">Sejarah</p>' + timeline(sej, "Tiada sejarah.") });
    state.ltTask = t;
  }
  function liveTaskAction(id, a) {
    const t = state.ltTask && state.ltTask.task_id === id ? state.ltTask : null; if (!t) return;
    const wajib = ["reject", "revise", "cancel", "comment"].includes(a);
    const fields = [];
    if (a === "progress") {
      fields.push({ name: "progress", label: "Kemajuan (%)", type: "number", min: 0, max: 100, step: 1, value: t.progress || 0, required: true });
      fields.push({ name: "status", label: "Status", type: "select", options: [["IN_PROGRESS", "IN PROGRESS"], ["BLOCKED", "BLOCKED"]], value: t.status === "BLOCKED" ? "BLOCKED" : "IN_PROGRESS" });
    }
    fields.push({ name: "note", label: { reject: "Sebab penolakan", revise: "Nota revisi", cancel: "Sebab pembatalan", comment: "Komen" }[a] || "Nota (pilihan)", type: "textarea", full: true, required: wajib, maxlength: 1000 });
    openForm({ live: true, title: (LT_TINDAKAN[a] || a) + ": " + t.task_id, submit: LT_TINDAKAN[a] || "Simpan", fields: fields,
      intro: a === "approve" ? note("Meluluskan menandakan tugasan COMPLETED.") : a === "progress" ? note("100% tidak menutup tugasan. Assignee utama perlu menghantar untuk semakan.") : "",
      onSubmit: (dt) => ltCall("tasks.action", { task_id: t.task_id, tindakan: a, version: t.version, note: dt.note, progress: dt.progress != null ? Number(dt.progress) : undefined, status: dt.status }, (LT_TINDAKAN[a] || "Tindakan") + " berjaya.") });
  }

  function viewTasks() {
    if (LIVE_USER) return viewTasksLive();
    const v = f("tasks.view"), all = DAL.tasks();
    const list = all.filter((t) => v === "Semua" || (v === "Saya" && isMine(t)) || (v === "Lewat" && isOverdue(t)) || (v === "Semakan Saya" && canApproveTask(t)));
    const views = ["Semua", "Saya", "Lewat"].concat(POLICY.taskApprove !== "none" ? ["Semakan Saya"] : []);
    return pageHead("Task Management", "Tugasan mengikut peringkat. Penyiapan memerlukan semakan dan kelulusan.", capBtn("task.assign", "+ Tugasan Baharu", "new-task", "primary")) +
      '<div class="toolbar">' + chips("tasks.view", views) + demoTag + '</div><div class="board">' + TASK_STATUS.map((s) => {
        const items = list.filter((t) => t.status === s).sort((a, b) => a.due.localeCompare(b.due));
        return '<section class="lane" aria-label="' + s + '"><div class="lane-head"><span>' + s + '</span><span class="tnum muted">' + items.length + '</span></div><div class="lane-list">' + (items.length ? items.map(taskCard).join("") : '<p class="lane-empty">Tiada tugasan</p>') + "</div></section>";
      }).join("") + "</div>";
  }
  function taskCard(t) {
    const moves = taskMoves(t), mineState = isMine(t) ? myAssign(t) : "";
    const actions = taskRowActions(t) + (canApproveTask(t) ? btn("Lulus", "approve-task", "small primary", ' data-id="' + t.id + '"') + btn("Pulangkan", "return-task", "small", ' data-id="' + t.id + '"') : "");
    return '<article class="tcard"><button type="button" class="text-link tcard-title" data-action="open-task" data-id="' + t.id + '">' + esc(t.title) + '</button><div class="task-meta">' + (t.project ? esc(projectName(t.project)) : "Tanpa projek") + '</div><div class="tcard-row">' + badge(t.priority) + dueText(t.due, isTaskClosed(t)) + '</div><div class="task-meta" style="margin-bottom:6px">' + esc(t.primary) + (t.additional.length ? " +" + t.additional.length : "") + " · " + t.progress + "%</div>" +
      (mineState && mineState !== "ACCEPTED" ? '<div style="margin-bottom:6px">' + badge(mineState) + "</div>" : "") + (actions ? '<div class="row-actions" style="margin-bottom:6px">' + actions + "</div>" : "") +
      (moves.length ? '<label class="sr" for="st-' + t.id + '">Status ' + esc(t.title) + '</label><select id="st-' + t.id + '" class="inline-select" data-change="task-status" data-id="' + t.id + '"><option value="">Tukar status…</option>' + moves.map((o) => "<option>" + o + "</option>").join("") + "</select>" : "") + "</article>";
  }
  const findTask = (id) => DAL.tasks().find((x) => x.id === id);
  function openTask(id) {
    const t = findTask(id);
    if (!t) { toast("Rekod ini tiada dalam skop akses anda."); return; }
    const a = [];
    if (isMine(t) && myAssign(t) === "PENDING ACCEPTANCE") a.push(btn("Terima", "accept-task", "primary", ' data-id="' + id + '"'), btn("Tolak", "reject-task", "", ' data-id="' + id + '"'));
    if (canWorkOnTask(t)) a.push(btn("Kemas Kini Kemajuan", "task-progress", "", ' data-id="' + id + '"'));
    if (canSubmitTask(t)) a.push(btn("Hantar Semakan", "submit-review", "primary", ' data-id="' + id + '"'));
    if (canApproveTask(t)) a.push(btn("Lulus", "approve-task", "primary", ' data-id="' + id + '"'), btn("Pulangkan", "return-task", "", ' data-id="' + id + '"'));
    if (isMine(t) || canManageTask(t)) a.push(btn("Tambah Komen", "task-comment", "", ' data-id="' + id + '"'), btn("Lampiran", "task-attach", "", ' data-id="' + id + '"'));
    openInfo({ title: t.title, actions: a.join(""), body:
      (t.status === "PENDING REVIEW" && !canApproveTask(t) && POLICY.taskApprove === "if-reviewer" ? note("Super Admin hanya boleh meluluskan tugasan apabila dilantik sebagai pemberi tugas atau penyemak.") : "") +
      detailList([["ID", t.id], ["Status", badge(t.status)], ["Projek", esc(t.project ? projectName(t.project) : "Tiada")], ["Kategori", esc(t.category)], ["Diberikan Oleh", esc(t.assignedBy)], ["Penyemak", esc(t.reviewer)], ["Mula", fmtDate(t.start)], ["Tarikh Akhir", fmtDate(t.due)], ["Keutamaan", badge(t.priority)], ["Kemajuan", t.progress + "%"]]) +
      '<p class="small" style="margin-bottom:12px">' + esc(t.description) + "</p>" +
      '<h3 class="sub-head">Penerima Tugas</h3><ul class="doc-list">' + assignees(t).map((n) => "<li>" + esc(n) + (n === t.primary ? ' <span class="muted small">(Utama)</span> ' : " ") + badge((t.assign[n] || {}).state || "PENDING ACCEPTANCE") + (t.assign[n] && t.assign[n].reason ? ' <span class="small muted">' + esc(t.assign[n].reason) + "</span>" : "") + "</li>").join("") + "</ul>" +
      '<h3 class="sub-head">Nota Kerja</h3>' + timeline(t.notes.map((n) => ({ text: n.text, meta: fmtDateTime(n.at) + " · " + n.by })), "Belum ada nota.") +
      '<h3 class="sub-head" style="margin-top:12px">Komen</h3>' + timeline(t.comments.map((n) => ({ text: n.text, meta: fmtDateTime(n.at) + " · " + n.by })), "Belum ada komen.") +
      '<h3 class="sub-head" style="margin-top:12px">Lampiran</h3>' + (t.attachments.length ? '<ul class="doc-list">' + t.attachments.map((n) => "<li>" + esc(n.name) + ' <span class="muted small">' + esc(n.by) + "</span></li>").join("") + "</ul>" : '<p class="muted small">Belum ada lampiran.</p>') +
      '<h3 class="sub-head" style="margin-top:12px">Sejarah Aktiviti</h3>' + timeline(t.history.map((h) => ({ text: h.text, meta: fmtDateTime(h.at) + " · " + h.by })))
    });
  }

  /* ========== Paparan: Program & Event ========== */
  /* ========== Data SEBENAR (mod LIVE, baca sahaja) ========== */
  const LD = { program: null, order: null, ringkasan: null, tasks: null, notif: null, err: {}, busy: {}, at: {} };
  function liveLoad(kind) {
    if (!LIVE_USER || LD.busy[kind]) return;
    LD.busy[kind] = true;
    const SUMBER = { program: ["ops.programs.list", "program"], order: ["ops.signboard.list", "order"], ringkasan: ["dashboard.summary", "ringkasan"], tasks: ["tasks.list", null], notif: ["notifications.list", null] };
    LIVE.api(SUMBER[kind][0])
      .then((o) => { LD[kind] = SUMBER[kind][1] ? o[SUMBER[kind][1]] : o; LD.at[kind] = o.dikemasKini; LD.err[kind] = null; })
      .catch((e) => { LD.err[kind] = e.code === "TIADA_KEBENARAN" ? "Akaun anda tiada kebenaran untuk data ini." : (e.message || "Ralat memuatkan data."); })
      .finally(() => { LD.busy[kind] = false; if (kind === "notif") renderNotifs(); else if (["programs", "dbkl", "operations", "dashboard", "tasks"].includes(currentRoute())) refresh(); });
  }
  const liveTag = '<span class="live-tag">Data sebenar · baca sahaja</span>';
  const liveTagDev = '<span class="live-tag">Data sebenar DEV</span>'; // Tasks dan notifikasi: boleh ditulis, dalam SCE-DEV-TASKS
  // Pulangkan HTML keadaan memuat/ralat, atau null jika data sedia.
  function liveGate(kind) {
    if (LD.err[kind]) return '<section class="panel"><div class="empty"><p>' + esc(LD.err[kind]) + '</p><button type="button" class="btn" data-action="live-reload" data-kind="' + kind + '">Cuba lagi</button></div></section>';
    if (!LD[kind]) { liveLoad(kind); return '<section class="panel"><div class="empty" role="status"><p>Memuatkan rekod sebenar…</p></div></section>'; }
    return null;
  }
  const LIVE_KAT = ["Semua", "Selesai", "Akan datang", "Tarikh belum tetap", "Perlu semak", "Ditangguh", "Batal", "Pertemuan Parlimen"];
  const KAT_TONE = { Selesai: "good", "Akan datang": "info", "Tarikh belum tetap": "neutral", "Perlu semak": "bad", Ditangguh: "warn", Batal: "bad", "Pertemuan Parlimen": "info" };
  const katBadge = (k) => '<span class="badge ' + (KAT_TONE[k] || "neutral") + '">' + esc(k) + "</span>";
  const TAHAP_LABEL = { siap: "Siap", pending: "Belum", na: "N/A", tiada: "—" };
  const tahapPill = (nama, v) => '<span class="tahap tahap-' + esc(v) + '" title="' + esc(nama + ": " + (TAHAP_LABEL[v] || v)) + '">' + esc(nama.charAt(0)) + "</span>";
  const liveDate = (p) => (p.tarikh ? '<span class="tnum">' + fmtDate(p.tarikh) + "</span>" : '<span class="muted">' + esc(p.tarikhAsal || "—") + "</span>");
  const liveStamp = (k) => (LD.at[k] ? "Dikemas kini " + fmtDateTime(LD.at[k]) : "");

  function viewProgramsLive() {
    const gate = liveGate("program"); if (gate) return pageHead("Program & Event", "Rekod sebenar Communication Strategy, Sesi Libat Urus dan SLU Parlimen.") + gate;
    const t = f("programs.type") || "Semua", k = f("live.kat") || "Semua", q = f("live.q").toLowerCase();
    const all = LD.program;
    const list = all.filter((p) => (t === "Semua" || p.jenis === t) && (k === "Semua" || p.kategori === k) &&
      (!q || [p.tetuan, p.noFail, p.lokasi, p.penjelasan].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => (b.tarikh || "0").localeCompare(a.tarikh || "0"));
    const count = (fn) => all.filter(fn).length;
    const aktif = all.filter((p) => !["Batal", "Ditangguh", "Pertemuan Parlimen"].includes(p.kategori));
    const ev = aktif.filter((p) => p.tahap.event === "siap").length;
    const stat = (label, val, sub) => '<div class="stat"><dt>' + esc(label) + "</dt><dd>" + val + '</dd><span class="small muted">' + esc(sub) + "</span></div>";
    return pageHead("Program & Event", "Rekod sebenar Communication Strategy, Sesi Libat Urus dan SLU Parlimen daripada Sheet operasi. " + liveStamp("program"), liveTag) +
      '<section class="panel"><dl class="stats">' +
        stat("Jumlah rekod", all.length, "COMSTRA " + count((p) => p.jenis === "COMSTRA") + " · SLU " + count((p) => p.jenis === "SLU") + " · Parlimen " + count((p) => p.jenis === "SLU PARLIMEN")) +
        stat("Event selesai", pct(ev, aktif.length) + "%", ev + " daripada " + aktif.length + " program aktif") +
        stat("Akan datang", count((p) => p.kategori === "Akan datang"), "tarikh hari ini atau selepas") +
        stat("Perlu semak", count((p) => p.kategori === "Perlu semak"), "tarikh lepas, event belum selesai") +
      "</dl></section>" +
      '<section class="panel" style="margin-top:16px">' + panelHead("Senarai Program", list.length + " daripada " + all.length + " rekod", "", liveTag) +
      '<div class="toolbar">' + chips("programs.type", ["Semua"].concat(PROGRAM_TYPES)) + searchBox("live.q", "Cari Tetuan, No. Fail, lokasi") +
        filterSelect("live.kat", "Kategori", LIVE_KAT.map((x) => [x, x])) + "</div>" +
      '<p class="small muted" style="margin:8px 0">Tahap: E = Event, R = Report, S = Submission.</p>' +
      table([
        { h: "Tarikh", r: liveDate },
        { h: "Jenis", r: (p) => esc(p.jenis) },
        { h: "Tetuan", r: (p) => '<button type="button" class="text-link" data-action="live-detail" data-kunci="' + esc(p.kunci) + '">' + esc(p.tetuan) + "</button>" },
        { h: "No. Fail DBKL", r: (p) => '<span class="tnum">' + esc(p.noFail || "—") + "</span>" },
        { h: "Lokasi", r: (p) => esc(p.lokasi || "—") },
        { h: "Kategori", r: (p) => katBadge(p.kategori) },
        { h: "Tahap", r: (p) => '<span class="tahap-row">' + tahapPill("Event", p.tahap.event) + tahapPill("Report", p.tahap.report) + tahapPill("Submission", p.tahap.submission) + "</span>" },
        { h: "Laporan", r: (p) => (p.linkReport ? '<a href="' + esc(p.linkReport) + '" target="_blank" rel="noopener noreferrer">Buka</a>' : '<span class="muted small">—</span>') }
      ], list, empty("Tiada rekod sepadan dengan penapis ini.")) + "</section>";
  }
  function openLiveDetail(kunci) {
    const p = (LD.program || []).find((x) => x.kunci === kunci); if (!p) return;
    openInfo({ title: p.jenis + " · " + p.tetuan, body: detailList([
      ["Tarikh", liveDate(p)], ["Jenis", esc(p.jenis)], ["No. Fail DBKL", esc(p.noFail || "—")], ["Tetuan", esc(p.tetuan)],
      ["Penjelasan", esc(p.penjelasan || "—")], ["Lokasi", esc(p.lokasi || "—")], ["Kategori", katBadge(p.kategori)],
      ["Status asal", esc(p.statusAsal || "—")], ["Laporan", p.linkReport ? '<a href="' + esc(p.linkReport) + '" target="_blank" rel="noopener noreferrer">' + esc(p.linkReport) + "</a>" : "—"],
      ["Sumber", esc((p.sumber === "COMSTRA" ? "COMMUNICATION STRATEGY" : "SESI LIBAT URUS") + ", baris " + p.baris)]
    ]) + note("Rekod sebenar, baca sahaja. Kemas kini dibuat dalam dashboard operasi sedia ada.") });
  }

  const LANGKAH_TONE = { siap: "good", belum: "neutral", na: "neutral" };
  function viewDbklLive() {
    const gate = liveGate("order"); if (gate) return pageHead("DBKL Advertising", "Order signboard Kaedah 3A dan 3B.") + gate;
    const all = LD.order;
    return pageHead("DBKL Advertising", "Order signboard Kaedah 3A dan 3B dengan checklist 10 langkah. " + liveStamp("order"), liveTag) +
      note("Kaedah 3B: langkah 8 (Iklan Akhbar) automatik N/A. Butiran proses lain belum disahkan dan kekal boleh ubah.") +
      '<section class="panel" style="margin-top:16px">' + panelHead("Order Signboard", all.length + " order", "", liveTag) + table([
        { h: "ID Order", r: (o) => '<button type="button" class="text-link tnum" data-action="live-order" data-id="' + esc(o.id) + '">' + esc(o.id) + "</button>" },
        { h: "Tarikh", r: (o) => '<span class="tnum">' + esc(o.tarikhOrder || "—") + "</span>" },
        { h: "Tetuan", r: (o) => esc(o.tetuan || "—") },
        { h: "JPRB", r: (o) => esc(o.rujukanJprb || "—") },
        { h: "Kaedah", r: (o) => esc(o.kaedah || "—") },
        { h: "Staf", r: (o) => esc(o.staf || "—") },
        { h: "Kemajuan", r: (o) => progress(pct(o.siap, o.perlu), o.siap === o.perlu ? "good" : "") },
        { h: "Seterusnya", r: (o) => (o.seterusnya === "Selesai" ? badge("Selesai") : esc(o.seterusnya)) }
      ], all, empty("Tiada order signboard.")) + "</section>";
  }
  function openLiveOrder(id) {
    const o = (LD.order || []).find((x) => x.id === id); if (!o) return;
    openInfo({ title: "Order " + o.id, body: detailList([["Tetuan", esc(o.tetuan || "—")], ["No. Rujukan JPRB", esc(o.rujukanJprb || "—")], ["Lokasi", esc(o.lokasi || "—")], ["Kaedah", esc(o.kaedah || "—")], ["Staf", esc(o.staf || "—")], ["Kemajuan", o.siap + " / " + o.perlu + " langkah"]]) +
      '<ol class="checklist">' + o.langkah.map((l) => '<li class="cl-' + l.status + '"><span>' + esc(l.nama) + "</span>" + '<span class="badge ' + LANGKAH_TONE[l.status] + '">' + (l.status === "siap" ? esc(l.tarikh) : l.status === "na" ? "N/A" : "Belum") + "</span></li>").join("") + "</ol>" +
      note("Rekod sebenar, baca sahaja. Tanda langkah dibuat dalam Portal Staf dashboard operasi sedia ada.") });
  }

  function viewPrograms() {
    if (LIVE_USER) return viewProgramsLive();
    const t = f("programs.type"), all = DAL.events(), ev = eventStatsFor(all);
    const list = all.filter((e) => t === "Semua" || e.type === t).sort((a, b) => b.date.localeCompare(a.date));
    const sel = list.filter((e) => e.date === state.cal.sel);
    return pageHead("Program & Event", "Kalendar dan status program COMSTRA, SLU dan SLU Parlimen.", capBtn("program.manage", "+ Event Baharu", "new-event", "primary")) +
      '<div class="toolbar">' + chips("programs.type", ["Semua"].concat(PROGRAM_TYPES)) + "</div>" +
      '<div class="grid"><section class="panel c8">' + panelHead("Program Calendar", "Klik tarikh untuk lihat butiran", calNav()) + calendar(true) + "</section>" +
      '<section class="panel c4">' + panelHead("Tarikh Dipilih", fmtDate(state.cal.sel)) + eventRows(sel, "Tiada event pada tarikh ini.") + '<div style="margin-top:20px"><p class="sub-head">Event Selesai</p><p class="kpi-value">' + ev.pct + '%</p><p class="small muted">' + ev.done + " selesai daripada " + ev.base + " event yang tarikhnya sudah tiba. Program Batal, Ditangguh dan belum tiba tidak dikira.</p></div></section></div>" +
      '<div class="grid"><section class="panel c12">' + panelHead("Senarai Program", list.length + " program") + table([
        { h: "Tarikh", r: (e) => '<span class="tnum">' + fmtDate(e.date) + "</span>" }, { h: "Program", r: (e) => esc(e.name) }, { h: "Jenis", r: (e) => esc(e.type) }, { h: "Projek", r: (e) => esc(e.project ? projectName(e.project) : "Tiada") }, { h: "Lokasi", r: (e) => esc(e.place) }, { h: "Status", r: (e) => badge(e.status) },
        { h: "Tindakan", r: (e) => (canManageEvent(e) ? btn("Kemas Kini", "edit-event", "small", ' id="ev-' + e.id + '" data-id="' + e.id + '"') : '<span class="muted small">—</span>') }
      ], list, empty("Tiada program dalam skop anda.")) + "</section></div>";
  }

  /* ========== Paparan: DBKL Advertising ========== */
  function viewDbkl() {
    if (LIVE_USER) return viewDbklLive();
    const tabs = ["Permit", "Paparan Iklan", "Work Order", "Pemasangan", "Bukti"].concat(can("dbkl.contractors") ? ["Kontraktor"] : []);
    if (POLICY.scope === "self") tabs.sort((a, b) => (a === "Work Order" ? -1 : b === "Work Order" ? 1 : 0));
    if (!tabs.includes(f("dbkl.tab"))) state.filters["dbkl.tab"] = tabs[0];
    const tab = f("dbkl.tab"), permits = DAL.permits();
    const tile = (c) => '<div class="cat-tile"><strong>' + c + "</strong><span>" + permits.filter((p) => p.category === c).length + " permit · definisi kategori belum disahkan</span></div>";
    let body;
    if (tab === "Permit") body = table([{ h: "Permit", r: (p) => '<span class="tnum">' + p.id + "</span>" }, { h: "Kategori", r: (p) => p.category }, { h: "Kontraktor", r: (p) => esc(p.contractor) }, { h: "Lokasi", r: (p) => esc(p.place) }, { h: "Tamat", r: (p) => '<span class="tnum">' + fmtDate(p.expiry) + "</span>" }, { h: "Status", r: (p) => badge(permitStatus(p)) }], permits.slice().sort((a, b) => a.expiry.localeCompare(b.expiry)), empty("Tiada permit ditugaskan kepada anda."));
    else if (tab === "Paparan Iklan") body = table([{ h: "Paparan", r: (d) => d.id }, { h: "Permit", r: (d) => d.permit }, { h: "Kategori", r: (d) => d.category }, { h: "Kontraktor", r: (d) => esc(d.contractor) }, { h: "Lokasi", r: (d) => esc(d.place) }, { h: "Status Operasi", r: (d) => badge(d.status) }], DAL.displays(), empty("Tiada paparan ditugaskan kepada anda."));
    else if (tab === "Kontraktor") body = table([{ h: "ID", r: (c) => c.id }, { h: "Kontraktor", r: (c) => esc(c.name) }, { h: "Permit", num: true, r: (c) => permits.filter((p) => p.contractor === c.name).length }, { h: "Kerja Aktif", num: true, r: (c) => c.jobs }, { h: "Status", r: (c) => badge(c.status) }], DAL.contractors());
    else if (tab === "Pemasangan") body = table([{ h: "Rekod", r: (i) => i.id }, { h: "Work Order", r: (i) => i.wo }, { h: "Tarikh", r: (i) => fmtDate(i.date) }, { h: "Status", r: (i) => badge(i.status) }], DAL.installations(), empty("Tiada rekod pemasangan dalam skop anda."));
    else if (tab === "Bukti") body = note("Pratonton foto belum tersedia. Storan Google Drive belum disambung; hanya nama fail direkod.") + table([{ h: "Rekod", r: (i) => i.id }, { h: "Work Order", r: (i) => i.wo }, { h: "Fail", r: (i) => esc(i.file) }, { h: "Tarikh", r: (i) => fmtDate(i.date) }, { h: "Oleh", r: (i) => esc(i.by) }], DAL.evidence(), empty("Tiada bukti dalam skop anda."));
    else body = table([{ h: "Work Order", r: (w) => '<span class="tnum">' + w.id + "</span>" }, { h: "Permit", r: (w) => w.permit }, { h: "Kontraktor", r: (w) => esc(w.contractor) }, { h: "Kerja", r: (w) => esc(w.work) }, { h: "Tarikh", r: (w) => dueText(w.due, w.status === "Selesai") }, { h: "Status", r: (w) => badge(w.status) },
      { h: "Tindakan", r: (w) => (canUpdateWo(w) ? '<div class="row-actions">' + btn("Kemas Kini", "update-wo", "small", ' data-id="' + w.id + '"') + btn("Bukti", "new-evidence", "small", ' data-id="' + w.id + '"') + "</div>" : '<span class="muted small">—</span>') }], DAL.workOrders(), empty("Tiada work order ditugaskan kepada anda."));
    return pageHead("DBKL Advertising", "Modul operasi berasingan untuk kontraktor, permit, paparan iklan dan work order.", capBtn("dbkl.manage", "Daftar Permit DBKL", "new-permit", "primary")) +
      '<section class="panel">' + panelHead("Kategori Paparan") + '<div class="cat-tiles">' + ["R3", "R5", "R7"].map(tile).join("") + "</div></section>" +
      '<div class="grid" style="margin-top:16px"><section class="panel c12">' + panelHead(tab) + '<div class="toolbar">' + chips("dbkl.tab", tabs) + "</div>" + body + "</section></div>";
  }

  /* ========== Paparan: Documents & Reports ========== */
  function docBtn(d) { return '<button type="button" class="text-link" data-action="open-doc" data-id="' + d.id + '">' + esc(d.name) + "</button>"; }
  function viewDocuments() {
    const all = DAL.documents(), mode = f("documents.mode"), projects = DAL.projects().filter((p) => all.some((d) => d.project === p.id));
    const uploadBtn = capBtn("doc.upload", "Muat Naik Dokumen", "new-doc", "primary");
    const cols = [{ h: "Nama", r: docBtn }, { h: "Kategori", r: (d) => esc(d.category) }, { h: "Projek", r: (d) => esc(d.project ? projectName(d.project) : "Syarikat") }, { h: "Pemilik", r: (d) => esc(d.owner) }, { h: "Versi", r: (d) => "v" + d.version }, { h: "Tarikh", r: (d) => '<span class="tnum">' + fmtDate(d.date) + "</span>" }, { h: "Saiz", num: true, r: (d) => esc(d.size) }, { h: "Tindakan", r: (d) => btn("Muat turun", "dl-doc", "small", ' data-id="' + d.id + '"') }];
    const head = pageHead("Documents & Reports", "Dokumen projek dan pusat dokumen syarikat, dengan versi dan akses mengikut kebenaran.", uploadBtn) + '<div class="toolbar">' + chips("documents.mode", [["Central", "Central Document Centre"], ["Project", "Project Documents"]]) + "</div>";
    if (mode === "Project") {
      const pid = f("documents.project") || (projects[0] || {}).id || "";
      const list = all.filter((d) => d.project === pid);
      return head + '<section class="panel">' + panelHead("Project Documents", pid ? projectName(pid) : "Tiada projek") + '<div class="toolbar">' + filterSelect("documents.project", "Projek", projects.map((p) => [p.id, p.name])) + "</div>" +
        (pid ? docCategories().map((c) => { const items = list.filter((d) => d.category === c); return '<h3 class="sub-head" style="margin-top:12px">' + esc(c) + ' <span class="muted">(' + items.length + ")</span></h3>" + (items.length ? table(cols.filter((x) => x.h !== "Kategori" && x.h !== "Projek"), items) : '<p class="small muted">Tiada dokumen.</p>'); }).join("") : empty("Tiada projek dengan dokumen dalam skop anda.")) + "</section>";
    }
    const c = f("documents.category"), q = f("documents.q").toLowerCase(), proj = f("documents.projectFilter"), from = f("documents.from"), to = f("documents.to");
    const rows = all.filter((d) => (c === "Semua" || d.category === c) && (!q || d.name.toLowerCase().includes(q)) && (!proj || d.project === proj) && (!from || d.date >= from) && (!to || d.date <= to));
    return head + '<section class="panel">' + panelHead("Central Document Centre", rows.length + " daripada " + all.length + " dokumen") + note("Sampel DEV. Storan Google Drive belum disambung dan tiada pautan Drive sebenar digunakan.") +
      '<div class="toolbar">' + searchBox("documents.q", "Cari nama dokumen") + filterSelect("documents.projectFilter", "Projek", [["", "Semua projek"]].concat(DAL.projects().map((p) => [p.id, p.name]))) + filterDate("documents.from", "Dari") + filterDate("documents.to", "Hingga") + "</div>" +
      '<div class="toolbar">' + chips("documents.category", ["Semua"].concat(docCategories())) + "</div>" + table(cols, rows, empty("Tiada dokumen sepadan dengan penapis ini.", uploadBtn)) + "</section>";
  }
  function openDoc(id) {
    const d = DAL.documents().find((x) => x.id === id);
    if (!d) { toast("Dokumen ini tiada dalam skop akses anda."); return; }
    audit("Akses dokumen", "Dokumen", d.id, "BERJAYA", d.category === FINANCIAL_DOC ? "Dokumen kewangan" : d.category, d.category === FINANCIAL_DOC);
    openInfo({ title: d.name, actions: btn("Muat turun", "dl-doc", "primary", ' data-id="' + d.id + '"') + capBtn("doc.upload", "Versi Baharu", "doc-version", "", ' data-id="' + d.id + '"'), body:
      detailList([["ID", d.id], ["Kategori", esc(d.category)], ["Projek", esc(d.project ? projectName(d.project) : "Syarikat")], ["Pemilik", esc(d.owner)], ["Versi Semasa", "v" + d.version], ["Saiz", esc(d.size)]]) + '<h3 class="sub-head">Sejarah Versi</h3>' + timeline(d.versions.map((v) => ({ text: "Versi " + v.v, meta: fmtDate(v.date) + " · " + v.by })))
    });
  }

  /* ========== Paparan: Business Analytics ========== */
  function viewAnalytics() {
    // PM: hanya rekod yang dipautkan kepada projek dalam skopnya. Tiada angka kewangan atau analitik seluruh syarikat.
    const company = can("analytics.company"), projectIds = DAL.projects().map((p) => p.id);
    const tasks = company ? DAL.tasks() : DAL.tasks().filter((t) => projectIds.includes(t.project)), events = company ? DAL.events() : DAL.events().filter((e) => projectIds.includes(e.project));
    const n = +f("analytics.period"), labels = lastMonths(n), done = company ? D.tasksDone.slice(-n) : [];
    const byType = PROGRAM_TYPES.map((t) => ({ label: t, value: events.filter((e) => e.type === t).length }));
    const whoOpen = {}; tasks.filter((t) => !isTaskClosed(t)).forEach((t) => { whoOpen[t.primary] = (whoOpen[t.primary] || 0) + 1; });
    const load = Object.keys(whoOpen).map((k) => ({ label: k, value: whoOpen[k] })).sort((a, b) => b.value - a.value);
    const active = DAL.projects().filter((p) => p.status === "ACTIVE"), avg = Math.round(sum(active, (p) => p.progress) / (active.length || 1));
    return pageHead("Business Analytics", company ? "Trend prestasi tugasan, program dan projek." : "Prestasi operasi bagi projek anda sahaja.", capBtn("analytics.export", "Export CSV", "export-analytics", "primary")) +
      (company ? '<div class="toolbar">' + chips("analytics.period", [["6", "6 bulan"], ["12", "12 bulan"]]) + '</div><div class="grid"><section class="panel c8">' + panelHead("Tugasan Diselesaikan", "Bilangan sebulan") + columnChart({ labels, series: [{ name: "Tugasan selesai", values: done }], fmtAxis: (v) => String(Math.round(v)), fmtTip: (v) => v + " tugasan", ariaLabel: "Tugasan diselesaikan sebulan, data contoh" }) + "</section>" +
      '<section class="panel c4">' + panelHead("Ringkasan") + '<p class="sub-head">Purata kemajuan projek aktif</p><p class="kpi-value">' + avg + '%</p><p class="sub-head" style="margin-top:16px">Jumlah tugasan selesai</p><p class="kpi-value">' + sum(done) + '</p><p class="small muted">Dalam ' + n + " bulan terakhir.</p></section></div>" : note("Analitik operasi bagi " + projectIds.length + " projek dalam skop anda sahaja. Tiada angka kewangan atau analitik seluruh syarikat.") +
        '<div class="grid"><section class="panel c4">' + panelHead("Ringkasan Projek Saya") + '<p class="sub-head">Purata kemajuan projek aktif</p><p class="kpi-value">' + avg + '%</p><p class="small muted">' + active.length + " projek aktif</p></section>" +
        '<section class="panel c4">' + panelHead("Status Jadual", "Projek aktif") + barList(SCHEDULE.map((s) => ({ label: s, value: active.filter((p) => p.schedule === s).length, tone: s === "DELAYED" ? "bad" : s === "AT RISK" ? "warn" : "" })), "Projek aktif mengikut status jadual") + "</section>" +
        '<section class="panel c4">' + panelHead("Tugasan Projek", tasks.length + " tugasan") + barList(TASK_STATUS.map((s) => ({ label: s, value: tasks.filter((t) => t.status === s).length, tone: s === "BLOCKED" ? "bad" : "" })), "Tugasan projek mengikut status") + "</section></div>") +
      '<div class="grid"><section class="panel c6">' + panelHead("Program Mengikut Jenis") + barList(byType, "Program mengikut jenis") + "</section>" +
      '<section class="panel c6">' + panelHead("Beban Tugasan Terbuka", "Mengikut penerima utama") + barList(load, "Tugasan terbuka mengikut staf") + "</section></div>";
  }

  /* ========== Paparan: Financial Analytics ========== */
  const FIN_TABS = ["Project Costing", "Income & Revenue", "Expenses", "Contractor Payments", "Profit & Loss", "Financial Reports", "Budget Monitoring"];
  // Maker-Checker: pencipta transaksi tidak boleh meluluskan transaksinya sendiri.
  function txAction(kind, tx) {
    if (tx.status !== "Menunggu Kelulusan") return '<span class="muted small">Selesai</span>';
    if (!can("finance.approve")) return '<span class="muted small">—</span>';
    if (tx.maker === me) return '<span class="muted small">Pencipta tidak boleh lulus</span>';
    return btn("Lulus", "approve-tx", "small primary", ' id="tx-' + tx.id + '" data-kind="' + kind + '" data-id="' + tx.id + '"');
  }
  function viewFinance() {
    if (!DAL.finance()) return pageHead("Financial Analytics", "", "") + empty("Data kewangan tidak dapat dimuatkan.");
    const tab = f("finance.tab"), n = +f("finance.period"), w = finWindow(n);
    const rev = sum(w, (r) => r.rev), exp = sum(w, (r) => r.exp), bud = budget(), projects = financeProjects();
    const totalRow = (o) => Object.assign({ _total: true }, o);
    let body = "";
    if (tab === "Project Costing") {
      body = table([{ h: "Projek", r: (p) => esc(p.name) }, { h: "Belanjawan", num: true, r: (p) => money(p._total ? p.budget : projFin(p).budget) }, { h: "Kos Semasa", num: true, r: (p) => money(p._total ? p.cost : projFin(p).cost) }, { h: "Baki", num: true, r: (p) => money(p._total ? p.budget - p.cost : projFin(p).budget - projFin(p).cost) }], projects.concat([totalRow({ name: "Jumlah", budget: bud.budget, cost: bud.cost })]));
    } else if (tab === "Income & Revenue") {
      body = '<div class="toolbar">' + capBtn("finance.write", "+ Rekod Pendapatan", "new-income", "primary") + "</div>" + columnChart({ labels: w.map((r) => r.label), series: [{ name: "Pendapatan", values: w.map((r) => r.rev) }], fmtAxis: axisRM, fmtTip: money, ariaLabel: "Pendapatan bulanan, data contoh" }) +
        '<p class="sub-head" style="margin-top:20px">Transaksi terkini</p>' + table([{ h: "ID", r: (e) => e.id }, { h: "Tarikh", r: (e) => fmtDate(e.date) }, { h: "Keterangan", r: (e) => esc(e.desc) }, { h: "Pencipta", r: (e) => esc(e.maker) }, { h: "Amaun", num: true, r: (e) => money(e.amount) }, { h: "Status", r: (e) => badge(e.status) }, { h: "Tindakan", r: (e) => txAction("income", e) }], F.incomes);
    } else if (tab === "Expenses") {
      body = '<div class="toolbar">' + capBtn("finance.write", "+ Rekod Perbelanjaan", "new-expense", "primary") + "</div>" + table([{ h: "Bulan", r: (r) => esc(r.label) }, { h: "Kos Projek", num: true, r: (r) => money(r.projek) }, { h: "Kontraktor", num: true, r: (r) => money(r.kontraktor) }, { h: "Operasi", num: true, r: (r) => money(r.operasi) }, { h: "Jumlah", num: true, r: (r) => money(r.exp) }],
        w.concat([totalRow({ label: "Jumlah", projek: sum(w, (r) => r.projek), kontraktor: sum(w, (r) => r.kontraktor), operasi: sum(w, (r) => r.operasi), exp })])) +
        '<p class="sub-head" style="margin-top:20px">Transaksi terkini</p>' + table([{ h: "ID", r: (e) => e.id }, { h: "Tarikh", r: (e) => fmtDate(e.date) }, { h: "Kategori", r: (e) => esc(e.category) }, { h: "Keterangan", r: (e) => esc(e.desc) }, { h: "Pencipta", r: (e) => esc(e.maker) }, { h: "Amaun", num: true, r: (e) => money(e.amount) }, { h: "Status", r: (e) => badge(e.status) }, { h: "Tindakan", r: (e) => txAction("expense", e) }], F.expenses);
    } else if (tab === "Contractor Payments") {
      body = table([{ h: "ID", r: (p) => p.id }, { h: "Kontraktor", r: (p) => esc(p.contractor) }, { h: "Work Order", r: (p) => p.wo }, { h: "Bank (bertopeng)", r: (p) => esc(p.bank) }, { h: "Tarikh", r: (p) => fmtDate(p.date) }, { h: "Pencipta", r: (p) => esc(p.maker) }, { h: "Amaun", num: true, r: (p) => money(p.amount) }, { h: "Status", r: (p) => badge(p.status) }, { h: "Tindakan", r: (p) => txAction("payment", p) }], F.payments);
    } else if (tab === "Profit & Loss") {
      body = table([{ h: "Bulan", r: (r) => esc(r.label) }, { h: "Pendapatan", num: true, r: (r) => money(r.rev) }, { h: "Perbelanjaan", num: true, r: (r) => money(r.exp) }, { h: "Untung Bersih", num: true, r: (r) => money(r.rev - r.exp) }, { h: "Margin", num: true, r: (r) => pct(r.rev - r.exp, r.rev) + "%" }], w.concat([totalRow({ label: "Jumlah", rev, exp })]));
    } else if (tab === "Financial Reports") {
      body = table([{ h: "Laporan", r: (r) => esc(r[0]) }, { h: "Tempoh", r: () => n + " bulan terakhir" }, { h: "Format", r: () => "CSV" }, { h: "Tindakan", r: (r) => capBtn("finance.export", "Muat turun", "export-fin", "small", ' data-id="' + r[1] + '"') }], [["Penyata Untung Rugi", "pl"], ["Kos Projek", "cost"], ["Perbelanjaan Bulanan", "exp"], ["Bayaran Kontraktor", "pay"]]);
    } else {
      body = '<dl class="stats" style="margin-bottom:20px"><div class="stat"><dt>Belanjawan</dt><dd>' + money(bud.budget) + '</dd></div><div class="stat"><dt>Kos semasa</dt><dd>' + money(bud.cost) + '</dd></div><div class="stat"><dt>Baki</dt><dd>' + money(bud.left) + "</dd></div></dl>" +
        table([{ h: "Projek", r: (p) => esc(p.name) }, { h: "Penggunaan", r: (p) => { const st = budgetState(p), x = projFin(p); return progress(pct(x.cost, x.budget), st === "Dalam Had" ? "" : st === "Hampir Had" ? "warn" : "bad"); } }, { h: "Baki", num: true, r: (p) => money(projFin(p).budget - projFin(p).cost) }, { h: "Status", r: (p) => badge(budgetState(p)) }], projects.slice().sort((a, b) => projFin(b).cost / (projFin(b).budget || 1) - projFin(a).cost / (projFin(a).budget || 1)));
    }
    return pageHead("Financial Analytics", "Kos projek, pendapatan, perbelanjaan, bayaran kontraktor dan belanjawan.", "") +
      '<section class="panel">' + panelHead("Ringkasan Kewangan", n + " bulan terakhir", chips("finance.period", [["6", "6 bulan"], ["12", "12 bulan"]])) +
      '<dl class="stats"><div class="stat"><dt>Pendapatan</dt><dd>' + money(rev) + '</dd></div><div class="stat"><dt>Perbelanjaan</dt><dd>' + money(exp) + '</dd></div><div class="stat"><dt>Untung bersih</dt><dd>' + money(rev - exp) + '</dd></div><div class="stat"><dt>Baki belanjawan</dt><dd>' + money(bud.left) + "</dd></div></dl></section>" +
      '<div class="grid" style="margin-top:16px"><section class="panel c12">' + panelHead(tab) + '<div class="toolbar">' + chips("finance.tab", FIN_TABS) + "</div>" + body + "</section></div>";
  }

  /* ========== Paparan: User & Access Management ========== */
  // Setiap baris dikira terus daripada PERMISSIONS, jadi matriks sentiasa sepadan dengan konfigurasi sebenar frontend.
  const has = (p, c) => p.caps.includes(c);
  const routeLabels = { dashboard: "Dashboard", workspace: "Workspace", projects: "Projek", tasks: "Tugasan", programs: "Program", dbkl: "DBKL", documents: "Dokumen", analytics: "Analytics", finance: "Kewangan", access: "Akses & Audit", staff: "Direktori Staf", notifications: "Notifikasi", settings: "Settings" };
  const MATRIX_ROWS = [
    ["Mod akses", (p) => (p.caps.length ? "Baca & tulis ikut kebenaran" : "Baca sahaja, ringkasan agregat")],
    ["Halaman dibenarkan", (p) => p.routes.map((r) => routeLabels[r]).join(", ")],
    ["Dashboard", (p) => ({ executive: "Executive", management: "Management", pm: "Project Manager", staff: "Staff", viewer: "Ringkasan" }[p.dashboard])],
    ["Skop data", (p) => ({ company: "Seluruh syarikat", assigned: "Projek ditugaskan", self: "Ditugaskan sendiri", summary: "Ringkasan agregat" }[p.scope])],
    ["Lihat data kewangan", (p) => (has(p, "finance.view") ? "Ya" : "Tidak (data tidak dimuatkan)")],
    ["Rekod / lulus transaksi kewangan", (p) => (has(p, "finance.approve") ? "Ya, kecuali transaksi sendiri" : has(p, "finance.write") ? "Rekod sahaja" : "—")],
    ["Export kewangan", (p) => (has(p, "finance.export") ? "Ya" : "—")],
    ["Business Analytics", (p) => (has(p, "analytics.company") ? "Seluruh syarikat" : p.routes.includes("analytics") ? "Operasi projek sendiri, tanpa kewangan" : "—")],
    ["Mohon projek", (p) => (has(p, "project.request") ? "Ya (PENDING APPROVAL)" : "—")],
    ["Lulus / tolak permohonan projek", (p) => (has(p, "project.approve") ? "Ya, kecuali permohonan sendiri" : "—")],
    ["Lulus tugasan", (p) => ({ all: "Semua", "own-projects": "Projek sendiri", "if-reviewer": "Hanya jika pemberi / penyemak", none: "—" }[p.taskApprove])],
    ["Beri tugasan", (p) => (has(p, "task.assign") ? "Ya" : "—")],
    ["Terima / tolak tugasan", (p) => (has(p, "task.respond") ? "Ya, tolak wajib bersebab" : "—")],
    ["Dokumen", (p) => (has(p, "doc.upload") ? "Lihat & muat naik" + (has(p, "finance.view") ? ", termasuk kewangan" : ", tanpa kewangan") : "—")],
    ["Urus pengguna & tukar role", (p) => (has(p, "users.manage") ? "Ya" : "—")],
    ["Lantik / gugur Super Admin", (p) => (has(p, "superadmin.manage") ? "Ya, seorang demi seorang, sebab wajib" : "—")],
    ["Log Audit", (p) => ({ full: "Penuh", restricted: "Terhad (tanpa sesi & akses)", none: "—" }[p.audit])],
    ["Company Settings", (p) => (p.routes.includes("settings") ? "Ya" : "—")]
  ];
  // Status sebenar penguatkuasaan dalam build DEV ini. Tiada backend disambung.
  const ENFORCEMENT_ROWS = [
    ["Menu dan halaman ikut role", "Simulasi frontend", "Pengawal laluan menolak navigasi terus dan merekod audit. Boleh dipintas melalui DevTools."],
    ["Butang dan tindakan ikut role", "Simulasi frontend", "ACTION_CAPS disemak sebelum setiap tindakan dalam browser."],
    ["Skop data (DAL)", "Simulasi frontend", "Data operasi contoh masih ada dalam app.js untuk semua role; hanya paparan ditapis."],
    ["Data kewangan", "Simulasi frontend", "Fail data kewangan hanya diminta untuk SUPER ADMIN dan MANAGEMENT, tetapi fail itu masih boleh dibuka terus melalui laluannya."],
    ["Maker-Checker kewangan", "Simulasi frontend", "Pencipta tidak boleh meluluskan transaksinya sendiri dalam UI ini."],
    ["Kelulusan projek", "Simulasi frontend", "Hanya MANAGEMENT, dan bukan pemohon sendiri."],
    ["Audit append-only", "Simulasi frontend", "Rekod dibekukan dan tiada kawalan ubah atau padam, tetapi disimpan dalam sessionStorage tab."],
    ["Login dan sesi", "Belum wujud", "Pemilih DEV DEMO ONLY sahaja. Tiada pengesahan identiti."],
    ["Penguatkuasaan backend", "Belum disambung", "Semua kawalan di atas mesti dilaksanakan semula di API / Apps Script sebelum data sebenar digunakan."]
  ];
  /* ========== Pengguna & password (mod LIVE) ========== */
  function liveChangePassword() {
    openForm({ live: true, title: "Tukar Password", submit: "Tukar Password", intro: note("Minimum 10 aksara, dengan huruf dan nombor. Sesi lain akan dilog keluar."), fields: [
      { name: "lama", label: "Password semasa", type: "password", required: true, maxlength: 200, full: true },
      { name: "baru", label: "Password baharu", type: "password", required: true, maxlength: 200, full: true },
      { name: "sah", label: "Sahkan password baharu", type: "password", required: true, maxlength: 200, full: true }
    ], onSubmit: async (d) => {
      if (d.baru !== d.sah) { toast("Pengesahan password tidak sepadan."); return; }
      try { await LIVE.api("auth.changePassword", { lama: d.lama, baru: d.baru }); toast("Password berjaya ditukar."); }
      catch (e) { toast(e.message || "Gagal menukar password."); }
    } });
  }
  function liveResetPassword(emel, nama) {
    openForm({ live: true, title: "Reset Password: " + nama, submit: "Reset Password", intro: note("Password sementara akan dijana. Pengguna wajib menukarnya semasa log masuk seterusnya, dan sesi mereka sekarang akan ditamatkan."), fields: [
      { name: "sahkan", label: "Saya akan menyampaikan password sementara kepada " + nama + " secara peribadi", type: "confirm", required: true }
    ], onSubmit: async () => {
      try {
        const o = await LIVE.api("users.resetPassword", { emel: emel });
        openInfo({ title: "Password sementara: " + o.nama, body: '<p class="small muted">Sampaikan secara peribadi (bukan dalam group). Paparan ini tidak akan ditunjukkan semula.</p><p class="temp-pw tnum">' + esc(o.passwordSementara) + "</p>" + note("Pengguna akan diminta menukar password ini semasa log masuk.") });
        LD.users = null; liveLoadUsers();
      } catch (e) { toast(e.message || "Gagal reset password."); }
    } });
  }
  function liveLoadUsers() {
    if (LD.busyUsers) return; LD.busyUsers = true;
    LIVE.api("users.list").then((o) => { LD.users = o; LD.errUsers = null; }).catch((e) => { LD.errUsers = e.message; }).finally(() => { LD.busyUsers = false; if (currentRoute() === "access") refresh(); });
  }
  function viewAccessLive() {
    const head = pageHead("Pengguna & Akses", "Akaun DEV daripada SCE-DEV-AUTH. Pendaftaran akaun baharu masih melalui Sheet oleh SUPER ADMIN.", liveTagDev);
    if (LIVE_USER.role !== "SUPER_ADMIN") return head + note("Hanya SUPER ADMIN boleh mengurus pengguna dan reset password.");
    if (LD.errUsers) return head + '<section class="panel"><div class="empty"><p>' + esc(LD.errUsers) + "</p></div></section>";
    if (!LD.users) { liveLoadUsers(); return head + '<section class="panel"><div class="empty" role="status"><p>Memuatkan pengguna…</p></div></section>'; }
    const d = LD.users;
    return head + (d.sedia ? "" : note("Reset password belum disediakan (SCE-DEV-CREDENTIALS belum dicipta).")) +
      '<section class="panel">' + panelHead("Pengguna", d.pengguna.length + " akaun", "", liveTagDev) + table([
        { h: "Nama", r: (u) => esc(u.nama) }, { h: "Emel", r: (u) => esc(u.emel) }, { h: "Role", r: (u) => esc(LIVE.roleLabel(u.role)) }, { h: "Jawatan", r: (u) => esc(u.jawatan || "—") },
        { h: "Status", r: (u) => badge(u.status === "AKTIF" ? "Aktif" : "Tidak Aktif") },
        { h: "Password", r: (u) => (u.mestiTukar ? '<span class="badge warn">Mesti tukar</span>' : u.passwordDikemaskini ? '<span class="small muted">Ditukar ' + fmtDateTime(u.passwordDikemaskini) + "</span>" : '<span class="small muted">Asal</span>') },
        { h: "Tindakan", r: (u) => (u.emel === d.saya ? '<button type="button" class="btn small" data-action="lt-pw">Tukar password</button>' : d.sedia && u.status === "AKTIF" ? '<button type="button" class="btn small" data-action="lt-reset" data-emel="' + esc(u.emel) + '" data-nama="' + esc(u.nama) + '">Reset password</button>' : "—") }
      ], d.pengguna) + "</section>";
  }

  function viewAccess() {
    if (LIVE_USER) return viewAccessLive();
    const tabs = [].concat(can("users.manage") ? ["Pengguna"] : [], can("roles.view") ? ["Role & Permission"] : [], POLICY.audit !== "none" ? ["Audit Log"] : []);
    if (!tabs.includes(f("access.tab"))) state.filters["access.tab"] = tabs[0];
    const tab = f("access.tab");
    let body;
    if (tab === "Pengguna") {
      const lastSa = activeSuperAdmins().length <= 1;
      body = note("Perubahan role berkuat kuasa selepas sesi dimuat semula. Super Admin terakhir yang aktif dilindungi.") + table([{ h: "Nama", r: (u) => esc(u.name) + (u.name === me ? ' <span class="muted small">(anda)</span>' : "") }, { h: "Jawatan", r: (u) => esc(u.title) }, { h: "Role", r: (u) => esc(u.role) }, { h: "Status", r: (u) => badge(u.status) },
        { h: "Tindakan", r: (u) => {
          const i = D.users.indexOf(u), acts = [];
          const protectedSa = u.role === "SUPER ADMIN" && u.status === "Aktif" && lastSa;
          if (can("superadmin.manage") && u.role === "MANAGEMENT" && u.status === "Aktif") acts.push(btn("Lantik Super Admin", "appoint-sa", "small", ' id="sa-' + i + '" data-i="' + i + '"'));
          if (can("superadmin.manage") && u.role === "SUPER ADMIN" && !protectedSa) acts.push(btn("Gugur Super Admin", "remove-sa", "small", ' id="rsa-' + i + '" data-i="' + i + '"'));
          if (u.role !== "SUPER ADMIN") acts.push(btn("Tukar Role", "change-role", "small", ' id="cr-' + i + '" data-i="' + i + '"'));
          if (u.name !== me && !protectedSa) acts.push(btn(u.status === "Aktif" ? "Nyahaktif" : "Aktifkan", "toggle-user", "small", ' id="usr-' + i + '" data-i="' + i + '"'));
          if (protectedSa) acts.push('<span class="muted small">Super Admin terakhir dilindungi</span>');
          return '<div class="row-actions">' + acts.join("") + "</div>";
        } }], D.users);
    } else if (tab === "Role & Permission") {
      body = '<p class="small muted" style="margin-bottom:12px">Dijana terus daripada konfigurasi kebenaran berpusat (PERMISSIONS) yang digunakan oleh menu, laluan dan butang. MANAGEMENT tidak mewarisi kebenaran Super Admin.</p>' + table([{ h: "Kebenaran", r: (r) => esc(r[0]) }].concat(ROLES.map((role) => ({ h: role, r: (r) => esc(r[1](PERMISSIONS[role])) }))), MATRIX_ROWS) +
        '<h3 class="sub-head" style="margin-top:20px">Status Penguatkuasaan</h3>' + note("Build DEV ini tiada backend. Semua kawalan ialah simulasi frontend dan belum dikuatkuasakan oleh pelayan.") +
        table([{ h: "Kawalan", r: (r) => esc(r[0]) }, { h: "Status", r: (r) => '<span class="badge ' + (r[1] === "Simulasi frontend" ? "warn" : "bad") + '">' + esc(r[1]) + "</span>" }, { h: "Catatan", r: (r) => esc(r[2]) }], ENFORCEMENT_ROWS);
    } else {
      const all = DAL.audit(), mod = f("audit.module"), who = f("audit.user"), from = f("audit.from"), to = f("audit.to"), q = f("audit.q").toLowerCase();
      const modules = unique(all.map((a) => a.module)).sort(), actors = unique(all.map((a) => a.actor)).sort();
      const badRange = from && to && from > to;
      const rows = badRange ? [] : all.filter((a) => { const day = tzDay(a.at); return (mod === "Semua" || a.module === mod) && (who === "Semua" || a.actor === who) && (!from || day >= from) && (!to || day <= to) && (!q || (a.action + " " + a.ref + " " + a.actor + " " + a.details).toLowerCase().includes(q)); });
      const active = mod !== "Semua" || who !== "Semua" || from || to || q;
      body = note(POLICY.audit === "full" ? "Log audit ialah append-only. Tiada kawalan untuk mengubah atau memadam rekod dalam aplikasi." : "Akses terhad: rekod sesi dan pengurusan akses tidak dipaparkan. Log ialah append-only dan tidak boleh diubah atau dipadam.") +
        '<div class="toolbar audit-filters">' + searchBox("audit.q", "Cari tindakan, rujukan atau pengguna") + filterSelect("audit.module", "Modul", [["Semua", "Semua modul"]].concat(modules.map((m) => [m, m]))) + filterSelect("audit.user", "Pengguna", [["Semua", "Semua pengguna"]].concat(actors.map((m) => [m, m]))) + filterDate("audit.from", "Dari") + filterDate("audit.to", "Hingga") +
        (active ? btn("Kosongkan penapis", "audit-clear", "small") : "") + "</div>" +
        (badRange ? '<p class="field-err" role="alert">Tarikh "Dari" mesti sebelum atau sama dengan tarikh "Hingga".</p>' : '<p class="small muted" style="margin-bottom:8px">' + rows.length + " daripada " + all.length + " rekod · masa dalam GMT+8</p>") +
        table([{ h: "Masa", r: (a) => '<span class="tnum">' + fmtDateTime(a.at) + "</span>" }, { h: "Pengguna", r: (a) => esc(a.actor) + '<div class="task-meta">' + esc(a.role || "") + "</div>" }, { h: "Tindakan", r: (a) => esc(a.action) }, { h: "Modul", r: (a) => esc(a.module) }, { h: "Rujukan", r: (a) => '<span class="tnum">' + esc(a.ref) + "</span>" }, { h: "Keputusan", r: (a) => badge(a.result) }, { h: "Butiran", r: (a) => esc(a.details || "—") }], rows);
    }
    return pageHead("User & Access Management", "Akaun pengguna, role, kebenaran dan log audit.", capBtn("users.manage", "+ Pengguna Baharu", "new-user", "primary")) +
      '<section class="panel">' + panelHead(tab) + '<div class="toolbar">' + chips("access.tab", tabs) + "</div>" + body + "</section>";
  }

  /* ========== Paparan: Staff Directory ========== */
  function viewStaff() {
    const dp = f("staff.dept"), q = f("staff.q").toLowerCase(), users = DAL.users();
    const rows = users.filter((s) => (dp === "Semua" || s.dept === dp) && (!q || (s.name + s.title).toLowerCase().includes(q)));
    return pageHead("Staff Directory", "Direktori kakitangan mengikut jabatan.", "") +
      '<div class="toolbar">' + searchBox("staff.q", "Cari nama atau jawatan") + chips("staff.dept", ["Semua"].concat(unique(users.map((u) => u.dept)))) + demoTag + "</div>" +
      (rows.length ? '<div class="people">' + rows.map((s) => '<article class="person"><span class="avatar" aria-hidden="true">' + esc(s.name.charAt(0)) + "</span><div><h3>" + esc(s.name) + "</h3><p>" + esc(s.title) + " · " + esc(s.dept) + "</p><p>" + esc(s.email) + "</p></div></article>").join("") + "</div>" : '<section class="panel">' + empty("Tiada staf sepadan dengan carian ini.") + "</section>");
  }

  /* ========== Paparan: Notification Centre ========== */
  function viewNotifications() {
    const all = DAL.notifications(), v = f("notifications.view"), rows = all.filter((n) => v === "Semua" || !n.readBy.includes(me));
    return pageHead("Notification Centre", "Notifikasi yang ditujukan kepada anda sahaja.", btn("Tandai semua dibaca", "read-all")) +
      '<section class="panel">' + panelHead("Notifikasi", all.filter((n) => !n.readBy.includes(me)).length + " belum dibaca") + note("Saluran emel ialah placeholder DEV dan belum disambung. Tiada emel dihantar.") + '<div class="toolbar">' + chips("notifications.view", ["Semua", "Belum Dibaca"]) + "</div>" +
      table([{ h: "Masa", r: (n) => '<span class="tnum">' + fmtDateTime(n.at) + "</span>" }, { h: "Notifikasi", r: (n) => '<button type="button" class="text-link" data-action="open-notif" data-id="' + esc(n.id) + '">' + esc(n.title) + '</button><div class="task-meta">' + esc(n.sub) + "</div>" }, { h: "Saluran", r: () => 'In-App · <span class="muted">Emel belum disambung</span>' }, { h: "Status", r: (n) => badge(n.readBy.includes(me) ? "Dibaca" : "Belum Dibaca") }], rows, empty("Tiada notifikasi.")) + "</section>";
  }

  /* ========== Paparan: Company Settings ========== */
  function viewSettings() {
    const s = D.settings;
    const check = (name, label) => '<label class="check-row"><input type="checkbox" name="' + name + '"' + (s[name] ? " checked" : "") + "> " + esc(label) + "</label>";
    return pageHead("Company Settings", "Tetapan paparan dan ambang amaran untuk build DEV ini.", "") +
      '<section class="panel">' + panelHead("Tetapan Umum", "Disimpan dalam sesi tab ini sahaja") +
      '<form id="settings-form" data-submit="settings" novalidate><div class="form-grid">' +
      '<div class="field full"><label for="set-company">Nama syarikat <span class="req">*</span></label><input id="set-company" name="company" required maxlength="80" value="' + esc(s.company) + '"><span class="field-err" hidden></span></div>' +
      '<div class="field"><label for="set-permit">Amaran permit (hari sebelum tamat) <span class="req">*</span></label><input id="set-permit" name="permitDays" type="number" required min="1" max="365" value="' + s.permitDays + '"><span class="field-err" hidden></span></div>' +
      (can("finance.view") ? '<div class="field"><label for="set-budget">Amaran belanjawan (% digunakan) <span class="req">*</span></label><input id="set-budget" name="budgetWarn" type="number" required min="1" max="100" value="' + s.budgetWarn + '"><span class="field-err" hidden></span></div>' : "") +
      '<div class="field"><label for="set-tz">Zon waktu</label><input id="set-tz" value="GMT+8 (Asia/Kuala_Lumpur)" disabled></div>' +
      '<div class="field"><label for="set-cur">Mata wang</label><input id="set-cur" value="Ringgit Malaysia (RM)" disabled></div>' +
      '<div class="field full"><span class="field-label">Notifikasi dalam aplikasi</span>' + check("notifTasks", "Tugasan dan tarikh akhir") + check("notifPermits", "Permit hampir tamat") + check("notifEvents", "Event dalam 3 hari") + "</div>" +
      '<div class="field full"><span class="field-label">Saluran emel</span><span class="field-help">Belum disambung. Placeholder DEV sahaja; tiada emel dihantar. WhatsApp tidak dilaksanakan.</span></div>' +
      '</div><div style="margin-top:20px"><button type="submit" class="btn primary">Simpan Tetapan</button></div></form></section>';
  }

  /* ========== Router ========== */
  /* Core Scope v1.0 (P1-4): enam modul utama + Tetapan berasingan.
   * Laluan lama (workspace, programs, dbkl, analytics, notifications) dikekalkan tetapi tidak dipaparkan dalam sidebar.
   * Finance disorok dari sidebar dalam fasa pertama (keputusan pemilik D1); dalam mod LIVE laluannya ditolak. */
  function viewOperations() {
    const tabs = [["programs", "Program & Sesi"], ["dbkl", "DBKL Signboard"]].filter(([r]) => canRoute(r));
    if (!tabs.length) return viewDenied();
    if (!tabs.some(([r]) => r === f("ops.tab"))) state.filters["ops.tab"] = tabs[0][0];
    return '<div class="toolbar ops-tabs" aria-label="Kategori operasi">' + chips("ops.tab", tabs) + "</div>" + (f("ops.tab") === "dbkl" ? viewDbkl() : viewPrograms());
  }
  const NAV = [
    ["Modul", [["dashboard", "Dashboard", viewDashboard], ["projects", "Projects", viewProjects], ["tasks", "Tasks", viewTasks], ["operations", "Operations", viewOperations], ["finance", "Finance", viewFinance], ["documents", "Documents", viewDocuments]]],
    ["Tetapan", [["access", "Pengguna & Akses", viewAccess], ["staff", "Direktori Staf", viewStaff], ["settings", "Tetapan Sistem", viewSettings]]]
  ];
  const NAV_SOROK = ["finance"];
  const ROUTES = {
    notifications: { label: "Notification Centre", view: viewNotifications },
    workspace: { label: "My Workspace", view: viewWorkspace },
    programs: { label: "Operations · Program & Sesi", view: viewPrograms },
    dbkl: { label: "Operations · DBKL Signboard", view: viewDbkl },
    analytics: { label: "Business Analytics", view: viewAnalytics }
  };
  NAV.forEach(([, items]) => items.forEach(([id, label, view]) => { ROUTES[id] = { label, view }; }));
  const navRouteOf = (r) => (["programs", "dbkl"].includes(r) ? "operations" : r === "workspace" ? "dashboard" : r);

  const content = $("#content");
  const currentRoute = () => { const r = location.hash.replace("#", ""); return ROUTES[r] ? r : "dashboard"; };
  const viewDenied = () => '<section class="panel denied"><h1>Akses Ditolak</h1><p>Akaun anda tidak mempunyai kebenaran untuk membuka halaman ini.</p><a class="btn primary" href="#dashboard">Kembali ke Dashboard</a></section>';

  function renderChrome(route, label) {
    $("#nav").querySelectorAll("a").forEach((a) => {
      if (a.dataset.route === navRouteOf(route)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    $("#crumb-page").textContent = label;
    $("#brand-company").textContent = D.settings.company;
    document.title = label + " · SCE CENTRAL";
    renderNotifs();
  }
  function render(isNav) {
    const route = currentRoute();
    if (!canRoute(route)) {
      if (isNav) audit("Akses halaman ditolak", "Akses", route, "DITOLAK", "Navigasi terus ke halaman tanpa kebenaran");
      content.innerHTML = viewDenied();
      renderChrome(null, "Akses Ditolak");
      return;
    }
    if (isNav && route === "finance") audit("Akses data sensitif", "Kewangan", "Financial Analytics", "BERJAYA", "Membuka modul kewangan", true);
    content.innerHTML = ROUTES[route].view();
    renderChrome(route, ROUTES[route].label);
    if (state.pendingOpen) {
      const p = state.pendingOpen; state.pendingOpen = null;
      if (p.type === "tasks") openTask(p.ref); else if (p.type === "projects") openProject(p.ref);
    }
  }
  // Lukis semula tanpa hilang kedudukan skrol atau fokus.
  function refresh() {
    const active = document.activeElement, id = active && active.id, caret = active && active.selectionStart;
    const y = window.scrollY;
    save();
    render(false);
    window.scrollTo(0, y);
    const next = id && document.getElementById(id);
    if (next && next !== document.body) {
      next.focus({ preventScroll: true });
      if (caret != null && next.setSelectionRange && next.type === "search") { try { next.setSelectionRange(caret, caret); } catch (e) { /* input tanpa caret */ } }
    }
  }
  function navigate(route) {
    if (currentRoute() === route && location.hash) refresh(); else location.hash = route;
  }

  /* ========== Modal & borang ========== */
  const modal = $("#modal");
  const closeModal = () => { if (modal.open) modal.close(); };
  const modalHead = (title) => '<div class="modal-head"><h2 id="modal-title">' + esc(title) + '</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Tutup">' + icon("close") + "</button></div>";
  function openInfo(cfg) {
    closeModal();
    modal.innerHTML = modalHead(cfg.title) + '<div class="modal-body">' + cfg.body + '</div><div class="modal-foot">' + (cfg.actions || "") + '<button type="button" class="btn" data-action="close-modal">Tutup</button></div>';
    modal.showModal();
  }
  function openForm(cfg) {
    closeModal();
    const fields = cfg.fields.map((fd, i) => {
      const id = "fld-" + i, req = fd.required ? " required" : "", full = fd.full ? " full" : "";
      const attrs = id + '" name="' + fd.name + '"' + req + (fd.min != null ? ' min="' + fd.min + '"' : "") + (fd.max != null ? ' max="' + fd.max + '"' : "") + (fd.step ? ' step="' + fd.step + '"' : "") + (fd.maxlength ? ' maxlength="' + fd.maxlength + '"' : "");
      let ctl;
      if (fd.type === "confirm") return '<div class="field full"><label class="check-row" for="' + id + '"><input id="' + id + '" name="' + fd.name + '" type="checkbox"' + req + "> " + esc(fd.label) + (fd.required ? ' <span class="req">*</span>' : "") + '</label><span class="field-err" hidden></span></div>';
      if (fd.type === "select" || fd.type === "multiselect") ctl = '<select id="' + attrs + (fd.type === "multiselect" ? " multiple" : "") + ">" + (fd.options || []).map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(fd.value) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select>";
      else if (fd.type === "textarea") ctl = '<textarea id="' + attrs + ">" + esc(fd.value || "") + "</textarea>";
      else ctl = '<input id="' + attrs + ' type="' + (fd.type || "text") + '"' + (fd.type === "file" ? "" : ' value="' + esc(fd.value == null ? "" : fd.value) + '"') + ">";
      return '<div class="field' + full + '"><label for="' + id + '">' + esc(fd.label) + (fd.required ? ' <span class="req">*</span>' : "") + "</label>" + ctl + (fd.help ? '<span class="field-help">' + esc(fd.help) + "</span>" : "") + '<span class="field-err" hidden></span></div>';
    }).join("");
    modal.innerHTML = "<form novalidate>" + modalHead(cfg.title) + '<div class="modal-body">' + (cfg.intro || "") + (cfg.live ? note("Rekod sebenar DEV: disimpan dalam SCE-DEV-TASKS dan direkod dalam audit.") : note("Data contoh. Rekod disimpan dalam sesi tab ini sahaja.")) + '<div class="form-grid">' + fields + '</div></div><div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Batal</button><button type="submit" class="btn primary">' + esc(cfg.submit || "Simpan") + "</button></div></form>";
    const form = modal.querySelector("form");
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!validate(form)) return;
      const data = {}, fd = new FormData(form);
      fd.forEach((v, k) => { data[k] = typeof v === "string" ? v.trim() : v; });
      cfg.fields.filter((x) => x.type === "multiselect").forEach((x) => { data[x.name] = fd.getAll(x.name); });
      closeModal();
      cfg.onSubmit(data);
      refresh();
    });
    modal.showModal();
  }
  function validate(form) {
    let firstBad = null;
    form.querySelectorAll("input[name],select[name],textarea[name]").forEach((el) => {
      const wrap = el.closest(".field"), err = wrap && wrap.querySelector(".field-err");
      if (el.type === "checkbox") {
        if (!el.required) return;
        const bad = !el.checked;
        if (wrap) wrap.classList.toggle("invalid", bad);
        if (err) { err.textContent = bad ? "Sila sahkan sebelum meneruskan." : ""; err.hidden = !bad; }
        if (bad && !firstBad) firstBad = el;
        return;
      }
      if (el.type !== "file" && typeof el.value === "string" && el.required && !el.value.trim()) el.value = "";
      let msg = "";
      if (el.validity.valueMissing) msg = "Medan ini wajib diisi.";
      else if (el.validity.rangeUnderflow) msg = "Nilai minimum ialah " + el.min + ".";
      else if (el.validity.rangeOverflow) msg = "Nilai maksimum ialah " + el.max + ".";
      else if (el.validity.badInput || el.validity.typeMismatch || el.validity.stepMismatch) msg = "Format nilai tidak sah.";
      if (wrap) wrap.classList.toggle("invalid", !!msg);
      if (err) { err.textContent = msg; err.hidden = !msg; }
      if (msg && !firstBad) firstBad = el;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }
  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }
  function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Fail contoh dimuat turun: " + name);
  }
  const csvCell = (v) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = (title, rows) => "﻿" + ["# DATA CONTOH - " + title].concat(rows.map((r) => r.map(csvCell).join(","))).join("\r\n");
  const rm = (sen) => (sen / 100).toFixed(2);
  const addHistory = (rec, text) => rec.history.unshift({ at: nowIso(), by: me, text });
  const fileSize = (file) => (file.size >= 1048576 ? (file.size / 1048576).toFixed(1) + " MB" : Math.ceil(file.size / 1024) + " KB");

  /* ========== Tindakan ========== */
  const activeNames = (role) => D.users.filter((u) => u.status === "Aktif" && (!role || u.role === role)).map((u) => u.name);
  const assignableNames = () => D.users.filter((u) => u.status === "Aktif" && ["PROJECT MANAGER", "STAFF", "MANAGEMENT"].includes(u.role)).map((u) => u.name);
  const projectOptions = () => DAL.projects().filter((p) => p.approval === "APPROVED" && p.status !== "ARCHIVED").map((p) => [p.id, p.name]);
  const reasonField = (label) => [{ name: "reason", label, type: "textarea", required: true, full: true, maxlength: 300 }];
  const fileField = (label, help) => ({ name: "file", label, type: "file", required: true, full: true, help });
  function respondTask(t, answer, reason) {
    t.assign[me] = { state: answer, reason: reason || "" };
    addHistory(t, answer === "ACCEPTED" ? "Menerima tugasan" : "Menolak tugasan: " + reason);
    audit(answer === "ACCEPTED" ? "Terima tugasan" : "Tolak tugasan", "Tugasan", t.id, "BERJAYA", reason || "");
    notify([t.assignedBy], (answer === "ACCEPTED" ? "Tugasan diterima: " : "Tugasan ditolak: ") + t.title, "Oleh " + me + (reason ? " · " + reason : ""), "tasks", t.id, "task");
  }
  function setProjectStatus(p, status, text) {
    p.status = status; addHistory(p, text);
    notify([p.pm].concat(p.team), "Status projek berubah: " + p.name, status, "projects", p.id, "project");
  }
  const scopedProject = (id) => DAL.projects().find((x) => x.id === id);
  const logRequest = (p, action, noteText) => { (p.requestLog = p.requestLog || []).push({ action, by: me, role: SESSION.role, at: nowIso(), note: noteText || "" }); };
  const A = {
    skip() { content.focus(); },
    "menu-open"() { setDrawer(true); },
    "menu-close"() { setDrawer(false); },
    "close-modal"() { closeModal(); },
    go(el) { if (el.dataset.key) state.filters[el.dataset.key] = el.dataset.val; navigate(el.dataset.route); },
    filter(el) { state.filters[el.dataset.key] = el.dataset.val; refresh(); },
    "audit-clear"() { Object.assign(state.filters, { "audit.module": "Semua", "audit.user": "Semua", "audit.from": "", "audit.to": "", "audit.q": "" }); refresh(); },
    "cal-prev"() { moveMonth(-1); },
    "cal-next"() { moveMonth(1); },
    "cal-day"(el) { state.cal.sel = el.dataset.date; refresh(); },
    "notif-toggle"() { togglePop("notif"); },
    "profile-toggle"() { togglePop("profile"); },
    "read-all"() { DAL.notifications().forEach((n) => { if (!n.readBy.includes(me)) n.readBy.push(me); }); refresh(); },
    "open-notif"(el) {
      const n = DAL.notifications().find((x) => x.id === el.dataset.id); if (!n) return;
      if (!n.readBy.includes(me)) n.readBy.push(me);
      closePops(); save();
      if (!canRoute(n.route)) { refresh(); return; }
      if (n.ref && (n.route === "tasks" || n.route === "projects")) state.pendingOpen = { type: n.route, ref: n.ref };
      navigate(n.route);
    },
    "demo-reset"() {
      [KEY_OPS, KEY_FIN, KEY_PERSONA, KEY_LOGIN].forEach(store.del);
      location.hash = "#dashboard"; location.reload();
    },
    "live-reload"(el) { const k = el.dataset.kind; LD[k] = null; LD.err[k] = null; liveLoad(k); refresh(); },
    "live-detail"(el) { openLiveDetail(el.dataset.kunci); },
    "live-order"(el) { openLiveOrder(el.dataset.id); },
    "lt-new"() { liveTaskNew(); },
    "lt-pw"() { closePops(); liveChangePassword(); },
    "lt-reset"(el) { liveResetPassword(el.dataset.emel, el.dataset.nama); },
    async "lt-read-all"() { try { await LIVE.api("notifications.read"); } catch (e) { toast(e.message); } LD.notif = null; liveLoad("notif"); },
    "lt-notif"(el) { closePops(); const id = el.dataset.id; if (currentRoute() !== "tasks") location.hash = "#tasks"; setTimeout(() => liveTaskOpen(id), 200); },
    "lt-open"(el) { liveTaskOpen(el.dataset.id); },
    "lt-act"(el) { liveTaskAction(el.dataset.id, el.dataset.t); },

    "open-project"(el, ev) { ev.preventDefault(); openProject(el.dataset.id); },
    "new-project"() {
      const pmField = POLICY.scope === "company" ? [{ name: "pm", label: "Pengurus projek utama", type: "select", options: activeNames("PROJECT MANAGER") }] : [];
      openForm({ title: POLICY.scope === "company" ? "Projek Baharu" : "Mohon Projek Baharu", submit: "Hantar Permohonan", intro: note("Permohonan dihantar dengan status PENDING APPROVAL. Hanya MANAGEMENT boleh meluluskan atau menolak. Projek yang diluluskan menjadi PLANNING."), fields: [
        { name: "name", label: "Nama projek", required: true, full: true, maxlength: 100 },
        { name: "client", label: "Pelanggan / Pemaju", required: true, maxlength: 100 }, { name: "location", label: "Lokasi", required: true, maxlength: 100 },
        { name: "description", label: "Keterangan", type: "textarea", full: true, maxlength: 400 }
      ].concat(pmField, [
        { name: "team", label: "Ahli pasukan", type: "multiselect", options: activeNames("STAFF"), help: "Tekan Ctrl untuk pilih lebih daripada seorang." },
        { name: "start", label: "Tarikh mula", type: "date", required: true, value: plus(7) }, { name: "target", label: "Sasaran siap", type: "date", required: true, value: plus(90) },
        { name: "priority", label: "Keutamaan", type: "select", options: ["Tinggi", "Sederhana", "Rendah"], value: "Sederhana" }
      ], can("finance.view") ? [{ name: "budget", label: "Belanjawan (RM)", type: "number", required: true, min: 0, step: "0.01", value: "10000" }] : []), onSubmit(d) {
        const id = "SCE-PRJ-" + YEAR + "-" + String(++D.projectSeq).padStart(4, "0");
        const p = { id, name: d.name, client: d.client, location: d.location, description: d.description || "—", pm: d.pm || me, team: d.team, start: d.start, target: d.target, priority: d.priority, status: "PENDING APPROVAL", schedule: "ON TRACK", progress: 0, approval: "PENDING", requestedBy: me, reason: "", requestLog: [], history: [] };
        logRequest(p, "DIHANTAR", ""); addHistory(p, "Permohonan projek dihantar"); D.projects.unshift(p);
        if (F && d.budget != null) { F.budgets[id] = { budget: RM(+d.budget), cost: 0 }; audit("Cipta belanjawan projek", "Kewangan", id, "BERJAYA", "Rekod belanjawan baharu", true); }
        audit("Mohon projek", "Projek", id, "BERJAYA", "Status PENDING APPROVAL"); notify(managementUsers(), "Permohonan projek baharu: " + d.name, "Dihantar oleh " + me, "projects", id, "project");
        toast("Permohonan " + id + " dihantar untuk kelulusan.");
      } });
    },
    "approve-project"(el) {
      const p = scopedProject(el.dataset.id); if (!p || p.approval !== "PENDING") return;
      if (!canDecideProject(p)) { audit("Lulus projek", "Projek", p.id, "DITOLAK", "Pemohon tidak boleh meluluskan permohonan sendiri"); toast("Permohonan sendiri mesti diputuskan oleh MANAGEMENT lain."); return; }
      p.approval = "APPROVED"; p.reason = ""; logRequest(p, "DILULUSKAN", "Status PLANNING");
      setProjectStatus(p, "PLANNING", "Permohonan diluluskan oleh " + me + "; status PLANNING");
      audit("Lulus projek", "Projek", p.id, "BERJAYA", "PENDING APPROVAL ke PLANNING"); notify([p.requestedBy], "Projek diluluskan: " + p.name, "Status kini PLANNING", "projects", p.id, "project");
      closeModal(); toast("Projek diluluskan dan kini PLANNING."); refresh();
    },
    "reject-project"(el) {
      const p = scopedProject(el.dataset.id); if (!p || p.approval !== "PENDING") return;
      if (!canDecideProject(p)) { audit("Tolak projek", "Projek", p.id, "DITOLAK", "Pemohon tidak boleh menolak permohonan sendiri"); toast("Permohonan sendiri mesti diputuskan oleh MANAGEMENT lain."); return; }
      openForm({ title: "Tolak Permohonan", submit: "Tolak", intro: note("Rekod permohonan dikekalkan. Pemohon boleh membuat pembetulan dan menghantar semula."), fields: reasonField("Sebab penolakan"), onSubmit(d) {
        p.approval = "REJECTED"; p.status = "REJECTED"; p.reason = d.reason; logRequest(p, "DITOLAK", d.reason); addHistory(p, "Permohonan ditolak: " + d.reason);
        audit("Tolak projek", "Projek", p.id, "BERJAYA", "PENDING APPROVAL ke REJECTED: " + d.reason); notify([p.requestedBy], "Projek ditolak: " + p.name, d.reason, "projects", p.id, "project"); toast("Permohonan ditolak dan direkod.");
      } });
    },
    "resubmit-project"(el) {
      const p = scopedProject(el.dataset.id); if (!p || !canResubmitProject(p)) return;
      openForm({ title: "Betulkan Permohonan: " + p.id, submit: "Hantar Semula", intro: note("Sebab penolakan: " + (p.reason || "—")) + note("Permohonan akan kembali kepada status PENDING APPROVAL untuk keputusan MANAGEMENT."), fields: [
        { name: "name", label: "Nama projek", required: true, full: true, maxlength: 100, value: p.name },
        { name: "client", label: "Pelanggan / Pemaju", required: true, maxlength: 100, value: p.client }, { name: "location", label: "Lokasi", required: true, maxlength: 100, value: p.location },
        { name: "description", label: "Keterangan", type: "textarea", full: true, maxlength: 400, value: p.description },
        { name: "start", label: "Tarikh mula", type: "date", required: true, value: p.start }, { name: "target", label: "Sasaran siap", type: "date", required: true, value: p.target },
        { name: "priority", label: "Keutamaan", type: "select", options: ["Tinggi", "Sederhana", "Rendah"], value: p.priority },
        { name: "change", label: "Pembetulan yang dibuat", type: "textarea", required: true, full: true, maxlength: 300 }
      ], onSubmit(d) {
        Object.assign(p, { name: d.name, client: d.client, location: d.location, description: d.description || "—", start: d.start, target: d.target, priority: d.priority, status: "PENDING APPROVAL", approval: "PENDING" });
        logRequest(p, "DIHANTAR SEMULA", d.change); addHistory(p, "Permohonan dibetulkan dan dihantar semula: " + d.change);
        audit("Hantar semula permohonan projek", "Projek", p.id, "BERJAYA", "REJECTED ke PENDING APPROVAL: " + d.change);
        notify(managementUsers(), "Permohonan projek dihantar semula: " + p.name, "Oleh " + me, "projects", p.id, "project"); toast("Permohonan " + p.id + " dihantar semula.");
      } });
    },
    "edit-project"(el) {
      const p = scopedProject(el.dataset.id); if (!p || !canEditProject(p)) return;
      openForm({ title: "Kemas Kini: " + p.name, submit: "Simpan", fields: [
        { name: "status", label: "Status", type: "select", options: ["PLANNING", "ACTIVE", "ON HOLD", "COMPLETED", "CANCELLED"], value: p.status },
        { name: "schedule", label: "Status jadual", type: "select", options: SCHEDULE, value: p.schedule },
        { name: "progress", label: "Kemajuan (%)", type: "number", required: true, min: 0, max: 100, step: "1", value: p.progress },
        { name: "target", label: "Sasaran siap", type: "date", required: true, value: p.target }
      ], onSubmit(d) {
        const before = p.status; p.schedule = d.schedule; p.progress = +d.progress; p.target = d.target;
        if (d.status !== before) setProjectStatus(p, d.status, "Status ditukar daripada " + before + " kepada " + d.status); else addHistory(p, "Kemajuan dikemas kini kepada " + p.progress + "%");
        audit("Kemas kini projek", "Projek", p.id, "BERJAYA", before + " ke " + d.status + ", " + p.progress + "%"); toast("Projek dikemas kini.");
      } });
    },
    "archive-project"(el) {
      const p = scopedProject(el.dataset.id); if (!p || p.status === "ARCHIVED") return;
      openForm({ title: "Arkib Projek", submit: "Arkib", intro: note("Arkib mengekalkan rekod, dokumen dan sejarah projek ini."), fields: reasonField("Sebab"), onSubmit(d) {
        setProjectStatus(p, "ARCHIVED", "Projek diarkib: " + d.reason); audit("Arkib projek", "Projek", p.id, "BERJAYA", d.reason); toast("Projek diarkib. Rekod dikekalkan.");
      } });
    },

    "open-task"(el) { openTask(el.dataset.id); },
    "new-task"() {
      openForm({ title: "Tugasan Baharu", submit: "Cipta Tugasan", intro: note("Anda akan menjadi pemberi tugas dan penyemak tugasan ini."), fields: [
        { name: "title", label: "Tajuk tugasan", required: true, full: true, maxlength: 120 }, { name: "description", label: "Keterangan", type: "textarea", full: true, maxlength: 400 },
        { name: "project", label: "Projek (pilihan)", type: "select", options: [["", "Tiada projek"]].concat(projectOptions()), full: true },
        { name: "category", label: "Kategori", required: true, maxlength: 60, value: "Pentadbiran" }, { name: "primary", label: "Penerima utama", type: "select", options: assignableNames() },
        { name: "additional", label: "Penerima tambahan", type: "multiselect", options: assignableNames(), help: "Tekan Ctrl untuk pilih lebih daripada seorang." },
        { name: "priority", label: "Keutamaan", type: "select", options: ["Tinggi", "Sederhana", "Rendah"], value: "Sederhana" }, { name: "start", label: "Tarikh mula", type: "date", required: true, value: TODAY }, { name: "due", label: "Tarikh akhir", type: "date", required: true, value: plus(7) }
      ], onSubmit(d) {
        const id = nextId("TSK"), additional = d.additional.filter((n) => n !== d.primary), assign = {};
        [d.primary].concat(additional).forEach((n) => { assign[n] = { state: "PENDING ACCEPTANCE", reason: "" }; });
        const t = { id, title: d.title, description: d.description || "—", project: d.project, category: d.category, assignedBy: me, reviewer: me, primary: d.primary, additional, start: d.start, due: d.due, priority: d.priority, status: "TODO", progress: 0, assign, notes: [], comments: [], attachments: [], history: [] };
        addHistory(t, "Tugasan diberikan kepada " + d.primary); D.tasks.unshift(t);
        audit("Beri tugasan", "Tugasan", id, "BERJAYA", "Kepada " + d.primary); notify([d.primary].concat(additional), "Tugasan baharu: " + d.title, "Diberikan oleh " + me, "tasks", id, "task"); toast("Tugasan dicipta.");
      } });
    },
    "accept-task"(el) { const t = findTask(el.dataset.id); if (t && isMine(t) && myAssign(t) === "PENDING ACCEPTANCE") { respondTask(t, "ACCEPTED"); closeModal(); toast("Tugasan diterima."); refresh(); } },
    "reject-task"(el) {
      const t = findTask(el.dataset.id); if (!t || !isMine(t) || myAssign(t) !== "PENDING ACCEPTANCE") return;
      openForm({ title: "Tolak Tugasan", submit: "Tolak", fields: reasonField("Sebab penolakan"), onSubmit(d) { respondTask(t, "REJECTED", d.reason); toast("Tugasan ditolak."); } });
    },
    "task-progress"(el) {
      const t = findTask(el.dataset.id); if (!t || !canWorkOnTask(t)) return;
      openForm({ title: "Kemas Kini Kemajuan", submit: "Simpan", intro: note("Kemajuan 100% tidak menandakan tugasan selesai. Penyiapan memerlukan semakan dan kelulusan."), fields: [{ name: "progress", label: "Kemajuan (%)", type: "number", required: true, min: 0, max: 100, step: "1", value: t.progress }, { name: "note", label: "Nota kerja", type: "textarea", full: true, maxlength: 400 }], onSubmit(d) {
        t.progress = +d.progress; if (d.note) t.notes.unshift({ at: nowIso(), by: me, text: d.note });
        if (t.status === "TODO" && t.progress > 0) t.status = "IN PROGRESS"; // kerja bermula; tidak sekali-kali terus COMPLETED
        addHistory(t, "Kemajuan " + t.progress + "%"); audit("Kemas kini kemajuan tugasan", "Tugasan", t.id, "BERJAYA", t.progress + "%"); toast("Kemajuan disimpan.");
      } });
    },
    "submit-review"(el) {
      const t = findTask(el.dataset.id); if (!t || !canSubmitTask(t)) return;
      t.status = "PENDING REVIEW"; addHistory(t, "Dihantar untuk semakan"); audit("Hantar tugasan untuk semakan", "Tugasan", t.id);
      notify([t.reviewer], "Tugasan dihantar untuk semakan: " + t.title, "Daripada " + me, "tasks", t.id, "task"); closeModal(); toast("Dihantar untuk semakan."); refresh();
    },
    "approve-task"(el) {
      const t = findTask(el.dataset.id); if (!t || !canApproveTask(t)) { audit("Lulus tugasan", "Tugasan", el.dataset.id, "DITOLAK", "Tiada kebenaran"); return; }
      t.status = "COMPLETED"; t.progress = 100; addHistory(t, "Diluluskan oleh " + me); audit("Lulus tugasan", "Tugasan", t.id);
      notify(activeAssignees(t), "Tugasan diluluskan: " + t.title, "Oleh " + me, "tasks", t.id, "task"); closeModal(); toast("Tugasan diluluskan dan selesai."); refresh();
    },
    "return-task"(el) {
      const t = findTask(el.dataset.id); if (!t || !canApproveTask(t)) return;
      openForm({ title: "Pulangkan untuk Pembetulan", submit: "Pulangkan", fields: [{ name: "note", label: "Nota pembetulan", type: "textarea", required: true, full: true, maxlength: 400 }], onSubmit(d) {
        t.status = "REVISION REQUIRED"; t.notes.unshift({ at: nowIso(), by: me, text: d.note }); addHistory(t, "Dipulangkan untuk pembetulan"); audit("Pulangkan tugasan", "Tugasan", t.id, "BERJAYA", d.note);
        notify(activeAssignees(t), "Tugasan perlu pembetulan: " + t.title, d.note, "tasks", t.id, "task"); toast("Tugasan dipulangkan.");
      } });
    },
    "task-comment"(el) { const t = findTask(el.dataset.id); if (t) openForm({ title: "Tambah Komen", submit: "Hantar", fields: [{ name: "text", label: "Komen", type: "textarea", required: true, full: true, maxlength: 400 }], onSubmit(d) { t.comments.unshift({ at: nowIso(), by: me, text: d.text }); addHistory(t, "Komen ditambah"); audit("Komen tugasan", "Tugasan", t.id); toast("Komen ditambah."); } }); },
    "task-attach"(el) { const t = findTask(el.dataset.id); if (t) openForm({ title: "Tambah Lampiran", submit: "Tambah", fields: [fileField("Fail", "Hanya nama fail direkod. Fail tidak dihantar ke mana-mana.")], onSubmit(d) { t.attachments.unshift({ name: d.file.name, by: me }); addHistory(t, "Lampiran ditambah"); audit("Lampiran tugasan", "Tugasan", t.id); toast("Lampiran direkod."); } }); },

    "new-event"() {
      const scoped = POLICY.scope === "company" ? [["", "Tiada projek"]].concat(projectOptions()) : projectOptions().filter(([id]) => ownsProject(id));
      if (!scoped.length) { toast("Tiada projek anda untuk dipautkan."); return; }
      openForm({ title: "Event Baharu", submit: "Tambah Event", fields: [
        { name: "name", label: "Nama event", required: true, full: true, maxlength: 120 }, { name: "type", label: "Jenis", type: "select", options: PROGRAM_TYPES }, { name: "date", label: "Tarikh", type: "date", required: true, value: state.cal.sel },
        { name: "place", label: "Lokasi", required: true, full: true, maxlength: 120 }, { name: "project", label: "Pautan projek", type: "select", options: scoped, full: true }, { name: "assigned", label: "Ditugaskan kepada", type: "multiselect", options: activeNames("STAFF"), full: true }
      ], onSubmit(d) {
        const id = nextId("EVT"); D.events.push({ id, name: d.name, type: d.type, status: "Dirancang", date: d.date, place: d.place, project: d.project, assigned: d.assigned });
        state.cal.sel = d.date; state.cal.y = +d.date.slice(0, 4); state.cal.m = +d.date.slice(5, 7) - 1;
        audit("Tambah program", "Program", id, "BERJAYA", d.type); notify(d.assigned, "Program baharu: " + d.name, d.type + " · " + fmtDate(d.date), "programs", id, "event"); toast("Event ditambah pada " + fmtDate(d.date) + ".");
      } });
    },
    "edit-event"(el) {
      const e = DAL.events().find((x) => x.id === el.dataset.id); if (!e || !canManageEvent(e)) return;
      openForm({ title: "Kemas Kini: " + e.name, submit: "Simpan", fields: [{ name: "status", label: "Status", type: "select", options: ["Dirancang", "Selesai", "Ditangguh", "Batal"], value: e.status, full: true }], onSubmit(d) { const b = e.status; e.status = d.status; audit("Kemas kini program", "Program", e.id, "BERJAYA", b + " ke " + d.status); notify(e.assigned, "Status program berubah: " + e.name, d.status, "programs", e.id, "event"); toast("Program dikemas kini."); } });
    },
    "new-permit"() {
      openForm({ title: "Daftar Permit DBKL", submit: "Daftar Permit", fields: [
        { name: "category", label: "Kategori", type: "select", options: ["R3", "R5", "R7"] }, { name: "contractor", label: "Kontraktor", type: "select", options: D.contractors.filter((c) => c.status === "Aktif").map((c) => c.name) },
        { name: "place", label: "Lokasi", required: true, full: true, maxlength: 120 }, { name: "expiry", label: "Tarikh tamat", type: "date", required: true, value: plus(180) }
      ], onSubmit(d) { const id = nextId("PMT"); D.permits.push({ id, category: d.category, contractor: d.contractor, place: d.place, expiry: d.expiry, pm: POLICY.scope === "company" ? PM1 : me, staff: [] }); audit("Daftar permit", "DBKL", id, "BERJAYA", d.category); toast("Permit " + id + " didaftarkan."); } });
    },
    "update-wo"(el) {
      const w = DAL.workOrders().find((x) => x.id === el.dataset.id); if (!w || !canUpdateWo(w)) return;
      openForm({ title: "Kemas Kini " + w.id, submit: "Simpan", fields: [{ name: "status", label: "Status", type: "select", options: ["Belum Mula", "Dalam Proses", "Semakan", "Selesai"], value: w.status, full: true }], onSubmit(d) { const b = w.status; w.status = d.status; audit("Kemas kini work order", "DBKL", w.id, "BERJAYA", b + " ke " + d.status); notify([w.pm].concat(w.staff), "Kemas kini work order " + w.id, "Status: " + d.status, "dbkl", w.id, "dbkl"); toast("Work order dikemas kini."); } });
    },
    "new-evidence"(el) {
      const w = DAL.workOrders().find((x) => x.id === el.dataset.id); if (!w || !canUpdateWo(w)) return;
      openForm({ title: "Bukti untuk " + w.id, submit: "Rekod", fields: [fileField("Foto / fail", "Hanya nama fail direkod. Fail tidak dihantar ke mana-mana.")], onSubmit(d) { const id = nextId("EVD"); D.evidence.unshift({ id, wo: w.id, file: d.file.name, date: TODAY, by: me }); audit("Rekod bukti", "DBKL", id, "BERJAYA", w.id); toast("Bukti direkod."); } });
    },
    "new-update"() {
      openForm({ title: "Kemas Kini Kerja", submit: "Hantar", fields: [{ name: "text", label: "Kemas kini", type: "textarea", required: true, full: true, maxlength: 400 }], onSubmit(d) { D.updates.unshift({ text: d.text, date: TODAY, by: me }); audit("Kemas kini kerja", "Workspace", "—"); toast("Kemas kini dihantar."); } });
    },
    "new-instruction"() {
      openForm({ title: "Arahan Pengurusan", submit: "Hantar", fields: [{ name: "to", label: "Penerima", type: "multiselect", required: true, options: activeNames().filter((n) => n !== me), full: true, help: "Tekan Ctrl untuk pilih lebih daripada seorang." }, { name: "text", label: "Arahan", type: "textarea", required: true, full: true, maxlength: 300 }], onSubmit(d) { notify(d.to, "Arahan pengurusan daripada " + me, d.text, "notifications", "", "instruction"); audit("Hantar arahan pengurusan", "Notifikasi", "—", "BERJAYA", d.to.length + " penerima"); toast("Arahan dihantar dalam aplikasi. Emel belum disambung."); } });
    },

    "open-doc"(el) { openDoc(el.dataset.id); },
    "new-doc"(el) {
      const company = POLICY.scope === "company", projects = company ? [["", "Tiada (dokumen syarikat)"]].concat(projectOptions()) : DAL.projects().filter((p) => p.status !== "ARCHIVED").map((p) => [p.id, p.name]);
      if (!projects.length) { toast("Tiada projek dalam skop anda."); return; }
      openForm({ title: "Muat Naik Dokumen", submit: "Tambah ke Repositori", fields: [
        fileField("Fail", "Hanya nama dan saiz fail direkod. Fail tidak dihantar ke mana-mana."),
        { name: "category", label: "Kategori", type: "select", options: docCategories() }, { name: "project", label: "Projek", type: "select", options: projects, value: el.dataset.project || "" }
      ], onSubmit(d) {
        const fin = d.category === FINANCIAL_DOC && !!F, doc = makeDoc(nextId("DOC"), d.file.name, d.category, d.project, me, 1, 0, fileSize(d.file));
        (fin ? F.documents : D.documents).unshift(doc); audit("Muat naik dokumen", "Dokumen", doc.id, "BERJAYA", fin ? "Dokumen kewangan" : d.category, fin); toast("Dokumen ditambah ke repositori contoh.");
      } });
    },
    "doc-version"(el) {
      const doc = DAL.documents().find((x) => x.id === el.dataset.id); if (!doc) return;
      openForm({ title: "Versi Baharu: " + doc.name, submit: "Tambah Versi", fields: [fileField("Fail", "Hanya nama dan saiz fail direkod.")], onSubmit(d) { doc.version += 1; doc.date = TODAY; doc.size = fileSize(d.file); doc.versions.unshift({ v: doc.version, date: TODAY, by: me }); audit("Versi dokumen baharu", "Dokumen", doc.id, "BERJAYA", "v" + doc.version, doc.category === FINANCIAL_DOC); toast("Versi " + doc.version + " direkod."); } });
    },
    "dl-doc"(el) {
      const d = DAL.documents().find((x) => x.id === el.dataset.id); if (!d) { toast("Dokumen ini tiada dalam skop akses anda."); return; }
      audit("Muat turun dokumen", "Dokumen", d.id, "BERJAYA", d.category === FINANCIAL_DOC ? "Dokumen kewangan" : d.category, d.category === FINANCIAL_DOC);
      download(d.name.replace(/\.[^.]+$/, "") + " (contoh).txt", "DATA CONTOH\nIni bukan dokumen sebenar.\n\nNama: " + d.name + "\nKategori: " + d.category + "\nVersi: " + d.version + "\n", "text/plain;charset=utf-8");
    },
    "export-analytics"() {
      const n = +f("analytics.period"), labels = lastMonths(n), done = D.tasksDone.slice(-n);
      audit("Export analytics", "Analytics", "CSV");
      download("sce-analytics-contoh.csv", csv("Business Analytics", [["Bulan", "Tugasan Selesai"]].concat(labels.map((l, i) => [l, done[i]]))), "text/csv;charset=utf-8");
    },

    "new-expense"() {
      openForm({ title: "Rekod Perbelanjaan", submit: "Hantar untuk Kelulusan", intro: note("Pencipta transaksi tidak boleh meluluskan transaksinya sendiri."), fields: [
        { name: "category", label: "Kategori", type: "select", options: ["Kos Projek", "Kontraktor", "Operasi"] }, { name: "amount", label: "Amaun (RM)", type: "number", required: true, min: 0.01, step: "0.01" },
        { name: "desc", label: "Keterangan", required: true, full: true, maxlength: 120, help: "Direkodkan pada bulan semasa selepas diluluskan." }
      ], onSubmit(d) { const id = nextId("EXP"); F.expenses.unshift({ id, category: d.category, desc: d.desc, amount: RM(+d.amount), date: TODAY, maker: me, status: "Menunggu Kelulusan" }); audit("Rekod perbelanjaan", "Kewangan", id, "BERJAYA", "Menunggu kelulusan", true); toast("Perbelanjaan menunggu kelulusan."); } });
    },
    "new-income"() {
      openForm({ title: "Rekod Pendapatan", submit: "Hantar untuk Kelulusan", intro: note("Pencipta transaksi tidak boleh meluluskan transaksinya sendiri."), fields: [{ name: "desc", label: "Keterangan", required: true, full: true, maxlength: 120 }, { name: "amount", label: "Amaun (RM)", type: "number", required: true, min: 0.01, step: "0.01", full: true, help: "Direkodkan pada bulan semasa selepas diluluskan." }], onSubmit(d) { const id = nextId("INC"); F.incomes.unshift({ id, desc: d.desc, amount: RM(+d.amount), date: TODAY, maker: me, status: "Menunggu Kelulusan" }); audit("Rekod pendapatan", "Kewangan", id, "BERJAYA", "Menunggu kelulusan", true); toast("Pendapatan menunggu kelulusan."); } });
    },
    "approve-tx"(el) {
      const kind = el.dataset.kind, list = { expense: F.expenses, income: F.incomes, payment: F.payments }[kind], tx = list.find((x) => x.id === el.dataset.id);
      if (!tx || tx.status !== "Menunggu Kelulusan") return;
      if (tx.maker === me) { audit("Lulus transaksi", "Kewangan", tx.id, "DITOLAK", "Maker-Checker: pencipta sendiri", true); toast("Pencipta tidak boleh meluluskan transaksi sendiri."); refresh(); return; }
      tx.status = kind === "payment" ? "Dibayar" : "Diluluskan";
      if (kind === "income") F.months.rev[11] += tx.amount;
      if (kind === "expense") F.months[{ "Kos Projek": "projek", Kontraktor: "kontraktor", Operasi: "operasi" }[tx.category]][11] += tx.amount;
      audit("Lulus transaksi", "Kewangan", tx.id, "BERJAYA", "Pencipta: " + tx.maker, true);
      notify([tx.maker], "Transaksi " + tx.id + " diluluskan", "Oleh " + me, "finance", "", "finance", true); toast("Transaksi " + tx.id + " diluluskan."); refresh();
    },
    "export-fin"(el) {
      const w = finWindow(+f("finance.period")), id = el.dataset.id;
      const map = {
        pl: ["Penyata Untung Rugi", [["Bulan", "Pendapatan (RM)", "Perbelanjaan (RM)", "Untung Bersih (RM)"]].concat(w.map((r) => [r.label, rm(r.rev), rm(r.exp), rm(r.rev - r.exp)]))],
        cost: ["Kos Projek", [["Projek", "Belanjawan (RM)", "Kos (RM)", "Baki (RM)"]].concat(financeProjects().map((p) => [p.name, rm(projFin(p).budget), rm(projFin(p).cost), rm(projFin(p).budget - projFin(p).cost)]))],
        exp: ["Perbelanjaan Bulanan", [["Bulan", "Kos Projek (RM)", "Kontraktor (RM)", "Operasi (RM)"]].concat(w.map((r) => [r.label, rm(r.projek), rm(r.kontraktor), rm(r.operasi)]))],
        pay: ["Bayaran Kontraktor", [["ID", "Kontraktor", "Amaun (RM)", "Status"]].concat(F.payments.map((p) => [p.id, p.contractor, rm(p.amount), p.status]))]
      };
      audit("Export kewangan", "Kewangan", map[id][0], "BERJAYA", "CSV", true);
      download("sce-" + id + "-contoh.csv", csv(map[id][0], map[id][1]), "text/csv;charset=utf-8");
    },

    "new-user"() {
      openForm({ title: "Pengguna Baharu", submit: "Tambah Pengguna", intro: note("Super Admin hanya boleh dilantik daripada pengguna MANAGEMENT yang aktif."), fields: [
        { name: "name", label: "Nama", required: true, full: true, maxlength: 80 }, { name: "title", label: "Jawatan", required: true, maxlength: 80 }, { name: "dept", label: "Jabatan", type: "select", options: ["Operasi", "Komunikasi", "Kewangan", "Pentadbiran", "Pengurusan"] },
        { name: "role", label: "Role", type: "select", options: ROLES.filter((r) => r !== "SUPER ADMIN"), value: "STAFF", full: true }
      ], onSubmit(d) { D.users.push({ name: d.name, title: d.title, dept: d.dept, role: d.role, status: "Aktif", email: "pengguna" + (D.users.length + 1) + "@contoh.example" }); audit("Cipta pengguna", "Akses", d.name, "BERJAYA", d.role); toast("Pengguna ditambah."); } });
    },
    "change-role"(el) {
      const u = D.users[+el.dataset.i]; if (!u || u.role === "SUPER ADMIN") return;
      openForm({ title: "Tukar Role: " + u.name, submit: "Simpan", intro: note("Berkuat kuasa selepas sesi pengguna dimuat semula."), fields: [{ name: "role", label: "Role", type: "select", options: ROLES.filter((r) => r !== "SUPER ADMIN"), value: u.role, full: true, help: "SUPER ADMIN hanya boleh dilantik melalui tindakan Lantik Super Admin." }].concat(reasonField("Sebab perubahan")), onSubmit(d) { const b = u.role; if (b === d.role) { toast("Tiada perubahan role."); return; } u.role = d.role; audit("Tukar role pengguna", "Akses", u.name, "BERJAYA", b + " ke " + d.role + " · Sebab: " + d.reason); toast("Role dikemas kini."); } });
    },
    "appoint-sa"(el) {
      const u = D.users[+el.dataset.i]; if (!u || u.role !== "MANAGEMENT" || u.status !== "Aktif") return;
      openForm({ title: "Lantik Super Admin: " + u.name, submit: "Sahkan Pelantikan", intro: note("Pelantikan ini untuk " + u.name + " sahaja. Pengguna MANAGEMENT lain tidak terjejas. Simulasi DEV: tiada akaun sebenar diubah."), fields: reasonField("Sebab pelantikan").concat([{ name: "confirm", label: "Saya sahkan pelantikan " + u.name + " sebagai SUPER ADMIN.", type: "confirm", required: true }]), onSubmit(d) {
        u.role = "SUPER ADMIN"; u.formerRole = "MANAGEMENT";
        audit("Lantik Super Admin", "Akses", u.name, "BERJAYA", "MANAGEMENT ke SUPER ADMIN · Sebab: " + d.reason); notify([u.name], "Anda dilantik sebagai Super Admin", "Oleh " + me, "dashboard", "", "access");
        toast(u.name + " dilantik. Berkuat kuasa selepas sesi dimuat semula.");
      } });
    },
    "remove-sa"(el) {
      const u = D.users[+el.dataset.i]; if (!u || u.role !== "SUPER ADMIN") return;
      if (u.status === "Aktif" && activeSuperAdmins().length <= 1) { audit("Gugur Super Admin", "Akses", u.name, "DITOLAK", "Super Admin terakhir yang aktif"); toast("Super Admin terakhir yang aktif tidak boleh digugurkan."); refresh(); return; }
      openForm({ title: "Gugur Super Admin: " + u.name, submit: "Sahkan Pengguguran", intro: note("Simulasi DEV: tiada akaun sebenar diubah."), fields: reasonField("Sebab").concat([{ name: "confirm", label: "Saya sahkan pengguguran " + u.name + " daripada SUPER ADMIN.", type: "confirm", required: true }]), onSubmit(d) {
        if (u.status === "Aktif" && activeSuperAdmins().length <= 1) { audit("Gugur Super Admin", "Akses", u.name, "DITOLAK", "Super Admin terakhir yang aktif"); toast("Super Admin terakhir yang aktif tidak boleh digugurkan."); return; }
        const back = u.formerRole || "MANAGEMENT"; u.role = back;
        audit("Gugur Super Admin", "Akses", u.name, "BERJAYA", "SUPER ADMIN ke " + back + " · Sebab: " + d.reason); toast("Role dikemas kini. Berkuat kuasa selepas sesi dimuat semula.");
      } });
    },
    "toggle-user"(el) {
      const u = D.users[+el.dataset.i]; if (!u) return;
      if (u.role === "SUPER ADMIN" && u.status === "Aktif" && activeSuperAdmins().length <= 1) { audit("Tukar status pengguna", "Akses", u.name, "DITOLAK", "Super Admin terakhir yang aktif"); toast("Super Admin terakhir yang aktif dilindungi."); refresh(); return; }
      u.status = u.status === "Aktif" ? "Tidak Aktif" : "Aktif"; audit("Tukar status pengguna", "Akses", u.name, "BERJAYA", u.status); toast(u.name + " kini " + u.status + "."); refresh();
    }
  };
  function moveMonth(delta) {
    const d = new Date(Date.UTC(state.cal.y, state.cal.m + delta, 1));
    state.cal.y = d.getUTCFullYear(); state.cal.m = d.getUTCMonth(); refresh();
  }

  /* ========== Notifikasi, popover, menu ========== */
  function renderNotifsLive() {
    const b = $("#notif-btn"), pop = $("#notif-pop");
    if (LIVE_USER.role === "VIEWER") { $("#notif-wrap").innerHTML = ""; return; }
    if (!LD.notif && !LD.err.notif) liveLoad("notif");
    const d = LD.notif || { notifikasi: [], belumDibaca: 0 }, unread = d.belumDibaca;
    b.innerHTML = icon("bell") + (unread ? '<span class="count-dot">' + unread + "</span>" : "");
    b.setAttribute("aria-label", "Notifikasi, " + unread + " belum dibaca");
    const body = LD.err.notif ? '<p class="small muted" style="padding:12px">' + esc(LD.err.notif) + "</p>" : !LD.notif ? '<p class="small muted" style="padding:12px">Memuatkan…</p>' :
      d.notifikasi.length ? d.notifikasi.slice(0, 10).map((n) => '<button type="button" class="notif-item' + (n.dibaca ? "" : " unread") + '" data-action="lt-notif" data-id="' + esc(n.task_id) + '"><strong>' + esc(n.title) + "</strong><span>" + esc(n.task_id) + " · " + fmtDateTime(n.at) + "</span></button>").join("") : '<p class="small muted" style="padding:12px">Tiada notifikasi.</p>';
    pop.innerHTML = '<div class="notif-head"><h2>Notifikasi ' + liveTagDev + "</h2>" + (unread ? '<button type="button" class="link-btn" data-action="lt-read-all">Tandai semua dibaca</button>' : "") + '</div><div class="notif-list">' + body + "</div>";
  }
  function renderNotifs() {
    if (LIVE_USER) { renderNotifsLive(); return; }
    const wrap = $("#notif-wrap");
    if (!can("notifications.receive")) { wrap.innerHTML = ""; return; }
    const list = DAL.notifications(), unread = list.filter((n) => !n.readBy.includes(me)).length;
    const b = $("#notif-btn");
    b.innerHTML = icon("bell") + (unread ? '<span class="count-dot">' + unread + "</span>" : "");
    b.setAttribute("aria-label", "Notifikasi, " + unread + " belum dibaca");
    $("#notif-pop").innerHTML = '<div class="notif-head"><h2>Notifikasi ' + demoTag + "</h2>" + (unread ? '<button type="button" class="link-btn" data-action="read-all">Tandai semua dibaca</button>' : "") + '</div><div class="notif-list">' +
      (list.length ? list.slice(0, 8).map((n) => '<button type="button" class="notif-item' + (n.readBy.includes(me) ? "" : " unread") + '" data-action="open-notif" data-id="' + esc(n.id) + '"><strong>' + esc(n.title) + "</strong><span>" + esc(n.sub) + " · " + fmtDateTime(n.at) + "</span></button>").join("") : '<div class="empty">Tiada notifikasi.</div>') + '</div><a class="notif-all" href="#notifications">Buka Notification Centre</a>';
  }
  function closePops() {
    [["notif", "#notif-btn"], ["profile", "#profile-btn"]].forEach(([n, b]) => { const pop = $("#" + n + "-pop"), btnEl = $(b); if (pop) pop.hidden = true; if (btnEl) btnEl.setAttribute("aria-expanded", "false"); });
  }
  function togglePop(name) {
    const pop = $("#" + name + "-pop"), willOpen = pop.hidden;
    closePops();
    if (willOpen) { pop.hidden = false; $("#" + name + "-btn").setAttribute("aria-expanded", "true"); }
  }
  function setDrawer(open) {
    document.body.classList.toggle("nav-open", open);
    $("#scrim").hidden = !open;
    $("#menu-btn").setAttribute("aria-expanded", String(open));
    if (open) { const a = $("#nav a"); if (a) a.focus(); }
  }

  /* ========== Pendengar acara ========== */
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action]");
    if (el && A[el.dataset.action]) {
      const need = ACTION_CAPS[el.dataset.action];
      if (need && !can(need)) { audit("Tindakan ditolak", "Akses", el.dataset.action, "DITOLAK", "Tiada kebenaran"); toast("Anda tiada kebenaran untuk tindakan ini."); }
      else A[el.dataset.action](el, ev);
    }
    if (!ev.target.closest(".pop-wrap")) closePops();
    else if (ev.target.closest(".popover a")) closePops();
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.id === "demo-role") { switchPersona(ev.target.value); return; }
    const filterEl = ev.target.closest("[data-change='filter']");
    if (filterEl) { state.filters[filterEl.dataset.key] = filterEl.value; refresh(); return; }
    const el = ev.target.closest("[data-change='task-status']");
    if (!el || !el.value) return;
    const t = findTask(el.dataset.id);
    if (t && taskMoves(t).includes(el.value)) { const b = t.status; t.status = el.value; addHistory(t, "Status " + b + " ke " + t.status); audit("Tukar status tugasan", "Tugasan", t.id, "BERJAYA", b + " ke " + t.status); toast("Status dikemas kini: " + t.status + "."); }
    refresh();
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-input='search']");
    if (el) { state.filters[el.dataset.key] = el.value; refresh(); }
  });
  document.addEventListener("submit", (ev) => {
    const form = ev.target;
    if (form.dataset.submit !== "settings") return;
    ev.preventDefault();
    if (!validate(form)) return;
    const s = D.settings, v = new FormData(form);
    s.company = String(v.get("company")).trim();
    s.permitDays = +v.get("permitDays");
    if (can("finance.view")) s.budgetWarn = +v.get("budgetWarn");
    ["notifTasks", "notifPermits", "notifEvents"].forEach((k) => { s[k] = v.get(k) === "on"; });
    audit("Kemas kini tetapan", "Tetapan", "Company Settings"); toast("Tetapan disimpan."); refresh();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    closePops();
    if (document.body.classList.contains("nav-open")) { setDrawer(false); $("#menu-btn").focus(); }
  });
  modal.addEventListener("click", (ev) => { if (ev.target === modal) closeModal(); });

  const tip = $("#tooltip");
  function placeTip(ev) {
    const pad = 12, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY - h - pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y < 8) y = ev.clientY + pad;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = y + "px";
  }
  document.addEventListener("pointermove", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-tip]");
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip; tip.hidden = false; placeTip(ev);
  });
  document.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest && ev.target.closest(".col[data-tip]");
    if (el) { tip.textContent = el.dataset.tip; tip.hidden = false; placeTip(ev); } else tip.hidden = true;
  });
  window.addEventListener("hashchange", () => {
    setDrawer(false); closePops(); closeModal(); render(true);
    window.scrollTo(0, 0); content.focus({ preventScroll: true });
  });

  /* ========== Pemilih role DEV DEMO ONLY ========== */
  function switchPersona(key) {
    const name = PERSONAS[key], user = D.users.find((u) => u.name === name);
    if (!user || user.status !== "Aktif") { toast("Akaun demo ini tidak aktif."); $("#demo-role").value = SESSION.persona; return; }
    audit("Logout (DEV demo)", "Sesi", me, "BERJAYA", "Tukar akaun demo");
    store.set(KEY_PERSONA, key); store.set(KEY_LOGIN, "1");
    location.hash = "#dashboard";
    location.reload();
  }

  /* ========== Mula ========== */
  function initFinance() {
    const raw = window.SCE_FINANCE_DEMO;
    delete window.SCE_FINANCE_DEMO;
    F = parseJson(store.get(KEY_FIN));
    if (F || !raw) return;
    const budgets = {};
    Object.keys(raw.budgets).forEach((n) => { budgets[projId(n)] = { budget: RM(raw.budgets[n][0]), cost: RM(raw.budgets[n][1]) }; });
    F = {
      months: { rev: raw.months.rev.map(RM), projek: raw.months.projek.map(RM), kontraktor: raw.months.kontraktor.map(RM), operasi: raw.months.operasi.map(RM) }, budgets,
      expenses: raw.expenses.map(([id, category, desc, a, d, maker, status]) => ({ id, category, desc, amount: RM(a), date: plus(d), maker, status })),
      incomes: raw.incomes.map(([id, desc, a, d, maker, status]) => ({ id, desc, amount: RM(a), date: plus(d), maker, status })),
      payments: raw.payments.map(([id, contractor, wo, a, status, d, maker, bank]) => ({ id, contractor, wo, amount: RM(a), status, date: plus(d), maker, bank })),
      documents: raw.documents.map(([id, name, pn, owner, version, d, size]) => makeDoc(id, name, FINANCIAL_DOC, projId(pn), owner, version, d, size)),
      tasks: raw.tasks.map(([id, title, pn, by, to, d]) => ({ id, title, description: "Keterangan tugasan contoh.", project: projId(pn), category: "Kewangan", assignedBy: by, reviewer: by, primary: to, additional: [], start: plus(d - 7), due: plus(d), priority: "Tinggi", status: "PENDING REVIEW", progress: 100, assign: { [to]: { state: "ACCEPTED", reason: "" } }, notes: [], comments: [], attachments: [], history: [{ at: stamp(d - 7), by, text: "Tugasan diberikan kepada " + to }] })),
      audit: [], notifications: []
    };
  }
  function renderIdentity() {
    if (LIVE_USER) {
      const nama = LIVE_USER.nama || LIVE_USER.emel;
      $("#profile-avatar").textContent = nama.charAt(0);
      $("#profile-name").textContent = nama;
      $("#profile-role").textContent = LIVE.roleLabel(LIVE_USER.role) + (LIVE_USER.jawatan ? " · " + LIVE_USER.jawatan : "");
      $("#profile-pop").innerHTML = '<button type="button" class="pop-link" data-action="lt-pw">Tukar password</button>' + (LIVE_USER.role === "SUPER_ADMIN" ? '<a href="#access" class="pop-link">Pengguna & Akses</a>' : "") + '<button type="button" class="pop-link" data-live-logout>Log keluar</button>' + '<p class="pop-versi">SCE CENTRAL DEV · Versi ' + esc(LIVE.versi) + "</p>";
      $(".demo-pill").textContent = "DEV";
      // Bar DEV kuning hanya untuk mod pratonton (?demo=1). Label DEV di topbar sudah memadai.
      $(".demo-bar").hidden = true;
      $("#sidebar-foot").innerHTML = "SCE CENTRAL DEV<br>Versi " + esc(LIVE.versi);
      return;
    }
    $("#profile-avatar").textContent = me.charAt(0);
    $("#profile-name").textContent = me;
    $("#profile-role").textContent = SESSION.role;
    const links = [["workspace", "My Workspace"], ["notifications", "Notification Centre"], ["staff", "Staff Directory"], ["settings", "Company Settings"]].filter(([r]) => canRoute(r));
    $("#profile-pop").innerHTML = links.length ? links.map(([r, l]) => '<a href="#' + r + '" class="pop-link">' + esc(l) + "</a>").join("") : '<p class="small muted" style="padding:8px 12px">Akses baca sahaja.</p>';
    $("#demo-role").innerHTML = Object.keys(PERSONAS).map((k) => { const u = D.users.find((x) => x.name === PERSONAS[k]); return '<option value="' + k + '"' + (k === SESSION.persona ? " selected" : "") + ">" + esc(u.name) + " — " + esc(u.role) + (u.status === "Aktif" ? "" : " (tidak aktif)") + "</option>"; }).join("");
  }
  if (LIVE_USER) setInterval(() => { if (!document.hidden && !LD.busy.notif) { LD.err.notif = null; liveLoad("notif"); } }, 60000);
  function start() {
    if (firstSession || store.get(KEY_LOGIN)) { audit("Login (DEV demo)", "Sesi", me, "BERJAYA", "Pemilih role demo, bukan pengesahan sebenar"); store.del(KEY_LOGIN); }
    deadlineNotifications();
    save();
    $("#nav").innerHTML = NAV.map(([group, items]) => { const shown = items.filter(([id]) => canRoute(id) && !NAV_SOROK.includes(id)); return shown.length ? '<div class="nav-group"><div class="nav-label">' + group + "</div>" + shown.map(([id, label]) => '<a href="#' + id + '" data-route="' + id + '">' + icon(id) + "<span>" + esc(label) + "</span></a>").join("") + "</div>" : ""; }).join("");
    $("#menu-btn").innerHTML = icon("menu");
    renderIdentity();
    render(true);
    // Pautan dari emel: ?tugasan=SCE-TSK-... membuka butiran tugasan (selepas log masuk).
    const dariEmel = LIVE_USER && new URLSearchParams(location.search).get("tugasan");
    if (dariEmel && /^SCE-TSK-[0-9]{4}-[0-9]{4}$/.test(dariEmel)) {
      try { history.replaceState(null, "", location.pathname + "#tasks"); } catch (e) { /* abaikan */ }
      if (currentRoute() !== "tasks") location.hash = "#tasks";
      setTimeout(() => liveTaskOpen(dariEmel), 300);
    }
  }
  // Fail data kewangan hanya diminta untuk role yang mempunyai finance.view.
  if (can("finance.view")) {
    const s = document.createElement("script");
    s.src = "assets/js/finance-demo-data.js";
    s.onload = () => { initFinance(); start(); };
    s.onerror = () => { start(); toast("Data kewangan contoh tidak dapat dimuatkan."); };
    document.head.appendChild(s);
  } else {
    start();
  }
})();
