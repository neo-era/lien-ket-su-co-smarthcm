// ==UserScript==
// @name         Liên kết sự cố - Duy tu SmartHCM
// @namespace    lavipco.cskvtt
// @version      1.0.1
// @description  Tự động ghép & liên kết sự cố cho công việc duy tu trên smarthcm.city (bản rule-based, không cần AI). Ghép theo số trụ + vị trí + loại việc, lọc dòng lệch, duyệt bảng rồi lưu.
// @author       CSKVTT - LAVIPCO
// @match        https://smarthcm.city/*
// @match        https://*.smarthcm.city/*
// @match        http://smarthcm.city/*
// @match        http://*.smarthcm.city/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * HƯỚNG DẪN NHANH
 * 1. Cài extension Tampermonkey (Chrome/Edge/Firefox).
 * 2. Tampermonkey > Create a new script > dán toàn bộ file này > Ctrl+S.
 * 3. Mở trang Quản lý Công việc Duy tu (TaskListNew), lọc quận + khoảng thời gian như thường.
 * 4. Góc phải dưới có panel "Liên kết sự cố". Bấm "1) Ghép thử" -> xem bảng -> bấm "2) Lưu dòng đã chọn".
 *
 * LƯU Ý: Bản này KHÔNG có AI. Dòng lệch kiểu mới (chưa có trong bộ lọc) có thể vẫn lọt vào nhóm A,
 * nên hãy liếc qua bảng trước khi lưu. Các ô tick đã bỏ sẵn ở dòng bị đánh dấu "lệch".
 */

(function () {
  'use strict';

  if (!/\/Maintenance\/TaskListNew/i.test(location.pathname)) return;

  const MAXDAYS = 45;

  // ---------- Thuật toán ghép (giống skill) ----------
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/cach mang thang (8|tam)/g, 'cmt8').replace(/cong vien/g, 'cv').replace(/doi dien/g, ' ')
    .replace(/\bts\s*(\d+)/g, (m, a) => 'tru so ' + a).replace(/\btru\s*(?:so)?\s*(\d+)/g, (m, a) => 'tru so ' + a)
    .replace(/[^a-z0-9\/ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const poles = s => [...norm(s).matchAll(/tru so (\d+)/g)].map(m => +m[1]);
  const STOP = new Set('tru so duong den bong bo va cua thay the de nghi cho bi hu hong mat khong sang tai truoc w moi cap cung khu'.split(' '));
  const toks = s => new Set(norm(s).replace(/tru so \d+/g, ' ').split(' ').filter(t => t && !STOP.has(t) && t.length > 1 && !/^\d+w?$/.test(t)));
  const KW = { son:['son','ri','gi','set'], vesinh:['ve sinh','do','ban','bui'], choa:['choa','cau','bong hue','bup sen','non'], bong:['tat','chop','bong'], chanluu:['tat','chop','ro','chan luu'], kich:['tat','chop','kich'], tu:['tat','chop','ro','tu dien'], hopnoi:['hop','noi','re nhanh','lien thong'], mcb:['mcb','cb','chay'], rcbo:['rcbo','ro'], cap:['cap','day','dut','ro'], tay:['tay den','gay','cong'], vo:['vo tu','tu dieu khien','be tu'] };
  const workKey = w => { w = norm(w); return w.includes('son') ? 'son' : w.includes('ve sinh') ? 'vesinh' : /choa/.test(w) ? 'choa' : /hop noi/.test(w) ? 'hopnoi' : /mcb/.test(w) ? 'mcb' : /rcbo/.test(w) ? 'rcbo' : /tu dien/.test(w) ? 'tu' : /kich/.test(w) && !/bong/.test(w) ? 'kich' : /chan luu/.test(w) && !/bong/.test(w) ? 'chanluu' : /bong/.test(w) ? 'bong' : /tay den|can den/.test(w) ? 'tay' : /vo tu/.test(w) ? 'vo' : /cap/.test(w) ? 'cap' : null; };
  const wm = (w, c) => { const k = workKey(w); if (!k) return 0; const n = ' ' + norm(c) + ' '; return KW[k].some(x => n.includes(' ' + x)) ? 1 : 0; };
  const dt = x => x instanceof Date ? x : (x ? new Date(x) : null);

  // ---------- Bộ lọc dòng lệch cố định (theo các kiểu đã gặp) ----------
  // Trả về chuỗi lý do nếu lệch, '' nếu không.
  function lechReason(o) {
    const w = o.work || '', d = o.desc || '', c = o.incContent || '';
    if (/nắp cửa trụ/i.test(w)) return 'Nắp cửa trụ ↔ sự cố điện/LED';
    if (/cáp lên đèn|cáp điện lên đèn/i.test(w) && /mắt led|led \d|đèn tắt led|sáng mờ/i.test(c)) return 'Lắp/tháo cáp ↔ hư mắt LED';
    if (/Chu văn An/i.test(d) && /cầu/i.test(c) && /hẻm/i.test(d)) return 'Hẻm ↔ cầu (khác vị trí)';
    if (/lắp đặt/i.test(w) && /RCBO/i.test(c)) return 'Lắp đặt đèn/cần đèn ↔ hư RCBO';
    if (/(tẩy rỉ|sơn trụ)/i.test(w) && /(bể|gãy|chóa|bông huệ)/i.test(c)) return 'Tẩy rỉ/sơn ↔ hư chóa/gãy tay đèn';
    if (/(kích|chấn lưu|tụ điện)/i.test(w) && /(bễ đế|bể đế|bông huệ)/i.test(c)) return 'Kích/chấn lưu/tụ ↔ bễ đế bông huệ';
    if (/tháo.*băng rôn/i.test(w) && /tắt/i.test(c)) return 'Tháo băng rôn ↔ đèn tắt';
    // Lệch "Lô": mô tả một Lô, sự cố một Lô khác (cư xá Thanh Đa)
    const loD = (d.match(/Lô\s+([A-Z]+)/i) || [])[1];
    const loC = (c.match(/Lô\s+([A-Z]+)/i) || [])[1];
    if (loD && loC && loD.toUpperCase() !== loC.toUpperCase()) return 'Khác Lô (' + loD + ' ↔ ' + loC + ')';
    return '';
  }

  function buildMatches() {
    const map = new Map();
    gridOptions.api.forEachNode(n => { if (n.data) map.set(n.data.Id, n.data); });
    const rows = [...map.values()];
    const un = rows.filter(r => !r.IncidentId && r.CabinetId);
    const cabs = [...new Set(un.map(r => r.CabinetId))];
    const get = id => new Promise(res => LBCS.Service.IncidentSvc.GetIncidentByCabinet(id, d => res(d || []), () => res([])));
    return (async () => {
      const inc = {};
      for (const c of cabs) inc[c] = await get(c);
      const out = un.map(r => {
        const work = (r.MaintScheduleDetail && r.MaintScheduleDetail.MaintWork && r.MaintScheduleDetail.MaintWork.Name) || '';
        const tp = poles(r.Description), tt = toks(r.Description), td = dt(r.CreatedAt);
        const cands = [];
        for (const i of (inc[r.CabinetId] || []).filter(i => i && i.Id)) {
          const days = td && i.CreatedAt ? (td - dt(i.CreatedAt)) / 864e5 : 0;
          if (days < -1 || days > MAXDAYS) continue;
          const ip = poles(i.Content), it = toks(i.Content);
          const inter = [...tt].filter(t => it.has(t)).length;
          const poleOK = tp.length && ip.length && tp.some(p => ip.includes(p));
          if (tp.length && ip.length && !poleOK) continue;
          let lvl = null;
          if (poleOK && (inter >= 1 || tt.size === 0)) lvl = 'A';
          else if (poleOK) lvl = 'B';
          else if (!tp.length && inter >= 2) lvl = 'B';
          if (lvl) cands.push({ i, lvl, inter, w: wm(work, i.Content), days: Math.abs(days) });
        }
        cands.sort((a, b) => a.lvl.localeCompare(b.lvl) || b.w - a.w || a.days - b.days || b.inter - a.inter);
        const c = cands[0]; let lvl = c ? c.lvl : '-';
        if (c && lvl === 'A' && c.w === 0 && cands.some(x => x.lvl === 'A' && x.w === 0 && norm(x.i.Content) !== norm(c.i.Content))) lvl = 'B';
        const o = {
          id: r.Id, cab: (r.Cabinet && r.Cabinet.BoxName || '').trim(), work,
          desc: (r.Description || '').trim(), date: td ? td.toLocaleDateString('vi-VN') : '', lvl, w: c ? c.w : undefined,
          incId: c ? c.i.Id : undefined, incContent: (c ? c.i.Content : '').trim().replace(/\s+/g, ' '),
          incDate: c ? dt(c.i.CreatedAt).toLocaleDateString('vi-VN') : ''
        };
        o.lech = o.lvl === 'A' ? lechReason(o) : '';
        return o;
      });
      const dist = [...new Set(rows.map(r => r.Cabinet && r.Cabinet.District))].filter(Boolean);
      return { out, dist, tong: rows.length, daLienKet: rows.length - un.length, chuaLienKet: un.length };
    })();
  }

  // ---------- Giao diện ----------
  const css = `
  #lksc{position:fixed;right:16px;bottom:16px;width:560px;max-width:95vw;z-index:999999;background:#fff;border:1px solid #c7ccd1;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);font:13px/1.4 "Segoe UI",Arial,sans-serif;color:#222}
  #lksc .hd{cursor:move;background:#0d6efd;color:#fff;padding:8px 12px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;font-weight:600}
  #lksc .hd .x{cursor:pointer;opacity:.85;font-size:16px}
  #lksc .bd{padding:10px 12px;max-height:70vh;overflow:auto}
  #lksc button{cursor:pointer;border:0;border-radius:6px;padding:6px 12px;font-weight:600}
  #lksc .b1{background:#0d6efd;color:#fff}
  #lksc .b2{background:#198754;color:#fff}
  #lksc .bg{background:#e9ecef;color:#222}
  #lksc button:disabled{opacity:.5;cursor:not-allowed}
  #lksc .st{margin:8px 0;padding:8px;background:#f1f3f5;border-radius:6px;white-space:pre-wrap}
  #lksc table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}
  #lksc th,#lksc td{border:1px solid #e3e6ea;padding:4px 6px;text-align:left;vertical-align:top}
  #lksc th{position:sticky;top:0;background:#f8f9fa}
  #lksc tr.lech{background:#fff3cd}
  #lksc tr.gB{background:#f3f0ff}
  #lksc .tag{display:inline-block;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:700}
  #lksc .tagA{background:#d1e7dd;color:#0f5132}
  #lksc .tagB{background:#e2d9f3;color:#4b2e83}
  #lksc .mini{color:#6c757d;font-size:11px}
  #lksc .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const box = document.createElement('div'); box.id = 'lksc';
  box.innerHTML = `
    <div class="hd"><span>🔗 Liên kết sự cố — Duy tu</span><span class="x" title="Đóng">✕</span></div>
    <div class="bd">
      <div class="row">
        <button class="b1" id="lksc-run">1) Ghép thử (quận đang lọc)</button>
        <button class="b2" id="lksc-save" disabled>2) Lưu dòng đã chọn</button>
        <button class="bg" id="lksc-csv" disabled>Xuất CSV</button>
      </div>
      <div class="st" id="lksc-st">Lọc quận + thời gian trên trang, rồi bấm "Ghép thử".</div>
      <div class="row mini">
        <label><input type="checkbox" id="lksc-fa" checked> A</label>
        <label><input type="checkbox" id="lksc-fb"> B</label>
        <label><input type="checkbox" id="lksc-fl"> dòng lệch</label>
        <span>| Tick cột ☑ = sẽ lưu</span>
      </div>
      <div id="lksc-tbl"></div>
    </div>`;
  document.body.appendChild(box);

  box.querySelector('.x').onclick = () => box.remove();

  // kéo panel
  (function () {
    const hd = box.querySelector('.hd'); let sx, sy, ox, oy, drag = false;
    hd.addEventListener('mousedown', e => { if (e.target.classList.contains('x')) return; drag = true; sx = e.clientX; sy = e.clientY; const r = box.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); });
    document.addEventListener('mousemove', e => { if (!drag) return; box.style.left = (ox + e.clientX - sx) + 'px'; box.style.top = (oy + e.clientY - sy) + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; });
    document.addEventListener('mouseup', () => drag = false);
  })();

  let DATA = null;
  const $ = s => box.querySelector(s);

  function render() {
    if (!DATA) return;
    const showA = $('#lksc-fa').checked, showB = $('#lksc-fb').checked, showL = $('#lksc-fl').checked;
    const rows = DATA.out.filter(o => {
      if (o.lvl === 'A' && o.lech) return showL;        // dòng lệch tách riêng
      if (o.lvl === 'A') return showA;
      if (o.lvl === 'B') return showB;
      return false;
    });
    const html = ['<table><thead><tr><th>☑</th><th>Nhóm</th><th>Hạng mục</th><th>Mô tả</th><th>→ Nội dung sự cố</th><th>Ngày SC</th></tr></thead><tbody>'];
    rows.forEach((o, idx) => {
      const i = DATA.out.indexOf(o);
      const cls = o.lech ? 'lech' : (o.lvl === 'B' ? 'gB' : '');
      const checked = (o.lvl === 'A' && !o.lech) ? 'checked' : '';
      const tag = o.lvl === 'A' ? '<span class="tag tagA">A</span>' : '<span class="tag tagB">B</span>';
      const lech = o.lech ? `<div class="mini" style="color:#b8860b">⚠ ${o.lech}</div>` : '';
      html.push(`<tr class="${cls}">
        <td><input type="checkbox" data-i="${i}" ${checked}></td>
        <td>${tag}</td>
        <td>${esc(o.work)}${lech}</td>
        <td>${esc(o.desc)}</td>
        <td>${esc(o.incContent)}</td>
        <td>${o.incDate || ''}</td></tr>`);
    });
    html.push('</tbody></table>');
    $('#lksc-tbl').innerHTML = rows.length ? html.join('') : '<div class="mini" style="padding:8px">Không có dòng nào theo bộ lọc.</div>';
  }
  const esc = s => (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  $('#lksc-fa').onchange = $('#lksc-fb').onchange = $('#lksc-fl').onchange = render;

  $('#lksc-run').onclick = async () => {
    const btn = $('#lksc-run'); btn.disabled = true; btn.textContent = 'Đang ghép...';
    $('#lksc-st').textContent = 'Đang nạp lưới & sự cố theo tủ...';
    try {
      DATA = await buildMatches();
      const cnt = { A: 0, Alech: 0, B: 0, '-': 0 };
      DATA.out.forEach(o => { if (o.lvl === 'A') (o.lech ? cnt.Alech++ : cnt.A++); else cnt[o.lvl]++; });
      $('#lksc-st').textContent =
        `Quận: ${DATA.dist.join(', ') || '(không rõ)'}\n` +
        `Tổng công việc: ${DATA.tong} | Đã liên kết sẵn: ${DATA.daLienKet} | Chưa liên kết: ${DATA.chuaLienKet}\n` +
        `A đúng: ${cnt.A} | A lệch: ${cnt.Alech} | B: ${cnt.B} | Không có sự cố: ${cnt['-']}`;
      $('#lksc-save').disabled = false; $('#lksc-csv').disabled = false;
      render();
    } catch (e) {
      $('#lksc-st').textContent = 'Lỗi: ' + (e && e.message || e);
    }
    btn.disabled = false; btn.textContent = '1) Ghép thử (quận đang lọc)';
  };

  $('#lksc-save').onclick = async () => {
    const picks = [...box.querySelectorAll('#lksc-tbl input[type=checkbox]:checked')].map(c => DATA.out[+c.dataset.i]).filter(o => o && o.incId);
    if (!picks.length) { alert('Chưa tick dòng nào để lưu.'); return; }
    if (!confirm(`Lưu liên kết cho ${picks.length} công việc?`)) return;
    const btn = $('#lksc-save'); btn.disabled = true; btn.textContent = 'Đang lưu...';
    const log = { ok: 0, daCo: 0, khac: [], loi: [] };
    for (const t of picks) {
      const r = await new Promise(res => LBCS.Service.MaintenanceSvc.SaveLinkIncident(t.id, t.incId, d => res({ d }), e => res({ e: e && e._message })));
      if (r.e) log.loi.push(t.id + ':' + r.e);
      else if (r.d === 1) log.ok++;
      else if (r.d === 2) log.daCo++;
      else log.khac.push(t.id + ':' + r.d);
    }
    LoadMaintTaskList(); await new Promise(r => setTimeout(r, 10000));
    const m = new Map(); gridOptions.api.forEachNode(n => { if (n.data) m.set(n.data.Id, n.data); });
    const dungMa = picks.filter(o => (m.get(o.id) || {}).IncidentId === o.incId).length;
    $('#lksc-st').textContent =
      `Đã lưu: ${log.ok} thành công | ${log.daCo} đã có sự cố (bỏ qua) | lỗi: ${log.loi.length} | khác: ${log.khac.length}\n` +
      `Kiểm tra lại: ${dungMa}/${picks.length} dòng đúng mã sau khi tải lưới.\n` +
      ((log.loi.length || log.khac.length) ? 'CHI TIẾT LỖI: ' + log.loi.concat(log.khac).join('; ') : 'Không có lỗi.');
    btn.disabled = false; btn.textContent = '2) Lưu dòng đã chọn';
  };

  $('#lksc-csv').onclick = () => {
    if (!DATA) return;
    const rows = DATA.out.filter(o => o.lvl !== '-');
    const head = ['Nhom', 'Lech', 'MaCV', 'Ngay', 'Tu', 'HangMuc', 'MoTa', 'MaSuCo', 'NgaySuCo', 'NoiDungSuCo'];
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [head.join(',')].concat(rows.map(o => [o.lvl, o.lech || '', o.id, o.date, o.cab, o.work, o.desc, o.incId || '', o.incDate, o.incContent].map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'lien-ket-su-co-' + (DATA.dist[0] || 'quan').replace(/\s+/g, '_') + '.csv'; a.click();
  };

})();
