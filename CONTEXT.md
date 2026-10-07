# Vương Quốc Học Toán 3D

Thế giới 3D học toán tương tác cho học sinh tiểu học, kết hợp khám phá không gian và rèn luyện bảng cửu chương cùng NPC Milo qua nhiệm vụ xây cầu và đánh thức Vườn Hoa Tri Thức.

## Language

**Làng Khởi Đầu (Starter Village)**:
Khu vực xuất phát gồm nhà cửa, cối xay gió và bờ sông nơi NPC Milo đứng đón người chơi.
_Avoid_: Map 1, Sảnh chờ, Khu vực tân thủ

**Vườn Hoa Tri Thức (Knowledge Flower Garden)**:
Vùng đất bên kia bờ sông chứa 10 cây hoa thử thách, đài phun nước tri thức và các cột đèn trang trí.
_Avoid_: Map 2, Vườn bí mật, Khu giải đố

**Công Viên Xanh (Green Park Sanctuary)**:
Vùng đất công viên động được kết nối qua Cổng Dịch Chuyển từ bờ tây Làng Khởi Đầu khi được kích hoạt trên bảng tính Google Sheets, nổi bật với đài kỷ niệm trung tâm, các ghế đá thư giãn và cụm 20 Cây Tri Thức chuyển từ trạng thái ngủ say hóa xám sang hồi sinh xanh tươi khi giải đúng thử thách.
_Avoid_: Khu vui chơi, Vườn 2, Map công viên

**Bản Mẫu Công Viên (Park Sanctuary Template / PARK_SANCTUARY)**:
Bản Mẫu Vùng Đất chuyên biệt định hình cảnh quan công viên 3D nạp động theo danh mục cấu hình Google Sheets, kết nối hai chiều với bờ tây Làng Khởi Đầu, trong đó các vị trí câu hỏi toán học được gắn liền trực tiếp với các thực thể cây cối (Tree và Pine) thay vì cột bia đá hay luống hoa thông thường.
_Avoid_: Park template, Preset công viên

**Cổng Công Viên Làng Khởi Đầu (Starter Village Park Portal)**:
Cổng không gian đặt tại bờ tây Làng Khởi Đầu (X = -19.5, Z = 0) kết nối người chơi tới các vùng đất mang bản mẫu PARK_SANCTUARY. Khi có nhiều công viên được cấu hình, cổng mở bảng chọn công viên đích đến; khi ở trong công viên, cổng quay về sẽ đưa người chơi trở lại ngay trước cánh cổng này (X = -17.5, Z = 0).
_Avoid_: Cổng Archimedes, Cổng Đền, Cầu gỗ công viên

**Cây Tri Thức (Knowledge Tree)**:
Một trong 20 thực thể cây (Tree hoặc Pine) trong Công Viên Xanh mang một bài toán thử thách. Ở trạng thái ban đầu cây mang màu xám (Cây Ngủ Say), và sẽ thức tỉnh trở lại màu sắc tươi sáng tự nhiên khi học sinh giải đúng.
_Avoid_: Cây bài tập, Cây quiz, Điểm trả lời

**Thức Tỉnh Cây Xanh (Tree Awakening)**:
Hành động giải thành công thử thách toán học gắn với một Cây Tri Thức, kích hoạt hiệu ứng pháo hoa và phục hồi màu sắc nguyên bản đầy sức sống cho cây.
_Avoid_: Làm xanh cây, Nở cây, Clear bài

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
Một trong 5 hòn đảo luyện tập compact biệt lập (diện tích tương đương Vườn Hoa Tri Thức) mang Địa Hình Hồ Yên Bình, bao bọc cụm Bia Đá Tri Thức cùng chủ đề quanh một đài biểu tượng và nối với nhau qua Cổng Dịch Chuyển.
_Avoid_: Phân vùng, Cụm level, Bãi quái

**Địa Hình Hồ Yên Bình (Cozy Lake Terrain)**:
Cảnh quan đảo tròn có hồ nước, bờ cát, cây cối, đá và nấm, dùng chung cho mọi vùng đất mang Bản Mẫu GRID_SANCTUARY hoặc CIRCLE_SANCTUARY. Cổng Dịch Chuyển quay về được đặt trên bờ cát phía tây, mặt cổng úp trực diện vào lòng hồ nước và đài kỷ niệm trung tâm. Màu nhận diện của từng vùng thể hiện qua cổng, hào quang bia đá và đài biểu tượng, không nhuộm lên địa hình.
_Avoid_: Map hồ, Đảo hộp cũ, Nền cỏ

**Đền Cổng Archimedes (Archimedes Gatehouse)**:
Quảng trường trung chuyển kiến trúc đá cổ kính chứa các Cổng Dịch Chuyển ánh sáng nối trực tiếp tới 5 Ốc Đảo Chuyên Đề và Vườn Hoa Tri Thức.
_Avoid_: Sảnh chờ, Điểm dịch chuyển chung

**Bản Mẫu Vùng Đất (Zone Template)**:
Khuôn mẫu định nghĩa hình thái không gian 3D (loại địa hình, kích thước đảo, bố cục thực thể tương tác) và chuẩn dữ liệu câu hỏi đi kèm. GRID_SANCTUARY và CIRCLE_SANCTUARY cùng dùng Địa Hình Hồ Yên Bình và chỉ khác nhau ở bố cục bia đá (hai hàng so với vòng tròn).
_Avoid_: Scene preset, Layout mẫu, Map template

**Sổ Đăng Ký Vùng Đất (Zone Registry)**:
Bảng tính trung tâm lưu trữ danh mục và thuộc tính của tất cả các vùng đất (mã vùng, tên hiển thị, template sử dụng, liên kết sheet câu hỏi, màu sắc hào quang).
_Avoid_: Bảng cài đặt, Config sheet, Danh mục đảo

**Lịch Mở Vùng Đất (Zone Unlock Schedule)**:
Hai cột `Active` và `StartAt` trong Sổ Đăng Ký Vùng Đất. Vùng chỉ xuất hiện (sinh đảo, có Cổng Dịch Chuyển, có trong bản đồ) khi `Active` khác FALSE VÀ thời điểm hiện tại ≥ `StartAt`. Ô trống nghĩa là hiện ngay (`Active` trống = TRUE). `StartAt` không có múi giờ được hiểu theo giờ Việt Nam (UTC+7). Máy chủ luôn trả đủ dòng, client tự so giờ máy; vùng đang ẩn vẫn giữ nguyên tiến trình đã lưu, và người chơi có tọa độ lưu trong vùng bị ẩn sẽ ở lại Làng Khởi Đầu theo Khởi Tạo Vị Trí Trì Hoãn. Chỉ áp dụng cho các dòng trong `CONFIG`.
_Avoid_: Hẹn giờ, Feature flag, Ẩn/hiện vùng

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

**Nhân Vật Đồng Hành (Companion Avatar)**:
Thực thể đại diện trực quan cho người chơi trong thế giới 3D mang phong cách và danh hiệu riêng do học sinh tùy chọn (hiện gồm 7 nhân vật: Nhà thám hiểm, Nhà khám phá, Kuromi, Hello Kitty, My Melody, Cinnamoroll, Elsa - Nữ hoàng băng giá).
_Avoid_: Skin, Tướng, Nhân vật người chơi, Avatar 2D

**Chức Danh Khám Phá (Explorer Title)**:
Danh hiệu độc bản gắn với từng Nhân Vật Đồng Hành, hiển thị trang trọng dưới Tên Dũng Sĩ trên Thẻ Người Chơi (ví dụ: Dũng Sĩ Bóng Tối, Công Chúa Điều Tốt, Nàng Thơ Hoa Cỏ, Thám Tử Mây Bông, Nữ Hoàng Băng Tuyết).
_Avoid_: Rank người chơi, Cấp bậc, Chức vụ, Nghề nghiệp

**Mô Hình Đồng Hành 3D (3D Companion Model)**:
Hình tượng không gian ba chiều chi tiết của nhân vật đồng hành trong thế giới toán học, thể hiện diện mạo đặc trưng và nhịp nhún nhảy vui nhộn khi di chuyển.
_Avoid_: File 3D, Mesh nhân vật, Asset đồ họa

**Chuyển Động Xương Đồng Hành (Skeletal Companion Locomotion)**:
Cơ chế điều khiển động lực học hệ xương khớp (xương vai, cẳng tay, khuỷu tay) của mô hình 3D trong thời gian thực, đưa cánh tay từ tư thế A-pose nguyên bản về tư thế buông thả tự nhiên và tạo nhịp vung tay uyển chuyển nhịp nhàng đồng bộ với bước chạy.
_Avoid_: Rigging cứng, Hoạt ảnh tĩnh, Animation lặp cứng

**Hiển Thị Đồng Hành Đệm (Progressive Avatar Rendering)**:
Cơ chế hiển thị tức thì hình tượng nhân vật cơ bản ngay khi lựa chọn và tự động nâng cấp mượt mà sang Mô Hình Đồng Hành 3D chi tiết ngay khi hoàn tất nạp dữ liệu.
_Avoid_: Màn hình chờ tải, Loading bar, Chờ nạp mesh


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

**Biểu Tượng Vương Quốc (Kingdom Brand Mark)**:
Huy hiệu nhận diện thương hiệu chính thức của thế giới 3D, hiển thị trên thanh điều hướng đỉnh màn hình, màn hình mở cổng tải game và icon ứng dụng khi cài đặt PWA về thiết bị.
_Avoid_: Logo game, Icon web, Watermark

**Tọa Độ Thám Hiểm Lưu Lại (Saved Adventure Coordinates)**:
Cặp tọa độ không gian 3D (X, Z) của người chơi được tự động cập nhật vào Tiến Trình Thám Hiểm, cho phép học sinh xuất hiện ngay tại điểm dừng chân trước đó khi quay lại thế giới 3D.
_Avoid_: Vị trí spawn, Tọa độ save, Điểm hồi sinh, Last pos

**Khởi Tạo Vị Trí Trì Hoãn (Deferred Spawn)**:
Cơ chế an toàn tạm thời xuất hiện người chơi tại Làng Khởi Đầu nếu vị trí lưu thuộc về các Ốc Đảo Chuyên Đề chưa nạp xong dữ liệu qua mạng, và tự động dịch chuyển mượt mà về đúng Tọa Độ Thám Hiểm Lưu Lại ngay khi hòn đảo 3D dựng xong.
_Avoid_: Chờ load map, Fallback vị trí, Spawn trễ

**Bánh Xe Điều Khiển (Wheel Control)**:
Cụm điều hướng ảo hình tròn hiển thị trên màn hình với núm kéo đa hướng và 4 mũi tên chỉ hướng, cho phép người chơi điều khiển vận tốc và góc quay trực tiếp của nhân vật trên cả màn hình cảm ứng lẫn chuột máy tính.
_Avoid_: Phím ảo, Nút bấm di chuyển, D-pad

**Điều Khiển Trực Tiếp (Direct Locomotion)**:
Quy tắc điều hướng chuyển động bắt buộc thông qua Bánh Xe Điều Khiển hoặc cụm phím điều hướng (WASD/phím mũi tên), triệt tiêu hoàn toàn tính năng nhấp chuột/chạm đất tự động tìm đường (Point-and-Click Pathfinding) để tăng tính chủ động khám phá và tránh chạm nhầm khi xoay camera.
_Avoid_: Click to move, Tự tìm đường, Bấm màn hình đi

**Mã Thám Hiểm (Explorer Passcode)**:
Chuỗi mã 6 ký tự thân thiện dễ nhớ (ví dụ: `MTH-782`) cấp cho người chơi, dùng để định danh và khôi phục tiến trình khi đổi thiết bị mà không cần đăng nhập tài khoản Google.
_Avoid_: Password, Khóa bí mật, Token, Account ID

**Sổ Theo Dõi Người Chơi (Players Roster / Tab PLAYERS)**:
Trang tính chuyên biệt trên Google Sheets lưu danh mục học sinh, hiển thị các cột chỉ số thành tích tổng quan (XP, xu, cấp độ, số hoa/bia đá/cây đã hoàn thành) để giáo viên theo dõi, đồng thời lưu chuỗi dữ liệu trạng thái phục hồi (`SaveDataJson`).
_Avoid_: Bảng điểm, User table, Member list

**Thuật Toán Hợp Nhất Thành Tích (Union-Max Sync Algorithm)**:
Quy tắc hòa giải xung đột dữ liệu giữa máy cục bộ và máy chủ Google Sheets theo nguyên tắc tối đa hóa thành quả của học sinh: lấy điểm số và cấp độ cao nhất (`Math.max`), kết hợp phép hợp logic `OR` cho toàn bộ các mảng thử thách đã vượt qua.
_Avoid_: Ghi đè mới nhất, Sync đè, Last write wins

**Hàng Đợi Đồng Bộ Tiến Trình (Throttled Sync Queue)**:
Cơ chế đệm gom nhóm và làm trễ các yêu cầu đồng bộ lên Google Sheets (hoãn 15 giây hoặc khi hoàn thành mốc nhiệm vụ lớn), đảm bảo trải nghiệm chơi mượt mà ngoại tuyến (offline-first) và bảo vệ hạn ngạch API của Google Apps Script.
_Avoid_: Realtime sync, Gửi liên tục, Direct post

**Bộ Khảo Sát Mô Hình 3D (3D Mesh Catalog)**:
Tập tin cấu trúc dữ liệu JSON (`meshCatalog.json`) lưu trữ toàn bộ thông tin hình học bóc tách từ các file 3D (tên mesh, bounding box, kích thước, tâm xoay, bán kính vật cản ước tính, vật liệu và nhãn phân loại ngữ nghĩa).
_Avoid_: File list 3D, Database mesh, Bảng kê model

**Mảnh Ghép Mô Hình (Prefab Mesh / Standalone GLB)**:
Tệp mô hình 3D (.glb) độc lập, siêu nhẹ được bóc tách từ các mô hình cảnh quan tổng hợp lớn (ví dụ: từng cây thông, ghế đá, cột đèn, đài phun nước từ park.glb), sẵn sàng để nạp riêng lẻ và lắp ráp linh hoạt vào các vùng đất mới.
_Avoid_: Model con, Sub-mesh rời, File 3D cắt

**Bộ Cắt Tách Mô Hình (Prefab Slicer CLI)**:
Công cụ dòng lệnh Node.js sử dụng `@gltf-transform` để đọc toàn bộ mô hình trong thư mục `public/3dmodel/`, tính toán phân tích hình học, tạo danh mục JSON và xuất các Mảnh Ghép Mô Hình chuẩn GLB.
_Avoid_: Tool convert 3D, Script xuất hình, Trình xuất mesh

**Phân Loại Ngữ Nghĩa 3D (3D Semantic Classification)**:
Hệ thống nhãn định danh chức năng cho từng mesh trong không gian 3D gồm: `TERRAIN` (mặt đất/nền đi lại), `FOLIAGE` (cây cỏ/hoa lá), `PROP` (đồ vật/ghế/đèn), `OBSTACLE` (vật cản lớn), và `CHARACTER` (nhân vật/linh vật).
_Avoid_: Tag model, Type linh tinh, Phân loại thủ công

**Bản Mẫu Vùng Đất Tùy Biến (Custom Land Sanctuary / PROCEDURAL_SANCTUARY)**:
Bản Mẫu Vùng Đất thế hệ mới cho phép kiến tạo các hòn đảo 3D động dựa trên cấu hình chủ đề (theme) và mật độ trang trí (decorDensity) từ Google Sheets, tự động lấy các Mảnh Ghép Mô Hình từ Bộ Khảo Sát để phối cảnh và cắm Bia Đá Tri Thức.
_Avoid_: Map ngẫu nhiên, Đảo tự tạo, Procedural map

**Tiệm Tạp Hóa Vương Quốc (Kingdom Emporium / Riverside Stall)**:
Gian hàng đổi quà bằng Xu tại bờ sông Làng Khởi Đầu (kết hợp lối mở nhanh từ Nút Ví Xu), nơi học sinh dùng Xu tích lũy từ các bài toán để đổi lấy Hiệu Ứng Bước Chân, Nhân Vật Đồng Hành mới và Bùa Trợ Thủ.
_Avoid_: Shop nạp thẻ, Cửa hàng tiền thật, Chợ đen

**Túi Đồ Dũng Sĩ (Explorer Inventory)**:
Tập hợp danh mục mã định danh các vật phẩm, trang phục, hiệu ứng và số lượng bùa trợ thủ học sinh đã sở hữu, mở nhanh bằng nút `🎒 Túi Đồ` trên HUD (hoặc phím `B`), được lưu trữ trong Tiến Trình Thám Hiểm và đồng bộ tự động lên đám mây Google Sheets.
_Avoid_: Balo đồ, Rương đồ, Kho đồ

**Bùa Trợ Thủ Toán Học (Math Helper Charm)**:
Vật phẩm bổ trợ tiêu hao mua bằng Xu, cho phép học sinh kích hoạt trong Thử Thách để giảm bớt áp lực tâm lý khi gặp câu hỏi khó (ví dụ: Kính Lúp Soi Sáng gạch bỏ 1 phương án sai, Bùa Sao Băng nhân đôi XP).
_Avoid_: Pay-to-win, Bùa hack, Nút giải hộ

**Hiệu Ứng Bước Chân (Trail Footstep Effect)**:
Hiệu ứng hạt ánh sáng thẩm mỹ xuất hiện bám theo từng bước chạy của nhân vật (ví dụ: hoa cỏ nở rộ, bong bóng nước lung linh, bụi sao băng lấp lánh), tạo niềm vui thị giác khi khám phá vương quốc 3D.
_Avoid_: Particle linh tinh, Vết chân dơ

**Bản Mẫu Nông Trại (Farm Sanctuary Template / FARM_SANCTUARY)**:
Bản Mẫu Vùng Đất chuyên biệt định hình cảnh quan nông trại đồng quê nạp động từ Google Sheets, nổi bật với Khu Chuồng Trại Trung Tâm quây rào cùng Cánh Đồng Tự Do nơi đàn vật nuôi xổng chuồng lang thang mang theo các bài toán thử thách.
_Avoid_: Farm template, Map nông trại, Vườn thú

**Khu Chuồng Trại Trung Tâm (Central Farm Pen / Barn Yard)**:
Khuôn viên trung tâm của Ốc Đảo Nông Trại được rào chắn an toàn với cổng gỗ, máng ăn uống, đống rơm và các Chòi Trú Ẩn Theo Loài, là đích đến an toàn của các con vật sau khi được bé giải cứu.
_Avoid_: Chuồng chính, Trại nhốt, Nhà thú

**Cánh Đồng Tự Do (Free-Range Pasture)**:
Vùng đồng cỏ hoa đồng nội rộng mở bao bọc quanh Khu Chuồng Trại, nơi các Động Vật Xổng Chuồng thong dong gặm cỏ, dạo chơi và chờ bé đến tương tác.
_Avoid_: Bãi cỏ quiz, Khu đi dạo, Đồng cỏ hoang

**Động Vật Xổng Chuồng (Escaped Farm Animal / Roaming Animal)**:
Một trong các thực thể vật nuôi (Bò, Bê, Heo, Vịt, Gà, Chó chăn cừu) đi lạc ra ngoài Cánh Đồng Tự Do, mang theo một bài toán thử thách. Khi người chơi lại gần, con vật dừng bước thân thiện để bắt đầu Thử Thách.
_Avoid_: Quái vật, Mob, Pet đi lạc, Thú quiz

**Hành Trình Về Chuồng (Homeward Walk)**:
Hoạt cảnh chuyển động tự động của Động Vật Xổng Chuồng sau khi người chơi giải đúng thử thách toán học, nhảy cẫng ăn mừng rồi thong thả rảo bước từ cánh đồng quay trở về đúng Chòi Trú Ẩn Theo Loài trong Khu Chuồng Trại.
_Avoid_: Tele về chuồng, Biến mất, Đi theo sau

**Chòi Trú Ẩn Theo Loài (Species Shelter)**:
Công trình mái che đặc thù bên trong Khu Chuồng Trại dành riêng cho từng giống loài (Chuồng gà `coop`, Chuồng bò `cow_shelter`, Chuồng heo `pig_shelter`, Chuồng vịt `duck_shelter`, Chòi cún `dog_shelter`) nơi con vật nghỉ ngơi sau khi hoàn thành Hành Trình Về Chuồng.
_Avoid_: Nhà riêng, Chuồng con, Ô chuồng

**Nông Sản Thu Hoạch (Farmstead Produce)**:
Vật phẩm thưởng đặc thù (Bình sữa tươi, Trứng gà vàng, Nấm quý, Trứng vịt, Xương may mắn) xuất hiện khi một Động Vật Xổng Chuồng hoàn thành Hành Trình Về Chuồng, bay lên lấp lánh rồi thu vào Túi Đồ Dũng Sĩ.
_Avoid_: Đồ loot, Drop rác, Vật phẩm rơi

**Cổng Gỗ Đồng Quê (Rustic Farm Gate / Starter Village Farm Portal)**:
Cổng dịch chuyển kiến trúc gỗ mộc mạc đặt bên bờ sông Làng Khởi Đầu (gần cối xay gió), kết nối trực tiếp học sinh tới các vùng đất mang Bản Mẫu Nông Trại (`FARM_SANCTUARY`).
_Avoid_: Cổng đá, Cổng Archimedes, Cửa chuồng


