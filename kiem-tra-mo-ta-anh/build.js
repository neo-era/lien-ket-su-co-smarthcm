const fs = require('fs');
const VER = '1.0.0';
const RAW = 'https://raw.githubusercontent.com/neo-era/lien-ket-su-co-smarthcm/main/kiem-tra-mo-ta-anh.user.js';
const head = `// ==UserScript==
// @name         Kiểm tra mô tả & ảnh duy tu - SmartHCM
// @namespace    lavipco.cskvtt
// @version      ${VER}
// @description  Soát chính tả cột Mô tả (có tự học), kiểm tra dữ liệu ảnh tự động, xem ảnh nhanh để kết luận Khớp/Không khớp, xuất Excel. Chỉ đọc, không sửa dữ liệu. Chạy trên smarthcm.city.
// @author       CSKVTT - LAVIPCO
// @match        https://smarthcm.city/*
// @match        https://*.smarthcm.city/*
// @match        http://smarthcm.city/*
// @match        http://*.smarthcm.city/*
// @run-at       document-idle
// @grant        none
// @updateURL    ${RAW}
// @downloadURL  ${RAW}
// ==/UserScript==
/*
 * Cài: Tampermonkey > mở link raw ở trên > Install. Cần bật "Allow user scripts" và quyền truy cập trang.
 * Dùng: trang Quản lý công việc duy tu (TaskListNew) > panel "🔍 Kiểm tra mô tả & ảnh" góc phải dưới.
 * Mã nguồn lõi được test tự động (core.test.js, xlsx.test.js, ui.test.js) trước khi build.
 */
`;
const src = f => fs.readFileSync(__dirname + '/src/' + f, 'utf8').replace(/^if \(typeof module.*$/m, '');
const out = head + '(function () {\n\'use strict\';\nvar KT_VERSION = ' + JSON.stringify(VER) + ';\n' + src('core.js') + '\n' + src('xlsx.js') + '\n' + src('ui.js') + '\n})();\n';
fs.writeFileSync(__dirname + '/../kiem-tra-mo-ta-anh.user.js', out);
console.log('built', out.length, 'bytes v' + VER);
