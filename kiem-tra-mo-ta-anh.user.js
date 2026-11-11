// ==UserScript==
// @name         Kiểm tra mô tả & ảnh duy tu - SmartHCM
// @namespace    lavipco.cskvtt
// @version      1.2.0
// @description  Soát chính tả cột Mô tả (có tự học), kiểm tra dữ liệu ảnh tự động, xem ảnh nhanh để kết luận Khớp/Không khớp, xuất Excel. Có chức năng ghi mô tả đã sửa vào SmartHCM (chỉ dòng người dùng chọn, có xác nhận, nhật ký và hoàn tác). Chạy trên smarthcm.city.
// @author       CSKVTT - LAVIPCO
// @match        https://smarthcm.city/*
// @match        https://*.smarthcm.city/*
// @match        http://smarthcm.city/*
// @match        http://*.smarthcm.city/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/neo-era/lien-ket-su-co-smarthcm/main/kiem-tra-mo-ta-anh.user.js
// @downloadURL  https://raw.githubusercontent.com/neo-era/lien-ket-su-co-smarthcm/main/kiem-tra-mo-ta-anh.user.js
// ==/UserScript==
/*
 * Cài: Tampermonkey > mở link raw ở trên > Install. Cần bật "Allow user scripts" và quyền truy cập trang.
 * Dùng: trang Quản lý công việc duy tu (TaskListNew) > panel "🔍 Kiểm tra mô tả & ảnh" góc phải dưới.
 * Mã nguồn lõi được test tự động (core.test.js, xlsx.test.js, ui.test.js) trước khi build.
 */
(function () {
'use strict';
var KT_VERSION = "1.2.0";
// ===== LÕI kiểm tra mô tả & ảnh duy tu (thuần, không DOM) — dùng chung userscript & test Node =====
var KTCORE = (function () {
  'use strict';
  function own(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }
  function dict() { return Object.create(null); }
  function str(x) { return x == null ? '' : String(x); }

  /* ---------- ngày ---------- */
  function dt(x) {
    if (x instanceof Date) return x;
    if (typeof x === 'string') { var m = x.match(/\/Date\((-?\d+)/); if (m) return new Date(+m[1]); }
    var d = x ? new Date(x) : null; return d && !isNaN(d) ? d : null;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(x) { var d = dt(x); return d ? d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) : ''; }
  function dmy(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function workName(r) { var w = r && r.MaintScheduleDetail && r.MaintScheduleDetail.MaintWork && r.MaintScheduleDetail.MaintWork.Name; return str(w).trim(); }
  function prep(rows) { rows.forEach(function (r) { r._day = ymd(r.CreatedAt); r._work = workName(r); }); return rows; }

  /* ---------- số ---------- */
  function isNum(s) { s = str(s); return /^\s*\d[\d.,]*\s*$/.test(s) && /\d{2,}/.test(s); }
  function num(s) { return parseFloat(str(s).trim().replace(/[.,](?=\d{3}(?!\d))/g, '').replace(',', '.')); }

  /* ---------- kiểm tra tự động ---------- */
  // opt.images === false: dữ liệu không có trường ảnh → bỏ các kiểm tra ảnh
  function autoChecks(rows, opt) {
    opt = opt || {}; prep(rows);
    var by = new Map(rows.map(function (r) { return [String(r.Id), r]; }));
    function root(id) { var cur = String(id), r = by.get(cur), g = 0; while (r && r.ParentTaskId != null && r.ParentTaskId !== '' && g++ < 6) { cur = String(r.ParentTaskId); r = by.get(cur); } return cur; }
    var out = [];
    if (opt.images !== false) {
      rows.forEach(function (r) {
        if (!r.Image1 || !r.Image3) out.push({ id: r.Id, loai: 'Thiếu ảnh', ct: !r.Image1 && !r.Image3 ? 'Thiếu Hiện trạng + Hoàn thành' : (!r.Image1 ? 'Thiếu ảnh Hiện trạng' : 'Thiếu ảnh Hoàn thành') });
      });
      rows.forEach(function (r) { if (r.Image1 && r.Image1 === r.Image3) out.push({ id: r.Id, loai: 'Ảnh trước = ảnh sau', ct: 'Hiện trạng và Hoàn thành cùng một file' }); });
      var seen = new Map();
      rows.forEach(function (r) { ['Image1', 'Image2', 'Image3', 'ImageAddition'].forEach(function (k) { if (r[k]) { var f = str(r[k]); if (!seen.has(f)) seen.set(f, new Set()); seen.get(f).add(String(r.Id)); } }); });
      var dup = new Map();
      seen.forEach(function (set) {
        if (set.size < 2) return;
        var ids = Array.from(set), roots = ids.map(root);
        for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) if (roots[i] !== roots[j]) {
          if (!dup.has(ids[i])) dup.set(ids[i], new Set()); if (!dup.has(ids[j])) dup.set(ids[j], new Set());
          dup.get(ids[i]).add(ids[j]); dup.get(ids[j]).add(ids[i]);
        }
      });
      dup.forEach(function (s, id) { var a = Array.from(s); out.push({ id: by.get(id).Id, loai: 'Trùng ảnh với CV khác (không cha–con)', ct: 'Dùng chung ảnh với CV ' + a.slice(0, 20).join(', ') + (a.length > 20 ? ' … (+' + (a.length - 20) + ')' : '') }); });
    }
    rows.forEach(function (r) { var d = str(r.Description).trim(); if (!d || /^[^\p{L}\p{N}]+$/u.test(d)) out.push({ id: r.Id, loai: 'Mô tả trống', ct: '' }); });
    var cab = new Map();
    rows.filter(function (r) { return isNum(r.Description) && /duy trì trạm/i.test(r._work); }).forEach(function (r) {
      var c = r.Cabinet || {}, k = r.CabinetId != null ? 'i' + r.CabinetId : (c.Id != null ? 'i' + c.Id : (c.BoxName ? 'b' + c.BoxName : null));
      if (k == null) return; if (!cab.has(k)) cab.set(k, []); cab.get(k).push(r);
    });
    cab.forEach(function (a) {
      a.sort(function (x, y) { return (dt(x.CreatedAt) || 0) - (dt(y.CreatedAt) || 0); });
      for (var i = 1; i < a.length; i++) { var p = num(a[i - 1].Description), c = num(a[i].Description); if (c < p) out.push({ id: a[i].Id, loai: 'Chỉ số điện kế giảm (CẦN XEM)', ct: dmy(a[i - 1]._day) + ': ' + p + ' → ' + dmy(a[i]._day) + ': ' + c + ' (có thể đã thay công tơ)' }); }
    });
    return out;
  }

  /* ---------- chính tả ---------- */
  function bd(s) { return str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐÐ]/g, 'd').toLowerCase(); }
  function hasVN(s) { return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(s); }
  // Levenshtein có ngưỡng: trả > max sớm (băng |i-j| ≤ max)
  function lev(a, b, max) {
    var m = a.length, n = b.length, INF = max + 1; if (Math.abs(m - n) > max) return INF;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) prev[j] = j <= max ? j : INF;
    for (i = 1; i <= m; i++) {
      cur.fill(INF); cur[0] = i <= max ? i : INF; var best = cur[0], lo = Math.max(1, i - max), hi = Math.min(n, i + max);
      for (j = lo; j <= hi; j++) { var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (v > INF) v = INF; cur[j] = v; if (v < best) best = v; }
      if (best > max) return INF;
      var t = prev; prev = cur; cur = t;
    }
    return prev[n] > max ? INF : prev[n];
  }
  var TONE = { 'òa': 'oà', 'óa': 'oá', 'ỏa': 'oả', 'õa': 'oã', 'ọa': 'oạ', 'òe': 'oè', 'óe': 'oé', 'ỏe': 'oẻ', 'õe': 'oẽ', 'ọe': 'oẹ', 'ùy': 'uỳ', 'úy': 'uý', 'ủy': 'uỷ', 'ũy': 'uỹ', 'ụy': 'uỵ' };
  function tn(s) { return s.normalize('NFC').toLowerCase().replace(/òa|óa|ỏa|õa|ọa|òe|óe|ỏe|õe|ọe|ùy|úy|ủy|ũy|ụy/g, function (m) { return TONE[m]; }); }
  var GEN = new Set('công viên khu đường hẻm cầu chợ nhà bến vòng xoay phường quận xã'.split(' '));
  // TỪ ĐIỂN TÊN CHUẨN — ưu tiên hơn dữ liệu tủ (dữ liệu tủ có chỗ sai, vd "Mạc Đỉnh Chi").
  var EXTRA = ['Lê Duẩn', 'Lê Lợi', 'Lê Lai', 'Mạc Đĩnh Chi', 'Nam Kỳ Khởi Nghĩa', 'Điện Biên Phủ', 'Đỗ Quang Đẩu', 'Cô Giang', 'Cô Bắc', 'Đề Thám', 'Phạm Viết Chánh', 'Pasteur', 'Calmette', 'Hàm Nghi', 'Nguyễn Văn Cừ', 'Nguyễn Văn Thủ', 'Nguyễn Trãi', 'Nguyễn Thị Minh Khai', 'Trần Hưng Đạo', 'Nguyễn Công Trứ', 'Xô Viết Nghệ Tĩnh', 'Cách Mạng Tháng 8', 'Tân Định', 'Bến Thành', 'Bến Nghé', 'Sài Gòn', 'Cầu Ông Lãnh', 'Cầu Kho', 'Đa Kao', 'Xuân Hòa', 'Nhiêu Lộc', 'Gia Định', 'Nguyễn Cư Trinh', 'Phạm Ngũ Lão', 'Nguyễn Thái Bình', 'Tao Đàn', 'Cách Mạng Tháng Tám', 'Bàn Cờ', 'Cầu Kiệu', 'Hai Bà Trưng', 'Võ Thị Sáu', 'Lý Chính Thắng', 'Trần Quốc Thảo', 'Bà Huyện Thanh Quan', 'Kỳ Đồng', 'Trần Quốc Toản', 'Võ Văn Tần', 'Lê Văn Sỹ', 'Rạch Bùng Binh', 'Ngô Thời Nhiệm', 'Nguyễn Thượng Hiền', 'Trần Quang Khải'];
  var ALT = new Set(['Lê Văn Sỹ', 'Lê Văn Sĩ']);
  var TOKS = '[\\p{L}\\p{N}]+(?:\\/\\p{N}+)*';
  function keyOf(n) { return (bd(n).match(new RegExp(TOKS, 'gu')) || []).join(' '); }
  var TR_RE = /(?<![\p{L}\p{N}])(tr|tru|tt)\s*\.?\s*(s[oố]\s*)?(\d+)/giu;

  function buildChecker(rows) {
    var DICT = new Map();
    function put(n) { n = n.replace(/^(phường|quận|xã|p\.|q\.)\s*/i, '').trim(); if (n === n.toUpperCase()) n = n.toLowerCase().replace(/(^|\s)\p{L}/gu, function (m) { return m.toUpperCase(); }); // "CẦU KIỆU" → "Cầu Kiệu"
      var k = keyOf(n); if (!k) return; var cur = DICT.get(k); if (!cur || (!hasVN(cur) && hasVN(n))) DICT.set(k, n); }
    (rows || []).forEach(function (r) { var c = r.Cabinet || {}; [c.Road, c.Ward].forEach(function (n) { n = str(n); if (n.length > 3 && !/^\d/.test(n)) put(n.replace(/\s*[-(].*$/, '').trim()); }); });
    EXTRA.forEach(function (n) { DICT.set(keyOf(n), n); });
    var NAMES = Array.from(DICT, function (e) { return { k: e[0], v: e[1], w: e[0].split(' ').length, num: /\d/.test(e[0]) }; }).sort(function (a, b) { return b.k.length - a.k.length; });
    NAMES.forEach(function (nm, i) { nm.i = i; });
    var FIRST = new Map(), FUZ = new Map(), fmemo = new Map();
    NAMES.forEach(function (nm) {
      if (!(nm.w < 2 && nm.k.length < 6)) { var f = nm.k.split(' ')[0]; if (!FIRST.has(f)) FIRST.set(f, []); FIRST.get(f).push(nm); }
      if (!(nm.num || nm.k.length < (nm.w === 1 ? 7 : 8))) { if (!FUZ.has(nm.w)) FUZ.set(nm.w, []); FUZ.get(nm.w).push(nm); }
    });
    function fuzzy(w, key) {
      var mk = w + '|' + key, r = fmemo.get(mk); if (r) return r; r = []; var mx = w === 1 ? 2 : 1;
      (FUZ.get(w) || []).forEach(function (nm) { if (Math.abs(key.length - nm.k.length) > 2) return; var d = lev(key, nm.k, mx); if (d === 0 || d > mx) return; r.push({ nm: nm, d: d }); });
      fmemo.set(mk, r); return r;
    }

    // off: Set khoá lỗi bị tắt → không áp sửa tương ứng vào đề xuất
    return function check(s0, off) {
      off = off || new Set(); s0 = str(s0);
      var I = [], sN = s0.normalize('NFC'), s = sN.replace(/Ð/g, 'Đ');
      var kyKey = 'kytu|' + s0, base = (/Ð/.test(sN) && off.has(kyKey)) ? sN : s;
      function add(kind, key, text, rep) { if (!I.some(function (x) { return x.key === key; })) I.push({ kind: kind, key: key, text: text, rep: rep }); }
      if (/Ð/.test(sN)) add('L', kyKey, 'Dùng sai ký tự "Ð" (không phải "Đ")');
      if (/[¹²³]|(?<![\p{L}\p{N}])p{2,}(?![\p{L}\p{N}])/iu.test(s)) add('L', 'rac|' + s0, 'Ký tự rác (¹, pp…)');
      if (/=/.test(s)) add('L', 'eq|' + s0, 'Ký tự lạ "="');
      var toks = [], re = new RegExp(TOKS, 'gu'), m;
      while ((m = re.exec(s))) toks.push({ t: m[0], i: m.index, k: bd(m[0]) });
      var used = new Set(), claimed = [];
      function take(nm, a, d) {
        var seg = toks.slice(a, a + nm.w), st = seg[0].i, en = seg[nm.w - 1].i + seg[nm.w - 1].t.length;
        var orig = s.slice(st, en), origB = base.slice(st, en);
        seg.forEach(function (o, x) { used.add(a + x); });
        var cl = { st: st, en: en, orig: origB, v: origB }; claimed.push(cl);
        if (orig === nm.v || ALT.has(orig)) return;
        if (d === 0) {
          var ow = orig.split(/\s+/), vw = nm.v.split(/\s+/);
          if (ow.every(function (w, j) { return tn(w) === tn(vw[j] || '') && (w === vw[j] || GEN.has(w.toLowerCase()) || /^\p{Lu}/u.test(w) || !/^\p{Lu}/u.test(vw[j] || '')); })) return;
        }
        var kind = d ? 'Gõ sai tên' : (orig.toLowerCase() === bd(orig) ? 'Viết không dấu' : 'Sai dấu/hoa thường');
        var key = 'ten|' + bd(orig) + '>' + nm.v;
        add('L', key, kind + ' "' + orig + '" → "' + nm.v + '"', true);
        cl.key = key; cl.nv = nm.v;
      }
      function free(a, w) { for (var x = 0; x < w; x++) if (used.has(a + x)) return false; return true; }
      // Lượt 1: khớp chính xác (bỏ dấu); tên dài giữ chỗ trước
      var cand = [];
      for (var a = 0; a < toks.length; a++) {
        var fl = FIRST.get(toks[a].k); if (!fl) continue;
        fl.forEach(function (nm) { if (a + nm.w > toks.length) return; for (var x = 1; x < nm.w; x++) if (nm.k.split(' ')[x] !== toks[a + x].k) return; cand.push({ nm: nm, a: a }); });
      }
      cand.sort(function (x, y) { return x.nm.i - y.nm.i || x.a - y.a; }).forEach(function (c) { if (free(c.a, c.nm.w)) take(c.nm, c.a, 0); });
      // Lượt 2: gần đúng (gõ nhầm)
      var fc = [];
      FUZ.forEach(function (list, w) {
        for (var a = 0; a + w <= toks.length; a++) {
          if (!free(a, w)) continue;
          var seg = toks.slice(a, a + w), key = seg.map(function (o) { return o.k; }).join(' '); if (/\d/.test(key)) continue;
          var orig = seg.map(function (o) { return o.t; }).join(' '); if (hasVN(orig) && !/^\p{Lu}/u.test(orig)) continue;
          fuzzy(w, key).forEach(function (c) { fc.push({ nm: c.nm, a: a, d: c.d }); });
        }
      });
      fc.sort(function (x, y) { return x.nm.i - y.nm.i || x.a - y.a; }).forEach(function (c) { if (free(c.a, c.nm.w)) take(c.nm, c.a, c.d); });
      // Viết tắt trụ — bỏ qua chỗ nằm trong tên đường ("nguyen cong tru 5")
      var inName = function (st, en) { return claimed.some(function (c) { return st < c.en && en > c.st; }); };
      TR_RE.lastIndex = 0; var tr;
      while ((tr = TR_RE.exec(s))) { if (/^trụ/i.test(tr[0]) || inName(tr.index, tr.index + tr[1].length)) continue; add('L', 'tr|' + s0, '"' + tr[0] + '" → "' + (/^\p{Lu}/u.test(tr[0]) ? 'Trụ' : 'trụ') + ' số ' + tr[3] + '"'); break; }
      if (/(?<![\p{L}\p{N}])p\.?\s*\d+(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])p\.?\s+\p{Ll}/iu.test(s) && !/(?<![\p{L}\p{N}])P\.\s?\p{Lu}/u.test(s)) add('C', 'p|' + s0, 'Viết tắt "p" → "phường"');
      var s2 = s.replace(/\d[.,]\d/g, '').replace(/(?<![\p{L}\p{N}])(?:TP|Tp|tp|Q|q|P|p)\.(?=\S)/gu, '').replace(/\.{2,}|…/g, '');
      if (/[.,;:][^\s\d)\/µ]/u.test(s2)) add('C', 'sp1|' + s0, 'Thiếu khoảng trắng sau dấu câu');
      if (/\(\s|\s[.,;:)]|\p{L}\(/u.test(s2)) add('C', 'sp2|' + s0, 'Khoảng trắng quanh dấu câu/ngoặc chưa chuẩn');

      // ---- đề xuất sửa (chỉ áp lỗi đang bật) ----
      var on = function (k) { return I.some(function (x) { return x.key === k; }) && !off.has(k); };
      var de = base, ph = [];
      // che tên đã nhận diện bằng ký hiệu giữ chỗ để các luật viết tắt không đụng vào
      claimed.slice().sort(function (x, y) { return y.st - x.st; }).forEach(function (c) {
        var rep = (c.key && !off.has(c.key)) ? c.nv : c.orig; ph.push(rep);
        de = de.slice(0, c.st) + '\u0002' + (ph.length - 1) + '\u0003' + de.slice(c.en);
      });
      if (on('tr|' + s0)) de = de.replace(TR_RE, function (m0, w, so, n) { return /^trụ/i.test(m0) ? m0 : (/^\p{Lu}/u.test(m0) ? 'Trụ số ' : 'trụ số ') + n; });
      if (on('p|' + s0)) de = de.replace(/(?<![\p{L}\p{N}\u0003])p\.?\s*(?=\d)/giu, 'phường ').replace(/(?<![\p{L}\p{N}\u0003])p\.?\s+(?=[\p{L}\u0002])/giu, 'phường ');
      de = de.replace(/\u0002(\d+)\u0003/g, function (m0, i) { return ph[+i]; });
      de = de.replace(/(?<![\p{L}\p{N}])(TP|Tp|tp|Q|q)\.(?=\S)/gu, function (m0, a) { return a + '\u0001'; });
      if (on('rac|' + s0)) de = de.replace(/[¹²³]/g, '').replace(/(?<![\p{L}\p{N}])p{2,}(?![\p{L}\p{N}])/giu, '');
      if (on('eq|' + s0)) de = de.replace(/\s*=\s*/g, ' ');
      if (on('sp2|' + s0) || (on('sp1|' + s0) && !off.has('sp2|' + s0))) de = de.replace(/(\p{L})\(/gu, function (m0, a) { return a + ' ('; }).replace(/\(\s+/g, '(').replace(/\s+([.,;:)])/g, function (m0, a) { return a; });
      if (on('sp1|' + s0)) de = de.replace(/([.,;:])(?=[^\s\d)\/µ.\u0001])/g, function (m0, a) { return a + ' '; });
      de = de.replace(/\s+/g, ' ').replace(/\u0001/g, '.').replace(/(?<![\p{L}\p{N}])(trụ)\s+trụ số/giu, function (m0, a) { return a + ' số'; }).trim();
      return { issues: I, de: de };
    };
  }

  /* ---------- tự học ---------- */
  function emptyLearn() { return { v: 1, rules: dict(), de: dict(), add: dict() }; }
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function cnt(x) { x = Math.floor(Number(x)); return isFinite(x) && x > 0 ? Math.min(x, 1e6) : 0; }
  // Đọc bộ nhớ học: chịu được JSON hỏng / sai cấu trúc (bỏ mục lỗi, không làm sập công cụ)
  function parseLearn(txt) {
    var o; try { o = typeof txt === 'string' ? JSON.parse(txt) : txt; } catch (e) { return emptyLearn(); }
    var L = emptyLearn(); if (!isObj(o)) return L;
    if (isObj(o.rules)) Object.keys(o.rules).forEach(function (k) { var r = o.rules[k]; if (!isObj(r)) return; var p = cnt(r.pos), n = cnt(r.neg); if (!p && !n) return; L.rules[k] = { pos: p, neg: n, text: str(r.text).slice(0, 500), ex: str(r.ex).slice(0, 500), t: str(r.t).slice(0, 30) }; });
    if (isObj(o.de)) Object.keys(o.de).forEach(function (k) { var r = o.de[k]; if (isObj(r) && typeof r.de === 'string') L.de[k] = { de: r.de.slice(0, 2000), t: str(r.t).slice(0, 30) }; });
    if (isObj(o.add)) Object.keys(o.add).forEach(function (k) { var r = o.add[k]; if (isObj(r) && typeof r.loi === 'string' && r.loi.trim()) L.add[k] = { loi: r.loi.slice(0, 500), de: str(r.de).slice(0, 2000), t: str(r.t).slice(0, 30) }; });
    return L;
  }
  function serializeLearn(L) { return JSON.stringify(L); }
  function verdict(r) { if (!r || !(r.pos || r.neg)) return null; return r.neg > r.pos ? 'BỎ' : r.pos > r.neg ? 'GIỮ' : 'MÂU THUẪN'; }

  function spellList(rows, L) {
    L = L || emptyLearn();
    var check = buildChecker(rows), uniqIds = dict();
    rows.forEach(function (r) { var s = str(r.Description).replace(/\s+/g, ' ').trim(); if (!s || isNum(s)) return; (uniqIds[s] = uniqIds[s] || []).push(r.Id); });
    var uniq = Object.keys(uniqIds).sort(), items = [], unflag = [];
    uniq.forEach(function (s) {
      var c = check(s), off = new Set();
      var issues = c.issues.map(function (x) {
        var i = { kind: x.kind, key: x.key, text: x.text, on: true, learned: '' }, v = verdict(own(L.rules, x.key));
        if (v === 'BỎ') { i.on = false; i.learned = '📚 đã học: bỏ (báo nhầm)'; } else if (v === 'GIỮ') i.learned = '📚 đã học: đúng lỗi'; else if (v === 'MÂU THUẪN') i.learned = '📚 mâu thuẫn — xem lại';
        if (!i.on) off.add(i.key); i.def = i.on; return i;
      });
      var ad = own(L.add, s);
      if (ad) issues.push({ kind: 'L', key: 'add|' + s, text: ad.loi, on: true, def: true, user: true, learned: '📚 đã học: người kiểm thêm' });
      if (!issues.length) { unflag.push(s); return; }
      var de = off.size ? check(s, off).de : c.de, deL = '', ld = own(L.de, s);
      if (ld) { de = ld.de; deL = '📚'; } else if (ad && ad.de) { de = ad.de; deL = '📚'; }
      items.push({ s: s, n: uniqIds[s].length, ids: uniqIds[s], issues: issues, de: de, defDe: de, deLearned: deL, _ix: items.length });
    });
    return { items: items, unflag: unflag, uniqIds: uniqIds, check: check, total: uniq.length };
  }

  function pendingCount(items, adds) {
    var n = 0;
    (items || []).forEach(function (it) { it.issues.forEach(function (i) { if (i.on !== i.def) n++; }); if (it.de !== it.defDe) n++; });
    return n + (adds || []).filter(function (a) { return a && a.s && a.loi; }).length;
  }
  // So "đề xuất đang hiển thị" với "quyết định cuối" khi người kiểm chốt; trả số chỉnh sửa đã ghi nhớ
  function learnFromCommit(L, items, adds) {
    var n = 0, now = new Date().toISOString().slice(0, 10);
    (items || []).forEach(function (it) {
      it.issues.forEach(function (i) {
        if (i.on === i.def) return;
        n++;
        if (i.user) { if (!i.on) delete L.add[it.s]; return; }
        var r = own(L.rules, i.key); if (!isObj(r)) r = L.rules[i.key] = { pos: 0, neg: 0 };
        r.pos = cnt(r.pos); r.neg = cnt(r.neg);
        if (i.on) r.pos++; else r.neg++;
        r.text = i.text; r.ex = it.s; r.t = now;
      });
      if (it.de !== it.defDe) { n++; L.de[it.s] = { de: str(it.de), t: now }; }
    });
    (adds || []).forEach(function (a) { if (!a || !a.s || !a.loi) return; n++; L.add[a.s] = { loi: str(a.loi), de: str(a.de), t: now }; });
    return n;
  }

  function learnSummary(L) {
    var out = [];
    Object.keys(L.rules).forEach(function (k) { var r = L.rules[k]; out.push({ type: 'rule', key: k, loai: k.split('|')[0], text: r.text || k, kl: verdict(r) || '—', pos: cnt(r.pos), neg: cnt(r.neg), ex: r.ex || '', t: r.t || '' }); });
    Object.keys(L.de).forEach(function (s) { out.push({ type: 'de', key: s, loai: 'Đề xuất', text: '✎ ' + L.de[s].de, kl: 'DÙNG', pos: 1, neg: 0, ex: s, t: L.de[s].t || '' }); });
    Object.keys(L.add).forEach(function (s) { out.push({ type: 'add', key: s, loai: 'Thêm lỗi', text: L.add[s].loi, kl: 'BÁO', pos: 1, neg: 0, ex: s, t: L.add[s].t || '' }); });
    return out;
  }
  function forget(L, type, key) { if (type === 'rule') delete L.rules[key]; else if (type === 'de') delete L.de[key]; else if (type === 'add') delete L.add[key]; }
  function mergeLearn(L, L2) { ['rules', 'de', 'add'].forEach(function (k) { Object.keys(L2[k]).forEach(function (x) { L[k][x] = L2[k][x]; }); }); }

  /* ---------- gợi ý kiểm ảnh theo hạng mục ---------- */
  var HINTS = [
    [/duy trì trạm/i, 'Biển tủ: tên + số PE đúng; phần nguyên chỉ số công tơ = số ở mô tả (lệch ±1). "Không có điện kế" → ảnh phải cho thấy đúng vậy'],
    [/bóng|chấn lưu|kích|tụ|driver/i, 'Thiết bị cũ → thiết bị mới; ảnh hoàn thành đèn sáng (chụp ban ngày đèn tắt thì không kết luận sai)'],
    [/sơn|tẩy rỉ/i, 'Trước rỉ/cũ → sau sơn mới, cùng một trụ'],
    [/vệ sinh/i, 'Chóa trước bẩn → sau sạch'],
    [/băng rôn/i, 'Trước có băng rôn → sau không còn'],
    [/phát quang|cây/i, 'Trước cây che đèn → sau đã cắt'],
    [/rcbo|rccb|mcb|contactor|modem|3g|4g|cb\b/i, 'Thiết bị trong tủ/cửa trụ trước – sau; thiết bị mới; biên bản nếu mô tả có nhắc'],
    [/hộp nối/i, 'Hộp nối mới lắp kín nước'],
    [/lắp|tháo|cần đèn|bộ đèn/i, 'Có/không bộ đèn (cần đèn) trước – sau']
  ];
  var COMMON = 'Kiểm: tên tủ + số PE trên biển, hạng mục, ngày chụp, số trụ trên dải chữ; toạ độ ảnh ≤50 m (toạ độ CV ghi trễ → CẦN XEM); ảnh Hoàn thành không phải chụp ở tủ khác';
  function hint(work) { for (var i = 0; i < HINTS.length; i++) if (HINTS[i][0].test(work || '')) return HINTS[i][1]; return 'Ảnh trước – sau cùng vị trí, thể hiện đúng loại việc'; }

  /* ---------- dữ liệu xuất ---------- */
  var KL = ['KHỚP', 'KHÔNG KHỚP', 'CẦN XEM', 'KHÔNG ĐỌC ĐƯỢC'];
  function buildExport(o) {
    var by = new Map(); (o.rows || []).forEach(function (r) { by.set(String(r.Id), r); });
    function cv(id) { var r = by.get(String(id)) || {}; var c = r.Cabinet || {}; return [isNaN(+id) || String(+id) !== String(id) ? String(id) : +id, dmy(r._day || ymd(r.CreatedAt)), str(c.BoxName), r._work || workName(r), str(r.Description).trim()]; }
    function quanOf(id) { var r = by.get(String(id)) || {}; return str((r.Cabinet || {}).District); }
    var CT = [];
    (o.spell || []).forEach(function (it) {
      var on = it.issues.filter(function (i) { return i.on; }); if (!on.length) return;
      var lv = on.some(function (i) { return i.kind === 'L'; }) ? 'Lỗi' : 'Chuẩn hoá';
      var src = on.some(function (i) { return i.user; }) ? 'Người kiểm' : (it.deLearned || on.some(function (i) { return i.learned; }) ? 'Bộ lọc + 📚 đã học' : 'Bộ lọc');
      CT.push([CT.length + 1, lv, it.s, it.n, it.ids.slice(0, 15).join(' '), on.map(function (i) { return i.text; }).join('; '), it.de, src]);
    });
    var kq = o.kq || {};
    var ANH = Object.keys(kq).filter(function (id) { return isObj(kq[id]) && KL.indexOf(kq[id].kl) >= 0 && by.has(String(id)); }).map(function (id) { return cv(id).concat([kq[id].kl, str(kq[id].ct), quanOf(id)]); });
    var DL = (o.auto || []).map(function (a) { return cv(a.id).concat([a.loai, a.ct, quanOf(a.id)]); });
    var loi = CT.filter(function (r) { return r[1] === 'Lỗi'; });
    var count = function (arr, col) { var m = dict(); arr.forEach(function (r) { m[r[col]] = (m[r[col]] || 0) + 1; }); return m; };
    var kl = count(ANH, 5), dl = count(DL, 5);
    var TONG = [['KẾT QUẢ KIỂM TRA MÔ TẢ & ẢNH CÔNG VIỆC DUY TU'], [o.quan + ' — chính tả: toàn bộ khoảng lọc (' + (o.rows || []).length + ' CV); ảnh: ngày ' + dmy(o.day) + ' (' + (o.list || []).length + ' CV)'], [],
      ['1. Chính tả cột Mô tả'], ['Số mô tả khác nhau đã soát', o.totalDesc || 0], ['Mô tả có lỗi', loi.length], ['Số CV mang mô tả lỗi', loi.reduce(function (a, r) { return a + r[3]; }, 0)], ['Mô tả cần chuẩn hoá', CT.length - loi.length], [],
      ['2. Đối chiếu ảnh – mô tả (ngày ' + dmy(o.day) + ')'], ['Đã xem', ANH.length + ' / ' + (o.list || []).length]]
      .concat(KL.filter(function (k) { return kl[k]; }).map(function (k) { return [k, kl[k]]; }))
      .concat([[], ['3. Kiểm tra tự động']]).concat(Object.keys(dl).length ? Object.keys(dl).map(function (k) { return [k, dl[k]]; }) : [['Không phát hiện', 0]]);
    return { CT: CT, ANH: ANH, DL: DL, TONG: TONG };
  }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').replace(/[^A-Za-z0-9]/g, '') || 'Quan'; }
  function validKq(o) { var out = {}; if (!isObj(o)) return out; Object.keys(o).forEach(function (k) { var v = o[k]; if (isObj(v) && KL.indexOf(v.kl) >= 0) out[k] = { kl: v.kl, ct: str(v.ct).slice(0, 2000) }; }); return out; }


  /* ---------- GHI MÔ TẢ VÀO SMARTHCM ---------- */
  function normDesc(x) { return str(x).replace(/\s+/g, ' ').trim(); }
  function cleanNew(x) { return str(x).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000); }
  function defaultSel(it) { return !!it && it.issues.some(function (i) { return i.on && i.kind === 'L'; }); }
  function editable(r) { return r && Number(r.StatusId) === 0; }
  // items: danh sách chính tả (có .sel); rows: dữ liệu lưới MỚI NHẤT
  // rejected: { Id: {msg, pole} } — CV máy chủ đã từ chối; bỏ qua khi Trụ của CV chưa đổi
  function poleOf(r) { return r && r.PoleId != null && r.PoleId !== '' ? r.PoleId : null; }
  function isRejected(rejected, r) { var x = rejected && own(rejected, String(r.Id)); return !!x && x.pole === poleOf(r); }
  function writePlan(items, rows, rejected) {
    var by = new Map((rows || []).map(function (r) { return [String(r.Id), r]; }));
    var out = { entries: [], locked: [], changed: [], missing: [], rejected: [] };
    (items || []).forEach(function (it) {
      if (!it.sel) return; var nv = cleanNew(it.de); if (!nv || nv === it.s) return;
      it.ids.forEach(function (id) {
        var r = by.get(String(id)); if (!r) { out.missing.push(id); return; }
        if (normDesc(r.Description) !== it.s) { out.changed.push(r.Id); return; }
        if (!editable(r)) { out.locked.push(r.Id); return; }
        if (isRejected(rejected, r)) { out.rejected.push(r.Id); return; }
        out.entries.push({ Id: r.Id, StatusId: r.StatusId, CompletedQuantity: r.CompletedQuantity, CabinetId: r.CabinetId, PoleId: poleOf(r), old: str(r.Description), new: nv });
      });
    });
    return out;
  }
  function rejectedCount(it, rows, rejected) { var by = new Map((rows || []).map(function (r) { return [String(r.Id), r]; })); return it.ids.filter(function (id) { var r = by.get(String(id)); return r && editable(r) && isRejected(rejected, r); }).length; }
  // Gửi thêm PoleId hiện có (không đổi) — dùng khi máy chủ báo "cần cung cấp thông tin Trụ"
  function toMaintTaskPole(e) { var o = toMaintTask(e); if (e.PoleId != null) o.PoleId = e.PoleId; return o; }
  function needPole(msg) { return /thông tin\s*trụ/i.test(str(msg)); }
  function parseRejected(txt) { var o; try { o = typeof txt === 'string' ? JSON.parse(txt) : txt; } catch (e) { return dict(); } var out = dict(); if (!isObj(o)) return out; Object.keys(o).forEach(function (k) { var v = o[k]; if (isObj(v) && typeof v.msg === 'string') out[k] = { msg: v.msg.slice(0, 300), pole: v.pole == null ? null : v.pole, at: str(v.at).slice(0, 30) }; }); return out; }
  function lockedCount(it, rows) { var by = new Map((rows || []).map(function (r) { return [String(r.Id), r]; })); return it.ids.filter(function (id) { return !editable(by.get(String(id))); }).length; }
  function toMaintTask(e) { return { Id: e.Id, StatusId: e.StatusId, CompletedQuantity: e.CompletedQuantity, Description: e.new, CabinetId: e.CabinetId, __type: 'LBCS.Core.MaintTask' }; }
  function chunk(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
  function verifyWrite(entries, rows) {
    var by = new Map((rows || []).map(function (r) { return [String(r.Id), r]; })), o = { ok: [], fail: [] };
    (entries || []).forEach(function (e) { var r = by.get(String(e.Id)); if (r && normDesc(r.Description) === normDesc(e.new)) o.ok.push(e.Id); else o.fail.push(e.Id); });
    return o;
  }
  function writeLog(entries, meta) { meta = meta || {}; return { v: 1, tool: 'kiem-tra-mo-ta-anh', quan: str(meta.quan), at: str(meta.at), entries: (entries || []).map(function (e) { return { Id: e.Id, StatusId: e.StatusId, CompletedQuantity: e.CompletedQuantity, CabinetId: e.CabinetId, old: e.old, new: e.new }; }) }; }
  // Hoàn tác: ghi lại mô tả cũ cho CV còn đúng mô tả mới và còn sửa được
  function undoPlan(log, rows) {
    var out = { entries: [], locked: [], changed: [], missing: [] };
    if (!log || !Array.isArray(log.entries)) return out;
    var by = new Map((rows || []).map(function (r) { return [String(r.Id), r]; }));
    log.entries.forEach(function (e) {
      if (!e || e.Id == null || typeof e.old !== 'string' || typeof e.new !== 'string') return;
      var r = by.get(String(e.Id)); if (!r) { out.missing.push(e.Id); return; }
      if (normDesc(r.Description) !== normDesc(e.new)) { out.changed.push(r.Id); return; }
      if (!editable(r)) { out.locked.push(r.Id); return; }
      out.entries.push({ Id: r.Id, StatusId: r.StatusId, CompletedQuantity: r.CompletedQuantity, CabinetId: r.CabinetId, old: str(r.Description), new: e.old });
    });
    return out;
  }
  return { dt: dt, ymd: ymd, dmy: dmy, pad2: pad2, workName: workName, prep: prep, isNum: isNum, num: num, autoChecks: autoChecks,
    bd: bd, lev: lev, buildChecker: buildChecker, EXTRA: EXTRA, spellList: spellList, emptyLearn: emptyLearn, parseLearn: parseLearn,
    serializeLearn: serializeLearn, learnFromCommit: learnFromCommit, pendingCount: pendingCount, learnSummary: learnSummary, forget: forget, mergeLearn: mergeLearn, verdict: verdict,
    hint: hint, COMMON: COMMON, KL: KL, buildExport: buildExport, slug: slug, validKq: validKq,
    normDesc: normDesc, defaultSel: defaultSel, editable: editable, writePlan: writePlan, lockedCount: lockedCount, toMaintTask: toMaintTask, toMaintTaskPole: toMaintTaskPole, needPole: needPole, parseRejected: parseRejected, rejectedCount: rejectedCount, poleOf: poleOf, chunk: chunk, verifyWrite: verifyWrite, writeLog: writeLog, undoPlan: undoPlan };
})();


// ===== Ghi file .xlsx tối giản (không thư viện ngoài): zip "store" + CRC32, có màu, cố định dòng, bộ lọc =====
var KTXLSX = (function () {
  'use strict';
  var enc = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : new (require('util').TextEncoder)();
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(files) { // files: [{name, data:Uint8Array}]
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(sz), u32(sz), u16(nm.length), u16(0));
      parts.push(new Uint8Array(lh), nm, f.data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(sz), u32(sz), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += lh.length + nm.length + sz;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(off), u16(0)));
    var all = parts.concat(central, [end]), len = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  function esc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  var COLOR_XF = { 'Lỗi': 3, 'KHÔNG KHỚP': 3, 'Chuẩn hoá': 4, 'CẦN XEM': 4, 'KHỚP': 5, 'KHÔNG ĐỌC ĐƯỢC': 6 };
  function cell(ref, v, xf) {
    if (v === null || v === undefined || v === '') return '<c r="' + ref + '" s="' + xf + '"/>';
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + xf + '"><v>' + v + '</v></c>';
    v = String(v); if (v.length > 32000) v = v.slice(0, 32000) + ' …(cắt bớt)';
    return '<c r="' + ref + '" s="' + xf + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
  }
  function sheetXml(sh) {
    var rows = [], hasHead = !!sh.head, all = hasHead ? [sh.head].concat(sh.rows || []) : (sh.rows || []);
    var maxC = all.reduce(function (a, r) { return Math.max(a, (r || []).length); }, 1);
    all.forEach(function (r, ri) {
      var cs = (r || []).map(function (v, ci) {
        var xf;
        if (hasHead && ri === 0) xf = 1;
        else if (sh.title) xf = ri === 0 ? 7 : (ci === 0 && /^\d\. /.test(String(v)) ? 8 : 0);
        else xf = (sh.colorCol === ci && COLOR_XF[v]) || 2;
        return cell(col(ci) + (ri + 1), v, xf);
      }).join('');
      rows.push('<row r="' + (ri + 1) + '">' + cs + '</row>');
    });
    var view = hasHead ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    var cols = (sh.widths || []).length ? '<cols>' + sh.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
    var af = hasHead ? '<autoFilter ref="A1:' + col(maxC - 1) + Math.max(all.length, 1) + '"/>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + view + '<sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + rows.join('') + '</sheetData>' + af + '</worksheet>';
  }
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>'
    + '<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + ['1F4E78', 'F8D7DA', 'FFF3CD', 'D1E7DD', 'E2E3E5'].map(function (c) { return '<fill><patternFill patternType="solid"><fgColor rgb="FF' + c + '"/><bgColor indexed="64"/></patternFill></fill>'; }).join('') + '</fills>'
    + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>' + ['left', 'right', 'top', 'bottom'].map(function (s) { return '<' + s + ' style="thin"><color rgb="FFBFBFBF"/></' + s + '>'; }).join('') + '<diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
    + [0, 3, 4, 5, 6].map(function (f) { return '<xf numFmtId="0" fontId="0" fillId="' + f + '" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'; }).join('')
    + '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function sname(n) { return String(n).replace(/[\\\/?*\[\]:]/g, '_').slice(0, 31) || 'Sheet'; }
  function build(sheets) {
    var S = function (s) { return enc.encode(s); }, H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    var files = [
      { name: '[Content_Types].xml', data: S(H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>') },
      { name: '_rels/.rels', data: S(H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: S(H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + esc(sname(s.name)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>'
        + '<definedNames>' + sheets.map(function (s, i) { if (!s.head) return ''; var mc = (s.head || []).length; return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(sname(s.name).replace(/'/g, "''")) + '\'!$A$1:$' + col(mc - 1) + '$' + Math.max((s.rows || []).length + 1, 1) + '</definedName>'; }).join('') + '</definedNames></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: S(H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
      { name: 'xl/styles.xml', data: S(STYLES) }
    ];
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: S(sheetXml(s)) }); });
    return zip(files);
  }
  return { build: build, crc32: crc32 };
})();


// ===== GIAO DIỆN (phương án A: panel gọn + bảng lớn + màn xem ảnh) =====
(function () {
  'use strict';
  if (!/\/Maintenance\/TaskListNew/i.test(location.pathname)) return;
  if (document.getElementById('ktma-root')) return;
  var C = KTCORE, X = KTXLSX, VER = (typeof KT_VERSION !== 'undefined' ? KT_VERSION : 'dev');
  var DISTRICTS = [{ id: 1, name: 'Quận 1' }, { id: 3, name: 'Quận 3' }, { id: 5, name: 'Quận 5' }, { id: 8, name: 'Quận 8' }, { id: 10, name: 'Quận 10' }, { id: 11, name: 'Quận 11' }, { id: 14, name: 'Quận Bình Thạnh' }, { id: 16, name: 'Quận Phú Nhuận' }];
  var CDN = 'https://cdn.smartiot.city/mainttasks/';
  var LKEY = 'ktma_learn_v1';

  /* ---------- tiện ích ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function nf(n) { return Number(n || 0).toLocaleString('vi-VN'); }

  /* ---------- trạng thái ---------- */
  var S = { rej: C.parseRejected(lsGet('ktma_reject_v1')), sel: new Map(), written: {}, mode: 'cur', rows: [], quan: '', auto: [], sp: null, adds: [], day: '', days: [], list: [], kq: {}, idx: 0, learn: C.parseLearn(lsGet(LKEY)), range: '' };
  function saveLearn() { lsSet(LKEY, C.serializeLearn(S.learn)); }
  function kqKey() { return 'ktma_kq_v1|' + S.quan + '|' + S.day; }
  function saveKq() { lsSet(kqKey(), JSON.stringify(S.kq)); }
  function loadKq() { try { S.kq = C.validKq(JSON.parse(lsGet(kqKey()) || '{}')); } catch (e) { S.kq = {}; } }

  /* ---------- CSS ---------- */
  var css = [
    '#ktma-root{--k-brand:#1f3864;--k-acc:#0d9488;--k-bg:#fff;--k-bg2:#f4f6f9;--k-line:#e3e7ee;--k-txt:#1f2937;--k-mut:#6b7280;--k-sh:0 10px 30px rgba(15,23,42,.18),0 2px 6px rgba(15,23,42,.08);font:13px/1.45 "Segoe UI",Inter,Arial,sans-serif;color:var(--k-txt)}',
    '@media (prefers-color-scheme:dark){#ktma-root{--k-bg:#141a23;--k-bg2:#1d2533;--k-line:#2c3646;--k-txt:#e5e7eb;--k-mut:#9aa4b2;--k-brand:#3b6fd1}}',
    '#ktma-root *{box-sizing:border-box}',
    '#ktma-root button{font:inherit;cursor:pointer;border:0;border-radius:8px;padding:8px 12px;font-weight:600;transition:filter .15s,transform .05s}',
    '#ktma-root button:hover{filter:brightness(1.08)}#ktma-root button:active{transform:translateY(1px)}#ktma-root button:disabled{opacity:.55;cursor:not-allowed}',
    '#ktma-root button:focus-visible,#ktma-root input:focus-visible,#ktma-root [contenteditable]:focus-visible{outline:2px solid #60a5fa;outline-offset:1px}',
    '.k-pri{background:var(--k-brand);color:#fff}.k-acc{background:var(--k-acc);color:#fff}.k-gh{background:var(--k-bg);color:var(--k-txt);border:1px solid var(--k-line)!important}',
    '#ktma-pn{position:fixed;right:16px;bottom:16px;width:360px;max-width:95vw;z-index:2147483000;background:var(--k-bg);border-radius:12px;box-shadow:var(--k-sh);overflow:hidden}',
    '#ktma-pn .hd{background:var(--k-brand);color:#fff;padding:9px 12px;font-weight:600;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none}',
    '#ktma-pn .hd span.ic{cursor:pointer;padding:0 4px;opacity:.9}#ktma-pn.min .bd{display:none}',
    '#ktma-pn .bd{padding:12px;display:grid;gap:10px}',
    '.k-seg{display:flex;background:var(--k-bg2);border-radius:8px;padding:3px}.k-seg button{flex:1;background:transparent;color:var(--k-mut);padding:6px}.k-seg button.on{background:var(--k-bg);color:var(--k-brand);box-shadow:0 1px 3px rgba(0,0,0,.12)}',
    '.k-k3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.k-kpi{background:var(--k-bg2);border-radius:10px;padding:7px 9px}.k-kpi b{display:block;font-size:19px}.k-kpi span{color:var(--k-mut);font-size:11.5px}',
    '.k-row2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.k-st{color:var(--k-mut);font-size:12px;white-space:pre-wrap}',
    '.k-links{display:flex;gap:10px;font-size:12px}.k-links a{color:var(--k-brand);cursor:pointer;text-decoration:none;font-weight:600}',
    '.k-day{display:flex;gap:6px;align-items:center}.k-day input{flex:1;padding:6px 8px;border:1px solid var(--k-line);border-radius:8px;background:var(--k-bg);color:var(--k-txt);font:inherit}',
    '#ktma-res{position:fixed;left:3vw;top:4vh;right:400px;bottom:4vh;z-index:2147482999;background:var(--k-bg);border-radius:12px;box-shadow:var(--k-sh);display:flex;flex-direction:column;overflow:hidden}',
    '@media (max-width:1100px){#ktma-res{left:2vw;right:2vw;top:2vh;bottom:2vh}}',
    '#ktma-res .top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--k-line);flex-wrap:wrap}',
    '.k-tabs{display:flex;gap:4px;flex-wrap:wrap}.k-tabs button{background:transparent;color:var(--k-mut)}.k-tabs button.on{background:var(--k-brand);color:#fff}',
    '#ktma-res .body{flex:1;overflow:auto;padding:0 14px 14px}',
    '#ktma-res .tools{display:flex;gap:8px;align-items:center;padding:10px 0;position:sticky;top:0;background:var(--k-bg);z-index:2}',
    '#ktma-res .tools input{flex:1;max-width:360px;padding:7px 10px;border:1px solid var(--k-line);border-radius:8px;background:var(--k-bg);color:var(--k-txt);font:inherit}',
    '#ktma-root table{border-collapse:collapse;width:100%}#ktma-root th{background:var(--k-bg2);text-align:left;font-size:12px;color:var(--k-mut);padding:7px 8px;border-bottom:1px solid var(--k-line);position:sticky;top:46px;z-index:1}',
    '#ktma-root td{padding:7px 8px;border-bottom:1px solid var(--k-line);vertical-align:top}#ktma-root tr.clk{cursor:pointer}#ktma-root tr.clk:hover td{background:var(--k-bg2)}',
    '.k-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;margin:1px 3px 2px 0;cursor:pointer;user-select:none}',
    '.k-L{background:#fde2e4;color:#b02a37}.k-C{background:#fff3cd;color:#8a5a00}.k-off{background:#e9ecef;color:#868e96;text-decoration:line-through}.k-lr{display:block;font-size:11px;color:#4f46e5;margin-top:2px}',
    '.k-ok{background:#d1e7dd;color:#0f5132}.k-bad{background:#fde2e4;color:#b02a37}.k-warn{background:#fff3cd;color:#8a5a00}.k-gray{background:#e9ecef;color:#495057}',
    '.k-de{color:#198754;font-weight:600;outline:none;border-radius:6px;padding:2px 4px;min-width:120px;display:block}.k-de:hover{background:var(--k-bg2)}.k-de.ed{color:#0d6efd}',
    '.k-empty{padding:40px;text-align:center;color:var(--k-mut)}',
    '#ktma-md th{top:0}',
    '.k-wbar{position:sticky;bottom:0;display:flex;align-items:center;gap:10px;padding:10px 12px;margin:8px -14px -14px;border-top:1px solid var(--k-line);background:#fff7ed;color:#7c2d12;z-index:2;flex-wrap:wrap}',
    '@media (prefers-color-scheme:dark){.k-wbar{background:#2a1d10;color:#fed7aa}}',
    '.k-wr{background:#b45309;color:#fff}.k-lk{background:#e9ecef;color:#6c757d}.k-done{background:#d1e7dd;color:#0f5132}',
    '#ktma-root input[type=checkbox]{width:16px;height:16px;accent-color:#b45309;cursor:pointer}',
    '.k-old{color:#b02a37;text-decoration:line-through}.k-new{color:#198754;font-weight:600}',
    '#ktma-root button.k-ed{padding:2px 8px;font-size:12px;margin-left:6px;white-space:nowrap}',
    '#ktma-pop{position:fixed;z-index:2147483100;background:var(--k-bg);color:var(--k-txt);border:1px solid var(--k-line);border-radius:10px;box-shadow:var(--k-sh);padding:8px;max-height:320px;overflow:auto;min-width:260px}',
    '#ktma-pop .t{font-size:12px;color:var(--k-mut);margin:0 4px 6px}#ktma-pop button{display:flex;width:100%;justify-content:space-between;gap:8px;margin:2px 0;padding:6px 10px;background:var(--k-bg2);color:var(--k-txt)}',
    '#ktma-root.k-hold #ktma-res,#ktma-root.k-hold #ktma-pn,body.ktma-hold #lksc,body.ktma-hold #bcdt{display:none!important}',
    '#ktma-rv{position:fixed;inset:0;z-index:2147483600;background:#0f141b;color:#e5e7eb;display:flex;flex-direction:column}',
    '#ktma-rv .rh{padding:10px 16px;display:grid;grid-template-columns:1fr auto;gap:8px;border-bottom:1px solid #263040;line-height:1.45}',
    '#ktma-rv .im{flex:1;display:flex;gap:8px;padding:8px;min-height:0}#ktma-rv .im figure{flex:1;margin:0;min-width:0;display:flex;flex-direction:column;background:#000;border-radius:8px;overflow:hidden;cursor:zoom-in}',
    '#ktma-rv .im figcaption{color:#ffd54f;font-weight:600;padding:4px 8px}#ktma-rv .im img{flex:1;min-height:0;width:100%;object-fit:contain}',
    '#ktma-rv .im .na{flex:1;display:flex;align-items:center;justify-content:center;color:#9ca3af}',
    '#ktma-rv .big{position:absolute;inset:0;background:#000;display:none;z-index:3;overflow:hidden;cursor:zoom-in}#ktma-rv .big.on{display:block}#ktma-rv .big img{width:100%;height:100%;object-fit:contain;transition:transform .15s}#ktma-rv .big.z img{transform:scale(2.4);cursor:zoom-out}',
    '#ktma-rv .big .cap{position:absolute;top:8px;left:12px;color:#ffd54f;font-weight:700;background:rgba(0,0,0,.5);padding:2px 8px;border-radius:6px}',
    '#ktma-rv .ft{display:flex;gap:8px;align-items:center;padding:10px 16px;border-top:1px solid #263040;flex-wrap:wrap}',
    '#ktma-rv .ft button{color:#fff;padding:9px 14px}#ktma-rv .ft .sel{box-shadow:0 0 0 3px #fff inset}',
    '#ktma-rv .ft input{flex:1;min-width:200px;padding:9px;border-radius:8px;border:1px solid #374151;background:#111827;color:#fff;font:inherit}',
    '#ktma-rv a{color:#80deea}#ktma-rv .nav{background:#263040;color:#fff}',
    '#ktma-md{position:fixed;inset:0;z-index:2147483700;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center}',
    '#ktma-md .box{background:var(--k-bg);color:var(--k-txt);width:min(980px,94vw);max-height:86vh;border-radius:12px;box-shadow:var(--k-sh);display:flex;flex-direction:column;overflow:hidden}',
    '#ktma-md .box .top{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--k-line);gap:8px;flex-wrap:wrap}#ktma-md .box .body{overflow:auto;padding:0 14px 14px}',
    '#ktma-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483800;background:#111827;color:#fff;padding:10px 16px;border-radius:10px;box-shadow:var(--k-sh);font-weight:600;transition:opacity .25s}',
    '@media (prefers-reduced-motion:reduce){#ktma-root *{transition:none!important}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var root = document.createElement('div'); root.id = 'ktma-root'; document.body.appendChild(root);

  function toast(msg) { var t = $('#ktma-toast'); if (t) t.remove(); t = document.createElement('div'); t.id = 'ktma-toast'; t.setAttribute('role', 'status'); t.textContent = msg; root.appendChild(t); setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 2800); }

  /* ---------- PANEL ---------- */
  var pn = document.createElement('div'); pn.id = 'ktma-pn'; pn.setAttribute('role', 'dialog'); pn.setAttribute('aria-label', 'Kiểm tra mô tả và ảnh');
  pn.innerHTML = '<div class="hd"><span>🔍 Kiểm tra mô tả &amp; ảnh</span><span><span class="ic" data-a="min" title="Thu gọn">—</span><span class="ic" data-a="close" title="Đóng">✕</span></span></div>'
    + '<div class="bd"><div class="k-seg" role="tablist"><button class="on" data-m="cur">Quận đang lọc</button><button data-m="all">Toàn KVTT (8 quận)</button></div>'
    + '<button class="k-pri" data-a="run">1) Chạy kiểm tra</button>'
    + '<div class="k-k3"><div class="k-kpi"><b id="ktma-k1">–</b><span>mô tả lỗi</span></div><div class="k-kpi"><b id="ktma-k2">–</b><span>lỗi dữ liệu</span></div><div class="k-kpi"><b id="ktma-k3">–</b><span>ảnh đã xem</span></div></div>'
    + '<div class="k-day"><span>Ngày xem ảnh</span><input type="date" id="ktma-day" disabled aria-label="Ngày xem ảnh"></div>'
    + '<div class="k-row2"><button class="k-acc" data-a="review" disabled>2) Xem ảnh</button><button class="k-gh" data-a="xlsx" disabled>3) Xuất Excel</button></div>'
    + '<div class="k-links"><a data-a="res">Bảng kết quả</a><a data-a="learn">📚 Đã học (<span id="ktma-nl">0</span>)</a><a data-a="fb">Góp ý</a><span style="margin-left:auto;color:var(--k-mut)">v' + esc(VER) + '</span></div>'
    + '<div class="k-st" id="ktma-st">Lọc quận + khoảng thời gian trên trang rồi bấm "Chạy kiểm tra". Công cụ chỉ ghi mô tả khi anh chọn và xác nhận.</div></div>';
  root.appendChild(pn);
  function stat(t) { $('#ktma-st').textContent = t; }
  function nLearn() { $('#ktma-nl').textContent = C.learnSummary(S.learn).length; }
  nLearn();
  (function drag() { var hd = $('.hd', pn), sx, sy, ox, oy, on = false; hd.addEventListener('mousedown', function (e) { if (e.target.classList.contains('ic')) return; on = true; sx = e.clientX; sy = e.clientY; var r = pn.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); }); document.addEventListener('mousemove', function (e) { if (!on) return; pn.style.left = (ox + e.clientX - sx) + 'px'; pn.style.top = (oy + e.clientY - sy) + 'px'; pn.style.right = 'auto'; pn.style.bottom = 'auto'; }); document.addEventListener('mouseup', function () { on = false; }); })();

  $$('.k-seg button', pn).forEach(function (b) { b.onclick = function () { $$('.k-seg button', pn).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); S.mode = b.dataset.m; }; });
  pn.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) return;
    var act = a.dataset.a;
    if (act === 'min') pn.classList.toggle('min');
    else if (act === 'close') { root.remove(); st.remove(); }
    else if (act === 'run') run();
    else if (act === 'review') openReview(firstUnread());
    else if (act === 'xlsx') exportXlsx();
    else if (act === 'res') openRes('ct');
    else if (act === 'learn') openLearn();
    else if (act === 'fb') feedback();
  });
  $('#ktma-day').onchange = function () { setDay(this.value); };

  function kpis() {
    if (!S.sp) return;
    var loi = S.sp.items.filter(function (it) { return it.issues.some(function (i) { return i.on; }); }).length;
    $('#ktma-k1').textContent = nf(loi); $('#ktma-k2').textContent = nf(S.auto.length);
    var seen = S.list.filter(function (r) { return S.kq[r.Id]; }).length;
    $('#ktma-k3').textContent = seen + '/' + S.list.length;
    var rv = $('[data-a=review]', pn); rv.disabled = !S.list.length; rv.textContent = '2) Xem ảnh ' + (S.day ? C.dmy(S.day).slice(0, 5) : '');
    $('[data-a=xlsx]', pn).disabled = false;
  }

  /* ---------- NẠP DỮ LIỆU ---------- */
  function gridRows() {
    var g = window.gridOptions; if (!g || !g.api) return null;
    var m = new Map(); g.api.forEachNode(function (n) { if (n.data && n.data.Id != null) m.set(n.data.Id, Object.assign({}, n.data)); });
    var type = g.api.getModel && g.api.getModel().getType ? g.api.getModel().getType() : 'clientSide';
    return { rows: Array.from(m.values()), type: type };
  }
  function pageRange() {
    var txt = $$('input').map(function (i) { return i.value || ''; }).concat([document.body.innerText.slice(0, 4000)]).join(' ');
    var m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return { s: new Date(+m[3], +m[2] - 1, +m[1], 0, 0, 0), e: new Date(+m[6], +m[5] - 1, +m[4], 23, 59, 59), txt: m[0] };
  }
  function listByDistrict(id, s, e) {
    var filter = { Cabinets: {}, Districts: {}, Wards: {}, MaintWorks: {}, IsShowingAllMaintWork: false, StartDate: s.toISOString(), EndDate: e.toISOString() };
    filter.Districts[String(id)] = id; // QUAN TRỌNG: value = mã quận
    return new Promise(function (res) {
      var to = setTimeout(function () { res({ ok: false }); }, 60000);
      var done = function (v) { clearTimeout(to); res(v); };
      try { LBCS.Service.MaintenanceSvc.ListMaintTaskNew(filter, function (d) { done({ ok: true, rows: Array.isArray(d) ? d : [] }); }, function () { done({ ok: false }); }); }
      catch (err) { done({ ok: false }); }
    });
  }
  async function run(quiet) {
    var btn = $('[data-a=run]', pn); btn.disabled = true; var old = btn.textContent; btn.textContent = 'Đang kiểm tra…';
    try {
      var warn = [];
      if (S.mode === 'cur') {
        var g = gridRows();
        if (!g) throw new Error('Không thấy lưới dữ liệu (gridOptions). Mở đúng trang Quản lý công việc duy tu rồi F5.');
        if (g.type !== 'clientSide') warn.push('Lưới phân trang phía máy chủ — chỉ lấy được phần đang tải.');
        if (!g.rows.length) throw new Error('Lưới đang trống. Chọn quận + khoảng thời gian trên trang trước.');
        S.rows = g.rows; S.writable = true;
        S.quan = Array.from(new Set(S.rows.map(function (r) { return (r.Cabinet || {}).District; }).filter(Boolean))).join(', ') || 'Quận đang lọc';
        var rg = pageRange(); S.range = rg ? rg.txt : '';
      } else {
        var rg2 = pageRange(); if (!rg2) throw new Error('Không đọc được khoảng thời gian trên trang (dạng dd/mm/yyyy - dd/mm/yyyy).');
        S.range = rg2.txt; var acc = [], err = [];
        for (var i = 0; i < DISTRICTS.length; i++) {
          stat('Đang lấy ' + DISTRICTS[i].name + ' (' + (i + 1) + '/' + DISTRICTS.length + ')…');
          var r = await listByDistrict(DISTRICTS[i].id, rg2.s, rg2.e);
          if (!r.ok) { err.push(DISTRICTS[i].name); continue; }
          r.rows.forEach(function (x) { x.Cabinet = x.Cabinet || {}; if (!x.Cabinet.District) x.Cabinet.District = DISTRICTS[i].name; acc.push(x); });
        }
        if (err.length) warn.push('Lỗi tải: ' + err.join(', ') + '.');
        S.rows = acc; S.quan = 'Toàn KVTT'; S.writable = false;
        if (!acc.length) throw new Error('Không có công việc trong khoảng ' + S.range + '.');
      }
      var hasImg = S.rows.some(function (r) { return 'Image1' in r || 'Image3' in r; });
      if (!hasImg) warn.push('Dữ liệu không có trường ảnh — bỏ qua kiểm ảnh.');
      stat('Đang soát ' + nf(S.rows.length) + ' công việc…'); await new Promise(function (r) { setTimeout(r, 30); });
      C.prep(S.rows);
      S.auto = C.autoChecks(S.rows, { images: hasImg });
      S.sp = C.spellList(S.rows, S.learn); applySel(); S.adds = [];
      S.days = Array.from(new Set(S.rows.map(function (r) { return r._day; }).filter(Boolean))).sort();
      var di = $('#ktma-day'); di.disabled = !S.days.length; di.min = S.days[0] || ''; di.max = S.days[S.days.length - 1] || '';
      setDay(S.days[S.days.length - 1] || '');
      stat(S.quan + (S.range ? ' · ' + S.range : '') + ' · ' + nf(S.rows.length) + ' CV · ' + nf(S.sp.total) + ' mô tả khác nhau' + (warn.length ? '\n⚠ ' + warn.join(' ') : ''));
      if (quiet && $('#ktma-res')) renderRes(); else openRes('ct');
    } catch (e) { stat('⚠ ' + (e && e.message || e)); }
    btn.disabled = false; btn.textContent = old;
  }
  function setDay(d) {
    S.day = d || ''; $('#ktma-day').value = S.day;
    S.list = S.rows.filter(function (r) { return r._day === S.day; }).sort(function (a, b) { return a._work.localeCompare(b._work) || String(a.Id).localeCompare(String(b.Id), undefined, { numeric: true }); });
    loadKq(); S.idx = 0; kpis(); if ($('#ktma-res')) renderRes();
  }
  function firstUnread() { for (var i = 0; i < S.list.length; i++) if (!S.kq[S.list[i].Id]) return i; return 0; }

  /* ---------- BẢNG KẾT QUẢ ---------- */
  var tab = 'ct', filt = '';
  function openRes(t) {
    if (!S.sp) { stat('Bấm "Chạy kiểm tra" trước.'); return; }
    tab = t || tab; var res = $('#ktma-res');
    if (!res) {
      res = document.createElement('div'); res.id = 'ktma-res'; res.setAttribute('role', 'dialog'); res.setAttribute('aria-label', 'Kết quả kiểm tra');
      res.innerHTML = '<div class="top"><div class="k-tabs"></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="k-gh" data-r="undo" hidden title="Ghi lại mô tả cũ của lần ghi gần nhất">↩ Hoàn tác lần ghi gần nhất</button><button class="k-gh" data-r="commit" title="Lưu các chỉnh sửa của anh để lần sau tự áp">💾 Ghi nhớ chỉnh sửa</button><button class="k-gh" data-r="learn">📚 Đã học</button><button class="k-gh" data-r="close" aria-label="Đóng">✕</button></div></div><div class="body"></div>';
      root.appendChild(res);
      if (window.innerWidth <= 1100) pn.classList.add('min');
      res.addEventListener('click', onResClick);
      res.addEventListener('input', onResInput);
      res.addEventListener('keydown', function (e) { if (e.key === 'Escape') res.remove(); if (e.key === 'Enter' && e.target.classList.contains('k-de')) { e.preventDefault(); e.target.blur(); } });
    }
    renderRes();
  }
  function counts() {
    var loi = S.sp.items.filter(function (it) { return it.issues.some(function (i) { return i.on; }); }).length;
    var seen = S.list.filter(function (r) { return S.kq[r.Id]; }).length;
    return { ct: 'Chính tả (' + loi + ')', anh: 'So ảnh ' + seen + '/' + S.list.length, dl: 'Kiểm tra dữ liệu (' + S.auto.length + ')', kb: 'Không báo (' + S.sp.unflag.length + ')' };
  }
  function renderRes() {
    var res = $('#ktma-res'); if (!res) return; var cn = counts();
    $('.k-tabs', res).innerHTML = ['ct', 'anh', 'dl', 'kb'].map(function (k) { return '<button data-tab="' + k + '" class="' + (tab === k ? 'on' : '') + '">' + esc(cn[k]) + '</button>'; }).join('');
    var b = $('.body', res), f = filt.toLowerCase(), h = '';
    var tools = '<div class="tools"><input id="ktma-f" placeholder="Lọc theo chữ…" value="' + esc(filt) + '" aria-label="Lọc"><span class="k-st">' + esc(S.quan) + (S.range ? ' · ' + esc(S.range) : '') + '</span></div>';
    if (tab === 'ct') {
      var its = S.sp.items.filter(function (it) { return !f || it.s.toLowerCase().indexOf(f) >= 0; });
      var cw = canWrite();
      h = tools + (its.length ? '<table><thead><tr>' + (cw ? '<th title="Chọn để ghi vào SmartHCM">✍</th>' : '') + '<th>#</th><th>Mô tả gốc</th><th>Lỗi <span style="font-weight:400">(bấm để bỏ/bật — báo nhầm thì bỏ)</span></th><th>Đề xuất sửa <span style="font-weight:400">(bấm để sửa)</span></th><th>Số CV</th></tr></thead><tbody>'
        + its.map(function (it) {
          var ix = it._ix;
          var lk = it._lk || 0, rj = it._rj || 0, all = lk + rj >= it.n, chg = C.normDesc(it.de) !== it.s && !!C.normDesc(it.de), wt = S.written[it.s];
          var cb = cw ? '<td><input type="checkbox" data-sel="' + ix + '"' + (it.sel && !all && chg ? ' checked' : '') + (all || !chg ? ' disabled' : '') + ' aria-label="Chọn để ghi" title="' + (all ? (rj ? 'CV đã kiểm tra hoặc cần gắn Trụ trước' : 'Tất cả CV đã kiểm tra — trang khoá') : !chg ? 'Đề xuất giống mô tả gốc' : 'Chọn để ghi vào SmartHCM') + '"></td>' : '';
          return '<tr>' + cb + '<td>' + (ix + 1) + '</td><td>' + esc(it.s) + (wt ? '<span class="k-lr" style="color:#0f5132">✓ đã ghi ' + esc(wt) + '</span>' : '') + '</td><td>' + it.issues.map(function (i, j) {
            return '<span class="k-chip ' + (i.on ? 'k-' + i.kind : 'k-off') + '" data-i="' + ix + '" data-j="' + j + '" role="button" tabindex="0" title="Bấm để ' + (i.on ? 'bỏ (báo nhầm)' : 'bật lại') + '">' + esc(i.text) + '</span>' + (i.learned ? '<span class="k-lr">' + esc(i.learned) + '</span>' : '');
          }).join('') + '</td><td><span class="k-de' + (it.de !== it.defDe ? ' ed' : '') + '" contenteditable="plaintext-only" data-de="' + ix + '" aria-label="Đề xuất sửa">' + esc(it.de) + '</span>' + (it.deLearned ? '<span class="k-lr">📚 đề xuất đã học</span>' : '') + '</td><td>' + it.n + (lk ? ' <span class="k-chip k-lk" title="CV đã kiểm tra — trang không cho sửa">🔒' + (lk >= it.n ? ' đã kiểm tra' : lk) + '</span>' : '') + (rj ? ' <span class="k-chip k-warn" title="SmartHCM từ chối: cần gắn Trụ cho CV trước. Gắn Trụ xong công cụ tự cho ghi lại.">🚫 ' + rj + ' cần gắn Trụ</span>' : '') + (canOpen() ? '<button class="k-gh k-ed" data-ed="' + ix + '" title="Mở hộp Chi tiết công việc của SmartHCM, điền sẵn đề xuất — sửa Mô tả, chọn Trụ rồi bấm Lưu dữ liệu">✎ Sửa</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="k-empty">Không có mô tả bị báo lỗi 🎉</div>') + (cw ? wbar() : '');
    } else if (tab === 'kb') {
      var un = S.sp.unflag.filter(function (s) { return !f || s.toLowerCase().indexOf(f) >= 0; });
      h = tools + '<div class="k-st" style="margin-bottom:6px">Mô tả bộ lọc không báo. Thấy sai (thiếu chữ, gõ nhầm…) thì bấm "+ Báo lỗi" — lần sau công cụ tự báo.</div>'
        + '<table><thead><tr><th>Mô tả</th><th>Số CV</th><th></th></tr></thead><tbody>' + un.slice(0, 1500).map(function (s) {
          var ad = S.adds.find(function (a) { return a.s === s; });
          return '<tr><td>' + esc(s) + (ad ? '<span class="k-lr">➕ ' + esc(ad.loi) + (ad.de ? ' → ' + esc(ad.de) : '') + ' (chưa ghi nhớ)</span>' : '') + '</td><td>' + S.sp.uniqIds[s].length + '</td><td><button class="k-gh" data-add="' + esc(s) + '">+ Báo lỗi</button></td></tr>';
        }).join('') + '</tbody></table>' + (un.length > 1500 ? '<div class="k-st">… còn ' + (un.length - 1500) + ' mô tả, dùng ô lọc để tìm.</div>' : '');
    } else if (tab === 'anh') {
      h = '<div class="tools"><span>Ngày ' + esc(C.dmy(S.day)) + ' · ' + S.list.length + ' CV</span><button class="k-acc" data-r="review">Xem ảnh từ CV chưa xem</button></div>'
        + (S.list.length ? '<table><thead><tr><th>#</th><th>Mã CV</th><th>Tủ</th><th>Hạng mục</th><th>Mô tả</th><th>Kết luận</th><th>Ghi chú</th></tr></thead><tbody>' + S.list.map(function (r, i) {
          var k = S.kq[r.Id] || {}; var cls = { 'KHỚP': 'k-ok', 'KHÔNG KHỚP': 'k-bad', 'CẦN XEM': 'k-warn', 'KHÔNG ĐỌC ĐƯỢC': 'k-gray' }[k.kl] || '';
          return '<tr class="clk" data-rv="' + i + '"><td>' + (i + 1) + '</td><td>' + esc(r.Id) + (r.ParentTaskId ? ' <span class="k-chip k-gray">con</span>' : '') + '</td><td>' + esc((r.Cabinet || {}).BoxName) + '</td><td>' + esc(r._work) + '</td><td>' + esc(r.Description) + '</td><td>' + (k.kl ? '<span class="k-chip ' + cls + '">' + esc(k.kl) + '</span>' : '<span class="k-st">chưa xem</span>') + '</td><td>' + esc(k.ct || '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="k-empty">Ngày này không có công việc.</div>');
    } else {
      var by = new Map(S.rows.map(function (r) { return [String(r.Id), r]; }));
      var dl = S.auto.filter(function (a) { var r = by.get(String(a.id)) || {}; return !f || (a.loai + ' ' + a.ct + ' ' + (r.Description || '')).toLowerCase().indexOf(f) >= 0; });
      h = tools + (dl.length ? '<table><thead><tr><th>Mã CV</th><th>Ngày</th><th>Tủ</th><th>Hạng mục</th><th>Mô tả</th><th>Loại</th><th>Chi tiết</th></tr></thead><tbody>' + dl.map(function (a) {
        var r = by.get(String(a.id)) || {}; return '<tr><td>' + esc(a.id) + '</td><td>' + esc(C.dmy(r._day)) + '</td><td>' + esc((r.Cabinet || {}).BoxName) + '</td><td>' + esc(r._work) + '</td><td>' + esc(r.Description) + '</td><td><span class="k-chip ' + (/CẦN XEM/.test(a.loai) ? 'k-warn' : 'k-bad') + '">' + esc(a.loai) + '</span></td><td>' + esc(a.ct) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="k-empty">Không phát hiện lỗi dữ liệu.</div>');
    }
    b.innerHTML = h;
    var fi = $('#ktma-f', b); if (fi && document.activeElement !== fi && fi.dataset.keep) fi.focus();
  }
  function recomputeDe(it) { var off = new Set(it.issues.filter(function (i) { return !i.on && !i.user; }).map(function (i) { return i.key; })); var d = S.sp.check(it.s, off).de; if (it.de === it.defDe) it.de = d; it.defDe = d; }
  function onResClick(e) {
    var t = e.target;
    var tb = t.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; renderRes(); return; }
    var ch = t.closest('.k-chip[data-i]'); if (ch) { var it = S.sp.items[+ch.dataset.i], is = it.issues[+ch.dataset.j]; is.on = !is.on; if (!it.deLearned) recomputeDe(it); if (!S.sel.has(it.s)) it.sel = C.defaultSel(it); renderRes(); kpis(); return; }
    var eb = t.closest('[data-ed]'); if (eb) { var it3 = S.sp.items[+eb.dataset.ed]; if (it3.ids.length === 1) openDetail(it3.ids[0], it3.de, it3.s); else showPick(eb, it3); return; }
    var sb = t.closest('[data-sel]'); if (sb) { var it2 = S.sp.items[+sb.dataset.sel]; it2.sel = sb.checked; S.sel.set(it2.s, sb.checked); updWbar(); return; }
    var rv = t.closest('[data-rv]'); if (rv) { openReview(+rv.dataset.rv); return; }
    var ad = t.closest('[data-add]'); if (ad) { addErr(ad.dataset.add); return; }
    var r = t.closest('[data-r]'); if (!r) return;
    if (r.dataset.r === 'close') $('#ktma-res').remove();
    else if (r.dataset.r === 'learn') openLearn();
    else if (r.dataset.r === 'commit') commit(true);
    else if (r.dataset.r === 'review') openReview(firstUnread());
    else if (r.dataset.r === 'write') openWrite();
    else if (r.dataset.r === 'undo') openUndo();
  }
  var ft = null;
  function onResInput(e) {
    if (e.target.id === 'ktma-f') { filt = e.target.value; clearTimeout(ft); ft = setTimeout(function () { renderRes(); var fi = $('#ktma-f'); if (fi) { fi.focus(); fi.setSelectionRange(fi.value.length, fi.value.length); } }, 250); return; }
    if (e.target.dataset.de != null) { var it = S.sp.items[+e.target.dataset.de]; it.de = e.target.textContent.replace(/\s+/g, ' ').trim(); e.target.classList.toggle('ed', it.de !== it.defDe); }
  }
  function addErr(s) {
    var loi = prompt('Lỗi của mô tả:\n"' + s + '"\n\n(vd: Thiếu chữ "đường", Gõ nhầm "JTCS")');
    if (!loi || !loi.trim()) return;
    var de = prompt('Đề xuất sửa (có thể bỏ trống):', s);
    S.adds = S.adds.filter(function (a) { return a.s !== s; }); S.adds.push({ s: s, loi: loi.trim(), de: (de || '').trim() });
    renderRes(); toast('Đã thêm. Bấm "💾 Ghi nhớ chỉnh sửa" để lưu.');
  }
  function commit(show) {
    if (!S.sp) return 0;
    var n = C.learnFromCommit(S.learn, S.sp.items, S.adds);
    if (n) { saveLearn(); S.sp = C.spellList(S.rows, S.learn); applySel(); S.adds = []; nLearn(); kpis(); renderRes(); }
    if (show) toast(n ? 'Đã ghi nhớ ' + n + ' chỉnh sửa — lần sau tự áp.' : 'Không có chỉnh sửa mới để ghi nhớ.');
    return n;
  }

  /* ---------- GHI MÔ TẢ VÀO SMARTHCM ---------- */
  var WKEY = 'ktma_lastwrite_v1|';
  function svc() { try { return window.LBCS && LBCS.Service && LBCS.Service.MaintenanceSvc && typeof LBCS.Service.MaintenanceSvc.SaveReviewMaintTask === 'function' ? LBCS.Service.MaintenanceSvc : null; } catch (e) { return null; } }
  function canWrite() { return S.mode === 'cur' && S.writable && !!svc(); }
  function applySel() {
    if (!S.sp) return;
    S.sp.items.forEach(function (it) { it._lk = C.lockedCount(it, S.rows); it._rj = C.rejectedCount(it, S.rows, S.rej); it.sel = it._lk + it._rj >= it.n ? false : (S.sel.has(it.s) ? S.sel.get(it.s) : C.defaultSel(it)); });
    var u = $('[data-r=undo]'); if (u) u.hidden = !(canWrite() && lastLog());
  }
  function selInfo() {
    var n = 0, cv = 0, lk = 0;
    S.sp.items.forEach(function (it) { if (!it.sel) return; var nv = C.normDesc(it.de); if (!nv || nv === it.s) return; var l = (it._lk || 0) + (it._rj || 0); if (l >= it.n) return; n++; cv += it.n - l; lk += (it._lk || 0); });
    return { n: n, cv: cv, lk: lk };
  }
  function wbar() { var i = selInfo(); return '<div class="k-wbar" id="ktma-wbar"><b>Đã chọn ' + i.n + ' mô tả · ' + i.cv + ' CV sẽ ghi</b>' + (i.lk ? '<span>(' + i.lk + ' CV đã kiểm tra bị khoá, bỏ qua)</span>' : '') + '<span style="flex:1"></span><button class="k-wr" data-r="write"' + (i.cv ? '' : ' disabled') + '>✍ Ghi vào SmartHCM (' + i.cv + ' CV)</button></div>'; }
  function updWbar() { var w = $('#ktma-wbar'); if (w) w.outerHTML = wbar(); }
  function lastLog() { try { var o = JSON.parse(lsGet(WKEY + S.quan) || 'null'); return o && Array.isArray(o.entries) && o.entries.length ? o : null; } catch (e) { return null; } }
  function freshGrid() { var g = gridRows(); return g ? g.rows : []; }
  function pendingGridEdits() { try { return typeof rowDataTracker !== 'undefined' && rowDataTracker && Object.keys(rowDataTracker).length > 0; } catch (e) { return false; } }
  function stamp() { var d = new Date(); return d.getFullYear() + '-' + C.pad2(d.getMonth() + 1) + '-' + C.pad2(d.getDate()) + '_' + C.pad2(d.getHours()) + C.pad2(d.getMinutes()); }
  function modal(html) { var md = $('#ktma-md'); if (md) md.remove(); md = document.createElement('div'); md.id = 'ktma-md'; md.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + html + '</div>'; root.appendChild(md); return md; }
  function planHtml(plan, title, btn) {
    var g = new Map(); plan.entries.forEach(function (e) { var k = C.normDesc(e.old) + '\u0000' + e.new; if (!g.has(k)) g.set(k, { o: C.normDesc(e.old), n: e.new, c: 0 }); g.get(k).c++; });
    var notes = []; if (plan.locked.length) notes.push(plan.locked.length + ' CV đã kiểm tra (trang khoá) — bỏ qua'); if (plan.changed.length) notes.push(plan.changed.length + ' CV mô tả đã bị sửa từ lúc kiểm tra — bỏ qua'); if (plan.missing.length) notes.push(plan.missing.length + ' CV không còn trong lưới — bỏ qua'); if (plan.rejected && plan.rejected.length) notes.push(plan.rejected.length + ' CV SmartHCM đã từ chối vì chưa gắn Trụ — bỏ qua (gắn Trụ xong sẽ tự ghi lại được)');
    return '<div class="top"><b>' + esc(title) + '</b><button class="k-gh" data-w="x" aria-label="Đóng">✕</button></div><div class="body">'
      + (g.size ? '<table><thead><tr><th style="width:70px">Số CV</th><th>Mô tả cũ → mô tả mới</th></tr></thead><tbody>' + Array.from(g.values()).map(function (x) { return '<tr><td>' + x.c + '</td><td><span class="k-old">' + esc(x.o) + '</span><br><span class="k-new">' + esc(x.n) + '</span></td></tr>'; }).join('') + '</tbody></table>' : '<div class="k-empty">Không còn CV nào ghi được.</div>')
      + (notes.length ? '<p class="k-st">⚠ ' + esc(notes.join(' · ')) + '</p>' : '')
      + '<p class="k-st" id="ktma-wst">Chỉ đổi cột Mô tả; trạng thái, khối lượng, mã tủ giữ nguyên. Trước khi ghi, công cụ tải file nhật ký để hoàn tác.</p></div>'
      + '<div class="top" style="border-top:1px solid var(--k-line);border-bottom:0;justify-content:flex-end"><button class="k-gh" data-w="x">Huỷ</button><button class="k-wr" data-w="go"' + (plan.entries.length ? '' : ' disabled') + '>' + esc(btn) + ' (' + plan.entries.length + ' CV)</button></div>';
  }
  function openWrite() {
    if (!canWrite()) return;
    if (pendingGridEdits()) { toast('Lưới SmartHCM đang có chỉnh sửa tay chưa bấm Cập nhật — lưu hoặc huỷ trước khi ghi.'); return; }
    var plan = C.writePlan(S.sp.items, freshGrid(), S.rej);
    var md = modal(planHtml(plan, '✍ Xác nhận ghi vào SmartHCM — ' + S.quan, 'Ghi'));
    md.onclick = function (e) { if (e.target === md || e.target.closest('[data-w=x]')) { if (!S.busy) md.remove(); } else if (e.target.closest('[data-w=go]')) doWrite(plan, false); };
  }
  function openUndo() {
    var lg = lastLog(); if (!lg || !canWrite()) { toast('Không có lần ghi nào để hoàn tác.'); return; }
    if (pendingGridEdits()) { toast('Lưới SmartHCM đang có chỉnh sửa tay chưa bấm Cập nhật — lưu hoặc huỷ trước.'); return; }
    var plan = C.undoPlan(lg, freshGrid());
    var md = modal(planHtml(plan, '↩ Hoàn tác lần ghi ' + (lg.at || '') + ' — ' + S.quan, 'Hoàn tác'));
    md.onclick = function (e) { if (e.target === md || e.target.closest('[data-w=x]')) { if (!S.busy) md.remove(); } else if (e.target.closest('[data-w=go]')) doWrite(plan, true); };
  }
  function saveChunk(entries, withPole) {
    return new Promise(function (res) {
      var to = setTimeout(function () { res({ ok: false, msg: 'Hết thời gian chờ máy chủ' }); }, 60000);
      var done = function (v) { clearTimeout(to); res(v); };
      try {
        var tasks = entries.map(function (e) { var o = withPole ? C.toMaintTaskPole(e) : C.toMaintTask(e), mt; try { mt = (window.LBCS && LBCS.Core && typeof LBCS.Core.MaintTask === 'function') ? new LBCS.Core.MaintTask() : {}; } catch (er) { mt = {}; } Object.keys(o).forEach(function (k) { mt[k] = o[k]; }); return mt; });
        svc().SaveReviewMaintTask(tasks, false, function (d) { done(d && d.Code === 1 ? { ok: true } : { ok: false, msg: (d && d.Message) || 'Máy chủ từ chối' }); }, function (er) { done({ ok: false, msg: (er && (er._message || er.message)) || 'Lỗi kết nối' }); });
      } catch (er) { done({ ok: false, msg: String(er && er.message || er) }); }
    });
  }
  function cleanMsg(m) { return String(m || '').replace(/<[^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 300) || 'Máy chủ từ chối'; }
  async function waitGrid(entries) {
    try { if (typeof window.LoadMaintTaskList === 'function') window.LoadMaintTaskList(); } catch (e) { }
    var v = null;
    for (var t = 0; t < 25; t++) { await new Promise(function (r) { setTimeout(r, 1000); }); v = C.verifyWrite(entries, freshGrid()); if (!v.fail.length) break; }
    return v || C.verifyWrite(entries, freshGrid());
  }
  async function doWrite(plan, isUndo) {
    if (S.busy || !plan.entries.length) return; S.busy = true;
    var st = $('#ktma-wst'), go = $('[data-w=go]'); if (go) go.disabled = true;
    var at = stamp(), log = C.writeLog(plan.entries, { quan: S.quan, at: at.replace('_', ' ') });
    dl(new Blob([JSON.stringify(log, null, 1)], { type: 'application/json' }), 'NhatKy_' + (isUndo ? 'HoanTac' : 'SuaMoTa') + '_' + C.slug(S.quan) + '_' + at + '.json');
    var parts = C.chunk(plan.entries, 50), okE = [], errs = [];
    for (var i = 0; i < parts.length; i++) {
      if (st) st.textContent = 'Đang ghi lô ' + (i + 1) + '/' + parts.length + '…';
      var r = await saveChunk(parts[i]);
      if (r.ok) { okE = okE.concat(parts[i]); continue; }
      // Máy chủ từ chối cả lô khi chỉ 1 CV không hợp lệ → ghi lại từng CV để các CV hợp lệ vẫn được lưu
      for (var j = 0; j < parts[i].length; j++) {
        var e1 = parts[i][j];
        if (st) st.textContent = 'Lô ' + (i + 1) + ' bị từ chối — ghi lại từng CV (' + (j + 1) + '/' + parts[i].length + ')…';
        var r1 = parts[i].length === 1 ? r : await saveChunk([e1]);
        if (!r1.ok && C.needPole(cleanMsg(r1.msg)) && e1.PoleId != null) r1 = await saveChunk([e1], true);   // thử gửi kèm Trụ hiện có
        if (r1.ok) { okE.push(e1); delete S.rej[String(e1.Id)]; continue; }
        var m1 = cleanMsg(r1.msg); errs.push({ id: e1.Id, msg: m1 });
        if (C.needPole(m1)) S.rej[String(e1.Id)] = { msg: m1, pole: e1.PoleId == null ? null : e1.PoleId, at: at };
      }
      lsSet('ktma_reject_v1', JSON.stringify(S.rej));
    }
    if (st) st.textContent = 'Đang tải lại lưới và kiểm lại…';
    var v = await waitGrid(okE);
    if (okE.length) lsSet(WKEY + S.quan, JSON.stringify(isUndo ? C.writeLog([], {}) : C.writeLog(okE, { quan: S.quan, at: at.replace('_', ' ') })));
    var hm = at.slice(11, 13) + ':' + at.slice(13, 15);
    if (!isUndo) S.sp.items.forEach(function (it) { if (it.sel && okE.some(function (e) { return C.normDesc(e.old) === it.s; })) S.written[C.normDesc(it.de)] = hm; });
    S.busy = false; var md = $('#ktma-md'); if (md) md.remove();
    var grp = {}; errs.forEach(function (e) { var k = e.msg.replace(/Công việc mã\s*\d+\s*:?\s*/i, '').trim() || e.msg; (grp[k] = grp[k] || []).push(e.id); });
    var errTxt = Object.keys(grp).map(function (k) { return grp[k].length + ' CV không ghi được — ' + k + ' (CV ' + grp[k].slice(0, 20).join(', ') + (grp[k].length > 20 ? '…' : '') + ')'; }).join('\n');
    var msg = (isUndo ? 'Hoàn tác' : 'Đã ghi') + ' ' + v.ok.length + '/' + plan.entries.length + ' CV' + (v.fail.length ? ' · ' + v.fail.length + ' CV chưa thấy đổi trên lưới' : '') + (errs.length ? ' · ' + errs.length + ' CV bị máy chủ từ chối' : '');
    var detail = errTxt;
    await run(true);
    toast(msg); stat(msg + (detail ? '\n⚠ ' + detail : '') + (v.fail.length ? '\nCV cần kiểm lại: ' + v.fail.slice(0, 30).join(', ') : ''));
  }

  /* ---------- SỬA TRONG HỘP "CHI TIẾT CÔNG VIỆC" CỦA TRANG ---------- */
  function canOpen() { try { return S.mode === 'cur' && S.writable && typeof window.LoadMaintTaskDetail === 'function' && window.isUnitManager === true && !!document.getElementById('MaintTaskDetailEdit'); } catch (e) { return false; } }
  function liveNode(id) { var g = window.gridOptions, f = null; try { g.api.forEachNode(function (n) { if (!f && n.data && String(n.data.Id) === String(id)) f = n.data; }); } catch (e) { } return f; }
  function rowById(id) { return S.rows.find(function (r) { return String(r.Id) === String(id); }); }
  function closePick() { var o = $('#ktma-pop'); if (o) o.remove(); document.removeEventListener('mousedown', pickOut, true); document.removeEventListener('keydown', pickKey, true); }
  function pickKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closePick(); } }
  function pickOut(e) { if (!e.target.closest('#ktma-pop')) closePick(); }
  function showPick(btn, it) {
    closePick();
    var pop = document.createElement('div'); pop.id = 'ktma-pop'; pop.setAttribute('role', 'menu');
    pop.innerHTML = '<div class="t">Chọn CV để mở hộp Chi tiết công việc</div>' + it.ids.slice(0, 200).map(function (id) {
      var r = rowById(id) || {}, lk = !C.editable(r), rj = !lk && S.rej[String(id)];
      return '<button data-cv="' + esc(id) + '"' + (lk ? ' disabled title="CV đã kiểm tra — trang không cho sửa"' : '') + '><span>#' + esc(id) + ' · ' + esc((r.Cabinet || {}).BoxName || '') + '</span><span>' + (lk ? '🔒' : rj ? '🚫 cần gắn Trụ' : '✎') + '</span></button>';
    }).join('') + (it.ids.length > 200 ? '<div class="t">… còn ' + (it.ids.length - 200) + ' CV — lọc hẹp lại để mở</div>' : '');
    root.appendChild(pop);
    var rc = btn.getBoundingClientRect(); pop.style.top = Math.min(rc.bottom + 4, window.innerHeight - pop.offsetHeight - 8) + 'px'; pop.style.left = Math.max(8, Math.min(rc.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.onclick = function (e) { var b = e.target.closest('[data-cv]'); if (!b || b.disabled) return; closePick(); openDetail(b.dataset.cv, it.de, it.s); };
    setTimeout(function () { document.addEventListener('mousedown', pickOut, true); document.addEventListener('keydown', pickKey, true); }, 0);
  }
  function modalOpen() { var m = document.getElementById('MaintTaskDetailEdit'); if (!m) return false; var cs = getComputedStyle(m); return cs.display !== 'none' && cs.visibility !== 'hidden' && m.offsetParent !== null || cs.display === 'block'; }
  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function hold(on) { root.classList.toggle('k-hold', on); document.body.classList.toggle('ktma-hold', on); }
  async function openDetail(id, de, src) {
    if (S.editing) { toast('Đang mở hộp Chi tiết công việc — xử lý xong CV đó trước.'); return; }
    if (!canOpen()) { toast('Chỉ mở được hộp chi tiết ở chế độ "Quận đang lọc" với tài khoản quản lý đơn vị.'); return; }
    var r = liveNode(id);
    if (!r) { toast('Không thấy CV #' + id + ' trong lưới — chạy kiểm tra lại.'); return; }
    if (!C.editable(r)) { toast('CV #' + id + ' đã kiểm tra — trang không cho sửa.'); return; }
    if (modalOpen()) { toast('Hộp Chi tiết công việc đang mở — đóng hộp đó trước.'); return; }
    var nv = C.normDesc(de), cur = C.normDesc(r.Description), fresh = src == null || cur === src;
    S.editing = true; hold(true);
    var d = null, oldDesc = r.Description;
    try {
      var mid = document.getElementById('txtMaintTaskId'); if (mid) mid.value = '';
      try { window.currentMaintTask = r; window.currentMaintTaskId = r.Id; } catch (e) { }
      window.LoadMaintTaskDetail(r.Id, 1, 0);
      var ok = false, seen = 0;
      for (var t = 0; t < 120; t++) {
        await sleep(250); mid = document.getElementById('txtMaintTaskId'); d = document.getElementById('txtDescription');
        if (modalOpen() && mid && String(mid.value) === String(r.Id) && d) {
          if (C.normDesc(d.value) === cur || ++seen >= 6) { ok = true; break; }
        }
      }
      if (!ok) { toast('Hộp chi tiết chưa mở được (trang phản hồi chậm hoặc báo lỗi).'); return; }
      if (!fresh) toast('Mô tả CV #' + r.Id + ' đã đổi sau lần kiểm tra — công cụ KHÔNG điền sẵn, anh xem trực tiếp.');
      else if (nv && !d.disabled && !d.readOnly) {
        d.value = nv; d.dispatchEvent(new Event('input', { bubbles: true })); d.dispatchEvent(new Event('change', { bubbles: true }));
        d.style.outline = '3px solid #f59f00'; d.title = 'Công cụ đã điền sẵn đề xuất sửa — kiểm tra lại rồi bấm "Lưu dữ liệu"';
        setTimeout(function () { try { d.focus(); d.setSelectionRange(d.value.length, d.value.length); } catch (e) { } }, 300);
      }
      // Chờ người dùng đóng hộp (Lưu dữ liệu / Đóng), tối đa 2 giờ
      for (var w = 0; w < 14400 && modalOpen(); w++) await sleep(500);
    } catch (e) {
      toast('Không mở được hộp chi tiết: ' + (e && e.message || e));
    } finally {
      if (d) { d.style.outline = ''; d.title = ''; }
      hold(false); S.editing = false;
    }
    if (!ok) return;
    // Chờ lưới tải lại (nếu đã lưu) rồi kiểm tra lại
    await sleep(800);
    for (var k = 0; k < 10; k++) { var n2 = liveNode(r.Id); if (!n2 || n2 !== r || n2.Description !== oldDesc) break; await sleep(500); }
    if (S.mode === 'cur') await run(true);
  }

  /* ---------- MÀN XEM ẢNH ---------- */
  var KLC = { 'KHỚP': '#198754', 'KHÔNG KHỚP': '#dc3545', 'CẦN XEM': '#f59f00', 'KHÔNG ĐỌC ĐƯỢC': '#6c757d' };
  var IMGS = [['Image1', 'Hiện trạng'], ['Image2', 'Thi công'], ['Image3', 'Hoàn thành'], ['ImageAddition', 'Bổ sung']];
  function imgUrl(r, f) { return CDN + encodeURI(String(r.ImagePath || '')) + '/' + encodeURIComponent(f); }
  function openReview(i) {
    if (!S.list.length) { toast('Ngày này không có công việc.'); return; }
    var rv = $('#ktma-rv');
    if (!rv) {
      rv = document.createElement('div'); rv.id = 'ktma-rv'; rv.setAttribute('role', 'dialog'); rv.setAttribute('aria-label', 'Xem ảnh công việc'); root.appendChild(rv);
      rv.addEventListener('click', onRvClick);
      document.addEventListener('keydown', onKey, true);
    }
    S.idx = Math.max(0, Math.min(i || 0, S.list.length - 1)); renderRv();
  }
  function closeReview() { var rv = $('#ktma-rv'); if (rv) rv.remove(); document.removeEventListener('keydown', onKey, true); kpis(); renderRes(); }
  function renderRv() {
    bigIx = -1;
    var rv = $('#ktma-rv'), r = S.list[S.idx], c = r.Cabinet || {}, k = S.kq[r.Id] || {};
    var par = r.ParentTaskId ? S.rows.find(function (x) { return String(x.Id) === String(r.ParentTaskId); }) : null;
    var imgs = IMGS.filter(function (p) { return r[p[0]]; });
    var lat = +r.Latitude, lng = +r.Longitude, gps = isFinite(lat) && isFinite(lng) && (lat || lng);
    rv.innerHTML = '<div class="rh"><div><b style="font-size:15px">[' + (S.idx + 1) + '/' + S.list.length + '] #' + esc(r.Id) + ' · ' + esc(C.dmy(r._day)) + '</b> · Tủ <b>' + esc(c.BoxName) + '</b> (' + esc(c.PENumber) + ') · ' + esc(c.Road) + (c.Ward ? ', ' + esc(c.Ward) : '') + (S.quan === 'Toàn KVTT' ? ' · ' + esc(c.District) : '')
      + (gps ? ' · GPS CV <a href="https://www.google.com/maps?q=' + lat.toFixed(6) + ',' + lng.toFixed(6) + '" target="_blank" rel="noopener">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</a>' : '')
      + '<br>Hạng mục <b style="color:#ffd54f">' + esc(r._work) + '</b> · SL ' + esc(r.Quantity)
      + (r.ParentTaskId ? ' · <span style="color:#ff8a65">CV CON của #' + esc(r.ParentTaskId) + (par ? ' (' + esc(par._work) + ', SL ' + esc(par.Quantity) + ')' : '') + ' — ảnh dùng chung với CV gốc, dải chữ ghi hạng mục gốc</span>' : '')
      + '<br>MÔ TẢ: <span style="color:#80deea;font-size:15px">' + esc(r.Description) + '</span>'
      + '<br><span style="color:#9ca3af">Phải thấy: ' + esc(C.hint(r._work)) + ' · ' + esc(C.COMMON) + '</span></div>'
      + '<div style="text-align:right;color:#9ca3af">← → chuyển CV · 1–4 kết luận · Z phóng ảnh · N ghi chú · Esc đóng<br><button class="nav" data-v="prev">‹ Trước</button> <button class="nav" data-v="next">Sau ›</button> <button class="nav" data-v="close">✕ Đóng</button></div></div>'
      + '<div class="im">' + (imgs.length ? imgs.map(function (p, j) { return '<figure data-big="' + j + '"><figcaption>' + p[1] + '</figcaption><img alt="' + p[1] + '" src="' + esc(imgUrl(r, r[p[0]])) + '"></figure>'; }).join('') : '<div class="na">Công việc không có ảnh</div>') + '</div>'
      + '<div class="big"><span class="cap"></span><img alt=""></div>'
      + '<div class="ft">' + C.KL.map(function (kl, j) { return '<button data-kl="' + kl + '" class="' + (k.kl === kl ? 'sel' : '') + '" style="background:' + KLC[kl] + (kl === 'CẦN XEM' ? ';color:#111' : '') + '">' + (j + 1) + ' ' + kl + '</button>'; }).join('')
      + '<input id="ktma-note" placeholder="Ghi chú / bằng chứng (N)… — bắt buộc khi không KHỚP" value="' + esc(k.ct || '') + '" aria-label="Ghi chú"><span style="color:#9ca3af" id="ktma-seen"></span></div>';
    $$('.im img', rv).forEach(function (im) { im.onerror = function () { var f = im.closest('figure'); if (f && !im.dataset.retry) { im.dataset.retry = 1; im.src = im.src + (im.src.indexOf('?') < 0 ? '?r=1' : '&r=1'); } else if (f) { f.innerHTML = '<figcaption>' + esc(im.alt) + '</figcaption><div class="na">⚠ Không tải được ảnh</div>'; } }; });
    seenTxt(); preload(S.idx + 1);
  }
  function seenTxt() { var s = $('#ktma-seen'); if (s) s.textContent = 'Đã xem ' + S.list.filter(function (r) { return S.kq[r.Id]; }).length + '/' + S.list.length + ' · lưu tự động'; }
  function preload(i) { var r = S.list[i]; if (!r) return; IMGS.forEach(function (p) { if (r[p[0]]) { var im = new Image(); im.src = imgUrl(r, r[p[0]]); } }); }
  var bigIx = -1;
  function showBig(j) {
    var rv = $('#ktma-rv'), r = S.list[S.idx], imgs = IMGS.filter(function (p) { return r[p[0]]; }); var big = $('.big', rv);
    if (j < 0 || j >= imgs.length) { big.classList.remove('on', 'z'); bigIx = -1; return; }
    bigIx = j; big.classList.add('on'); big.classList.remove('z'); $('.cap', big).textContent = imgs[j][1] + ' (Z: ảnh kế · bấm ảnh: phóng 2,4× · Esc: thoát)'; $('img', big).src = imgUrl(r, r[imgs[j][0]]);
  }
  function setKl(kl) {
    var r = S.list[S.idx], note = ($('#ktma-note') || {}).value || '';
    if (kl !== 'KHỚP' && !note.trim()) { var n = $('#ktma-note'); n.focus(); n.placeholder = '⚠ Ghi bằng chứng (thấy gì, ở ảnh nào) rồi bấm lại'; n.style.borderColor = '#f59f00'; return; }
    S.kq[r.Id] = { kl: kl, ct: note.trim() }; saveKq();
    if (S.idx < S.list.length - 1) { S.idx++; renderRv(); } else { renderRv(); toast('Đã xem hết ' + S.list.length + ' CV của ngày.'); }
  }
  function saveNote() { var r = S.list[S.idx], n = $('#ktma-note'); if (r && n && S.kq[r.Id]) { S.kq[r.Id].ct = n.value.trim(); saveKq(); } }
  function go(d) { saveNote(); var i = S.idx + d; if (i < 0 || i >= S.list.length) return; S.idx = i; renderRv(); }
  function onRvClick(e) {
    var t = e.target, b;
    if ((b = t.closest('[data-kl]'))) setKl(b.dataset.kl);
    else if ((b = t.closest('[data-v]'))) { if (b.dataset.v === 'prev') go(-1); else if (b.dataset.v === 'next') go(1); else { saveNote(); closeReview(); } }
    else if ((b = t.closest('[data-big]'))) showBig(+b.dataset.big);
    else if (t.closest('.big')) { var big = t.closest('.big'); var im = $('img', big); var rc = im.getBoundingClientRect(); im.style.transformOrigin = ((e.clientX - rc.left) / rc.width * 100) + '% ' + ((e.clientY - rc.top) / rc.height * 100) + '%'; big.classList.toggle('z'); }
  }
  function onKey(e) {
    if (!$('#ktma-rv') || typeof e.key !== 'string') return;
    var inNote = e.target && e.target.id === 'ktma-note';
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (inNote) { e.target.blur(); return; } if (bigIx >= 0) { showBig(-1); return; } saveNote(); closeReview(); return; }
    if (inNote) { if (e.key === 'Enter') { e.preventDefault(); var r = S.list[S.idx]; if (S.kq[r.Id]) { saveNote(); go(1); } else e.target.blur(); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase(), handled = true;
    if (k >= '1' && k <= '4') setKl(C.KL[+k - 1]);
    else if (k === 'arrowright') go(1); else if (k === 'arrowleft') go(-1);
    else if (k === 'z') { var n = IMGS.filter(function (p) { return S.list[S.idx][p[0]]; }).length; showBig(bigIx + 1 < n ? bigIx + 1 : -1); }
    else if (k === 'n') { $('#ktma-note').focus(); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  /* ---------- ĐÃ HỌC ---------- */
  function openLearn() {
    var md = $('#ktma-md'); if (md) md.remove();
    md = document.createElement('div'); md.id = 'ktma-md'; root.appendChild(md);
    function render() {
      var L = C.learnSummary(S.learn);
      md.innerHTML = '<div class="box" role="dialog" aria-label="Bộ nhớ đã học"><div class="top"><b>📚 Đã học (' + L.length + ')</b><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="k-gh" data-l="exp">Xuất JSON</button><button class="k-gh" data-l="imp">Nhập JSON</button><button class="k-gh" data-l="clr">Xoá tất cả</button><button class="k-gh" data-l="x" aria-label="Đóng">✕</button></div></div><div class="body">'
        + (L.length ? '<table><thead><tr><th>Loại</th><th>Nội dung</th><th>Kết luận</th><th>Giữ/Bỏ</th><th>Ví dụ gần nhất</th><th>Ngày</th><th></th></tr></thead><tbody>' + L.map(function (o, i) {
          return '<tr><td>' + esc({ ten: 'Tên riêng', tr: 'Viết tắt trụ', p: 'Viết tắt p', sp1: 'Khoảng trắng', sp2: 'Khoảng trắng', rac: 'Ký tự rác', eq: 'Ký tự =', kytu: 'Ký tự Ð' }[o.loai] || o.loai) + '</td><td>' + esc(o.text) + '</td><td><span class="k-chip ' + ({ 'BỎ': 'k-gray', 'GIỮ': 'k-bad', 'MÂU THUẪN': 'k-warn' }[o.kl] || 'k-ok') + '">' + esc(o.kl === 'BỎ' ? 'Không báo nữa' : o.kl === 'GIỮ' ? 'Đúng lỗi' : o.kl) + '</span></td><td>' + esc(o.pos) + '/' + esc(o.neg) + '</td><td>' + esc(o.ex) + '</td><td>' + esc(o.t) + '</td><td><button class="k-gh" data-del="' + i + '">Xoá</button></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="k-empty">Chưa học gì. Bỏ lỗi báo nhầm, sửa đề xuất hoặc "+ Báo lỗi" rồi bấm "💾 Ghi nhớ chỉnh sửa".</div>') + '</div></div>';
      md.onclick = function (e) {
        var t = e.target, b;
        if (t === md || t.closest('[data-l=x]')) { md.remove(); return; }
        if ((b = t.closest('[data-del]'))) { var o = L[+b.dataset.del]; C.forget(S.learn, o.type, o.key); after(); }
        else if (t.closest('[data-l=clr]')) { if (confirm('Xoá toàn bộ bộ nhớ đã học?')) { S.learn = C.emptyLearn(); after(); } }
        else if (t.closest('[data-l=exp]')) dl(new Blob([C.serializeLearn(S.learn)], { type: 'application/json' }), 'KiemTraMoTa-DaHoc-' + new Date().toISOString().slice(0, 10) + '.json');
        else if (t.closest('[data-l=imp]')) { var fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.json,application/json'; fi.onchange = function () { var f = fi.files[0]; if (!f) return; f.text().then(function (txt) { var L2 = C.parseLearn(txt); var n = C.learnSummary(L2).length; if (!n) { toast('File không có dữ liệu học hợp lệ.'); return; } C.mergeLearn(S.learn, L2); after(); toast('Đã nhập ' + n + ' mục.'); }).catch(function () { toast('Không đọc được file.'); }); }; fi.click(); }
      };
    }
    function after() { saveLearn(); nLearn(); if (S.rows.length) { S.sp = C.spellList(S.rows, S.learn); applySel(); kpis(); renderRes(); } render(); }
    var esck = function (e) { if (e.key === 'Escape' && document.getElementById('ktma-md')) { e.stopPropagation(); md.remove(); } if (!document.getElementById('ktma-md')) document.removeEventListener('keydown', esck, true); };
    document.addEventListener('keydown', esck, true);
    render();
  }

  /* ---------- XUẤT EXCEL ---------- */
  function dl(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 1500); }
  function exportXlsx() {
    if (!S.sp) return;
    var pend = C.pendingCount(S.sp.items, S.adds), n = 0;
    if (pend && confirm('Có ' + pend + ' chỉnh sửa chính tả chưa ghi nhớ.\nGhi nhớ để lần sau tự áp?\n\n(OK = ghi nhớ · Huỷ = chỉ dùng cho file này)')) n = commit(false);
    var ex = C.buildExport({ quan: S.quan + (S.range ? ' (' + S.range + ')' : ''), rows: S.rows, day: S.day, list: S.list, spell: S.sp.items, auto: S.auto, kq: S.kq, totalDesc: S.sp.total });
    var Q = S.quan === 'Toàn KVTT';
    var bytes = X.build([
      { name: 'Tong_hop', title: true, rows: ex.TONG, widths: [56, 16] },
      { name: 'Chinh_ta', head: ['STT', 'Mức', 'Mô tả gốc', 'Số CV', 'Mã CV (≤15)', 'Lỗi phát hiện', 'Đề xuất sửa', 'Nguồn'], rows: ex.CT, widths: [6, 11, 42, 7, 30, 46, 42, 18], colorCol: 1 },
      { name: 'So_anh', head: ['Mã CV', 'Ngày', 'Tủ', 'Hạng mục', 'Mô tả', 'Kết luận', 'Chi tiết / bằng chứng'].concat(Q ? ['Quận'] : []), rows: ex.ANH.map(function (r) { return Q ? r : r.slice(0, 7); }), widths: [10, 11, 22, 32, 30, 15, 60, 16], colorCol: 5 },
      { name: 'Kiem_tra_du_lieu', head: ['Mã CV', 'Ngày', 'Tủ', 'Hạng mục', 'Mô tả', 'Loại', 'Chi tiết'].concat(Q ? ['Quận'] : []), rows: ex.DL.map(function (r) { return Q ? r : r.slice(0, 7); }), widths: [10, 11, 22, 32, 30, 30, 44, 16] }
    ]);
    var name = 'KiemTra_MoTa_Anh_' + C.slug(S.quan === 'Toàn KVTT' ? 'KVTT' : S.quan) + '_' + (S.day || 'nodate') + '.xlsx';
    dl(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
    toast('Đã tải ' + name + (n ? ' · ghi nhớ ' + n + ' chỉnh sửa' : ''));
    return { name: name, ex: ex, bytes: bytes };
  }

  function feedback() {
    var body = 'Công cụ: Kiểm tra mô tả & ảnh v' + VER + '\nPhạm vi: ' + (S.quan || '-') + ' ' + (S.range || '') + '\nTrình duyệt: ' + navigator.userAgent + '\n\nMức hài lòng (1-5 sao): \nLoại góp ý (Đề xuất tính năng / Lỗi công cụ / Báo nhầm chính tả / Khác): \nNội dung: \n';
    window.open('mailto:maivulam2020@gmail.com?subject=' + encodeURIComponent('[Góp ý] Kiểm tra mô tả & ảnh v' + VER) + '&body=' + encodeURIComponent(body));
  }

  window.__ktma = { S: S, run: run, openDetail: openDetail, openWrite: openWrite, openUndo: openUndo, doWrite: doWrite, openRes: openRes, openReview: openReview, exportXlsx: exportXlsx, commit: commit, setDay: setDay, openLearn: openLearn };
})();

})();
