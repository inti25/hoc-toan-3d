## Destination

Bản đặc tả kiến trúc (Spec & ADR) và kế hoạch triển khai từng bước cho hệ thống đồng bộ 2 chiều (offline-first), lưu trữ snapshot tiến trình học sinh lên tab `PLAYERS` trên Google Sheets, và khôi phục tài khoản đa thiết bị thông qua Mã Thám Hiểm.

## Notes

- **Domain**: Giáo dục tiểu học, đồng bộ dữ liệu đám mây không cần tài khoản Google (Zero-login / Anonymous-first), Google Apps Script API backend.
- **Skills tư vấn**: `domain-modeling`, `codebase-design`, `grilling`, `prototype`.
- **Standing Preferences**:
  - Không phá vỡ khả năng chơi offline 100% của PWA; `localStorage` luôn là nguồn sự thật cục bộ nhanh nhất.
  - Sử dụng thuật toán Hợp Nhất Thành Tích (Union-Max Sync) để trẻ em không bao giờ bị mất thành quả giải toán.
  - Hàng đợi đồng bộ có độ trễ (Throttled Sync Queue) tránh vượt hạn mức Google Apps Script.

## Decisions so far

- [01: Schema Tab PLAYERS và API Apps Script](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/.scratch/sheets-player-sync/issues/01-sheets-players-schema-and-apps-script-api.md): 14 cột theo dõi trực quan kết hợp SaveDataJson, khóa kịch bản 15s tránh race condition, escape công thức chống #ERROR!, client API save/load bất đồng bộ và kiểm thử 100% pass.
- [02: Bộ Sinh Mã Thám Hiểm và Khôi Phục Đa Thiết Bị](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/.scratch/sheets-player-sync/issues/02-explorer-passcode-generator-and-recovery.md): Sinh mã MTH-XXX loại trừ ký tự gây nhầm, bộ chuẩn hóa vị tha, modal khôi phục tài khoản với thẻ xem trước dũng sĩ, cập nhật tức thì thế giới 3D.
- [03: Thuật toán Union-Max và Hàng đợi Throttled Sync](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/.scratch/sheets-player-sync/issues/03-union-max-sync-and-throttled-queue.md): mergeStates hợp nhất thành tích cực đại không bao giờ mất điểm, hàng đợi debounce 15s gom request, milestone flush tức thì, exponential backoff khi mất mạng.

## Not yet specified

- Tối ưu nén chuỗi `SaveDataJson` (ví dụ bitmask hoặc base64 ngắn gọn) nếu kích thước ô vượt quá 50.000 ký tự khi số lượng bài tập lên tới hàng nghìn bài.
- Chế độ Giáo viên Quản trị Lớp học (Classroom Dashboard): giao diện lọc học sinh theo lớp và xuất báo cáo PDF tiến độ học tập.
- Cơ chế phát hiện gian lận hoặc xung đột đồng thời khi 2 thiết bị cùng nhập 1 Mã Thám Hiểm và chơi cùng thời điểm.

## Out of scope

- Bắt buộc học sinh đăng nhập tài khoản Google OAuth hoặc Email/Mật khẩu (quy tắc bất di bất dịch: không tạo rào cản đăng nhập cho trẻ lớp 2).
- Thay thế Google Sheets bằng cơ sở dữ liệu quan hệ SQL / Firebase trả phí (Google Sheets là database miễn phí, thân thiện và trực quan cho giáo viên tiểu học).
- Realtime WebSocket đồng bộ theo mili-giây (không phù hợp với hạ tầng serverless của Google Apps Script).
