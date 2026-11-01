const X = require('../src/xlsx.js'); const fs = require('fs'); const { execSync } = require('child_process');
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n); } };
const bytes = X.build([
  { name: 'Tong_hop', title: true, rows: [['KẾT QUẢ KIỂM TRA'], ['Quận Bình Thạnh — ngày 31/10/2026'], [], ['1. Chính tả'], ['Mô tả có lỗi', 5]], widths: [52, 14] },
  { name: 'Chinh_ta', head: ['STT', 'Mức', 'Mô tả gốc'], rows: [[1, 'Lỗi', 'Lê Duẫn & <b> "x"'], [2, 'Chuẩn hoá', 'A,B']], widths: [6, 11, 42], colorCol: 1 },
  { name: 'So_anh', head: ['Mã CV', 'Kết luận'], rows: [[2834742, 'KHÔNG KHỚP'], ['0123', 'KHỚP']], widths: [10, 15], colorCol: 1 },
  { name: 'Rong', head: ['A'], rows: [] }
]);
ok(bytes instanceof Uint8Array && bytes.length > 500, 'tạo được bytes');
ok(bytes[0] === 0x50 && bytes[1] === 0x4b, 'là file zip');
fs.writeFileSync('/tmp/kt_test.xlsx', bytes);
const py = `
import openpyxl,json
wb=openpyxl.load_workbook('/tmp/kt_test.xlsx')
o={'names':wb.sheetnames}
ws=wb['Chinh_ta'];o['c3']=ws['C2'].value;o['b2fill']=ws['B2'].fill.fgColor.rgb;o['b3fill']=ws['B3'].fill.fgColor.rgb;o['hdr']=ws['A1'].font.bold;o['freeze']=ws.freeze_panes;o['filter']=ws.auto_filter.ref;o['wC']=ws.column_dimensions['C'].width
s=wb['So_anh'];o['num']=s['A2'].value;o['zero']=s['A3'].value;o['kk']=s['B2'].fill.fgColor.rgb
t=wb['Tong_hop'];o['t1']=t['A1'].value;o['t1b']=t['A1'].font.bold;o['t5']=t['B5'].value
print(json.dumps(o,ensure_ascii=False))`;
const o = JSON.parse(execSync('python3 -', { input: py }).toString());
ok(JSON.stringify(o.names) === '["Tong_hop","Chinh_ta","So_anh","Rong"]', 'tên sheet ' + o.names);
ok(o.c3 === 'Lê Duẫn & <b> "x"', 'tiếng Việt + ký tự đặc biệt giữ nguyên: ' + o.c3);
ok(/F8D7DA$/i.test(o.b2fill), 'màu Lỗi đỏ nhạt ' + o.b2fill);
ok(/FFF3CD$/i.test(o.b3fill), 'màu Chuẩn hoá vàng ' + o.b3fill);
ok(/F8D7DA$/i.test(o.kk), 'màu KHÔNG KHỚP');
ok(o.hdr === true, 'tiêu đề cột in đậm');
ok(o.freeze === 'A2', 'cố định dòng tiêu đề');
ok(o.filter && o.filter.startsWith('A1'), 'có bộ lọc: ' + o.filter);
ok(Math.round(o.wC) === 42, 'độ rộng cột ' + o.wC);
ok(o.num === 2834742, 'số là số');
ok(o.zero === '0123', 'chuỗi số có 0 đầu giữ là chữ');
ok(o.t1 === 'KẾT QUẢ KIỂM TRA' && o.t1b === true, 'tiêu đề tổng hợp đậm');
ok(o.t5 === 5, 'giá trị tổng hợp');
// mở bằng LibreOffice được không
try { execSync('cd /tmp && rm -f kt_test.csv && timeout 60 soffice --headless --convert-to csv kt_test.xlsx >/dev/null 2>&1'); ok(fs.existsSync('/tmp/kt_test.csv'), 'LibreOffice mở được'); } catch (e) { ok(false, 'LibreOffice lỗi'); }
const b2 = X.build([{ name: 'Tên rất dài có ký tự / lạ : vượt quá ba mươi mốt ký tự', head: ['A'], rows: [['x\uFFFEy\uD800z'], ['a'.repeat(40000)]] }]);
fs.writeFileSync('/tmp/kt_test2.xlsx', b2);
const o2 = JSON.parse(execSync('python3 -', { input: "import openpyxl,json\nwb=openpyxl.load_workbook('/tmp/kt_test2.xlsx')\nws=wb.worksheets[0]\nprint(json.dumps({'n':ws.title,'a':ws['A2'].value,'l':len(ws['A3'].value)},ensure_ascii=False))" }).toString());
ok(o2.n.length <= 31 && !/[\/:]/.test(o2.n), 'tên sheet hợp lệ: ' + o2.n);
ok(o2.a === 'xyz', 'bỏ ký tự XML không hợp lệ: ' + o2.a);
ok(o2.l <= 32767, 'ô dài bị cắt ≤ 32767: ' + o2.l);
console.log('xlsx: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
