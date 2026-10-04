Title: Thuật toán Hòa giải Xung đột Union-Max và Hàng đợi Throttled Sync
Type: prototype
Status: resolved
Blocked by:

## Question

Làm thế nào để xây dựng module `SyncManager` đảm bảo tính toàn vẹn dữ liệu khi học sinh chơi trên nhiều thiết bị hoặc bị gián đoạn mạng?
Cần thiết kế:
1. Thuật toán `mergeStates(local: SaveState, remote: SaveState): SaveState`:
   - `xp`: `Math.max(local.xp, remote.xp)`
   - `coins`: `Math.max(local.coins, remote.coins)`
   - `bridge`: `Math.max(local.bridge, remote.bridge)`
   - `flowers`: phép hợp từng phần tử `local.flowers[i] || remote.flowers[i]`
   - `monoliths`: phép hợp từng phần tử `local.monoliths[i] || remote.monoliths[i]`
   - `parkTrees`: phép hợp từng phần tử `local.parkTrees[i] || remote.parkTrees[i]`
   - `solvedProblems`: gộp dictionary (tất cả bài toán đã giải)
2. Hàng đợi đồng bộ Throttled Queue:
   - Debounce 15 giây sau khi có thay đổi trạng thái (hoàn thành câu hỏi, hoa nở, v.v.).
   - Gửi ngay lập tức khi hoàn thành mốc lớn (xong cầu, nở toàn bộ hoa, hoàn thành 1 khu vực).
   - Tự động thử lại (exponential backoff) nếu gặp lỗi mạng hoặc Google Sheets bận.

## Answer

### 1. Thuật toán Hòa giải Xung đột Union-Max (`mergeStates`)
Module `src/core/SyncManager.ts` cài đặt hàm thuần túy `mergeStates(local: SaveState, remote: SaveState): SaveState` theo nguyên tắc không phá hủy (non-destructive CRDT-style):
- **Chỉ số định lượng**: Lấy giá trị lớn nhất `Math.max(local, remote)` cho `xp`, `coins`, `bridge` (giới hạn tối đa 6 nhịp cầu), `combo`.
- **Trạng thái logic**: `questAccepted` và `questComplete` được kích hoạt nếu một trong hai bên đã hoàn thành hoặc số nhịp cầu đạt mức tối đa.
- **Tiến trình thế giới 3D**:
  - `flowers`: Phép hợp từng phần tử `local.flowers[i] || remote.flowers[i]` cho 10 đóa hoa.
  - `monoliths`: Phép hợp từng phần tử cho mảng bia đá (độ dài tối thiểu 40).
  - `zoneBadges`: Phép hợp huy chương 5 phân khu Archimedes.
  - `parkTrees`: Phép hợp 20 cây cổ thụ công viên.
- **Từ điển bài giải**: Gộp toàn bộ bài toán đã giải `{ ...local.solvedProblems, ...remote.solvedProblems }` và tự động bổ sung khóa đồng bộ cho hoa, bia đá, cây đã thức tỉnh.
- **Thống kê chi tiết `questionStats`**: Hợp nhất từng câu hỏi, lấy `correct` cực đại, `attempts` cực đại, thời gian trả lời nhanh nhất và mốc thời gian gần nhất.

### 2. Module `SyncManager` & Hàng đợi Throttled Sync Queue
- **Debounce 15 giây (`queueSync(false)`)**:
  - Khi học sinh di chuyển hoặc giải các bước nhỏ, hệ thống hoãn gọi API và gom thành 1 lượt gửi duy nhất sau 15 giây không hoạt động.
- **Đồng bộ Tức thì khi Đạt Mốc (`queueSync(true)` - Milestone Flush)**:
  - Bỏ qua debounce và gửi ngay lập tức lên Google Sheets khi: hoàn thành 6 nhịp cầu, nở toàn bộ 10 đóa hoa, hoàn thành tất cả bia đá của một phân khu, hoặc khi học sinh nhấn "Đồng bộ lên Đám Mây" trong Cài đặt.
- **Bảo vệ Thoát Trang**: Tự động kích hoạt `syncManager.flushNow()` khi sự kiện `visibilitychange` (chuyển tab/ẩn trình duyệt) hoặc `beforeunload` diễn ra.
- **Cơ chế Tự Động Thử Lại (Exponential Backoff)**:
  - Nếu gặp lỗi mạng hoặc Google Sheets bận (LockService timeout), hệ thống tự động thử lại sau 5s, 10s, 20s... tối đa 60s mà không làm gián đoạn trải nghiệm chơi game.
- **Hai chiều Tải & Hợp nhất (`pullAndMerge`)**:
  - Tải snapshot đám mây, chạy qua `mergeStates` với `Adventure`, phục hồi vào `localStorage` và cập nhật tức thì.

### 3. Kiểm thử Tự động
- Thêm bộ test `tests/sync_manager.test.ts` (5 tests):
  - Kiểm tra thuật toán `mergeStates` với dữ liệu đa thiết bị xung đột chéo.
  - Kiểm tra cơ chế debounce 5 lần gọi chỉ gửi 1 request.
  - Kiểm tra cơ chế milestone gửi tức thì không chờ debounce.
  - Kiểm tra trạng thái thông báo `idle -> syncing -> synced`.
  - Kiểm tra hàm `pullAndMerge` hợp nhất dữ liệu hai chiều.
- Toàn bộ **128 tests** của hệ thống đạt **100% pass**.
