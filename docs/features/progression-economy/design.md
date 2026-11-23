# Progression, Economy & Item Catalog

**Status:** designed · **Updated:** 2026-11-24 · [GDD](../../GDD.md)

Hệ thống tiến trình 20 cấp độ, cơ chế thưởng khuyến khích trả lời đúng ngay lần đầu kết hợp chuỗi Combo, vai trò xuyên suốt của Bảng Cửu Chương và vòng lặp kinh tế Xu ↔ Nông sản ↔ Cửa hàng phục vụ trực tiếp cho trụ cột *Kinh tế khép kín có ý nghĩa*.

## Rules

1. **Nguyên tắc không phạt:** Trả lời sai đặt lại `combo = 0`, đưa câu hỏi cửu chương vào hàng đợi `review`, **không bao giờ** trừ XP, Xu hay làm mất tiến trình đã đạt.
2. **Thưởng theo bước và hoàn thành thực thể:**
   - Giải đúng một bước trung gian (`stepIndex < totalSteps - 1`): cộng **Step XP** (`+10 XP`), không cộng Xu cho tới bước cuối (hoặc chỉ cộng 1 lần duy nhất cho mỗi `stepKey` để tránh farm lặp).
   - Giải đúng bước cuối cùng của một thực thể lần đầu (`firstClear`): cộng đầy đủ XP + Xu + Nông sản (nếu là Nông trại), đồng thời áp dụng thưởng **First-Try Bonus** (`+5 XP` nếu `attempts === 1`) và **Combo Bonus** (từ chuỗi 3 câu đúng liên tiếp ở lần thử đầu).
   - Ôn luyện lại thực thể đã hoàn thành (`replay`): chỉ cộng thưởng ôn tập nhỏ (`+5 XP`, `+1 xu`, tối đa 1 lần/phiên cho mỗi thực thể hoặc cho chế độ Luyện Cửu Chương cùng Milo) để tránh cày vô hạn trên 1 câu dễ.
3. **Bảng Cửu Chương làm mạch xương sống:**
   - Xây cầu Làng Khởi Đầu (6 đoạn) chỉ là chặng mở đầu. Sau khi qua cầu, Milo mở **Thử Thách Hằng Ngày / Nạp Năng Lượng Cổng** (mỗi chuỗi 5 phép nhân từ `review` + bảng đang luyện thưởng `+25 XP, +15 xu` và `1 Bùa Gợi Ý`).
4. **Cơ chế Bùa (Charms) chủ động & thụ động:**
   - `charm_double_xp` (Thụ động, tự kích hoạt khi hoàn thành thử thách kế tiếp ở **mọi** vùng đất, không chỉ quiz cửu chương).
   - `charm_hint_scroll` (Chủ động, bấm trong `ChallengeModal` để mở 1 tầng gợi ý mà không làm mất thưởng First-Try).
   - `charm_eliminate` (Chủ động, chỉ dùng cho câu trắc nghiệm ≥ 3 phương án: gạch bỏ 1 phương án sai ngẫu nhiên; **không** giải hộ đáp án).
5. **Vòng lặp Nông Sản (Farmstead Produce):**
   - Mỗi lần giải cứu thành công 1 con vật tại Nông Trại sẽ thưởng đúng loại nông sản gắn với loài đó (`cow/calf → produce_milk`, `chicken/chick → produce_egg`, `duck/duckling → produce_duck_egg`, `pig/piglet → produce_truffle`, `dog → produce_bone`).
   - Nông sản lưu trong `produceBag: Record<string, number>`, hiển thị ở tab **Túi Đồ**, có thể **Bán lấy Xu** tại Tiệm Tạp Hóa hoặc **Đổi gói 3 nông sản lấy 1 Bùa**.

## Numbers

### A. Bảng phần thưởng (Reward Matrix)

| Nguồn thưởng | Base XP | Base Xu | Thưởng thêm | Ghi chú |
|---|---:|---:|---|---|
| Xây đoạn cầu (Cửu chương ×1–×10) | +15 | +8 | +5 XP nếu đúng lần đầu | Tổng 6 đoạn = 90 XP + 48 xu |
| Qua cầu lần đầu (Hoàn thành Q1) | +50 | +20 | — | Kích hoạt 1 lần duy nhất |
| Luyện Cửu Chương cùng Milo (5 câu/lượt) | +10 / câu | +5 / câu | +25 XP, +15 xu khi xong 5 câu | Ưu tiên 70% câu từ `review` |
| Bước trung gian (Multi-step) | +10 | +0 | — | Chỉ thưởng lần đầu mở bước |
| Hoa Tri Thức (Hoàn thành) | +20 | +8 | +100 XP, +40 xu khi đủ 10/10 | Mở cổng Đền Archimedes |
| Cây Tri Thức (Công Viên) | +25 | +10 | +150 XP, +60 xu khi đủ vùng | — |
| Thú Cưng Nông Trại (Giải cứu) | +25 | +10 | +1 Nông sản theo loài; +120 XP, +50 xu khi đủ vùng | Không gọi trùng `recordQuizResult` |
| Bia Đá / Tinh Thể QHMJ | +25 | +12 | +100 XP, +50 xu khi đủ vùng + 1 Huy Chương | — |
| Combo Streak (`attempts === 1` liên tiếp) | +2 × min(combo, 5) | +1 khi combo ≥ 3 | Hiển thị huy hiệu `Combo ×N` | Sai 1 lần reset combo về 0 |
| Ôn lại thực thể đã giải | +5 | +1 | Không tính Combo | Tránh farm vô hạn |

### B. Đường cong 20 Cấp Độ (Level 1 → Level 20)

Công thức tổng XP cần để đạt cấp $L$ ($L \ge 1$):
`XP(L) = 25 * L * (L + 1) - 50` (giữ nguyên mốc Lv1–5 cũ: Lv1 = 0, Lv2 = 100, Lv3 = 250, Lv4 = 450, Lv5 = 700, mở rộng mượt tới Lv10 = 2.700, Lv20 = 10.450).

| Cấp | Tổng XP yêu cầu | Danh hiệu Dũng Sĩ | Mở khóa mốc cấp |
|---:|---:|---|---|
| 1 | 0 | Tập Sự Làng Cỏ | Mặc định |
| 2 | 100 | Người Xây Cầu | Mở khóa ô trang trí Làng #1 |
| 3 | 250 | Bạn Của Hoa | +15 xu thưởng lên cấp |
| 4 | 450 | Người Gác Vườn | +20 xu thưởng lên cấp |
| 5 | 700 | Hiệp Sĩ Cửu Chương | Mở khóa phụ kiện Mũ Hiệp Sĩ |
| 6–10 | 1.000 – 2.700 | Nhà Thám Hiểm Sao | +25..45 xu mỗi cấp; Lv10 nhận Trail đặc biệt `[ASSUMPTION]` |
| 11–15 | 3.250 – 5.950 | Học Giả Archimedes | +50..70 xu mỗi cấp |
| 16–20 | 6.750 – 10.450 | Đại Kiến Trúc Sư Vương Quốc | +80..100 xu mỗi cấp |

### C. Danh mục Vật Phẩm & Cửa Hàng (`SHOP_CATALOG`)

#### 1. Hiệu Ứng Bước Chân (Trails — Mua 1 lần, trang bị vĩnh viễn)

| ID | Tên | Giá | Độ hiếm | Mô tả hiệu ứng |
|---|---|---:|---|---|
| `trail_flower` | Bước Chân Nở Hoa | 80 xu | Common | Cánh hoa & mầm xanh nở dọc đường chạy |
| `trail_stardust` | Bụi Sao Lấp Lánh | 150 xu | Rare | Bụi sao vàng kim rơi lấp lánh |
| `trail_frost` | Băng Tuyết Pha Lê | 250 xu | Legendary | Tinh thể băng lam và bông tuyết |
| `trail_rainbow` | Dải Cầu Vồng `[ASSUMPTION]` | 350 xu | Legendary | Hạt sáng 7 sắc cầu vồng |

#### 2. Bùa Trợ Thủ (Charms — Tiêu hao, tối đa 99 cái/loại)

| ID | Tên | Giá | Cách dùng | Tác dụng |
|---|---|---:|---|---|
| `charm_double_xp` | Bùa Sao Băng (x2 XP) | 50 xu | Thụ động | Nhân đôi XP thưởng ở thử thách hoàn thành kế tiếp |
| `charm_hint_scroll` | Cuộn Giấy Thông Thái | 35 xu | Chủ động (trong modal) | Mở ngay 1 tầng gợi ý mà vẫn giữ nguyên First-Try Bonus |
| `charm_eliminate` | Kính Lúp Soi Sáng | 45 xu | Chủ động (trắc nghiệm) | Gạch bỏ 1 phương án sai (chỉ dùng khi còn ≥ 3 phương án chưa chọn) |

#### 3. Nông Sản Thu Hoạch (Produce — Chỉ nhận từ Nông Trại, bán/đổi tại Tiệm)

| ID | Tên | Nguồn rơi | Giá bán lại | Quy đổi Bùa |
|---|---|---|---:|---|
| `produce_milk` | Bình Sữa Tươi | Bò / Bê (`cow`, `calf`) | 20 xu | 3 nông sản bất kỳ = 1 `charm_hint_scroll` |
| `produce_egg` | Trứng Gà Vàng | Gà / Gà con (`chicken`, `chick`) | 20 xu | nt |
| `produce_duck_egg` | Trứng Vịt Xanh | Vịt / Vịt con (`duck`, `duckling`) | 25 xu | nt |
| `produce_bone` | Xương May Mắn | Cún (`dog`) | 30 xu | nt |
| `produce_truffle` | Nấm Quý Truffle | Heo / Heo con (`pig`, `piglet`) | 45 xu | 2 Nấm Truffle = 1 `charm_double_xp` |

#### 4. Trang Trí Làng & Phụ Kiện (`later` — Scope mở rộng)

| ID | Tên | Loại | Giá | Vị trí |
|---|---|---|---:|---|
| `decor_lantern_row` | Hàng Đèn Lồng Bờ Sông | `decor` | 120 xu | Làng Khởi Đầu |
| `decor_flower_arch` | Cổng Hoa Chào Mừng | `decor` | 200 xu | Làng Khởi Đầu |
| `acc_explorer_hat` | Mũ Phép Thuật Nhí | `accessory` | 180 xu | Đầu nhân vật |

## Edge cases

- **Tiêu thụ `charm_double_xp`:** Chỉ trừ 1 bùa khi thử thách thật sự trả thưởng (`!alreadySolved` và là bước cuối hoặc câu cửu chương). Không trừ khi giải lại câu đã xong hoặc trả lời sai.
- **Số lượng nông sản trùng lặp:** Lưu bằng `Record<string, number>` thay vì push lặp chuỗi vào `inventory: string[]` để tránh phình `SaveDataJson` trên Google Sheets.
- **Hết câu hỏi `charm_eliminate`:** Nút Kính Lúp tự vô hiệu hóa (`disabled`) khi câu hỏi là dạng nhập số (`numeric` / `multi`), so sánh (`comparison`), hoặc chỉ còn ≤ 2 phương án khả dụng.

## Open questions

- `[ASSUMPTION]` Giá bán nông sản 20–45 xu được cân để 1 lượt cứu 10 thú nông trại (~260 xu bán nông sản + 100 xu thưởng = ~360 xu) đủ mua 1 Trail hiếm + vài Bùa. Sẽ tinh chỉnh sau playtest.

## History

- 2026-11-24: designed (GDD Remake v2.0).
