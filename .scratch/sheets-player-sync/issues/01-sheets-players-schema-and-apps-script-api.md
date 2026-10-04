Title: Thiết kế Bảng tính Sổ Theo Dõi Người Chơi (Tab PLAYERS) và API Apps Script
Type: prototype
Status: resolved
Blocked by:

## Question

Cấu trúc các cột của tab `PLAYERS` trên Google Sheets cần những trường nào để giáo viên vừa theo dõi trực quan các chỉ số (Tên, Lớp, Mã Thám Hiểm, Cấp độ, Tổng XP, Tổng Xu, Tiến độ các vùng), vừa chứa cột `SaveDataJson` nén toàn diện?
Endpoint Google Apps Script (`doPost` và `doGet`) cần tiếp nhận và phản hồi các action:
1. `savePlayerProgress`: Cập nhật dòng của học sinh (upsert dựa theo `ExplorerId` hoặc `Passcode`) hoặc tạo dòng mới nếu chưa có.
2. `loadPlayerProgress`: Truy vấn dữ liệu học sinh theo `Passcode` hoặc `ExplorerId` để trả về cho client phục hồi.
Cần thiết kế mã Apps Script xử lý an toàn, tránh race conditions và bảo vệ công thức tính toán.

## Answer

### 1. Schema Tab `PLAYERS` (14 cột chuẩn)
Tab `PLAYERS` được thiết kế phục vụ song song hai mục đích: giáo viên xem và lọc trực quan trên Google Sheets, còn client khôi phục 100% trạng thái thế giới 3D.
- `A (1): ExplorerId` — Mã định danh duy nhất của học sinh (VD: `exp_1740998812345_a8f9`).
- `B (2): Passcode` — Mã Thám Hiểm 6-8 ký tự viết hoa (VD: `MTH-882`, `RONG-VANG-789`) dùng để đăng nhập chéo thiết bị.
- `C (3): Nickname` — Tên nhân vật của học sinh.
- `D (4): ClassName` — Lớp học (VD: 3A, 3B, Tự do).
- `E (5): Avatar` — Loại hình đại diện (`boy`, `girl`, `kuromi`, `elsa`, `spiderman`).
- `F (6): Level` — Cấp độ hiện tại.
- `G (7): TotalXP` — Tổng kinh nghiệm tích lũy.
- `H (8): TotalCoins` — Tổng số tiền xu thu thập.
- `I (9): BridgeParts` — Số nhịp cầu qua sông đã sửa (0-6).
- `J (10): FlowersBloomed` — Số đóa hoa tri thức đã nở (0-10).
- `K (11): MonolithsActivated` — Số bia đá Archimedes đã kích hoạt.
- `L (12): TreesAwakened` — Số cây cổ thụ công viên đã thức tỉnh.
- `M (13): LastActiveAt` — Dấu thời gian hoạt động gần nhất theo múi giờ Việt Nam.
- `N (14): SaveDataJson` — Khối dữ liệu JSON lưu trữ toàn bộ trạng thái chi tiết của trò chơi (`SaveState`).

### 2. Backend Apps Script API
- **Khởi tạo tự động**: Hàm `getOrCreatePlayersSheet` và `seedDatabase` tự động tạo tab `PLAYERS`, kẻ tiêu đề nền xanh pastel nhạt (`#e0f2fe`), in đậm và cố định dòng 1 (freeze row 1), tự căn chỉnh độ rộng cột tối ưu.
- **Bảo vệ Concurrency & Race Conditions**: Sử dụng `LockService.getScriptLock().waitLock(15000)` trong `handleSavePlayerProgress` để đảm bảo khi cả lớp cùng nộp bài hoặc đồng bộ ngầm, các thao tác ghi dòng và upsert không ghi đè lẫn nhau.
- **Phòng chống lỗi công thức (Formula Injection)**: Hàm `escapeSheetsText` tự động thêm ký tự `'` phía trước chuỗi bắt đầu bằng `=`, `+`, `-`, `@`, `<`, `>`, `≤`, `≥` để tránh Google Sheets thông báo lỗi `#ERROR!` hoặc kích hoạt formula ngoài ý muốn. Khi đọc trả về trong `handleLoadPlayerProgress`, tiền tố `'` được loại bỏ an toàn.
- **Đa kênh truy vấn (GET & POST)**:
  - `doGet(action='loadPlayerProgress', identifier='...')`: Dùng khi tải tiến trình qua query params.
  - `doPost(action='savePlayerProgress', ...)`: Lưu hoặc cập nhật hàng học sinh (Upsert theo `Passcode` hoặc `ExplorerId`).
  - `doPost(action='loadPlayerProgress', ...)`: Hỗ trợ nạp tiến trình qua payload POST để bảo mật khi cần.

### 3. Client Endpoints (`src/core/sheetsClient.ts`)
- `savePlayerProgressToSheets(payload: SavePlayerProgressPayload, customUrl?: string)`: Gửi HTTP POST với header `'Content-Type': 'text/plain'` để tránh preflight CORS block trên trình duyệt, trả về `{ success: boolean, passcode?: string, lastActiveAt?: string, message: string }`.
- `loadPlayerProgressFromSheets(identifier: string, customUrl?: string)`: Gửi HTTP GET chuẩn hóa truy vấn, trả về `{ success: boolean, player?: RemotePlayerProgress, message?: string }`.
- Cả hai hàm đều bọc trong `try-catch` an toàn, không ném exception làm gián đoạn trò chơi, giữ vững nguyên lý Offline-First.

### 4. Kiểm thử Tự động
- Bộ kiểm thử `tests/sheets_player_api.test.ts` (5 tests) kiểm tra toàn bộ luồng lưu, nạp, xử lý validation rỗng, timeout và HTTP error, đạt 100% pass cùng toàn bộ test suite 117 tests của dự án.
