Title: Bản Mẫu Vùng Đất Tùy Biến (PROCEDURAL_SANCTUARY) Sinh Đảo Động Từ Catalog
Type: prototype
Status: resolved
Assignee: Antigravity
Blocked by:

## Question

Làm thế nào để xây dựng Bản Mẫu Vùng Đất Tùy Biến (`PROCEDURAL_SANCTUARY`) cho phép tự động kiến tạo các hòn đảo 3D mới hoàn chỉnh dựa trên các tham số khai báo trên Google Sheets (`theme`: `FOREST` | `GARDEN` | `RUINS` | `VILLAGE`, `decorDensity`: `LOW` | `MEDIUM` | `HIGH`), sử dụng các prefab từ `meshCatalog.json`?

Nội dung giải quyết:
1. **Procedural Layout Generation**:
   - Sinh nền đất địa hình (Terrain Mesh) có bán kính phù hợp với `width` và `depth` của vùng đất.
   - Bố trí Cổng Dịch Chuyển hai chiều (nối với Làng Khởi Đầu hoặc Đền Archimedes) ở mép ngoài đảo với vùng đệm an toàn không có vật cản (Keep-out zone).
   - Bố trí các Bia Đá Tri Thức (Knowledge Monolith) hoặc Cây Tri Thức (Knowledge Tree) theo mẫu hình học hài hòa (hình tròn, đường dích dắc, vòng cung).
2. **Prop & Foliage Scattering**:
   - Sử dụng thuật toán phân bố có nhiễu loạn giả ngẫu nhiên (seeded PRNG theo `zoneId`) để rải cây cỏ, đá, ghế ngồi, đèn từ catalog phù hợp với `theme` của vùng đất.
   - Tự động kiểm tra khoảng cách an toàn với đường đi, cổng và bia đá.
3. **Cấu hình Google Sheets & Thử Nghiệm**:
   - Cho phép giáo viên khai báo một dòng vùng đất mới trên tab `ZONES` với `template = PROCEDURAL_SANCTUARY`, chọn theme `FOREST`, hệ thống tự động dựng đảo sinh động mà không cần lập trình viên can thiệp code Three.js.

## Answer

Đã hoàn thành toàn diện module `ProceduralLandBuilder`:
1. **Định dạng cấu hình trên Google Sheets**:
   - Mở rộng kiểu `RemoteZoneData` trong `src/data/remoteTypes.ts` và `sheetsClient.ts` hỗ trợ template `PROCEDURAL_SANCTUARY`, cùng hai thuộc tính mới: `theme` (`FOREST`, `GARDEN`, `RUINS`, `VILLAGE`) và `decorDensity` (`LOW`, `MEDIUM`, `HIGH`).
2. **Dựng hình học đảo 3D**:
   - Tự động sinh đĩa địa hình (cylinder/ring PBR MeshStandardMaterial) với bán kính tính toán từ `width` và `depth` của zone, bao gồm mặt cỏ, vách đá sa thạch và đường viền bãi cát mép đảo.
3. **Bố trí đối tượng thông minh (Keep-out zones & Seeded PRNG)**:
   - PRNG dạng Linear Congruential Generator (LCG) dựa trên mã băm của `zone.id`, đảm bảo bố cục địa hình và cây cối ổn định 100% qua mọi lần học sinh đăng nhập.
   - Tính toán vị trí Cổng Dịch Chuyển (Return Portal) ở rìa phía Tây của đảo cùng điểm spawn người chơi `arrival`.
   - Bố cục các bia đá thử thách hình elip/vòng cung quanh đảo, chừa lối đi trung tâm.
   - Rải các cây cỏ, đá hoa cương, ghế gỗ, cột đèn từ `meshCatalog.json` theo theme với mật độ tương ứng (LOW: 8-12, MEDIUM: 16-24, HIGH: 26-38).
   - Kiểm tra vùng an toàn (keep-out zones): cách cổng $\ge 3.5\text{m}$, cách bia đá $\ge 2.2\text{m}$, và cách các vật thể lớn $\ge 2.5\text{m}$.
4. **Tích hợp sâu vào World.ts**:
   - `World.ts` tự động phát hiện `zone.template === 'PROCEDURAL_SANCTUARY'`, gọi `ProceduralLandBuilder.buildLand()` nạp nhóm 3D, cắm cổng dịch chuyển động hai chiều kết nối với Đền Archimedes, đăng ký danh sách `obstacles` và khởi tạo các bia đá `interactiveMonoliths`.
5. **Kiểm thử tự động**:
   - Đã viết unit test hoàn chỉnh trong `tests/procedural_land_builder.test.ts`, kiểm tra tính xác thực về kích thước đảo, vị trí cổng, vùng đệm an toàn và tính tất định của PRNG. Toàn bộ test suite pass 100%.
