# Cách đưa bộ này lên GitHub (anh làm 1 lần)

Em không thể tự đăng nhập GitHub của anh để tạo repo, nên anh làm theo 1 trong 2 cách dưới.
Toàn bộ file cần thiết đã nằm sẵn trong thư mục này:

```
repo-lien-ket-su-co/
├─ lien-ket-su-co-smarthcm.user.js   (script chính)
├─ README.md                          (hướng dẫn tiếng Việt, có ảnh)
├─ LICENSE                            (MIT)
├─ .gitignore
├─ HUONG-DAN-TAO-REPO.md              (file này)
└─ docs/
   ├─ panel.png                       (ảnh panel)
   └─ toancanh.jpg                    (ảnh toàn cảnh trên trang)
```

## Cách A — Giao diện web (không cần cài git, dễ nhất)

1. Vào https://github.com/new → đặt tên repo, ví dụ `lien-ket-su-co-smarthcm` → chọn **Private** (hoặc Public) → **Create repository**.
2. Ở trang repo vừa tạo, bấm **“uploading an existing file”** (hoặc **Add file → Upload files**).
3. Kéo-thả **tất cả** file trong thư mục này vào, **giữ nguyên thư mục `docs/`** (kéo cả thư mục docs vào để ảnh hiện được trong README).
4. Bấm **Commit changes**. Xong — README sẽ hiển thị kèm ảnh.

## Cách B — Dùng git (nếu máy đã cài git)

Mở Terminal/CMD tại thư mục `repo-lien-ket-su-co`, chạy:

```bash
git init
git add .
git commit -m "Khởi tạo: userscript liên kết sự cố duy tu SmartHCM"
git branch -M main
# Thay <USERNAME> và <REPO> cho đúng của anh:
git remote add origin https://github.com/<USERNAME>/<REPO>.git
git push -u origin main
```

> Nếu push đòi đăng nhập, dùng **Personal Access Token** của GitHub thay cho mật khẩu
> (Settings → Developer settings → Personal access tokens).

## Cài nhanh cho người khác qua link GitHub

Sau khi lên GitHub (repo Public), gửi đồng nghiệp link **Raw** của file script:

```
https://raw.githubusercontent.com/<USERNAME>/<REPO>/main/lien-ket-su-co-smarthcm.user.js
```

Mở link này trong trình duyệt đã cài Tampermonkey → Tampermonkey tự hỏi **Install**. Bấm Install là xong,
và sau này còn **tự kiểm tra cập nhật** mỗi khi anh sửa file trên GitHub.
