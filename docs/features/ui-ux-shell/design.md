# UI/UX Shell, HUD & Unified Challenge Modal

**Status:** designed · **Updated:** 2026-11-24 · [GDD](../../GDD.md)

Thiết kế giao diện theo tiêu chuẩn **game-ui-ux**: co giãn đáp ứng mọi tỷ lệ màn hình (điện thoại dọc, máy tính bảng, màn hình rộng 21:9), tuân thủ safe-area, điều hướng màn hình dạng Screen Stack, khóa focus trong modal cho bàn phím/gamepad và cập nhật HUD thuần theo sự kiện (event-driven).

## Rules

1. **Scaling & Safe-area policy:**
   - Khung gốc `100dvh × 100vw`, toàn bộ HUD đặt trong lớp phủ neo theo 4 góc và cạnh dưới với khoảng đệm `max(16px, env(safe-area-inset-*))` để không bị tai thỏ hoặc thanh cử chỉ che khuất.
   - Mọi vị trí dùng CSS Flexbox/Grid + neo góc tương đối; không hardcode tọa độ pixel cho từng độ phân giải.
   - Chữ nội dung tối thiểu `15px` trên mobile / `16px–18px` trên desktop, tương phản chữ/nền ≥ `4.5:1`, vùng chạm tối thiểu `44×44 px` (bánh xe điều khiển `136×136 px`, nút nhảy `60×60 px`).
2. **Screen Stack (Ngăn xếp màn hình):**
   - Duy trì 1 stack duy nhất trong `ScreenStack`: `[Welcome]` hoặc `[WorldHUD, ...ModalStack]`.
   - Chỉ màn hình trên cùng nhận input; khi đẩy modal lên stack (`pushModal`), tự động `world.paused = true`, vô hiệu hóa tương tác lớp bên dưới (`inert` / `aria-hidden="true"`), lưu phần tử đang focus trước đó và chuyển focus vào nút chính đầu tiên trong modal.
   - Khi `popModal` (nhấn `Esc`, nút đóng, hoặc giải xong), khôi phục focus về phần tử trước đó nếu còn hiển thị; khi stack rỗng mới bỏ `world.paused = false`.
3. **HUD tối giản theo ngữ cảnh (Contextual HUD):**
   - Trong `WorldHUD`, chỉ hiển thị tối đa **3 cụm thông tin tĩnh**:
     - **Góc trên-trái (`PlayerBadge`):** Avatar + Tên dũng sĩ + Cấp độ + thanh XP mảnh + Ví xu (bấm để mở Hồ sơ/Túi đồ).
     - **Góc trên-phải (`TopActions`):** Tên vùng hiện tại + chấm trạng thái Cloud Sync + nút Nhiệm vụ (`J` / icon cờ) + Âm thanh + Cài đặt (`Esc`).
     - **Cạnh dưới (`ActionBar`):** 4 nút chính gọn (`B` Túi đồ, `M` Bản đồ, Sổ Cửu Chương, Trợ giúp) + Gợi ý phím tắt (chỉ hiện trên desktop khi không dùng cảm ứng) + Nút tương tác ngữ cảnh (`E`) nổi ở giữa phía trên thanh đáy khi đứng gần NPC/thực thể.
   - Loại bỏ `quest-card` khổng lồ thường trực trên desktop; thay bằng **1 dòng Mục tiêu hiện tại (Active Objective Pill)** nhỏ gọn dưới `PlayerBadge` (tối đa 1 nhiệm vụ đang theo dõi), bấm vào mới mở `QuestLogModal`.
   - `FarmTrackerHud` chỉ xuất hiện khi người chơi đang đứng bên trong vùng `FARM_SANCTUARY`.
4. **Event-driven HUD (Không poll DOM mỗi frame):**
   - `Adventure`, `WorldSession`, `SyncManager` phát sự kiện khi dữ liệu đổi (`progress_changed`, `zone_entered`, `sync_changed`, `interact_target_changed`).
   - Vòng lặp 60fps của Three.js **không** ghi DOM mỗi frame; chỉ phát sự kiện `interact_target_changed` khi thực thể gần nhất thực sự đổi, và cập nhật tọa độ nhãn nổi tối đa khi dịch chuyển ≥ `1px`.
5. **Bản Đồ Vương Quốc (`MapModal`) chống exploit:**
   - Bản đồ chỉ hiển thị tiến độ các vùng đất, danh sách mốc và nút **"Dịch chuyển đến vùng"** / **"Đi tới vị trí gần"**.
   - **Loại bỏ hoàn toàn** các nút giải bài trực tiếp (`flower-open-btn`, `monolith-open-btn`, `park-tree-open-btn`, `farm-animal-open-btn`, `qhmj-node-open-btn`) bên trong `MapModal`.
6. **Unified `ChallengeModal`:**
   - Gộp 5 hàm render trùng lặp (`openFlower`, `openParkTree`, `openFarmAnimal`, `openQhmjNode`, `openArchimedes`, và `openMultiplication`) vào 1 component duy nhất nhận `ChallengePresentationConfig` (màu nhấn, huy hiệu, thông điệp trạng thái, callback hoàn thành).
   - Tích hợp thanh **Bùa Trợ Thủ** gọn ở chân khung đề (`charm_hint_scroll`, `charm_eliminate`, và badge báo `charm_double_xp` đang kích hoạt).
   - Hỗ trợ đầy đủ bàn phím: `1–9` chọn đáp án, `0–9`/`Backspace`/`Enter` cho Numpad, `Tab`/`←`/`→` đổi ô `multi-slot`, `<`/`=`/`>` cho so sánh, `H` mở gợi ý, `Esc` đóng modal.

## Numbers

| Thông số UI/UX | Giá trị | Đơn vị | Mục đích |
|---|---:|---|---|
| Breakpoint Mobile / Tablet / Desktop | `<= 640` / `641–1024` / `>= 1025` | `px` | Bố cục neo góc & kích thước nút |
| Safe-area margin tối thiểu | `16` | `px` | Không sát mép màn hình / tai thỏ |
| Kích thước nút chạm tối thiểu | `44 × 44` | `px` | Đạt chuẩn cảm ứng trẻ em |
| Tương phản chữ tối thiểu | `4.5:1` | tỷ lệ | Chữ chính `#194f42` trên nền `#fffcf0` |
| Ngưỡng cập nhật nhãn nổi 3D | `1.0` | `px` | Giảm layout thrashing ở 60fps |

## Edge cases

- **Mở nhiều dialog liên tiếp:** Ví dụ bấm `M` khi đang ở `QuestLog` hoặc hoàn thành câu cuối cùng kích hoạt popup chúc mừng cấp/vùng -> dùng `replaceTopModal` hoặc hàng đợi modal tuần tự trong `ScreenStack`, không đè `<dialog>` gây lỗi `showModal()`.
- **Chuyển thiết bị chuột ↔ cảm ứng ↔ bàn phím:** Di chuyển chuột không được xóa trạng thái focus hiện tại của bàn phím; `:focus-visible` có viền cam `#e99231` `3px` tách biệt hoàn toàn với hiệu ứng `:hover`.
- **Aria-label & Controls hint đồng bộ:** Cập nhật `index.html` và `controls-hint` bỏ mô tả cũ "chạm xuống đất để di chuyển", chỉ giữ WASD/Mũi tên, Bánh xe điều khiển, Kéo chuột xoay camera, Cuộn/Chụm zoom.

## History

- 2026-11-24: designed (GDD Remake v2.0, áp dụng chuẩn `/game-ui-ux`).
