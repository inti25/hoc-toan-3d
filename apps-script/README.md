# Hướng Dẫn Cài Đặt Google Apps Script Làm Backend Cho Vương Quốc Học Toán 3D

Tài liệu này hướng dẫn cách kết nối Google Sheets làm Database và Google Apps Script làm Backend API cho game **Vương Quốc Học Toán 3D**.

---

## 🚀 Các Bước Cài Đặt (Chỉ mất 2 phút)

### Bước 1: Tạo Google Spreadsheet mới
1. Mở trình duyệt, truy cập [Google Sheets](https://sheets.new) để tạo một bảng tính trắng mới.
2. Đặt tên bảng tính, ví dụ: `Ngan_Hang_Toan_Lop2_Archimedes`.

### Bước 2: Dán mã Apps Script
1. Trên thanh công cụ của Google Sheets, chọn **Tiện ích mở rộng** (Extensions) ➔ **Apps Script**.
2. Xóa toàn bộ nội dung mặc định trong file `Mã.gs` (hoặc `Code.gs`).
3. Mở file [apps-script/Code.gs](./Code.gs) trong dự án này, copy toàn bộ nội dung và dán vào trình soạn thảo Apps Script.
4. Bấm biểu tượng 💾 **Lưu** (Save).

### Bước 3: Tự động khởi tạo trọn bộ 7 tab với 50 bài toán (1-Click trong Apps Script)
1. Tại thanh công cụ phía trên của Apps Script, ở ô chọn hàm (Function dropdown), chọn hàm **`seedFullKingdomDatabase`**.
2. Bấm nút **▷ Chạy** (Run).
3. Google sẽ yêu cầu cấp quyền truy cập bảng tính lần đầu (Review Permissions ➔ Chọn tài khoản của bạn ➔ Bấm **Nâng cao / Advanced** ➔ Bấm **Đi tới... (không an toàn)** ➔ Bấm **Cho phép / Allow**).
4. Khi chạy xong (chỉ 1 - 2 giây), quay lại tab Google Sheets, bạn sẽ thấy 7 tab được tạo tự động với đầy đủ 50 bài toán:
   - **`CONFIG` (Sổ Đăng Ký Vùng Đất)**: Khai báo 6 vùng đất 3D (5 phân khu Archimedes + 1 Vườn hoa).
   - **`Zone_1_Archimedes` đến `Zone_5_Archimedes`**: 40 bài toán Archimedes (trang 128 - 139).
   - **`VuonHoa`**: 10 bài toán Vườn Hoa Tri Thức.
   - **`LOGS` (Nhật Ký Thám Hiểm)**: Tự động ghi nhận lịch sử giải bài của học sinh (bảo toàn vĩnh viễn, không bị xóa).

### Bước 4: Triển khai Web App (Deploy)
1. Ở góc trên bên phải của Apps Script, bấm nút **Triển khai** (Deploy) ➔ Chọn **Quản lý bản triển khai** (nếu đã tạo) hoặc **Tùy chọn triển khai mới** (New deployment).
2. Chọn **Ứng dụng web** (Web app).
3. Điền thông tin cấu hình:
   - **Mô tả**: `Backend Vuong Quoc Toan 3D`
   - **Thực thi dưới dạng** (Execute as): `Tôi` (Me - địa chỉ email của bạn)
   - **Ai có quyền truy cập** (Who has access): **`Bất kỳ ai` (Anyone)** *(Quan trọng: phải chọn Anyone để học sinh không cần đăng nhập Google vẫn tải được câu hỏi)*.
4. Bấm **Triển khai** (Deploy) hoặc lưu phiên bản mới (New version).
5. Copy đường dẫn **URL ứng dụng web** (Web app URL), có dạng:
   `https://script.google.com/macros/s/AKfycb.../exec`

### Bước 5: Đồng bộ & Khởi tạo linh hoạt (3 phương thức tiện lợi)
- **Cách 1: Chạy trực tiếp trong Apps Script (Nhanh nhất & Đơn giản nhất)**:
  Chọn hàm `seedFullKingdomDatabase` và bấm **▷ Chạy** như hướng dẫn ở Bước 3.
- **Cách 2: Từ giao diện Game (Dành cho Giáo viên/Admin)**:
  Mở game ➔ Bấm biểu tượng ⚙️ **Cài đặt** ➔ Bấm nút **"⚡ Khởi tạo 50 câu hỏi lên Sheets"**.
- **Cách 3: Từ dòng lệnh Terminal máy tính**:
  Chạy lệnh:
  ```bash
  npm run seed:sheets
  ```

---

## 📖 Hướng Dẫn Soạn Thảo Đảo & Câu Hỏi Mới

### 1. Thêm một vùng đất / hòn đảo mới
Mở tab `CONFIG`, thêm một dòng mới:
- **`ZoneId`**: Mã số phân khu (VD: `7`).
- **`Name`**: Tên hiển thị (VD: `Đảo Phép Nhân Cửu Chương`).
- **`Title`**: Tiêu đề phân khu.
- **`Description`**: Mô tả nội dung bài học.
- **`Template`**: Chọn 1 trong 3 kiểu bố cục 3D:
  - `GRID_SANCTUARY`: Đảo chữ nhật, các bia đá xếp thành 2 hàng ngay ngắn.
  - `CIRCLE_SANCTUARY`: Đảo tròn, các bia đá xếp vòng cung quanh biểu tượng trung tâm.
  - `FLOWER_BEDS`: Đảo luống hoa dọc theo lối đi.
- **`SheetName`**: Tên tab sheet chứa câu hỏi của đảo này (VD: `Zone_7_PhepNhan`).
- **`CenterX`, `CenterZ`**: Tọa độ tâm đảo trên bản đồ (hoặc để mặc định).
- **`Width`, `Depth`**: Chiều rộng & dài của đảo (VD: `24`, `32`).
- **`ColorHex`**: Mã màu hào quang (VD: `#f59e0b`, `#38bdf8`, `#10b981`).
- **`Badge`**: Tên huy chương trao tặng khi hoàn thành.

### 2. Soạn câu hỏi trong Bảng Thử Thách
Tạo một sheet mới trùng với `SheetName` khai báo ở trên:
- **`ProblemId`**: Mã bài toán (VD: `101`). Nếu bài toán có nhiều bước, điền cùng một `ProblemId` cho các dòng liên tiếp.
- **`StepId`**: Mã bước (VD: `101_1`, `101_2`).
- **`Prompt`**: Đề bài toán cho bé.
- **`OptionA`, `OptionB`, `OptionC`, `OptionD`**: Các đáp án trắc nghiệm lựa chọn.
- **`Answer`**: Đáp án chính xác.
- **`Hints`**: Các tầng gợi ý dẫn dắt, phân tách bằng dấu gạch đứng `|` (VD: `Gợi ý 1 | Gợi ý 2 | Lời giải chi tiết`).
- **`Explanation`**: Lời giải thích khi bé hoàn thành.
- **`PosX`, `PosZ`**: *(Không bắt buộc)* Tọa độ bia đá nếu muốn đặt chính xác vị trí; nếu để trống game sẽ tự tính toán theo Template.
