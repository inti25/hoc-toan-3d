# World Style, Lighting, Unified Camera & Region Plugins

**Status:** designed · **Updated:** 2026-11-24 · [GDD](../../GDD.md)

Thống nhất ngôn ngữ hình ảnh *Cozy Storybook Diorama*, thay thế hai chế độ camera xung đột (Isometric xa / FPS cận cảnh) bằng một hệ **Third-Person Adventure Camera** mượt mà, đồng bộ raycast 3D trên mọi địa hình và tách `World.ts` thành các `WorldRegionPlugin` độc lập.

## Rules

1. **Unified Third-Person Adventure Camera:**
   - Sử dụng chung 1 bộ thông số camera mặc định cho mọi vùng đất: `fov = 48`, `pitch = 0.42` rad (~24°, giới hạn `0.12 .. 1.05`), `distance = 13.5` (zoom `4.0 .. 28.0`), điểm nhìn hướng vào thân nhân vật (`targetY = player.y + 1.35`).
   - Khi thu zoom sát (`distance < 2.2`), tự động ẩn mesh nhân vật mượt mà; khi đổi vùng đất, giữ nguyên triết lý điều khiển xoay/zoom thay vì nhảy đột ngột sang góc nhìn đỉnh đầu (`distance: 48, pitch: 0.8`).
2. **Cozy Storybook Lighting & Palette:**
   - Bật `ACESFilmicToneMapping` với `toneMappingExposure = 1.08` và `SRGBColorSpace`.
   - Ánh sáng chuẩn hóa theo vùng: `HemisphereLight(sky, ground, 1.35)` + `DirectionalLight(0xfff1d0, 2.1)` đổ bóng mềm `PCFSoftShadowMap` bám theo vùng đang hoạt động, thay thế mức cường độ `2.4 + 3.2` quá chói hiện tại.
   - Bảng màu vật liệu Làng Khởi Đầu giữ nét ấm thủ công: cỏ `#7ec468`, đất `#c79f6e`, đá lát kem `#efe0b9`, nước `#49b7cf`, mái ngói ấm `#df7a5e` / `#eab354`.
3. **Chuẩn hóa thực thể tương tác (`WorldInteractable`) & Raycast 3D:**
   - Mọi đối tượng tương tác (Milo, Tiệm Tạp Hóa, Hoa, Cây, Bia đá, Thú nông trại, Tinh thể QHMJ, Cổng dịch chuyển) đăng ký 1 `WorldInteractable` gồm `{ id, kind, object3D, worldPos, triggerRadius, label }`.
   - `World` chỉ chạy 1 hệ raycast 3D trực tiếp lên `interactable.object3D` kết hợp kiểm tra khoảng cách 3D (`Math.hypot(dx, dy, dz)`), xóa bỏ raycast mặt phẳng `y = 0` và loại bỏ việc viết lại logic click riêng cho từng map.
4. **Tách `World.ts` theo `WorldRegionPlugin`:**
   - Mỗi bản mẫu vùng đất (`core_village`, `lake_archimedes`, `park`, `farm`, `qhmj`, `procedural`) cài đặt interface thống nhất `mount(ctx)`, `unmount()`, `update(dt, time)`, `getInteractables()`, `syncProgress(solvedLookup)`.

## Numbers

| Thông số 3D / Camera | Giá trị | Đơn vị | Ghi chú |
|---|---:|---|---|
| Camera FOV mặc định | `48` | độ | Cân bằng giữa tầm nhìn rộng & cảm giác gần gũi |
| Camera Distance mặc định / Min / Max | `13.5` / `4.0` / `28.0` | m | Thống nhất giữa Làng, Đảo, Công Viên, Nông Trại |
| Camera Pitch mặc định / Min / Max | `0.42` / `0.12` / `1.05` | rad | Không bị chúi xuống đất hay ngửa quá |
| Chiều cao chuẩn Avatar | `1.80` | m | Chuẩn hóa bounding height khi nạp GLTF/procedural |
| Tốc độ di chuyển cơ sở | `6.0` | m/s | Mượt trên Làng, Đảo và đường rộng |
| Bán kính kích hoạt tương tác mặc định | `3.2` | m | Đồng nhất cho mọi thực thể 3D |

## Edge cases

- **Avatar kích thước khác nhau (ví dụ Elsa vs Bảo Châu):** Chuẩn hóa chiều cao khi nạp trong `AssetRepository` về `1.80m` (chân chạm `y = 0`), bỏ toàn bộ nhánh `if (avatar === 'elsa') wantedY = 2.65` rải rác ở `World.ts`.
- **Chuyển cảnh giữa các vùng:** Khi bước qua cổng dịch chuyển, dùng `fade/iris` nhẹ hoặc lớp loading đồng bộ `WorldRegionPlugin`, giữ nguyên `camera.fov` và chỉ xoay `yaw` hướng về phía trước điểm đáp mới.

## History

- 2026-11-24: designed (GDD Remake v2.0).
