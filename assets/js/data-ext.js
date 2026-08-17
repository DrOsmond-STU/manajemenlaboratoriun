/* ==========================================================================
   FLMS — Perluasan data: Balanced Scorecard, Checklist, Notifikasi Email
   ========================================================================== */
(function () {
  const D = window.DB;
  const shift = D.shift;

  /* =======================================================================
     BALANCED SCORECARD
     Empat perspektif Kaplan & Norton, masing-masing berisi sasaran strategis
     dan KPI dengan bobot, target, realisasi, serta polaritas.
     ======================================================================= */
  D.bsc = {
    period: "Semester I 2026",
    unit: "Balai Besar Laboratorium Pengujian Semesta",
    perspectives: [
      {
        k: "F", name: "Finansial", weight: 30, color: "var(--green-500)", tint: "green",
        desc: "Kemandirian anggaran dan efisiensi biaya pengelolaan fasilitas",
        objectives: [
          {
            name: "Meningkatkan pendapatan layanan dan sewa fasilitas",
            kpis: [
              { name: "Pendapatan sewa fasilitas", unit: "Rp juta", weight: 40, target: 600, actual: 490, pol: "max" },
              { name: "Pendapatan jasa pengujian laboratorium", unit: "Rp juta", weight: 25, target: 340, actual: 362, pol: "max" }
            ]
          },
          {
            name: "Mengendalikan biaya operasional dan pemeliharaan",
            kpis: [
              { name: "Realisasi biaya maintenance terhadap pagu", unit: "%", weight: 20, target: 95, actual: 79, pol: "min" },
              { name: "Biaya pemeliharaan per m² fasilitas", unit: "Rp ribu", weight: 15, target: 185, actual: 168, pol: "min" }
            ]
          }
        ]
      },
      {
        k: "C", name: "Pelanggan & Pengguna Layanan", weight: 25, color: "var(--brand-500)", tint: "brand",
        desc: "Kepuasan pengguna internal dan pelanggan eksternal atas layanan fasilitas",
        objectives: [
          {
            name: "Meningkatkan kepuasan pengguna fasilitas",
            kpis: [
              { name: "Indeks kepuasan pengguna", unit: "skala 5", weight: 35, target: 4.5, actual: 4.6, pol: "max" },
              { name: "Keluhan layanan tertangani tepat waktu", unit: "%", weight: 25, target: 95, actual: 91, pol: "max" }
            ]
          },
          {
            name: "Menjamin ketersediaan fasilitas saat dibutuhkan",
            kpis: [
              { name: "Permintaan booking terpenuhi", unit: "%", weight: 25, target: 92, actual: 95, pol: "max" },
              { name: "Tingkat pembatalan oleh pengelola", unit: "%", weight: 15, target: 3, actual: 4.2, pol: "min" }
            ]
          }
        ]
      },
      {
        k: "P", name: "Proses Bisnis Internal", weight: 30, color: "var(--violet-500)", tint: "violet",
        desc: "Efektivitas proses booking, pemeliharaan, kalibrasi, dan penatausahaan aset",
        objectives: [
          {
            name: "Mengoptimalkan pemanfaatan fasilitas dan alat",
            kpis: [
              { name: "Utilisasi ruangan", unit: "%", weight: 20, target: 70, actual: 74, pol: "max" },
              { name: "Utilisasi laboratorium", unit: "%", weight: 20, target: 75, actual: 81, pol: "max" },
              { name: "Availability alat laboratorium", unit: "%", weight: 15, target: 92, actual: 88.9, pol: "max" }
            ]
          },
          {
            name: "Menjaga kepatuhan pemeliharaan dan kalibrasi",
            kpis: [
              { name: "Kepatuhan jadwal kalibrasi", unit: "%", weight: 25, target: 100, actual: 70, pol: "max" },
              { name: "Preventive maintenance terlaksana", unit: "%", weight: 10, target: 90, actual: 86, pol: "max" }
            ]
          },
          {
            name: "Menertibkan penatausahaan BMN",
            kpis: [
              { name: "Aset terekonsiliasi saat audit", unit: "%", weight: 10, target: 100, actual: 89.3, pol: "max" }
            ]
          }
        ]
      },
      {
        k: "L", name: "Pembelajaran & Pertumbuhan", weight: 15, color: "var(--amber-500)", tint: "amber",
        desc: "Kompetensi SDM, digitalisasi, dan budaya kerja pengelolaan fasilitas",
        objectives: [
          {
            name: "Meningkatkan kompetensi pengelola dan teknisi",
            kpis: [
              { name: "Teknisi bersertifikat kompetensi", unit: "%", weight: 35, target: 80, actual: 73, pol: "max" },
              { name: "Jam pelatihan per pegawai", unit: "jam", weight: 25, target: 20, actual: 22, pol: "max" }
            ]
          },
          {
            name: "Mendorong adopsi sistem digital",
            kpis: [
              { name: "Adopsi aplikasi oleh pengguna", unit: "%", weight: 25, target: 85, actual: 75, pol: "max" },
              { name: "Transaksi diproses tanpa dokumen kertas", unit: "%", weight: 15, target: 70, actual: 64, pol: "max" }
            ]
          }
        ]
      }
    ],
    trend: [
      { m: "Feb", F: 68, C: 79, P: 74, L: 66 },
      { m: "Mar", F: 71, C: 81, P: 76, L: 68 },
      { m: "Apr", F: 74, C: 83, P: 79, L: 71 },
      { m: "Mei", F: 77, C: 86, P: 82, L: 74 },
      { m: "Jun", F: 80, C: 88, P: 84, L: 77 },
      { m: "Jul", F: 82, C: 90, P: 86, L: 79 }
    ]
  };

  /** Skor satu KPI (0–120%), memperhatikan polaritas maksimum/minimum. */
  D.bscScore = function (kpi) {
    if (!kpi.target) return 0;
    const r = kpi.pol === "min" ? kpi.target / (kpi.actual || kpi.target) : kpi.actual / kpi.target;
    return Math.max(0, Math.min(120, Math.round(r * 1000) / 10));
  };
  /** Skor perspektif = rata-rata tertimbang KPI di dalamnya. */
  D.bscPerspectiveScore = function (p) {
    let sum = 0, w = 0;
    p.objectives.forEach((o) => o.kpis.forEach((k) => { sum += D.bscScore(k) * k.weight; w += k.weight; }));
    return w ? Math.round((sum / w) * 10) / 10 : 0;
  };
  /** Skor total = rata-rata tertimbang perspektif. */
  D.bscTotal = function () {
    let sum = 0, w = 0;
    D.bsc.perspectives.forEach((p) => { sum += D.bscPerspectiveScore(p) * p.weight; w += p.weight; });
    return w ? Math.round((sum / w) * 10) / 10 : 0;
  };
  D.bscStatus = function (s) {
    if (s >= 100) return { t: "Tercapai", c: "green" };
    if (s >= 90) return { t: "Hampir Tercapai", c: "amber" };
    if (s >= 75) return { t: "Perlu Perhatian", c: "amber" };
    return { t: "Di Bawah Target", c: "red" };
  };

  /* =======================================================================
     CHECKLIST
     Template dibuat & dikelola pengguna, melekat pada ruangan / peralatan,
     serta ditugaskan kepada pengguna tertentu.
     ======================================================================= */
  D.checklistTypes = [
    { k: "verifikasi", n: "Pengecekan & Verifikasi", icon: "shield", tint: "brand" },
    { k: "perawatan", n: "Perawatan", icon: "wrench", tint: "violet" },
    { k: "sewa", n: "Persiapan Penyewaan", icon: "money", tint: "amber" },
    { k: "kebersihan", n: "Kebersihan", icon: "sparkle", tint: "teal" },
    { k: "kerapian", n: "Kerapian", icon: "layout", tint: "slate" },
    { k: "kelayakan", n: "Kelayakan", icon: "check", tint: "green" }
  ];

  D.checklistItemKinds = [
    { k: "ok", n: "OK / Tidak OK / N-A" },
    { k: "rating", n: "Skala 1–5" },
    { k: "angka", n: "Isian angka" },
    { k: "teks", n: "Isian teks" },
    { k: "foto", n: "Lampiran foto" },
    { k: "ttd", n: "Tanda tangan" }
  ];

  D.checklistFreq = ["Harian", "Mingguan", "Bulanan", "Triwulanan", "Semesteran", "Tahunan",
    "Sebelum Penggunaan", "Setelah Penggunaan", "Insidental"];

  const I = (t, kind, req, hint) => ({ t, kind: kind || "ok", req: req !== false, hint: hint || "" });

  D.checklistTemplates = [
    {
      id: "CL-TPL-001", name: "Pengecekan Harian Laboratorium", type: "verifikasi",
      target: "ruangan", freq: "Harian", estMin: 15, active: true, owner: "EMP-0002",
      assignees: ["EMP-0003", "EMP-0010"], scope: ["LAB-001", "LAB-002", "LAB-004"],
      failAction: "workorder",
      items: [
        I("Suhu ruangan sesuai rentang 20–25 °C", "angka", true, "Catat nilai dalam °C"),
        I("Kelembapan relatif dalam rentang 40–60 %", "angka"),
        I("Fume hood berfungsi dan aliran udara normal"),
        I("Emergency shower dan eye wash berfungsi"),
        I("APAR terpasang, tekanan pada zona hijau"),
        I("Tidak ada tumpahan bahan kimia"),
        I("Limbah B3 tertampung pada wadah berlabel"),
        I("Pintu darurat tidak terhalang"),
        I("Foto kondisi umum laboratorium", "foto", false),
        I("Tanda tangan petugas", "ttd")
      ]
    },
    {
      id: "CL-TPL-002", name: "Perawatan Bulanan Alat Laboratorium", type: "perawatan",
      target: "peralatan", freq: "Bulanan", estMin: 40, active: true, owner: "EMP-0003",
      assignees: ["EMP-0003"], scope: ["EQ-0001", "EQ-0002", "EQ-0008", "EQ-0009"],
      failAction: "workorder",
      items: [
        I("Bodi dan permukaan alat bersih dari debu dan residu"),
        I("Kabel daya dan konektor tidak cacat"),
        I("Filter/kolom dalam kondisi layak pakai"),
        I("Cek kebocoran pada sambungan"),
        I("Pelumasan bagian bergerak (bila ada)", "ok", false),
        I("Uji fungsi singkat berhasil"),
        I("Nilai akurasi hasil uji kontrol", "angka", false, "Deviasi terhadap standar (%)"),
        I("Catatan kondisi", "teks", false),
        I("Foto sesudah perawatan", "foto")
      ]
    },
    {
      id: "CL-TPL-003", name: "Persiapan Penyewaan Ruangan", type: "sewa",
      target: "ruangan", freq: "Sebelum Penggunaan", estMin: 25, active: true, owner: "EMP-0005",
      assignees: ["EMP-0005", "EMP-0011", "EMP-0001"], scope: ["RM-003", "RM-004", "RM-005", "RM-010"],
      failAction: "notifikasi",
      items: [
        I("Layout ruangan sesuai pesanan"),
        I("Jumlah kursi dan meja sesuai jumlah peserta", "angka"),
        I("Proyektor / LED screen menyala dan fokus"),
        I("Sound system dan mikrofon diuji"),
        I("Pendingin ruangan menyala 30 menit sebelum acara"),
        I("Jaringan WiFi tersedia dan diuji"),
        I("Air mineral dan konsumsi telah disiapkan", "ok", false),
        I("Papan penunjuk arah terpasang", "ok", false),
        I("Foto ruangan siap pakai", "foto"),
        I("Tanda tangan petugas persiapan", "ttd")
      ]
    },
    {
      id: "CL-TPL-004", name: "Kebersihan Harian Ruangan", type: "kebersihan",
      target: "ruangan", freq: "Harian", estMin: 12, active: true, owner: "EMP-0001",
      assignees: ["EMP-0011"], scope: ["RM-001", "RM-002", "RM-003", "RM-004", "RM-009"],
      failAction: "notifikasi",
      items: [
        I("Lantai disapu dan dipel"),
        I("Meja dan kursi dilap bersih"),
        I("Tempat sampah dikosongkan"),
        I("Kaca dan cermin bersih"),
        I("Toilet terdekat bersih dan wangi"),
        I("Tingkat kebersihan keseluruhan", "rating"),
        I("Foto kondisi akhir", "foto", false)
      ]
    },
    {
      id: "CL-TPL-005", name: "Kerapian Ruang Kerja & Laboratorium (5R)", type: "kerapian",
      target: "keduanya", freq: "Mingguan", estMin: 18, active: true, owner: "EMP-0001",
      assignees: ["EMP-0011", "EMP-0003", "EMP-0001"], scope: ["LAB-001", "LAB-003", "RM-001", "RM-008", "RM-004"],
      failAction: "notifikasi",
      items: [
        I("Ringkas — barang tidak terpakai telah disingkirkan", "rating"),
        I("Rapi — setiap barang pada tempatnya, berlabel", "rating"),
        I("Resik — area bebas debu dan noda", "rating"),
        I("Rawat — standar kerapian terpasang di area", "rating"),
        I("Rajin — jadwal 5R dipatuhi", "rating"),
        I("Kabel tertata dan tidak melintang di jalur orang"),
        I("Dokumen dan manual tersimpan pada rak", "ok", false),
        I("Catatan perbaikan", "teks", false)
      ]
    },
    {
      id: "CL-TPL-006", name: "Kelayakan Alat Sebelum Digunakan", type: "kelayakan",
      target: "peralatan", freq: "Sebelum Penggunaan", estMin: 8, active: true, owner: "EMP-0002",
      assignees: ["EMP-0003", "EMP-0010", "EMP-0002"], scope: ["EQ-0001", "EQ-0002", "EQ-0003", "EQ-0010", "EQ-0017"],
      failAction: "blokir",
      items: [
        I("Sertifikat kalibrasi masih berlaku"),
        I("Tidak ada label rusak / dalam perbaikan"),
        I("Kondisi fisik tanpa kerusakan tampak"),
        I("Alat menyala dan lolos self-test"),
        I("Kelengkapan aksesori sesuai daftar"),
        I("APD tersedia bagi pengguna"),
        I("Operator telah tersertifikasi untuk alat ini"),
        I("Tanda tangan verifikator", "ttd")
      ]
    }
  ];

  D.checklistRecords = [
    { id: "CLR-2026-01201", tpl: "CL-TPL-001", res: "LAB-001", by: "EMP-0003", date: shift(0), time: "07:45", status: "Selesai", score: 100, ok: 10, fail: 0, note: "Seluruh parameter normal." },
    { id: "CLR-2026-01202", tpl: "CL-TPL-004", res: "RM-001", by: "EMP-0011", date: shift(0), time: "06:30", status: "Selesai", score: 100, ok: 7, fail: 0, note: "" },
    { id: "CLR-2026-01203", tpl: "CL-TPL-001", res: "LAB-002", by: "EMP-0010", date: shift(0), time: "08:05", status: "Temuan", score: 80, ok: 8, fail: 2, note: "Autoclave bocor, eye wash tekanan lemah." },
    { id: "CLR-2026-01204", tpl: "CL-TPL-003", res: "RM-004", by: "EMP-0005", date: shift(-1), time: "15:20", status: "Selesai", score: 100, ok: 10, fail: 0, note: "Siap untuk pelatihan ISO 17025." },
    { id: "CLR-2026-01205", tpl: "CL-TPL-006", res: "EQ-0003", by: "EMP-0003", date: shift(-1), time: "09:10", status: "Ditolak", score: 62, ok: 5, fail: 3, note: "Kalibrasi lewat jatuh tempo — alat diblokir." },
    { id: "CLR-2026-01206", tpl: "CL-TPL-005", res: "LAB-003", by: "EMP-0003", date: shift(-2), time: "16:00", status: "Selesai", score: 88, ok: 7, fail: 1, note: "Kabel di area meja anti getar perlu ditata." },
    { id: "CLR-2026-01207", tpl: "CL-TPL-002", res: "EQ-0001", by: "EMP-0003", date: shift(-4), time: "13:30", status: "Selesai", score: 100, ok: 9, fail: 0, note: "" },
    { id: "CLR-2026-01208", tpl: "CL-TPL-004", res: "RM-003", by: "EMP-0011", date: shift(-1), time: "06:40", status: "Temuan", score: 86, ok: 6, fail: 1, note: "Kaca jendela berdebu." }
  ];

  /** Tugas checklist yang jatuh tempo bagi pengguna tertentu. */
  D.checklistTasks = [
    { id: "CLT-9001", tpl: "CL-TPL-001", res: "LAB-004", due: shift(0), time: "08:00", assignee: "EMP-0010", status: "Jatuh Tempo Hari Ini" },
    { id: "CLT-9002", tpl: "CL-TPL-006", res: "EQ-0010", due: shift(0), time: "10:00", assignee: "EMP-0003", status: "Jatuh Tempo Hari Ini" },
    { id: "CLT-9003", tpl: "CL-TPL-003", res: "RM-010", due: shift(1), time: "07:00", assignee: "EMP-0005", status: "Terjadwal" },
    { id: "CLT-9004", tpl: "CL-TPL-004", res: "RM-009", due: shift(0), time: "06:30", assignee: "EMP-0011", status: "Terlambat" },
    { id: "CLT-9005", tpl: "CL-TPL-002", res: "EQ-0009", due: shift(2), time: "13:00", assignee: "EMP-0003", status: "Terjadwal" },
    { id: "CLT-9006", tpl: "CL-TPL-005", res: "RM-008", due: shift(3), time: "15:00", assignee: "EMP-0011", status: "Terjadwal" },
    { id: "CLT-9007", tpl: "CL-TPL-001", res: "LAB-001", due: shift(1), time: "07:30", assignee: "EMP-0003", status: "Terjadwal" },
    { id: "CLT-9008", tpl: "CL-TPL-005", res: "RM-001", due: shift(0), time: "14:00", assignee: "EMP-0001", status: "Jatuh Tempo Hari Ini" },
    { id: "CLT-9009", tpl: "CL-TPL-003", res: "RM-005", due: shift(1), time: "08:00", assignee: "EMP-0001", status: "Terjadwal" },
    { id: "CLT-9010", tpl: "CL-TPL-005", res: "LAB-003", due: shift(2), time: "10:00", assignee: "EMP-0001", status: "Terjadwal" },
    { id: "CLT-9011", tpl: "CL-TPL-001", res: "LAB-002", due: shift(0), time: "09:00", assignee: "EMP-0002", status: "Jatuh Tempo Hari Ini" },
    { id: "CLT-9012", tpl: "CL-TPL-006", res: "EQ-0017", due: shift(1), time: "11:00", assignee: "EMP-0002", status: "Terjadwal" },
    { id: "CLT-9013", tpl: "CL-TPL-002", res: "EQ-0008", due: shift(2), time: "09:30", assignee: "EMP-0004", status: "Terjadwal" },
    { id: "CLT-9014", tpl: "CL-TPL-005", res: "RM-004", due: shift(3), time: "13:00", assignee: "EMP-0006", status: "Terjadwal" }
  ];

  /* =======================================================================
     NOTIFIKASI EMAIL UNTUK SELURUH JADWAL
     ======================================================================= */
  D.emailEvents = [
    { k: "booking_baru", n: "Pengajuan booking ruangan / laboratorium", src: "Booking",
      to: ["PIC Resource", "Pemohon"], sched: ["Saat terjadi"], on: true },
    { k: "booking_setuju", n: "Booking disetujui / ditolak", src: "Booking",
      to: ["Pemohon", "PIC Resource"], sched: ["Saat terjadi"], on: true },
    { k: "booking_ingat", n: "Pengingat jadwal penggunaan ruangan", src: "Booking",
      to: ["Pemohon", "PIC Resource", "Peserta"], sched: ["H-1 07:00", "T-1 jam"], on: true },
    { k: "alat_reservasi", n: "Reservasi alat laboratorium", src: "Reservasi Alat",
      to: ["PIC Alat", "Kepala Lab", "Operator"], sched: ["Saat terjadi", "H-1 07:00"], on: true },
    { k: "alat_pinjam", n: "Jatuh tempo pengembalian alat / aset", src: "Peminjaman",
      to: ["Peminjam", "PIC Alat", "Atasan Peminjam"], sched: ["H-1 07:00", "Hari-H 07:00", "H+1 harian"], on: true },
    { k: "kalibrasi", n: "Jatuh tempo kalibrasi alat", src: "Kalibrasi",
      to: ["PIC Alat", "Kepala Lab", "Asset Manager"], sched: ["H-90", "H-30", "H-7", "Hari-H"], on: true },
    { k: "maintenance", n: "Jadwal maintenance / work order", src: "Maintenance",
      to: ["Teknisi", "PIC Resource", "Vendor"], sched: ["H-3 07:00", "Hari-H 06:00"], on: true },
    { k: "checklist", n: "Checklist jatuh tempo", src: "Checklist",
      to: ["Penanggung Jawab Checklist", "Pemilik Template"], sched: ["Hari-H 06:00", "H+1 bila belum dikerjakan"], on: true },
    { k: "checklist_temuan", n: "Temuan pada pelaksanaan checklist", src: "Checklist",
      to: ["PIC Resource", "Facility Manager"], sched: ["Saat terjadi"], on: true },
    { k: "event", n: "Jadwal event / kegiatan", src: "Event",
      to: ["PIC Event", "Vendor", "Security"], sched: ["H-7", "H-1", "Hari-H 06:00"], on: true },
    { k: "invoice", n: "Invoice terbit dan jatuh tempo", src: "Billing",
      to: ["Klien", "Finance"], sched: ["Saat terbit", "H-3", "Hari-H", "H+1 harian"], on: true },
    { k: "digest", n: "Ringkasan harian jadwal untuk penanggung jawab", src: "Semua Jadwal",
      to: ["Seluruh PIC"], sched: ["Setiap hari 06:30"], on: true }
  ];

  D.emailOutbox = [
    { id: "EM-2026-104821", to: "bayu.p@semestateknologi.co.id", name: "Bayu Prakoso", ev: "kalibrasi",
      subj: "[FLMS] Kalibrasi jatuh tempo — Atomic Absorption Spectrometer (H-7)", time: shift(0) + " 06:30", status: "Terkirim", open: true },
    { id: "EM-2026-104822", to: "dewi.a@semestateknologi.co.id", name: "Dewi Anggraini", ev: "digest",
      subj: "[FLMS] Ringkasan jadwal Anda hari ini — 4 agenda, 2 checklist", time: shift(0) + " 06:30", status: "Terkirim", open: true },
    { id: "EM-2026-104823", to: "andi.k@semestateknologi.co.id", name: "Andi Kurniawan", ev: "booking_ingat",
      subj: "[FLMS] Pengingat: Conference Room Garuda dipakai 09.00–11.00 hari ini", time: shift(0) + " 08:00", status: "Terkirim", open: false },
    { id: "EM-2026-104824", to: "tommy.s@semestateknologi.co.id", name: "Tommy Saputra", ev: "checklist",
      subj: "[FLMS] Checklist Kebersihan Harian — Meeting Room Epsilon jatuh tempo", time: shift(0) + " 06:00", status: "Terkirim", open: false },
    { id: "EM-2026-104825", to: "rina.m@semestateknologi.co.id", name: "Rina Marlina", ev: "checklist_temuan",
      subj: "[FLMS] Temuan checklist di Laboratorium Mikrobiologi — 2 butir tidak sesuai", time: shift(0) + " 08:12", status: "Terkirim", open: true },
    { id: "EM-2026-104826", to: "siti.n@semestateknologi.co.id", name: "Siti Nurhaliza", ev: "alat_pinjam",
      subj: "[FLMS] Terlambat 2 hari: Laptop Dell Latitude 5440 (LN-2026-00089)", time: shift(0) + " 07:00", status: "Terkirim", open: true },
    { id: "EM-2026-104827", to: "vendor@sonicnusantara.co.id", name: "PT Sonic Nusantara", ev: "maintenance",
      subj: "[FLMS] Jadwal maintenance sound system auditorium — H-3", time: shift(0) + " 07:05", status: "Antre", open: false },
    { id: "EM-2026-104828", to: "maya.l@semestateknologi.co.id", name: "Maya Lestari", ev: "invoice",
      subj: "[FLMS] Invoice INV-2026-0231 jatuh tempo dalam 3 hari", time: shift(0) + " 07:10", status: "Gagal", open: false },
    { id: "EM-2026-104829", to: "fajar.r@semestateknologi.co.id", name: "Fajar Ramadhan", ev: "event",
      subj: "[FLMS] H-1 National Tech Summit 2026 — Auditorium Wijaya Kusuma", time: shift(0) + " 06:45", status: "Terkirim", open: true },
    { id: "EM-2026-104830", to: "nadia.p@semestateknologi.co.id", name: "Nadia Putri", ev: "booking_setuju",
      subj: "[FLMS] Booking BK-2026-000431 disetujui", time: shift(-1) + " 09:02", status: "Terkirim", open: true }
  ];

  D.smtp = {
    host: "smtp.semestateknologi.co.id", port: 587, secure: "STARTTLS",
    user: "flms-notifikasi@semestateknologi.co.id",
    from: "FLMS Fasilitas & Laboratorium <no-reply@semestateknologi.co.id>",
    replyTo: "fasilitas@semestateknologi.co.id",
    rate: 120, retry: 3, status: "Terhubung"
  };

  /* Preferensi email per penanggung jawab */
  D.emailPrefs = D.people.slice(0, 8).map((p, i) => ({
    id: p.id, name: p.name, email: p.email, role: p.role,
    digest: true, instan: i % 4 !== 3, jam: ["06:30", "07:00", "06:30", "08:00"][i % 4],
    kanal: i % 3 === 0 ? ["Email", "WhatsApp"] : ["Email"],
    jadwal: [4, 6, 3, 2, 5, 1, 3, 2][i]
  }));
})();
