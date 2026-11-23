// Test "báo có bản mới trên panel" (SMHUPD) cho cả 3 công cụ — Node + Playwright
const { chromium } = require('playwright'); const fs = require('fs');
const U = require('../src/upd.js');
const ROOT = __dirname + '/../..';
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n); } };

// ---- Lõi thuần ----
ok(U.cmp('1.2.1', '1.2.0') === 1 && U.cmp('1.2.0', '1.2.1') === -1 && U.cmp('1.2', '1.2.0') === 0, 'so phiên bản cơ bản');
ok(U.cmp('1.10.0', '1.9.9') === 1, 'so theo số, không theo chữ (1.10 > 1.9)');
ok(U.cmp('2.0', '1.99.99') === 1 && U.cmp('', '1.0') === -1, 'so phiên bản biên');
ok(U.parse('// ==UserScript==\n// @name x\n// @version      1.3.0\n// ==/UserScript==') === '1.3.0', 'đọc @version từ header');
ok(U.parse('<html>404: Not Found</html>') === null && U.parse('') === null && U.parse(null) === null, 'trang lỗi → không có phiên bản');
ok(U.parse('// @version 9.9.9'.padStart(5000, ' ')) === null, 'chỉ đọc phần đầu file (header)');
const now = 1e12, H = 3600e3;
ok(U.due({}, now, '1.0.0') && U.due(null, now, '1.0.0'), 'chưa kiểm lần nào → kiểm');
ok(!U.due({ t: now - 10 * 60e3, v: '1.0.0' }, now, '1.0.0'), 'vừa kiểm trong 30 phút → không tải lại');
ok(U.due({ t: now - H, v: '1.0.0' }, now, '1.0.0'), 'quá 30 phút → kiểm lại');
ok(U.due({ t: now - 60e3, v: '1.0.0' }, now, '1.1.0'), 'vừa cập nhật lên bản mới hơn bộ nhớ → kiểm lại');
ok(U.wanted({}, '1.1.0', '1.0.0', now) && !U.wanted({}, '1.0.0', '1.0.0', now) && !U.wanted({}, '0.9', '1.0.0', now) && !U.wanted({}, null, '1.0.0', now), 'chỉ báo khi bản trên GitHub mới hơn');
ok(!U.wanted({ skipV: '1.1.0', skipT: now - H }, '1.1.0', '1.0.0', now), '"Để sau" → ẩn 24 giờ');
ok(U.wanted({ skipV: '1.1.0', skipT: now - 25 * H }, '1.1.0', '1.0.0', now), 'quá 24 giờ → báo lại');
ok(U.wanted({ skipV: '1.1.0', skipT: now - H }, '1.2.0', '1.0.0', now), 'có bản mới hơn nữa → báo ngay dù đã "Để sau"');

// ---- Đoạn mã giống hệt nhau ở 3 file ----
const block = s => { const a = s.indexOf('/* ===== SMHUPD v1'), b = s.indexOf('/* ===== /SMHUPD ===== */'); return a >= 0 && b > a ? s.slice(a, b) : null; };
const TOOLS = [
  { f: 'kiem-tra-mo-ta-anh.user.js', panel: '#ktma-pn', key: 'ktma' },
  { f: 'lien-ket-su-co-smarthcm.user.js', panel: '#lksc', key: 'lksc' },
  { f: 'bao-cao-duytu-ngay.user.js', panel: '#bcdt', key: 'bcdt' },
];
TOOLS.forEach(t => { t.src = fs.readFileSync(ROOT + '/' + t.f, 'utf8'); t.ver = /\/\/ @version\s+(\S+)/.exec(t.src)[1]; t.raw = /\/\/ @updateURL\s+(\S+)/.exec(t.src)[1]; });
const B0 = block(fs.readFileSync(__dirname + '/../src/upd.js', 'utf8'));
TOOLS.forEach(t => ok(block(t.src) === B0, t.f + ': đoạn SMHUPD giống bản gốc src/upd.js'));
TOOLS.filter(t => t.key !== 'ktma').forEach(t => ok(t.src.includes("|| '" + t.ver + "', host: box"), t.f + ': số phiên bản dự phòng = @version ' + t.ver));
TOOLS.forEach(t => ok(/raw\.githubusercontent\.com\/neo-era\/lien-ket-su-co-smarthcm\/main\/.+\.user\.js$/.test(t.raw), t.f + ': @updateURL trỏ GitHub main'));

const bump = v => v.split('.').map((x, i, a) => i === a.length - 1 ? +x + 1 : x).join('.');
const PAGE = '<!doctype html><html><head><meta charset="utf-8"></head><body><div>Khoảng: <input value="01/11/2026 - 30/11/2026"></div>'
  + '<script>window.gridOptions={api:{forEachNode:function(){},getModel:function(){return{getType:function(){return"clientSide"}}}}};window.LBCS={Core:{},Service:{MaintenanceSvc:{}}};</script></body></html>';

(async () => {
  const b = await chromium.launch();
  for (const t of TOOLS) {
    async function open(remote, ctx) {
      ctx = ctx || await b.newContext({ viewport: { width: 1366, height: 800 } });
      ctx.__hits = ctx.__hits || [];
      await ctx.unroute('https://raw.githubusercontent.com/**').catch(() => { });
      await ctx.route('https://www.smarthcm.city/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE }));
      await ctx.route('https://raw.githubusercontent.com/**', r => {
        ctx.__hits.push(r.request().url());
        if (remote === 'net') return r.abort();
        if (remote === '404') return r.fulfill({ status: 404, body: '404: Not Found' });
        return r.fulfill({ contentType: 'text/plain; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: '// ==UserScript==\n// @name x\n// @version      ' + remote + '\n// ==/UserScript==\n' });
      });
      const p = await ctx.newPage(); p.__errs = []; p.on('pageerror', e => p.__errs.push(e.message));
      await p.goto('https://www.smarthcm.city/Maintenance/TaskListNew'); await p.addScriptTag({ content: t.src });
      await p.waitForSelector(t.panel); await p.waitForTimeout(600);
      return { ctx, p };
    }
    const nv = bump(t.ver);
    // 1) Có bản mới → hiện dòng báo trong panel
    let { ctx, p } = await open(nv);
    const sel = t.panel + ' .smh-upd';
    ok(await p.isVisible(sel), t.key + ': có bản mới → hiện dòng báo');
    const txt = await p.textContent(sel);
    ok(txt.includes('v' + nv) && txt.includes('v' + t.ver), t.key + ': ghi rõ bản mới và bản đang dùng: ' + txt);
    ok(await p.getAttribute(sel + ' .go', 'href') === t.raw, t.key + ': nút Cập nhật mở đúng link cài .user.js');
    ok(ctx.__hits.length === 1 && /\?t=\d+$/.test(ctx.__hits[0]) && ctx.__hits[0].startsWith(t.raw), t.key + ': tải 1 lần, chống bộ nhớ đệm');
    ok(await p.evaluate(s => { const d = document.querySelector(s), hd = d.parentNode.querySelector('.hd'); return !hd || hd.nextElementSibling === d; }, sel), t.key + ': nằm ngay dưới thanh tiêu đề panel');
    // Bấm Cập nhật → mở tab mới + hướng dẫn
    const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click(sel + ' .go')]);
    ok(pop.url().startsWith(t.raw), t.key + ': mở tab cài đặt'); await pop.close();
    ok(/Update.*Ctrl \+ F5/.test(await p.textContent(sel)), t.key + ': hướng dẫn bấm Update rồi Ctrl+F5');
    // Để sau → ẩn, tải lại trang không báo trong 24h, không tải lại GitHub trong 30 phút
    await p.reload(); await p.addScriptTag({ content: t.src }); await p.waitForSelector(sel);
    await p.click(sel + ' .sk'); ok(!(await p.$(sel)), t.key + ': "Để sau" → ẩn ngay');
    const hits = ctx.__hits.length;
    await p.reload(); await p.addScriptTag({ content: t.src }); await p.waitForSelector(t.panel); await p.waitForTimeout(600);
    ok(!(await p.$(sel)), t.key + ': đã "Để sau" → mở lại trang không báo');
    ok(ctx.__hits.length === hits, t.key + ': trong 30 phút không tải lại GitHub (' + (ctx.__hits.length - hits) + ')');
    ok(!p.__errs.length, t.key + ': không lỗi JS ' + p.__errs.join(' | '));
    await ctx.close();
    // 2) Cùng bản → không báo
    ({ ctx, p } = await open(t.ver)); ok(!(await p.$(sel)), t.key + ': cùng phiên bản → không báo'); await ctx.close();
    // 3) GitHub cũ hơn (bộ nhớ đệm CDN) → không báo
    ({ ctx, p } = await open('0.9.0')); ok(!(await p.$(sel)), t.key + ': bản GitHub cũ hơn → không báo'); await ctx.close();
    // 4) Lỗi mạng / 404 → im lặng, panel vẫn chạy
    for (const bad of ['net', '404']) {
      ({ ctx, p } = await open(bad));
      ok(!(await p.$(sel)) && await p.isVisible(t.panel) && !p.__errs.length, t.key + ': ' + bad + ' → không báo, không lỗi');
      await ctx.close();
    }
  }
  await b.close();
  console.log('upd: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('LỖI', e.message.split('\n')[0]); process.exit(1); });
