/* ===== SMHUPD v1 — báo có bản mới trên panel (dùng chung 3 công cụ SmartHCM, giữ nguyên văn ở cả 3 file) ===== */
var SMHUPD = (function () {
  'use strict';
  var EVERY = 30 * 60 * 1000, SNOOZE = 24 * 60 * 60 * 1000;
  function cmp(a, b) {
    a = String(a || '').split('.'); b = String(b || '').split('.');
    for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = parseInt(a[i], 10) || 0, y = parseInt(b[i], 10) || 0; if (x !== y) return x > y ? 1 : -1; }
    return 0;
  }
  function parse(txt) { var m = /\/\/\s*@version\s+(\d+(?:\.\d+)*)/.exec(String(txt || '').slice(0, 4000)); return m ? m[1] : null; }
  function due(st, now, cur) { return !(st && st.t && st.v && now - st.t < EVERY && cmp(st.v, cur) >= 0); }
  function wanted(st, v, cur, now) { return !!v && cmp(v, cur) > 0 && !(st && st.skipV === v && now - (st.skipT || 0) < SNOOZE); }
  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch (e) { return {}; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function show(o, v, K) {
    if (!o.host || !o.host.isConnected || o.host.querySelector('.smh-upd')) return;
    var A = 'cursor:pointer;color:#0b5ed7;text-decoration:underline;font-weight:700;background:none;border:0;padding:0';
    var d = document.createElement('div'); d.className = 'smh-upd'; d.setAttribute('role', 'status');
    d.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 10px 0;padding:7px 10px;border-radius:8px;background:#fff3cd;border:1px solid #ffda6a;color:#664d03;font:600 12.5px/1.4 system-ui,"Segoe UI",Arial,sans-serif;text-align:left';
    d.innerHTML = '<span class="m">🔔 Có bản mới v' + esc(v) + ' (đang dùng v' + esc(o.cur) + ')</span>'
      + '<a class="go" href="' + esc(o.raw) + '" target="_blank" rel="noopener" style="' + A + '">Cập nhật</a>'
      + '<a class="sk" href="#" style="' + A + ';color:#6c757d;font-weight:600">Để sau</a>';
    d.querySelector('.go').addEventListener('click', function () {
      d.querySelector('.m').textContent = '↻ Bấm "Update" ở tab Tampermonkey vừa mở, rồi nhấn Ctrl + F5 trang này.';
      d.querySelector('.go').remove(); d.querySelector('.sk').textContent = 'Đóng';
    });
    d.querySelector('.sk').addEventListener('click', function (e) {
      e.preventDefault(); var st = get(K); st.skipV = v; st.skipT = Date.now(); put(K, st); d.remove();
    });
    var hd = o.host.querySelector('.hd'); o.host.insertBefore(d, hd ? hd.nextSibling : o.host.firstChild);
  }
  // o: { key, raw (link .user.js trên GitHub), cur (bản đang chạy), host (panel) }
  function check(o) {
    if (!o || !o.raw || !o.cur || !/^\d/.test(o.cur) || typeof fetch !== 'function') return Promise.resolve(null);
    var K = 'smhupd_' + o.key, now = Date.now(), st = get(K);
    if (!due(st, now, o.cur)) { if (wanted(st, st.v, o.cur, now)) show(o, st.v, K); return Promise.resolve(st.v); }
    return fetch(o.raw + '?t=' + now, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        var v = parse(t); st = get(K); st.t = now; if (v) st.v = v; put(K, st);
        if (wanted(st, v, o.cur, now)) show(o, v, K);
        return v;
      })
      .catch(function () { return null; });
  }
  return { check: check, cmp: cmp, parse: parse, due: due, wanted: wanted };
})();
/* ===== /SMHUPD ===== */
if (typeof module !== 'undefined' && module.exports) module.exports = SMHUPD;
