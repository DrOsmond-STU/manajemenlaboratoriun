/* ==========================================================================
   FLMS — Notifikasi email untuk seluruh jadwal peralatan dan fasilitas
   Setiap jadwal diteruskan ke email penanggung jawab masing-masing.
   ========================================================================== */
(function () {
  const U = UI, D = DB, V = window.VIEWS;

  const mail = (id) => (D.people.find((p) => p.id === id) || {}).email || "—";
  const evName = (k) => (D.emailEvents.find((e) => e.k === k) || { n: k }).n;

  /* =======================================================================
     KUMPULKAN SELURUH JADWAL YANG MEMICU EMAIL
     ======================================================================= */
  function schedule() {
    const out = [];
    const add = (o) => out.push(o);

    D.bookings.filter((b) => b.date >= D.shift(0) && b.status !== "Cancelled").forEach((b) => add({
      src: "Booking", ev: "booking_ingat", when: b.date, time: b.start,
      title: b.agenda, res: b.resName, pic: b.pic,
      extra: [D.personName(b.requester)], send: "H-1 07:00 & 1 jam sebelum"
    }));
    D.eqBookings.filter((e) => e.date >= D.shift(0)).forEach((e) => add({
      src: "Reservasi Alat", ev: "alat_reservasi", when: e.date, time: e.start,
      title: "Reservasi " + e.eqName, res: e.eqName, pic: e.operator !== "-" ? e.operator : "EMP-0003",
      extra: [D.personName(e.requester)], send: "Saat diajukan & H-1 07:00"
    }));
    D.maintenance.filter((m) => m.sched >= D.shift(-1)).forEach((m) => add({
      src: "Maintenance", ev: "maintenance", when: m.sched, time: "08:00",
      title: m.kind + " — " + m.targetName, res: m.targetName, pic: m.tech,
      extra: [m.vendor], send: "H-3 07:00 & hari-H 06:00"
    }));
    D.calibration.forEach((c) => add({
      src: "Kalibrasi", ev: "kalibrasi", when: c.due, time: "07:00",
      title: "Jatuh tempo kalibrasi — " + c.eqName, res: c.eqName,
      pic: (D.equipment.find((e) => e.id === c.eq) || {}).pic || "EMP-0003",
      extra: [c.lab], send: "H-90, H-30, H-7, hari-H"
    }));
    D.loans.filter((l) => l.back === "-").forEach((l) => add({
      src: "Peminjaman", ev: "alat_pinjam", when: l.due, time: "07:00",
      title: "Jatuh tempo pengembalian — " + l.itemName, res: l.itemName, pic: l.handover,
      extra: [D.personName(l.borrower)], send: "H-1, hari-H, lalu harian"
    }));
    D.checklistTasks.forEach((t) => {
      const tpl = D.checklistTemplates.find((x) => x.id === t.tpl) || { name: t.tpl };
      add({
        src: "Checklist", ev: "checklist", when: t.due, time: t.time,
        title: tpl.name, res: D.resName(t.res), pic: t.assignee,
        extra: [D.personName(tpl.owner)], send: "Hari-H 06:00 & H+1 bila belum"
      });
    });
    D.events.filter((e) => e.date >= D.shift(0)).forEach((e) => add({
      src: "Event", ev: "event", when: e.date, time: "08:00",
      title: e.name, res: D.resName(e.venue), pic: e.pic,
      extra: [e.organizer], send: "H-7, H-1, hari-H 06:00"
    }));
    D.agendas.filter((a) => a.date >= D.shift(0)).forEach((a) => add({
      src: "Agenda", ev: "booking_ingat", when: a.date, time: a.time.split(" ")[0],
      title: a.title, res: D.resName(a.res), pic: a.owner,
      extra: [a.type], send: "H-1 07:00"
    }));

    return out.sort((a, b) => (a.when + a.time).localeCompare(b.when + b.time));
  }

  /* =======================================================================
     HALAMAN NOTIFIKASI EMAIL JADWAL
     ======================================================================= */
  V["emailsched"] = {
    title: "Notifikasi Email Jadwal",
    sub: "Seluruh jadwal peralatan dan fasilitas diteruskan otomatis ke email penanggung jawab masing-masing.",
    actions: `<button class="btn btn-sm" onclick="mailTemplate()">${U.icon("doc")} Template Email</button>
      <button class="btn btn-sm" onclick="mailSmtp()">${U.icon("gear")} Pengaturan SMTP</button>
      <button class="btn btn-sm" onclick="mailDigest()">${U.icon("eye")} Pratinjau Ringkasan Harian</button>
      <button class="btn btn-primary btn-sm" onclick="mailRunNow()">${U.icon("send")} Kirim Sekarang</button>`,
    render() {
      const sch = schedule();
      const upcoming = sch.filter((s) => s.when >= D.shift(0));
      const pics = [...new Set(sch.map((s) => s.pic))];
      const terkirim = D.emailOutbox.filter((e) => e.status === "Terkirim").length;

      return `
        <div class="alert ok mb-16">${U.icon("send", 17)}<div><b>Perutean email aktif untuk ${sch.length} jadwal</b>
          Setiap booking ruangan, reservasi alat, work order maintenance, jatuh tempo kalibrasi, pengembalian
          pinjaman, tugas checklist, event, dan agenda otomatis dikirim ke email penanggung jawabnya —
          ditambah satu ringkasan harian per penanggung jawab setiap pukul 06.30.</div></div>

        <div class="grid g5 mb-16">
          ${U.kpi({ label: "Jadwal Terpantau", value: sch.length, icon: "calendar", tint: "brand", note: "Seluruh sumber jadwal" })}
          ${U.kpi({ label: "Penanggung Jawab", value: pics.length, icon: "users", tint: "teal", note: "Menerima email" })}
          ${U.kpi({ label: "Email Hari Ini", value: D.emailOutbox.length, icon: "send", tint: "violet", note: terkirim + " terkirim" })}
          ${U.kpi({ label: "Delivery Rate", value: "98,4", suffix: "%", icon: "check", tint: "green", note: "1 gagal kirim" })}
          ${U.kpi({ label: "Aturan Aktif", value: D.emailEvents.filter((e) => e.on).length, icon: "gear", tint: "amber", note: "dari " + D.emailEvents.length + " peristiwa" })}
        </div>

        <div class="tabs mb-16">
          <button class="active">Jadwal → Email</button>
          <button onclick="UI.demo('Tab riwayat pengiriman')">Riwayat</button>
          <button onclick="UI.demo('Tab template')">Template</button>
        </div>

        ${U.card("Jadwal Mendatang dan Tujuan Emailnya", U.toolbar({
          ph: "Cari jadwal, resource, atau penanggung jawab…",
          filters: [["Semua Sumber", "Booking", "Reservasi Alat", "Maintenance", "Kalibrasi", "Peminjaman", "Checklist", "Event", "Agenda"],
                    ["Semua PIC"].concat(pics.map((p) => D.personName(p)))],
          right: `<span class="badge brand">${upcoming.length} jadwal mendatang</span>`
        }) + U.table([
          { t: "Sumber Jadwal", w: "118px", render: (s) => `<span class="badge outline">${U.esc(s.src)}</span>` },
          { t: "Jadwal", w: "270px", render: (s) => `<b class="small trunc" style="max-width:258px" title="${U.esc(s.title)}">${U.esc(s.title)}</b>
              <div class="tiny faint trunc" style="max-width:258px">${U.esc(s.res)}</div>` },
          { t: "Waktu", w: "108px", cls: "nowrap", render: (s) => `${U.fdate(s.when, "short")}<div class="tiny faint">${U.esc(s.time)}</div>` },
          { t: "Penanggung Jawab", render: (s) => `<div class="row"><span class="avatar sm">${U.initials(D.personName(s.pic))}</span>
              <div style="min-width:0"><div class="small trunc">${U.esc(D.personName(s.pic))}</div>
              <div class="tiny faint trunc">${U.esc(mail(s.pic))}</div></div></div>` },
          { t: "Tembusan", render: (s) => `<span class="tiny muted trunc" style="max-width:150px">${U.esc(s.extra.join(", "))}</span>` },
          { t: "Jadwal Kirim Email", w: "190px", render: (s) => `<span class="small">${U.esc(s.send)}</span>` },
          { t: "Status", cls: "center", render: (s) => s.when < D.shift(0)
              ? U.badge("Terkirim") : s.when === D.shift(0) ? `<span class="badge amber">Hari ini</span>` : `<span class="badge brand">Terjadwal</span>` },
          { t: "", cls: "actions", render: (s) => `<button class="btn btn-sm" onclick="mailPreview('${U.esc(s.ev)}','${U.esc(s.title)}','${U.esc(s.res)}','${s.pic}','${s.when}','${U.esc(s.time)}')">
              ${U.icon("eye", 12)} Pratinjau</button>` }
        ], sch) + U.pager(sch.length, 1, sch.length), { bodyCls: "flush" })}

        <div class="grid g-2-1 gap-16 mt-16">
          ${U.card("Aturan Peristiwa → Email", U.table([
            { t: "Peristiwa", render: (e) => `<b class="small">${U.esc(e.n)}</b>
                <div class="tiny faint">${U.esc(e.src)}</div>` },
            { t: "Penerima", render: (e) => e.to.map((t) => `<span class="fac">${U.esc(t)}</span>`).join(" ") },
            { t: "Waktu Kirim", render: (e) => `<span class="small muted">${U.esc(e.sched.join(" · "))}</span>` },
            { t: "Aktif", cls: "center", render: (e) => `<label class="switch"><input type="checkbox" ${e.on ? "checked" : ""}
                onchange="mailToggle('${e.k}',this.checked)"><span></span></label>` },
            { t: "", cls: "actions", render: (e) => `<button class="icon-btn" onclick="mailRule('${e.k}')">${U.icon("edit", 15)}</button>` }
          ], D.emailEvents), { bodyCls: "flush", sub: "Menentukan siapa menerima apa dan kapan" })}

          <div class="col gap-16">
            ${U.card("Antrean & Riwayat Kirim", `<div class="col gap-8" style="max-height:340px;overflow-y:auto">
              ${D.emailOutbox.map((e) => `
                <div class="row-t" style="padding:9px;border:1px solid var(--border);border-radius:9px;cursor:pointer"
                     onclick="mailOpen('${e.id}')">
                  <span class="kpi-ico tint-${e.status === "Terkirim" ? "green" : e.status === "Gagal" ? "red" : "amber"}"
                    style="width:28px;height:28px;flex:0 0 28px">${U.icon("send", 13)}</span>
                  <div style="flex:1;min-width:0">
                    <div class="small bold trunc">${U.esc(e.subj)}</div>
                    <div class="tiny faint trunc">${U.esc(e.name)} · ${U.esc(e.to)}</div>
                    <div class="tiny faint">${U.esc(e.time)} · ${U.esc(evName(e.ev))}</div></div>
                  <div class="col gap-4" style="align-items:flex-end">
                    ${U.badge(e.status)}
                    ${e.open ? `<span class="tiny faint">dibuka</span>` : ""}</div>
                </div>`).join("")}
            </div>`, { tools: `<button class="btn btn-sm" onclick="UI.demo('Kirim ulang email gagal')">${U.icon("refresh", 12)} Kirim Ulang</button>` })}

            ${U.card("Server Email", `<div class="dl small" style="grid-template-columns:96px 1fr">
              <dt>Status</dt><dd>${U.badge(D.smtp.status)}</dd>
              <dt>Host</dt><dd class="mono">${U.esc(D.smtp.host)}:${D.smtp.port}</dd>
              <dt>Keamanan</dt><dd>${U.esc(D.smtp.secure)}</dd>
              <dt>Pengirim</dt><dd class="trunc">${U.esc(D.smtp.from)}</dd>
              <dt>Balasan ke</dt><dd class="trunc">${U.esc(D.smtp.replyTo)}</dd>
              <dt>Batas kirim</dt><dd>${D.smtp.rate} email / menit</dd>
            </div>
            <button class="btn btn-sm btn-block mt-12" onclick="mailSmtp()">${U.icon("gear", 12)} Ubah Pengaturan</button>`)}
          </div>
        </div>

        <div class="mt-16">${U.card("Preferensi Email Penanggung Jawab", U.table([
          { t: "Penanggung Jawab", render: (p) => `<div class="row"><span class="avatar sm">${U.initials(p.name)}</span>
              <div><b class="small">${U.esc(p.name)}</b><div class="tiny faint">${U.esc(p.role)}</div></div></div>` },
          { t: "Email", render: (p) => `<span class="small mono">${U.esc(p.email)}</span>` },
          { t: "Jadwal Diampu", cls: "center", render: (p) => `<span class="badge brand">${p.jadwal}</span>` },
          { t: "Notifikasi Instan", cls: "center", render: (p) => `<label class="switch"><input type="checkbox" ${p.instan ? "checked" : ""}><span></span></label>` },
          { t: "Ringkasan Harian", cls: "center", render: (p) => `<label class="switch"><input type="checkbox" ${p.digest ? "checked" : ""}><span></span></label>` },
          { t: "Jam Ringkasan", render: (p) => `<input class="input" style="width:92px;padding:3px 8px;font-size:12px" value="${p.jam}">` },
          { t: "Kanal", render: (p) => p.kanal.map((k) => `<span class="fac">${U.esc(k)}</span>`).join(" ") },
          { t: "", cls: "actions", render: (p) => `<button class="btn btn-sm" onclick="mailDigest('${p.id}')">Pratinjau</button>` }
        ], D.emailPrefs), { bodyCls: "flush" })}</div>`;
    }
  };

  window.mailToggle = function (k, on) {
    const e = D.emailEvents.find((x) => x.k === k);
    if (e) e.on = on;
    U.toast(on ? "Aturan diaktifkan" : "Aturan dinonaktifkan", evName(k), on ? "ok" : "warn");
  };

  window.mailRule = function (k) {
    const e = D.emailEvents.find((x) => x.k === k);
    U.modal({
      size: "wide", title: "Aturan Notifikasi Email", sub: e.n,
      body: `<div class="grid g2 gap-14">
          <div class="field" style="grid-column:1/-1"><label>Peristiwa pemicu</label>
            <input class="input" value="${U.esc(e.n)}" readonly></div>
          <div class="field" style="grid-column:1/-1"><label>Penerima</label>
            <div class="row wrap gap-6">${["PIC Resource", "Pemohon", "Peserta", "Kepala Lab", "Operator", "Teknisi",
              "Vendor", "Atasan Peminjam", "Asset Manager", "Facility Manager", "Finance", "Klien", "Security", "Seluruh PIC"]
              .map((r) => `<span class="chip ${e.to.includes(r) ? "on" : ""}" onclick="this.classList.toggle('on')">${r}</span>`).join("")}</div></div>
          <div class="field" style="grid-column:1/-1"><label>Waktu pengiriman</label>
            <div class="row wrap gap-6">${["Saat terjadi", "H-90", "H-30", "H-7", "H-3", "H-1 07:00", "Hari-H 06:00",
              "Hari-H 07:00", "T-1 jam", "H+1 harian", "Setiap hari 06:30"]
              .map((s) => `<span class="chip ${e.sched.includes(s) ? "on" : ""}" onclick="this.classList.toggle('on')">${s}</span>`).join("")}</div>
            <div class="hint">H = hari pelaksanaan jadwal, T = jam mulai kegiatan.</div></div>
          <div class="field"><label>Kanal</label>
            <div class="row wrap gap-6">
              <span class="chip on">Email</span><span class="chip on">In-app</span>
              <span class="chip">WhatsApp</span><span class="chip">Push</span></div></div>
          <div class="field"><label>Prioritas</label>
            <select class="select"><option>Normal</option><option>Tinggi</option><option>Mendesak</option></select></div>
          <div class="field" style="grid-column:1/-1"><label>Template email</label>
            <select class="select"><option>Template Baku Jadwal Fasilitas</option>
              <option>Template Ringkas</option><option>Template Formal Berkop</option></select></div>
        </div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn" onclick="mailPreview('${e.k}','Contoh Jadwal','Contoh Resource','EMP-0003','${D.shift(1)}','09:00')">${U.icon("eye")} Pratinjau</button>
             <button class="btn btn-primary" onclick="UI.closeModal();UI.toast('Aturan disimpan','${U.esc(e.n)}')">Simpan</button>`
    });
  };

  /* ---------------------------------------------------- pratinjau email --- */
  function emailShell(subject, body) {
    return `<div style="background:var(--surface-2);padding:18px;border-radius:12px">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;
                  border:1px solid var(--border);color:#101a2e">
        <div style="background:linear-gradient(135deg,#1b4bd6,#0fa3a3);padding:16px 20px;color:#fff">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.2);
                        display:grid;place-items:center;font-weight:800;font-size:12px">FL</div>
            <div><div style="font-weight:700;font-size:14px">FLMS</div>
              <div style="font-size:10.5px;opacity:.85">Facility, Laboratory &amp; Meeting Management System</div></div>
          </div>
        </div>
        <div style="padding:20px">${body}</div>
        <div style="padding:14px 20px;border-top:1px solid #e3e8f0;background:#f8fafc;
                    font-size:10.5px;color:#5b6b85">
          Email otomatis dari FLMS — mohon tidak membalas ke alamat ini.<br>
          Atur preferensi notifikasi Anda pada menu Profil › Notifikasi.
        </div>
      </div></div>`;
  }

  window.mailPreview = function (ev, title, res, pic, when, time) {
    const p = D.people.find((x) => x.id === pic) || D.people[0];
    const body = `
      <div style="font-size:13.5px;line-height:1.6">
        <p style="margin:0 0 12px">Yth. <b>${U.esc(p.name)}</b>,</p>
        <p style="margin:0 0 14px">Berikut pengingat jadwal ${U.esc(evName(ev).toLowerCase())} yang menjadi
          tanggung jawab Anda:</p>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:14px">
          <tr><td style="padding:7px 0;color:#5b6b85;width:130px">Kegiatan</td>
              <td style="padding:7px 0;font-weight:700">${U.esc(title)}</td></tr>
          <tr><td style="padding:7px 0;color:#5b6b85;border-top:1px solid #eef1f6">Resource</td>
              <td style="padding:7px 0;border-top:1px solid #eef1f6">${U.esc(res)}</td></tr>
          <tr><td style="padding:7px 0;color:#5b6b85;border-top:1px solid #eef1f6">Tanggal</td>
              <td style="padding:7px 0;border-top:1px solid #eef1f6">${U.fdate(when, "long")}</td></tr>
          <tr><td style="padding:7px 0;color:#5b6b85;border-top:1px solid #eef1f6">Waktu</td>
              <td style="padding:7px 0;border-top:1px solid #eef1f6">${U.esc(time)} WIB</td></tr>
          <tr><td style="padding:7px 0;color:#5b6b85;border-top:1px solid #eef1f6">Peran Anda</td>
              <td style="padding:7px 0;border-top:1px solid #eef1f6">Penanggung jawab</td></tr>
        </table>
        <a href="#" style="display:inline-block;background:#1b4bd6;color:#fff;text-decoration:none;
           padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600">Buka di FLMS</a>
        <p style="margin:16px 0 0;font-size:12px;color:#5b6b85">Bila jadwal ini tidak sesuai, mohon segera
          hubungi pengelola fasilitas agar dapat disesuaikan.</p>
      </div>`;
    U.modal({
      size: "wide", title: "Pratinjau Email", sub: "Kepada " + p.name + " <" + p.email + ">",
      body: `<div class="dl small mb-12" style="grid-template-columns:80px 1fr">
          <dt>Dari</dt><dd class="mono trunc">${U.esc(D.smtp.from)}</dd>
          <dt>Kepada</dt><dd class="mono">${U.esc(p.email)}</dd>
          <dt>Subjek</dt><dd><b>[FLMS] ${U.esc(title)} — ${U.fdate(when, "short")} ${U.esc(time)}</b></dd>
        </div>${emailShell("", body)}`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>
             <button class="btn btn-primary" onclick="UI.closeModal();UI.toast('Email uji terkirim','Dikirim ke ${U.esc(p.email)}')">
               ${U.icon("send")} Kirim Email Uji</button>`
    });
  };

  window.mailDigest = function (picId) {
    const p = D.people.find((x) => x.id === picId) || D.people.find((x) => x.id === "EMP-0003");
    const sch = schedule().filter((s) => s.pic === p.id && s.when >= D.shift(0)).slice(0, 6);
    const tasks = D.checklistTasks.filter((t) => t.assignee === p.id);
    const body = `
      <div style="font-size:13.5px;line-height:1.6">
        <p style="margin:0 0 6px">Selamat pagi, <b>${U.esc(p.name)}</b>.</p>
        <p style="margin:0 0 14px;color:#5b6b85;font-size:12.5px">Ringkasan jadwal dan tugas Anda pada
          ${U.fdate(D.shift(0), "long")}.</p>
        <div style="background:#eef4ff;border-radius:8px;padding:11px 13px;margin-bottom:14px;font-size:12.5px">
          <b>${sch.length} jadwal</b> menjadi tanggung jawab Anda · <b>${tasks.length} checklist</b> menunggu dikerjakan
        </div>
        ${sch.length ? `<div style="font-size:11px;font-weight:700;color:#5b6b85;letter-spacing:.05em;margin-bottom:6px">JADWAL</div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:16px">
          ${sch.map((s) => `<tr>
            <td style="padding:7px 0;border-top:1px solid #eef1f6;width:96px;color:#5b6b85">
              ${U.fdate(s.when, "short")}<br><span style="font-size:11px">${U.esc(s.time)}</span></td>
            <td style="padding:7px 0;border-top:1px solid #eef1f6">
              <b>${U.esc(s.title)}</b><br><span style="font-size:11.5px;color:#5b6b85">${U.esc(s.res)} · ${U.esc(s.src)}</span></td>
          </tr>`).join("")}
        </table>` : ""}
        ${tasks.length ? `<div style="font-size:11px;font-weight:700;color:#5b6b85;letter-spacing:.05em;margin-bottom:6px">CHECKLIST</div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:16px">
          ${tasks.map((t) => {
            const tpl = D.checklistTemplates.find((x) => x.id === t.tpl) || { name: t.tpl };
            return `<tr><td style="padding:7px 0;border-top:1px solid #eef1f6;width:96px;color:#5b6b85">
              ${U.fdate(t.due, "short")}<br><span style="font-size:11px">${U.esc(t.time)}</span></td>
              <td style="padding:7px 0;border-top:1px solid #eef1f6"><b>${U.esc(tpl.name)}</b><br>
                <span style="font-size:11.5px;color:#5b6b85">${U.esc(D.resName(t.res))} · ${U.esc(t.status)}</span></td></tr>`;
          }).join("")}
        </table>` : ""}
        <a href="#" style="display:inline-block;background:#1b4bd6;color:#fff;text-decoration:none;
           padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600">Buka Dashboard Saya</a>
      </div>`;
    U.modal({
      size: "wide", title: "Ringkasan Harian per Penanggung Jawab",
      sub: p.name + " <" + p.email + "> · dikirim setiap hari pukul 06.30",
      body: `<div class="row wrap gap-6 mb-12">${D.emailPrefs.map((x) =>
          `<span class="chip ${x.id === p.id ? "on" : ""}" onclick="UI.closeModal();mailDigest('${x.id}')">${U.esc(x.name)}</span>`).join("")}</div>
        ${emailShell("", body)}`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>
             <button class="btn btn-primary" onclick="UI.closeModal();UI.toast('Ringkasan dikirim','Email dikirim ke ${U.esc(p.email)}')">
               ${U.icon("send")} Kirim Sekarang</button>`
    });
  };

  window.mailOpen = function (id) {
    const e = D.emailOutbox.find((x) => x.id === id);
    U.modal({
      title: "Detail Pengiriman", sub: e.id,
      body: `<div class="dl small mb-16" style="grid-template-columns:110px 1fr">
          <dt>Subjek</dt><dd><b>${U.esc(e.subj)}</b></dd>
          <dt>Penerima</dt><dd>${U.esc(e.name)} &lt;${U.esc(e.to)}&gt;</dd>
          <dt>Peristiwa</dt><dd>${U.esc(evName(e.ev))}</dd>
          <dt>Waktu kirim</dt><dd>${U.esc(e.time)}</dd>
          <dt>Status</dt><dd>${U.badge(e.status)}</dd>
          <dt>Dibuka</dt><dd>${e.open ? `<span class="badge green">Ya</span>` : `<span class="badge slate">Belum</span>`}</dd>
        </div>
        ${e.status === "Gagal" ? `<div class="alert err small">${U.icon("alert", 15)}<div><b>Gagal terkirim</b>
          Mailbox penerima penuh (SMTP 552). Sistem akan mencoba ulang ${D.smtp.retry}× dengan jeda menaik.</div></div>` : ""}`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>
             ${e.status === "Gagal" ? `<button class="btn btn-primary" onclick="UI.closeModal();UI.toast('Dikirim ulang','${U.esc(e.to)}')">Kirim Ulang</button>` : ""}`
    });
  };

  window.mailSmtp = function () {
    const s = D.smtp;
    U.modal({
      size: "wide", title: "Pengaturan Server Email", sub: "SMTP untuk pengiriman notifikasi jadwal",
      body: `<div class="grid g2 gap-14">
          <div class="field"><label>Host SMTP</label><input class="input mono" value="${U.esc(s.host)}"></div>
          <div class="field"><label>Port</label><input type="number" class="input" value="${s.port}"></div>
          <div class="field"><label>Keamanan</label><select class="select">
            <option ${s.secure === "STARTTLS" ? "selected" : ""}>STARTTLS</option><option>SSL/TLS</option><option>Tanpa enkripsi</option></select></div>
          <div class="field"><label>Nama pengguna</label><input class="input mono" value="${U.esc(s.user)}"></div>
          <div class="field" style="grid-column:1/-1"><label>Alamat pengirim</label><input class="input" value="${U.esc(s.from)}"></div>
          <div class="field" style="grid-column:1/-1"><label>Balasan ke</label><input class="input" value="${U.esc(s.replyTo)}"></div>
          <div class="field"><label>Batas kirim (email/menit)</label><input type="number" class="input" value="${s.rate}"></div>
          <div class="field"><label>Percobaan ulang bila gagal</label><input type="number" class="input" value="${s.retry}"></div>
        </div>
        <div class="alert info small mt-16">${U.icon("shield", 15)}<div>Gunakan akun pengirim khusus dengan SPF,
          DKIM, dan DMARC terkonfigurasi agar email tidak masuk folder spam penerima.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn" onclick="UI.toast('Koneksi berhasil','Server SMTP merespons dalam 240 ms.')">${U.icon("link")} Uji Koneksi</button>
             <button class="btn btn-primary" onclick="UI.closeModal();UI.toast('Pengaturan disimpan','')">Simpan</button>`
    });
  };

  window.mailTemplate = function () {
    U.modal({
      size: "wide", title: "Template Email", sub: "Dipakai ulang oleh seluruh aturan notifikasi",
      body: `<div class="row wrap gap-6 mb-16">
          <span class="chip on">Template Baku Jadwal Fasilitas</span>
          <span class="chip">Template Ringkas</span>
          <span class="chip">Template Formal Berkop</span>
          <span class="chip">Ringkasan Harian</span></div>
        <div class="grid g2 gap-16" style="align-items:start">
          <div class="col gap-12">
            <div class="field"><label>Subjek</label>
              <input class="input mono" value="[FLMS] {JUDUL} — {TANGGAL} {JAM}"></div>
            <div class="field"><label>Isi</label>
              <textarea class="textarea" style="min-height:190px;font-family:var(--mono);font-size:12px">Yth. {NAMA_PIC},

Berikut pengingat jadwal {JENIS} yang menjadi tanggung jawab Anda:

Kegiatan  : {JUDUL}
Resource  : {RESOURCE}
Tanggal   : {TANGGAL}
Waktu     : {JAM} WIB

Buka di FLMS: {TAUTAN}</textarea></div>
            <div class="field"><label>Token yang tersedia</label>
              <div class="row wrap gap-4">${["{NAMA_PIC}", "{EMAIL_PIC}", "{JUDUL}", "{JENIS}", "{RESOURCE}",
                "{TANGGAL}", "{JAM}", "{PEMOHON}", "{UNIT}", "{TAUTAN}", "{KODE_BMN}", "{KODE_INTERNAL}"]
                .map((t) => `<span class="chip" style="font-size:10.5px;padding:2px 7px">${t}</span>`).join("")}</div></div>
          </div>
          <div class="field"><label>Pratinjau</label>
            ${emailShell("", `<div style="font-size:13.5px;line-height:1.6">
              <p style="margin:0 0 12px">Yth. <b>Bayu Prakoso</b>,</p>
              <p style="margin:0 0 14px">Berikut pengingat jadwal kalibrasi alat yang menjadi tanggung jawab Anda:</p>
              <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <tr><td style="padding:6px 0;color:#5b6b85;width:110px">Kegiatan</td><td style="padding:6px 0;font-weight:700">Jatuh tempo kalibrasi — AAS PinAAcle 900T</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b85">Resource</td><td style="padding:6px 0">Atomic Absorption Spectrometer</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b85">Tanggal</td><td style="padding:6px 0">${U.fdate(D.shift(4), "long")}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b85">Waktu</td><td style="padding:6px 0">07:00 WIB</td></tr>
              </table></div>`)}
          </div>
        </div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>
             <button class="btn btn-primary" onclick="UI.closeModal();UI.toast('Template disimpan','')">Simpan Template</button>`
    });
  };

  window.mailRunNow = function () {
    const sch = schedule().filter((s) => s.when === D.shift(0) || s.when === D.shift(1));
    const pics = [...new Set(sch.map((s) => s.pic))];
    U.modal({
      title: "Kirim Notifikasi Sekarang",
      sub: "Menjalankan perutean email di luar jadwal otomatis",
      body: `<div class="dl small mb-16" style="grid-template-columns:150px 1fr">
          <dt>Jadwal tercakup</dt><dd><b>${sch.length}</b> jadwal hari ini dan besok</dd>
          <dt>Penerima</dt><dd><b>${pics.length}</b> penanggung jawab</dd>
          <dt>Perkiraan email</dt><dd><b>${sch.length + pics.length}</b> pesan (termasuk ringkasan harian)</dd>
        </div>
        <div class="col gap-8">
          ${pics.slice(0, 6).map((p) => `<div class="row small">
            <span class="avatar sm">${U.initials(D.personName(p))}</span>
            <span style="flex:1">${U.esc(D.personName(p))}</span>
            <span class="tiny faint mono trunc" style="max-width:210px">${U.esc(mail(p))}</span>
            <span class="badge outline">${sch.filter((s) => s.pic === p).length} jadwal</span></div>`).join("")}
          ${pics.length > 6 ? `<div class="tiny faint">dan ${pics.length - 6} penanggung jawab lainnya…</div>` : ""}
        </div>
        <div class="alert warn small mt-16">${U.icon("alert", 15)}<div>Pengiriman manual dapat menyebabkan
          penerima menerima pengingat ganda bila jadwal otomatis pada hari yang sama sudah berjalan.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="UI.closeModal();UI.toast('Antrean dijalankan','${sch.length + pics.length} email dimasukkan ke antrean pengiriman.')">
               ${U.icon("send")} Kirim</button>`
    });
  };

})();
