# STUDIO FONT MANAGER 🔤

Phần mềm chuyên dụng quản lý, xem trước hàng loạt và xuất bảng mẫu phông chữ (Font Catalogue) chuẩn độ phân giải cao (300 - 500 DPI) dành cho Studio ảnh viện, in ấn, thiết kế đồ họa.

---

## 🌟 Tính Năng Nổi Bật

### 1. Xem trước phông chữ hàng loạt siêu tốc
- **Tự do nhập nội dung xem thử:** Gõ tên Dâu - Rể, thiệp cưới, tên thương hiệu, bảng hiệu hoặc bất kỳ văn bản nào.
- **Tự động lưu lịch sử gần đây:** Ghi nhớ nội dung nhập cuối cùng, mở app lên là tự hiển thị ngay. Kèm thanh lịch sử bấm chọn nhanh.
- **Biến đổi chữ nhanh:** Viết hoa chữ cái đầu, IN HOA toàn bộ, chèn nhanh ký tự (`&`, `❤️`, `-`).
- **Tùy chỉnh linh hoạt:** Thay đổi kích thước chữ (`px`), đổi màu nền (`Trắng`, `Kem Ấm`, `Đen`, `Vàng Gold`), chuyển đổi linh hoạt giữa giao diện dạng **Lưới (Grid)** và **Bảng Excel (List)**.

### 2. Tự động nhận diện & sửa lỗi tiếng Việt
- **Lọc Font chuẩn Unicode Tiếng Việt:** Thuật toán binary parser tự động phân tích bảng mã `cmap` bên trong từng file `.ttf`/`.otf`, hiển thị tỷ lệ hỗ trợ dấu tiếng Việt và ẩn đi các font thiếu dấu.
- **Hỗ trợ tự động chuyển mã Font `.Vn` (TCVN3):** Tự động chuyển đổi bảng mã để các font `.Vn` cổ điển không bị lỗi mất dấu, mất chữ hay hiện ô vuông `□`.
- **Ẩn font văn phòng mặc định:** Tự động lọc bỏ các font hệ thống như Arial, Calibri, Times New Roman... để tập trung vào các font nghệ thuật, viết tay, việt hóa.

### 3. Quản lý phông chữ chuyên nghiệp
- **Cài đặt Font từ file `.ZIP` hoặc file lẻ:** Bấm **`⬇️ Cài Font (.ZIP / File)`** để chọn file `.zip` hoặc nhiều file `.ttf`/`.otf`. Ứng dụng tự động giải nén và đăng ký cài đặt trực tiếp vào hệ thống Windows (nhận ngay lập tức trong Photoshop, Corel, Illustrator, AI mà không cần khởi động lại máy).
- **Thư mục Font ngoài:** Thêm bất kỳ thư mục font nào trên ổ cứng mà không bắt buộc phải cài nặng máy.
- **Phân loại & Gắn thẻ:** Tự động nhận diện phong cách font (*Viết tay / Chữ ký*, *Sang trọng / Serif*, *Hiện đại / Sans*, *Nghệ thuật*), đánh dấu **Yêu thích (⭐)** hoặc ẩn font xấu.
- **Xoá font an toàn:** Chức năng gỡ/xoá font luôn tự động sao lưu bản dự phòng vào thư mục `trash_fonts` để khôi phục khi cần.
- **Xuất Font đã chọn nén `.ZIP`:** Tích chọn các font ưng ý và bấm **`📦 Xuất Font (.ZIP)`** để gom file nén gửi cho khách hoặc đồng nghiệp.

### 4. Xuất Bảng Mẫu Phông Chữ (Catalogue) Gửi Khách
- **Độ nét cao (300 - 500 DPI):** Ảnh xuất ra cực kỳ sắc nét, nhúng metadata DPI tiêu chuẩn cho in ấn chuyên nghiệp.
- **Đánh số thứ tự tự động:** Mỗi font được đánh mã số (`#01`, `#02`, `#03`...) để khách dễ dàng chốt mã.
- **Gửi Zalo 1 chạm:** Tích hợp nút **Copy ảnh vào Clipboard** để dán (`Ctrl + V`) thẳng vào khung chat Zalo/Facebook, hoặc tải file ảnh PNG nét cao.

---

## 🚀 Cài Đặt & Khởi Chạy

### Yêu cầu hệ thống:
- Hệ điều hành: **Windows 10 / 11**
- Đã cài đặt **Node.js** (khuyến nghị v18 trở lên)

### Khởi chạy:
1. Tải repository về máy.
2. Nháy đúp vào file **`StudioFontManager.exe`** để mở ứng dụng chạy độc lập (giao diện Native Desktop gọn gàng, có icon dưới khay hệ thống Tray Icon).
3. Hoặc chạy lệnh thông qua terminal:
   ```bash
   node server.js
   ```
   Sau đó mở trình duyệt truy cập: `http://localhost:3456`

---

## 🛠️ Cấu Trúc Dự Án

```
Studio-Font-Manager/
├── public/
│   └── index.html          # Giao diện chính, canvas render bảng mẫu & preview font
├── data/
│   └── metadata.json       # Lưu cấu hình, danh sách yêu thích, thẻ font, lịch sử xem
├── fonts/                  # Thư mục chứa các font riêng của studio (.ttf, .otf)
├── trash_fonts/            # Thùng rác sao lưu tự động khi xoá font
├── server.js               # Backend Node.js xử lý font binary parser, cài font, zip
├── StudioFontManager.cs    # Wrapper Desktop C# WinForms
├── StudioFontManager.exe   # Ứng dụng Desktop chạy trực tiếp
├── build-exe.js            # Script đóng gói và biên dịch file .exe
├── app.ico                 # Icon ứng dụng
└── README.md               # Tài liệu hướng dẫn sử dụng
```

---

## 📜 Giấy Phép
Dự án được phát triển phục vụ công việc thiết kế, in ấn và quản lý tài nguyên font chuyên nghiệp.
