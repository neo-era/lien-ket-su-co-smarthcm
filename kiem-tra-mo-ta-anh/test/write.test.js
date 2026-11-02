// Test tích hợp chức năng "✍ Ghi vào SmartHCM" trên trang giả lập (Playwright)
const { chromium } = require('playwright'); const fs = require('fs');
const US = fs.readFileSync(__dirname + '/../../kiem-tra-mo-ta-anh.user.js', 'utf8');
const SHOT = process.env.SHOT || '/tmp/ktshots'; fs.mkdirSync(SHOT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n); } };
let id = 9000;
const R = (d, st, extra) => Object.assign({ Id: ++id, Description: d, StatusId: st, CompletedQuantity: 2.5, CabinetId: 700 + id % 3, CreatedAt: '2026-10-31T09:00:00', Cabinet: { BoxName: 'Q1-' + id, Road: 'Lê Lợi', Ward: 'Bến Thành', District: 'Quận 1' }, MaintScheduleDetail: { MaintWork: { Name: 'Thay bóng' } }, Image1: 'a' + id + '.jpg', Image3: 'c' + id + '.jpg', ImagePath: 'p' }, extra || {});
const rows = [];
for (let i = 0; i < 60; i++) rows.push(R('Thay bóng đường Lê Duẫn', 0));            // 60 CV chưa kiểm tra → 2 lô
rows.push(R('Thay bóng đường Lê Duẫn', 10));                                          // 1 CV đã kiểm tra → khoá
rows.push(R('Sơn trụ tr 7 Cô Giang', 0));                                             // Lỗi → tick sẵn
rows.push(R('Tháo băng rôn trụ số 2,đường Lê Lợi', 0));                               // Chuẩn hoá → không tick sẵn
rows.push(R('Thay kích đường Mạc Đỉnh Chi', 10));                                     // toàn bộ đã kiểm tra → không chọn được
const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body><div>Khoảng: <input value="01/10/2026 - 31/10/2026"></div>
<script>window.__ROWS=${JSON.stringify(rows)};window.__CALLS=[];window.__FAIL_ON=0;var rowDataTracker={};
window.gridOptions={api:{forEachNode:f=>window.__ROWS.forEach(d=>f({data:d})),getModel:()=>({getType:()=>'clientSide'})}};
window.LBCS={Core:{MaintTask:function(){}},Service:{MaintenanceSvc:{ListMaintTaskNew:(f,ok)=>ok(Object.keys(f.Districts)[0]==='1'?JSON.parse(JSON.stringify(window.__ROWS)):[]),
 SaveReviewMaintTask:(rows,flag,ok,er)=>{window.__CALLS.push({n:rows.length,flag,keys:Object.keys(rows[0]).sort().join(),ctor:rows[0] instanceof LBCS.Core.MaintTask,rows:JSON.parse(JSON.stringify(rows))});
   if(window.__FAIL_ON&&window.__CALLS.length===window.__FAIL_ON){setTimeout(()=>ok({Code:0,Message:'Từ chối giả lập'}),10);return;}
   window.__PENDING=(window.__PENDING||[]).concat(rows);setTimeout(()=>ok({Code:1}),10);}}}};
window.LoadMaintTaskList=function(){setTimeout(()=>{(window.__PENDING||[]).forEach(t=>{const r=window.__ROWS.find(x=>x.Id===t.Id);if(r)r.Description=t.Description;});window.__PENDING=[];window.__LOADS=(window.__LOADS||0)+1;},300);};
</script></body></html>`;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  await ctx.route('https://www.smarthcm.city/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE }));
  await ctx.route('https://cdn.smartiot.city/**', r => r.fulfill({ status: 404, body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('https://www.smarthcm.city/Maintenance/TaskListNew'); await p.addScriptTag({ content: US });
  await p.click('[data-a=run]'); await p.waitForSelector('#ktma-res');
  const cb = s => p.$(`tr:has(td:text-is("${s}")) input[data-sel]`);
  ok(await (await cb('Thay bóng đường Lê Duẫn')).isChecked(), 'dòng Lỗi tick sẵn');
  ok(!(await (await cb('Tháo băng rôn trụ số 2,đường Lê Lợi')).isChecked()), 'dòng Chuẩn hoá không tick sẵn');
  ok(await (await cb('Thay kích đường Mạc Đỉnh Chi')).isDisabled(), 'mô tả toàn CV đã kiểm tra → không chọn được');
  ok(/🔒1/.test(await p.textContent('tr:has(td:text-is("Thay bóng đường Lê Duẫn"))')), 'hiện số CV bị khoá');
  let bar = await p.textContent('#ktma-wbar'); ok(/2 mô tả · 61 CV sẽ ghi/.test(bar) && /1 CV đã kiểm tra bị khoá/.test(bar), 'thanh ghi đếm đúng: ' + bar);
  // Bỏ tick "Sơn trụ", tick "Tháo băng rôn"
  await (await cb('Sơn trụ tr 7 Cô Giang')).click(); await (await cb('Tháo băng rôn trụ số 2,đường Lê Lợi')).click();
  bar = await p.textContent('#ktma-wbar'); ok(/2 mô tả · 61 CV/.test(bar), 'đổi chọn cập nhật thanh: ' + bar);
  await p.screenshot({ path: SHOT + '/w1-chon.png' });
  // Có chỉnh sửa tay trên lưới → chặn
  await p.evaluate(() => { rowDataTracker = { x: 1 }; }); await p.click('[data-r=write]'); await p.waitForSelector('#ktma-toast');
  ok(/chưa bấm Cập nhật/.test(await p.textContent('#ktma-toast')) && !(await p.$('#ktma-md')), 'lưới có sửa tay chưa lưu → không cho ghi');
  await p.evaluate(() => { rowDataTracker = {}; }); await p.waitForFunction(() => !document.getElementById('ktma-toast'), null, { timeout: 6000 });
  // Người khác sửa 1 CV trong lúc duyệt
  await p.evaluate(() => { window.__ROWS[5].Description = 'Người khác sửa'; });
  await p.click('[data-r=write]'); await p.waitForSelector('#ktma-md [data-w=go]');
  const mdTxt = await p.textContent('#ktma-md'); ok(/Thay bóng đường Lê Duẫn/.test(mdTxt) && /Thay bóng đường Lê Duẩn/.test(mdTxt) && /59/.test(mdTxt), 'hộp xác nhận cũ → mới, 59 CV');
  ok(/1 CV đã kiểm tra/.test(mdTxt) && /1 CV mô tả đã bị sửa/.test(mdTxt), 'hộp xác nhận báo CV khoá và CV bị sửa xen');
  await p.screenshot({ path: SHOT + '/w2-xacnhan.png' });
  ok(/\(60 CV\)/.test(await p.textContent('#ktma-md [data-w=go]')), 'nút ghi đúng số CV (59 + 1)');
  // Huỷ → không gọi gì
  await p.click('#ktma-md [data-w=x]'); ok((await p.evaluate(() => window.__CALLS.length)) === 0, 'Huỷ → không ghi');
  // Ghi thật
  await p.click('[data-r=write]'); await p.waitForSelector('#ktma-md [data-w=go]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#ktma-md [data-w=go]')]);
  ok(/^NhatKy_SuaMoTa_Quan1_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(dl.suggestedFilename()), 'tải nhật ký trước khi ghi: ' + dl.suggestedFilename());
  const log = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); ok(log.entries.length === 60 && log.entries[0].old === 'Thay bóng đường Lê Duẫn', 'nhật ký có mô tả cũ');
  await p.waitForFunction(() => !document.getElementById('ktma-md') && /CV/.test((document.getElementById('ktma-toast') || {}).textContent || '') && !/Đang soát/.test(document.getElementById('ktma-st').textContent), null, { timeout: 40000 });
  const calls = await p.evaluate(() => window.__CALLS);
  ok(calls.length === 2 && calls[0].n === 50 && calls[1].n === 10, 'ghi 2 lô 50 + 10: ' + calls.map(c => c.n));
  ok(calls.every(c => c.flag === false && c.keys === 'CabinetId,CompletedQuantity,Description,Id,StatusId,__type' && c.ctor), 'gửi đúng như trang: SaveReviewMaintTask(rows,false), đối tượng LBCS.Core.MaintTask, 6 trường');
  const sent = calls.flatMap(c => c.rows); const orig = new Map(rows.map(r => [r.Id, r]));
  ok(sent.every(t => t.StatusId === 0 && t.CompletedQuantity === 2.5 && t.CabinetId === orig.get(t.Id).CabinetId), 'giữ nguyên trạng thái/khối lượng/mã tủ');
  ok(!sent.some(t => orig.get(t.Id).StatusId === 10) && !sent.some(t => t.Id === rows[5].Id), 'không gửi CV đã kiểm tra và CV bị sửa xen');
  ok(sent.filter(t => t.Description === 'Thay bóng đường Lê Duẩn').length === 59 && sent.some(t => t.Description === 'Tháo băng rôn trụ số 2, đường Lê Lợi'), 'mô tả mới đúng');
  const tt = await p.textContent('#ktma-toast'); ok(/Đã ghi 60\/60 CV/.test(tt), 'báo kết quả: ' + tt);
  ok(await p.evaluate(() => window.__ROWS.filter(r => r.Description === 'Thay bóng đường Lê Duẩn').length === 59), 'lưới đã đổi sau tải lại');
  await p.waitForTimeout(300);
  ok(!(await p.$('tr:has(td:text-is("Tháo băng rôn trụ số 2,đường Lê Lợi"))')), 'chạy lại: dòng đã sửa không còn bị báo');
  ok(await p.isVisible('[data-r=undo]'), 'hiện nút Hoàn tác');
  await p.screenshot({ path: SHOT + '/w3-daghi.png' });
  // Hoàn tác: 1 CV đã được kiểm tra sau khi ghi → khoá
  await p.evaluate(() => { window.__ROWS[0].StatusId = 10; window.__CALLS = []; });
  await p.click('[data-r=undo]'); await p.waitForSelector('#ktma-md [data-w=go]');
  ok(/\(59 CV\)/.test(await p.textContent('#ktma-md [data-w=go]')) && /1 CV đã kiểm tra/.test(await p.textContent('#ktma-md')), 'hoàn tác: 59 CV, 1 CV đã kiểm tra bị khoá');
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#ktma-md [data-w=go]')]);
  ok(/^NhatKy_HoanTac_/.test(dl2.suggestedFilename()), 'hoàn tác cũng tải nhật ký');
  await p.waitForFunction(() => !document.getElementById('ktma-md') && /CV/.test((document.getElementById('ktma-toast') || {}).textContent || '') && !/Đang soát/.test(document.getElementById('ktma-st').textContent), null, { timeout: 40000 });
  ok(await p.evaluate(() => window.__ROWS.filter(r => r.Description === 'Thay bóng đường Lê Duẫn').length === 59 && window.__ROWS[0].Description === 'Thay bóng đường Lê Duẩn'), 'hoàn tác ghi lại mô tả cũ, bỏ qua CV khoá');
  ok(!(await p.isVisible('[data-r=undo]')), 'hoàn tác xong ẩn nút');
  // Máy chủ từ chối 1 lô
  await p.evaluate(() => { window.__CALLS = []; window.__FAIL_ON = 1; });
  await p.click('[data-r=write]'); await p.waitForSelector('#ktma-md [data-w=go]');
  await Promise.all([p.waitForEvent('download'), p.click('#ktma-md [data-w=go]')]);
  await p.waitForFunction(() => /LỖI|Đã ghi/.test(document.getElementById('ktma-st').textContent), null, { timeout: 40000 });
  const t3 = await p.textContent('#ktma-st'); ok(/LỖI Lô 1: Từ chối giả lập/.test(t3) && /Đã ghi 9\/59 CV/.test(t3), 'lô bị từ chối được báo rõ: ' + t3.slice(0, 140));
  // KVTT: không có cột ghi
  await p.click('[data-m=all]'); await p.click('[data-a=run]'); await p.waitForTimeout(800);
  ok(!(await p.$('#ktma-res input[data-sel]')) && !(await p.$('#ktma-wbar')), 'chế độ Toàn KVTT không có chức năng ghi');
  ok(!errs.length, 'không lỗi JS: ' + errs.join(' | '));
  await b.close(); console.log('write: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('LỖI', e.message); process.exit(1); });
