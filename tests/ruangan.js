/* Uji layar Ruangan yang tersambung ke API.
 *
 * Yang dijaga: layar ini benar-benar MEMBACA dan MENULIS ke server, bukan
 * hanya tampak begitu. Karena itu server tiruannya menyimpan sungguhan —
 * ruangan yang dibuat lewat formulir harus muncul kembali dari daftar yang
 * ditarik ulang, bukan dari keadaan yang disimpan di peramban.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idRuang = 0;
  let idLab = 0;
  let idAset = 0;
  let nupBerjalan = 0;
  const aset = [];
  const ruangan = [];
  const lab = [];
  const pesanan = [];
  let idBooking = 0;
  const pinjaman = [];
  let idPinjam = 0;
  const ckTemplat = [];
  let idCkTemplat = 0;
  let idCkButir = 0;
  const ckPenugasan = [];
  let idCkPenugasan = 0;
  const ckRun = [];
  let idCkRun = 0;
  const orang = [
    { id: 91, nama: 'Dr. Sri Wahyuni', unit_kerja: 'Litbang' },
    { id: 92, nama: 'Andi Teknisi', unit_kerja: 'Pengujian' },
    { id: 93, nama: 'Rina Teknisi', unit_kerja: 'Pengujian' }
  ];

  const punyaSesi = (req) => {
    const c = (req.headers.cookie || '').match(/flms_sesi=([^;]+)/);
    return !!c && sesiAktif.has(c[1]);
  };

  const bentuk = (r) => ({
    id: r.id, kode: r.kode, nama: r.nama, jenis: r.jenis || null,
    gedung: r.gedung || null, lantai: r.lantai || null,
    luas_m2: r.luas_m2 || null, kapasitas: r.kapasitas || 0,
    tarif: {
      skema: r.skema_tarif || 'internal',
      skema_nama: { internal: 'Internal (tanpa tarif)', berbayar: 'Berbayar',
        internal_gratis: 'Internal gratis, eksternal berbayar',
        terbatas: 'Terbatas / khusus' }[r.skema_tarif || 'internal'],
      nilai: r.tarif === undefined ? null : r.tarif
    },
    status: { kode: r.status || 'tersedia',
      nama: { tersedia: 'Tersedia', pemeliharaan: 'Pemeliharaan', tidak_aktif: 'Tidak aktif' }[r.status || 'tersedia'] },
    perlu_persetujuan: !!r.perlu_persetujuan,
    penanggung_jawab: null,
    tata_letak: r.tata_letak || [],
    fasilitas: r.fasilitas || [],
    keterangan: r.keterangan || null,
    jumlah_booking_aktif: 0
  });

  const bentukLab = (l) => ({
    id: l.id, kode: l.kode, nama: l.nama, jenis: l.jenis || null,
    unit_kerja: l.unit_kerja || null, luas_m2: l.luas_m2 || null,
    kapasitas: l.kapasitas || 0, jam_layanan: l.jam_layanan || null,
    akreditasi: l.akreditasi || null,
    fasilitas: l.fasilitas || [],
    status: { kode: l.status || 'aktif',
      nama: { aktif: 'Aktif', pemeliharaan: 'Pemeliharaan', tidak_aktif: 'Tidak Aktif' }[l.status || 'aktif'] },
    ruangan: null,
    penanggung_jawab: l.penanggung_jawab_id
      ? orang.find((o) => o.id === l.penanggung_jawab_id) || null : null,
    supervisor: l.supervisor_id ? orang.find((o) => o.id === l.supervisor_id) || null : null,
    teknisi: (l.teknisi_ids || []).map((i) => orang.find((o) => o.id === i)).filter(Boolean),
    jumlah_aset: 0,
    keterangan: l.keterangan || null
  });

  const server = http.createServer((req, res) => {
    const asal = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', asal);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Siti Aminah', email: 's@x.id',
      peran: ['facility-manager'], izin: ['master-data.lihat', 'master-data.buat', 'master-data.ubah'] } };

    if (req.url.startsWith('/sanctum/csrf-cookie')) {
      res.setHeader('Set-Cookie', 'XSRF-TOKEN=t; Path=/; SameSite=Lax');
      res.writeHead(204); return res.end();
    }
    if (req.url.startsWith('/api/saya')) {
      return punyaSesi(req) ? kirim(200, pengguna) : kirim(401, { message: 'Unauthenticated.' });
    }
    if (req.url.startsWith('/api/masuk')) {
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        if (JSON.parse(b || '{}').password === 'sandi-benar') {
          const id = 'sesi' + (++urut); sesiAktif.add(id);
          res.setHeader('Set-Cookie', 'flms_sesi=' + id + '; Path=/; SameSite=Lax');
          return kirim(200, pengguna);
        }
        return kirim(422, { message: 'Tidak cocok.', errors: { email: ['Tidak cocok.'] } });
      });
    }

    if (req.url.startsWith('/api/rooms')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

      if (req.method === 'GET') {
        const u = new URL(req.url, 'http://x');
        let baris = ruangan.slice();
        const cari = u.searchParams.get('cari');
        if (cari) {
          const k = cari.toLowerCase();
          baris = baris.filter((r) =>
            (r.nama + ' ' + r.kode + ' ' + (r.gedung || '')).toLowerCase().indexOf(k) !== -1);
        }
        const jenis = u.searchParams.get('jenis');
        if (jenis) baris = baris.filter((r) => r.jenis === jenis);
        return kirim(200, { data: baris.map(bentuk), meta: { total: baris.length } });
      }

      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const galat = {};
          if (!isi.kode) galat.kode = ['Kode ruangan wajib diisi.'];
          if (ruangan.some((r) => r.kode === isi.kode)) galat.kode = ['Kode ruangan sudah dipakai.'];
          if (!isi.nama) galat.nama = ['Nama ruangan wajib diisi.'];
          if (isi.skema_tarif === 'berbayar' && (isi.tarif === null || isi.tarif === undefined)) {
            galat.tarif = ['Tarif wajib diisi bila skemanya berbayar.'];
          }
          if (Object.keys(galat).length) {
            return kirim(422, { message: 'Isian belum benar.', errors: galat });
          }
          isi.id = ++idRuang;
          ruangan.push(isi);
          return kirim(201, { data: bentuk(isi) });
        });
      }
    }

    if (req.url.startsWith('/api/peminjaman/ketersediaan')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });
      const u = new URL(req.url, 'http://x');
      const m = new Date(u.searchParams.get('mulai'));
      const sl = new Date(u.searchParams.get('selesai'));

      return kirim(200, { data: aset.map((a) => {
        const bentrok = pinjaman.filter((p) =>
          p.asset_id === a.id &&
          ['menunggu', 'disetujui', 'dipinjam'].indexOf(p.status) !== -1 &&
          new Date(p.mulai) < sl && new Date(p.selesai) > m);

        return {
          id: a.id, nama: a.nama, kode_internal: 'STU/SRV/' + String(a.nup).padStart(4, '0'),
          bmn_id: null, merk: a.merk || null, tipe: a.tipe || null,
          serial_number: a.serial_number || null,
          kondisi: { kode: 'B', nama: 'Baik' },
          wajib_kalibrasi: false, kalibrasi_kedaluwarsa: false,
          lokasi: null,
          tersedia: bentrok.length === 0,
          alasan: bentrok.length ? 'Sedang dipinjam pada rentang waktu ini' : null,
          bentrok: bentrok.map((p) => ({ id: p.id, keperluan: p.keperluan,
            peminjam: 'Siti Aminah', mulai: p.mulai, selesai: p.selesai, status: p.status }))
        };
      }) });
    }

    if (req.url.startsWith('/api/persetujuan/antrean')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });
      const u = new URL(req.url, 'http://x');
      const jenis = u.searchParams.get('jenis') || 'booking';

      // Server MENGELUARKAN pengajuan milik pengguna sendiri dari antrean.
      // Seluruh pengajuan pada uji ini dibuat oleh pengguna yang sama, jadi
      // antreannya memang harus kosong — dan itulah yang diperiksa.
      return kirim(200, { data: [] });
    }

    if (req.url.startsWith('/api/peminjaman')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

      const bentukPinjam = (p) => ({
        id: p.id, keperluan: p.keperluan,
        lokasi_pemakaian: p.lokasi_pemakaian || null, unit_kerja: null,
        jadwal: { mulai: p.mulai, selesai: p.selesai },
        serah_terima: { diambil_pada: null, dikembalikan_pada: null },
        status: { kode: p.status, nama: { menunggu: 'Menunggu persetujuan',
          disetujui: 'Disetujui', dipinjam: 'Sedang dipinjam',
          dikembalikan: 'Dikembalikan', ditolak: 'Ditolak' }[p.status] },
        terlambat: false, kondisi_saat_kembali: null,
        alat: (() => { const a = aset.find((x) => x.id === p.asset_id);
          return a ? { id: a.id, nama: a.nama,
            kode_internal: 'STU/SRV/' + String(a.nup).padStart(4, '0'), bmn_id: null } : null; })(),
        peminjam: { id: 1, nama: 'Siti Aminah' },
        catatan: null,
        persetujuan: { disetujui_pada: null, alasan_penolakan: null }
      });

      if (req.method === 'GET') {
        return kirim(200, { data: pinjaman.map(bentukPinjam), meta: { total: pinjaman.length } });
      }

      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const m = new Date(isi.mulai), sl = new Date(isi.selesai);

          const tabrak = pinjaman.find((x) =>
            x.asset_id === isi.asset_id &&
            ['menunggu', 'disetujui', 'dipinjam'].indexOf(x.status) !== -1 &&
            new Date(x.mulai) < sl && new Date(x.selesai) > m);

          if (tabrak) {
            return kirim(422, { message: 'Alat sedang dipinjam.', errors: { mulai: [
              'Alat sudah dipinjam untuk "' + tabrak.keperluan + '" pada rentang waktu tersebut.'] } });
          }
          if (!isi.keperluan) {
            return kirim(422, { message: 'x', errors: { keperluan: ['Keperluan wajib diisi.'] } });
          }

          isi.id = ++idPinjam;
          isi.status = 'menunggu';
          pinjaman.push(isi);
          return kirim(201, { data: bentukPinjam(isi) });
        });
      }
    }

    if (req.url.startsWith('/api/bookings/ketersediaan')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });
      const u = new URL(req.url, 'http://x');
      const m = new Date(u.searchParams.get('mulai'));
      const sl = new Date(u.searchParams.get('selesai'));
      const kapMin = Number(u.searchParams.get('kapasitas_min') || 0);

      return kirim(200, { data: ruangan
        .filter((r) => !kapMin || (r.kapasitas || 0) >= kapMin)
        .map((r) => {
          // Rentang setengah terbuka, sama seperti pemicu basis data.
          const bentrok = pesanan.filter((b) =>
            b.room_id === r.id &&
            ['menunggu', 'disetujui', 'berlangsung', 'selesai'].indexOf(b.status) !== -1 &&
            new Date(b.mulai) < sl && new Date(b.selesai) > m);

          return {
            id: r.id, kode: r.kode, nama: r.nama, jenis: r.jenis || null,
            gedung: r.gedung || null, lantai: r.lantai || null,
            kapasitas: r.kapasitas || 0,
            status_ruangan: { kode: 'tersedia', nama: 'Tersedia' },
            tarif: { skema: r.skema_tarif || 'internal', skema_nama: 'Internal', nilai: r.tarif || null },
            fasilitas: r.fasilitas || [], tata_letak: r.tata_letak || [],
            perlu_persetujuan: false,
            tersedia: bentrok.length === 0,
            alasan: bentrok.length ? 'Bentrok dengan pemesanan lain' : null,
            bentrok: bentrok.map((b) => ({ id: b.id, keperluan: b.keperluan,
              mulai: b.mulai, selesai: b.selesai, status: b.status }))
          };
        }) });
    }

    if (req.url.startsWith('/api/bookings')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

      const bentukBooking = (b) => ({
        id: b.id, keperluan: b.keperluan, jumlah_peserta: b.jumlah_peserta || null,
        mulai: b.mulai, selesai: b.selesai,
        status: { kode: b.status, nama: { menunggu: 'Menunggu persetujuan',
          disetujui: 'Disetujui', ditolak: 'Ditolak', dibatalkan: 'Dibatalkan' }[b.status],
          memblokir: ['ditolak', 'dibatalkan'].indexOf(b.status) === -1 },
        catatan: b.catatan || null,
        persetujuan: { disetujui_pada: null, alasan_penolakan: null, oleh: null },
        ruangan: (() => { const r = ruangan.find((x) => x.id === b.room_id);
          return r ? { id: r.id, kode: r.kode, nama: r.nama } : null; })(),
        pemohon: { id: 1, nama: 'Siti Aminah' }
      });

      if (req.method === 'GET') {
        return kirim(200, { data: pesanan.map(bentukBooking), meta: { total: pesanan.length } });
      }

      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const m = new Date(isi.mulai), sl = new Date(isi.selesai);

          // Penjaga yang sesungguhnya: pemicu basis data. Pesannya menyebut
          // pemesanan penabraknya, karena itulah yang memberi tahu pengguna
          // harus menggeser ke jam berapa.
          const tabrak = pesanan.find((x) =>
            x.room_id === isi.room_id &&
            ['menunggu', 'disetujui', 'berlangsung'].indexOf(x.status) !== -1 &&
            new Date(x.mulai) < sl && new Date(x.selesai) > m);

          if (tabrak) {
            const jam = (t) => new Date(t).toTimeString().slice(0, 5);
            return kirim(422, { message: 'Jadwal bentrok.', errors: { mulai: [
              'Ruangan sudah dipesan untuk "' + tabrak.keperluan + '" pukul ' +
              jam(tabrak.mulai) + '-' + jam(tabrak.selesai) + '.'] } });
          }

          isi.id = ++idBooking;
          isi.status = 'menunggu';
          pesanan.push(isi);
          return kirim(201, { data: bentukBooking(isi) });
        });
      }
    }

    if (req.url.startsWith('/api/bmn/kode-barang')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });
      return kirim(200, { data: [{ kode: '3.08.01.03.001', uraian: 'Unit Alat Laboratorium' }] });
    }

    if (/^\/api\/assets\/\d+\/foto/.test(req.url)) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });
      if (req.method === 'POST') {
        let n = 0;
        req.on('data', (d) => { n += d.length; });
        return req.on('end', () => kirim(201, {
          data: { id: 1, url: '/x', mime: 'image/jpeg', ukuran: n, utama: true }
        }));
      }
    }

    if (req.url.startsWith('/api/assets')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');

          // Server MENOLAK nup/kode_lokasi kiriman: keduanya wewenangnya.
          if (isi.nup !== undefined || isi.kode_lokasi !== undefined || isi.bmn_id !== undefined) {
            return kirim(422, { message: 'x',
              errors: { nup: ['NUP diterbitkan server, tidak boleh dikirim.'] } });
          }
          if (!isi.nama) return kirim(422, { message: 'x', errors: { nama: ['Nama barang wajib diisi.'] } });

          isi.id = ++idAset;
          // NUP diterbitkan di sini — sengaja mulai dari 7 supaya berbeda dari
          // tebakan peramban, sehingga uji dapat membuktikan yang ditampilkan
          // memang datang dari server.
          isi.nup = (nupBerjalan += 1) + 6;
          aset.push(isi);

          return kirim(201, { data: {
            id: isi.id,
            nama: isi.nama,
            kode_internal: 'STU/SRV/' + String(isi.nup).padStart(4, '0'),
            bmn: {
              id: '024.05.0100.652431.000.' + isi.kode_barang + '.' + String(isi.nup).padStart(5, '0'),
              kode_barang: isi.kode_barang,
              nup: isi.nup
            },
            foto: { utama: null, jumlah: 0 }
          } });
        });
      }

      if (req.method === 'GET') {
        const bentukAset = (a) => ({
          id: a.id,
          bmn: {
            id: '024.05.0100.652431.000.' + a.kode_barang + '.' + String(a.nup).padStart(5, '0'),
            kode_lokasi: '024.05.0100.652431.000',
            kode_barang: a.kode_barang,
            uraian_barang: 'Unit Alat Laboratorium',
            nup: a.nup, nup_fmt: String(a.nup).padStart(5, '0'), kib: 'B'
          },
          kode_internal: 'STU/SRV/' + String(a.nup).padStart(4, '0'),
          nama: a.nama, merk: a.merk || null, tipe: a.tipe || null,
          serial_number: a.serial_number || null,
          spesifikasi: null, kapasitas_ukur: null, kelengkapan: [],
          foto: { utama: null, jumlah: 0 },
          perolehan: { cara: null, tanggal: '2022-07-14', sumber_dana: null,
                       no_bukti: null, no_kontrak: null, kuantitas: 1, satuan: 'Unit' },
          penyusutan: { nilai_perolehan: a.nilai_perolehan || 0, masa_manfaat: 8,
                        akumulasi_penyusutan: 0, nilai_buku: a.nilai_perolehan || 0,
                        habis_masa_manfaat: false },
          kondisi: { kode: 'B', nama: 'Baik' },
          status_penggunaan: null, psp: { nomor: null, tanggal: null },
          wajib_kalibrasi: false, unit_kerja: null,
          laboratorium: null, ruangan: null, penanggung_jawab: null, keterangan: null
        });

        if (req.url.indexOf('/ringkasan') !== -1) {
          // Ringkasan atas SELURUH aset. Nilainya sengaja dibuat berbeda dari
          // jumlah halaman supaya uji dapat membuktikan angkanya datang dari
          // sini, bukan dihitung antarmuka dari baris yang tampil.
          const perolehan = aset.reduce((s, a) => s + (a.nilai_perolehan || 0), 0);
          return kirim(200, { data: {
            jumlah: aset.length + 99,
            nilai_perolehan: perolehan + 7000000000,
            akumulasi_penyusutan: 1000000000,
            nilai_buku: perolehan + 6000000000,
            kondisi: [{ kode: 'B', nama: 'Baik', jumlah: aset.length + 99 },
                      { kode: 'RR', nama: 'Rusak Ringan', jumlah: 0 },
                      { kode: 'RB', nama: 'Rusak Berat', jumlah: 4 }]
          } });
        }

        return kirim(200, { data: aset.map(bentukAset), meta: { total: aset.length } });
      }
    }

    if (req.url.startsWith('/api/pengguna')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });
      return kirim(200, { data: orang, terpotong: false });
    }

    if (req.url.startsWith('/api/laboratories')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

      if (req.method === 'GET') {
        return kirim(200, { data: lab.map(bentukLab), meta: { total: lab.length } });
      }

      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          if (!isi.kode) return kirim(422, { message: 'x', errors: { kode: ['Kode laboratorium wajib diisi.'] } });
          isi.id = ++idLab;
          lab.push(isi);
          return kirim(201, { data: bentukLab(isi) });
        });
      }

      if (req.method === 'PATCH') {
        const id = Number(req.url.split('/').pop());
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const l = lab.find((x) => x.id === id);
          if (!l) return kirim(404, { message: 'Tidak ditemukan' });
          Object.assign(l, isi);
          return kirim(200, { data: bentukLab(l) });
        });
      }
    }

    if (req.url.startsWith('/api/checklist/')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

      const JENIS_NAMA = {
        pengecekan: 'Pengecekan & Verifikasi', perawatan: 'Perawatan',
        penyewaan: 'Persiapan Penyewaan', kebersihan: 'Kebersihan',
        kerapian: 'Kerapian', kelayakan: 'Kelayakan'
      };
      const TIPE_NAMA = { ya_tidak: 'Ya / Tidak', angka: 'Angka', teks: 'Teks bebas', pilihan: 'Pilihan' };
      const PERIODE_NAMA = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan',
        triwulanan: 'Triwulanan', tahunan: 'Tahunan', insidental: 'Insidental' };
      const STATUS_RUN_NAMA = { berjalan: 'Sedang berjalan', selesai: 'Selesai' };

      const sdRingkas = (o) => {
        if (o.room_id) { const r = ruangan.find((x) => x.id === o.room_id); return { jenis: 'ruangan', id: o.room_id, nama: r ? r.nama : '—' }; }
        if (o.laboratory_id) { const l = lab.find((x) => x.id === o.laboratory_id); return { jenis: 'laboratorium', id: o.laboratory_id, nama: l ? l.nama : '—' }; }
        if (o.asset_id) { const a = aset.find((x) => x.id === o.asset_id); return { jenis: 'aset', id: o.asset_id, nama: a ? a.nama : '—' }; }
        return null;
      };

      const bentukButir = (b) => ({
        id: b.id, urutan: b.urutan, teks: b.teks,
        tipe: { kode: b.tipe, nama: TIPE_NAMA[b.tipe] },
        wajib: !!b.wajib, pilihan: b.pilihan || [], satuan: b.satuan || null, petunjuk: b.petunjuk || null
      });

      const bentukTemplat = (t) => ({
        id: t.id, nama: t.nama, jenis: { kode: t.jenis, nama: JENIS_NAMA[t.jenis] },
        deskripsi: t.deskripsi || null, aktif: !!t.aktif,
        jumlah_butir: t.items.length,
        jumlah_penugasan: ckPenugasan.filter((p) => p.checklist_template_id === t.id).length,
        butir: t.items.map(bentukButir),
        dibuat_oleh: { id: 1, nama: 'Siti Aminah' }
      });

      const bentukPenugasan = (a) => {
        const t = ckTemplat.find((x) => x.id === a.checklist_template_id);
        return {
          id: a.id,
          periode: { kode: a.periode, nama: PERIODE_NAMA[a.periode] },
          aktif: true,
          templat: t ? { id: t.id, nama: t.nama, jenis: JENIS_NAMA[t.jenis] } : null,
          sumber_daya: sdRingkas(a),
          penanggung_jawab: { id: a.user_id, nama: (orang.find((o) => o.id === a.user_id) || {}).nama || '—' }
        };
      };

      const bentukRun = (r) => {
        const t = ckTemplat.find((x) => x.id === r.checklist_template_id);
        return {
          id: r.id,
          status: { kode: r.status, nama: STATUS_RUN_NAMA[r.status] },
          dimulai_pada: r.dimulai_pada, selesai_pada: r.selesai_pada,
          hasil: { butir_total: r.butir_total, butir_lulus: r.butir_lulus, skor: r.skor },
          templat: t ? { id: t.id, nama: t.nama, jenis: JENIS_NAMA[t.jenis], butir: t.items.map(bentukButir) } : null,
          sumber_daya: sdRingkas(r),
          pelaksana: { id: r.user_id, nama: 'Siti Aminah' },
          jawaban: r.jawaban.map((j) => ({ butir_id: j.checklist_item_id, nilai: j.nilai, lulus: j.lulus, catatan: j.catatan })),
          catatan: r.catatan || null
        };
      };

      // /api/checklist/templat  &  /api/checklist/templat/{id}
      if (req.url.startsWith('/api/checklist/templat')) {
        const sisa = req.url.slice('/api/checklist/templat'.length).split('?')[0];

        if (!sisa || sisa === '/') {
          if (req.method === 'GET') {
            return kirim(200, { data: ckTemplat.map(bentukTemplat), meta: { total: ckTemplat.length } });
          }
          if (req.method === 'POST') {
            let b = ''; req.on('data', (d) => (b += d));
            return req.on('end', () => {
              const isi = JSON.parse(b || '{}');
              const galat = {};
              if (!isi.nama) galat.nama = ['Nama template wajib diisi.'];
              if (!JENIS_NAMA[isi.jenis]) galat.jenis = ['Jenis template tidak dikenali.'];
              if (!Array.isArray(isi.items) || !isi.items.length) galat.items = ['Minimal satu butir wajib diisi.'];
              if (Object.keys(galat).length) return kirim(422, { message: 'Isian belum benar.', errors: galat });

              const t = {
                id: ++idCkTemplat, nama: isi.nama, jenis: isi.jenis,
                deskripsi: isi.deskripsi || null, aktif: isi.aktif !== false,
                items: isi.items.map((it, i) => ({
                  id: ++idCkButir, urutan: i + 1, teks: it.teks, tipe: it.tipe, wajib: !!it.wajib,
                  satuan: it.satuan || null, petunjuk: it.petunjuk || null, pilihan: it.pilihan || []
                }))
              };
              ckTemplat.push(t);
              return kirim(201, { data: bentukTemplat(t) });
            });
          }
        } else {
          const id = Number(sisa.replace('/', ''));
          if (req.method === 'GET') {
            const t = ckTemplat.find((x) => x.id === id);
            if (!t) return kirim(404, { message: 'Tidak ditemukan' });
            return kirim(200, { data: bentukTemplat(t) });
          }
        }
      }

      if (req.url.startsWith('/api/checklist/penugasan') && req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const galat = {};
          if (!ckTemplat.some((t) => t.id === isi.checklist_template_id)) galat.checklist_template_id = ['Templat tidak ditemukan.'];
          if (!isi.user_id) galat.user_id = ['Penanggung jawab wajib dipilih.'];
          if (!isi.room_id && !isi.laboratory_id && !isi.asset_id) galat.room_id = ['Sumber daya wajib dipilih.'];
          if (Object.keys(galat).length) return kirim(422, { message: 'Isian belum benar.', errors: galat });

          const a = { id: ++idCkPenugasan, checklist_template_id: isi.checklist_template_id,
            room_id: isi.room_id || null, laboratory_id: isi.laboratory_id || null, asset_id: isi.asset_id || null,
            user_id: isi.user_id, periode: isi.periode || 'bulanan' };
          ckPenugasan.push(a);
          return kirim(201, { data: bentukPenugasan(a) });
        });
      }

      if (req.url.startsWith('/api/checklist/tugas-saya') && req.method === 'GET') {
        // Server tiruan hanya melayani satu sesi, jadi seluruh penugasan
        // yang dibuat pada uji ini dianggap milik sesi tersebut — server
        // sungguhan memfilter berdasarkan sesinya sendiri (auth()->id()),
        // tapi mock ini tidak punya identitas kedua untuk dibandingkan.
        return kirim(200, { data: ckPenugasan.map(bentukPenugasan) });
      }

      // /api/checklist/pelaksanaan , /{id} , /{id}/jawab , /{id}/selesaikan
      if (req.url.startsWith('/api/checklist/pelaksanaan')) {
        const sisa = req.url.slice('/api/checklist/pelaksanaan'.length).split('?')[0];

        if (!sisa || sisa === '/') {
          if (req.method === 'GET') {
            const u = new URL(req.url, 'http://x');
            let baris = ckRun.slice();
            const jenisSd = u.searchParams.get('jenis_sumber_daya');
            const idSd = u.searchParams.get('sumber_daya_id');
            if (jenisSd && idSd) {
              const kunci = { ruangan: 'room_id', laboratorium: 'laboratory_id', aset: 'asset_id' }[jenisSd];
              baris = baris.filter((r) => String(r[kunci]) === String(idSd));
            }
            return kirim(200, { data: baris.map(bentukRun), meta: { total: baris.length } });
          }
          if (req.method === 'POST') {
            let b = ''; req.on('data', (d) => (b += d));
            return req.on('end', () => {
              const isi = JSON.parse(b || '{}');
              const t = ckTemplat.find((x) => x.id === isi.checklist_template_id);
              if (!t) return kirim(422, { message: 'x', errors: { checklist_template_id: ['Templat tidak ditemukan.'] } });
              if (!t.aktif) return kirim(422, { message: 'x', errors: { checklist_template_id: ['Templat ini tidak aktif.'] } });
              if (!t.items.length) return kirim(422, { message: 'x', errors: { checklist_template_id: ['Templat ini tidak memiliki butir.'] } });

              const r = { id: ++idCkRun, checklist_template_id: t.id,
                room_id: isi.room_id || null, laboratory_id: isi.laboratory_id || null, asset_id: isi.asset_id || null,
                user_id: 1, status: 'berjalan', dimulai_pada: new Date(2026, 0, 1).toISOString(), selesai_pada: null,
                jawaban: [], butir_total: null, butir_lulus: null, skor: null, catatan: null };
              ckRun.push(r);
              return kirim(201, { data: bentukRun(r) });
            });
          }
        } else if (/^\/\d+$/.test(sisa)) {
          const id = Number(sisa.replace('/', ''));
          if (req.method === 'GET') {
            const r = ckRun.find((x) => x.id === id);
            if (!r) return kirim(404, { message: 'Tidak ditemukan' });
            return kirim(200, { data: bentukRun(r) });
          }
        } else if (/^\/\d+\/jawab$/.test(sisa)) {
          const id = Number(sisa.split('/')[1]);
          let b = ''; req.on('data', (d) => (b += d));
          return req.on('end', () => {
            const isi = JSON.parse(b || '{}');
            const r = ckRun.find((x) => x.id === id);
            if (!r) return kirim(404, { message: 'Tidak ditemukan' });
            const t = ckTemplat.find((x) => x.id === r.checklist_template_id);
            const butir = t.items.find((b2) => b2.id === isi.checklist_item_id);
            if (!butir) return kirim(422, { message: 'x', errors: { checklist_item_id: ['Butir ini bukan bagian dari templat.'] } });

            const lulus = butir.tipe === 'ya_tidak'
              ? (isi.nilai === 'ya' ? true : isi.nilai === 'tidak' ? false : null) : null;
            const ada = r.jawaban.find((j) => j.checklist_item_id === isi.checklist_item_id);
            if (ada) { ada.nilai = isi.nilai; ada.lulus = lulus; ada.catatan = isi.catatan || null; }
            else r.jawaban.push({ checklist_item_id: isi.checklist_item_id, nilai: isi.nilai, lulus: lulus, catatan: isi.catatan || null });

            return kirim(200, { data: bentukRun(r) });
          });
        } else if (/^\/\d+\/selesaikan$/.test(sisa)) {
          const id = Number(sisa.split('/')[1]);
          const r = ckRun.find((x) => x.id === id);
          if (!r) return kirim(404, { message: 'Tidak ditemukan' });
          const t = ckTemplat.find((x) => x.id === r.checklist_template_id);

          const dijawabId = new Set(r.jawaban.map((j) => j.checklist_item_id));
          const belum = t.items.filter((b2) => b2.wajib && !dijawabId.has(b2.id));
          if (belum.length) {
            return kirim(422, { message: 'Ada butir wajib yang belum dijawab.', errors: {
              butir: belum.map((b2) => '"' + b2.teks + '" wajib diisi.') } });
          }

          const dinilai = r.jawaban.filter((j) => j.lulus !== null);
          r.butir_total = dinilai.length;
          r.butir_lulus = dinilai.filter((j) => j.lulus === true).length;
          r.skor = dinilai.length ? Math.round((r.butir_lulus / r.butir_total) * 100) : null;
          r.status = 'selesai';
          r.selesai_pada = new Date(2026, 0, 1, 0, 30).toISOString();

          return kirim(200, { data: bentukRun(r) });
        }
      }
    }

    kirim(404, { message: 'Tidak ditemukan' });
  });

  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

(async () => {
  const browser = await launch();
  const { server, port } = await apiTiruan();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

  await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });
  await page.evaluate((p) => {
    localStorage.setItem('flms.api', 'http://127.0.0.1:' + p);
    localStorage.removeItem('flms.mode');
  }, port);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.fill('#masukEmail', 'siti@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  /* ============ 1. DAFTAR KOSONG ============ */
  console.log('\n--- 1. Basis data kosong ---');
  await page.evaluate(() => { location.hash = '#/rooms'; });
  await page.waitForTimeout(800);

  const kosong = await page.textContent('#ruangDaftar');
  ok(/Belum ada ruangan/.test(kosong),
    'Basis data kosong ditampilkan apa adanya, bukan diisi data purwarupa');
  ok(!(await page.$('.mode-banner')), 'Tidak ada spanduk data contoh — ini data sungguhan');

  const kpiAwal = await page.textContent('#ruangKpi');
  ok(/\b0\b/.test(kpiAwal), 'Ringkasan menunjukkan nol, bukan angka purwarupa');

  /* ============ 2. VALIDASI SERVER SAMPAI KE FORMULIR ============ */
  console.log('\n--- 2. Validasi server tampil di formulir ---');
  await page.click('#ruangDaftar button');   // "Tambah Ruangan Pertama"
  await page.waitForTimeout(400);
  ok(!!(await page.$('#fKode')), 'Formulir tambah ruangan terbuka');

  await page.fill('#fNama', 'Tanpa Kode');
  await page.click('#ruangSimpan');
  await page.waitForTimeout(600);

  const galat = await page.$('#ruangFormGalat');
  const galatTampil = galat ? await galat.isVisible() : false;
  ok(galatTampil, 'Galat dari server tampil di dalam formulir');
  const teksGalat = galat ? await galat.textContent() : '';
  ok(/Kode ruangan wajib diisi/.test(teksGalat),
    'Pesannya pesan server, bukan pesan generik', teksGalat.trim());
  ok(!!(await page.$('#fKode')), 'Formulir tetap terbuka agar isian dapat diperbaiki');

  /* ============ 3. SIMPAN SUNGGUHAN ============ */
  console.log('\n--- 3. Menyimpan ke basis data ---');
  await page.fill('#fKode', 'CR-B-401');
  await page.fill('#fNama', 'Conference Room Garuda');
  await page.fill('#fJenis', 'Conference Room');
  await page.fill('#fGedung', 'Gedung B');
  await page.fill('#fLantai', '4');
  await page.fill('#fLuas', '96');
  await page.fill('#fKapasitas', '45');
  await page.selectOption('#fSkema', 'berbayar');
  await page.fill('#fTarif', '1250000');
  await page.fill('#fTataLetak', 'Theater, Classroom, U-Shape');
  await page.fill('#fFasilitas', 'Proyektor 2x, Sound System, Video Conf, AC');
  await page.click('#ruangSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#fKode')), 'Formulir tertutup setelah berhasil');

  const daftar = await page.textContent('#ruangDaftar');
  ok(/Conference Room Garuda/.test(daftar), 'Ruangan muncul di daftar');
  ok(/CR-B-401/.test(daftar), 'Kodenya tampil');
  ok(/Berbayar/.test(daftar), 'Skema tarif tampil terbaca, bukan kode mentah');

  // Bukti bahwa yang tampil datang dari server, bukan dari keadaan peramban.
  const dariServer = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/rooms', { credentials: 'include' });
    return (await r.json()).data.length;
  }, port);
  ok(dariServer === 1, 'Server benar-benar menyimpan satu ruangan', 'jumlah=' + dariServer);

  /* ============ 4. MUAT ULANG — DATA BERTAHAN ============ */
  console.log('\n--- 4. Data bertahan setelah muat ulang ---');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.evaluate(() => { location.hash = '#/rooms'; });
  await page.waitForTimeout(900);

  const setelahMuat = await page.textContent('#ruangDaftar');
  ok(/Conference Room Garuda/.test(setelahMuat),
    'Ruangan masih ada setelah halaman dimuat ulang — inilah bedanya dengan purwarupa');

  const kpi = await page.textContent('#ruangKpi');
  ok(/45/.test(kpi), 'Ringkasan ikut menghitung dari data sungguhan');

  /* ============ 5. PENYARINGAN LEWAT SERVER ============ */
  console.log('\n--- 5. Penyaringan dijalankan server ---');
  await page.fill('#ruangCari', 'garuda');
  await page.waitForTimeout(800);
  ok(/Conference Room Garuda/.test(await page.textContent('#ruangDaftar')),
    'Pencarian menemukan ruangan');

  await page.fill('#ruangCari', 'tidakadaini');
  await page.waitForTimeout(800);
  const nihil = await page.textContent('#ruangDaftar');
  ok(/tidak ada ruangan yang cocok/i.test(nihil),
    'Kosong karena penyaringan dibedakan dari kosong karena belum ada data');
  ok(/Hapus penyaringan/.test(nihil), 'Menawarkan menghapus penyaringan, bukan menambah data');

  /* ============ 6. DETAIL ============ */
  console.log('\n--- 6. Detail ruangan ---');
  await page.click('#ruangDaftar button');   // hapus penyaringan
  await page.waitForTimeout(800);
  await page.click('.res-card');
  await page.waitForTimeout(500);

  const drawer = await page.textContent('.drawer, .drw, body');
  ok(/Conference Room Garuda/.test(drawer), 'Detail terbuka');
  ok(/Proyektor 2x/.test(drawer), 'Fasilitas yang diisi ikut tersimpan dan tampil');
  ok(/Theater/.test(drawer), 'Tata letak ikut tersimpan dan tampil');

  // Bagian checklist sempat HILANG saat layar ini ditulis ulang, dan tidak
  // ada yang menandainya — persis kemunduran senyap yang paling sulit
  // ketahuan. Dikunci di sini.
  ok(/[Cc]hecklist/.test(drawer), 'Bagian checklist tetap ada pada detail ruangan');

  ok(errs.length === 0, 'Tanpa galat halaman', errs.join(' | '));

  /* ============ 7. LABORATORIUM ============ */
  console.log('\n--- 7. Laboratorium tersambung ---');
  await page.evaluate(() => { UI.closeDrawer(); location.hash = '#/lab'; });
  await page.waitForTimeout(900);

  ok(/Belum ada laboratorium/.test(await page.textContent('#labDaftar')),
    'Basis data kosong ditampilkan apa adanya');

  await page.click('#labDaftar button');
  await page.waitForTimeout(600);
  ok(!!(await page.$('#lKode')), 'Formulir tambah laboratorium terbuka');

  // Pemilih orang terisi dari endpoint /api/pengguna.
  const jumlahOpsiPj = await page.$$eval('#lPj option', (e) => e.length);
  ok(jumlahOpsiPj === 4, 'Pemilih penanggung jawab terisi dari server', 'opsi=' + jumlahOpsiPj);

  await page.fill('#lKode', 'LAB-KIM-01');
  await page.fill('#lNama', 'Laboratorium Kimia Analitik');
  await page.fill('#lJenis', 'Pengujian');
  await page.fill('#lKapasitas', '24');
  await page.fill('#lLuas', '145');
  await page.fill('#lJam', '07:30 - 17:00');
  await page.fill('#lAkreditasi', 'ISO/IEC 17025:2017');
  await page.selectOption('#lPj', '91');
  await page.selectOption('#lTeknisi', ['92', '93']);
  await page.fill('#lFasilitas', 'Fume Hood 4, Emergency Shower, APAR CO2');
  await page.click('#labSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#lKode')), 'Formulir tertutup setelah berhasil');

  const daftarLab = await page.textContent('#labDaftar');
  ok(/Laboratorium Kimia Analitik/.test(daftarLab), 'Laboratorium muncul di daftar');
  ok(/Dr. Sri Wahyuni/.test(daftarLab), 'Penanggung jawab tampil sebagai nama');
  ok(/ISO\/IEC 17025/.test(daftarLab), 'Akreditasi tampil');

  const kpiLab = await page.textContent('#labKpi');
  ok(/Tanpa Penanggung Jawab/.test(kpiLab), 'Ringkasan menyoroti lab tanpa penanggung jawab');

  await page.click('#labDaftar .res-card');
  await page.waitForTimeout(500);
  const drawerLab = await page.textContent('body');
  ok(/Andi Teknisi/.test(drawerLab) && /Rina Teknisi/.test(drawerLab),
    'Kedua teknisi tersimpan dan tampil di detail');
  ok(/Fume Hood 4/.test(drawerLab), 'Fasilitas tersimpan dan tampil');
  ok(/[Cc]hecklist/.test(drawerLab), 'Bagian checklist tetap ada pada detail laboratorium');

  /* --- penyuntingan tidak menghapus teknisi --- */
  await page.click('button:has-text("Ubah")');
  await page.waitForTimeout(700);
  const teknisiTerpilih = await page.$$eval('#lTeknisi option:checked', (e) => e.length);
  ok(teknisiTerpilih === 2, 'Formulir ubah memuat teknisi yang sudah ditugaskan',
    'terpilih=' + teknisiTerpilih);

  await page.fill('#lKapasitas', '30');
  await page.click('#labSimpan');
  await page.waitForTimeout(900);

  await page.click('#labDaftar .res-card');
  await page.waitForTimeout(500);
  const setelahUbah = await page.textContent('body');
  ok(/Andi Teknisi/.test(setelahUbah),
    'Menyunting kapasitas tidak menghapus penugasan teknisi');

  ok(errs.length === 0, 'Tanpa galat halaman pada modul laboratorium', errs.join(' | '));

  /* ============ 8. REGISTRASI ASET (BMN) ============ */
  console.log('\n--- 8. Registrasi aset tersimpan sungguhan ---');
  await page.evaluate(() => { UI.closeDrawer(); location.hash = '#/equipment/new'; });
  await page.waitForTimeout(1200);

  // Pemilih penempatan terisi dari server, bukan dari data purwarupa.
  const opsiLab = await page.$$eval('#regLab option', (e) => e.map((x) => x.textContent.trim()));
  ok(opsiLab.some((t) => /Laboratorium Kimia Analitik/.test(t)),
    'Pemilih laboratorium terisi dari basis data', opsiLab.join(' | ').slice(0, 80));

  const opsiRuang = await page.$$eval('#regRuang option', (e) => e.map((x) => x.textContent.trim()));
  ok(opsiRuang.some((t) => /Conference Room Garuda/.test(t)),
    'Pemilih ruangan terisi dari basis data');

  // Peringatan bahwa NUP pratinjau hanyalah perkiraan.
  const badanReg = await page.textContent('#viewBody');
  ok(/perkiraan/i.test(badanReg),
    'Pratinjau NUP ditandai sebagai perkiraan, bukan nomor final');

  await page.evaluate(() => {
    regSet('nama', 'HPLC Shimadzu LC-2050');
    regSet('merk', 'Shimadzu');
    regSet('sn', 'SHZ-LC-88421');
    regSet('nilai', 850000000);
  });
  await page.selectOption('#regLab', { index: 1 });
  await page.selectOption('#regPic', { index: 1 });
  await page.waitForTimeout(200);

  // NUP yang ditebak peramban sebelum menyimpan.
  const nupTebakan = await page.evaluate(() => {
    const m = document.getElementById('regPreview').textContent.match(/NUP\s+(\d+)/);
    return m ? m[1] : null;
  });

  await page.click('#regSimpanBtn');
  await page.waitForTimeout(1200);

  // Dibaca dari elemen MODAL-nya saja. Versi pertama uji ini membaca seluruh
  // body, sehingga regex kode BMN menangkap kartu pratinjau di halaman —
  // yang justru memuat NUP tebakan peramban — dan uji "nomor datang dari
  // server" lulus-palsu terhadap angka yang salah.
  const modal = await page.textContent('.overlay .modal');
  ok(/berhasil diregistrasi/i.test(modal), 'Registrasi berhasil');
  ok(!/Simulasi registrasi/.test(modal), 'Bukan simulasi — benar-benar tersimpan');

  const bmnTampil = (modal.match(/024\.05\.0100\.652431\.000\.[0-9.]+/) || [])[0];
  ok(!!bmnTampil, 'Kode BMN tampil', bmnTampil);
  ok(/00007$/.test(bmnTampil || ''),
    'Kode BMN memakai NUP terbitan SERVER, bukan tebakan peramban',
    'tebakan=' + nupTebakan + ' tampil=' + bmnTampil);

  ok(/STU\/SRV\/0007/.test(modal),
    'Kode internal juga datang dari server');

  // Bukti tersimpan di server.
  const jumlahAset = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/assets', { credentials: 'include' });
    return (await r.json()).data.length;
  }, port);
  ok(jumlahAset === 1, 'Aset benar-benar tersimpan di server', 'jumlah=' + jumlahAset);

  // Wizard dibersihkan supaya barang berikutnya tidak mewarisi nomor seri.
  await page.evaluate(() => UI.closeModal());
  await page.waitForTimeout(300);
  const snTersisa = await page.evaluate(() => window.REG ? REG.sn : null);
  ok(snTersisa === '' || snTersisa === null,
    'Nomor seri dibersihkan setelah simpan, agar tidak terbawa ke barang berikutnya');

  ok(errs.length === 0, 'Tanpa galat halaman pada registrasi aset', errs.join(' | '));

  /* ============ 9. REGISTER BMN ============ */
  console.log('\n--- 9. Register BMN tersambung ---');
  await page.evaluate(() => { location.hash = '#/bmn'; });
  await page.waitForTimeout(1000);

  const tabel = await page.textContent('#bmnTabel');
  ok(/HPLC Shimadzu LC-2050/.test(tabel), 'Barang yang didaftarkan tadi muncul di register');
  ok(/00007/.test(tabel), 'Kode BMN dengan NUP terbitan server tampil di daftar');

  // Inti bagian ini: ringkasan datang dari server, dihitung atas SELURUH aset
  // dalam cakupan — bukan dari satu baris yang kebetulan tampil.
  const kpiBmn = await page.textContent('#bmnKpi');
  ok(/100/.test(kpiBmn),
    'Jumlah BMN diambil dari ringkasan server (100), bukan dihitung dari 1 baris yang tampil',
    kpiBmn.replace(/\s+/g, ' ').slice(0, 120));
  ok(/Rusak Berat/.test(kpiBmn) && /\b4\b/.test(kpiBmn),
    'Hitungan rusak berat juga dari server');

  await page.click('#bmnTabel .lnk');
  await page.waitForTimeout(700);
  const detail = await page.textContent('.drawer, body');
  ok(/IDENTITAS BMN/.test(detail), 'Detail BMN terbuka');
  ok(/SHZ-LC-88421/.test(detail), 'Nomor seri tersimpan dan tampil');
  ok(/00007/.test(detail), 'Detail memakai NUP terbitan server');
  ok(/[Cc]hecklist/.test(detail), 'Bagian checklist tetap ada pada detail BMN');

  ok(errs.length === 0, 'Tanpa galat halaman pada Register BMN', errs.join(' | '));

  /* ============ 10. BOOKING RUANGAN ============ */
  console.log('\n--- 10. Booking ruangan tersambung ---');
  await page.evaluate(() => { UI.closeDrawer(); location.hash = '#/booking/new'; });
  await page.waitForTimeout(800);

  await page.evaluate(() => { wzSet('people', 10); wzGo(1); });
  await page.waitForTimeout(1000);

  const langkah2 = await page.textContent('#wzHost');
  ok(/Conference Room Garuda/.test(langkah2),
    'Pilihan ruangan datang dari ketersediaan server, bukan dari data purwarupa');

  // Id ruangan dibaca dari DOM, bukan dari keadaan internal wizard: keadaan
  // itu memang tidak diekspos ke window, dan membacanya lewat celah khusus
  // uji berarti menguji sesuatu yang tidak dilalui pengguna.
  const idRuang = await page.$eval('#wzHost .res-card[onclick*="wzPick"]',
    (el) => (el.getAttribute('onclick').match(/wzPick\('([^']+)'\)/) || [])[1]);
  ok(!!idRuang, 'Kartu ruangan yang tersedia dapat dipilih', 'ruangan=' + idRuang);

  await page.evaluate((id) => { wzPick(id); wzSetAgenda('Rapat Koordinasi Fasilitas'); }, idRuang);
  await page.waitForTimeout(300);
  await page.evaluate(() => wzGo(4));
  await page.waitForTimeout(400);
  await page.click('#wzKirim');
  await page.waitForTimeout(900);

  const modalBook = await page.textContent('.overlay .modal');
  ok(/berhasil diajukan/i.test(modalBook), 'Pengajuan pertama berhasil');
  ok(/Slot sudah tertahan/.test(modalBook),
    'Pengguna diberi tahu slotnya sudah tertahan walau belum disetujui');

  /* --- pengajuan kedua pada slot yang sama harus DITOLAK SERVER --- */
  await page.evaluate(() => UI.closeModal());
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '#/booking/new'; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { wzSet('people', 10); wzGo(1); });
  await page.waitForTimeout(1000);

  // Server kini menandainya tidak tersedia.
  const langkah2b = await page.textContent('#wzHost');
  ok(/Bentrok dengan pemesanan lain/.test(langkah2b),
    'Ruangan yang baru dipesan ditandai bentrok oleh server');

  // Dipaksa memilih ruangan yang sudah penuh — inilah jalur yang membuktikan
  // penjaganya server, bukan tampilan.
  await page.evaluate((id) => { wzPick(id); wzSetAgenda('Pengajuan Tabrakan'); wzGo(4); }, idRuang);
  await page.waitForTimeout(400);
  await page.click('#wzKirim');
  await page.waitForTimeout(900);

  const modalTolak = await page.textContent('.overlay .modal');
  ok(/tidak dapat dipesan/i.test(modalTolak), 'Pengajuan kedua ditolak');
  ok(/Rapat Koordinasi Fasilitas/.test(modalTolak),
    'Pesan penolakan menyebut pemesanan yang menabraknya — bukan galat teknis',
    modalTolak.replace(/\s+/g, ' ').slice(0, 140));

  await page.evaluate(() => UI.closeModal());
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '#/booking'; });
  await page.waitForTimeout(900);

  const daftarBook = await page.textContent('#bookTabel');
  ok(/Rapat Koordinasi Fasilitas/.test(daftarBook), 'Pemesanan muncul di daftar');
  ok(!/Pengajuan Tabrakan/.test(daftarBook),
    'Pengajuan yang ditolak TIDAK tersimpan');

  const kpiBook = await page.textContent('#bookKpi');
  ok(/Menunggu Persetujuan/.test(kpiBook), 'Ringkasan pemesanan tampil');

  ok(errs.length === 0, 'Tanpa galat halaman pada booking', errs.join(' | '));

  /* ============ 11. PEMINJAMAN ALAT ============ */
  console.log('\n--- 11. Peminjaman alat tersambung ---');
  await page.evaluate(() => { location.hash = '#/eqbooking'; });
  await page.waitForTimeout(900);

  ok(/Belum ada peminjaman/.test(await page.textContent('#pjmTabel')),
    'Basis data kosong ditampilkan apa adanya');

  await page.click('#pjmTabel button');
  await page.waitForTimeout(1000);
  ok(!!(await page.$('#pKeperluan')), 'Formulir peminjaman terbuka');

  const daftarAlat = await page.textContent('#pjmDaftarAlat');
  ok(/HPLC Shimadzu LC-2050/.test(daftarAlat),
    'Daftar alat datang dari ketersediaan server');
  ok(/1 alat tersedia/.test(daftarAlat), 'Jumlah alat tersedia dihitung dari jawaban server');

  // Simpan tanpa memilih alat — harus ditolak sebelum menyentuh jaringan.
  await page.fill('#pKeperluan', 'Uji kadar air sampel tanah');
  await page.click('#pjmSimpan');
  await page.waitForTimeout(400);
  ok(/Pilih salah satu alat/.test(await page.textContent('#pjmFormGalat')),
    'Menyimpan tanpa memilih alat ditolak dengan pesan yang jelas');

  await page.click('#pjmDaftarAlat .row-t');
  await page.waitForTimeout(300);
  await page.click('#pjmSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#pKeperluan')), 'Formulir tertutup setelah berhasil');
  const tabelPjm = await page.textContent('#pjmTabel');
  ok(/Uji kadar air sampel tanah/.test(tabelPjm), 'Peminjaman muncul di daftar');
  ok(/Menunggu persetujuan/.test(tabelPjm), 'Statusnya terbaca, bukan kode mentah');

  /* --- pengajuan kedua pada alat & waktu yang sama ditolak server --- */
  await page.evaluate(() => pjmForm());
  await page.waitForTimeout(1000);

  const daftarAlat2 = await page.textContent('#pjmDaftarAlat');
  ok(/Sedang dipinjam pada rentang waktu ini/.test(daftarAlat2),
    'Alat yang baru dipinjam ditandai tidak tersedia oleh server');
  ok(/0 alat tersedia/.test(daftarAlat2), 'Hitungan alat tersedia ikut turun');

  await page.evaluate(() => UI.closeDrawer());
  await page.waitForTimeout(300);

  /* ============ 12. KOTAK PERSETUJUAN ============ */
  console.log('\n--- 12. Kotak persetujuan tersambung ---');
  await page.evaluate(() => { location.hash = '#/approval'; });
  await page.waitForTimeout(900);

  const appr = await page.textContent('#apprDaftar');
  ok(/Tidak ada pengajuan yang menunggu/.test(appr),
    'Antrean kosong: seluruh pengajuan pada uji ini dibuat pengguna yang sama');
  ok(/tidak ada yang boleh menyetujui pengajuannya sendiri/i.test(appr),
    'Alasannya dijelaskan, bukan dibiarkan tampak seperti daftar rusak');

  const spandukAppr = await page.textContent('#viewBody');
  ok(/ditegakkan batasan basis data/i.test(spandukAppr),
    'Dinyatakan bahwa larangannya ditegakkan basis data, bukan hanya disaring daftar');

  await page.click('#apprTabs button[data-jenis="peminjaman"]');
  await page.waitForTimeout(800);
  ok(/Tidak ada pengajuan yang menunggu/.test(await page.textContent('#apprDaftar')),
    'Berpindah ke antrean peminjaman bekerja');

  ok(errs.length === 0, 'Tanpa galat halaman pada peminjaman & persetujuan', errs.join(' | '));

  /* ============ 13. CHECKLIST TERSAMBUNG ============ */
  console.log('\n--- 13. Checklist tersambung ---');
  await page.evaluate(() => { location.hash = '#/checklist'; });
  await page.waitForTimeout(800);

  ok(/Belum ada template checklist/.test(await page.textContent('#ckTplDaftar')),
    'Basis data checklist kosong ditampilkan apa adanya, bukan diisi data purwarupa');
  ok(!!(await page.$('#ckTplDaftar button.btn-primary')),
    'Tombol "Buat Template Pertama" tersedia untuk pengguna yang masuk');

  await page.click('#ckTplDaftar button.btn-primary');
  await page.waitForTimeout(500);
  ok(!!(await page.$('#tNama')), 'Formulir buat template terbuka');

  await page.fill('#tNama', 'Pengecekan Harian Ruang Rapat (Uji)');
  await page.selectOption('#tJenis', 'kelayakan');
  await page.fill('#tDeskripsi', 'Dijalankan setiap pagi sebelum ruangan dipakai.');

  // butir pertama: ya/tidak, wajib — baris bawaan formulir
  await page.fill('#ckButirList > div.card:nth-child(1) input[placeholder="Teks butir pemeriksaan *"]',
    'Kursi dan meja dalam kondisi baik');

  // tambah butir kedua, lalu ubah tipenya jadi Angka — kolom satuannya
  // harus SEGERA tersingkap, bukan menunggu simpan. Ini regresi atas bug
  // yang baru diperbaiki: ckSetButir() sebelumnya mengubah keadaan tapi
  // tidak menggambar ulang daftar butir saat tipenya berganti.
  await page.click('button:has-text("Tambah Butir")');
  await page.waitForTimeout(250);
  const baris2 = '#ckButirList > div.card:nth-child(2)';
  await page.fill(`${baris2} input[placeholder="Teks butir pemeriksaan *"]`, 'Suhu ruangan (°C)');
  await page.selectOption(`${baris2} select`, 'angka');
  await page.waitForTimeout(200);
  ok(await page.isEnabled(`${baris2} input[placeholder="Satuan (opsional)"]`),
    'Kolom satuan tersingkap segera setelah tipe butir diubah ke Angka');
  await page.fill(`${baris2} input[placeholder="Satuan (opsional)"]`, '°C');
  await page.uncheck(`${baris2} input[type=checkbox]`);   // butir kedua tidak wajib

  await page.click('#ckTplSimpan');
  await page.waitForTimeout(700);
  ok(!(await page.$('#tNama')), 'Formulir tertutup setelah template tersimpan');

  const daftarTpl = await page.textContent('#ckTplDaftar');
  ok(/Pengecekan Harian Ruang Rapat \(Uji\)/.test(daftarTpl), 'Template baru muncul di daftar');
  ok(/2 butir/.test(daftarTpl), 'Jumlah butir tampil benar pada kartu: 2 butir');

  // Bukti bahwa yang tampil datang dari server, bukan dari keadaan peramban,
  // dan bahwa kolom satuan yang tadinya terkunci benar-benar ikut tersimpan.
  const tplDariServer = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/checklist/templat', { credentials: 'include' });
    const j = await r.json();
    return j.data.find((t) => t.nama === 'Pengecekan Harian Ruang Rapat (Uji)');
  }, port);
  ok(!!tplDariServer && tplDariServer.butir.length === 2, 'Server menyimpan template dengan 2 butir sungguhan');
  ok(!!tplDariServer && tplDariServer.butir[1].satuan === '°C',
    'Satuan butir kedua ikut tersimpan (bukan kosong akibat kolom yang sempat terkunci)');
  ok(!!tplDariServer && tplDariServer.butir[0].wajib === true && tplDariServer.butir[1].wajib === false,
    'Status wajib tiap butir tersimpan sesuai isian: butir 1 wajib, butir 2 tidak');

  /* ---- tugaskan ke ruangan yang sudah dibuat pada bagian 3 ---- */
  await page.click('#ckTplDaftar .card:has-text("Pengecekan Harian Ruang Rapat (Uji)")');
  await page.waitForTimeout(500);
  ok(/2 butir/.test(await page.$eval('.drawer', (e) => e.innerText)), 'Detail template menunjukkan 2 butir');

  await page.click('button:has-text("Tugaskan")');
  await page.waitForTimeout(500);
  await page.selectOption('#gSumberDaya', '1');     // Conference Room Garuda, dibuat pada bagian 3
  await page.selectOption('#gUser', '91');          // Dr. Sri Wahyuni
  await page.click('#ckTgsSimpan');
  await page.waitForTimeout(700);
  ok(!(await page.$('#gUser')), 'Formulir penugasan tertutup setelah tersimpan');

  /* ---- checklist saya ---- */
  await page.evaluate(() => { location.hash = '#/mychecklist'; });
  await page.waitForTimeout(800);
  const tugasSaya = await page.textContent('#ckmTugas');
  ok(/Pengecekan Harian Ruang Rapat \(Uji\)/.test(tugasSaya), 'Tugas yang baru ditugaskan muncul di Checklist Saya');
  ok(/Conference Room Garuda/.test(tugasSaya), 'Sumber daya yang melekat tampil pada kartu tugas');

  /* ---- jalankan; coba selesaikan kosong -> ditolak SERVER ---- */
  await page.click('#ckmTugas .card button:has-text("Kerjakan")');
  await page.waitForTimeout(600);
  const items0 = await page.$$('.ck-run-item');
  ok(items0.length === 2, `Formulir pelaksanaan menampilkan ${items0.length} butir sesuai templat`);

  await page.click('#ckRunSelesai');
  await page.waitForTimeout(500);
  const tolakModal = await page.$eval('.modal', (e) => e.innerText).catch(() => '');
  ok(/Kursi dan meja dalam kondisi baik/.test(tolakModal) && /wajib diisi/.test(tolakModal),
    'Butir wajib yang belum dijawab ditolak SERVER, pesannya menyebut butirnya', tolakModal.trim());
  await page.evaluate(() => UI.closeModal());

  /* ---- isi jawaban; jawaban terkirim segera, bukan ditahan ---- */
  await page.click('.ck-run-item >> nth=0 >> .ck-opt button >> nth=0');   // "✓ Ya" pada butir wajib
  await page.waitForTimeout(500);
  await page.fill('.ck-run-item >> nth=1 >> input[type=number]', '22');
  await page.press('.ck-run-item >> nth=1 >> input[type=number]', 'Tab');   // blur -> kirim
  await page.waitForTimeout(500);

  const jawabanTersimpanSebelumSelesai = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/checklist/pelaksanaan', { credentials: 'include' });
    return (await r.json()).data[0].jawaban.length;
  }, port);
  ok(jawabanTersimpanSebelumSelesai === 2,
    'Kedua jawaban sudah tersimpan di server SEBELUM tombol Selesaikan ditekan');

  await page.click('#ckRunSelesai');
  await page.waitForTimeout(700);
  const hasilModal = await page.$eval('.modal', (e) => e.innerText);
  ok(/100%/.test(hasilModal),
    'Ringkasan hasil menampilkan skor 100% — satu-satunya butir ya/tidak dijawab "Ya"', hasilModal.trim());
  await page.evaluate(() => UI.closeModal());

  const runDariServer = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/checklist/pelaksanaan', { credentials: 'include' });
    return (await r.json()).data[0];
  }, port);
  ok(!!runDariServer && runDariServer.status.kode === 'selesai', 'Status pelaksanaan di server: selesai');

  /* ---- riwayat tampil pada Checklist Saya ---- */
  await page.evaluate(() => { location.hash = '#/mychecklist'; });
  await page.waitForTimeout(800);
  const riwayatTxt = await page.textContent('#ckmRiwayat');
  ok(/Pengecekan Harian Ruang Rapat \(Uji\)/.test(riwayatTxt) && /100/.test(riwayatTxt),
    'Riwayat pelaksanaan tampil pada Checklist Saya lengkap dengan skornya');

  /* ---- checklist tampil pada detail ruangan yang diperiksa ---- */
  await page.evaluate(() => { location.hash = '#/rooms'; });
  await page.waitForTimeout(700);
  await page.evaluate(() => showRoom(1));
  await page.waitForTimeout(900);
  const drawerRuang = await page.$eval('.drawer', (e) => e.innerText);
  ok(/CHECKLIST/.test(drawerRuang), 'Bagian checklist tampil pada detail ruangan');
  ok(/Pengecekan Harian Ruang Rapat \(Uji\)/.test(drawerRuang) && /100/.test(drawerRuang),
    'Riwayat pelaksanaan yang baru selesai tampil pada detail ruangan yang diperiksa');
  await page.evaluate(() => UI.closeDrawer());

  ok(errs.length === 0, 'Tanpa galat halaman pada checklist tersambung', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
