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
  var S = { sel: new Map(), written: {}, mode: 'cur', rows: [], quan: '', auto: [], sp: null, adds: [], day: '', days: [], list: [], kq: {}, idx: 0, learn: C.parseLearn(lsGet(LKEY)), range: '' };
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
    + '<div class="k-st" id="ktma-st">Lọc quận + khoảng thời gian trên trang rồi bấm "Chạy kiểm tra". Công cụ chỉ đọc, không sửa dữ liệu.</div></div>';
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
          var lk = it._lk || 0, all = lk >= it.n, chg = C.normDesc(it.de) !== it.s && !!C.normDesc(it.de), wt = S.written[it.s];
          var cb = cw ? '<td><input type="checkbox" data-sel="' + ix + '"' + (it.sel && !all && chg ? ' checked' : '') + (all || !chg ? ' disabled' : '') + ' aria-label="Chọn để ghi" title="' + (all ? 'Tất cả CV đã kiểm tra — trang khoá' : !chg ? 'Đề xuất giống mô tả gốc' : 'Chọn để ghi vào SmartHCM') + '"></td>' : '';
          return '<tr>' + cb + '<td>' + (ix + 1) + '</td><td>' + esc(it.s) + (wt ? '<span class="k-lr" style="color:#0f5132">✓ đã ghi ' + esc(wt) + '</span>' : '') + '</td><td>' + it.issues.map(function (i, j) {
            return '<span class="k-chip ' + (i.on ? 'k-' + i.kind : 'k-off') + '" data-i="' + ix + '" data-j="' + j + '" role="button" tabindex="0" title="Bấm để ' + (i.on ? 'bỏ (báo nhầm)' : 'bật lại') + '">' + esc(i.text) + '</span>' + (i.learned ? '<span class="k-lr">' + esc(i.learned) + '</span>' : '');
          }).join('') + '</td><td><span class="k-de' + (it.de !== it.defDe ? ' ed' : '') + '" contenteditable="plaintext-only" data-de="' + ix + '" aria-label="Đề xuất sửa">' + esc(it.de) + '</span>' + (it.deLearned ? '<span class="k-lr">📚 đề xuất đã học</span>' : '') + '</td><td>' + it.n + (lk ? ' <span class="k-chip k-lk" title="CV đã kiểm tra — trang không cho sửa">🔒' + (all ? ' đã kiểm tra' : lk) + '</span>' : '') + '</td></tr>';
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
    S.sp.items.forEach(function (it) { it._lk = C.lockedCount(it, S.rows); it.sel = it._lk >= it.n ? false : (S.sel.has(it.s) ? S.sel.get(it.s) : C.defaultSel(it)); });
    var u = $('[data-r=undo]'); if (u) u.hidden = !(canWrite() && lastLog());
  }
  function selInfo() {
    var n = 0, cv = 0, lk = 0;
    S.sp.items.forEach(function (it) { if (!it.sel) return; var nv = C.normDesc(it.de); if (!nv || nv === it.s) return; var l = it._lk || 0; if (l >= it.n) return; n++; cv += it.n - l; lk += l; });
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
    var notes = []; if (plan.locked.length) notes.push(plan.locked.length + ' CV đã kiểm tra (trang khoá) — bỏ qua'); if (plan.changed.length) notes.push(plan.changed.length + ' CV mô tả đã bị sửa từ lúc kiểm tra — bỏ qua'); if (plan.missing.length) notes.push(plan.missing.length + ' CV không còn trong lưới — bỏ qua');
    return '<div class="top"><b>' + esc(title) + '</b><button class="k-gh" data-w="x" aria-label="Đóng">✕</button></div><div class="body">'
      + (g.size ? '<table><thead><tr><th style="width:70px">Số CV</th><th>Mô tả cũ → mô tả mới</th></tr></thead><tbody>' + Array.from(g.values()).map(function (x) { return '<tr><td>' + x.c + '</td><td><span class="k-old">' + esc(x.o) + '</span><br><span class="k-new">' + esc(x.n) + '</span></td></tr>'; }).join('') + '</tbody></table>' : '<div class="k-empty">Không còn CV nào ghi được.</div>')
      + (notes.length ? '<p class="k-st">⚠ ' + esc(notes.join(' · ')) + '</p>' : '')
      + '<p class="k-st" id="ktma-wst">Chỉ đổi cột Mô tả; trạng thái, khối lượng, mã tủ giữ nguyên. Trước khi ghi, công cụ tải file nhật ký để hoàn tác.</p></div>'
      + '<div class="top" style="border-top:1px solid var(--k-line);border-bottom:0;justify-content:flex-end"><button class="k-gh" data-w="x">Huỷ</button><button class="k-wr" data-w="go"' + (plan.entries.length ? '' : ' disabled') + '>' + esc(btn) + ' (' + plan.entries.length + ' CV)</button></div>';
  }
  function openWrite() {
    if (!canWrite()) return;
    if (pendingGridEdits()) { toast('Lưới SmartHCM đang có chỉnh sửa tay chưa bấm Cập nhật — lưu hoặc huỷ trước khi ghi.'); return; }
    var plan = C.writePlan(S.sp.items, freshGrid());
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
  function saveChunk(entries) {
    return new Promise(function (res) {
      var to = setTimeout(function () { res({ ok: false, msg: 'Hết thời gian chờ máy chủ' }); }, 60000);
      var done = function (v) { clearTimeout(to); res(v); };
      try {
        var tasks = entries.map(function (e) { var o = C.toMaintTask(e), mt; try { mt = (window.LBCS && LBCS.Core && typeof LBCS.Core.MaintTask === 'function') ? new LBCS.Core.MaintTask() : {}; } catch (er) { mt = {}; } Object.keys(o).forEach(function (k) { mt[k] = o[k]; }); return mt; });
        svc().SaveReviewMaintTask(tasks, false, function (d) { done(d && d.Code === 1 ? { ok: true } : { ok: false, msg: (d && d.Message) || 'Máy chủ từ chối' }); }, function (er) { done({ ok: false, msg: (er && (er._message || er.message)) || 'Lỗi kết nối' }); });
      } catch (er) { done({ ok: false, msg: String(er && er.message || er) }); }
    });
  }
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
      if (r.ok) okE = okE.concat(parts[i]); else errs.push('Lô ' + (i + 1) + ': ' + r.msg);
    }
    if (st) st.textContent = 'Đang tải lại lưới và kiểm lại…';
    var v = await waitGrid(okE);
    if (okE.length) lsSet(WKEY + S.quan, JSON.stringify(isUndo ? C.writeLog([], {}) : C.writeLog(okE, { quan: S.quan, at: at.replace('_', ' ') })));
    var hm = at.slice(11, 13) + ':' + at.slice(13, 15);
    if (!isUndo) S.sp.items.forEach(function (it) { if (it.sel && okE.some(function (e) { return C.normDesc(e.old) === it.s; })) S.written[C.normDesc(it.de)] = hm; });
    S.busy = false; var md = $('#ktma-md'); if (md) md.remove();
    var msg = (isUndo ? 'Hoàn tác' : 'Đã ghi') + ' ' + v.ok.length + '/' + plan.entries.length + ' CV' + (v.fail.length ? ' · ' + v.fail.length + ' CV chưa thấy đổi trên lưới' : '') + (errs.length ? ' · LỖI ' + errs.join('; ') : '');
    await run(true);
    toast(msg); stat(msg + (v.fail.length ? '\nCV cần kiểm lại: ' + v.fail.slice(0, 30).join(', ') : ''));
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

  window.__ktma = { S: S, run: run, openWrite: openWrite, openUndo: openUndo, doWrite: doWrite, openRes: openRes, openReview: openReview, exportXlsx: exportXlsx, commit: commit, setDay: setDay, openLearn: openLearn };
})();
