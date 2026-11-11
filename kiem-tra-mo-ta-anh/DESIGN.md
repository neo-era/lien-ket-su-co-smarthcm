# Công cụ 3 — Kiểm tra mô tả & ảnh duy tu (userscript SmartHCM)

## Mục tiêu
Chuyển skill `kiem-tra-mo-ta-anh-duytu-smarthcm` thành userscript Tampermonkey `kiem-tra-mo-ta-anh.user.js`
trong repo `neo-era/lien-ket-su-co-smarthcm` (cùng 2 công cụ: Liên kết sự cố, Báo cáo duy tu ngày).

## Tiêu chí đạt (đã chốt Bước 0 — 01/11/2026)
1. Kiểm tra tự động giống skill: thiếu ảnh HT/HT, ảnh trước = sau, trùng ảnh giữa CV không cùng gốc cha–con,
   mô tả trống, chỉ số điện kế giảm (CẦN XEM).
2. Soát chính tả cột Mô tả bằng bộ luật của skill (EXTRA, ALT, TONE, ngưỡng gõ nhầm, tr/tru/tt, p→phường,
   dấu câu). Ca thật: "Lê Duẫn"→"Lê Duẩn", "Mạc Đỉnh Chi"→"Mạc Đĩnh Chi", "nguyen cong tru" không báo "trụ số",
   "Lê Lai"/"Lê Lợi" không nhầm, "Lắp" không thành "Lắphường", "TP.HCM"/"Q.1" giữ nguyên.
3. Đọc ảnh = **xem ảnh nhanh** do người kiểm kết luận (phím 1–4: KHỚP / KHÔNG KHỚP / CẦN XEM / KHÔNG ĐỌC ĐƯỢC
   + ghi chú), ←/→ chuyển CV, lưu tạm trên máy (localStorage) theo quận+ngày, CV con có nhãn + hạng mục gốc,
   gợi ý "phải thấy gì" theo hạng mục.
4. **Tự học chính tả** (lưu trên máy): bỏ một lỗi báo nhầm → lần sau không báo; sửa đề xuất → lần sau dùng đề xuất đó;
   thêm lỗi cho mô tả không bị báo → lần sau tự báo. Có nhãn 📚, bảng "Đã học" xem/xoá/xuất-nhập JSON.
   Không tự sửa gì trên hệ thống. Mâu thuẫn → giữ đề xuất gốc + nhãn.
5. Xuất Excel (.xlsx thật, có màu) 4 sheet: Tong_hop, Chinh_ta, So_anh, Kiem_tra_du_lieu.
6. Chỉ đọc, trừ chức năng Ghi (v1.1.0): không Duyệt/Xoá/Kiểm tra; không gửi dữ liệu ra ngoài (ảnh tải từ CDN của chính hệ thống).
9. (v1.1.0, chốt 02/11/2026) **Ghi mô tả vào SmartHCM**: dùng `LBCS.Service.MaintenanceSvc.SaveReviewMaintTask(rows, false, ok, err)` giống nút "Cập nhật"
   của trang (`DoSaveChanges`), mỗi phần tử `LBCS.Core.MaintTask {Id, StatusId, CompletedQuantity, Description, CabinetId}`, `Code === 1` là thành công.
   Chỉ CV `StatusId === 0` (chưa kiểm tra) và người dùng là `isUnitManager` mới sửa được. Chỉ ghi dòng người dùng tick (mặc định tick dòng Lỗi),
   xác nhận cũ → mới, đọc lại lưới ngay trước khi ghi (bỏ CV bị sửa xen), chặn khi `rowDataTracker` có sửa tay chưa lưu, lô 50, tải nhật ký JSON
   trước khi ghi, hoàn tác lần ghi gần nhất (lưu localStorage theo quận), tải lại lưới (`LoadMaintTaskList`) và kiểm lại. Chế độ KVTT không ghi.
   Kiểm chứng thật: CV #2905414 (Quận 1) ghi → hoàn tác → ghi lại, 02/11/2026.
7. Phạm vi dữ liệu: quận đang lọc (gridOptions) hoặc toàn KVTT 8 quận (API ListMaintTaskNew, Districts[id]=id,
   theo khoảng ngày đang lọc trên trang).
8. Giao diện hiện đại, nhất quán 3 công cụ; có nút Góp ý (mailto, kèm phiên bản).

10. (v1.2.0, chốt 11/11/2026) **✎ Sửa trong hộp "Chi tiết công việc" của trang**: gọi `LoadMaintTaskDetail(id,1,0)` (như nhấp đúp dòng),
   điền sẵn `#txtDescription` bằng đề xuất (chỉ khi mô tả trên lưới chưa đổi từ lần kiểm tra), tạm ẩn bảng + panel 3 công cụ.
   Người dùng tự chọn Trụ và bấm "Lưu dữ liệu" (`SaveMaintTaskDetail` gửi kèm PoleId) — công cụ **không tự lưu** trong luồng này.
   Chỉ chế độ Quận đang lọc, tài khoản quản lý đơn vị, CV chưa kiểm tra. Có khoá chống mở chồng; lỗi/hết giờ luôn gỡ trạng thái ẩn.

## Kiến trúc
- `src/core.js` (thuần, test Node): ngày, auto-check, chính tả (buildDict + check), tự học (key, learn, apply),
  hạng mục → gợi ý kiểm ảnh, tạo dữ liệu xuất.
- `src/xlsx.js` (thuần): ghi .xlsx tối giản (zip store + CRC32, styles màu, freeze, autofilter, độ rộng cột).
- `src/ui.js`: panel, bảng kết quả, lớp phủ xem ảnh, bảng Đã học (DOM).
- `build.js`: ghép header + core + xlsx + ui → `kiem-tra-mo-ta-anh.user.js` (lõi chạy = lõi đã test).
- Test: `test/core.test.js`, `test/xlsx.test.js` (mở lại bằng openpyxl), `test/ui.test.js`, `test/write.test.js`, `test/detail.test.js` (Playwright, trang giả có gridOptions + LBCS + hộp chi tiết giả).

## Rủi ro
- Không vào được trang thật từ môi trường dev (Claude in Chrome lỗi kết nối) → kiểm chứng giao diện bằng trang giả;
  anh chạy thử trên trang thật ở Bước 5.
- API 8 quận có thể trả ít trường hơn lưới (Image*, ParentTaskId) → công cụ kiểm tra trường, báo rõ nếu thiếu.
