// ==UserScript==
// @name         Báo cáo duy tu trong ngày - SmartHCM
// @namespace    lavipco.cskvtt
// @version      1.0.0
// @description  Tổng hợp kết quả công tác duy tu toàn KVTT theo ngày (ghi nhận) và xuất ra file Word (Mẫu hành chính). Chạy trên smarthcm.city.
// @author       CSKVTT - LAVIPCO
// @match        https://www.smarthcm.city/Maintenance/TaskListNew*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/neo-era/lien-ket-su-co-smarthcm/main/bao-cao-duytu-ngay.user.js
// @downloadURL  https://raw.githubusercontent.com/neo-era/lien-ket-su-co-smarthcm/main/bao-cao-duytu-ngay.user.js
// ==/UserScript==
/*
 * Cài: Tampermonkey > mở link raw ở trên > Install. Cần bật "Allow user scripts" và cấp quyền trang cho Tampermonkey.
 * Dùng: mở trang Quản lý Công việc Duy tu (TaskListNew) > panel góc phải dưới > chọn ngày > "Xuất Word".
 * Công cụ tự lấy dữ liệu tất cả quận KVTT (không cần bấm chọn từng quận).
 */
(function () {
  'use strict';
  if (!/\/Maintenance\/TaskListNew/i.test(location.pathname)) return;
  if (document.getElementById('bcdt')) return;

  /* ============ LÕI (đồng bộ với bản đã test bằng Node) ============ */
  var DISTRICTS = [
    { id: 1, name: 'Quận 1' }, { id: 3, name: 'Quận 3' }, { id: 5, name: 'Quận 5' },
    { id: 8, name: 'Quận 8' }, { id: 10, name: 'Quận 10' }, { id: 11, name: 'Quận 11' },
    { id: 14, name: 'Quận Bình Thạnh' }, { id: 16, name: 'Quận Phú Nhuận' }
  ];
  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function fmt(n) { n = Math.round((num(n) + Number.EPSILON) * 100) / 100; var s = (n % 1 === 0) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); return s.replace('.', ','); }
  function workName(r) { var w = r && r.MaintScheduleDetail && r.MaintScheduleDetail.MaintWork && r.MaintScheduleDetail.MaintWork.Name; w = (w || '').trim(); return w || '(không ghi hạng mục)'; }
  function boxName(r) { return ((r.Cabinet && r.Cabinet.BoxName) || '').trim(); }
  function personName(r) { return (r.CreatedBy || '').replace(/\s*\(\s*\d[\d\s.]*\)\s*$/, '').trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function aggregate(rowsByDistrict, Y, M, D) {
    var out = { Y: Y, M: M, D: D, dist: [], grand: { rows: 0, qty: 0, done: 0 }, errDistricts: [] };
    rowsByDistrict.forEach(function (d) {
      if (d.err) { out.dist.push({ id: d.id, name: d.name, err: true, rows: 0, qty: 0, done: 0, workSum: [], detail: [] }); out.errDistricts.push(d.name); return; }
      var rows = (d.rows || []).filter(function (r) { return r.Year === Y && r.Month === M && r.Day === D; });
      var wmap = {}, detail = [], qty = 0, done = 0;
      rows.forEach(function (r) {
        var w = workName(r), q = num(r.Quantity), c = num(r.CompletedQuantity);
        qty += q; done += c;
        if (!wmap[w]) wmap[w] = { work: w, n: 0, qty: 0, done: 0 };
        wmap[w].n++; wmap[w].qty += q; wmap[w].done += c;
        detail.push({ box: boxName(r), desc: (r.Description || '').trim(), work: w, qty: q, done: c, by: personName(r) });
      });
      var workSum = Object.keys(wmap).map(function (k) { return wmap[k]; }).sort(function (a, b) { return b.n - a.n || b.qty - a.qty; });
      detail.sort(function (a, b) { return a.work < b.work ? -1 : a.work > b.work ? 1 : 0; });
      out.dist.push({ id: d.id, name: d.name, err: false, rows: rows.length, qty: qty, done: done, workSum: workSum, detail: detail });
      out.grand.rows += rows.length; out.grand.qty += qty; out.grand.done += done;
    });
    return out;
  }

  function buildWordHtml(agg) {
    var dateStr = pad2(agg.D) + '/' + pad2(agg.M) + '/' + agg.Y;
    var active = agg.dist.filter(function (d) { return !d.err && d.rows > 0; });
    var h = [];
    h.push('<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">');
    h.push('<style>@page{size:21cm 29.7cm;margin:1.6cm 1.8cm;}body{font-family:"Times New Roman",serif;font-size:13pt;color:#000;}.org{font-weight:bold;text-transform:uppercase;font-size:12pt;}.org .u{font-weight:normal;text-transform:none;}h1{text-align:center;font-size:15pt;margin:14pt 0 2pt;}.sub{text-align:center;font-style:italic;margin:0 0 12pt;}.grp{font-weight:bold;margin:12pt 0 4pt;}.sub2{font-weight:bold;margin:10pt 0 2pt;}table{border-collapse:collapse;width:100%;margin:4pt 0 8pt;font-size:12pt;border:1pt solid #000;}th,td{border:1pt solid #000;padding:3pt 5pt;vertical-align:top;}th{background:#f0f0f0;text-align:center;font-weight:bold;}td.c{text-align:center;}tr.sum td{font-weight:bold;}.sign{margin-top:18pt;text-align:right;}.muted{color:#555;font-style:italic;}</style></head><body>');
    h.push('<div class="org">Công ty CP Chiếu sáng Công cộng TP.HCM<br><span class="u">Chiếu sáng Khu vực Trung Tâm</span></div>');
    h.push('<h1>BÁO CÁO KẾT QUẢ CÔNG TÁC DUY TU</h1>');
    h.push('<div class="sub">Ngày ' + dateStr + '</div>');
    h.push('<div class="grp">I. TỔNG HỢP THEO QUẬN</div>');
    h.push('<table><tr><th style="width:8%">STT</th><th>Quận</th><th style="width:16%">Số công việc</th><th style="width:16%">SL thực hiện</th></tr>');
    agg.dist.forEach(function (d, i) {
      h.push('<tr><td class="c">' + (i + 1) + '</td><td>' + esc(d.name) + (d.err ? ' <span class="muted">(lỗi tải)</span>' : '') + '</td><td class="c">' + (d.err ? '—' : d.rows) + '</td><td class="c">' + (d.err ? '—' : fmt(d.done)) + '</td></tr>');
    });
    h.push('<tr class="sum"><td class="c" colspan="2">TỔNG CỘNG</td><td class="c">' + agg.grand.rows + '</td><td class="c">' + fmt(agg.grand.done) + '</td></tr></table>');
    if (agg.grand.rows === 0) {
      h.push('<p class="muted">Trong ngày không có công việc duy tu được ghi nhận.</p>');
    } else {
      h.push('<div class="grp">II. CHI TIẾT THEO QUẬN</div>');
      active.forEach(function (d, idx) {
        h.push('<div class="sub2">' + (idx + 1) + '. ' + esc(d.name) + ' — ' + d.rows + ' công việc, ' + fmt(d.done) + ' SL</div>');
        h.push('<table><tr><th>Hạng mục công việc</th><th style="width:14%">Số CV</th><th style="width:16%">SL thực hiện</th></tr>');
        d.workSum.forEach(function (w) { h.push('<tr><td>' + esc(w.work) + '</td><td class="c">' + w.n + '</td><td class="c">' + fmt(w.done) + '</td></tr>'); });
        h.push('</table>');
        h.push('<table><tr><th style="width:6%">TT</th><th style="width:20%">Tủ</th><th>Vị trí / Mô tả</th><th style="width:24%">Hạng mục</th><th style="width:8%">SL</th><th style="width:16%">Người thực hiện</th></tr>');
        d.detail.forEach(function (r, i) { h.push('<tr><td class="c">' + (i + 1) + '</td><td>' + esc(r.box) + '</td><td>' + esc(r.desc) + '</td><td>' + esc(r.work) + '</td><td class="c">' + fmt(r.qty) + '</td><td>' + esc(r.by) + '</td></tr>'); });
        h.push('</table>');
      });
    }
    h.push('<div class="sign">Giám đốc Chiếu sáng Khu vực Trung Tâm<br><br><br><b>Mai Vũ Lâm</b></div></body></html>');
    return h.join('');
  }

  /* ============ LẤY DỮ LIỆU TỪ TRANG ============ */
  function listByDistrict(id, startISO, endISO) {
    var filter = { Cabinets: {}, Districts: {}, Wards: {}, MaintWorks: {}, IsShowingAllMaintWork: false, StartDate: startISO, EndDate: endISO };
    filter.Districts[String(id)] = id; // QUAN TRỌNG: value = mã quận, không phải 1
    return new Promise(function (res) {
      try { LBCS.Service.MaintenanceSvc.ListMaintTaskNew(filter, function (d) { res({ ok: true, rows: d || [] }); }, function () { res({ ok: false }); }); }
      catch (e) { res({ ok: false }); }
    });
  }

  async function collect(Y, M, D, onProg) {
    // Lấy cả tháng rồi lọc theo ngày (ổn định với múi giờ); StartDate/EndDate bao trọn tháng.
    var startISO = new Date(Date.UTC(Y, M - 1, 1)).toISOString();
    var endISO = new Date(Date.UTC(Y, M - 1, 31, 23, 59, 59)).toISOString();
    var acc = [];
    for (var i = 0; i < DISTRICTS.length; i++) {
      var dd = DISTRICTS[i];
      if (onProg) onProg(i, DISTRICTS.length, dd.name);
      var r = await listByDistrict(dd.id, startISO, endISO);
      acc.push(r.ok ? { id: dd.id, name: dd.name, rows: r.rows } : { id: dd.id, name: dd.name, err: true });
    }
    return acc;
  }

  function download(html, Y, M, D) {
    var blob = new Blob(['﻿' + html], { type: 'application/msword' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'BaoCao-DuyTu-KVTT-' + Y + pad2(M) + pad2(D) + '.doc';
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 1500);
  }

  /* ============ GIAO DIỆN ============ */
  var css = '#bcdt{position:fixed;right:16px;bottom:16px;width:360px;max-width:95vw;z-index:999999;background:#fff;border:1px solid #c7ccd1;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);font:13px/1.45 "Segoe UI",Arial,sans-serif;color:#222}'
    + '#bcdt .hd{cursor:move;background:#1f3864;color:#fff;padding:8px 12px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;font-weight:600}'
    + '#bcdt .hd .x{cursor:pointer}#bcdt .bd{padding:12px}'
    + '#bcdt label{display:block;margin:0 0 4px;font-weight:600}'
    + '#bcdt input[type=date]{width:100%;padding:6px 8px;border:1px solid #c7ccd1;border-radius:6px;font:inherit;margin-bottom:10px}'
    + '#bcdt button{cursor:pointer;border:0;border-radius:6px;padding:8px 12px;font-weight:600;width:100%;background:#198754;color:#fff;font-size:14px}'
    + '#bcdt button:disabled{opacity:.6;cursor:not-allowed}'
    + '#bcdt .st{margin-top:10px;padding:8px;background:#f1f3f5;border-radius:6px;white-space:pre-wrap;min-height:18px}';
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var today = new Date(); var iso = today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());
  var box = document.createElement('div'); box.id = 'bcdt';
  box.innerHTML = '<div class="hd"><span>📄 Báo cáo duy tu trong ngày</span><span class="x" title="Đóng">✕</span></div>'
    + '<div class="bd"><label>Ngày báo cáo</label><input type="date" id="bcdt-date" value="' + iso + '" max="' + iso + '">'
    + '<button id="bcdt-go">Xuất Word (toàn KVTT)</button>'
    + '<div class="st" id="bcdt-st">Chọn ngày rồi bấm "Xuất Word". Công cụ tự lấy dữ liệu tất cả quận.</div></div>';
  document.body.appendChild(box);
  box.querySelector('.x').onclick = function () { box.remove(); };
  (function () { var hd = box.querySelector('.hd'); var sx, sy, ox, oy, drag = false; hd.addEventListener('mousedown', function (e) { if (e.target.classList.contains('x')) return; drag = true; sx = e.clientX; sy = e.clientY; var r = box.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); }); document.addEventListener('mousemove', function (e) { if (!drag) return; box.style.left = (ox + e.clientX - sx) + 'px'; box.style.top = (oy + e.clientY - sy) + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; }); document.addEventListener('mouseup', function () { drag = false; }); })();

  var st = box.querySelector('#bcdt-st');
  box.querySelector('#bcdt-go').onclick = async function () {
    var btn = this; var val = box.querySelector('#bcdt-date').value;
    if (!val) { alert('Chọn ngày báo cáo.'); return; }
    var p = val.split('-'); var Y = +p[0], M = +p[1], D = +p[2];
    btn.disabled = true; var old = btn.textContent; btn.textContent = 'Đang lấy dữ liệu...';
    try {
      var raw = await collect(Y, M, D, function (i, n, name) { st.textContent = 'Đang lấy ' + name + ' (' + (i + 1) + '/' + n + ')...'; });
      var agg = aggregate(raw, Y, M, D);
      var html = buildWordHtml(agg);
      download(html, Y, M, D);
      var errNote = agg.errDistricts.length ? '\n⚠ Quận lỗi tải: ' + agg.errDistricts.join(', ') + ' (thử lại).' : '';
      st.textContent = 'Xong! Ngày ' + pad2(D) + '/' + pad2(M) + '/' + Y + ': ' + agg.grand.rows + ' công việc, ' + fmt(agg.grand.done) + ' SL thực hiện. Đã tải file Word.' + errNote;
    } catch (e) { st.textContent = 'Lỗi: ' + (e && e.message || e); }
    btn.disabled = false; btn.textContent = old;
  };

  // Cho phép kiểm thử tự động: lấy agg mà không tải file
  window.__bcdt = { aggregate: aggregate, buildWordHtml: buildWordHtml, collect: collect, DISTRICTS: DISTRICTS, fmt: fmt };
})();
