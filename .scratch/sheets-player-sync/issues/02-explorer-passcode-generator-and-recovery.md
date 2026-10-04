Title: Cơ chế Tạo và Phục hồi bằng Mã Thám Hiểm (Explorer Passcode)
Type: prototype
Status: resolved
Blocked by:

## Question

Làm thế nào để tạo Mã Thám Hiểm (Explorer Passcode) 6 ký tự thân thiện (ví dụ `MTH-882` hoặc 6 ký tự dễ đọc, loại trừ các ký tự dễ nhầm lẫn như 0/O, 1/I/l), tự động gán vào Profile của học sinh khi bắt đầu chơi?
Cần thiết kế luồng khôi phục dữ liệu:
1. Giao diện modal "Khôi phục tài khoản bằng Mã Thám Hiểm" trên màn hình Chào mừng (Welcome Screen) và Cài đặt (Settings).
2. Khi nhập đúng mã, client gọi API Apps Script tải bản lưu về, áp dụng thuật toán kiểm tra tính hợp lệ của `SaveState` và ghi đè vào `localStorage`.
3. Thông báo phản hồi và tự động cập nhật avatar, nhân vật, cấp độ trên giao diện.

## Answer

### 1. Thuật toán Sinh Mã Thám Hiểm Thân Thiện (Kid-Friendly Passcode Generator)
- **Tập ký tự an toàn**: `PASSCODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'` (32 ký tự, loại trừ triệt để `0`, `O`, `1`, `I`, `l` để trẻ lớp 2 không bao giờ gõ nhầm).
- **Định dạng chuẩn**: `MTH-XXX` (ví dụ `MTH-882`, `MTH-9KP`).
- **Bộ chuẩn hóa vị tha (`normalizePasscode`)**:
  - Tự động chuyển đổi chữ thường thành chữ hoa, bỏ khoảng trắng dư thừa.
  - Tự động bổ sung tiền tố `MTH-` nếu học sinh chỉ gõ 3 ký tự đuôi (VD: `882` -> `MTH-882`, `mth882` -> `MTH-882`).
  - Cho phép giữ nguyên các mã tùy chỉnh khác như `HO-CON-123`, `RONG-VANG-789`.
- **Tự động cấp phát danh tính**: Khi học sinh mở game lần đầu, `ExplorerProfileManager` tự động sinh `passcode` và `explorerId` (`exp_...`), lưu trữ bền vững vào `localStorage` và bảo toàn qua các lần cập nhật profile.

### 2. Giao diện Khôi phục Tài khoản Đa Thiết Bị
- **Màn hình Chào mừng (Welcome Screen)**:
  - Bổ sung nút bấm trực quan `restore-welcome`: `☁️ Khôi phục bằng Mã Thám Hiểm`.
- **Menu Cài đặt (Settings Modal)**:
  - Bổ sung khu vực `Hồ Sơ & Mã Thám Hiểm`:
    - Ô hiển thị to rõ mã cá nhân kèm nút `📋 Sao chép` (tự động sao chép vào bộ nhớ đệm và hiển thị phản hồi "Đã chép!").
    - Nút bấm `☁️ Khôi phục từ Mã khác` để chuyển đổi tài khoản bất cứ lúc nào.
- **Hộp thoại Khôi phục (Recovery Dialog)**:
  - Input mã có kiểu chữ to (22px), căn giữa, monospace, viết hoa và giãn cách ký tự thân thiện với trẻ em.
  - Tìm kiếm trực tiếp với Google Sheets qua `loadPlayerProgressFromSheets`.
  - Hiển thị **Thẻ Xem Trước Dũng Sĩ (Student Preview Card)** với đầy đủ Avatar, Tên, Lớp, Cấp độ, Tổng XP, Tiền xu, số nhịp cầu đã xây, số hoa đã nở, số bia đá đã giải và ngày chơi gần nhất.
  - Nút xác nhận "Đồng ý khôi phục tiến trình này" bảo vệ học sinh khỏi việc nạp nhầm mã.

### 3. Đồng bộ và Tái thiết lập Trạng thái Thế giới 3D (`applyRestoredPlayer`)
- Sử dụng `sanitizeSaveState(player.saveData)` để làm sạch và xác thực toàn bộ cấu trúc dữ liệu JSON từ Google Sheets.
- Nạp trạng thái mới vào `Adventure` thông qua phương thức `adventure.restoreState(parsedState)`.
- Tự động đồng bộ và cập nhật tức thì:
  - Thanh chỉ số HUD (tên, avatar, cấp độ, thanh XP, ví xu, số hoa, bia đá).
  - Các ô nhập tên và lớp ở màn hình chào mừng (`initWelcomeProfile`).
  - Thế giới 3D (`world.setAvatar`, `world.setBridge`, `world.setFlowersBloomed`, `world.setMonolithsActivated`, `world.syncAwakenedParkTrees`).
- Hiển thị thông báo chúc mừng dũng sĩ trở lại thông qua hệ thống Toast.

### 4. Kiểm thử Tự động & Xác minh Trực quan
- **Unit Tests**: `tests/passcode_and_recovery.test.ts` (6 tests bao quát thuật toán sinh mã, chuẩn hóa mã, tự động cấp phát, lưu trữ, phục hồi dữ liệu đám mây vào Adventure). Toàn bộ 123 tests của repo đạt 100% pass (`123 pass, 0 fail`).
- **Browser Visual Verification**: Đã chạy subagent kiểm tra trực quan chụp lại ảnh màn hình thực tế: nút khôi phục trên welcome, modal tìm kiếm dữ liệu, và thẻ mã thám hiểm cá nhân trong cài đặt.
