// ⚠️ THAY THẾ 2 giá trị bên dưới bằng thông tin tài khoản Cloudinary (miễn phí) của bạn.
// Lấy Cloud name ở: Cloudinary Dashboard (trang chính sau khi đăng nhập)
// Tạo Upload preset ở: Settings ⚙️ → Upload → Upload presets → "Add upload preset"
//   → đặt Signing Mode = "Unsigned" → Save → copy tên preset vừa tạo vào đây.
//
// Đây KHÔNG phải thông tin bí mật, an toàn khi để public trên GitHub —
// preset "Unsigned" chỉ cho phép tải ảnh lên, không cho xoá/sửa dữ liệu tài khoản.

export const cloudinaryConfig = {
  cloudName: "mx8clqfo",
  uploadPreset: "QuanLyHocTap"
};
