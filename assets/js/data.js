/* ==========================================================================
   FLMS — Dummy dataset for the UI/UX prototype
   Semua data di bawah ini fiktif dan hanya untuk keperluan purwarupa.
   ========================================================================== */
window.DB = (function () {

  const TODAY = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const shift = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return iso(d); };

  /* ---------- Organisasi & SDM ---------- */
  const org = {
    company: "PT Semesta Teknologi Utama",
    units: ["Litbang", "Produksi", "QHSE", "Umum & Fasilitas", "Keuangan", "SDM", "IT", "Pemasaran"],
    buildings: [
      { code: "GA", name: "Gedung A — Riset", floors: 4 },
      { code: "GB", name: "Gedung B — Perkantoran", floors: 6 },
      { code: "GC", name: "Gedung C — Auditorium & Training", floors: 3 },
      { code: "GD", name: "Gedung D — Workshop & Gudang", floors: 2 }
    ],
    locations: ["Kampus Utama Cikarang", "Kantor Pusat Jakarta", "Site Balikpapan"]
  };

  const people = [
    { id: "EMP-0001", name: "Rahmat Hidayat", nip: "198703112010011002", role: "Facility Manager", unit: "Umum & Fasilitas", email: "rahmat.h@semestateknologi.co.id", phone: "0811-2200-101", comp: "Facility Mgmt, K3 Umum", status: "Aktif" },
    { id: "EMP-0002", name: "Dewi Anggraini", nip: "199001222014032001", role: "Laboratory Manager", unit: "Litbang", email: "dewi.a@semestateknologi.co.id", phone: "0811-2200-102", comp: "Kimia Analitik, ISO 17025", status: "Aktif" },
    { id: "EMP-0003", name: "Bayu Prakoso", nip: "199205102016011005", role: "Lab Technician", unit: "Litbang", email: "bayu.p@semestateknologi.co.id", phone: "0811-2200-103", comp: "Kalibrasi, Instrumentasi", status: "Aktif" },
    { id: "EMP-0004", name: "Siti Nurhaliza", nip: "198811052012032004", role: "Asset Manager", unit: "Umum & Fasilitas", email: "siti.n@semestateknologi.co.id", phone: "0811-2200-104", comp: "Asset Mgmt, Audit Aset", status: "Aktif" },
    { id: "EMP-0005", name: "Andi Kurniawan", nip: "199408192018011003", role: "Room Administrator", unit: "Umum & Fasilitas", email: "andi.k@semestateknologi.co.id", phone: "0811-2200-105", comp: "Scheduling, AV Support", status: "Aktif" },
    { id: "EMP-0006", name: "Maya Lestari", nip: "199112302015032002", role: "Finance", unit: "Keuangan", email: "maya.l@semestateknologi.co.id", phone: "0811-2200-106", comp: "AR/AP, Tax", status: "Aktif" },
    { id: "EMP-0007", name: "Fajar Ramadhan", nip: "199603242019011007", role: "Event Manager", unit: "Pemasaran", email: "fajar.r@semestateknologi.co.id", phone: "0811-2200-107", comp: "MICE, Event Ops", status: "Aktif" },
    { id: "EMP-0008", name: "Nadia Putri", nip: "199709142021032003", role: "Employee", unit: "IT", email: "nadia.p@semestateknologi.co.id", phone: "0811-2200-108", comp: "Network", status: "Aktif" },
    { id: "EMP-0009", name: "Hendra Wijaya", nip: "198502172009011001", role: "Management", unit: "Direktorat", email: "hendra.w@semestateknologi.co.id", phone: "0811-2200-109", comp: "Strategic", status: "Aktif" },
    { id: "EMP-0010", name: "Rina Marlina", nip: "199310072017032006", role: "Lab Technician", unit: "QHSE", email: "rina.m@semestateknologi.co.id", phone: "0811-2200-110", comp: "Uji Lingkungan", status: "Aktif" },
    { id: "EMP-0011", name: "Tommy Saputra", nip: "199806152022011004", role: "Technician", unit: "Umum & Fasilitas", email: "tommy.s@semestateknologi.co.id", phone: "0811-2200-111", comp: "HVAC, Elektrikal", status: "Aktif" },
    { id: "EMP-0012", name: "Lia Kusuma", nip: "199501282019032008", role: "PIC", unit: "Produksi", email: "lia.k@semestateknologi.co.id", phone: "0811-2200-112", comp: "Produksi", status: "Cuti" }
  ];

  /* ---------- Ruangan / Fasilitas ---------- */
  const rooms = [
    { id: "RM-001", code: "MR-A-201", name: "Meeting Room Alpha", type: "Meeting Room", building: "GB", floor: 2, area: 42, cap: 16, pricing: "FREE_INTERNAL", rate: 350000, status: "Available", pic: "EMP-0005", layout: ["Boardroom", "U-Shape"], facs: ["Proyektor", "TV 65\"", "Video Conf", "Whiteboard", "AC", "WiFi"], util: 78 },
    { id: "RM-002", code: "MR-B-305", name: "Meeting Room Beta", type: "Meeting Room", building: "GB", floor: 3, area: 28, cap: 10, pricing: "FREE_INTERNAL", rate: 250000, status: "Booked", pic: "EMP-0005", layout: ["Boardroom"], facs: ["TV 55\"", "Video Conf", "Whiteboard", "AC"], util: 64 },
    { id: "RM-003", code: "CR-B-401", name: "Conference Room Garuda", type: "Conference Room", building: "GB", floor: 4, area: 96, cap: 45, pricing: "PAID", rate: 1250000, status: "Available", pic: "EMP-0005", layout: ["Theater", "Classroom", "U-Shape"], facs: ["Proyektor 2x", "Sound System", "Mic Wireless 4", "Video Conf", "AC", "Panggung Kecil"], util: 71 },
    { id: "RM-004", code: "TR-C-102", name: "Training Room Nusantara", type: "Training Room", building: "GC", floor: 1, area: 120, cap: 60, pricing: "PAID", rate: 1800000, status: "Available", pic: "EMP-0005", layout: ["Classroom", "Cluster", "Theater"], facs: ["Proyektor", "Sound System", "Flipchart", "Laptop 20", "AC", "Pantry"], util: 83 },
    { id: "RM-005", code: "AU-C-001", name: "Auditorium Wijaya Kusuma", type: "Auditorium", building: "GC", floor: 1, area: 620, cap: 450, pricing: "PAID", rate: 12500000, status: "Available", pic: "EMP-0007", layout: ["Theater", "Banquet"], facs: ["Stage 12x6m", "LED Screen 6x3m", "Line Array", "Lighting Rig", "Mic 8", "Ruang Ganti", "Lobby Registrasi"], util: 52 },
    { id: "RM-006", code: "MR-A-105", name: "Meeting Room Delta", type: "Meeting Room", building: "GA", floor: 1, area: 24, cap: 8, pricing: "INTERNAL", rate: 0, status: "Maintenance", pic: "EMP-0005", layout: ["Boardroom"], facs: ["TV 50\"", "Whiteboard", "AC"], util: 41 },
    { id: "RM-007", code: "VIP-B-601", name: "VIP Room Cendana", type: "VIP", building: "GB", floor: 6, area: 36, cap: 12, pricing: "RESTRICTED", rate: 0, status: "Reserved", pic: "EMP-0001", layout: ["Boardroom"], facs: ["TV 75\"", "Video Conf", "Sofa Lounge", "Pantry Privat", "AC"], util: 33 },
    { id: "RM-008", code: "WS-D-101", name: "Workshop Prototyping", type: "Workshop", building: "GD", floor: 1, area: 180, cap: 30, pricing: "INTERNAL", rate: 0, status: "Available", pic: "EMP-0011", layout: ["Cluster"], facs: ["Meja Kerja 10", "Exhaust", "Panel Listrik 3 Fasa", "Toolset", "APAR"], util: 57 },
    { id: "RM-009", code: "MR-A-302", name: "Meeting Room Epsilon", type: "Meeting Room", building: "GA", floor: 3, area: 30, cap: 12, pricing: "FREE_INTERNAL", rate: 300000, status: "Available", pic: "EMP-0005", layout: ["Boardroom", "U-Shape"], facs: ["Proyektor", "Video Conf", "Whiteboard", "AC"], util: 69 },
    { id: "RM-010", code: "SG-C-201", name: "Ruang Serbaguna Merapi", type: "Serbaguna", building: "GC", floor: 2, area: 240, cap: 150, pricing: "PAID", rate: 4500000, status: "Available", pic: "EMP-0007", layout: ["Theater", "Banquet", "Classroom", "Cluster"], facs: ["Sound System", "Proyektor", "Panggung Portable", "AC", "Kursi 150"], util: 61 }
  ];

  /* ---------- Laboratorium ---------- */
  const labs = [
    { id: "LAB-001", code: "LAB-KIM-01", name: "Laboratorium Kimia Analitik", building: "GA", floor: 2, area: 145, cap: 24, type: "Pengujian", status: "Aktif", pic: "EMP-0002", supervisor: "EMP-0002", tech: ["EMP-0003"], hours: "07:30 – 17:00", equip: 18, assets: 46, util: 82, accred: "ISO/IEC 17025:2017", facs: ["Fume Hood 4", "Meja Preparasi", "Emergency Shower", "Eye Wash", "APAR CO2", "AC", "CCTV", "UPS 10kVA"] },
    { id: "LAB-002", code: "LAB-MIK-01", name: "Laboratorium Mikrobiologi", building: "GA", floor: 2, area: 98, cap: 16, type: "Pengujian", status: "Aktif", pic: "EMP-0010", supervisor: "EMP-0002", tech: ["EMP-0010"], hours: "07:30 – 16:30", equip: 12, assets: 31, util: 74, accred: "ISO/IEC 17025:2017", facs: ["Biosafety Cabinet 2", "Autoclave", "Ruang Steril", "Incubator Room", "APAR", "AC", "CCTV"] },
    { id: "LAB-003", code: "LAB-FIS-01", name: "Laboratorium Fisika Material", building: "GA", floor: 3, area: 132, cap: 20, type: "Riset", status: "Aktif", pic: "EMP-0003", supervisor: "EMP-0002", tech: ["EMP-0003"], hours: "08:00 – 17:00", equip: 15, assets: 38, util: 66, accred: "—", facs: ["Meja Anti Getar", "Chamber Suhu", "Panel 3 Fasa", "UPS 20kVA", "AC Presisi", "CCTV"] },
    { id: "LAB-004", code: "LAB-LNG-01", name: "Laboratorium Uji Lingkungan", building: "GA", floor: 1, area: 110, cap: 18, type: "Pengujian", status: "Aktif", pic: "EMP-0010", supervisor: "EMP-0002", tech: ["EMP-0010", "EMP-0003"], hours: "07:00 – 16:00", equip: 14, assets: 29, util: 71, accred: "KAN LP-1234-IDN", facs: ["Fume Hood 2", "Ruang Sampel", "Cold Storage", "APAR", "AC", "Emergency Shower"] },
    { id: "LAB-005", code: "LAB-KAL-01", name: "Laboratorium Kalibrasi", building: "GA", floor: 4, area: 86, cap: 10, type: "Kalibrasi", status: "Aktif", pic: "EMP-0003", supervisor: "EMP-0002", tech: ["EMP-0003"], hours: "08:00 – 16:00", equip: 9, assets: 22, util: 48, accred: "ISO/IEC 17025:2017", facs: ["Ruang Terkendali 20±2°C", "Dehumidifier", "Meja Granit", "UPS", "CCTV"] },
    { id: "LAB-006", code: "LAB-KOM-01", name: "Laboratorium Komputasi & IoT", building: "GA", floor: 3, area: 74, cap: 30, type: "Riset", status: "Renovasi", pic: "EMP-0008", supervisor: "EMP-0002", tech: [], hours: "08:00 – 20:00", equip: 6, assets: 54, util: 12, accred: "—", facs: ["Workstation 30", "Server Rack", "AC Presisi", "UPS 15kVA", "Jaringan 10G"] }
  ];

  /* ---------- Alat Laboratorium ---------- */
  const equipment = [
    { id: "EQ-0001", code: "HPLC-001", name: "HPLC Shimadzu LC-2050", cat: "Kromatografi", brand: "Shimadzu", model: "LC-2050C 3D", sn: "SHZ-LC-88421", year: 2022, lab: "LAB-001", pic: "EMP-0003", status: "In Use", cond: "Baik", calDue: shift(28), price: 890000000, needsOperator: true },
    { id: "EQ-0002", code: "GCMS-001", name: "GC-MS Agilent 8890/5977B", cat: "Kromatografi", brand: "Agilent", model: "8890 GC / 5977B MSD", sn: "AGL-GC-30112", year: 2021, lab: "LAB-001", pic: "EMP-0003", status: "Available", cond: "Baik", calDue: shift(96), price: 1450000000, needsOperator: true },
    { id: "EQ-0003", code: "AAS-001", name: "Atomic Absorption Spectrometer", cat: "Spektroskopi", brand: "PerkinElmer", model: "PinAAcle 900T", sn: "PKE-AA-55210", year: 2020, lab: "LAB-001", pic: "EMP-0003", status: "Calibration", cond: "Baik", calDue: shift(4), price: 720000000, needsOperator: true },
    { id: "EQ-0004", code: "FTIR-001", name: "FTIR Spectrometer", cat: "Spektroskopi", brand: "Thermo Fisher", model: "Nicolet iS20", sn: "THF-IR-77341", year: 2023, lab: "LAB-001", pic: "EMP-0003", status: "Available", cond: "Baik", calDue: shift(140), price: 560000000, needsOperator: false },
    { id: "EQ-0005", code: "AUTO-001", name: "Autoclave Vertikal 100L", cat: "Sterilisasi", brand: "Hirayama", model: "HVE-110", sn: "HRY-AC-11902", year: 2019, lab: "LAB-002", pic: "EMP-0010", status: "Maintenance", cond: "Perlu Perbaikan", calDue: shift(-6), price: 185000000, needsOperator: false },
    { id: "EQ-0006", code: "BSC-002", name: "Biosafety Cabinet Class II", cat: "Safety", brand: "Esco", model: "AC2-4E8", sn: "ESC-BS-40213", year: 2021, lab: "LAB-002", pic: "EMP-0010", status: "Available", cond: "Baik", calDue: shift(51), price: 210000000, needsOperator: false },
    { id: "EQ-0007", code: "MICR-003", name: "Mikroskop Fluoresensi", cat: "Optik", brand: "Olympus", model: "BX53F2", sn: "OLY-MC-66120", year: 2022, lab: "LAB-002", pic: "EMP-0010", status: "Borrowed", cond: "Baik", calDue: shift(74), price: 340000000, needsOperator: false },
    { id: "EQ-0008", code: "XRD-001", name: "X-Ray Diffractometer", cat: "Analisis Material", brand: "Bruker", model: "D8 Advance", sn: "BRK-XR-90014", year: 2020, lab: "LAB-003", pic: "EMP-0003", status: "Reserved", cond: "Baik", calDue: shift(19), price: 2100000000, needsOperator: true },
    { id: "EQ-0009", code: "SEM-001", name: "Scanning Electron Microscope", cat: "Analisis Material", brand: "JEOL", model: "JSM-IT200", sn: "JEO-SM-12300", year: 2023, lab: "LAB-003", pic: "EMP-0003", status: "In Use", cond: "Baik", calDue: shift(120), price: 3400000000, needsOperator: true },
    { id: "EQ-0010", code: "UTM-001", name: "Universal Testing Machine 100kN", cat: "Mekanik", brand: "Instron", model: "5982", sn: "INS-UT-31221", year: 2018, lab: "LAB-003", pic: "EMP-0003", status: "Available", cond: "Baik", calDue: shift(11), price: 950000000, needsOperator: true },
    { id: "EQ-0011", code: "TOC-001", name: "TOC Analyzer", cat: "Analisis Air", brand: "Shimadzu", model: "TOC-L CSH", sn: "SHZ-TC-20481", year: 2021, lab: "LAB-004", pic: "EMP-0010", status: "Available", cond: "Baik", calDue: shift(63), price: 410000000, needsOperator: false },
    { id: "EQ-0012", code: "HVS-001", name: "High Volume Air Sampler", cat: "Sampling", brand: "Tisch", model: "TE-5170", sn: "TSC-HV-77012", year: 2019, lab: "LAB-004", pic: "EMP-0010", status: "Borrowed", cond: "Baik", calDue: shift(-2), price: 125000000, needsOperator: false },
    { id: "EQ-0013", code: "CALB-001", name: "Dead Weight Tester", cat: "Kalibrasi", brand: "Fluke", model: "P3125", sn: "FLK-DW-55901", year: 2020, lab: "LAB-005", pic: "EMP-0003", status: "Available", cond: "Baik", calDue: shift(33), price: 280000000, needsOperator: true },
    { id: "EQ-0014", code: "CALB-002", name: "Multifunction Calibrator", cat: "Kalibrasi", brand: "Fluke", model: "5522A", sn: "FLK-MC-66044", year: 2021, lab: "LAB-005", pic: "EMP-0003", status: "Available", cond: "Baik", calDue: shift(7), price: 465000000, needsOperator: true },
    { id: "EQ-0015", code: "CHM-002", name: "Climatic Chamber 250L", cat: "Pengkondisian", brand: "Memmert", model: "CTC256", sn: "MMT-CC-30871", year: 2022, lab: "LAB-003", pic: "EMP-0003", status: "Broken", cond: "Rusak", calDue: shift(-21), price: 320000000, needsOperator: false },
    { id: "EQ-0016", code: "PH-004", name: "pH Meter Benchtop", cat: "Elektrokimia", brand: "Mettler Toledo", model: "S220", sn: "MTL-PH-91233", year: 2023, lab: "LAB-004", pic: "EMP-0010", status: "Available", cond: "Baik", calDue: shift(15), price: 42000000, needsOperator: false },
    { id: "EQ-0017", code: "BAL-006", name: "Neraca Analitik 0,1 mg", cat: "Timbangan", brand: "Sartorius", model: "Secura225D-1S", sn: "SRT-BA-40092", year: 2022, lab: "LAB-001", pic: "EMP-0003", status: "Available", cond: "Baik", calDue: shift(9), price: 78000000, needsOperator: false },
    { id: "EQ-0018", code: "CENT-002", name: "Centrifuge Refrigerated", cat: "Preparasi", brand: "Eppendorf", model: "5910Ri", sn: "EPP-CF-22140", year: 2021, lab: "LAB-002", pic: "EMP-0010", status: "Available", cond: "Baik", calDue: shift(88), price: 155000000, needsOperator: false }
  ];

  /* ---------- Aset ---------- */
  const assets = [
    { id: "AST-000131", code: "AST-IT-0131", name: "Laptop Dell Latitude 5440", cat: "IT Equipment", brand: "Dell", sn: "DL5440-77120", year: 2023, price: 22500000, book: 15750000, loc: "GB-3", room: "RM-002", pic: "EMP-0008", cond: "Baik", status: "Digunakan", supplier: "PT Mitra Komputindo", warranty: shift(210) },
    { id: "AST-000132", code: "AST-AV-0132", name: "Proyektor Epson EB-L520U", cat: "Audio Visual", brand: "Epson", sn: "EPL520-31002", year: 2022, price: 48000000, book: 28800000, loc: "GB-4", room: "RM-003", pic: "EMP-0005", cond: "Baik", status: "Tersedia", supplier: "PT Visual Prima", warranty: shift(-30) },
    { id: "AST-000133", code: "AST-AV-0133", name: "Sound System Line Array 8ch", cat: "Audio Visual", brand: "JBL", sn: "JBL-LA-90011", year: 2021, price: 265000000, book: 132500000, loc: "GC-1", room: "RM-005", pic: "EMP-0007", cond: "Baik", status: "Digunakan", supplier: "PT Sonic Nusantara", warranty: shift(-180) },
    { id: "AST-000134", code: "AST-FR-0134", name: "Kursi Auditorium (450 unit)", cat: "Furniture", brand: "Chitose", sn: "CHT-AU-450", year: 2020, price: 675000000, book: 337500000, loc: "GC-1", room: "RM-005", pic: "EMP-0007", cond: "Baik", status: "Digunakan", supplier: "PT Furni Jaya", warranty: shift(-400) },
    { id: "AST-000135", code: "AST-HV-0135", name: "AC Presisi 5PK Precision", cat: "HVAC", brand: "Daikin", sn: "DKN-PR-11290", year: 2022, price: 92000000, book: 64400000, loc: "GA-3", room: "LAB-003", pic: "EMP-0011", cond: "Perlu Perawatan", status: "Maintenance", supplier: "PT Cool Tech", warranty: shift(120) },
    { id: "AST-000136", code: "AST-IT-0136", name: "Server Rack Dell PowerEdge R750", cat: "IT Equipment", brand: "Dell", sn: "DLR750-44021", year: 2023, price: 310000000, book: 232500000, loc: "GA-3", room: "LAB-006", pic: "EMP-0008", cond: "Baik", status: "Digunakan", supplier: "PT Mitra Komputindo", warranty: shift(390) },
    { id: "AST-000137", code: "AST-SF-0137", name: "APAR CO2 6kg (24 unit)", cat: "Safety", brand: "Chubb", sn: "CHB-CO2-24", year: 2024, price: 36000000, book: 32400000, loc: "Semua Gedung", room: "-", pic: "EMP-0001", cond: "Baik", status: "Aktif", supplier: "PT Safety Indo", warranty: shift(540) },
    { id: "AST-000138", code: "AST-VH-0138", name: "Kendaraan Operasional Hilux", cat: "Kendaraan", brand: "Toyota", sn: "B-9012-STU", year: 2021, price: 420000000, book: 252000000, loc: "Parkir GD", room: "-", pic: "EMP-0001", cond: "Baik", status: "Digunakan", supplier: "Auto2000", warranty: shift(-60) },
    { id: "AST-000139", code: "AST-IT-0139", name: "Laptop Lenovo ThinkPad T14", cat: "IT Equipment", brand: "Lenovo", sn: "LNT14-66203", year: 2021, price: 19500000, book: 9750000, loc: "GB-2", room: "RM-001", pic: "EMP-0005", cond: "Rusak Ringan", status: "Rusak", supplier: "PT Mitra Komputindo", warranty: shift(-220) },
    { id: "AST-000140", code: "AST-LB-0140", name: "Lemari Asam Mobile", cat: "Lab Furniture", brand: "Esco", sn: "ESC-LA-77190", year: 2022, price: 145000000, book: 101500000, loc: "GA-2", room: "LAB-001", pic: "EMP-0002", cond: "Baik", status: "Digunakan", supplier: "PT Lab Solusi", warranty: shift(160) },
    { id: "AST-000141", code: "AST-IT-0141", name: "Access Point Ubiquiti U6 (32 unit)", cat: "IT Equipment", brand: "Ubiquiti", sn: "UBQ-U6-32", year: 2023, price: 64000000, book: 48000000, loc: "Semua Gedung", room: "-", pic: "EMP-0008", cond: "Baik", status: "Digunakan", supplier: "PT Netlink", warranty: shift(300) },
    { id: "AST-000142", code: "AST-FR-0142", name: "Meja Rapat Modular 16 Seat", cat: "Furniture", brand: "Ergosit", sn: "ERG-MR-20114", year: 2020, price: 58000000, book: 23200000, loc: "GB-2", room: "RM-001", pic: "EMP-0005", cond: "Baik", status: "Digunakan", supplier: "PT Furni Jaya", warranty: shift(-500) }
  ];

  /* ---------- Booking ---------- */
  const bookings = [
    { id: "BK-2026-000431", res: "RM-003", resName: "Conference Room Garuda", type: "Ruangan", requester: "EMP-0008", unit: "IT", date: shift(0), start: "09:00", end: "11:00", people: 32, agenda: "Kick-off Migrasi Core System", kind: "Rapat Internal", status: "Approved", pic: "EMP-0005", layout: "Theater", addons: ["Proyektor", "Sound System"], cost: 0, billing: "FREE_INTERNAL" },
    { id: "BK-2026-000432", res: "RM-005", resName: "Auditorium Wijaya Kusuma", type: "Auditorium", requester: "EMP-0007", unit: "Pemasaran", date: shift(2), start: "08:00", end: "17:00", people: 380, agenda: "National Tech Summit 2026", kind: "Event Eksternal", status: "Waiting Approval", pic: "EMP-0007", layout: "Theater", addons: ["Line Array", "Lighting", "Operator", "Catering"], cost: 18750000, billing: "PAID" },
    { id: "BK-2026-000433", res: "RM-001", resName: "Meeting Room Alpha", type: "Ruangan", requester: "EMP-0006", unit: "Keuangan", date: shift(0), start: "13:00", end: "15:00", people: 12, agenda: "Review Anggaran Q3", kind: "Rapat Internal", status: "In Use", pic: "EMP-0005", layout: "Boardroom", addons: ["Video Conf"], cost: 0, billing: "FREE_INTERNAL" },
    { id: "BK-2026-000434", res: "LAB-001", resName: "Laboratorium Kimia Analitik", type: "Laboratorium", requester: "EMP-0010", unit: "QHSE", date: shift(1), start: "08:00", end: "12:00", people: 6, agenda: "Uji Kadar Logam Berat Sampel Air", kind: "Pengujian", status: "Approved", pic: "EMP-0002", layout: "-", addons: [], cost: 0, billing: "INTERNAL" },
    { id: "BK-2026-000435", res: "RM-004", resName: "Training Room Nusantara", type: "Ruangan", requester: "EMP-0002", unit: "Litbang", date: shift(3), start: "08:30", end: "16:30", people: 48, agenda: "Pelatihan ISO 17025 Batch 2", kind: "Pelatihan", status: "Approved", pic: "EMP-0005", layout: "Classroom", addons: ["Proyektor", "Flipchart", "Catering"], cost: 3600000, billing: "PAID" },
    { id: "BK-2026-000436", res: "RM-002", resName: "Meeting Room Beta", type: "Ruangan", requester: "EMP-0012", unit: "Produksi", date: shift(0), start: "15:30", end: "16:30", people: 8, agenda: "Daily Production Sync", kind: "Rapat Rutin", status: "Approved", pic: "EMP-0005", layout: "Boardroom", addons: [], cost: 0, billing: "FREE_INTERNAL" },
    { id: "BK-2026-000437", res: "RM-010", resName: "Ruang Serbaguna Merapi", type: "Ruangan", requester: "EXT-0002", unit: "PT Anugerah Sejahtera", date: shift(6), start: "09:00", end: "15:00", people: 120, agenda: "Gathering Mitra Distributor", kind: "Sewa Eksternal", status: "Waiting Payment", pic: "EMP-0007", layout: "Banquet", addons: ["Sound System", "Catering", "Operator"], cost: 9250000, billing: "PAID" },
    { id: "BK-2026-000438", res: "RM-009", resName: "Meeting Room Epsilon", type: "Ruangan", requester: "EMP-0004", unit: "Umum & Fasilitas", date: shift(1), start: "10:00", end: "11:30", people: 10, agenda: "Rapat Audit Aset Semester I", kind: "Rapat Internal", status: "Approved", pic: "EMP-0005", layout: "U-Shape", addons: ["Proyektor"], cost: 0, billing: "FREE_INTERNAL" },
    { id: "BK-2026-000439", res: "RM-007", resName: "VIP Room Cendana", type: "Ruangan", requester: "EMP-0009", unit: "Direktorat", date: shift(4), start: "14:00", end: "16:00", people: 8, agenda: "Kunjungan Investor Strategis", kind: "Rapat Manajemen", status: "Approved", pic: "EMP-0001", layout: "Boardroom", addons: ["Video Conf"], cost: 0, billing: "RESTRICTED" },
    { id: "BK-2026-000440", res: "RM-001", resName: "Meeting Room Alpha", type: "Ruangan", requester: "EMP-0011", unit: "Umum & Fasilitas", date: shift(-1), start: "09:00", end: "10:00", people: 6, agenda: "Koordinasi Vendor HVAC", kind: "Rapat Internal", status: "Completed", pic: "EMP-0005", layout: "Boardroom", addons: [], cost: 0, billing: "FREE_INTERNAL" },
    { id: "BK-2026-000441", res: "RM-003", resName: "Conference Room Garuda", type: "Ruangan", requester: "EMP-0001", unit: "Umum & Fasilitas", date: shift(-2), start: "13:00", end: "17:00", people: 40, agenda: "Sosialisasi SOP Fasilitas 2026", kind: "Sosialisasi", status: "Completed", pic: "EMP-0005", layout: "Classroom", addons: ["Proyektor", "Sound System"], cost: 0, billing: "FREE_INTERNAL" },
    { id: "BK-2026-000442", res: "RM-004", resName: "Training Room Nusantara", type: "Ruangan", requester: "EMP-0008", unit: "IT", date: shift(-3), start: "09:00", end: "12:00", people: 25, agenda: "Workshop Cybersecurity Awareness", kind: "Pelatihan", status: "Cancelled", pic: "EMP-0005", layout: "Classroom", addons: [], cost: 0, billing: "FREE_INTERNAL" },
    { id: "BK-2026-000443", res: "RM-002", resName: "Meeting Room Beta", type: "Ruangan", requester: "EMP-0004", unit: "Umum & Fasilitas", date: shift(5), start: "09:00", end: "10:00", people: 6, agenda: "Weekly Asset Review (Recurring)", kind: "Rapat Rutin", status: "Approved", pic: "EMP-0005", layout: "Boardroom", addons: [], cost: 0, billing: "FREE_INTERNAL" },
    { id: "BK-2026-000444", res: "RM-005", resName: "Auditorium Wijaya Kusuma", type: "Auditorium", requester: "EXT-0001", unit: "Universitas Teknologi Bangsa", date: shift(9), start: "08:00", end: "16:00", people: 320, agenda: "Wisuda Program Vokasi", kind: "Sewa Eksternal", status: "Quotation", pic: "EMP-0007", layout: "Theater", addons: ["Sound System", "Lighting", "Operator", "Security"], cost: 16400000, billing: "PAID" }
  ];

  /* ---------- Reservasi alat ---------- */
  const eqBookings = [
    { id: "ER-2026-00219", eq: "EQ-0002", eqName: "GC-MS Agilent 8890", requester: "EMP-0010", unit: "QHSE", date: shift(1), start: "08:00", end: "12:00", purpose: "Analisis VOC sampel udara ambien", status: "Approved", operator: "EMP-0003", lab: "LAB-001" },
    { id: "ER-2026-00220", eq: "EQ-0009", eqName: "SEM JEOL JSM-IT200", requester: "EMP-0002", unit: "Litbang", date: shift(0), start: "09:00", end: "15:00", purpose: "Karakterisasi morfologi komposit", status: "In Use", operator: "EMP-0003", lab: "LAB-003" },
    { id: "ER-2026-00221", eq: "EQ-0008", eqName: "XRD Bruker D8 Advance", requester: "EMP-0003", unit: "Litbang", date: shift(2), start: "13:00", end: "17:00", purpose: "Analisis fasa kristalin serbuk katalis", status: "Waiting Approval", operator: "EMP-0003", lab: "LAB-003" },
    { id: "ER-2026-00222", eq: "EQ-0007", eqName: "Mikroskop Fluoresensi", requester: "EMP-0010", unit: "QHSE", date: shift(-1), start: "10:00", end: "12:00", purpose: "Pengamatan kultur bakteri", status: "Borrowed", operator: "-", lab: "LAB-002" },
    { id: "ER-2026-00223", eq: "EQ-0010", eqName: "UTM Instron 5982", requester: "EMP-0012", unit: "Produksi", date: shift(4), start: "08:00", end: "11:00", purpose: "Uji tarik sampel produksi batch 44", status: "Waiting Approval", operator: "EMP-0003", lab: "LAB-003" },
    { id: "ER-2026-00224", eq: "EQ-0001", eqName: "HPLC Shimadzu LC-2050", requester: "EMP-0002", unit: "Litbang", date: shift(0), start: "13:00", end: "17:00", purpose: "Uji kemurnian bahan baku", status: "In Use", operator: "EMP-0003", lab: "LAB-001" }
  ];

  /* ---------- Peminjaman ---------- */
  const loans = [
    { id: "LN-2026-00087", item: "EQ-0012", itemName: "High Volume Air Sampler", type: "Alat", borrower: "EMP-0010", unit: "QHSE", out: shift(-4), due: shift(2), back: "-", status: "Dipinjam", handover: "EMP-0003", cond0: "Baik", cond1: "-" },
    { id: "LN-2026-00088", item: "EQ-0007", itemName: "Mikroskop Fluoresensi", type: "Alat", borrower: "EMP-0010", unit: "QHSE", out: shift(-1), due: shift(1), back: "-", status: "Dipinjam", handover: "EMP-0010", cond0: "Baik", cond1: "-" },
    { id: "LN-2026-00089", item: "AST-000131", itemName: "Laptop Dell Latitude 5440", type: "Aset", borrower: "EMP-0008", unit: "IT", out: shift(-12), due: shift(-2), back: "-", status: "Terlambat", handover: "EMP-0004", cond0: "Baik", cond1: "-" },
    { id: "LN-2026-00090", item: "AST-000132", itemName: "Proyektor Epson EB-L520U", type: "Aset", borrower: "EMP-0007", unit: "Pemasaran", out: shift(-8), due: shift(-5), back: shift(-5), status: "Selesai", handover: "EMP-0005", cond0: "Baik", cond1: "Baik" },
    { id: "LN-2026-00091", item: "EQ-0016", itemName: "pH Meter Benchtop", type: "Alat", borrower: "EMP-0012", unit: "Produksi", out: shift(-2), due: shift(0), back: "-", status: "Inspeksi", handover: "EMP-0010", cond0: "Baik", cond1: "Baik" },
    { id: "LN-2026-00092", item: "AST-000141", itemName: "Access Point Ubiquiti U6", type: "Aset", borrower: "EMP-0008", unit: "IT", out: shift(-20), due: shift(-10), back: shift(-9), status: "Selesai", handover: "EMP-0004", cond0: "Baik", cond1: "Baik" }
  ];

  /* ---------- Maintenance ---------- */
  const maintenance = [
    { id: "MT-2026-00142", target: "EQ-0005", targetName: "Autoclave Vertikal 100L", kind: "Corrective", sched: shift(0), vendor: "PT Hirayama Service", tech: "EMP-0011", cost: 12500000, status: "In Progress", note: "Kebocoran seal pintu, ganti gasket", block: true },
    { id: "MT-2026-00143", target: "AST-000135", targetName: "AC Presisi 5PK Precision", kind: "Preventive", sched: shift(3), vendor: "PT Cool Tech", tech: "EMP-0011", cost: 4200000, status: "Scheduled", note: "Servis rutin triwulan + cuci coil", block: false },
    { id: "MT-2026-00144", target: "RM-006", targetName: "Meeting Room Delta", kind: "Corrective", sched: shift(-1), vendor: "Internal", tech: "EMP-0011", cost: 2800000, status: "In Progress", note: "Perbaikan plafon bocor & repaint", block: true },
    { id: "MT-2026-00145", target: "EQ-0015", targetName: "Climatic Chamber 250L", kind: "Emergency", sched: shift(-5), vendor: "PT Memmert Indo", tech: "EMP-0003", cost: 38000000, status: "Waiting Part", note: "Kompresor rusak, menunggu sparepart impor", block: true },
    { id: "MT-2026-00146", target: "AST-000133", targetName: "Sound System Line Array", kind: "Preventive", sched: shift(8), vendor: "PT Sonic Nusantara", tech: "EMP-0005", cost: 6500000, status: "Scheduled", note: "Kalibrasi audio & pengecekan kabel", block: false },
    { id: "MT-2026-00147", target: "LAB-006", targetName: "Laboratorium Komputasi & IoT", kind: "Corrective", sched: shift(-14), vendor: "PT Bangun Sarana", tech: "EMP-0011", cost: 145000000, status: "In Progress", note: "Renovasi ruang & upgrade kelistrikan", block: true },
    { id: "MT-2026-00148", target: "AST-000139", targetName: "Laptop Lenovo ThinkPad T14", kind: "Corrective", sched: shift(-9), vendor: "PT Mitra Komputindo", tech: "EMP-0008", cost: 3100000, status: "Completed", note: "Ganti keyboard & baterai", block: false }
  ];

  /* ---------- Kalibrasi ---------- */
  const calibration = [
    { id: "CL-2026-00311", eq: "EQ-0003", eqName: "Atomic Absorption Spectrometer", lab: "PT Kalibrasi Presisi", last: shift(-361), due: shift(4), cert: "KP/2025/AA-1180", result: "Lulus", status: "In Progress", cost: 18500000 },
    { id: "CL-2026-00312", eq: "EQ-0014", eqName: "Multifunction Calibrator", lab: "Fluke Cal Lab SG", last: shift(-358), due: shift(7), cert: "FLK/2025/MC-2210", result: "Lulus", status: "Scheduled", cost: 42000000 },
    { id: "CL-2026-00313", eq: "EQ-0017", eqName: "Neraca Analitik 0,1 mg", lab: "LAB-005 (Internal)", last: shift(-356), due: shift(9), cert: "STU/CAL/2025/0431", result: "Lulus", status: "Scheduled", cost: 2500000 },
    { id: "CL-2026-00314", eq: "EQ-0010", eqName: "UTM Instron 5982", lab: "PT Kalibrasi Presisi", last: shift(-354), due: shift(11), cert: "KP/2025/UT-0912", result: "Lulus", status: "Scheduled", cost: 27500000 },
    { id: "CL-2026-00315", eq: "EQ-0016", eqName: "pH Meter Benchtop", lab: "LAB-005 (Internal)", last: shift(-350), due: shift(15), cert: "STU/CAL/2025/0450", result: "Lulus", status: "Scheduled", cost: 1200000 },
    { id: "CL-2026-00316", eq: "EQ-0012", eqName: "High Volume Air Sampler", lab: "PT Sertifikasi Andal", last: shift(-367), due: shift(-2), cert: "SA/2025/HV-0071", result: "Lulus", status: "Overdue", cost: 9800000 },
    { id: "CL-2026-00317", eq: "EQ-0005", eqName: "Autoclave Vertikal 100L", lab: "PT Sertifikasi Andal", last: shift(-371), due: shift(-6), cert: "SA/2025/AC-0033", result: "Lulus Bersyarat", status: "Overdue", cost: 7400000 },
    { id: "CL-2026-00318", eq: "EQ-0015", eqName: "Climatic Chamber 250L", lab: "PT Kalibrasi Presisi", last: shift(-386), due: shift(-21), cert: "KP/2025/CC-0188", result: "Tidak Lulus", status: "Overdue", cost: 11200000 },
    { id: "CL-2026-00319", eq: "EQ-0008", eqName: "XRD Bruker D8 Advance", lab: "Bruker Service Asia", last: shift(-346), due: shift(19), cert: "BRK/2025/XR-4410", result: "Lulus", status: "Scheduled", cost: 65000000 },
    { id: "CL-2026-00320", eq: "EQ-0001", eqName: "HPLC Shimadzu LC-2050", lab: "PT Shimadzu Indonesia", last: shift(-337), due: shift(28), cert: "SHZ/2025/LC-7712", result: "Lulus", status: "Scheduled", cost: 32000000 }
  ];

  /* ---------- Approval ---------- */
  const approvals = [
    { id: "AP-2026-01188", ref: "BK-2026-000432", subject: "Booking Auditorium — National Tech Summit 2026", type: "Booking Auditorium", requester: "EMP-0007", submitted: shift(-1), stage: "Facility Manager", nextStage: "Management", sla: "1 hari", priority: "Tinggi", amount: 18750000 },
    { id: "AP-2026-01189", ref: "ER-2026-00221", subject: "Reservasi XRD Bruker D8 Advance", type: "Peminjaman Alat", requester: "EMP-0003", submitted: shift(0), stage: "Kepala Lab", nextStage: "Asset Manager", sla: "4 jam", priority: "Sedang", amount: 0 },
    { id: "AP-2026-01190", ref: "ER-2026-00223", subject: "Reservasi UTM Instron 5982", type: "Peminjaman Alat", requester: "EMP-0012", submitted: shift(0), stage: "Kepala Lab", nextStage: "Asset Manager", sla: "4 jam", priority: "Sedang", amount: 0 },
    { id: "AP-2026-01191", ref: "BK-2026-000437", subject: "Sewa Ruang Serbaguna — PT Anugerah Sejahtera", type: "Booking Berbayar", requester: "EXT-0002", submitted: shift(-2), stage: "Finance", nextStage: "Selesai", sla: "2 hari", priority: "Tinggi", amount: 9250000 },
    { id: "AP-2026-01192", ref: "MT-2026-00145", subject: "Persetujuan Biaya Perbaikan Climatic Chamber", type: "Maintenance", requester: "EMP-0003", submitted: shift(-3), stage: "Management", nextStage: "Selesai", sla: "3 hari", priority: "Tinggi", amount: 38000000 },
    { id: "AP-2026-01193", ref: "BK-2026-000444", subject: "Quotation Sewa Auditorium — Universitas Teknologi Bangsa", type: "Quotation", requester: "EMP-0007", submitted: shift(0), stage: "Facility Manager", nextStage: "Finance", sla: "1 hari", priority: "Sedang", amount: 16400000 }
  ];

  /* ---------- Komersial ---------- */
  const priceList = [
    { id: "PR-001", res: "RM-005", resName: "Auditorium Wijaya Kusuma", unitType: "Per Hari (8 jam)", internal: 0, external: 12500000, halfday: 7500000, overtime: 1500000, active: true },
    { id: "PR-002", res: "RM-010", resName: "Ruang Serbaguna Merapi", unitType: "Per Hari (8 jam)", internal: 0, external: 4500000, halfday: 2750000, overtime: 600000, active: true },
    { id: "PR-003", res: "RM-004", resName: "Training Room Nusantara", unitType: "Per Hari (8 jam)", internal: 0, external: 1800000, halfday: 1100000, overtime: 300000, active: true },
    { id: "PR-004", res: "RM-003", resName: "Conference Room Garuda", unitType: "Per Jam", internal: 0, external: 1250000, halfday: 0, overtime: 0, active: true },
    { id: "PR-005", res: "RM-001", resName: "Meeting Room Alpha", unitType: "Per Jam", internal: 0, external: 350000, halfday: 0, overtime: 0, active: true },
    { id: "PR-006", res: "LAB-001", resName: "Lab Kimia Analitik — Sewa Jasa Uji", unitType: "Per Sampel", internal: 0, external: 850000, halfday: 0, overtime: 0, active: true }
  ];

  const packages = [
    { id: "PKG-001", name: "Auditorium Full Day Premium", incl: "Auditorium 8 jam, line array, lighting rig, LED screen, 2 operator, 4 mic wireless, lobby registrasi", cap: 450, price: 22500000, active: true },
    { id: "PKG-002", name: "Corporate Training Package", incl: "Training room 8 jam, proyektor, sound, flipchart, 2x coffee break, 1x lunch (min 30 pax)", cap: 60, price: 4800000, active: true },
    { id: "PKG-003", name: "Half Day Meeting Package", incl: "Meeting room 4 jam, video conference, air mineral, 1x snack", cap: 16, price: 1450000, active: true },
    { id: "PKG-004", name: "Gathering & Banquet Package", incl: "Ruang serbaguna 6 jam, sound system, panggung, layout banquet, catering prasmanan (min 100 pax)", cap: 150, price: 12500000, active: true },
    { id: "PKG-005", name: "Lab Testing Service — Air Quality", incl: "Sampling udara ambien 3 titik, analisis 6 parameter, sertifikat hasil uji terakreditasi", cap: 0, price: 6750000, active: true }
  ];

  const addons = [
    { id: "AO-01", name: "Proyektor Tambahan", price: 350000, unit: "unit/hari" },
    { id: "AO-02", name: "Sound System Portable", price: 750000, unit: "set/hari" },
    { id: "AO-03", name: "Mic Wireless", price: 150000, unit: "unit/hari" },
    { id: "AO-04", name: "Operator AV", price: 500000, unit: "orang/hari" },
    { id: "AO-05", name: "Teknisi Standby", price: 400000, unit: "orang/hari" },
    { id: "AO-06", name: "Coffee Break", price: 45000, unit: "pax" },
    { id: "AO-07", name: "Lunch Prasmanan", price: 85000, unit: "pax" },
    { id: "AO-08", name: "Lighting Panggung", price: 2500000, unit: "paket" },
    { id: "AO-09", name: "Kursi Tambahan", price: 15000, unit: "unit" },
    { id: "AO-10", name: "Cleaning Service Tambahan", price: 350000, unit: "paket" },
    { id: "AO-11", name: "Security Tambahan", price: 450000, unit: "orang/hari" },
    { id: "AO-12", name: "Dokumentasi Foto & Video", price: 3500000, unit: "paket" }
  ];

  const quotations = [
    { id: "QT-2026-0088", client: "Universitas Teknologi Bangsa", ref: "BK-2026-000444", date: shift(0), valid: shift(14), amount: 16400000, status: "Terkirim", pic: "EMP-0007" },
    { id: "QT-2026-0087", client: "PT Anugerah Sejahtera", ref: "BK-2026-000437", date: shift(-3), valid: shift(11), amount: 9250000, status: "Disetujui", pic: "EMP-0007" },
    { id: "QT-2026-0086", client: "Kementerian Perindustrian", ref: "-", date: shift(-8), valid: shift(6), amount: 24800000, status: "Negosiasi", pic: "EMP-0007" },
    { id: "QT-2026-0085", client: "PT Global Mandiri Sentosa", ref: "-", date: shift(-15), valid: shift(-1), amount: 5400000, status: "Kadaluarsa", pic: "EMP-0007" }
  ];

  const invoices = [
    { id: "INV-2026-0231", client: "PT Anugerah Sejahtera", ref: "BK-2026-000437", date: shift(-2), due: shift(5), sub: 8409091, tax: 840909, total: 9250000, paid: 0, status: "Waiting Payment" },
    { id: "INV-2026-0230", client: "PT Cakrawala Energi", ref: "BK-2026-000410", date: shift(-12), due: shift(-2), sub: 11363636, tax: 1136364, total: 12500000, paid: 12500000, status: "Paid" },
    { id: "INV-2026-0229", client: "Dinas Lingkungan Hidup Prov.", ref: "BK-2026-000398", date: shift(-20), due: shift(-6), sub: 6136364, tax: 613636, total: 6750000, paid: 6750000, status: "Paid" },
    { id: "INV-2026-0228", client: "PT Sinar Baja Makmur", ref: "BK-2026-000386", date: shift(-31), due: shift(-17), sub: 4090909, tax: 409091, total: 4500000, paid: 0, status: "Overdue" },
    { id: "INV-2026-0227", client: "Asosiasi Industri Kimia", ref: "BK-2026-000371", date: shift(-38), due: shift(-24), sub: 20454545, tax: 2045455, total: 22500000, paid: 22500000, status: "Paid" }
  ];

  const payments = [
    { id: "PY-2026-0198", inv: "INV-2026-0230", client: "PT Cakrawala Energi", date: shift(-3), method: "Transfer BCA", amount: 12500000, status: "Terverifikasi" },
    { id: "PY-2026-0197", inv: "INV-2026-0229", client: "Dinas Lingkungan Hidup Prov.", date: shift(-7), method: "Transfer Mandiri", amount: 6750000, status: "Terverifikasi" },
    { id: "PY-2026-0196", inv: "INV-2026-0227", client: "Asosiasi Industri Kimia", date: shift(-26), method: "Virtual Account", amount: 22500000, status: "Terverifikasi" },
    { id: "PY-2026-0195", inv: "INV-2026-0231", client: "PT Anugerah Sejahtera", date: shift(0), method: "Transfer BNI", amount: 4625000, status: "Menunggu Verifikasi" }
  ];

  /* ---------- Event ---------- */
  const events = [
    { id: "EV-2026-0042", name: "National Tech Summit 2026", organizer: "Divisi Pemasaran", pic: "EMP-0007", date: shift(2), venue: "RM-005", people: 380, budget: 285000000, status: "Persiapan", vendors: 6, type: "Konferensi" },
    { id: "EV-2026-0041", name: "Pelatihan ISO 17025 Batch 2", organizer: "Litbang", pic: "EMP-0002", date: shift(3), venue: "RM-004", people: 48, budget: 42000000, status: "Terkonfirmasi", vendors: 2, type: "Pelatihan" },
    { id: "EV-2026-0040", name: "Gathering Mitra Distributor", organizer: "PT Anugerah Sejahtera", pic: "EMP-0007", date: shift(6), venue: "RM-010", people: 120, budget: 95000000, status: "Menunggu Pembayaran", vendors: 3, type: "Gathering" },
    { id: "EV-2026-0039", name: "Wisuda Program Vokasi", organizer: "Universitas Teknologi Bangsa", pic: "EMP-0007", date: shift(9), venue: "RM-005", people: 320, budget: 160000000, status: "Quotation", vendors: 4, type: "Seremonial" },
    { id: "EV-2026-0038", name: "Sosialisasi SOP Fasilitas 2026", organizer: "Umum & Fasilitas", pic: "EMP-0001", date: shift(-2), venue: "RM-003", people: 40, budget: 8500000, status: "Selesai", vendors: 1, type: "Sosialisasi" }
  ];

  const vendors = [
    { id: "VN-001", name: "PT Sonic Nusantara", cat: "Audio Visual", pic: "Budi Santoso", phone: "0812-9911-002", rating: 4.8, contract: "Aktif s/d " + shift(200) },
    { id: "VN-002", name: "Catering Selera Nusantara", cat: "Katering", pic: "Ratna Dewi", phone: "0813-8822-114", rating: 4.6, contract: "Aktif s/d " + shift(120) },
    { id: "VN-003", name: "PT Cool Tech", cat: "HVAC", pic: "Ahmad Yani", phone: "0811-7733-220", rating: 4.4, contract: "Aktif s/d " + shift(340) },
    { id: "VN-004", name: "PT Kalibrasi Presisi", cat: "Kalibrasi", pic: "Sri Wahyuni", phone: "0815-6644-331", rating: 4.9, contract: "Aktif s/d " + shift(280) },
    { id: "VN-005", name: "Cipta Dekorasi Kreatif", cat: "Dekorasi & Booth", pic: "Yoga Pratama", phone: "0817-2255-889", rating: 4.3, contract: "Per Proyek" },
    { id: "VN-006", name: "PT Garda Aman Sentosa", cat: "Security", pic: "Iwan Setiawan", phone: "0819-3344-556", rating: 4.5, contract: "Aktif s/d " + shift(160) }
  ];

  /* ---------- Visitor ---------- */
  const visitors = [
    { id: "VS-2026-00901", name: "Anton Wijaya", org: "PT Cakrawala Energi", purpose: "Audit Supplier", host: "EMP-0002", room: "LAB-001", date: shift(0), in: "09:12", out: "-", status: "Di Dalam", badge: "V-118" },
    { id: "VS-2026-00902", name: "Clara Simanjuntak", org: "KAN", purpose: "Surveilan Akreditasi", host: "EMP-0002", room: "LAB-004", date: shift(0), in: "08:45", out: "-", status: "Di Dalam", badge: "V-119" },
    { id: "VS-2026-00903", name: "Doni Hermawan", org: "PT Mitra Komputindo", purpose: "Instalasi Perangkat", host: "EMP-0008", room: "LAB-006", date: shift(0), in: "10:30", out: "12:05", status: "Selesai", badge: "V-120" },
    { id: "VS-2026-00904", name: "Erni Kusumawati", org: "Universitas Teknologi Bangsa", purpose: "Survey Lokasi Wisuda", host: "EMP-0007", room: "RM-005", date: shift(1), in: "-", out: "-", status: "Terjadwal", badge: "-" },
    { id: "VS-2026-00905", name: "Farhan Aditya", org: "PT Hirayama Service", purpose: "Perbaikan Autoclave", host: "EMP-0011", room: "LAB-002", date: shift(0), in: "13:20", out: "-", status: "Di Dalam", badge: "V-121" }
  ];

  /* ---------- Dokumen ---------- */
  const documents = [
    { id: "DOC-2026-0512", name: "BAST Serah Terima Laptop Dell Latitude", type: "BAST", ref: "LN-2026-00089", date: shift(-12), by: "EMP-0004", status: "Ditandatangani", size: "218 KB" },
    { id: "DOC-2026-0513", name: "Berita Acara Penggunaan Auditorium", type: "Berita Acara", ref: "BK-2026-000410", date: shift(-12), by: "EMP-0007", status: "Ditandatangani", size: "340 KB" },
    { id: "DOC-2026-0514", name: "Sertifikat Kalibrasi AAS PinAAcle 900T", type: "Sertifikat Kalibrasi", ref: "CL-2026-00311", date: shift(-361), by: "PT Kalibrasi Presisi", status: "Berlaku", size: "1,2 MB" },
    { id: "DOC-2026-0515", name: "Surat Perjanjian Sewa Auditorium", type: "Perjanjian", ref: "BK-2026-000437", date: shift(-2), by: "EMP-0007", status: "Menunggu TTD", size: "480 KB" },
    { id: "DOC-2026-0516", name: "Invoice INV-2026-0231", type: "Invoice", ref: "INV-2026-0231", date: shift(-2), by: "EMP-0006", status: "Terkirim", size: "156 KB" },
    { id: "DOC-2026-0517", name: "Booking Confirmation BK-2026-000435", type: "Konfirmasi Booking", ref: "BK-2026-000435", date: shift(-4), by: "Sistem", status: "Terkirim", size: "98 KB" },
    { id: "DOC-2026-0518", name: "Checklist Kondisi Alat — HVS TE-5170", type: "Checklist", ref: "LN-2026-00087", date: shift(-4), by: "EMP-0003", status: "Ditandatangani", size: "265 KB" },
    { id: "DOC-2026-0519", name: "Laporan Audit Aset Semester I 2026", type: "Laporan", ref: "-", date: shift(-6), by: "EMP-0004", status: "Final", size: "3,4 MB" }
  ];

  /* ---------- Audit trail ---------- */
  const audit = [
    { time: "10:42:18", user: "EMP-0005", act: "UPDATE", obj: "Booking BK-2026-000433", before: "Approved", after: "In Use", ip: "10.20.3.14", dev: "Chrome / Windows" },
    { time: "10:31:05", user: "EMP-0007", act: "CREATE", obj: "Quotation QT-2026-0088", before: "-", after: "Rp 16.400.000", ip: "10.20.5.42", dev: "Chrome / macOS" },
    { time: "10:18:47", user: "EMP-0003", act: "UPDATE", obj: "Alat EQ-0003 (AAS)", before: "Available", after: "Calibration", ip: "10.20.2.11", dev: "Edge / Windows" },
    { time: "09:56:12", user: "EMP-0001", act: "APPROVE", obj: "Approval AP-2026-01191", before: "Facility Manager", after: "Finance", ip: "10.20.1.8", dev: "Safari / iOS" },
    { time: "09:44:30", user: "EMP-0004", act: "UPDATE", obj: "Aset AST-000139", before: "Digunakan", after: "Rusak", ip: "10.20.4.21", dev: "Chrome / Windows" },
    { time: "09:22:59", user: "SYSTEM", act: "NOTIFY", obj: "Reminder Kalibrasi EQ-0014", before: "-", after: "Terkirim ke 3 penerima", ip: "127.0.0.1", dev: "Scheduler" },
    { time: "09:05:41", user: "EMP-0006", act: "UPDATE", obj: "Tarif PR-001 Auditorium", before: "Rp 11.500.000", after: "Rp 12.500.000", ip: "10.20.6.33", dev: "Chrome / Windows" },
    { time: "08:51:03", user: "EMP-0008", act: "CREATE", obj: "Booking BK-2026-000431", before: "-", after: "Conference Room Garuda", ip: "10.20.7.19", dev: "Chrome / Windows" },
    { time: "08:30:22", user: "EMP-0002", act: "LOGIN", obj: "Sesi pengguna", before: "-", after: "Berhasil", ip: "10.20.2.5", dev: "Firefox / Ubuntu" },
    { time: "08:12:56", user: "EMP-0010", act: "CHECKIN", obj: "Visitor VS-2026-00902", before: "Terjadwal", after: "Di Dalam", ip: "10.20.9.2", dev: "Kiosk Lobby" }
  ];

  /* ---------- Notifikasi ---------- */
  const notifications = [
    { id: 1, icon: "alert", tone: "red", title: "3 alat melewati jatuh tempo kalibrasi", desc: "HVS TE-5170, Autoclave 100L, Climatic Chamber 250L", time: "12 mnt lalu", unread: true },
    { id: 2, icon: "check", tone: "amber", title: "Approval menunggu tindakan Anda", desc: "6 pengajuan — 2 di antaranya melewati SLA", time: "34 mnt lalu", unread: true },
    { id: 3, icon: "cal", tone: "brand", title: "Booking auditorium perlu konfirmasi", desc: "BK-2026-000432 — National Tech Summit 2026", time: "1 jam lalu", unread: true },
    { id: 4, icon: "money", tone: "red", title: "Invoice jatuh tempo", desc: "INV-2026-0228 PT Sinar Baja Makmur — Rp 4.500.000", time: "3 jam lalu", unread: false },
    { id: 5, icon: "wrench", tone: "amber", title: "Maintenance memblokir ruangan", desc: "Meeting Room Delta tidak dapat dibooking s/d " + shift(2), time: "5 jam lalu", unread: false },
    { id: 6, icon: "user", tone: "teal", title: "Peminjaman terlambat dikembalikan", desc: "LN-2026-00089 Laptop Dell — terlambat 2 hari", time: "Kemarin", unread: false }
  ];

  /* ---------- Analitik ---------- */
  const analytics = {
    utilTrend: [
      { m: "Jan", room: 58, lab: 62, equip: 49 }, { m: "Feb", room: 61, lab: 66, equip: 52 },
      { m: "Mar", room: 64, lab: 69, equip: 55 }, { m: "Apr", room: 63, lab: 71, equip: 58 },
      { m: "Mei", room: 68, lab: 74, equip: 61 }, { m: "Jun", room: 72, lab: 76, equip: 63 },
      { m: "Jul", room: 70, lab: 79, equip: 66 }, { m: "Agu", room: 74, lab: 81, equip: 68 }
    ],
    revenue: [
      { m: "Jan", val: 42 }, { m: "Feb", val: 51 }, { m: "Mar", val: 47 }, { m: "Apr", val: 63 },
      { m: "Mei", val: 58 }, { m: "Jun", val: 74 }, { m: "Jul", val: 69 }, { m: "Agu", val: 86 }
    ],
    bookingByType: [
      { k: "Rapat Internal", v: 412, c: "var(--brand-500)" },
      { k: "Pelatihan", v: 168, c: "var(--teal-500)" },
      { k: "Pengujian Lab", v: 231, c: "var(--violet-500)" },
      { k: "Event & Sewa", v: 74, c: "var(--amber-500)" },
      { k: "Lainnya", v: 46, c: "var(--slate-500)" }
    ],
    topRooms: [
      { n: "Training Room Nusantara", v: 83 }, { n: "Meeting Room Alpha", v: 78 },
      { n: "Conference Room Garuda", v: 71 }, { n: "Meeting Room Epsilon", v: 69 },
      { n: "Meeting Room Beta", v: 64 }, { n: "Ruang Serbaguna Merapi", v: 61 }
    ],
    topEquip: [
      { n: "HPLC Shimadzu LC-2050", v: 168 }, { n: "SEM JEOL JSM-IT200", v: 142 },
      { n: "GC-MS Agilent 8890", v: 131 }, { n: "XRD Bruker D8", v: 96 },
      { n: "UTM Instron 5982", v: 88 }, { n: "AAS PinAAcle 900T", v: 74 }
    ],
    maintCost: [
      { m: "Mar", val: 28 }, { m: "Apr", val: 41 }, { m: "Mei", val: 19 },
      { m: "Jun", val: 54 }, { m: "Jul", val: 33 }, { m: "Agu", val: 62 }
    ],
    heat: [
      [12, 34, 58, 71, 66, 44, 29, 51, 62],
      [18, 46, 72, 84, 79, 52, 38, 61, 70],
      [22, 51, 78, 91, 86, 58, 41, 68, 75],
      [20, 48, 74, 88, 82, 55, 39, 64, 72],
      [16, 42, 66, 76, 71, 48, 33, 56, 65],
      [ 6, 14, 22, 28, 24, 16, 11, 18, 20],
      [ 3,  8, 12, 15, 13,  9,  6, 10, 11]
    ]
  };

  /* ---------- Role & Permission ---------- */
  const roles = [
    { name: "Super Admin", users: 2, scope: "Global", desc: "Akses penuh seluruh modul dan konfigurasi sistem" },
    { name: "Facility Manager", users: 3, scope: "Seluruh Gedung", desc: "Kelola ruangan, tarif, approval fasilitas, dan laporan" },
    { name: "Laboratory Manager", users: 2, scope: "Gedung A", desc: "Kelola laboratorium, alat, jadwal lab, dan approval lab" },
    { name: "Lab Technician", users: 8, scope: "Lab tertentu", desc: "Operasional alat, kalibrasi, maintenance, serah terima" },
    { name: "Asset Manager", users: 2, scope: "Global", desc: "Register aset, mutasi, audit aset, peminjaman" },
    { name: "Room Administrator", users: 4, scope: "Gedung B & C", desc: "Kelola booking ruangan, layout, dan add-on" },
    { name: "Event Manager", users: 2, scope: "Gedung C", desc: "Kelola event, vendor, peserta, dan dokumentasi" },
    { name: "Finance", users: 3, scope: "Global", desc: "Quotation, invoice, pembayaran, dan laporan keuangan" },
    { name: "PIC", users: 14, scope: "Resource tertentu", desc: "Approval level pertama untuk resource yang diampu" },
    { name: "Employee / User", users: 246, scope: "Unit sendiri", desc: "Mengajukan booking, peminjaman, dan melihat jadwal" },
    { name: "External User", users: 37, scope: "Portal publik", desc: "Pengajuan sewa fasilitas dari luar organisasi" },
    { name: "Management", users: 6, scope: "Global (read)", desc: "Dashboard eksekutif, KPI, dan approval level akhir" }
  ];

  const permMatrix = {
    modules: ["Dashboard", "Booking Ruangan", "Booking Alat", "Laboratorium", "Aset", "Rental & Billing", "Maintenance", "Kalibrasi", "Event", "Master Data", "Audit Trail"],
    roles: ["Super Admin", "Facility Mgr", "Lab Mgr", "Asset Mgr", "Finance", "Employee"],
    grid: [
      ["FULL", "FULL", "VIEW", "VIEW", "VIEW", "VIEW"],
      ["FULL", "FULL", "EDIT", "VIEW", "VIEW", "CREATE"],
      ["FULL", "VIEW", "FULL", "EDIT", "NONE", "CREATE"],
      ["FULL", "VIEW", "FULL", "VIEW", "NONE", "VIEW"],
      ["FULL", "EDIT", "VIEW", "FULL", "VIEW", "NONE"],
      ["FULL", "EDIT", "NONE", "NONE", "FULL", "NONE"],
      ["FULL", "FULL", "EDIT", "EDIT", "VIEW", "NONE"],
      ["FULL", "VIEW", "FULL", "EDIT", "NONE", "NONE"],
      ["FULL", "FULL", "NONE", "NONE", "VIEW", "VIEW"],
      ["FULL", "EDIT", "EDIT", "EDIT", "NONE", "NONE"],
      ["FULL", "VIEW", "NONE", "NONE", "NONE", "NONE"]
    ]
  };

  const workflows = [
    { id: "WF-01", name: "Booking Ruangan Gratis (Internal)", trigger: "Booking dengan tarif = 0", steps: ["Pemohon", "PIC Ruangan"], sla: "4 jam", active: true },
    { id: "WF-02", name: "Booking Ruangan Berbayar", trigger: "Booking dengan tarif > 0", steps: ["Pemohon", "PIC Ruangan", "Finance"], sla: "1 hari", active: true },
    { id: "WF-03", name: "Booking Auditorium", trigger: "Resource bertipe Auditorium", steps: ["Pemohon", "Facility Manager", "Management"], sla: "2 hari", active: true },
    { id: "WF-04", name: "Peminjaman Alat Laboratorium", trigger: "Reservasi alat kategori lab", steps: ["Pemohon", "Kepala Lab", "Asset Manager"], sla: "4 jam", active: true },
    { id: "WF-05", name: "Persetujuan Biaya Maintenance > 25 Juta", trigger: "Work order dengan biaya > Rp 25.000.000", steps: ["Teknisi", "Facility Manager", "Management"], sla: "3 hari", active: true },
    { id: "WF-06", name: "Sewa Fasilitas Eksternal", trigger: "Pemohon bertipe External User", steps: ["Pemohon", "Event Manager", "Facility Manager", "Finance"], sla: "3 hari", active: true },
    { id: "WF-07", name: "Disposal Aset", trigger: "Perubahan status aset ke Disposal", steps: ["Asset Manager", "Facility Manager", "Management"], sla: "5 hari", active: false }
  ];

  /* ---------- Agenda & jadwal lab ---------- */
  const agendas = [
    { id: "AG-0771", title: "Rapat Koordinasi Mingguan Fasilitas", type: "Rapat", res: "RM-001", date: shift(0), time: "08:00 – 09:00", owner: "EMP-0001", recurring: "Mingguan (Senin)" },
    { id: "AG-0772", title: "Preventive Maintenance HVAC Gedung A", type: "Maintenance", res: "GA", date: shift(3), time: "17:00 – 20:00", owner: "EMP-0011", recurring: "Bulanan" },
    { id: "AG-0773", title: "Surveilan Akreditasi KAN", type: "Audit", res: "LAB-004", date: shift(0), time: "09:00 – 15:00", owner: "EMP-0002", recurring: "-" },
    { id: "AG-0774", title: "Praktikum Mahasiswa Magang", type: "Penggunaan Lab", res: "LAB-002", date: shift(1), time: "13:00 – 16:00", owner: "EMP-0010", recurring: "Mingguan (Selasa)" },
    { id: "AG-0775", title: "Inspeksi K3 Bulanan", type: "Inspeksi", res: "Semua Gedung", date: shift(5), time: "08:00 – 12:00", owner: "EMP-0001", recurring: "Bulanan" },
    { id: "AG-0776", title: "Weekly Asset Review", type: "Rapat", res: "RM-002", date: shift(5), time: "09:00 – 10:00", owner: "EMP-0004", recurring: "Mingguan (Jumat)" }
  ];

  /* ---------- Helper lookup ---------- */
  const byId = (arr, id) => arr.find((x) => x.id === id) || null;
  const personName = (id) => {
    const p = byId(people, id);
    if (p) return p.name;
    if (id === "EXT-0001") return "Universitas Teknologi Bangsa";
    if (id === "EXT-0002") return "PT Anugerah Sejahtera";
    return id;
  };
  const resName = (id) =>
    (byId(rooms, id) || byId(labs, id) || byId(equipment, id) || { name: id }).name;

  return {
    TODAY, iso, shift, org, people, rooms, labs, equipment, assets, bookings, eqBookings,
    loans, maintenance, calibration, approvals, priceList, packages, addons, quotations,
    invoices, payments, events, vendors, visitors, documents, audit, notifications,
    analytics, roles, permMatrix, workflows, agendas, byId, personName, resName
  };
})();
