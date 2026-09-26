# Vương Quốc Cửu Chương 3D

MVP theo mục 38 của kịch bản: một ngôi làng 3D, NPC Milo, bảng ×2/×5/×10 và mini-game xây cầu. Three.js + TypeScript + Vite, không backend, không asset trả phí.

## Chạy và build

```sh
npm ci
npm run dev
npm test
npm run build
```

Đưa nội dung `dist/` lên web server tĩnh. Với đường dẫn `/games/multiplication-3d/`, chạy `npx tsc --noEmit` rồi `npx vite build --base=/games/multiplication-3d/` (hoặc đặt `base` trong Vite config) và phục vụ `index.html` ở đường dẫn đó. Tất cả mô hình được dựng từ primitive 3D; âm thanh được tổng hợp bằng Web Audio.

## Điều khiển

- WASD / mũi tên hoặc chạm xuống đất: di chuyển.
- Kéo trên cảnh: xoay camera. Cuộn chuột: zoom.
- Space: nhảy. E: nói chuyện với Milo khi đứng gần.
- Phím 1 / 2 / 3: chọn đáp án. Esc: đóng hộp thoại / tạm dừng.
- Màn hình cảm ứng: cần điều khiển, nút nhảy và nút tương tác.

## Vòng chơi

Chọn nhân vật → đến gần Milo → nhận nhiệm vụ → 6 câu đúng xây 6 đoạn cầu → tự đi qua cầu sang vườn → hoàn thành nhiệm vụ. Mỗi câu đúng +10 XP, +5 xu; hoàn thành cầu và đi sang bờ bên kia +50 XP, +10 xu (một lần). Sai không mất điểm; gợi ý tăng dần; câu sai được đưa vào ôn lại. Sổ cửu chương hỗ trợ xem và luyện riêng từng bảng hoặc trộn cả ba.

## Kiến trúc

- `src/world/World.ts`: cảnh 3D, va chạm, di chuyển, camera, cây cầu, hạt hiệu ứng.
- `src/quiz/engine.ts`: sinh câu hỏi, đảo đáp án, đánh giá, gợi ý, hàng đợi ôn tập.
- `src/core/state.ts`: state có version, xác thực save và LocalStorage an toàn.
- `src/data/config.ts`: dữ liệu bảng, mốc XP, cấu hình cầu.
- `src/audio/audio.ts`: âm báo và nhạc nền tùy chọn.
- `src/main.ts`: UI, kết nối các hệ thống và nhiệm vụ.

Save dùng key `aigame3d_multiplication_save`. Lưu tiến trình, không lưu vị trí nhân vật. Không gửi dữ liệu trẻ em lên server. Reset có bước xác nhận. Nếu lưu bị chặn, UI thông báo và vẫn chơi trong phiên hiện tại.

## Giới hạn MVP

Chưa triển khai các giai đoạn 2–3: thế giới khác, đua xe, chiến đấu tinh thể, thú cưng, kho đồ, tài khoản, cloud save, phụ huynh, multiplayer. Chưa benchmark trên thiết bị phổ thông / tablet thực. Hiệu năng tùy GPU và độ phân giải. Chưa có gamepad, vật lý động hay tìm đường tự động: nếu chạm đích sau vật cản, hãy đi vòng bằng các điểm gần hơn.

## Tích hợp aigame3d.com

Bản Sites là bản chơi thử độc lập, chưa sửa hoặc triển khai lên aigame3d.com. Có thể tích hợp bản build tĩnh vào website hiện tại. Để giữ tiến trình khi chuyển tên miền, cần bổ sung luồng xuất/nhập save hoặc đồng bộ tài khoản ở giai đoạn sau.
