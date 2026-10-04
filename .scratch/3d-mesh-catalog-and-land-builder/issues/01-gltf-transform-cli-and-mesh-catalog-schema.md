Title: Bộ Khảo Sát Mô Hình 3D (3D Mesh Catalog Schema) và Script Quét CLI @gltf-transform
Type: task
Status: resolved
Assignee: Antigravity
Blocked by:

## Question

Cấu trúc Schema của tệp `meshCatalog.json` (Bộ Khảo Sát Mô Hình 3D) cần những thuộc tính hình học và ngữ nghĩa nào để mô tả đầy đủ mọi mesh trong `public/3dmodel/` (kích thước, bounding box min/max, tâm center, bán kính va chạm obstacleRadius, phân loại semantic như `TERRAIN`, `FOLIAGE`, `PROP`, `OBSTACLE`, `CHARACTER`)?

Làm thế nào để xây dựng script CLI Node.js (`scripts/scan3dModels.ts` chạy bằng `tsx` với thư viện `@gltf-transform/core`) có khả năng:
1. Đọc và phân tích tất cả các định dạng tệp 3D hiện có trong thư mục `public/3dmodel/` bao gồm `.glb` (như `maps/park.glb`, `maps/cozy_lake.glb`) và `.gltf` kèm `.bin`/textures (như `elsa/scene.gltf`, `cinnamoroll/scene.gltf`, `hellokitty/scene.gltf`, `kuromi/scene.gltf`, `mymelody/scene.gltf`).
2. Trích xuất cây phả hệ node/mesh, tính toán chính xác bounding box AABB không gian thực từ vertex accessors (`POSITION`).
3. Tự động gắn nhãn Phân Loại Ngữ Nghĩa (`3D Semantic Classification`) dựa trên tên node/mesh và tỷ lệ hình học.
4. Xuất tệp `public/data/meshCatalog.json` và kèm theo file TypeScript types (`src/data/meshCatalogTypes.ts`) an toàn kiểu tĩnh (type-safe).

## Answer

### 1. Cấu trúc Schema Chuẩn (`src/data/meshCatalogTypes.ts`)
Đã hoàn thành định nghĩa kiểu dữ liệu type-safe cho Bộ Khảo Sát Mô Hình 3D (`MeshCatalog` và `MeshCatalogItem`):
- `id`: Định danh duy nhất theo chuẩn `${prefix}_${cleanName}` (VD: `park_lamp003`, `cozy_lake_tree_dense_01`, `char_elsa`).
- `category`: 6 danh mục ngữ nghĩa chuẩn: `TERRAIN`, `FOLIAGE`, `PROP`, `OBSTACLE`, `CHARACTER`, `ENVIRONMENT`.
- `subCategory`: Phân loại chi tiết (như `tree`, `pine`, `bush`, `flower`, `grass`, `mushroom`, `lamp`, `bench`, `stone`, `water`, `hero`, `companion`).
- `bounds`: Tọa độ thực tế AABB (`min`, `max`, `center`, `size`) trong không gian scene của file nguồn.
- `normalizedBounds`: Khung bao chuẩn hóa đặt đáy tại $Y=0$, tâm trục $X=0, Z=0$ sẵn sàng để cắm trực tiếp lên các hòn đảo 3D mới.
- `obstacleRadius` & `isObstacle`: Bán kính vật cản ước tính cho hệ thống va chạm vật lý (SpatialWorld). Cỏ và hoa tự động gán radius = 0 (`walk-through`), cây gỗ/đá/đèn/ghế được tính toán theo bán kính trụ thực.
- `materials`: Tóm tắt tên vật liệu, mã màu HEX `baseColorHex`, trạng thái texture, độ nhám roughness và tính kim loại metallic.

### 2. Thuật toán Phân Tích & Phân Loại (`scripts/modelScanner.ts`)
- Sử dụng `@gltf-transform/core` và `@gltf-transform/extensions` (`NodeIO`) để phân tích chuẩn chỉ cả file `.glb` lẫn `.gltf` nhị phân kèm buffer `.bin` và textures mà không cần giả lập trình duyệt DOM.
- Tự động nhận diện ranh giới thực thể logic: gom các cụm mesh con (như cây gồm lá + thân) theo node cha (`RootNode`) và cô lập từng thực thể riêng biệt.
- Áp dụng ma trận biến đổi thế giới (`worldMatrix`) lên từng đỉnh (`POSITION` accessor) để tính toán chính xác bounding box AABB.

### 3. Công Cụ CLI (`scripts/scan3dModels.ts`)
- Tích hợp lệnh `npm run scan:models` (tùy chọn `--dir`, `--out`, `--verbose`).
- Quét toàn bộ 7 file mô hình 3D trong `public/3dmodel/` với tốc độ siêu nhanh (0.14 giây), bóc tách thành công **181 thực thể 3D**:
  - `TERRAIN`: 4 thực thể (đảo, nước, nền cát, đường đi)
  - `FOLIAGE`: 136 thực thể (cây thông, cây cổ thụ, bụi rậm, hoa, cỏ, nấm)
  - `PROP`: 27 thực thể (cột đèn, ghế đá, ống dẫn, thuyền, khối đôn)
  - `OBSTACLE`: 6 thực thể (các tảng đá cổ và tảng đá lớn)
  - `CHARACTER`: 5 thực thể (Elsa, Cinnamoroll, Hello Kitty, Kuromi, My Melody)
  - `ENVIRONMENT`: 3 thực thể (đám mây trên không)
- Dữ liệu được lưu trữ chính thức tại `public/data/meshCatalog.json`.

### 4. Kiểm Thử Tự Động (`tests/mesh_catalog.test.ts`)
- Bộ test suite 6 kịch bản kiểm thử toàn diện xác nhận tính đúng đắn của phân loại ngữ nghĩa, độ chính xác của bounding box chuẩn hóa và tính hợp lệ của schema. Toàn bộ 145 bài kiểm thử của dự án đều vượt qua (100% pass).

