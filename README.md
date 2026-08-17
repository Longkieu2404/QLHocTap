# 🌟 Vườn Học Tập

Web app quản lý học tập cho bé — Phụ huynh tạo bài tập, Học sinh nộp bài bằng ảnh chụp, Phụ huynh chấm điểm & nhận xét. Có tài khoản riêng cho từng người (đăng nhập bằng email/mật khẩu), dữ liệu lưu trên Firebase, ảnh bài nộp lưu trên Cloudinary (miễn phí, không cần thẻ), deploy miễn phí trên GitHub Pages.

> **Lưu ý:** Từ 02/2026, Firebase Storage bắt buộc phải nâng cấp gói Blaze (cần liên kết thẻ) mới dùng được, kể cả khi ở trong hạn mức miễn phí. Vì vậy bản này dùng **Cloudinary** để lưu ảnh thay cho Firebase Storage — hoàn toàn miễn phí, không cần thẻ tín dụng. Auth và Firestore của Firebase vẫn dùng gói Spark (miễn phí) bình thường.

## Cấu trúc project

```
├── index.html          # Trang duy nhất (SPA)
├── css/style.css        # Giao diện
├── js/
│   ├── firebase-config.js     # ⚠️ Điền config Firebase của bạn vào đây
│   ├── cloudinary-config.js   # ⚠️ Điền cloud name + upload preset Cloudinary vào đây
│   └── app.js                  # Toàn bộ logic app
└── firestore.rules      # Luật bảo mật Firestore (chép vào Firebase Console)
```

## Bước 1 — Tạo project Firebase

1. Vào https://console.firebase.google.com → **Add project** → đặt tên (vd: `vuon-hoc-tap`) → tạo xong.
2. Vào **Security → Authentication → Get started** → tab **Sign-in method** → bật **Email/Password**.
3. Vào **Databases & Storage → Firestore → Create database** → **Standard edition** → Database ID để `(default)` → chọn khu vực gần bạn (vd `asia-southeast1`) → **Production mode** → **Create**.

(Không cần tạo Firebase Storage — ảnh bài nộp sẽ lưu ở Cloudinary, xem Bước 2b.)

## Bước 2 — Lấy cấu hình Web app

1. Ở trang tổng quan project → biểu tượng **⚙️ Project settings**.
2. Kéo xuống **Your apps** → bấm biểu tượng **</>** (Web) → đặt tên app → **Register app** (không cần tick Firebase Hosting).
3. Firebase sẽ hiện đoạn `firebaseConfig = {...}` — copy các giá trị đó.
4. Mở file `js/firebase-config.js` trong project này, dán các giá trị vào đúng chỗ (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

> Các giá trị này **không phải bí mật** — an toàn khi để công khai trên GitHub. Quyền truy cập dữ liệu thật sự được kiểm soát bởi Security Rules ở bước tiếp theo.

## Bước 2b — Tạo tài khoản Cloudinary (miễn phí, lưu ảnh bài nộp)

1. Vào https://cloudinary.com/users/register_free → đăng ký bằng Google/GitHub/email (**không cần thẻ**).
2. Sau khi đăng nhập, ở trang **Dashboard**, copy giá trị **Cloud name** (hiển thị ngay đầu trang).
3. Vào **Settings ⚙️ (góc trên) → tab Upload** → kéo xuống **Upload presets** → **Add upload preset**.
4. Đặt **Signing Mode = Unsigned** (bắt buộc, để trang web tải ảnh lên trực tiếp không cần server riêng) → **Save** → copy tên preset vừa tạo (vd `ml_default` hoặc tên bạn đặt).
5. Mở file `js/cloudinary-config.js`, điền `cloudName` và `uploadPreset` vừa lấy được.

> Gói Free của Cloudinary: 25 credit/tháng (≈25GB lưu trữ + băng thông), không giới hạn thời gian, không cần thẻ. Đủ dùng thoải mái cho ảnh bài tập gia đình.

## Bước 3 — Áp dụng Security Rules cho Firestore

1. Firebase Console → **Databases & Storage → Firestore → tab Rules**.
2. Xoá nội dung mặc định, dán toàn bộ nội dung file `firestore.rules` vào.
3. Bấm **Publish**.

## Bước 4 — Chạy thử ở máy local (tuỳ chọn)

App là file tĩnh, không cần build. Có thể mở trực tiếp bằng một local server đơn giản, ví dụ:

```bash
npx serve .
# hoặc
python3 -m http.server 8080
```

Rồi mở `http://localhost:8080`. (Mở trực tiếp bằng `file://` có thể bị lỗi do trình duyệt chặn ES module — nên dùng local server.)

## Bước 5 — Đưa lên GitHub

```bash
git init
git add .
git commit -m "Vườn Học Tập - khởi tạo"
git branch -M main
git remote add origin https://github.com/<ten-ban>/<ten-repo>.git
git push -u origin main
```

## Bước 6 — Bật GitHub Pages

1. Trên GitHub, vào repo → **Settings → Pages**.
2. Ở **Source**, chọn branch `main`, thư mục `/ (root)` → **Save**.
3. Sau 1–2 phút, trang sẽ có tại: `https://<ten-ban>.github.io/<ten-repo>/`.

## Bước 7 — Cho phép domain GitHub Pages đăng nhập Firebase

Firebase Auth chỉ cho phép đăng nhập từ các domain đã được duyệt:

1. Firebase Console → **Authentication → Settings → Authorized domains**.
2. Bấm **Add domain**, nhập `<ten-ban>.github.io` → Save.

Không làm bước này, đăng nhập/đăng ký trên GitHub Pages sẽ báo lỗi.

## Cách dùng app

1. Mở trang web → tab **Đăng ký (Phụ huynh)** → tạo tài khoản phụ huynh.
2. Sau khi vào app, bấm **"Thêm con"** để tạo tài khoản cho từng bé (email + mật khẩu riêng cho bé).
3. Bấm vào tên bé → chọn môn học → **"+ Tạo bài tập"** để giao bài.
4. Đưa email/mật khẩu cho bé đăng nhập ở màn hình đăng nhập (tab **Đăng nhập**).
5. Bé chọn môn → chọn bài tập → **"📷 Nộp bài bằng ảnh"** → chụp/chọn ảnh bài làm → Nộp.
6. Phụ huynh đăng nhập lại, mở bài đã nộp → **"📝 Chấm điểm"** → nhập điểm (0–10) và nhận xét.

## Ghi chú & giới hạn hiện tại

- Đây là bộ rules khởi điểm hợp lý cho dùng trong **một gia đình**. Nếu muốn nhiều gia đình cùng dùng chung 1 project Firebase một cách an toàn tuyệt đối ở quy mô lớn, nên nhờ người có kinh nghiệm Firebase rà lại rules trước khi phát hành rộng.
- Upload preset "Unsigned" của Cloudinary cho phép **bất kỳ ai biết cloud name + tên preset đều tải ảnh lên được** (không cho xoá/sửa tài khoản). Với app dùng riêng trong gia đình thì rủi ro này chấp nhận được; nếu lo ngại, có thể giới hạn thêm định dạng file/kích thước trong cấu hình upload preset trên Cloudinary.
- Chưa có chức năng "quên mật khẩu" — có thể bổ sung bằng `sendPasswordResetEmail` của Firebase Auth nếu cần.
- Gói miễn phí (Spark) của Firebase đủ dùng cho Auth + Firestore; Cloudinary Free đủ dùng cho lưu ảnh — tổng chi phí $0.
