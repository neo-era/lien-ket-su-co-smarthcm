// Test tích hợp giao diện trên trang SmartHCM giả (Playwright): lưới gridOptions + API LBCS + ảnh CDN giả
const { chromium } = require('playwright'); const fs = require('fs'); const zlib = require('zlib'); const { execSync } = require('child_process');
const US = fs.readFileSync(__dirname + '/../../kiem-tra-mo-ta-anh.user.js', 'utf8');
const SHOT = process.env.SHOT || '/tmp/ktshots'; fs.mkdirSync(SHOT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n); } };
function png(w, h, rgb) { // ảnh PNG đơn sắc
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; } }
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const D = (y, m, d, h) => '/Date(' + Date.UTC(y, m - 1, d, h || 3) + ')/';
let id = 5000;
function R(o) { id++; return Object.assign({ Id: id, Description: 'Thay bóng trụ số ' + id, CreatedAt: D(2026, 10, 31), Quantity: 1, CabinetId: 1, Latitude: 10.78, Longitude: 106.69,
  Cabinet: { BoxName: 'Q3-047', PENumber: 'PE1234', Road: 'Võ Thị Sáu', Ward: 'Võ Thị Sáu', District: 'Quận 3' }, MaintScheduleDetail: { MaintWork: { Name: 'Thay bóng' } },
  Image1: 'h' + id + '.jpg', Image2: 't' + id + '.jpg', Image3: 'c' + id + '.jpg', ImagePath: '2026/10/' + id }, o); }
const rows = [R({ Description: 'Thay bóng đường Lê Duẫn' }), R({ Description: 'Thay bóng đường Lê Duẫn' }), R({ Description: 'Sơn trụ tr 7 Cô Giang', MaintScheduleDetail: { MaintWork: { Name: 'Sơn trụ' } } }),
  R({ Description: 'Thay chóa trụ số 3 Lê Lợi' }), R({ Description: '<img src=x onerror=alert(1)>' }), R({ Description: 'Thiếu ảnh', Image1: null, CreatedAt: D(2026, 10, 30) }),
  R({ Description: 'Tháo băng rôn trụ số 2,đường Lê Lợi', MaintScheduleDetail: { MaintWork: { Name: 'Tháo gỡ băng rôn' } } })];
rows.push(R({ Description: 'Lắp đặt bộ đèn', ParentTaskId: rows[2].Id, Image1: rows[2].Image1, Image3: rows[2].Image3, MaintScheduleDetail: { MaintWork: { Name: 'Lắp đặt bộ đèn' } } }));
const kvtt = { 1: [R({ Description: 'Thay bóng Q1', Cabinet: { BoxName: 'Q1-1', Road: 'Lê Lợi' } })], 14: [R({ Description: 'Thay bóng BT', Cabinet: { BoxName: 'BT-1', Road: 'Đinh Bộ Lĩnh' } }), R({ Description: 'Thay bong duong le loi', Cabinet: { BoxName: 'BT-2' } })] };
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>SCP</title></head><body style="margin:0;font-family:Arial">
<div style="background:#2c4a7c;color:#fff;padding:12px">SCP® · Quản lý công việc duy tu</div><div style="padding:10px">Khoảng thời gian: <input id="dr" value="01/10/2026 - 31/10/2026"></div>
<div style="height:600px;background:#fbfdf6;margin:10px;border:1px solid #ccd"></div>
<script>window.__ROWS=${JSON.stringify(rows)};window.__KV=${JSON.stringify(kvtt)};
window.gridOptions={api:{forEachNode:f=>window.__ROWS.forEach(d=>f({data:d})),getModel:()=>({getType:()=>'clientSide'})}};
window.LBCS={Service:{MaintenanceSvc:{ListMaintTaskNew:(flt,ok,er)=>{const k=Object.keys(flt.Districts)[0];window.__lastFilter=flt;if(k==='8'){er('x');return;}setTimeout(()=>ok(JSON.parse(JSON.stringify(window.__KV[k]||[]))),20);}}}};</script></body></html>`;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true, timezoneId: 'Asia/Ho_Chi_Minh' });
  await ctx.route('https://www.smarthcm.city/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE }));
  const imgs = []; await ctx.route('https://cdn.smartiot.city/**', r => { imgs.push(r.request().url()); const u = r.request().url(); if (/c5003/.test(u) && !/r=1/.test(u)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ contentType: 'image/png', body: png(64, 48, /\/h/.test(u) ? [180, 60, 60] : /\/t/.test(u) ? [60, 160, 60] : [60, 60, 180]) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept(d.message().startsWith('Lỗi') ? 'Thiếu chữ "đường"' : d.type() === 'confirm' ? undefined : 'Thay chóa trụ số 3 đường Lê Lợi'));
  await p.goto('https://www.smarthcm.city/Maintenance/TaskListNew'); await p.addScriptTag({ content: US });
  ok(await p.isVisible('#ktma-pn'), 'panel hiện');
  // Trang khác không chạy
  const p2 = await ctx.newPage(); await p2.goto('https://www.smarthcm.city/Home'); await p2.addScriptTag({ content: US }); ok(!(await p2.$('#ktma-pn')), 'trang khác không hiện panel'); await p2.close();
  await p.screenshot({ path: SHOT + '/1-panel.png' });
  await p.click('[data-a=run]'); await p.waitForSelector('#ktma-res');
  ok(/Chính tả \(\d+\)/.test(await p.textContent('#ktma-res .k-tabs')), 'tab chính tả có số');
  const S = () => p.evaluate(() => { const S = window.__ktma.S; return { n: S.rows.length, quan: S.quan, day: S.day, list: S.list.length, auto: S.auto.map(a => a.loai), items: S.sp.items.map(i => i.s), un: S.sp.unflag, k1: document.querySelector('#ktma-k1').textContent, k3: document.querySelector('#ktma-k3').textContent, st: document.querySelector('#ktma-st').textContent }; });
  let s = await S();
  ok(s.n === 8 && s.quan === 'Quận 3', 'nạp 8 CV Quận 3: ' + s.n + ' ' + s.quan);
  ok(s.day === '2026-10-31' && s.list === 7, 'ngày xem ảnh mặc định = ngày gần nhất (7 CV): ' + s.day + ' ' + s.list);
  ok(s.auto.includes('Thiếu ảnh'), 'kiểm tra tự động thiếu ảnh');
  ok(!s.auto.some(a => /Trùng ảnh/.test(a)), 'CV con dùng chung ảnh không báo trùng');
  ok(s.items.includes('Thay bóng đường Lê Duẫn') && s.items.includes('Sơn trụ tr 7 Cô Giang'), 'có lỗi chính tả');
  ok(/01\/10\/2026 - 31\/10\/2026/.test(s.st), 'đọc khoảng ngày trên trang');
  ok(!(await p.$('#ktma-res img')), 'mô tả chứa HTML được escape (không sinh thẻ img)');
  await p.screenshot({ path: SHOT + '/2-chinhta.png' });
  // Bỏ lỗi tr 7 (báo nhầm), sửa đề xuất Lê Duẫn
  await p.click('.k-chip:has-text("tr 7")'); ok(await p.isVisible('.k-chip.k-off:has-text("tr 7")'), 'bấm chip → tắt');
  const de = await p.$('.k-de[data-de="' + s.items.indexOf('Thay bóng đường Lê Duẫn') + '"]'); await de.click(); await p.keyboard.press('End'); await p.keyboard.type(' (đã kiểm)'); await p.keyboard.press('Enter');
  // + Báo lỗi ở tab Không báo
  await p.click('[data-tab=kb]'); await p.click('[data-add="Thay chóa trụ số 3 Lê Lợi"]'); ok(/chưa ghi nhớ/.test(await p.textContent('#ktma-res .body')), 'thêm lỗi chờ ghi nhớ');
  await p.click('[data-r=commit]'); await p.waitForSelector('#ktma-toast'); const tt = await p.textContent('#ktma-toast'); ok(/Đã ghi nhớ 3/.test(tt), 'ghi nhớ 3 chỉnh sửa: ' + tt);
  const L = await p.evaluate(() => JSON.parse(localStorage.getItem('ktma_learn_v1'))); ok(Object.keys(L.rules).length === 1 && Object.keys(L.de).length === 1 && Object.keys(L.add).length === 1, 'localStorage có luật học');
  // Chạy lại: tự áp
  await p.click('[data-a=run]'); await p.waitForTimeout(300); await p.click('[data-tab=ct]');
  const body = await p.textContent('#ktma-res .body'); ok(/đã học: bỏ/.test(body) && /đã kiểm/.test(body) && /Thiếu chữ "đường"/.test(body), 'chạy lại thấy nhãn 📚 + đề xuất + lỗi đã thêm');
  ok(await p.isVisible('.k-chip.k-off:has-text("tr 7")'), 'lỗi tr 7 mặc định tắt');
  await p.screenshot({ path: SHOT + '/3-dahoc-bang.png' });
  // Màn xem ảnh
  await p.click('[data-tab=anh]'); await p.click('[data-r=review]'); await p.waitForSelector('#ktma-rv');
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT + '/4-xemanh.png' });
  ok(/\[1\/7\]/.test(await p.textContent('#ktma-rv .rh')), 'mở CV 1/7');
  ok((await p.$$('#ktma-rv .im img')).length === 3, '3 ảnh Hiện trạng/Thi công/Hoàn thành');
  ok(imgs.some(u => /c5003\.jpg\?r=1/.test(u)), 'ảnh lỗi tải → tự thử lại 1 lần');
  ok(imgs.some(u => /mainttasks\/2026\/10\/\d+\/h\d+\.jpg/.test(u)), 'URL ảnh đúng mẫu CDN');
  await p.keyboard.press('1'); ok(/\[2\/7\]/.test(await p.textContent('#ktma-rv .rh')), 'phím 1 → KHỚP, sang CV 2');
  await p.keyboard.press('2'); ok(/\[2\/7\]/.test(await p.textContent('#ktma-rv .rh')), 'KHÔNG KHỚP thiếu ghi chú → không chuyển');
  ok(await p.evaluate(() => document.activeElement.id === 'ktma-note'), 'con trỏ vào ô ghi chú');
  await p.keyboard.type('Ảnh HT là trụ khác (số 9)'); await p.keyboard.press('Escape'); await p.keyboard.press('2');
  ok(/\[3\/7\]/.test(await p.textContent('#ktma-rv .rh')), 'có ghi chú → lưu KHÔNG KHỚP, sang CV 3');
  await p.keyboard.press('z'); ok(await p.isVisible('#ktma-rv .big.on'), 'Z phóng ảnh'); await p.click('#ktma-rv .big img'); ok(await p.isVisible('#ktma-rv .big.z'), 'bấm ảnh phóng 2,4×');
  await p.screenshot({ path: SHOT + '/5-phongto.png' });
  await p.keyboard.press('Escape'); ok(!(await p.isVisible('#ktma-rv .big.on')), 'Esc thoát phóng');
  await p.keyboard.press('ArrowLeft'); ok(/\[2\/7\]/.test(await p.textContent('#ktma-rv .rh')), '← quay lại');
  ok((await p.inputValue('#ktma-note')) === 'Ảnh HT là trụ khác (số 9)', 'ghi chú được lưu');
  // CV con
  const ix = await p.evaluate(() => window.__ktma.S.list.findIndex(r => r.ParentTaskId));
  await p.evaluate(i => window.__ktma.openReview(i), ix); ok(/CV CON của #/.test(await p.textContent('#ktma-rv .rh')), 'nhãn CV con');
  await p.screenshot({ path: SHOT + '/6-cvcon.png' });
  // ảnh lỗi 404 → thử lại 1 lần (lần 2 thành công)
  await p.keyboard.press('Escape'); ok(!(await p.$('#ktma-rv')), 'Esc đóng màn xem ảnh');
  s = await S(); ok(s.k3 === '2/7', 'KPI ảnh đã xem 2/7: ' + s.k3);
  // Tải lại trang: kết quả xem ảnh còn
  await p.reload(); await p.addScriptTag({ content: US }); await p.click('[data-a=run]'); await p.waitForSelector('#ktma-res'); s = await S(); ok(s.k3 === '2/7', 'tải lại trang vẫn giữ kết quả xem ảnh');
  // Xuất Excel
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-a=xlsx]')]);
  const fp = '/tmp/kt_ui.xlsx'; await dl.saveAs(fp); ok(/KiemTra_MoTa_Anh_Quan3_2026-10-31\.xlsx/.test(dl.suggestedFilename()), 'tên file ' + dl.suggestedFilename());
  const o = JSON.parse(execSync('python3 -', { input: `import openpyxl,json\nwb=openpyxl.load_workbook('${fp}')\nprint(json.dumps({'n':wb.sheetnames,'ct':[[c.value for c in r] for r in wb['Chinh_ta'].iter_rows(values_only=False)],'anh':[[c.value for c in r] for r in wb['So_anh'].iter_rows()],'dl':wb['Kiem_tra_du_lieu'].max_row,'t':[[c.value for c in r] for r in wb['Tong_hop'].iter_rows()]},ensure_ascii=False,default=str))` }).toString());
  ok(o.n.join() === 'Tong_hop,Chinh_ta,So_anh,Kiem_tra_du_lieu', 'đủ 4 sheet');
  ok(o.anh.length === 3 && o.anh.some(r => r[5] === 'KHÔNG KHỚP' && /trụ khác/.test(r[6])), 'So_anh có KHÔNG KHỚP + bằng chứng');
  ok(o.ct.some(r => r[2] === 'Thay bóng đường Lê Duẫn' && /đã kiểm/.test(r[6]) && /đã học/.test(r[7])), 'Chinh_ta dùng đề xuất đã học');
  ok(!o.ct.some(r => r[2] === 'Sơn trụ tr 7 Cô Giang'), 'lỗi đã bỏ không vào Excel');
  ok(o.ct.some(r => r[2] === 'Thay chóa trụ số 3 Lê Lợi' && r[7] === 'Người kiểm'), 'lỗi người kiểm thêm vào Excel');
  ok(o.t.some(r => r[0] === 'KHÔNG KHỚP' && r[1] === 1), 'Tong_hop đếm KHÔNG KHỚP');
  // Bảng Đã học: xoá 1 luật
  await p.click('[data-a=learn]'); await p.waitForSelector('#ktma-md'); await p.screenshot({ path: SHOT + '/7-dahoc.png' });
  const n0 = (await p.$$('#ktma-md [data-del]')).length; await p.click('#ktma-md [data-del="0"]'); const n1 = (await p.$$('#ktma-md [data-del]')).length; ok(n0 === 3 && n1 === 2, 'xoá luật: ' + n0 + '→' + n1);
  const [dj] = await Promise.all([p.waitForEvent('download'), p.click('#ktma-md [data-l=exp]')]); ok(/DaHoc.*\.json$/.test(dj.suggestedFilename()), 'xuất JSON');
  await p.click('#ktma-md [data-l=x]');
  // Toàn KVTT
  await p.click('[data-m=all]'); await p.click('[data-a=run]'); await p.waitForFunction(() => window.__ktma.S.quan === 'Toàn KVTT' && !document.querySelector('[data-a=run]').disabled, null, { timeout: 5000 });
  s = await S(); ok(s.n === 3, 'KVTT gộp 3 CV từ các quận: ' + s.n); ok(/Lỗi tải: Quận 8/.test(s.st), 'báo quận lỗi tải');
  const flt = await p.evaluate(() => window.__lastFilter); ok(flt.Districts['16'] === 16 && flt.StartDate === '2026-09-30T17:00:00.000Z' && flt.EndDate === '2026-10-31T16:59:59.000Z', 'bộ lọc API đúng (Districts[id]=id, khoảng ngày theo giờ VN): ' + flt.StartDate + ' ' + flt.EndDate);
  ok(s.items.includes('Thay bong duong le loi'), 'KVTT soát chính tả');
  await p.evaluate(() => document.querySelector('#ktma-res') || 0); await p.screenshot({ path: SHOT + '/8-kvtt.png' });

  // ---- hồi quy sau review ----
  ok(await p.evaluate(() => !('_day' in window.__ROWS[0])), 'không ghi trường lạ vào dữ liệu lưới của trang');
  // Z rồi kết luận: Esc một lần là đóng
  await p.click('[data-m=cur]'); await p.click('[data-a=run]'); await p.waitForTimeout(200);
  await p.evaluate(() => window.__ktma.openReview(3)); await p.keyboard.press('z'); await p.keyboard.press('1'); await p.keyboard.press('Escape');
  ok(!(await p.$('#ktma-rv')), 'sau khi phóng ảnh rồi kết luận, Esc 1 lần đóng màn xem');
  // Xuất khi còn chỉnh sửa chưa ghi nhớ → hỏi; Huỷ → không học
  await p.click('[data-tab=ct]'); await p.click('.k-chip:has-text("Lê Duẫn")');
  const before = await p.evaluate(() => localStorage.getItem('ktma_learn_v1'));
  p.removeAllListeners('dialog'); let asked = ''; p.on('dialog', d => { asked = d.message(); d.dismiss(); });
  const [dx] = await Promise.all([p.waitForEvent('download'), p.click('[data-a=xlsx]')]);
  ok(/chưa ghi nhớ/.test(asked), 'xuất Excel hỏi trước khi ghi nhớ');
  ok(before === await p.evaluate(() => localStorage.getItem('ktma_learn_v1')), 'chọn Huỷ → không ghi nhớ');
  // Dữ liệu học độc hại / hỏng
  const p3 = await ctx.newPage(); const e3 = []; p3.on('pageerror', e => e3.push(e.message)); let alerted = false; p3.on('dialog', d => { alerted = true; d.dismiss(); });
  await p3.goto('https://www.smarthcm.city/Maintenance/TaskListNew');
  await p3.evaluate(() => localStorage.setItem('ktma_learn_v1', JSON.stringify({ rules: { 'ten|x>y': { pos: '<img src=x onerror=alert(1)>', neg: 1, text: '<img src=x onerror=alert(2)>' } }, de: { x: null } })));
  await p3.addScriptTag({ content: US }); ok(await p3.evaluate(() => !!window.__ktma), 'dữ liệu học hỏng không làm sập công cụ');
  await p3.click('[data-a=learn]'); await p3.waitForTimeout(300);
  ok(!(await p3.$('#ktma-md img')) && !alerted, 'dữ liệu học độc hại không chạy được mã');
  await p3.evaluate(() => localStorage.setItem('ktma_kq_v1|Quận 3|2026-10-31', JSON.stringify({ 5001: 5, 5002: { kl: 'KHỚP' } })));
  await p3.click('#ktma-md [data-l=x]'); await p3.click('[data-a=run]'); await p3.waitForTimeout(300);
  ok(await p3.evaluate(() => Object.keys(window.__ktma.S.kq).join()) === '5002', 'kết quả xem ảnh hỏng được lọc');
  ok(!e3.length, 'trang dữ liệu hỏng không lỗi JS: ' + e3.join('|'));
  await p3.close();
  // Chỉ đọc: không gọi hàm ghi
  ok(!/SaveLinkIncident|Save\w*\(|Delete\w*\(|Approve/.test(US.replace(/\/\/.*$/gm, '')), 'mã không gọi API ghi');
  ok(!errs.length, 'không lỗi JS: ' + errs.join(' | '));
  // Dark mode
  const pd = await b.newPage({ viewport: { width: 1366, height: 768 }, colorScheme: 'dark' }); await pd.route('https://www.smarthcm.city/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE })); await pd.route('https://cdn.smartiot.city/**', r => r.fulfill({ contentType: 'image/png', body: png(8, 8, [90, 90, 90]) }));
  await pd.goto('https://www.smarthcm.city/Maintenance/TaskListNew'); await pd.addScriptTag({ content: US }); await pd.click('[data-a=run]'); await pd.waitForSelector('#ktma-res'); await pd.screenshot({ path: SHOT + '/9-dark.png' });
  // Màn hẹp
  await pd.setViewportSize({ width: 1024, height: 700 }); await pd.click('#ktma-res [data-r=close]'); await pd.click('[data-a=res]'); ok(await pd.$eval('#ktma-pn', e => e.classList.contains('min')), 'màn hẹp: panel tự thu gọn khi mở bảng'); await pd.screenshot({ path: SHOT + '/10-hep.png' });
  await b.close();
  console.log('ui: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('LỖI', e); process.exit(1); });
