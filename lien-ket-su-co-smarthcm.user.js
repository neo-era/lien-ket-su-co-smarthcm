// ==UserScript==
// @name         Liên kết sự cố - Duy tu SmartHCM
// @namespace    lavipco.cskvtt
// @version      1.1.0
// @description  Tự động ghép & liên kết sự cố cho công việc duy tu trên smarthcm.city (rule-based + TỰ HỌC từ chỉnh sửa của anh). Ghép theo số trụ + vị trí + loại việc, lọc dòng lệch, học khi anh sửa, duyệt bảng rồi lưu.
// @author       CSKVTT - LAVIPCO
// @match        https://smarthcm.city/*
// @match        https://*.smarthcm.city/*
// @match        http://smarthcm.city/*
// @match        http://*.smarthcm.city/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/neo-era/lien-ket-su-co-smarthcm/main/lien-ket-su-co-smarthcm.user.js
// @downloadURL  https://raw.githubusercontent.com/neo-era/lien-ket-su-co-smarthcm/main/lien-ket-su-co-smarthcm.user.js
// ==/UserScript==

/*
 * HƯỚNG DẪN NHANH
 * 1. Cài extension Tampermonkey (Chrome/Edge/Firefox).
 * 2. Tampermonkey > Create a new script > dán toàn bộ file này > Ctrl+S.
 * 3. Mở trang Quản lý Công việc Duy tu (TaskListNew), lọc quận + khoảng thời gian như thường.
 * 4. Góc phải dưới có panel "Liên kết sự cố". Bấm "1) Ghép thử" -> xem bảng -> bấm "2) Lưu dòng đã chọn".
 *
 * TỰ HỌC (mới ở v1.1.0): mỗi lần anh bấm "Lưu", app so đề xuất ban đầu với tick cuối của anh.
 *   - Bỏ tick dòng app đề xuất  -> học "cặp loại-việc × loại-sự-cố (× vị trí) này SAI".
 *   - Tick dòng app không đề xuất -> học "cặp này ĐÚNG".
 * Lần ghép sau, cặp trùng đặc trưng đã học sẽ tự bỏ/giữ tick kèm ghi chú "đã học…". App KHÔNG tự lưu —
 * anh vẫn duyệt bảng rồi mới bấm Lưu. Bấm "📚 Đã học" để xem/xóa/ xuất-nhập bộ nhớ (lưu trên máy này).
 */

(function () {
  'use strict';

  if (!/\/Maintenance\/TaskListNew/i.test(location.pathname)) return;

  const MAXDAYS = 45;

  // ===================== LÕI TỰ HỌC (đã test bằng Node) =====================
  /* ================= LKSC_LEARN — lõi "tự học" cho công cụ liên kết sự cố =================
   * Thuần logic (không DOM), inline được vào userscript và test được bằng Node.
   * Học theo cặp đặc trưng KHÁI QUÁT: (loại việc) × (loại sự cố) × (quan hệ vị trí),
   * KHÔNG học theo mã CV/sự cố (vì mã đổi mỗi đợt).
   */
  function LKSC_LEARN() {
    'use strict';
    const STORE_KEY = 'lksc_learn_v1';
    const SEP = '␟';

    const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
      .replace(/[^a-z0-9\/ ]/g, ' ').replace(/\s+/g, ' ').trim();

    // ----- Loại việc (hạng mục) -> thẻ chuẩn -----
    const WORK_TAGS = [
      ['nap_cua_tru', /nap cua tru/],
      ['bang_ron',    /bang ron/],
      ['phat_quang',  /phat quang/],
      ['chuyen_mach', /chuyen mach/],
      ['rccb',        /rccb|rcbo|elcb/],
      ['mcb',         /\bmcb\b/],
      ['contactor',   /contactor|khoi dong tu/],
      ['tu_dk',       /tu dieu khien|lap trinh|bo dieu khien|timer/],
      ['driver',      /driver/],
      ['dui',         /dui den|dui su/],
      ['cap_den',     /cap .*den|thao .*cap|cap len den|cap dien/],
      ['can_den',     /can den|tay den/],
      ['lap_den',     /lap dat bo den|lap den|lap dat den/],
      ['tu_dien',     /tu dien/],
      ['bong',        /bong|chan luu|kich/],
      ['son',         /son|tay ri/],
      ['ve_sinh',     /ve sinh/],
      ['choa',        /choa/],
    ];
    // ----- Loại sự cố (nội dung) -> thẻ chuẩn -----
    const INC_TAGS = [
      ['mat_led',   /mat led/],
      ['rccb',      /rccb|rcbo|elcb/],
      ['mcb',       /\bmcb\b/],
      ['contactor', /contactor/],
      ['cay_xanh',  /cay xanh|cay che|nhanh cay|che mat den|che den/],
      ['co_khi',    /be choa|bo choa|be de|bo de|bong hue|bup sen|gay|be tu|vo tu/],
      ['dui',       /dui den/],
      ['ro',        /\bro\b|cham/],
      ['den_tat',   /den tat|khong sang|sang mo|chop tat|tat tu|anh sang vang|den duong tat|tat/],
    ];

    const STOP = new Set('tru so duong den bong bo va cua thay the de nghi cho bi hu hong mat khong sang tai truoc moi cap cung khu dat lap do w led hps 150 100 70 250 40 50 60 120 140'.split(' '));
    const fallback = (s, pre) => {
      const toks = norm(s).replace(/tru so \d+|ts \d+/g, ' ').split(' ')
        .filter(t => t && !STOP.has(t) && t.length > 2 && !/^\d+$/.test(t));
      return pre + (toks.slice(0, 2).join('-') || 'khac');
    };
    const firstTag = (s, table, pre) => { const n = ' ' + norm(s) + ' '; for (const [tag, re] of table) if (re.test(n)) return tag; return fallback(s, pre); };
    const workTag = w => firstTag(w, WORK_TAGS, 'wx:');
    const incTag  = c => firstTag(c, INC_TAGS, 'ix:');

    // ----- Quan hệ vị trí: lo_diff > hem_cau > street_diff > '' -----
    const loOf = s => { const m = norm(s).match(/\blo ([a-z]+)\b/); return m ? m[1] : null; };
    const streetToks = s => new Set(norm(s).replace(/tru so \d+|ts \d+|\d+/g, ' ').split(' ').filter(t => t && !STOP.has(t) && t.length > 2));
    function rel(desc, inc) {
      const lo1 = loOf(desc), lo2 = loOf(inc);
      if (lo1 && lo2 && lo1 !== lo2) return 'lo_diff';
      const d = norm(desc), c = norm(inc);
      if ((/\bhem\b/.test(d) && /\bcau\b/.test(c)) || (/\bcau\b/.test(d) && /\bhem\b/.test(c))) return 'hem_cau';
      const a = streetToks(desc), b = streetToks(inc);
      if (a.size && b.size) { let inter = 0; a.forEach(t => { if (b.has(t)) inter++; }); if (inter === 0) return 'street_diff'; }
      return '';
    }

    const keyOf = o => [workTag(o.work || ''), incTag(o.incContent || ''), rel(o.desc || '', o.incContent || '')].join(SEP);

    function verdict(r) {
      if (!r) return null;
      if ((r.neg || 0) > (r.pos || 0)) return 'sai';
      if ((r.pos || 0) > (r.neg || 0)) return 'dung';
      if ((r.pos || 0) > 0 || (r.neg || 0) > 0) return 'conflict';
      return null;
    }

    // ----- Lưu trữ (localStorage hoặc mock {getItem,setItem}) -----
    function load(storage) {
      try {
        const raw = storage && storage.getItem(STORE_KEY);
        if (!raw) return { version: 1, rules: {} };
        const d = JSON.parse(raw);
        if (!d || typeof d !== 'object' || !d.rules || typeof d.rules !== 'object') return { version: 1, rules: {} };
        return { version: 1, rules: d.rules };
      } catch (e) { return { version: 1, rules: {} }; }
    }
    function save(storage, data) {
      try { storage && storage.setItem(STORE_KEY, JSON.stringify({ version: 1, rules: data.rules || {} })); return true; }
      catch (e) { return false; }
    }

    // ----- Áp dụng khi ghép: trả verdict đã học cho 1 dòng -----
    function applyLearn(o, data) {
      const key = keyOf(o); o._learnKey = key;
      const v = verdict((data.rules || {})[key]);
      o._learn = v; return v;
    }

    // ----- Học từ chênh lệch giữa ĐỀ XUẤT (def) và TICK CUỐI (fin) -----
    // rows: [{key, def:boolean, fin:boolean, work, incContent}]
    function learnFromDiff(rows, data) {
      data.rules = data.rules || {};
      let changed = 0;
      const now = new Date().toISOString();
      for (const r of rows) {
        if (!r || !r.key) continue;
        if (!!r.def === !!r.fin) continue;              // không đổi -> không học
        const rule = data.rules[r.key] || { pos: 0, neg: 0 };
        if (r.fin) rule.pos = (rule.pos || 0) + 1; else rule.neg = (rule.neg || 0) + 1;
        rule.updated = now;
        if (r.work) rule.lastWork = String(r.work).slice(0, 80);
        if (r.incContent) rule.lastInc = String(r.incContent).slice(0, 80);
        data.rules[r.key] = rule; changed++;
      }
      return changed;
    }

    return { STORE_KEY, SEP, norm, workTag, incTag, rel, keyOf, verdict, load, save, applyLearn, learnFromDiff };
  }
  const LRN = LKSC_LEARN();
  let STORE = LRN.load(window.localStorage);

  // ---------- Thuật toán ghép (giống skill) ----------
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/cach mang thang (8|tam)/g, 'cmt8').replace(/cong vien/g, 'cv').replace(/doi dien/g, ' ')
    .replace(/\bts\s*(\d+)/g, (m, a) => 'tru so ' + a).replace(/\btru\s*(?:so)?\s*(\d+)/g, (m, a) => 'tru so ' + a)
    .replace(/[^a-z0-9\/ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const poles = s => [...norm(s).matchAll(/tru so (\d+)/g)].map(m => +m[1]);
  const STOP = new Set('tru so duong den bong bo va cua thay the de nghi cho bi hu hong mat khong sang tai truoc w moi cap cung khu'.split(' '));
  const toks = s => new Set(norm(s).replace(/tru so \d+/g, ' ').split(' ').filter(t => t && !STOP.has(t) && t.length > 1 && !/^\d+w?$/.test(t)));
  const KW = { son:['son','ri','gi','set'], vesinh:['ve sinh','do','ban','bui'], choa:['choa','cau','bong hue','bup sen','non'], bong:['tat','chop','bong'], chanluu:['tat','chop','ro','chan luu'], kich:['tat','chop','kich'], tu:['tat','chop','ro','tu dien'], hopnoi:['hop','noi','re nhanh','lien thong'], mcb:['mcb','cb','chay'], rcbo:['rcbo','ro'], cap:['cap','day','dut','ro'], tay:['tay den','gay','cong'], vo:['vo tu','tu dieu khien','be tu'] };
  const workKey = w => { w = norm(w); return w.includes('son') ? 'son' : w.includes('ve sinh') ? 'vesinh' : /choa/.test(w) ? 'choa' : /hop noi/.test(w) ? 'hopnoi' : /rcbo|rccb/.test(w) ? 'rcbo' : /mcb/.test(w) ? 'mcb' : /tu dien/.test(w) ? 'tu' : /kich/.test(w) && !/bong/.test(w) ? 'kich' : /chan luu/.test(w) && !/bong/.test(w) ? 'chanluu' : /bong/.test(w) ? 'bong' : /tay den|can den/.test(w) ? 'tay' : /vo tu/.test(w) ? 'vo' : /cap/.test(w) ? 'cap' : null; };
  const wm = (w, c) => { const k = workKey(w); if (!k) return 0; const n = ' ' + norm(c) + ' '; return KW[k].some(x => n.includes(' ' + x)) ? 1 : 0; };
  const dt = x => x instanceof Date ? x : (x ? new Date(x) : null);

  // ---------- Bộ lọc dòng lệch cố định (theo các kiểu đã gặp) ----------
  function lechReason(o) {
    const w = o.work || '', d = o.desc || '', c = o.incContent || '';
    if (/nắp cửa trụ/i.test(w)) return 'Nắp cửa trụ ↔ sự cố điện/LED';
    if (/cáp lên đèn|cáp điện lên đèn/i.test(w) && /mắt led|led \d|đèn tắt led|sáng mờ/i.test(c)) return 'Lắp/tháo cáp ↔ hư mắt LED';
    if (/Chu văn An/i.test(d) && /cầu/i.test(c) && /hẻm/i.test(d)) return 'Hẻm ↔ cầu (khác vị trí)';
    if (/lắp đặt/i.test(w) && /RCBO/i.test(c)) return 'Lắp đặt đèn/cần đèn ↔ hư RCBO';
    if (/(tẩy rỉ|sơn trụ)/i.test(w) && /(bể|gãy|chóa|bông huệ)/i.test(c)) return 'Tẩy rỉ/sơn ↔ hư chóa/gãy tay đèn';
    if (/(kích|chấn lưu|tụ điện)/i.test(w) && /(bễ đế|bể đế|bông huệ)/i.test(c)) return 'Kích/chấn lưu/tụ ↔ bễ đế bông huệ';
    if (/tháo.*băng rôn/i.test(w) && /tắt/i.test(c)) return 'Tháo băng rôn ↔ đèn tắt';
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
        if (o.incId) LRN.applyLearn(o, STORE); // gắn o._learn + o._learnKey
        return o;
      });
      const dist = [...new Set(rows.map(r => r.Cabinet && r.Cabinet.District))].filter(Boolean);
      return { out, dist, tong: rows.length, daLienKet: rows.length - un.length, chuaLienKet: un.length };
    })();
  }

  // ---------- Suy ra trạng thái hiển thị theo học ----------
  const effLech = o => o._learn === 'dung' ? false : (o._learn === 'sai' ? true : !!o.lech);
  const suggested = o => o._learn === 'dung' ? true : (o._learn === 'sai' ? false : (o.lvl === 'A' && !o.lech));
  function bucket(o) { if (effLech(o)) return 'L'; if (suggested(o)) return 'A'; if (o.lvl === 'B') return 'B'; return '-'; }

  // ---------- Giao diện ----------
  const css = `
  #lksc{position:fixed;right:16px;bottom:16px;width:580px;max-width:95vw;z-index:999999;background:#fff;border:1px solid #c7ccd1;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);font:13px/1.4 "Segoe UI",Arial,sans-serif;color:#222}
  #lksc .hd{cursor:move;background:#0d6efd;color:#fff;padding:8px 12px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;font-weight:600}
  #lksc .hd .x{cursor:pointer;opacity:.85;font-size:16px}
  #lksc .bd{padding:10px 12px;max-height:70vh;overflow:auto}
  #lksc button{cursor:pointer;border:0;border-radius:6px;padding:6px 12px;font-weight:600}
  #lksc .b1{background:#0d6efd;color:#fff}
  #lksc .b2{background:#198754;color:#fff}
  #lksc .bg{background:#e9ecef;color:#222}
  #lksc .bl{background:#6f42c1;color:#fff}
  #lksc button:disabled{opacity:.5;cursor:not-allowed}
  #lksc .st{margin:8px 0;padding:8px;background:#f1f3f5;border-radius:6px;white-space:pre-wrap}
  #lksc table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}
  #lksc th,#lksc td{border:1px solid #e3e6ea;padding:4px 6px;text-align:left;vertical-align:top}
  #lksc th{position:sticky;top:0;background:#f8f9fa}
  #lksc tr.lech{background:#fff3cd}
  #lksc tr.gB{background:#f3f0ff}
  #lksc tr.good{background:#d1f3e0}
  #lksc .tag{display:inline-block;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:700}
  #lksc .tagA{background:#d1e7dd;color:#0f5132}
  #lksc .tagB{background:#e2d9f3;color:#4b2e83}
  #lksc .mini{color:#6c757d;font-size:11px}
  #lksc .learnN{color:#6f42c1;font-size:11px;font-weight:600}
  #lksc .learnY{color:#0f5132;font-size:11px;font-weight:600}
  #lksc .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  #lkscM{position:fixed;inset:0;z-index:1000000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
  #lkscM .mw{background:#fff;border-radius:10px;width:760px;max-width:95vw;max-height:85vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3)}
  #lkscM .mh{background:#6f42c1;color:#fff;padding:10px 14px;font-weight:700;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0}
  #lkscM .mb{padding:12px 14px;font:13px/1.4 "Segoe UI",Arial,sans-serif}
  #lkscM table{width:100%;border-collapse:collapse;font-size:12px}
  #lkscM th,#lkscM td{border:1px solid #e3e6ea;padding:5px 7px;text-align:left}
  #lkscM th{background:#f8f9fa}
  #lkscM .vd-sai{color:#b02a37;font-weight:700}
  #lkscM .vd-dung{color:#0f5132;font-weight:700}
  #lkscM .vd-conflict{color:#b8860b;font-weight:700}
  #lkscM .del{cursor:pointer;color:#b02a37;font-weight:700;border:0;background:none;font-size:15px}
  #lkscM .foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
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
        <button class="bl" id="lksc-learn" title="Xem bộ nhớ đã học">📚 Đã học (0)</button>
      </div>
      <div class="st" id="lksc-st">Lọc quận + thời gian trên trang, rồi bấm "Ghép thử".</div>
      <div class="row mini">
        <label><input type="checkbox" id="lksc-fa" checked> A (gợi ý lưu)</label>
        <label><input type="checkbox" id="lksc-fb"> B</label>
        <label><input type="checkbox" id="lksc-fl"> lệch / đã học bỏ</label>
        <span>| Tick cột ☑ = sẽ lưu</span>
      </div>
      <div id="lksc-tbl"></div>
    </div>`;
  document.body.appendChild(box);

  box.querySelector('.x').onclick = () => box.remove();

  (function () {
    const hd = box.querySelector('.hd'); let sx, sy, ox, oy, drag = false;
    hd.addEventListener('mousedown', e => { if (e.target.classList.contains('x')) return; drag = true; sx = e.clientX; sy = e.clientY; const r = box.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); });
    document.addEventListener('mousemove', e => { if (!drag) return; box.style.left = (ox + e.clientX - sx) + 'px'; box.style.top = (oy + e.clientY - sy) + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; });
    document.addEventListener('mouseup', () => drag = false);
  })();

  let DATA = null;
  const $ = s => box.querySelector(s);
  const esc = s => (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const countRules = () => Object.keys((STORE && STORE.rules) || {}).length;
  const updateLearnBtn = () => { const b = $('#lksc-learn'); if (b) b.textContent = '📚 Đã học (' + countRules() + ')'; };
  updateLearnBtn();

  function render() {
    if (!DATA) return;
    const showA = $('#lksc-fa').checked, showB = $('#lksc-fb').checked, showL = $('#lksc-fl').checked;
    const rows = DATA.out.filter(o => { const b = bucket(o); if (b === 'L') return showL; if (b === 'A') return showA; if (b === 'B') return showB; return false; });
    const html = ['<table><thead><tr><th>☑</th><th>Nhóm</th><th>Hạng mục</th><th>Mô tả</th><th>→ Nội dung sự cố</th><th>Ngày SC</th></tr></thead><tbody>'];
    rows.forEach(o => {
      const i = DATA.out.indexOf(o);
      const b = bucket(o);
      const cls = o._learn === 'dung' ? 'good' : (b === 'L' ? 'lech' : (o.lvl === 'B' ? 'gB' : ''));
      const def = suggested(o);
      const tag = (o.lvl === 'A' ? '<span class="tag tagA">A</span>' : '<span class="tag tagB">B</span>');
      let note = '';
      if (o._learn === 'sai') note = `<div class="learnN">📚 đã học: anh từng bỏ</div>`;
      else if (o._learn === 'dung') note = `<div class="learnY">📚 đã học: anh từng giữ</div>`;
      else if (o._learn === 'conflict') note = `<div class="mini" style="color:#b8860b">📚 đã học: mâu thuẫn — xem lại</div>`;
      else if (o.lech) note = `<div class="mini" style="color:#b8860b">⚠ ${esc(o.lech)}</div>`;
      html.push(`<tr class="${cls}">
        <td><input type="checkbox" data-i="${i}" data-def="${def ? 1 : 0}" ${def ? 'checked' : ''}></td>
        <td>${tag}</td>
        <td>${esc(o.work)}${note}</td>
        <td>${esc(o.desc)}</td>
        <td>${esc(o.incContent)}</td>
        <td>${o.incDate || ''}</td></tr>`);
    });
    html.push('</tbody></table>');
    $('#lksc-tbl').innerHTML = rows.length ? html.join('') : '<div class="mini" style="padding:8px">Không có dòng nào theo bộ lọc.</div>';
  }

  $('#lksc-fa').onchange = $('#lksc-fb').onchange = $('#lksc-fl').onchange = render;

  $('#lksc-run').onclick = async () => {
    const btn = $('#lksc-run'); btn.disabled = true; btn.textContent = 'Đang ghép...';
    $('#lksc-st').textContent = 'Đang nạp lưới & sự cố theo tủ...';
    try {
      STORE = LRN.load(window.localStorage); // nạp lại bộ nhớ học mới nhất
      DATA = await buildMatches();
      const cnt = { A: 0, L: 0, B: 0, '-': 0 };
      DATA.out.forEach(o => { cnt[bucket(o)]++; });
      const learnedN = DATA.out.filter(o => o._learn === 'sai' || o._learn === 'dung').length;
      $('#lksc-st').textContent =
        `Quận: ${DATA.dist.join(', ') || '(không rõ)'}\n` +
        `Tổng công việc: ${DATA.tong} | Đã liên kết sẵn: ${DATA.daLienKet} | Chưa liên kết: ${DATA.chuaLienKet}\n` +
        `Gợi ý lưu (A): ${cnt.A} | Lệch/đã học bỏ: ${cnt.L} | B: ${cnt.B} | Không có SC: ${cnt['-']}` +
        (learnedN ? `\n📚 Áp dụng ${learnedN} dòng theo bộ nhớ đã học.` : '');
      $('#lksc-save').disabled = false; $('#lksc-csv').disabled = false;
      updateLearnBtn();
      render();
    } catch (e) {
      $('#lksc-st').textContent = 'Lỗi: ' + (e && e.message || e);
    }
    btn.disabled = false; btn.textContent = '1) Ghép thử (quận đang lọc)';
  };

  $('#lksc-save').onclick = async () => {
    // --- TỰ HỌC: so đề xuất (data-def) với tick cuối của anh, trên các dòng đang hiển thị ---
    const boxes = [...box.querySelectorAll('#lksc-tbl input[type=checkbox]')];
    const diffRows = boxes.map(c => { const o = DATA.out[+c.dataset.i]; return { key: o._learnKey || LRN.keyOf(o), def: c.dataset.def === '1', fin: c.checked, work: o.work, incContent: o.incContent }; });
    const learned = LRN.learnFromDiff(diffRows, STORE);
    if (learned) { LRN.save(window.localStorage, STORE); updateLearnBtn(); }

    const picks = boxes.filter(c => c.checked).map(c => DATA.out[+c.dataset.i]).filter(o => o && o.incId);
    if (!picks.length) {
      $('#lksc-st').textContent = (learned ? `📚 Đã ghi nhớ ${learned} chỉnh sửa. ` : '') + 'Không có dòng nào được tick để lưu liên kết.';
      return;
    }
    if (!confirm(`Lưu liên kết cho ${picks.length} công việc?` + (learned ? `\n(Đã ghi nhớ ${learned} chỉnh sửa của anh.)` : ''))) return;
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
      (learned ? `📚 Đã ghi nhớ ${learned} chỉnh sửa (áp dụng lần sau).\n` : '') +
      `Đã lưu: ${log.ok} thành công | ${log.daCo} đã có sự cố (bỏ qua) | lỗi: ${log.loi.length} | khác: ${log.khac.length}\n` +
      `Kiểm tra lại: ${dungMa}/${picks.length} dòng đúng mã sau khi tải lưới.\n` +
      ((log.loi.length || log.khac.length) ? 'CHI TIẾT LỖI: ' + log.loi.concat(log.khac).join('; ') : 'Không có lỗi.');
    btn.disabled = false; btn.textContent = '2) Lưu dòng đã chọn';
  };

  $('#lksc-csv').onclick = () => {
    if (!DATA) return;
    const rows = DATA.out.filter(o => bucket(o) !== '-');
    const head = ['Nhom', 'DaHoc', 'Lech', 'MaCV', 'Ngay', 'Tu', 'HangMuc', 'MoTa', 'MaSuCo', 'NgaySuCo', 'NoiDungSuCo'];
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [head.join(',')].concat(rows.map(o => [bucket(o), o._learn || '', o.lech || '', o.id, o.date, o.cab, o.work, o.desc, o.incId || '', o.incDate, o.incContent].map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'lien-ket-su-co-' + (DATA.dist[0] || 'quan').replace(/\s+/g, '_') + '.csv'; a.click();
  };

  // ---------- Bảng quản lý "Đã học" ----------
  const RELLABEL = { '': 'cùng vị trí', lo_diff: 'khác Lô', hem_cau: 'hẻm ↔ cầu', street_diff: 'khác đường' };
  const VDLABEL = { sai: ['BỎ', 'vd-sai'], dung: ['GIỮ', 'vd-dung'], conflict: ['mâu thuẫn', 'vd-conflict'] };

  $('#lksc-learn').onclick = openManager;

  function openManager() {
    const keys = Object.keys(STORE.rules || {});
    const rowsHtml = keys.map(k => {
      const r = STORE.rules[k]; const [wt, it, rl] = k.split(LRN.SEP);
      const v = LRN.verdict(r) || 'conflict'; const [vl, vc] = VDLABEL[v] || ['?', ''];
      const ex = [r.lastWork, r.lastInc].filter(Boolean).join(' → ');
      return `<tr>
        <td>${esc(wt)}</td><td>${esc(it)}</td><td>${esc(RELLABEL[rl] != null ? RELLABEL[rl] : rl)}</td>
        <td class="${vc}">${vl}</td><td style="text-align:center">${r.pos || 0}/${r.neg || 0}</td>
        <td>${esc(ex)}</td>
        <td style="text-align:center"><button class="del" data-k="${esc(k)}" title="Xóa luật">🗑</button></td></tr>`;
    }).join('');
    const ov = document.createElement('div'); ov.id = 'lkscM';
    ov.innerHTML = `<div class="mw">
      <div class="mh"><span>📚 Bộ nhớ đã học (${keys.length} luật)</span><span class="x" style="cursor:pointer">✕</span></div>
      <div class="mb">
        <div class="mini">App học từ chỉnh sửa của anh: BỎ = anh từng bỏ tick (sẽ tự bỏ lần sau), GIỮ = anh từng giữ (sẽ tự tick). Cột giữ/bỏ = số lần. Lưu trên máy này.</div>
        <table><thead><tr><th>Loại việc</th><th>Loại sự cố</th><th>Vị trí</th><th>Kết luận</th><th>Giữ/Bỏ</th><th>Ví dụ gần nhất</th><th></th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="7" class="mini" style="text-align:center;padding:14px">Chưa học luật nào. Hãy ghép thử, sửa tick rồi bấm Lưu.</td></tr>'}</tbody></table>
        <div class="foot">
          <button class="bg" id="lksc-exp">⬇ Xuất JSON</button>
          <button class="bg" id="lksc-imp">⬆ Nhập JSON</button>
          <button class="bg" id="lksc-clr" style="color:#b02a37">Xóa tất cả</button>
          <input type="file" id="lksc-impf" accept="application/json,.json" style="display:none">
        </div>
      </div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('.x').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelectorAll('.del').forEach(b => b.onclick = () => {
      delete STORE.rules[b.dataset.k]; LRN.save(window.localStorage, STORE); updateLearnBtn();
      if (DATA) { DATA.out.forEach(o => { if (o.incId) LRN.applyLearn(o, STORE); }); render(); }
      close(); openManager();
    });
    ov.querySelector('#lksc-exp').onclick = () => {
      const blob = new Blob([JSON.stringify({ version: 1, rules: STORE.rules }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'lksc-da-hoc-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    };
    ov.querySelector('#lksc-imp').onclick = () => ov.querySelector('#lksc-impf').click();
    ov.querySelector('#lksc-impf').onchange = ev => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(rd.result);
          if (!d || !d.rules || typeof d.rules !== 'object') throw new Error('File không đúng định dạng.');
          let n = 0; for (const k in d.rules) { STORE.rules[k] = d.rules[k]; n++; }
          LRN.save(window.localStorage, STORE); updateLearnBtn();
          if (DATA) { DATA.out.forEach(o => { if (o.incId) LRN.applyLearn(o, STORE); }); render(); }
          close(); openManager();
          alert('Đã nhập ' + n + ' luật.');
        } catch (e) { alert('Lỗi nhập JSON: ' + (e && e.message || e)); }
      };
      rd.readAsText(f);
    };
    ov.querySelector('#lksc-clr').onclick = () => {
      if (!confirm('Xóa toàn bộ bộ nhớ đã học?')) return;
      STORE.rules = {}; LRN.save(window.localStorage, STORE); updateLearnBtn();
      if (DATA) { DATA.out.forEach(o => { if (o.incId) LRN.applyLearn(o, STORE); }); render(); }
      close(); openManager();
    };
  }

})();
