# Vương Quốc Học Toán 3D

Thế giới 3D học toán tương tác cho học sinh tiểu học, kết hợp khám phá không gian và rèn luyện bảng cửu chương cùng NPC Milo qua nhiệm vụ xây cầu và đánh thức Vườn Hoa Tri Thức.

## Language

**Làng Khởi Đầu (Starter Village)**:
Khu vực xuất phát gồm nhà cửa, cối xay gió và bờ sông nơi NPC Milo đứng đón người chơi.
_Avoid_: Map 1, Sảnh chờ, Khu vực tân thủ

**Vườn Hoa Tri Thức (Knowledge Flower Garden)**:
Vùng đất bên kia bờ sông chứa 10 cây hoa thử thách, đài phun nước tri thức và các cột đèn trang trí.
_Avoid_: Map 2, Vườn bí mật, Khu giải đố

**Milo**:
Nhân vật hướng dẫn đội mũ xanh bên bờ sông, giao nhiệm vụ xây cầu và đồng hành luyện tập cửu chương.
_Avoid_: NPC nhiệm vụ, Bot hỗ trợ

**Đoạn Cầu (Bridge Segment)**:
Một trong 6 phần của cây cầu tình bạn bắc qua sông, mỗi đoạn được xây dựng khi trả lời đúng một câu hỏi toán.
_Avoid_: Nấc thang, Khối đá cầu

**Cây Hoa Thử Thách (Challenge Flower)**:
Một trong 10 thực thể hoa trong Vườn Hoa Tri Thức, chuyển từ trạng thái ấp nụ sang nở rộ khi giải đúng bài toán tương ứng.
_Avoid_: Trạm câu hỏi, Điểm tương tác hoa

**Bảng Cửu Chương (Multiplication Table)**:
Tập hợp các phép nhân số học cần rèn luyện (đầy đủ 10 bảng nhân từ bảng ×1 đến bảng ×10 và chế độ trộn tất cả các bảng).
_Avoid_: Đề thi, Danh sách câu hỏi

**Hàng Đợi Ôn Tập (Review Queue)**:
Danh sách các phép nhân người chơi từng trả lời sai, được ưu tiên đưa lại vào các lượt thử tiếp theo để củng cố ghi nhớ.
_Avoid_: Danh sách phạt, Câu hỏi lưu tạm

**Tiến Trình Thám Hiểm (Adventure Progress)**:
Dữ liệu lưu trữ trạng thái người chơi gồm XP, xu, cấp độ, số đoạn cầu đã xây, danh sách hoa đã nở và lịch sử luyện tập.
_Avoid_: Game save, Dữ liệu người dùng, Profile

**Thử Thách (Challenge Session)**:
Một phiên giải quyết bài toán tương tác (cửu chương hoặc đố hoa) tự quản lý số lần thử, các cấp độ gợi ý tiến triển và xác thực kết quả.
_Avoid_: Đề bài, Vòng lặp quiz

**Vùng Đất Luyện Tập Archimedes (Archimedes Trial Grounds)**:
Phân khu 5 cụm chuyên đề toán tiểu học nâng cao gồm 40 bài tập ôn tập chung (Toán 2 - Archimedes School), mở rộng từ Vườn Hoa Tri Thức.
_Avoid_: Map 3, Zone Archimedes, Khu bài tập

**Bia Đá Tri Thức (Knowledge Monolith)**:
Một trong các thực thể kiến trúc đá cổ đại phân bố theo 5 khu vực tại Vùng Đất Luyện Tập, kích hoạt thử thách toán học và phát sáng hào quang khi giải đúng.
_Avoid_: Cột mốc câu hỏi, Trạm đề bài, Điểm check-in

**Bản Đồ Thử Thách (Trial Map)**:
Hệ thống cấu trúc dữ liệu ánh xạ toàn bộ bài toán, thông số không gian 3D và tiến trình mở khóa theo từng phân khu chuyên đề.
_Avoid_: Bảng câu hỏi, Danh sách bài tập

**Ốc Đảo Chuyên Đề (Thematic Zone Sanctuary)**:
Một trong 5 hòn đảo luyện tập compact biệt lập (diện tích tương đương Vườn Hoa Tri Thức), bao bọc cụm Bia Đá Tri Thức cùng chủ đề quanh một đài biểu tượng và nối với nhau qua Cổng Dịch Chuyển.
_Avoid_: Phân vùng, Cụm level, Bãi quái

**Đền Cổng Archimedes (Archimedes Gatehouse)**:
Quảng trường trung chuyển kiến trúc đá cổ kính chứa các Cổng Dịch Chuyển ánh sáng nối trực tiếp tới 5 Ốc Đảo Chuyên Đề và Vườn Hoa Tri Thức.
_Avoid_: Sảnh chờ, Điểm dịch chuyển chung

**Bản Mẫu Vùng Đất (Zone Template)**:
Khuôn mẫu định nghĩa hình thái không gian 3D (loại địa hình, kích thước đảo, bố cục thực thể tương tác) và chuẩn dữ liệu câu hỏi đi kèm.
_Avoid_: Scene preset, Layout mẫu, Map template

**Sổ Đăng Ký Vùng Đất (Zone Registry)**:
Bảng tính trung tâm lưu trữ danh mục và thuộc tính của tất cả các vùng đất (mã vùng, tên hiển thị, template sử dụng, liên kết sheet câu hỏi, màu sắc hào quang).
_Avoid_: Bảng cài đặt, Config sheet, Danh mục đảo

**Bảng Thử Thách Vùng Đất (Zone Quest Sheet)**:
Trang tính chứa ngân hàng câu hỏi, các bước giải, gợi ý và đáp án cho một vùng đất cụ thể.
_Avoid_: Sheet câu hỏi, Tab bài tập

**Nhật Ký Thám Hiểm Trực Tuyến (Remote Adventure Log)**:
Bảng ghi nhận tiến trình, mốc hoàn thành và kết quả thử thách của người chơi được đồng bộ lên Google Sheets qua Apps Script.
_Avoid_: Bảng điểm, Save log, Lịch sử làm bài

**Bản Mẫu Bố Cục Thử Thách (Procedural Layout Template)**:
Quy tắc hình học tự động sắp xếp các thực thể học tập (Bia đá, Cây hoa) trên bề mặt đảo 3D theo dạng luống hoa, vòng tròn đá hoặc lưới tọa độ đều đặn.
_Avoid_: Thuật toán xếp map, Auto layout

**Hồ Sơ Dũng Sĩ (Explorer Profile)**:
Thông tin định danh nhẹ của học sinh gồm biệt danh (Tên dũng sĩ) và lớp học, được thiết lập ngay tại Màn Hình Chào Mừng lần đầu vào game (hoặc tinh chỉnh trong Cài Đặt), lưu cục bộ trên thiết bị và đính kèm vào Nhật Ký Thám Hiểm khi nộp bài.
_Avoid_: Tài khoản người dùng, User account, Form đăng ký

**Tên Dũng Sĩ (Explorer Nickname)**:
Tên hoặc biệt danh do học sinh tự điền trên Màn Hình Chào Mừng trước khi bắt đầu cuộc phiêu lưu, hiển thị trên Thẻ Người Chơi và trong lời chào của Milo. Nếu để trống, hệ thống tự động gán biệt danh ngẫu nhiên (Friendly Fallback).
_Avoid_: Tên đăng nhập, Username, Họ và tên đầy đủ

**Thẻ Người Chơi (Player Card)**:
Bảng thông tin nhỏ gọn ghim ở góc trên bên trái HUD khi vào game, hiển thị Avatar đồng hành, Tên dũng sĩ ở dòng trên nổi bật, Chức danh khám phá kèm Huy hiệu Cấp độ ở dòng dưới, và thanh tiến độ XP.
_Avoid_: Bảng thông tin user, Profile card

**Chức Danh Khám Phá (Explorer Title)**:
Danh hiệu đồng hành của người chơi gắn với nhân vật lựa chọn ("Nhà thám hiểm" cho bé trai 👦, "Nhà khám phá" cho bé gái 👧), hiển thị với kích thước chữ nhỏ gọn dưới Tên Dũng Sĩ.
_Avoid_: Rank người chơi, Chức vụ, Nghề nghiệp

**Kho Dự Phòng Cục Bộ (Bundled Fallback Cache)**:
Tập dữ liệu câu hỏi và bản đồ dựng sẵn trong mã nguồn client kết hợp bộ nhớ đệm trình duyệt, đảm bảo thế giới 3D luôn khởi động tức thì 60fps trước khi đồng bộ Apps Script.
_Avoid_: Mock data, Dữ liệu nháp

**Cổng Hào Quang Năng Động (Dynamic Portal Arch)**:
Cổng vòm dịch chuyển phát sáng được tự động bố trí vòng quanh Đền Cổng Archimedes tương ứng với từng vùng đất đăng ký mới trên Google Sheets.
_Avoid_: Cửa tele động, Cổng tự sinh

**Bộ Lọc Phục Hồi Dữ Liệu (Resilient Data Sanitizer)**:
Cơ chế tự động dọn dẹp khoảng trắng, bổ sung phương án khuyết và cô lập dòng lỗi từ Google Sheets để bảo toàn trải nghiệm 3D liên tục cho học sinh.
_Avoid_: Trình kiểm tra lỗi, Error checker

**Bản Khởi Tạo Toàn Diện (Full Kingdom Seed)**:
Gói dữ liệu gốc gồm 40 bài toán Archimedes (phân chia 5 ốc đảo chuyên đề), 10 bài toán Vườn Hoa và Sổ Đăng Ký CONFIG được nạp tự động lên Google Sheets.
_Avoid_: File import mẫu, Dữ liệu seed

**Cổng Khởi Tạo Trực Tiếp (One-Click Seed Port)**:
Cơ chế kích hoạt nạp toàn bộ kho câu hỏi gốc lên Google Sheets trực tiếp từ giao diện Cài Đặt của game, qua lệnh CLI hoặc hàm Apps Script.
_Avoid_: Nút import, Tool nạp data

**Kiến Trúc Tải Hợp Nhất (Unified Batch Ingestion)**:
Cơ chế máy chủ Google Apps Script nạp Sổ Đăng Ký Vùng Đất (`CONFIG`) trước, tự động duyệt và gộp toàn bộ câu hỏi từ các Bảng Thử Thách tương ứng (`sheetName`) để trả về client trong một payload duy nhất nhằm triệt tiêu độ trễ mạng.
_Avoid_: 2-step fetch, Tải từng phần, Multi-request

**Đồng Bộ Nóng Thủ Công (Manual Hot Sync)**:
Thao tác kích hoạt nạp tức thời dữ liệu mới nhất từ Google Sheets từ Bản Đồ Vương Quốc hoặc Cài Đặt, bỏ qua thời hạn đệm 30 phút để giáo viên kiểm tra ngay nội dung vừa soạn.
_Avoid_: F5 trình duyệt, Tải lại trang, Force reload

**Dung Lỗi Phân Khu (Graceful Zone Fallback)**:
Nguyên tắc xử lý an toàn khi một vùng đất được khai báo trong `CONFIG` nhưng tab câu hỏi chưa được tạo trên Google Sheets; thế giới 3D vẫn sinh đảo và cảnh quan bình thường mà không làm gián đoạn trò chơi.
_Avoid_: Báo lỗi crash, Chặn render, Block island

**Câu Hỏi Nhiều Ô Nhập (Multi-Slot Question)**:
Một thử thách toán học yêu cầu học sinh điền đồng thời nhiều giá trị trung gian hoặc kết quả (ví dụ: số điền vào các hình liên hoàn của sơ đồ chuỗi phép tính).
_Avoid_: Câu hỏi phức tạp, Form điền số, Multi-input quiz

**Ô Nhập Giá Trị (Input Slot)**:
Một ô hiển thị giá trị tương tác riêng biệt trên giao diện nhận số từ bàn phím Numpad ảo hoặc phím vật lý khi được chọn (Active Slot).
_Avoid_: Input box con, Textfield con, Ô gõ số

**Ký Tự Phân Tách Đáp Án (Answer Slot Delimiter)**:
Ký tự gạch đứng `|` dùng trong cột `Answer` trên Google Sheets để phân tách các giá trị cần điền theo thứ tự từ trái sang phải hoặc từ trên xuống dưới (ví dụ `88|100`).
_Avoid_: Dấu phẩy, Dấu gạch chéo, Dấu chấm phẩy


