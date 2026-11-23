# Google Sheets v2 & SaveState v2 Specification

**Status:** designed · **Updated:** 2026-11-24 · [GDD](../../GDD.md)

Chuẩn hóa dữ liệu đám mây trên Google Sheets và cấu trúc `SaveState v2` trên client nhằm triệt tiêu lỗi đè tiến độ giữa các vùng cùng template, hỗ trợ bảng cửu chương mở rộng, bùa chủ động, nông sản và giữ tương thích ngược hoàn toàn với dữ liệu v1 đã lưu của học sinh và giáo viên.

## Rules

1. **Khóa tiến trình duy nhất (`solvedEntities`):**
   - Mọi thực thể học tập trong mọi vùng đều định danh bằng chuỗi khóa `${zoneId}:${problemId}` (với Vườn Hoa mặc định `zoneId = 6`, Công Viên = `zoneId` thực tế từ `CONFIG`, Nông Trại = `zoneId` thực tế từ `CONFIG`).
   - Không dùng mảng cố định theo index (`flowers[10]`, `parkTrees[20]`, `monoliths[40]`) làm nguồn sự thật chính; các mảng cũ chỉ sinh ra ở lớp adapter khi cần tương thích UI/API cũ.
2. **Tự động nâng cấp dữ liệu (`SaveState v1 → v2`):**
   - `parseSave` nhận cả `version: 1` và `version: 2`. Khi gặp `version: 1`, tự động chuyển:
     - `flowers[i] === true` → `solvedEntities['6:' + (i + 1)]`
     - `monoliths[i] === true` → `solvedEntities['<archZone>:' + (306 + i)]` (map theo danh sách zone Archimedes)
     - `parkTrees[i] === true` → `solvedEntities['7:' + (i + 1)]`
     - `farmRescued[animalId] === true` → `solvedEntities['<farmZone>:' + animalId]`
     - `inventory` chứa `produce_*` → gom số lượng sang `produceBag[produceId]` và giữ `inventory` chỉ cho vật phẩm vĩnh viễn (`trail_*`, `decor_*`, `acc_*`).
3. **Union-Max Sync v2:**
   - `mergeStates(local, remote)` hợp nhất `solvedEntities` bằng phép hợp khóa (giữ `attempts` nhỏ nhất nếu cùng giải, `solvedAt` sớm nhất), `produceBag` lấy `Math.max` theo từng loại, `charms` lấy `Math.max`, `xp`/`coins` lấy `Math.max`.
4. **Dữ liệu dự phòng khởi đầu (Starter Offline Pack):**
   - Khi chưa từng có cache từ Apps Script (chơi offline lần đầu), `getBundledFallbackData()` cung cấp gói khởi đầu gọn gồm Vườn Hoa (6–10 câu mẫu) + 1 vùng luyện Cửu Chương mẫu thay vì trả về rỗng hoàn toàn, và tự động thay thế khi Apps Script đồng bộ thành công.

## Numbers & Schema

### A. Sheet `CONFIG` (Sổ Đăng Ký Vùng Đất — 18 cột)

| Cột | Bắt buộc | Kiểu / Giá trị hợp lệ | Thay đổi so với v1 |
|---|---|---|---|
| `ZoneId` | Có | Số nguyên dương duy nhất (`1, 2, ...`) | Giữ nguyên |
| `Name` | Có | Tên hiển thị ngắn trên HUD/Portal | Giữ nguyên |
| `Title` | Không | Tiêu đề phụ trong Bản Đồ | Giữ nguyên |
| `Description` | Không | Mô tả ngắn vùng đất | Giữ nguyên |
| `Template` | Có | `FLOWER_BEDS`, `GRID_SANCTUARY`, `CIRCLE_SANCTUARY`, `PARK_SANCTUARY`, `PROCEDURAL_SANCTUARY`, `FARM_SANCTUARY`, `QHMJ_SANCTUARY` | Giữ nguyên |
| `Theme` | Không | `GARDEN`, `RUINS`, `FOREST`, `CRYSTAL`, `VILLAGE` | Giữ nguyên |
| `DecorDensity` | Không | `LOW`, `MEDIUM`, `HIGH` | Giữ nguyên |
| `SheetName` | Có | Tên tab câu hỏi tương ứng | Giữ nguyên |
| `CenterX`, `CenterZ` | Không | Tọa độ tâm đảo (`0,0` = tự xếp vòng cung) | Giữ nguyên |
| `Width`, `Depth` | Không | Kích thước vùng (mét) | Giữ nguyên |
| `ColorHex` | Không | Mã màu nhận diện (`#10b981`) | Giữ nguyên |
| `Badge` | Không | Tên huy chương khi hoàn thành 100% vùng | Giữ nguyên |
| `Active` | Không | `TRUE` (mặc định) / `FALSE` | Giữ nguyên |
| `StartAt` | Không | `yyyy-MM-dd HH:mm` (giờ VN UTC+7) | Giữ nguyên |
| `QuestionCount` | Không | Số câu tự sinh khi tạo vùng | Giữ nguyên |
| `UnlockRule` *(mới v2)* | Không | Trống = mở ngay; `BRIDGE_DONE` / `LEVEL:3` / `ZONE:6` | **Mới**: khóa điều kiện mở cổng |
| `RewardXP`, `RewardCoins` *(mới v2)* | Không | Thưởng hoàn thành vùng (mặc định `100` XP, `50` xu) | **Mới**: giáo viên tùy chỉnh thưởng |

### B. Sheet Câu Hỏi (`Zone Quest Sheets` — 18 cột)

| Cột | Kiểu / Quy ước | Thay đổi so với v1 |
|---|---|---|
| `ProblemId`, `StepId` | Định danh bài toán & từng bước (để trống `ProblemId` tự kế thừa dòng trên) | Giữ nguyên |
| `Title`, `Subtitle`, `Prompt` | Tiêu đề, phụ đề và nội dung câu hỏi | Giữ nguyên |
| `ImageUrl`, `ExplanationImageUrl` | Link ảnh Google Drive/HTTPS hoặc Markdown | Giữ nguyên |
| `OptionA..OptionD` | Các phương án trắc nghiệm (để trống nếu là dạng nhập số / điền nhiều ô) | Giữ nguyên |
| `Answer` | Đáp án chuẩn; hỗ trợ số + đơn vị, `< = >`, và nhiều ô tách bằng `\|` | Giữ nguyên |
| `Hints`, `Explanation` | Gợi ý phân tách bởi `\|` hoặc `;`, và lời giải chi tiết | Giữ nguyên |
| `PosX`, `PosY`, `PosZ` | Tọa độ đặt thực thể (tùy chọn) | Giữ `PosX/PosZ`, chính thức hóa `PosY` |
| `EntityKind` *(mới v2)* | `cow`, `pig`, `chicken`, `duck`, `dog`, `monolith`, `flower`, `tree`, `crystal` | **Mới**: chỉ định rõ loại thú/thực thể |
| `Difficulty` *(mới v2)* | `1` (Cơ bản), `2` (Vận dụng), `3` (Sao `*`) | **Mới**: hiển thị sao độ khó & XP |

### C. Sheet `PLAYERS` (15 cột — Tương thích ngược 14 cột v1)

| Cột | Nội dung | Thay đổi so với v1 |
|---|---|---|
| 1–12 (`ExplorerId` .. `TreesAwakened`) | Giữ nguyên tên và vị trí cột để bảng của giáo viên không bị vỡ | Giữ nguyên |
| 13 (`LastActiveAt`) | Thời điểm hoạt động gần nhất (giờ VN) | Giữ nguyên |
| 14 (`SaveDataJson`) | Lưu JSON `SaveState v2` (prefix `'` chống Sheets format) | Chứa schema v2 |
| 15 (`SolvedCount` *(mới v2)*) | Tổng số thực thể đã giải trên toàn vương quốc | **Mới**: đọc nhanh cho giáo viên |

### D. Sheet `LOGS` (10 cột — Tương thích ngược 9 cột v1)

Giữ nguyên 9 cột đầu (`Timestamp`, `ExplorerName`, `ClassName`, `ZoneId`, `ProblemId`, `StepId`, `IsCorrect`, `Score`, `Details`) và bổ sung cột 10 `DurationMs` (thời gian suy nghĩ tính bằng ms, lấy từ `ChallengeSession.getDurationMs()`).

### E. Cấu trúc `SaveState v2` (Client)

```ts
export interface SaveStateV2 {
  version: 2;
  xp: number;
  coins: number;
  level: number;
  bridge: number;
  questAccepted: boolean;
  questComplete: boolean;
  avatar: AvatarId;
  table: Table | 0;
  sound: boolean;
  music: boolean;
  combo: number;
  started: boolean;
  solvedEntities: Record<string, { solvedAt: string; attempts: number }>;
  solvedSteps: Record<string, boolean>; // key: `${zoneId}:${problemId}:${stepId}`
  zoneBadges: Record<string, boolean>; // key: String(zoneId)
  questionStats: Record<string, QuestionStat>;
  review: string[];
  dailyDrill: { date: string; completedCount: number; rewardClaimed: boolean };
  inventory: string[];        // chỉ vật phẩm vĩnh viễn: trail_*, decor_*, acc_*
  equippedTrail: string;
  equippedAccessories: string[];
  charms: Record<string, number>;
  produceBag: Record<string, number>;
  position?: { x: number; y?: number; z: number; regionId?: string };
}
```

## Edge cases

- **Tab `CONFIG` cũ thiếu cột v2:** `fetchZonesFromSheet` và `sanitizeRemoteZones` coi cột v2 là tùy chọn (`UnlockRule` trống = mở ngay, `RewardXP/Coins` trống = dùng hằng số mặc định).
- **Lỗi đồng bộ từ thiết bị cũ chạy code v1:** Khi `handleSavePlayerProgress` nhận payload từ client cũ (`version: 1`), Apps Script vẫn ghi vào đúng 14 cột đầu mà không làm hỏng dòng của học sinh đang chạy v2.

## History

- 2026-11-24: designed (GDD Remake v2.0).
