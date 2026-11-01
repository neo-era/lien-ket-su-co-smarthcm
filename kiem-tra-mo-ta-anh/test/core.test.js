const C = require('../src/core.js');
let pass = 0, fail = 0; const fails = [];
const ok = (c, n) => { if (c) pass++; else { fail++; fails.push(n); } };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');

// ---------- dữ liệu giả ----------
let nid = 100;
function R(o) { return Object.assign({ Id: ++nid, Description: '', CreatedAt: '/Date(' + Date.UTC(2026, 9, 31, 3) + ')/', Quantity: 1, CabinetId: 1,
  Cabinet: { BoxName: 'Tủ A', PENumber: 'PE1', Road: 'Võ Thị Sáu', Ward: 'Võ Thị Sáu', District: 'Quận 3' },
  MaintScheduleDetail: { MaintWork: { Name: 'Thay bóng' } }, Image1: 'a' + nid + '.jpg', Image3: 'c' + nid + '.jpg', ImagePath: 'p/' + nid }, o); }

// ---------- ngày ----------
eq(C.ymd('/Date(' + Date.UTC(2026, 9, 31, 3) + ')/'), '2026-10-31', 'ymd /Date()/');
eq(C.ymd('2026-08-22T10:00:00'), '2026-08-22', 'ymd ISO');
eq(C.ymd(null), '', 'ymd null');

// ---------- kiểm tra tự động ----------
const p = R({ Description: 'Sơn trụ số 21' });                       // CV gốc
const c1 = R({ Description: 'Lắp đặt bộ đèn', ParentTaskId: p.Id, Image1: p.Image1, Image3: p.Image3 });   // con dùng chung ảnh: hợp lệ
const c2 = R({ Description: 'Cung cấp bu lông', ParentTaskId: p.Id, Image1: p.Image1, Image3: 'x.jpg' }); // anh em: hợp lệ
const orphanChild = R({ Description: 'CV con gốc ngoài lọc', ParentTaskId: 999999, Image1: 'g.jpg' });
const orphanSib = R({ Description: 'Anh em gốc ngoài lọc', ParentTaskId: 999999, Image1: 'g.jpg' });
const s1 = R({ Description: 'Thay bóng trụ số 1', Image1: 'dup.jpg' });
const s2 = R({ Description: 'Thay bóng trụ số 9', CabinetId: 2, Image1: 'dup.jpg' });   // trùng ảnh không cha–con → báo
const miss = R({ Description: 'Thiếu ảnh', Image1: null });
const same = R({ Description: 'Ảnh trước sau', Image1: 'same.jpg', Image3: 'same.jpg' });
const empty = R({ Description: '  --  ' });
const m1 = R({ Description: '12.345', CabinetId: 7, CreatedAt: '2026-10-01T08:00:00', MaintScheduleDetail: { MaintWork: { Name: 'Duy trì trạm đèn 1 pha' } } });
const m2 = R({ Description: '12,300', CabinetId: 7, CreatedAt: '2026-10-15T08:00:00', MaintScheduleDetail: { MaintWork: { Name: 'Duy trì trạm đèn 1 pha' } } });
const rows = [p, c1, c2, orphanChild, orphanSib, s1, s2, miss, same, empty, m1, m2];
const auto = C.autoChecks(rows);
const has = (id, loai) => auto.some(a => a.id === id && a.loai.startsWith(loai));
ok(has(miss.Id, 'Thiếu ảnh'), 'thiếu ảnh hiện trạng');
eq(auto.find(a => a.id === miss.Id && a.loai === 'Thiếu ảnh').ct, 'Thiếu ảnh Hiện trạng', 'chi tiết thiếu ảnh');
ok(has(same.Id, 'Ảnh trước = ảnh sau'), 'ảnh trước = sau');
ok(has(s1.Id, 'Trùng ảnh') && has(s2.Id, 'Trùng ảnh'), 'trùng ảnh không cha–con');
ok(!has(c1.Id, 'Trùng ảnh') && !has(c2.Id, 'Trùng ảnh') && !has(p.Id, 'Trùng ảnh'), 'cha–con/anh em không báo trùng');
ok(!has(orphanChild.Id, 'Trùng ảnh'), 'anh em có gốc ngoài khoảng lọc không báo trùng');
ok(has(empty.Id, 'Mô tả trống'), 'mô tả chỉ có ký hiệu = trống');
ok(has(m2.Id, 'Chỉ số điện kế giảm'), 'chỉ số điện kế giảm 12345 → 12300');
ok(!has(m1.Id, 'Chỉ số điện kế giảm'), 'lần đầu không báo');
eq(C.num('12.345'), 12345, 'num dấu chấm nghìn'); eq(C.num('1.234,5'), 1234.5, 'num kiểu VN');

// ---------- chính tả ----------
const roadRows = [R({ Cabinet: { Road: 'Lê Duẩn', Ward: 'Bến Nghé', District: 'Quận 1', BoxName: 'X' } }), R({ Cabinet: { Road: 'Mạc Đỉnh Chi', Ward: 'Đa Kao', District: 'Quận 1', BoxName: 'Y' } })];
const chk = C.buildChecker(roadRows);
const T = s => chk(s).issues.map(i => i.text);
const has2 = (s, re) => T(s).some(t => re.test(t));
ok(has2('Thay bóng trụ số 12 đường Lê Duẫn', /"Lê Duẫn" → "Lê Duẩn"/), 'Lê Duẫn → Lê Duẩn');
ok(has2('Sơn trụ đường Mạc Đỉnh Chi', /"Mạc Đỉnh Chi" → "Mạc Đĩnh Chi"/), 'EXTRA thắng dữ liệu tủ (Mạc Đĩnh Chi)');
eq(T('Thay bóng đường Mạc Đĩnh Chi'), [], 'tên đúng không báo');
eq(T('Thay bóng đường nguyen cong tru').filter(t => /trụ số/.test(t)), [], '"nguyen cong tru" không đổi thành trụ số');
ok(has2('Thay bóng đường nguyen cong tru', /Viết không dấu "nguyen cong tru" → "Nguyễn Công Trứ"/), 'không dấu → Nguyễn Công Trứ');
eq(T('Thay bóng trụ số 3 đường Lê Lai'), [], 'Lê Lai không bị đổi thành Lê Lợi');
eq(T('Thay bóng trụ số 3 đường Lê Lợi'), [], 'Lê Lợi đúng');
eq(T('Lắp đặt bộ đèn trụ số 5 đường Pasteur'), [], '"Lắp" không bị coi là chữ p');
eq(chk('Lắp đèn p.5 Q.3').de.indexOf('Lắphường'), -1, 'đề xuất không sinh "Lắphường"');
ok(has2('Sơn trụ tr 7 Cô Giang', /"tr 7" → "trụ số 7"/), 'tr 7 → trụ số 7');
eq(chk('Sơn trụ tr 7 Cô Giang').de, 'Sơn trụ số 7 Cô Giang', 'không lặp "trụ trụ số"');
ok(has2('Thay bóng tt2 Cô Bắc', /"tt2" → "trụ số 2"/), 'tt2 → trụ số 2');
eq(T('Thay bóng TP.HCM Q.1 trụ số 4 đường Lê Lợi'), [], 'TP.HCM, Q.1 giữ nguyên');
ok(has2('Tháo băng rôn trụ số 2,đường Lê Lợi', /Thiếu khoảng trắng/), 'thiếu khoảng trắng sau dấu phẩy');
eq(chk('Tháo băng rôn trụ số 2,đường Lê Lợi').de, 'Tháo băng rôn trụ số 2, đường Lê Lợi', 'đề xuất chèn khoảng trắng');
eq(T('Vệ sinh chóa CV Tao Đàn khu A'), [], 'khu A / CV không báo');
eq(T('Thay bóng đường Xuân Hoà'), [], 'Hoà = Hòa');
eq(T('Thay bóng đường Lê Văn Sỹ'), [], 'ALT Lê Văn Sỹ');
ok(has2('Thay bóng ÐƯỜNG Lê Lợi', /"Ð"/), 'ký tự Ð');
ok(has2('Thay bóng trụ số 3 pp', /rác/), 'ký tự rác pp');
eq(chk('Thay bóng đèn trụ số 3 = Lê Lợi').issues.some(i => i.kind === 'L' && /=/.test(i.text)), true, 'ký tự =');
ok(chk('Thay bóng trụ 1 p 5').issues.some(i => i.kind === 'C' && /phường/.test(i.text)), 'p → phường là chuẩn hoá');
const lvl = chk('Sơn trụ tr 7 Cô Giang').issues.find(i => /trụ số 7/.test(i.text)); eq(lvl.kind, 'L', 'tr 7 là mức Lỗi');
ok(chk('Thay bóng đường Lê Duẫn').issues.every(i => i.key), 'mọi lỗi có khoá học');

// ---------- danh sách chính tả + tự học ----------
const spRows = [R({ Description: 'Thay bóng đường Lê Duẫn' }), R({ Description: 'Thay bóng đường Lê Duẫn' }), R({ Description: 'Sơn trụ tr 7 Cô Giang' }),
  R({ Description: 'Thay chóa trụ số 3 Lê Lợi' }), R({ Description: '12345' }), R({ Description: 'Thay bóng trụ số 1,Lê Lợi' })];
let L = C.emptyLearn();
let sp = C.spellList(spRows, L);
const it = s => sp.items.find(o => o.s === s);
eq(it('Thay bóng đường Lê Duẫn').n, 2, 'gộp mô tả trùng, n=2');
ok(!it('12345'), 'mô tả là số không soát');
ok(sp.unflag.includes('Thay chóa trụ số 3 Lê Lợi'), 'mô tả đúng nằm ở danh sách không báo');
// Người dùng: bỏ lỗi "tr 7" (báo nhầm), sửa đề xuất Lê Duẫn, thêm lỗi cho mô tả không báo
it('Sơn trụ tr 7 Cô Giang').issues.forEach(i => { if (/tr 7/.test(i.text)) i.on = false; });
it('Thay bóng đường Lê Duẫn').de = 'Thay bóng đèn đường Lê Duẩn';
const adds = [{ s: 'Thay chóa trụ số 3 Lê Lợi', loi: 'Thiếu chữ "đường"', de: 'Thay chóa trụ số 3 đường Lê Lợi' }];
const n1 = C.learnFromCommit(L, sp.items, adds);
eq(n1, 3, 'ghi nhớ 3 chỉnh sửa');
// Chạy lại
sp = C.spellList(spRows, L);
const tr7 = it('Sơn trụ tr 7 Cô Giang');
ok(!tr7 || tr7.issues.filter(i => i.on).length === 0, 'lần sau không báo tr 7 nữa');
ok(!tr7 || tr7.issues.some(i => i.learned), 'có nhãn đã học');
eq(it('Thay bóng đường Lê Duẫn').de, 'Thay bóng đèn đường Lê Duẩn', 'lần sau dùng đề xuất đã sửa');
ok(it('Thay chóa trụ số 3 Lê Lợi') && it('Thay chóa trụ số 3 Lê Lợi').issues.some(i => i.on && /Thiếu chữ/.test(i.text)), 'lỗi người dùng thêm tự báo lại');
// Không đổi gì → không học
eq(C.learnFromCommit(L, sp.items, []), 0, 'không đổi → không học');
// Học "tr" không đầu độc lỗi khác
eq(it('Thay bóng đường Lê Duẫn').issues.filter(i => i.on).length >= 1, true, 'lỗi tên vẫn báo');
// Người dùng bật lại → sửa ngược luật
it('Sơn trụ tr 7 Cô Giang') && it('Sơn trụ tr 7 Cô Giang').issues.forEach(i => { if (/tr 7/.test(i.text)) i.on = true; });
C.learnFromCommit(L, sp.items, []);
sp = C.spellList(spRows, L);
const tr7b = it('Sơn trụ tr 7 Cô Giang').issues.find(i => /tr 7/.test(i.text));
ok(tr7b && tr7b.on && /mâu thuẫn/.test(tr7b.learned || ''), 'bằng phiếu → mâu thuẫn, giữ đề xuất gốc');
// Lỗi khoảng trắng: bỏ ở 1 mô tả không tắt ở mô tả khác
const spc = C.spellList([R({ Description: 'A trụ số 1,Lê Lợi' }), R({ Description: 'B trụ số 2,Lê Lợi' })], C.emptyLearn());
const L2 = C.emptyLearn(); spc.items[0].issues.forEach(i => i.on = false); C.learnFromCommit(L2, spc.items, []);
const spc2 = C.spellList([R({ Description: 'A trụ số 1,Lê Lợi' }), R({ Description: 'B trụ số 2,Lê Lợi' })], L2);
ok(spc2.items.find(o => o.s.startsWith('B')).issues.some(i => i.on), 'bỏ chuẩn hoá ở mô tả A không tắt ở mô tả B (không đầu độc)');
// Lưu/đọc vòng tròn + JSON hỏng
const back = C.parseLearn(C.serializeLearn(L));
eq(Object.keys(back.rules).length, Object.keys(L.rules).length, 'lưu/đọc vòng tròn');
eq(C.parseLearn('{hỏng').rules, {}, 'JSON hỏng → rỗng');
eq(C.parseLearn(null).rules, {}, 'null → rỗng');
eq(C.learnSummary(L).length > 0, true, 'bảng Đã học có dòng');

// ---------- gợi ý theo hạng mục ----------
ok(/công tơ|điện kế/i.test(C.hint('Duy trì trạm đèn 1 pha')), 'gợi ý duy trì trạm');
ok(/băng rôn/i.test(C.hint('Tháo gỡ băng rôn')), 'gợi ý băng rôn');
ok(C.hint('Hạng mục lạ').length > 0, 'gợi ý mặc định');

// ---------- dữ liệu xuất ----------
const ex = C.buildExport({ quan: 'Quận 3', rows, day: '2026-10-31', list: rows.slice(0, 3), spell: sp.items, auto,
  kq: { [p.Id]: { kl: 'KHỚP', ct: '' }, [c1.Id]: { kl: 'CẦN XEM', ct: 'CV con không có ảnh riêng' } } });
eq(ex.ANH.length, 2, 'sheet So_anh 2 dòng');
eq(ex.ANH.find(r => r[0] === c1.Id)[5], 'CẦN XEM', 'kết luận đúng cột');
ok(ex.CT.every(r => r[1] === 'Lỗi' || r[1] === 'Chuẩn hoá'), 'mức CT');
eq(ex.DL.length, auto.length, 'DL = số kiểm tra tự động');
ok(ex.TONG.length > 5, 'có tổng hợp');
eq(C.slug('Quận Bình Thạnh'), 'QuanBinhThanh', 'slug tên file');


// ---------- hồi quy sau review độc lập ----------
{ const L = C.parseLearn('{"rules":{"k":{"pos":"<img src=x onerror=alert(1)>","neg":2}},"de":{"x":null},"add":[1]}');
  eq(L.rules.k.pos, 0, 'pos không phải số → 0'); eq(L.rules.k.neg, 2, 'neg giữ số'); eq(Object.keys(L.de).length, 0, 'de sai cấu trúc bị bỏ');
  ok(C.learnSummary(L).length === 1, 'learnSummary không sập với dữ liệu sai cấu trúc');
  const L2 = C.parseLearn('{"rules":{"k":"x"}}'); ok(C.learnFromCommit(L2, [], []) === 0 && Object.keys(L2.rules).length === 0, 'rule là chuỗi bị bỏ');
  eq(Object.keys(C.parseLearn('{"rules":[]}').rules).length, 0, 'rules là mảng → rỗng'); }
{ const ch2 = C.buildChecker([]); const r = ch2('Thay bóng Ðiện Biên Phu, tr 5', new Set(['kytu|Thay bóng Ðiện Biên Phu, tr 5']));
  ok(/Điện Biên Phủ/.test(r.de) && /trụ số 5/.test(r.de), 'tắt cảnh báo Ð không làm mất các sửa khác: ' + r.de);
  ok(ch2('Thay bóng Ðiện Biên Phủ').issues[0].key !== ch2('Sơn Ðề Thám').issues[0].key, 'khoá Ð theo từng mô tả'); }
eq(C.buildChecker([]) ('sua den nguyen cong tru 5').issues.filter(i => /trụ số/.test(i.text)).length, 0, '"nguyen cong tru 5" không báo trụ số');
eq(C.buildChecker([]) ('sua den nguyen cong tru tr 5').issues.filter(i => /"tr 5"/.test(i.text)).length, 1, 'tr 5 sau tên đường vẫn báo');
{ const a = [{ Id: 100, Description: 'gốc', Image1: 'z.jpg', Image3: 'y.jpg' }, { Id: 101, ParentTaskId: '100', Description: 'con', Image1: 'z.jpg', Image3: 'w.jpg' }];
  ok(!C.autoChecks(a).some(x => /Trùng/.test(x.loai)), 'Id số và ParentTaskId chuỗi vẫn nhận cha–con'); }
ok(!C.autoChecks([{ Id: 1, Description: 'a' }], { images: false }).some(x => x.loai === 'Thiếu ảnh'), 'không có trường ảnh → bỏ kiểm ảnh');
{ const w = { MaintScheduleDetail: { MaintWork: { Name: 'Duy trì trạm đèn' } }, Image1: 'a', Image3: 'b' };
  const a = [Object.assign({ Id: 1, Description: '5000', CreatedAt: '2026-10-01', Cabinet: { BoxName: 'T1' } }, w), Object.assign({ Id: 2, Description: '120', CreatedAt: '2026-10-02', Cabinet: { BoxName: 'T2' } }, w)];
  ok(!C.autoChecks(a).some(x => /điện kế/.test(x.loai)), 'không có CabinetId: không trộn công tơ giữa các tủ'); }
{ const sp3 = C.spellList([{ Id: 1, Description: 'constructor' }, { Id: 2, Description: 'toString' }, { Id: 3, Description: 12345 }, { Id: 4, Description: null }], C.emptyLearn());
  ok(sp3.total === 2, 'mô tả "constructor"/"toString"/số/null không làm sập'); }
{ const ch3 = C.buildChecker([]); const s = 'Thay bóng (trụ số 2 ),Lê Lợi'; const k1 = 'sp1|' + s;
  const r = ch3(s, new Set([k1])); ok(/\(trụ số 2\),Lê/.test(r.de), 'tắt sp1 vẫn sửa sp2: ' + r.de); }
eq(C.buildChecker([{ Cabinet: { Road: 'Lê Lợi', Ward: 'Phường Bàn Cờ' } }])('Thay bóng phường Bàn Cờ').issues, [], 'Ward có tiền tố "Phường" không báo nhầm');
ok(C.validKq({ a: 5, b: { kl: 'KHỚP' }, c: { kl: 'X' } }).b && !C.validKq({ a: 5 }).a && !C.validKq(5).a, 'validKq lọc dữ liệu hỏng');
{ // hiệu năng: 10.000 mô tả khác nhau, ~570 tên đường
  const syl = ['an', 'bình', 'cao', 'đức', 'gia', 'hoà', 'khánh', 'lâm', 'minh', 'nam', 'phú', 'quang', 'sơn', 'tân', 'thành', 'văn', 'xuân', 'yên', 'hải', 'long'];
  const cap = w => w[0].toUpperCase() + w.slice(1); const roadsP = new Set(); let q = 0;
  while (roadsP.size < 570) { roadsP.add(cap(syl[q % 20]) + ' ' + cap(syl[Math.floor(q / 20) % 20]) + (q % 3 ? ' ' + cap(syl[Math.floor(q / 7) % 20]) : '')); q++; }
  const RD = Array.from(roadsP); const big = [];
  for (let i = 0; i < 10000; i++) { const r = RD[i % RD.length]; big.push({ Id: i, Description: 'Thay bóng đèn trụ số ' + i + ' đường ' + (i % 4 ? r : C.bd(r)) + (i % 5 ? '' : ',p ' + (i % 13)), Cabinet: { Road: r, Ward: 'Đa Kao' } }); }
  const t0 = Date.now(); const spb = C.spellList(big, C.emptyLearn()); const ms = Date.now() - t0;
  ok(ms < 8000, 'hiệu năng 10.000 mô tả < 8 s: ' + ms + ' ms'); ok(spb.total === 10000, 'đủ 10.000 mô tả'); console.log('  (10.000 mô tả: ' + ms + ' ms)'); }

console.log('core: ' + pass + ' pass, ' + fail + ' fail'); fails.forEach(f => console.log('  ✗ ' + f));
process.exit(fail ? 1 : 0);
