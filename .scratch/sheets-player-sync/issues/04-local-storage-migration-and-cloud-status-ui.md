Title: Di chuyển Dữ liệu Cục bộ Hiện tại và Giao diện Chỉ báo Đám mây
Type: task
Status: claimed
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
