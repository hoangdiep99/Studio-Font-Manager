<p align="center">
  <img src="logo.png" width="130" height="130" alt="Studio Font Manager Logo" style="border-radius: 26px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);" />
</p>

<h1 align="center">STUDIO FONT MANAGER</h1>

<p align="center">
  <b>Phần mềm chuyên dụng quản lý, xem trước hàng loạt và xuất bảng mẫu phông chữ (Font Catalogue) chuẩn độ nét cao 300 - 500 DPI</b><br>
  <i>Dành cho Studio ảnh viện áo cưới, in ấn thiệp, bảng hiệu, thiết kế đồ họa chuyên nghiệp.</i>
</p>

<p align="center">
  <a href="https://github.com/hoangdiep99/Studio-Font-Manager/releases/latest">
    <img src="https://img.shields.io/github/v/release/hoangdiep99/Studio-Font-Manager?color=be123c&label=Phi%C3%AAn%20b%E1%BA%A3n%20m%E1%BB%9Bi%20nh%E1%BA%A5t&logo=windows" alt="Latest Release" />
  </a>
  <a href="https://github.com/hoangdiep99/Studio-Font-Manager/releases">
    <img src="https://img.shields.io/github/downloads/hoangdiep99/Studio-Font-Manager/total?color=059669&label=L%C6%B0%E1%BB%A3t%20t%E1%BA%A3i&logo=github" alt="Total Downloads" />
  </a>
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-blue?logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/DPI-300%20--%20500%20DPI-gold" alt="DPI" />
</p>

---

## 📥 Tải Về & Cài Đặt Nhanh

Bạn có thể tải ngay bản cài đặt sẵn chạy trực tiếp không cần cấu hình:

| Phiên bản | Link tải trực tiếp | Bộ đếm lượt tải |
| :--- | :--- | :--- |
| **Bản chạy trực tiếp (`.exe`)** | [👉 **Tải StudioFontManager.exe**](https://github.com/hoangdiep99/Studio-Font-Manager/releases/latest/download/StudioFontManager.exe) | ![Downloads](https://img.shields.io/github/downloads/hoangdiep99/Studio-Font-Manager/latest/StudioFontManager.exe?color=be123c&label=T%E1%BA%A3i%20.exe) |
| **Bản file nén (`.zip`)** | [👉 **Tải StudioFontManager-v1.3-Windows.zip**](https://github.com/hoangdiep99/Studio-Font-Manager/releases/latest/download/StudioFontManager-v1.3-Windows.zip) | ![Downloads](https://img.shields.io/github/downloads/hoangdiep99/Studio-Font-Manager/latest/StudioFontManager-v1.3-Windows.zip?color=059669&label=T%E1%BA%A3i%20.zip) |

> 💡 **Hướng dẫn chạy:** Tải về máy và nháy đúp vào `StudioFontManager.exe` là mở ngay giao diện phần mềm! *(Yêu cầu máy tính đã cài đặt [Node.js](https://nodejs.org/))*.

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

## 🛠️ Cấu Trúc Dự Án

```
Studio-Font-Manager/
├── public/
│   ├── index.html          # Giao diện chính, canvas render bảng mẫu & preview font
│   └── logo.png            # Logo đồ họa thương hiệu Studio Font Manager
├── data/
│   └── metadata.json       # Lưu cấu hình, danh sách yêu thích, thẻ font, lịch sử xem
├── fonts/                  # Thư mục chứa các font riêng của studio (.ttf, .otf)
├── trash_fonts/            # Thùng rác sao lưu tự động khi xoá font
├── server.js               # Backend Node.js xử lý font binary parser, cài font, zip
├── StudioFontManager.cs    # Wrapper Desktop C# WinForms
├── StudioFontManager.exe   # Ứng dụng Desktop chạy trực tiếp
├── build-exe.js            # Script đóng gói và biên dịch file .exe
├── logo.png                # Logo độ phân giải cao 512x512
├── app.ico                 # Icon ứng dụng đa kích thước
└── README.md               # Tài liệu hướng dẫn sử dụng
```

---

## 📜 Giấy Phép
Dự án được phát triển phục vụ công việc thiết kế, in ấn và quản lý tài nguyên font chuyên nghiệp.
