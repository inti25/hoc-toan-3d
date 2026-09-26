# Kiểm thử MVP

## Đã kiểm tra tự động

- TypeScript strict: build thành công.
- 8 bài kiểm thử logic qua Node test runner, tất cả đạt.
- 30 phép nhân trong mỗi chế độ: luôn 3 lựa chọn riêng biệt, một đáp án đúng, kết quả trong 1–100.
- Nhãn phép nhân của lựa chọn khớp giá trị; vị trí đáp án được đảo.
- Ghi nhận đúng/sai, XP và xu không bị trừ khi sai, câu sai được lưu để ôn lại.
- Bộ lọc bảng ×2/×5/×10 và các cấp gợi ý.
- Save/load roundtrip và xử lý dữ liệu lưu hỏng.
- Các ngưỡng level theo tài liệu.

## Chưa xác minh bằng trình duyệt

Trình duyệt kiểm thử bị chính sách truy cập chặn khi mở preview nội bộ. Vì vậy chưa xác minh hình ảnh, hành vi điều khiển trực tiếp, kích thước responsive, WebMCP và FPS. Các phần này được triển khai trong source nhưng không được ghi nhận là đã vượt qua kiểm thử giao diện.

## Checklist chơi thử thủ công

1. Chrome / Edge: mở menu, chọn nhân vật, bắt đầu chơi.
2. WASD, mũi tên, kéo camera, zoom, nhảy; va chạm nhà/cây/bờ sông.
3. Đi gần Milo, E hoặc nhấn Nói chuyện, nhận nhiệm vụ.
4. Chọn đáp án sai: không mất XP/xu, có lời khuyến khích và nhóm đá gợi ý.
5. Chọn đáp án đúng: +10 XP, +5 xu, xây một đoạn cầu; không cộng thưởng hai lần cho cùng lượt trả lời.
6. Xây 6 đoạn, tự đi qua cầu: nhận thưởng hoàn thành một lần.
7. Refresh: XP, xu, đoạn cầu, lịch sử, lựa chọn nhân vật vẫn được giữ.
8. Sổ cửu chương: xem 3 bảng, luyện riêng từng bảng và luyện trộn.
9. Cài đặt: tắt âm thanh, bật nhạc, lưu thủ công; xác nhận reset (chỉ với save thử nghiệm).
10. Tablet/mobile: joystick, nút nhảy, tương tác, hộp câu hỏi không tràn màn hình.
11. Đo FPS và thời gian tải trên thiết bị mục tiêu trước phát hành rộng rãi.

Bản chơi thử độc lập; không bao gồm Phase 2 hoặc Phase 3.
