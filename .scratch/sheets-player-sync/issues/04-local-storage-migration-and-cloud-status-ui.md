Title: Di chuyển Dữ liệu Cục bộ Hiện tại và Giao diện Chỉ báo Đám mây
Type: task
Status: resolved
Blocked by:

## Question

Kế hoạch di chuyển (migration) dữ liệu của những người chơi hiện tại đang lưu trên trình duyệt (`localStorage`) sang mô hình đồng bộ đám mây mới:
1. Khi học sinh mở game lần đầu sau cập nhật, tự động kiểm tra xem đã có `passcode` chưa; nếu chưa, sinh mã mới và tự động kích hoạt đồng bộ lên tab `PLAYERS`.
2. Bổ sung icon trạng thái đám mây trên HUD góc trên màn hình:
   - ☁️ *Đã lưu lên đám mây*
   - 🔄 *Đang đồng bộ...*
   - ⚡ *Offline (Chờ kết nối)*
3. Thêm phần quản lý tài khoản trong Dialog Cài đặt (Settings):
   - Hiển thị Mã Thám Hiểm của bé (kèm nút sao chép mã).
   - Nút "Đồng bộ ngay bây giờ" (Force Sync).
   - Nút "Chuyển tài khoản / Khôi phục từ mã khác".

## Answer

Đã hoàn thành toàn diện Vé 04 đáp ứng trọn vẹn 3 mục tiêu với trải nghiệm liền mạch, offline-first và bảo toàn tối đa quyền lợi của học sinh:

1. **Cơ chế Tự động Di chuyển Dữ liệu Cũ (`runLocalStorageMigration`)**:
   - Tọa lạc tại [src/core/SyncManager.ts](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/src/core/SyncManager.ts).
   - Hàm `hasLocalProgress(state)` kiểm tra chính xác nếu người chơi cũ đã có điểm tích lũy (`xp > 0`, `coins > 0`, `bridge > 0`, hoa nở, bia đá, cây công viên hoặc các bài toán đã giải).
   - Khi phát hiện người chơi có tiến trình cục bộ và chưa đánh dấu `aigame3d_cloud_migrated_v1`:
     - Tự động gán/sinh `passcode` định dạng `MTH-XXX` thân thiện thông qua `profileManager.getProfile()`.
     - Tự động đẩy toàn bộ tiến trình lên Google Sheets tab `PLAYERS` trong nền thông qua `syncManager.flushNow()`.
     - Lưu cờ `aigame3d_cloud_migrated_v1` để tránh gọi migration lặp lại không cần thiết.
     - Phát thông báo toast thân thiện: *"☁️ Đã sao lưu dữ liệu của bé lên đám mây (Mã: MTH-XXX)"*.
   - Với người chơi mới toanh (0 điểm, chưa bắt đầu), cờ cũng được đánh dấu để đồng bộ diễn ra bình thường theo hàng đợi debounce trong quá trình học.

2. **Nút và Chấm Chỉ báo Trạng thái Đám mây trên Topbar (`#cloud-status-btn`)**:
   - Bổ sung nút `#cloud-status-btn` nằm cạnh nút âm thanh và cài đặt trên thanh tiêu đề `topbar`, luôn khả dụng ở cả Màn hình Chào mừng và trong Thế giới 3D.
   - Chấm chỉ báo trạng thái trực quan `#cloud-status-dot`:
     - `.synced`: Xanh lục tĩnh dịu mắt, tooltip `Đã lưu lên đám mây (X phút trước)`.
     - `.syncing`: Xanh dương phát xung động (`cloud-dot-pulse`), tooltip `Đang đồng bộ lên Google Sheets...`.
     - `.offline`: Vàng hổ phách, tooltip `Offline - Chờ kết nối mạng để đồng bộ`.
     - `.error`: Đỏ cảnh báo, tooltip `Lỗi kết nối (Mô tả)`.
     - `.idle`: Xám nhạt sẵn sàng.
   - Nhấp vào `#cloud-status-btn`:
     - Nếu đang offline hoặc gặp lỗi: tự động kích hoạt `syncManager.flushNow()` thử kết nối lại ngay lập tức.
     - Nếu đã đồng bộ: hiển thị toast thông báo thời gian đồng bộ gần nhất và nhắc Mã Thám Hiểm của bé.

3. **Khu vực Quản lý Hồ sơ & Đám mây Nâng cao trong Cài đặt (`settings()`)**:
   - Thẻ hiển thị Mã Thám Hiểm nổi bật với nút Sao chép tiện lợi.
   - Thanh trạng thái đồng bộ đám mây động (`.cloud-sync-status-row`): chấm màu trạng thái thời gian thực và thời gian đồng bộ dạng tương đối (*"Vừa xong"*, *"X phút trước"*).
   - Hàng nút hành động cân đối, trực quan:
     - Nút *"Lưu hồ sơ"* (cập nhật tên dũng sĩ, lớp học).
     - Nút *"Đồng bộ ngay"* (với trạng thái đang xoay/vô hiệu hóa tạm thời khi bấm).
     - Nút *"Chuyển tài khoản / Khôi phục mã khác"* toàn chiều rộng giúp chuyển đổi hoặc phục hồi tiến trình dũng sĩ khác dễ dàng.

4. **Kiểm thử và Xác thực**:
   - Bộ kiểm thử tự động tại [tests/migration_and_status.test.ts](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/tests/migration_and_status.test.ts) kiểm tra toàn bộ 7 kịch bản: `formatTimeAgo`, `getSyncStatusLabel`, `hasLocalProgress`, migration khi đã gắn cờ, migration người mới, migration người chơi cũ thành công, và xử lý khi mất mạng.
   - Toàn bộ 135/135 bài kiểm thử chạy qua màu xanh (`pass 135, fail 0`).
   - `npm run build` hoàn thành không lỗi.
   - Trực tiếp kiểm tra giao diện bằng trình duyệt với ảnh chụp màn hình xác thực topbar, toast thông báo và hộp thoại cài đặt.

