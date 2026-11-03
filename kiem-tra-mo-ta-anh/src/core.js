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
      while ((tr = TR_RE.exec(s))) { if (/^trụ/i.test(tr[0]) || inName(tr.index, tr.index + tr[1].length)) continue; add('L', 'tr|' + s0, '"' + tr[0] + '" → "trụ số ' + tr[3] + '"'); break; }
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
      if (on('tr|' + s0)) de = de.replace(TR_RE, function (m0, w, so, n) { return /^trụ/i.test(m0) ? m0 : 'trụ số ' + n; });
      if (on('p|' + s0)) de = de.replace(/(?<![\p{L}\p{N}\u0003])p\.?\s*(?=\d)/giu, 'phường ').replace(/(?<![\p{L}\p{N}\u0003])p\.?\s+(?=[\p{L}\u0002])/giu, 'phường ');
      de = de.replace(/\u0002(\d+)\u0003/g, function (m0, i) { return ph[+i]; });
      de = de.replace(/(?<![\p{L}\p{N}])(TP|Tp|tp|Q|q)\.(?=\S)/gu, function (m0, a) { return a + '\u0001'; });
      if (on('rac|' + s0)) de = de.replace(/[¹²³]/g, '').replace(/(?<![\p{L}\p{N}])p{2,}(?![\p{L}\p{N}])/giu, '');
      if (on('eq|' + s0)) de = de.replace(/\s*=\s*/g, ' ');
      if (on('sp2|' + s0) || (on('sp1|' + s0) && !off.has('sp2|' + s0))) de = de.replace(/(\p{L})\(/gu, function (m0, a) { return a + ' ('; }).replace(/\(\s+/g, '(').replace(/\s+([.,;:)])/g, function (m0, a) { return a; });
      if (on('sp1|' + s0)) de = de.replace(/([.,;:])(?=[^\s\d)\/µ.\u0001])/g, function (m0, a) { return a + ' '; });
      de = de.replace(/\s+/g, ' ').replace(/\u0001/g, '.').replace(/(?<![\p{L}\p{N}])trụ\s+trụ số/giu, 'trụ số').trim();
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
if (typeof module !== 'undefined' && module.exports) module.exports = KTCORE;
