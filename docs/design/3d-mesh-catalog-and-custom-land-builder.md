# Hướng Dẫn Chi Tiết Thiết Kế: Hệ Thống 3D Mesh Catalog & Kiến Tạo Vùng Đất Tùy Biến (Procedural Land Builder)

Tài liệu này đặc tả toàn bộ kiến trúc kỹ thuật, quy trình trích xuất tài nguyên 3D, schema dữ liệu, cơ chế nạp tối ưu VRAM và cách thiết lập các vùng đất học tập 3D mới hoàn toàn tự động thông qua Google Sheets.

---

## 1. Tổng Quan & Triết Lý Thiết Kế

Trong các phiên bản trước, Vương Quốc Cửu Chương 3D sử dụng hai hình thức tạo vùng đất:
1. **Dựng hình học sơ cấp (Procedural Primitives)**: Sinh các khối trụ, bậc đá, đóa hoa toán học đơn giản theo công thức toán học (`CIRCLE_SANCTUARY`, `GRID_SANCTUARY`).
2. **Bản đồ tĩnh nguyên khối (Monolithic 3D Scene)**: Nhập toàn bộ một file GLTF/GLB lớn (như `park.glb` ~ 3.5 MB hoặc `cozy_lake.glb` ~ 15 MB) làm một vùng đất duy nhất (`PARK_SANCTUARY`).

**Nhược điểm của cách tiếp cận cũ:**
- Không thể tái sử dụng các chi tiết đẹp trong `park.glb` hay `cozy_lake.glb` (cây tùng, đèn đá, cầu gỗ, ghế công viên, đá rêu) cho các hòn đảo học tập mới.
- Mỗi lần giáo viên muốn mở thêm một vùng đất học phép nhân/chia mới thì lập trình viên phải tự dựng bản đồ trong Blender rồi nhúng cả file 3D nặng vào dự án.
- Tải toàn bộ file GLB lớn gây tốn băng thông và ngốn bộ nhớ VRAM trên các thiết bị máy tính bảng, điện thoại di động của học sinh.

**Giải pháp kiến trúc mới:**
Xây dựng chuỗi công cụ (Pipeline) gồm 4 tầng:
```
+-----------------------------------------------------------------------------------+
| 1. MODEL SCANNER & CATALOG SCHEMA (scripts/modelScanner.ts, scan3dModels.ts)      |
|    Quét offline toàn bộ thư mục public/3dmodel/ bằng @gltf-transform              |
|    -> Trích xuất 181 mesh, tính Bounding Box, phân loại 6 danh mục ngữ nghĩa      |
|    -> Xuất catalog metadata: public/data/meshCatalog.json                         |
+---------------------------------------------------------+-------------------------+
                                                          |
                                                          v
+-----------------------------------------------------------------------------------+
| 2. PREFAB SLICER & EXPORTER (scripts/prefabSlicer.ts, slicePrefabs.ts)            |
|    Bóc tách từng mesh độc lập, nướng ma trận thế giới & chuẩn hóa chân đế Y=0    |
|    -> Xuất 180 file GLB độc lập cực nhẹ (20-80 KB) vào public/3dmodel/prefabs/   |
+---------------------------------------------------------+-------------------------+
                                                          |
                                                          v
+-----------------------------------------------------------------------------------+
| 3. ASSET REPOSITORY & PREFAB CATALOG (src/world/assets/PrefabCatalog.ts)          |
|    Tải lười (lazy load on-demand) khi vào đảo, chia sẻ VRAM (deep-clone geometry) |
|    -> Tự động fallback sang Low-poly Placeholder nếu mất kết nối mạng             |
|    -> Tự động tính toán bán kính vật cản (obstacle radius) và vùng va chạm        |
+---------------------------------------------------------+-------------------------+
                                                          |
                                                          v
+-----------------------------------------------------------------------------------+
| 4. PROCEDURAL LAND BUILDER (src/world/procedural/ProceduralLandBuilder.ts)        |
|    Đọc cấu hình tab ZONES từ Google Sheets: template=PROCEDURAL_SANCTUARY         |
|    -> Tự động sinh đĩa địa hình 3D PBR (Mặt cỏ + Vách đá + Bờ cát)               |
|    -> Seeded PRNG rải cây cối, ghế, đèn theo Chủ đề (theme) & Mật độ (density)    |
|    -> Kiểm soát Keep-out Zones: không che chắn Cổng Dịch Chuyển & Bia Đá Tri Thức |
+-----------------------------------------------------------------------------------+
```

---

## 2. Schema Dữ Liệu Catalog (`meshCatalog.json`)

Mỗi phần tử trong file [public/data/meshCatalog.json](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/public/data/meshCatalog.json) tuân thủ định nghĩa kiểu TypeScript tại [src/data/meshCatalogTypes.ts](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/src/data/meshCatalogTypes.ts):

```typescript
export type MeshSemanticCategory =
  | 'TERRAIN'     // Địa hình, đồi núi, mặt hồ, nền đất
  | 'FOLIAGE'     // Cây cối, bụi cỏ, hoa, lá, nấm rừng
  | 'PROP'        // Ghế, đèn lồng, thùng gỗ, hàng rào, bảng chỉ dẫn
  | 'OBSTACLE'    // Tảng đá lớn, vách núi, công trình chặn đường
  | 'CHARACTER'   // Nhân vật (Milo, Elsa, Cinnamoroll...)
  | 'ENVIRONMENT';// Mây trời, thác nước, hiệu ứng nền

export interface MeshCatalogItem {
  id: string;               // Mã định danh duy nhất (VD: "park_Tree_01", "cozy_lake_Pine_Big")
  sourceFile: string;       // File 3D nguồn gốc (VD: "3dmodel/maps/park.glb")
  meshName: string;         // Tên node mesh trong file 3D gốc
  category: MeshSemanticCategory;
  description: string;      // Mô tả tiếng Việt tự động sinh có ý nghĩa
  vertexCount: number;      // Số đỉnh hình học
  triangleCount: number;    // Số tam giác (polygon)
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  normalizedDimensions: {
    width: number;          // Chiều rộng trục X (mét)
    height: number;         // Chiều cao trục Y (mét)
    depth: number;          // Chiều sâu trục Z (mét)
  };
  materialNames: string[];  // Danh sách chất liệu sử dụng
  isObstacle: boolean;      // Có chặn người chơi di chuyển xuyên qua không
  obstacleRadius?: number;  // Bán kính va chạm tự động suy ra từ bounding box
  tags: string[];           // Nhãn gợi ý tìm kiếm (VD: ["tree", "nature", "foliage"])
  prefabPath?: string;      // Đường dẫn file GLB prefab độc lập (VD: "3dmodel/prefabs/park_Tree_01.glb")
}
```

### Bộ Quy Tắc Phân Loại Ngữ Nghĩa Tự Động (Heuristic Classifier)
Script quét sử dụng regex phân tích tên mesh để tự động gán nhãn:
- **`CHARACTER`**: Chứa các từ khóa `character`, `elssa`, `cinnamoroll`, `kuromi`, `pochacco`, `pompompurin`, `milo`.
- **`FOLIAGE`**: Chứa `tree`, `pine`, `flower`, `grass`, `bush`, `leaf`, `plant`, `mushroom`, `foliage`, `canopy`, `log`.
- **`TERRAIN`**: Chứa `ground`, `terrain`, `floor`, `island`, `water`, `lake`, `river`, `cliff`, `sand`, `hill`.
- **`OBSTACLE`**: Chứa `rock`, `stone`, `boulder`, `wall`, `fence`, `building`, `house`, `tower`.
- **`PROP`**: Chứa `bench`, `chair`, `lamp`, `lantern`, `lantern_post`, `barrel`, `crate`, `bridge`, `sign`, `statue`, `fountain`, `path`.

---

## 3. Bộ Cắt Tách Prefab (Prefab Slicer) & Chuẩn Hóa Tọa Độ

File 3D tổng hợp như `park.glb` thường gom hàng trăm chi tiết dưới một cây phân cấp (hierarchy) phức tạp, với các node cha có scale `0.01` và góc xoay `-90°`. Nếu chỉ xuất thô mesh con, mô hình sẽ bị lật nghiêng hoặc co bé tí xíu.

Module [scripts/prefabSlicer.ts](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/scripts/prefabSlicer.ts) thực hiện 3 bước chuẩn hóa quan trọng:
1. **Nướng Ma Trận Thế Giới (World Transform Baking)**:
   - Tính toán ma trận thế giới $M_{\text{world}} = M_{\text{parent}} \times M_{\text{child}}$.
   - Biến đổi toàn bộ vector tọa độ đỉnh (`POSITION` accessor) qua ma trận $M_{\text{world}}$.
   - Biến đổi các vector pháp tuyến (`NORMAL` accessor) bằng ma trận chuyển vị nghịch đảo của ma trận xoay $(M_{\text{rot}}^{-1})^T$ để ánh sáng và bóng đổ chuẩn 100%.
2. **Nướng Điểm Tựa Chân Đế (Pivot Origin Baking)**:
   - Dịch chuyển toàn bộ đỉnh hình học sao cho đáy dưới cùng của vật thể nằm chính xác tại $Y = 0$:
     $$y_{\text{new}} = y - y_{\text{min}}$$
   - Đưa tâm đối xứng mặt ngang về gốc $X = 0, Z = 0$:
     $$x_{\text{new}} = x - \frac{x_{\text{min}} + x_{\text{max}}}{2}, \quad z_{\text{new}} = z - \frac{z_{\text{min}} + z_{\text{max}}}{2}$$
   - *Kết quả*: Bất kỳ khi nào lập trình viên hoặc thuật toán rải đặt prefab tại tọa độ $(X, Y, Z)$, vật thể sẽ đứng vững vàng ngay trên mặt đất, không bị bay lơ lửng trên trời hay chìm nghỉm dưới lòng đất.
3. **Thu Gom Rác & Tối Ưu Dung Lượng (Prune Unused Data)**:
   - Sử dụng `@gltf-transform/functions` (`prune()`) để loại bỏ toàn bộ material, texture, buffer dư thừa không thuộc về mesh đang cắt.
   - Mỗi file `.glb` prefab chỉ nặng từ **20 KB đến 80 KB**, nén cực nhanh qua mạng di động.

---

## 4. Quản Lý Tài Nguyên Client (`PrefabCatalog` & `AssetRepository`)

Client sử dụng mô hình nạp lười bất đồng bộ (Lazy on-demand loading) thông qua [src/world/assets/PrefabCatalog.ts](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/src/world/assets/PrefabCatalog.ts) và [src/world/assets/AssetRepository.ts](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/src/world/assets/AssetRepository.ts):

### Quy trình nạp một Prefab trong Game:
```typescript
// Nạp và đặt một cây công viên vào tọa độ thế giới (x: 10, y: 0, z: -5)
const result = await assetRepository.instantiatePrefab('park_Tree_01', {
  position: { x: 10, y: 0, z: -5 },
  rotationY: Math.PI / 4,
  scale: 1.2
});

// Thêm vào scene Three.js
scene.add(result.group);

// Nếu prefab được đánh dấu là vật cản, tự động nhận đối tượng cản trở di chuyển:
if (result.obstacle) {
  // result.obstacle = { x: 10, z: -5, radius: 0.85 }
  world.registerObstacle(result.obstacle);
}
```

### Ưu điểm vượt trội:
- **Tối ưu VRAM (Deep Cloning)**: Chỉ tải file `.glb` một lần duy nhất vào bộ nhớ đệm. Khi cắm 50 cây trên đảo, 50 cây này dùng chung cùng một vùng nhớ BufferGeometry và Material trên card đồ họa GPU, chỉ nhân bản các nút `THREE.Group` và `THREE.Mesh`.
- **Cơ chế Chống Sập Mạng (Low-poly Placeholder Fallback)**: Nếu mạng mất kết nối hoặc file prefab bị thiếu, hệ thống tự động sinh một khối hình học đại diện (hình hộp hoặc khối nón thấp poly) có cùng màu sắc danh mục, đảm bảo trò chơi không bao giờ bị văng (crash).

---

## 5. Bản Mẫu Vùng Đất Tùy Biến (`PROCEDURAL_SANCTUARY`)

[src/world/procedural/ProceduralLandBuilder.ts](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/src/world/procedural/ProceduralLandBuilder.ts) chịu trách nhiệm tự động kiến tạo một hòn đảo 3D độc lập dựa trên tham số từ Google Sheets.

### 5.1. Cấu Trúc Địa Hình Đảo
- **Mặt cỏ xanh (Top Plate)**: Khối trụ phẳng chất liệu `MeshStandardMaterial` PBR màu xanh lá non (`0x10b981`), độ nhám `roughness: 0.85`, nhận bóng đổ mặt trời.
- **Vách đá sa thạch (Cliff Base)**: Khối côn ngược bên dưới chất liệu đá trầm tích nâu sẫm (`0x4a3728`), tạo cảm giác hòn đảo bay lơ lửng giữa biển mây.
- **Bờ cát viền mép (Rim Sand)**: Đường vành đai màu cát ấm (`0xd9c58c`) trang trí quanh mép đảo ngăn cách mặt cỏ với vách vực.

### 5.2. Các Chủ Đề Thiết Kế (Themes)
Hệ thống hỗ trợ 4 chủ đề cảnh quan, tự động chọn lọc các prefab tương ứng từ `meshCatalog.json`:

| Chủ Đề (`theme`) | Mô Tả Trải Nghiệm | Bộ Prefabs Sử Dụng | Môi Trường Phù Hợp |
| :--- | :--- | :--- | :--- |
| **`FOREST`** | Rừng cây xanh mát, tán tùng lá kim hoang dã | Cây công viên (`park_Tree_*`), Tùng kim (`cozy_lake_Pine_*`), Đá hoa cương, Hoa dại | Ôn tập bảng nhân lớn (7, 8, 9), thử thách kiên trì |
| **`GARDEN`** | Hoa viên thanh bình, ghế đá nghỉ chân | Bụi cỏ hoa, Ghế băng dài (`park_Bench_*`), Đèn công viên, Đá cảnh viền hoa | Bảng nhân nhỏ (2, 3, 4), phép chia căn bản |
| **`RUINS`** | Di tích đá cổ kính, dấu tích rêu phong | Cột đèn cổ, Tảng đá lớn (`cozy_lake_Rock_*`), Cây thông già rủ bóng | Thử thách phân số, so sánh số lớn bé, tìm ẩn số |
| **`VILLAGE`** | Làng quê mộc mạc, hàng rào gỗ ấm cúng | Ghế gỗ, Đèn lồng chân gỗ, Cây bóng mát nhỏ, Đá ven đường | Bài toán có lời văn, đo lường dung tích & khối lượng |

### 5.3. Mật Độ Trang Trí (`decorDensity`)
- **`LOW`**: 8 đến 12 vật thể trang trí (thoáng đãng, tập trung tối đa vào câu hỏi, tối ưu máy yếu).
- **`MEDIUM`** *(Mặc định)*: 16 đến 24 vật thể (cân bằng hài hòa giữa vẻ đẹp và tầm nhìn).
- **`HIGH`**: 26 đến 38 vật thể (rậm rạp, sinh động như một khu rừng thực thụ).

### 5.4. Thuật Toán Bố Trí Không Gian Thông Minh
1. **Thuật Toán Ngẫu Nhiên Tất Định (Deterministic Seeded PRNG)**:
   - Sử dụng bộ sinh số ngẫu nhiên dạng Linear Congruential Generator (LCG) dựa trên mã băm chuỗi của `zone.id`:
     $$X_{n+1} = (1664525 \cdot X_n + 1013904223) \bmod 2^{32}$$
   - *Lợi ích*: Cùng một vùng đất, mỗi cái cây, tảng đá hay ghế ngồi luôn luôn nằm cố định ở một vị trí duy nhất mỗi khi học sinh quay lại đảo. Không bị nhảy vị trí lộn xộn giữa các phiên chơi.
2. **Vùng Đệm An Toàn Bắt Buộc (Keep-out Zones)**:
   - **Khu vực Cổng Dịch Chuyển (Return Portal)**: Bán kính $\ge 3.5\text{m}$ quanh cổng hoàn toàn trống thoáng, tuyệt đối không có cây cối hay đá chặn lối về Làng Khởi Đầu.
   - **Khu vực Bia Đá Tri Thức (Knowledge Monoliths)**: Bán kính $\ge 2.2\text{m}$ quanh từng bia đá luôn thông thoáng để học sinh dễ dàng tiếp cận và mở bảng câu hỏi.
   - **Khoảng cách giữa các vật cản lớn**: Cách nhau tối thiểu $\ge 2.5\text{m}$ tránh tạo thành các khe hẹp làm người chơi bị kẹt.

---

## 6. Hướng Dẫn Sử Dụng

### 6.1. Dành Cho Lập Trình Viên & 3D Artist

#### Thêm Mô Hình 3D Mới Vào Game:
1. Sao chép file `.glb` mới vào thư mục `public/3dmodel/` (hoặc thư mục con như `public/3dmodel/maps/`, `public/3dmodel/characters/`).
2. Mở cửa sổ dòng lệnh Terminal và chạy lệnh quét catalog:
   ```bash
   npm run scan:models
   ```
   *Lệnh này sẽ phân tích các mesh, tính toán kích thước bounding box và cập nhật file `public/data/meshCatalog.json`.*
3. Chạy lệnh cắt tách các prefab độc lập:
   ```bash
   npm run slice:prefabs
   ```
   *Lệnh này sẽ tự động nướng tọa độ chân đế, gọt sạch rác và xuất các file `.glb` siêu nhẹ vào `public/3dmodel/prefabs/`.*
4. Chạy bộ kiểm thử để đảm bảo mọi thứ an toàn:
   ```bash
   npm test
   ```

#### Quy Ước Đặt Tên Mesh trong Phần Mềm 3D (Blender / Maya):
Để bộ phân loại tự động gán đúng danh mục, hãy đặt tên mesh theo quy ước:
- Cây cối: `Tree_Oak_01`, `Pine_Snow_Big`, `Bush_Rose_Medium`
- Trang trí: `Bench_Wood_01`, `Lamp_Post_Classic`, `Barrel_Water`
- Vật cản: `Rock_Granite_01`, `Wall_Brick_Chunk`
- Mặt đất: `Ground_Grass_Meadow`, `Island_Base`

---

### 6.2. Dành Cho Giáo Viên & Người Thiết Kế Bài Học

Giáo viên có thể tự tạo thêm bao nhiêu hòn đảo học tập mới tùy thích trực tiếp trên **Google Sheets**, không cần biết lập trình:

#### Bước 1: Khai Báo Vùng Đất Mới Trên Tab `ZONES`
Thêm một dòng mới vào bảng `ZONES` với các cột như sau:

| id | name | template | theme | decorDensity | color | centerX | centerZ | radius | width | depth |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `zone_forest_trial` | Khu Rừng Bảng 7 | `PROCEDURAL_SANCTUARY` | `FOREST` | `MEDIUM` | `#10b981` | `250` | `-50` | `16` | `32` | `32` |
| `zone_ruins_math` | Thung Lũng Cổ Tích | `PROCEDURAL_SANCTUARY` | `RUINS` | `HIGH` | `#8b5cf6` | `350` | `80` | `18` | `36` | `36` |

*Lưu ý vị trí*: Đặt tọa độ `centerX`, `centerZ` cách xa các vùng đất cũ tối thiểu $80\text{m}$ để các hòn đảo không chồng lấn lên nhau trong không gian 3D.

#### Bước 2: Soạn Câu Hỏi Cho Đảo Mới Trên Tab `PROBLEMS`
Thêm các câu hỏi có cột `zoneId` trùng với `id` vừa tạo ở trên (ví dụ: `zone_forest_trial`).
Hệ thống sẽ tự động lấy các câu hỏi này và gán lần lượt vào các Bia Đá Tri Thức xếp hình vòng cung trên hòn đảo mới!

#### Bước 3: Đăng Nhập Vào Trò Chơi
1. Bấm nút **"Đồng bộ Google Sheets"** trên màn hình cài đặt của game.
2. Bước vào Cổng Dịch Chuyển tại Đền Archimedes hoặc Làng Khởi Đầu.
3. Bạn sẽ được dịch chuyển tức thì đến hòn đảo 3D mới tinh với cảnh quan thiên nhiên sống động, cây cối rợp bóng và các bia đá thử thách sẵn sàng cho học sinh khám phá!

---

## 7. Tổng Hợp Các Lệnh CLI

| Lệnh Script | Mục Đích | Thời Gian Thực Hiện |
| :--- | :--- | :--- |
| `npm run scan:models` | Quét toàn bộ thư mục `public/3dmodel/` xuất catalog metadata `meshCatalog.json` | ~ 0.15 giây |
| `npm run slice:prefabs` | Bóc tách từng mesh thành file GLB độc lập tại `public/3dmodel/prefabs/` | ~ 3.5 giây |
| `npm test` | Chạy 152 bài kiểm thử tự động xác thực toàn diện | ~ 2.8 giây |
| `npm run build` | Đóng gói sản phẩm PWA production tối ưu | ~ 2.0 giây |
