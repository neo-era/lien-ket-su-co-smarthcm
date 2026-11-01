// ===== Ghi file .xlsx tối giản (không thư viện ngoài): zip "store" + CRC32, có màu, cố định dòng, bộ lọc =====
var KTXLSX = (function () {
  'use strict';
  var enc = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : new (require('util').TextEncoder)();
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(files) { // files: [{name, data:Uint8Array}]
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(sz), u32(sz), u16(nm.length), u16(0));
      parts.push(new Uint8Array(lh), nm, f.data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(sz), u32(sz), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += lh.length + nm.length + sz;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(off), u16(0)));
    var all = parts.concat(central, [end]), len = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  function esc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  var COLOR_XF = { 'Lỗi': 3, 'KHÔNG KHỚP': 3, 'Chuẩn hoá': 4, 'CẦN XEM': 4, 'KHỚP': 5, 'KHÔNG ĐỌC ĐƯỢC': 6 };
  function cell(ref, v, xf) {
    if (v === null || v === undefined || v === '') return '<c r="' + ref + '" s="' + xf + '"/>';
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + xf + '"><v>' + v + '</v></c>';
    v = String(v); if (v.length > 32000) v = v.slice(0, 32000) + ' …(cắt bớt)';
    return '<c r="' + ref + '" s="' + xf + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
  }
  function sheetXml(sh) {
    var rows = [], hasHead = !!sh.head, all = hasHead ? [sh.head].concat(sh.rows || []) : (sh.rows || []);
    var maxC = all.reduce(function (a, r) { return Math.max(a, (r || []).length); }, 1);
    all.forEach(function (r, ri) {
      var cs = (r || []).map(function (v, ci) {
        var xf;
        if (hasHead && ri === 0) xf = 1;
        else if (sh.title) xf = ri === 0 ? 7 : (ci === 0 && /^\d\. /.test(String(v)) ? 8 : 0);
        else xf = (sh.colorCol === ci && COLOR_XF[v]) || 2;
        return cell(col(ci) + (ri + 1), v, xf);
      }).join('');
      rows.push('<row r="' + (ri + 1) + '">' + cs + '</row>');
    });
    var view = hasHead ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    var cols = (sh.widths || []).length ? '<cols>' + sh.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
    var af = hasHead ? '<autoFilter ref="A1:' + col(maxC - 1) + Math.max(all.length, 1) + '"/>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + view + '<sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + rows.join('') + '</sheetData>' + af + '</worksheet>';
  }
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>'
    + '<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + ['1F4E78', 'F8D7DA', 'FFF3CD', 'D1E7DD', 'E2E3E5'].map(function (c) { return '<fill><patternFill patternType="solid"><fgColor rgb="FF' + c + '"/><bgColor indexed="64"/></patternFill></fill>'; }).join('') + '</fills>'
    + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>' + ['left', 'right', 'top', 'bottom'].map(function (s) { return '<' + s + ' style="thin"><color rgb="FFBFBFBF"/></' + s + '>'; }).join('') + '<diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
    + [0, 3, 4, 5, 6].map(function (f) { return '<xf numFmtId="0" fontId="0" fillId="' + f + '" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'; }).join('')
    + '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function sname(n) { return String(n).replace(/[\\\/?*\[\]:]/g, '_').slice(0, 31) || 'Sheet'; }
  function build(sheets) {
    var S = function (s) { return enc.encode(s); }, H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    var files = [
      { name: '[Content_Types].xml', data: S(H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>') },
      { name: '_rels/.rels', data: S(H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: S(H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + esc(sname(s.name)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>'
        + '<definedNames>' + sheets.map(function (s, i) { if (!s.head) return ''; var mc = (s.head || []).length; return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(sname(s.name).replace(/'/g, "''")) + '\'!$A$1:$' + col(mc - 1) + '$' + Math.max((s.rows || []).length + 1, 1) + '</definedName>'; }).join('') + '</definedNames></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: S(H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
      { name: 'xl/styles.xml', data: S(STYLES) }
    ];
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: S(sheetXml(s)) }); });
    return zip(files);
  }
  return { build: build, crc32: crc32 };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = KTXLSX;
