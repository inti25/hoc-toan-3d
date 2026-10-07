# Wayfinder Map: Hệ Thống Tiêu Dùng Xu & Tiệm Tạp Hóa Vương Quốc

## Destination

Đặc tả chi tiết và hoàn thiện hệ sinh thái tiêu dùng Xu: kiến trúc dữ liệu Túi Đồ Dũng Sĩ (`inventory`), Tiệm Tạp Hóa Vương Quốc (3D Stall + Quick HUD Modal), danh mục vật phẩm đầu tiên (Hiệu Ứng Bước Chân + Bùa Trợ Thủ) và cơ chế kích hoạt bùa trong Thử Thách giải toán.

## Notes

- **Lĩnh vực**: Gamification giáo dục tiểu học (Toán 1–5), Three.js particle effects, UI modal, Google Sheets cloud sync.
- **Kỹ năng liên quan**: `domain-modeling`, `codebase-design`, `tdd`.
- **Nguyên tắc vàng**:
  - Không pay-to-win, không tạo áp lực cày cuốc, giữ vững tinh thần sư phạm.
  - Chu kỳ thưởng ngắn hạn: giải 6–10 câu toán là có thể mua được món đồ đầu tiên.
  - Offline-first: Lưu cục bộ và đồng bộ tự động `Union-Max` lên Google Sheets.

## Decisions so far

- [Định hướng tiện ích Xu cốt lõi]: Tập trung 100% vào Sưu tầm thẩm mỹ (Hiệu Ứng Bước Chân) và Bùa nhân đôi kinh nghiệm (XP Booster). Tuyệt đối KHÔNG có bùa giải hộ hay gạch bỏ đáp án để bảo vệ tính sư phạm toán học.
- [Điểm chạm tương tác 3D]: Sử dụng 1 trong 3 ngôi nhà hiện hữu tại Làng Khởi Đầu (nhà mái cam X: -12, Z: -6 hoặc nhà ven sông X: -4, Z: -11) cải tạo thành Tiệm Tạp Hóa Vương Quốc với biển hiệu gỗ, thảm chào đón và đèn lồng ấm áp.
- [Giao diện Thử Thách]: Giữ nguyên vẹn giao diện `ChallengeDialog` làm bài toán thanh thoát, không nhồi nhét nút bùa trong bài quiz.
- [Danh mục mở bán đợt 1]:
  1. 🌸 *Hiệu Ứng Bước Chân Hoa Cỏ* (80 xu - vĩnh viễn): Nở hoa cỏ li ti dưới chân khi chạy.
  2. ✨ *Hiệu Ứng Bước Chân Bụi Sao* (150 xu - vĩnh viễn): Bụi sao băng ánh kim rơi theo bước chân.
  3. ❄️ *Hiệu Ứng Bước Chân Băng Tuyết* (250 xu - vĩnh viễn): Tinh thể tuyết và sương mai mát lạnh.
  4. ⭐ *Bùa Sao Băng May Mắn* (50 xu / bùa): Tiêu hao, nhân đôi XP cho thử thách tiếp theo.
- [Kiến trúc lưu trữ & đồng bộ]: Tích hợp mảng `inventory: string[]` và `equippedTrail: string` vào `SaveState`, đồng bộ đám mây qua `Union-Max` trên tab PLAYERS.

## Not yet specified

- Mở rộng thêm hệ thống Nhà vườn dũng sĩ / Đảo trang trí riêng (Player Housing).
- Cơ chế gửi quà / tặng bùa cho bạn bè trong cùng lớp học qua Mã Thám Hiểm.
- Hệ thống thú cưng mini chạy lon ton theo sau nhân vật (Pet Companion locomotion).

## Out of scope

- Nạp tiền thật mua xu (IAP) hoặc cơ chế cờ bạc / vòng quay may mắn / lootbox ngẫu nhiên.
- Mua lượt giải bài trực tiếp (tự động điền đáp án hộ mà không cần suy nghĩ).
