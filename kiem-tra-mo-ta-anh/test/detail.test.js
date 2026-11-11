// Test "✎ Sửa trong hộp Chi tiết công việc" trên trang giả lập (Playwright)
const { chromium } = require('playwright'); const fs = require('fs');
const US = fs.readFileSync(__dirname + '/../../kiem-tra-mo-ta-anh.user.js', 'utf8');
const SHOT = process.env.SHOT || '/tmp/ktshots'; fs.mkdirSync(SHOT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n); } };
let id = 7000;
const R = (d, st, extra) => Object.assign({ Id: ++id, Description: d, StatusId: st, CompletedQuantity: 1, CabinetId: 9, PoleId: null, CreatedAt: '2026-11-10T09:00:00', Cabinet: { BoxName: 'BT-' + id, Road: 'Ngô Tất Tố', District: 'Quận Bình Thạnh' }, MaintScheduleDetail: { MaintWork: { Name: 'Thay bóng' } }, Image1: 'a.jpg', Image3: 'c' + id + '.jpg', ImagePath: 'p' }, extra || {});
const rows = [R('Tru số 1, Hẻm 37 Ngô Tất Tố', 0), R('Thay bóng đường Lê Duẫn', 0), R('Thay bóng đường Lê Duẫn', 10), R('Thay bóng đường Lê Duẫn', 0)];
const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body><div>Khoảng: <input value="01/11/2026 - 30/11/2026"></div>
<div id="MaintTaskDetailEdit" class="modal" style="display:none;position:fixed;inset:60px 300px;background:#fff;z-index:1050;border:1px solid #999;padding:20px">
<h3>Chi tiết công việc</h3><input id="txtMaintTaskId"><br>Mô tả <input id="txtDescription" style="width:400px"><br>
<button id="btnClose" onclick="document.getElementById('MaintTaskDetailEdit').style.display='none'">Đóng</button>
<button id="btnSave" onclick="SaveMaintTaskDetail()">Lưu dữ liệu</button></div><div id="lksc" style="position:fixed;right:0;bottom:0">Liên kết sự cố</div><div id="bcdt" style="position:fixed;right:0;bottom:40px">Báo cáo</div>
<script>window.__ROWS=${JSON.stringify(rows)};var isUnitManager=true;var currentMaintTask=null,currentMaintTaskId=null;window.__LOADS=0;window.__OPEN=[];
window.gridOptions={api:{forEachNode:f=>window.__ROWS.forEach(d=>f({data:d})),getModel:()=>({getType:()=>'clientSide'})}};
window.LBCS={Core:{MaintTask:function(){}},Service:{MaintenanceSvc:{ListMaintTaskNew:(f,ok)=>ok([]),SaveReviewMaintTask:(r,fl,ok)=>ok({Code:1})}}};
function LoadMaintTaskDetail(id,isUM,isAM){window.__OPEN.push([id,isUM,isAM]);setTimeout(()=>{const r=window.__ROWS.find(x=>x.Id===id);document.getElementById('txtMaintTaskId').value=r.Id;document.getElementById('txtDescription').value=r.Description;document.getElementById('MaintTaskDetailEdit').style.display='block';},300);}
function SaveMaintTaskDetail(){const id=+document.getElementById('txtMaintTaskId').value;const r=window.__ROWS.find(x=>x.Id===id);r.Description=document.getElementById('txtDescription').value;document.getElementById('MaintTaskDetailEdit').style.display='none';LoadMaintTaskList();}
function LoadMaintTaskList(){window.__LOADS++;}
</script></body></html>`;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route('https://www.smarthcm.city/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE }));
  await ctx.route('https://cdn.smartiot.city/**', r => r.fulfill({ status: 404, body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('https://www.smarthcm.city/Maintenance/TaskListNew'); await p.addScriptTag({ content: US });
  ok(!/chỉ đọc, không sửa dữ liệu/.test(await p.textContent('#ktma-st')), 'panel không còn ghi "chỉ đọc"');
  await p.click('[data-a=run]'); await p.waitForSelector('#ktma-res');
  const row = s => `tr:has(td:text-is("${s}"))`;
  ok(await p.isVisible(row('Tru số 1, Hẻm 37 Ngô Tất Tố') + ' [data-ed]'), 'mỗi dòng có nút ✎ Sửa');
  // Mô tả 1 CV → mở thẳng hộp chi tiết, điền sẵn đề xuất
  await p.click(row('Tru số 1, Hẻm 37 Ngô Tất Tố') + ' [data-ed]');
  await p.waitForFunction(() => document.getElementById('MaintTaskDetailEdit').style.display === 'block' && /trụ số 1/i.test(document.getElementById('txtDescription').value), null, { timeout: 8000 });
  ok(await p.evaluate(() => JSON.stringify(window.__OPEN[0]) === JSON.stringify([7001, 1, 0])), 'gọi đúng hàm của trang LoadMaintTaskDetail(id, 1, 0)');
  ok(await p.evaluate(() => window.currentMaintTaskId === 7001), 'đặt currentMaintTaskId như khi nhấp đúp');
  ok(await p.inputValue('#txtDescription') === 'Trụ số 1, Hẻm 37 Ngô Tất Tố', 'ô Mô tả điền sẵn đề xuất: ' + await p.inputValue('#txtDescription'));
  ok(!(await p.isVisible('#ktma-res')) && !(await p.isVisible('#lksc')) && !(await p.isVisible('#bcdt')) && !(await p.isVisible('#ktma-pn')), 'bảng kết quả + panel 3 công cụ tạm ẩn để không che hộp của trang');
  await p.waitForTimeout(500); ok(await p.evaluate(() => document.activeElement.id === 'txtDescription'), 'con trỏ ở ô Mô tả');
  await p.screenshot({ path: SHOT + '/d1-hopchitiet.png' });
  // Người dùng sửa thêm rồi bấm Lưu dữ liệu của trang
  await p.fill('#txtDescription', 'Trụ số 1, hẻm 37 Ngô Tất Tố');
  await p.click('#btnSave');
  await p.waitForSelector('#ktma-res', { state: 'visible', timeout: 8000 });
  ok(await p.evaluate(() => window.__ROWS[0].Description === 'Trụ số 1, hẻm 37 Ngô Tất Tố'), 'trang tự lưu (công cụ không tự bấm Lưu)');
  await p.waitForFunction(() => !/Tru số 1, Hẻm 37/.test(document.querySelector('#ktma-res .body').textContent), null, { timeout: 8000 });
  ok(true, 'đóng hộp → bảng hiện lại và tự kiểm tra lại, dòng đã sửa biến mất');
  // Mô tả nhiều CV → chọn CV, CV đã kiểm tra bị khoá
  await p.click(row('Thay bóng đường Lê Duẫn') + ' [data-ed]'); await p.waitForSelector('#ktma-pop');
  const pop = await p.textContent('#ktma-pop'); ok(/#7002/.test(pop) && /#7003/.test(pop) && /#7004/.test(pop), 'danh sách chọn CV: ' + pop.slice(0, 120));
  ok(await p.isDisabled('#ktma-pop [data-cv="7003"]'), 'CV đã kiểm tra không mở được (trang khoá)');
  await p.screenshot({ path: SHOT + '/d2-chon-cv.png' });
  await p.click('#ktma-pop [data-cv="7004"]');
  await p.waitForFunction(() => document.getElementById('MaintTaskDetailEdit').style.display === 'block' && document.getElementById('txtMaintTaskId').value === '7004' && /Lê Duẩn/.test(document.getElementById('txtDescription').value), null, { timeout: 8000 });
  ok(true, 'mở đúng CV đã chọn, điền đề xuất');
  // Đóng không lưu → giữ nguyên dữ liệu, bảng hiện lại
  await p.click('#btnClose'); await p.waitForSelector('#ktma-res', { state: 'visible', timeout: 8000 });
  ok(await p.evaluate(() => window.__ROWS[3].Description === 'Thay bóng đường Lê Duẫn'), 'đóng không lưu → không đổi dữ liệu');
  ok(await p.isVisible('#lksc') && await p.isVisible('#bcdt') && await p.isVisible('#ktma-pn'), 'đóng hộp → các panel hiện lại');
  // Người khác sửa mô tả sau lần kiểm tra → không điền đè
  await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__ROWS[3].Description = 'Thay bóng đèn đường Lê Duẩn (người khác sửa)'; });
  await p.click(row('Thay bóng đường Lê Duẫn') + ' [data-ed]'); await p.waitForSelector('#ktma-pop'); await p.click('#ktma-pop [data-cv="7004"]');
  await p.waitForFunction(() => document.getElementById('MaintTaskDetailEdit').style.display === 'block' && document.getElementById('txtMaintTaskId').value === '7004', null, { timeout: 8000 });
  await p.waitForTimeout(800);
  ok(await p.inputValue('#txtDescription') === 'Thay bóng đèn đường Lê Duẩn (người khác sửa)', 'mô tả đã đổi sau lần kiểm tra → không điền đè: ' + await p.inputValue('#txtDescription'));
  // Bấm mở lần nữa khi đang mở → bị chặn
  const n0 = await p.evaluate(() => window.__OPEN.length);
  await p.evaluate(() => window.__ktma.openDetail(7002, 'x', 'Thay bóng đường Lê Duẫn')); 
  ok(await p.evaluate(n => window.__OPEN.length === n, n0), 'đang mở hộp → không mở chồng CV khác');
  await p.click('#btnClose'); await p.waitForSelector('#ktma-res', { state: 'visible', timeout: 8000 });
  ok(await p.evaluate(() => !document.body.classList.contains('ktma-hold')), 'đóng hộp → gỡ trạng thái tạm ẩn');
  // Hộp không mở được (trang lỗi) → không kẹt ẩn
  await p.evaluate(() => { window.__OLDL = window.LoadMaintTaskDetail; window.LoadMaintTaskDetail = function () { throw new Error('lỗi trang'); }; });
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.__ktma.openDetail(7002, 'x', 'Thay bóng đường Lê Duẫn'));
  ok(await p.isVisible('#ktma-res') && await p.evaluate(() => !document.body.classList.contains('ktma-hold')), 'trang báo lỗi khi mở → bảng và panel hiện lại, không kẹt');
  await p.evaluate(() => { window.LoadMaintTaskDetail = window.__OLDL; });
  // Trang không có hàm mở chi tiết → không hiện nút
  await p.evaluate(() => { window.LoadMaintTaskDetail = undefined; }); await p.click('[data-a=run]'); await p.waitForTimeout(600);
  ok(!(await p.$('#ktma-res [data-ed]')), 'trang không có hộp chi tiết → không hiện nút ✎');
  ok(!errs.length, 'không lỗi JS: ' + errs.join(' | '));
  await b.close(); console.log('detail: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('LỖI', e.message.split('\n')[0]); process.exit(1); });
