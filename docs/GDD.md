# Vương Quốc Học Toán 3D — Game Design Document (Remake v2.0)

**Version:** 2.0 · **Updated:** 2026-11-24 · [Features](#feature-index) · [Decisions](#decisions) · [Change log](#change-log)

## Summary

**Vương Quốc Học Toán 3D** là game phiêu lưu giải đố giáo dục 3D trên trình duyệt dành cho học sinh tiểu học (6–11 tuổi). Người chơi điều khiển nhân vật đồng hành khám phá Làng Khởi Đầu và các Quần Đảo Tri Thức, vận dụng bảng cửu chương và toán tư duy để xây cầu, giải cứu thú cưng nông trại, mở khóa bệ bật nhảy và thu thập nông sản/xu nhằm trang bị phụ kiện, bùa trợ giúp và trang trí ngôi làng. Một phiên chơi kéo dài 5–15 phút, không giới hạn thời gian và không phạt điểm khi trả lời sai.

| | |
|---|---|
| Genre and camera | 3D Cozy Educational Adventure · Camera góc nhìn thứ ba thống nhất (Third-Person Follow, xoay mượt & tự tránh vật cản) |
| Audience | Học sinh tiểu học lớp 1–5 (6–11 tuổi), giáo viên & phụ huynh (quản lý nội dung qua Google Sheets) |
| Platforms and input | Web / PWA (Desktop, Tablet, Mobile) · Bàn phím (WASD/Mũi tên, Space, E, B, M, Esc, 1–9/Numpad), Chuột, Bánh xe cảm ứng & Gamepad-ready focus |
| Session | 5–15 phút/phiên; tiến trình lưu cục bộ offline-first và đồng bộ đám mây theo Mã Thám Hiểm (`MTH-XXX`) |
| Engine | TypeScript 5.9 + Three.js 0.180 + Vite 7 PWA + Google Apps Script / Sheets CMS |
| Scope | Remake toàn diện từ bản v1.0 theo 4 giai đoạn: Core/Data → UI/UX → 3D Style/Camera → Gameplay & Audio |
| References | *Animal Crossing* (làng hub ấm áp, kinh tế nhẹ), *A Short Hike* (camera/khám phá đảo dễ chịu), *Duolingo* (không phạt sai, ôn tập lặp lại) |

## Pillars

1. **Toán học gắn liền không gian 3D.** Mọi thử thách đều phải được tiếp cận trực tiếp trong thế giới 3D hoặc kích hoạt công trình/địa hình thực thụ; loại bỏ nút "giải bài từ xa" ngay trên Bản Đồ để giữ lý do khám phá.
2. **Không áp lực thời gian, sai là cơ hội học.** Tuyệt đối không đếm ngược gây căng thẳng, không trừ XP/xu khi sai, và luôn có gợi ý phân tầng + hàng đợi ôn tập tự động.
3. **Kinh tế khép kín có ý nghĩa.** Giải toán → nhận XP, Xu & Nông sản → bán/đổi tại Tiệm Tạp Hóa → mua Hiệu ứng, Bùa dùng chủ động trong trận, Phụ kiện & Đồ trang trí Làng; không pay-to-win và không có bùa giải hộ đáp án.
4. **Một phong cách Cozy Storybook thống nhất.** Toàn bộ thế giới, nhân vật, ánh sáng, âm thanh và giao diện tuân theo một bảng màu kem–xanh rêu ấm áp, HUD tối giản theo ngữ cảnh và điều khiển đồng nhất trên mọi thiết bị.

## Core loop

```text
Khám phá vùng đất 3D → Tương tác thực thể (Milo / Cầu / Hoa / Cây / Thú / Bia đá / Tinh thể)
  → Giải bài toán (dùng Bùa chủ động & Gợi ý phân tầng nếu cần)
    → Thế giới 3D biến đổi (xây cầu, hoa nở, thú về chuồng, mở bệ nhảy) + nhận XP, Xu, Nông sản
      → Về Làng Khởi Đầu: bán Nông sản, nâng cấp Túi Đồ / Trang trí Làng / Mở vùng đất mới
```

- **Từng giây (Seconds):** Di chuyển bằng WASD/Bánh xe điều khiển, xoay camera mượt, tiến lại gần mục tiêu có vòng sáng chỉ dẫn, bấm `E` / chạm nút Tương tác ([world-style-camera](features/world-style-camera/design.md)).
- **Từng phút (Minutes):** Hoàn thành 1 thử thách đơn hoặc nhiều bước trong `ChallengeModal` thống nhất ([ui-ux-shell](features/ui-ux-shell/design.md)); giữ chuỗi Combo để nhận thưởng cộng thêm hoặc giải cứu thú đi lạc.
- **Theo phiên & dài hạn (Session & Meta):** Tích lũy XP qua 20 cấp độ, thu thập Huy Chương Vùng Đất, bán nông sản tại Tiệm Tạp Hóa, mở khóa trang trí Làng Khởi Đầu ([progression-economy](features/progression-economy/design.md)), đồng bộ `SaveState v2` lên Google Sheets ([google-sheets-v2](features/google-sheets-v2/design.md)).

## Screens and flow

Luồng màn hình vận hành theo cấu trúc **Screen Stack** (chỉ màn hình trên cùng nhận input; đóng modal trả focus về phần tử trước đó):

`Boot (App Shell <50ms)` → `Welcome (Chọn đồng hành & Tên)` → `WorldHUD` ⇄ `ModalStack [ChallengeModal | MapModal | ShopInventoryModal | QuestLogModal | SettingsModal | ConfirmModal]`

Chi tiết neo giao diện, safe-area, focus trap và event-driven HUD xem tại [ui-ux-shell](features/ui-ux-shell/design.md).

## Direction

- **Tone & Narrative:** Thân thiện, khích lệ, trong sáng kiểu truyện cổ tích hiện đại; Milo là người dẫn đường trung tâm giao nhiệm vụ cửu chương xuyên suốt thay vì biến mất sau cây cầu đầu tiên.
- **Art & Readability:** Phong cách *Cozy Storybook Diorama* với tone mapping `ACESFilmic`, đổ bóng mềm, tương phản rõ giữa thực thể chưa giải (xám/búp nụ/có cột sáng dẫn hướng) và đã giải (tươi sáng/nở rộ/hào quang ổn định).
- **Audio & Game Feel:** Web Audio đa tầng (âm chọn đáp án, âm sai trầm ấm không chói tai, arpeggio thắng bước/thắng bài, âm bước chân & thu hoạch nông sản) kết hợp hạt sáng 3D tức thì.
- **Accessibility:** Tỉ lệ tương phản chữ ≥ 4.5:1, vùng chạm cảm ứng ≥ 44×44 px, hỗ trợ 100% bàn phím (`Tab`, `Enter`, `Esc`, `1–9`, Numpad) và tùy chọn giảm chuyển động (`prefers-reduced-motion`).

## Feature index

| Feature | Status | Scope | Summary | Docs |
|---|---|---|---|---|
| Progression & Economy | designed | MVP | Hệ 20 cấp XP, bảng thưởng, Cửu Chương xuyên suốt, Shop & Nông sản | [design](features/progression-economy/design.md) |
| UI/UX Shell & Challenge | designed | MVP | Screen stack, HUD tối giản theo sự kiện, safe-area, focus trap, ChallengeModal hợp nhất | [design](features/ui-ux-shell/design.md) |
| Google Sheets v2 & Save | designed | MVP | Schema Sheets v2, `SaveState v2` khóa `${zoneId}:${problemId}`, migration v1 → v2 | [design](features/google-sheets-v2/design.md) |
| World Style & Camera | designed | MVP | Third-Person Camera thống nhất, lighting ACESFilmic, `WorldRegionPlugin`, raycast 3D | [design](features/world-style-camera/design.md) |
| Village Decor & Companions | idea | later | Trang trí Làng Khởi Đầu bằng xu/nông sản và phụ kiện nhân vật gốc | — |

## Milestones

1. **M1 — GDD & Chuẩn hóa tài liệu (Phần 1):** Hoàn tất `GDD.md` và 4 feature `design.md` trước khi sửa code · done when: `check_docs.py` đạt 0 error và mọi chỉ số, vật phẩm, cột Sheets được chốt.
2. **M2 — Core Logic & Data v2 (Phần 2a):** Fix bug `ArchimedesZoneBuilder`, chuyển `Adventure` & `SaveState` sang schema v2 + migration v1, kích hoạt bán nông sản & bùa chủ động, đạt 100% unit test pass.
3. **M3 — Unified Challenge & UI/UX Shell (Phần 2b):** Hợp nhất 5 luồng `ChallengeDialog` thành 1 modal dùng chung, áp dụng HUD tối giản theo sự kiện, Screen Stack & focus trap, gỡ nút giải bài từ xa trong Bản Đồ.
4. **M4 — 3D Style, Camera & Village Prototype (Phần 3):** Áp dụng `ACESFilmicToneMapping`, nâng cấp ánh sáng/bảng màu Làng Khởi Đầu, thống nhất Third-Person Camera và tách region plugin đầu tiên.

## Decisions

| ID | Date | Decision | Alternatives considered | Why | Affects |
|---|---|---|---|---|---|
| D-001 | 2026-11-24 | Hợp nhất tiến trình theo `${zoneId}:${problemId}` trong `SaveState v2` | Giữ mảng rời `flowers[]`, `parkTrees[]`, `monoliths[]` | Mảng cố định gây đè tiến độ khi có nhiều Park/Farm và gây bug lệch ID `301` vs `306` | [google-sheets-v2](features/google-sheets-v2/design.md) |
| D-002 | 2026-11-24 | Loại bỏ nút giải bài trực tiếp trong Bản Đồ Vương Quốc | Giữ nút giải nhanh trên card Bản Đồ | Cho phép giải tại chỗ triệt tiêu lý do di chuyển khám phá 3D | [ui-ux-shell](features/ui-ux-shell/design.md) |
| D-003 | 2026-11-24 | Chỉ bán/đổi lại Nông sản tại Tiệm Tạp Hóa, không cho mua Nông sản bằng xu | Để chung `produce_*` trong danh mục mua của Shop | Nông sản là phần thưởng thu hoạch từ Nông Trại để đổi lấy Xu/Bùa | [progression-economy](features/progression-economy/design.md) |
| D-004 | 2026-11-24 | Bùa hỗ trợ dùng chủ động trong trận, tuyệt đối không có bùa giải hộ | Chỉ có bùa x2 XP thụ động | Bùa Gợi ý / Bỏ 1 đáp án sai giúp giảm áp lực tâm lý mà vẫn giữ tính sư phạm | [progression-economy](features/progression-economy/design.md) |
| D-005 | 2026-11-24 | Thống nhất 1 hệ Third-Person Camera mượt cho toàn bộ vùng đất | Giữ Isometric xa tít tách biệt với FPS cận cảnh | Chuyển camera đột ngột khi qua cổng gây mất phương hướng cho học sinh nhỏ | [world-style-camera](features/world-style-camera/design.md) |

## Open questions

- **Assumptions to confirm:**
  - `[ASSUMPTION]` Gói nhân vật gốc mới sẽ giữ slot cho `baochau` và chuẩn hóa chiều cao chung `1.8m` cho mọi avatar; các model IP ngoài hiện tại được giữ tạm ở chế độ tương thích ngược trong lúc chuyển dần sang bộ nhân vật gốc.
  - `[ASSUMPTION]` Dữ liệu `seedData.json` sẽ được rút gọn thành gói *Starter Offline Pack* (Làng + Vườn Hoa + 1 Khu mẫu) để người chơi không có mạng lần đầu vẫn trải nghiệm được ngay trước khi Sheets đồng bộ đè.
- **Risks:**
  - Google Apps Script cũ đang chạy thực tế trên sheet của giáo viên -> cần giữ tương thích ngược API `doGet`/`doPost` v1 song song với các cột v2 mới.

## Change log

**2.0 (2026-11-24):** Viết bản GDD làm lại tổng quan cho Vương Quốc Học Toán 3D v2.0; chốt 4 pillar, vòng lặp chơi, bảng 20 cấp độ, danh mục vật phẩm, UI/UX theo chuẩn game-ui-ux và schema Google Sheets v2; log D-001..D-005.
