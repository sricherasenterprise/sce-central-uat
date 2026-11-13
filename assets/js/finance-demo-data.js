/*
 * DATA CONTOH KEWANGAN (fiksyen, DEV sahaja).
 * Fail ini hanya dimuatkan oleh app.js apabila role sesi mempunyai kebenaran finance.view.
 * Pada fasa integrasi, gantikan dengan API kewangan yang menolak role lain di backend.
 * Amaun dalam RM. Offset tarikh dikira daripada hari ini (GMT+8).
 */
window.SCE_FINANCE_DEMO = {
  months: {
    rev: [182000, 176500, 195400, 201300, 188900, 214600, 207300, 223800, 216400, 231200, 225700, 238900],
    projek: [72000, 69500, 78800, 80100, 74300, 86200, 82900, 90400, 86700, 92300, 91100, 95200],
    kontraktor: [38500, 37200, 41000, 43900, 40200, 45100, 44700, 47900, 46200, 49800, 48300, 51200],
    operasi: [29800, 30100, 30600, 31200, 30900, 32400, 31800, 32900, 33100, 33700, 34000, 34800]
  },
  // Mengikut nombor projek: [belanjawan, kos semasa]
  budgets: {
    1: [180000, 104000], 2: [95000, 88500], 3: [60000, 4200], 4: [240000, 168000], 5: [72000, 69800], 6: [110000, 21000],
    7: [130000, 58200], 8: [86000, 81300], 9: [48000, 1500], 10: [54000, 52100], 11: [150000, 117600], 12: [66000, 7400]
  },
  // [id, kategori, keterangan, amaun, offset, pencipta, status]
  expenses: [
    ["EXP-501", "Kos Projek", "Bekalan contoh Projek Delta", 8450, -1, "Pengurus Contoh 2", "Diluluskan"],
    ["EXP-502", "Operasi", "Utiliti pejabat contoh", 2310, -3, "Pengurus Contoh 2", "Diluluskan"],
    ["EXP-503", "Kontraktor", "Bayaran kemajuan contoh", 15200, -5, "Pengurus Contoh 1", "Diluluskan"],
    ["EXP-504", "Operasi", "Langganan perisian contoh", 980, -8, "Pengurus Contoh 1", "Diluluskan"]
  ],
  // [id, keterangan, amaun, offset, pencipta, status]
  incomes: [
    ["INC-551", "Bayaran kemajuan contoh daripada pelanggan", 42000, -2, "Pengurus Contoh 2", "Diluluskan"]
  ],
  // [id, kontraktor, work order, amaun, status, offset, pencipta, bank bertopeng]
  payments: [
    ["PAY-601", "Kontraktor Contoh A", "WO-301", 18500, "Menunggu Kelulusan", -1, "Pengurus Contoh 2", "****1201"],
    ["PAY-602", "Kontraktor Contoh C", "WO-303", 9200, "Dibayar", -6, "Pengurus Contoh 2", "****3302"],
    ["PAY-603", "Kontraktor Contoh B", "WO-302", 12750, "Menunggu Kelulusan", -2, "Amir", "****2207"],
    ["PAY-604", "Kontraktor Contoh E", "WO-304", 7400, "Dibayar", -11, "Pengurus Contoh 1", "****5104"]
  ],
  // [id, nama, nombor projek, pemilik, versi, offset, saiz]
  documents: [
    ["DOC-705", "Ringkasan Kewangan Contoh.xlsx", 11, "Pengurus Contoh 2", 4, -3, "310 KB"]
  ],
  // Tugasan yang mendedahkan butiran kewangan: [id, tajuk, nombor projek, pemberi, penerima, offset]
  tasks: [
    ["TSK-111", "Semak invois contoh", 11, "Pengurus Contoh 1", "Pengurus Contoh 2", 1]
  ]
};
