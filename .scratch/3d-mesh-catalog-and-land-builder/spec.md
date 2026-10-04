Status: ready-for-agent

# Đặc Tả Kỹ Thuật (Spec): Bộ Khảo Sát Mô Hình 3D, Mảnh Ghép Mô Hình và Bản Mẫu Vùng Đất Tùy Biến

## Problem Statement

Hiện tại, Vương Quốc Cửu Chương 3D chỉ hỗ trợ tạo các vùng đất học tập theo hai cách:
1. Sinh hình học sơ cấp (khối trụ đá, đóa hoa toán học) bằng công thức toán học (`CIRCLE_SANCTUARY`, `GRID_SANCTUARY`).
2. Nhập các file cảnh quan 3D nguyên khối rất lớn như `park.glb` (3.5 MB) hay `cozy_lake.glb` (15 MB) gắn chặt vào một vùng đất duy nhất (`PARK_SANCTUARY`).

Hạn chế nghiêm trọng từ góc nhìn người dùng:
- **Giáo viên và nhà thiết kế bài giảng** không thể tự do mở các hòn đảo học tập mới (ví dụ: "Đảo Ôn Tập Bảng 7", "Thung Lũng Bảng 8") mà phải nhờ lập trình viên hoặc 3D artist dùng Blender dựng lại toàn bộ bản đồ từ đầu.
- **Hàng trăm mô hình 3D tuyệt đẹp** (cây tùng, ghế đá, đèn lồng, đài phun nước, tảng đá phủ rêu) bị giam cầm bên trong các file cảnh quan nguyên khối, không thể tái sử dụng để trang trí các vùng đất mới.
- **Học sinh sử dụng điện thoại và máy tính bảng giá rẻ** gặp tình trạng tải chậm, giật lag hoặc tràn bộ nhớ đồ họa (VRAM) khi game phải tải các file cảnh quan nguyên khối cồng kềnh qua mạng 4G/Wifi trường học.

## Solution

Xây dựng hệ thống tự động hóa hoàn chỉnh gồm:
1. **Bộ Khảo Sát Mô Hình 3D (3D Mesh Catalog)**: Tự động quét toàn bộ thư mục mô hình 3D của dự án, bóc tách cấu trúc hình học, tính toán hộp bao không gian (Bounding Box), và phân loại ngữ nghĩa thành 6 nhóm (`TERRAIN`, `FOLIAGE`, `PROP`, `OBSTACLE`, `CHARACTER`, `ENVIRONMENT`).
2. **Bộ Cắt Tách Mô Hình (Prefab Slicer)**: Bóc tách từng mesh độc lập thành các file **Mảnh Ghép Mô Hình (Prefab Mesh)** `.glb` siêu nhẹ (20–80 KB), tự động nướng tâm xoay chân đế đáy tại $Y = 0$, căn giữa $X = 0, Z = 0$, nướng ma trận biến đổi thế giới và ma trận pháp tuyến (normals), dọn sạch vật liệu và kết cấu rác.
3. **Cơ Chế Nạp Lười & Chia Sẻ Bộ Nhớ (Lazy Loading & VRAM Sharing)**: Game client chỉ nạp các Mảnh Ghép Mô Hình khi người chơi thực sự bước vào vùng đất; tự động chia sẻ vùng nhớ GPU (deep cloning) cho các vật thể cùng loại và có sẵn vật thể dự phòng (low-poly placeholder fallback) nếu mất kết nối mạng.
4. **Bản Mẫu Vùng Đất Tùy Biến (Procedural Land Sanctuary / `PROCEDURAL_SANCTUARY`)**: Cho phép giáo viên khai báo vùng đất mới trên Google Sheets với các thuộc tính chủ đề (`theme`: `FOREST`, `GARDEN`, `RUINS`, `VILLAGE`) và mật độ trang trí (`decorDensity`: `LOW`, `MEDIUM`, `HIGH`). Hệ thống tự động sinh đĩa địa hình 3D PBR, cắm Cổng Dịch Chuyển 2 chiều, dàn dựng các Bia Đá Tri Thức và rải Mảnh Ghép Mô Hình theo thuật toán sinh số giả ngẫu nhiên có hạt giống tất định (Seeded PRNG) bảo đảm không bao giờ che chắn lối đi hay cổng dịch chuyển (Keep-out zones).

---

## User Stories

### Nhóm Người Dùng: Giáo Viên & Nhà Thiết Kế Bài Giảng
1. As a teacher, I want to create a new 3D island simply by adding a row to the `ZONES` tab on Google Sheets, so that I can expand the curriculum without writing code or 3D modeling scripts.
2. As a teacher, I want to assign a thematic aesthetic (`FOREST`, `GARDEN`, `RUINS`, or `VILLAGE`) to my new island, so that the learning environment visually matches the theme and mood of the math challenge.
3. As a teacher, I want to choose a decoration density (`LOW`, `MEDIUM`, or `HIGH`), so that I can keep the scene clean for younger students or rich and immersive for advanced adventurers.
4. As a teacher, I want math questions defined on the `PROBLEMS` tab to automatically bind to Knowledge Monoliths on the custom island, so that students can interact with the lesson immediately.
5. As a teacher, I want my custom island to maintain the exact same layout across restarts, so that my instructions in class (e.g., "head past the pine tree on the left") remain reliable for all students.
6. As a teacher, I want the system to alert or safely default when invalid template or theme values are entered, so that student game sessions never crash during class.

### Nhóm Người Dùng: Học Sinh Khám Phá
7. As a student on a low-end mobile phone or tablet, I want custom islands to load quickly and consume minimal memory, so that the game runs smoothly without freezing or crashing.
8. As a student entering a custom island through a portal, I want to arrive in a clear, open zone without colliding with trees or rocks, so that I can navigate freely.
9. As a student walking around the island, I want large rocks and dense trees to block my movement realistically, so that the world feels solid and tangible.
10. As a student approaching a Knowledge Monolith, I want the interaction space around the stone to be free of obstacles, so that I can easily click or step forward to answer the math prompt.
11. As a student using an unstable cellular connection, I want missing 3D models to render as lightweight colored placeholder boxes rather than breaking the game, so that I can finish my homework uninterrupted.
12. As a student returning from an island, I want the return portal to be clearly visible and unobstructed at the island's edge, so that I never get trapped in a custom sanctuary.

### Nhóm Người Dùng: 3D Artist & Kỹ Sư Phát Triển
13. As a 3D artist, I want to drop new composite 3D scenes or standalone models into the assets folder and run a single command to catalog everything, so that my new assets are instantly registered with correct bounding boxes.
14. As a 3D artist, I want each sliced prefab to have its base pivot baked at $Y = 0$, so that props placed in the procedural generator sit flush against terrain surfaces without manual height tweaks.
15. As a developer, I want an automated slicer that cleans up unused textures, materials, and buffer views per mesh, so that individual prefab files remain under 100 KB.
16. As a developer, I want the runtime asset repository to deep-clone geometries and materials, so that dozens of identical trees or lanterns share a single GPU memory allocation.
17. As a developer, I want deterministic procedural generation driven by the zone ID, so that tests can assert reproducible layouts and coordinate placements.
18. As a developer, I want explicit keep-out clearance radiuses enforced mathematically around portals and interactive monoliths, so that procedural scattering never creates impassable dead ends.

---

## Implementation Decisions

### 1. Kiến Trúc Hai Pha Xử Lý Ngoại Tuyến (Dual-Phase Headless Toolchain)
- Xây dựng công cụ dòng lệnh chạy trên nền Node.js sử dụng bộ thư viện tiêu chuẩn của ngành đồ họa `@gltf-transform` (`core`, `extensions`, `functions`).
- Không phụ thuộc vào trình duyệt không đầu (headless browser) hay Three.js trong môi trường CLI, đảm bảo tốc độ trích xuất chớp nhoáng (< 4 giây cho toàn bộ 180 prefab).
- **Pha 1 - Khảo sát**: Quét đệ quy toàn bộ thư mục mô hình 3D, phân tích phân cấp node, tính toán hộp bao không gian AABB, phân tích chất liệu và phân loại ngữ nghĩa. Xuất file metadata JSON tập trung.
- **Pha 2 - Cắt tách**: Lấy danh sách mesh từ catalog, nhân ma trận thế giới vào thuộc tính đỉnh (`POSITION`) và ma trận pháp tuyến vào (`NORMAL`), dịch chuyển đáy vật thể về $Y = 0$, căn giữa $X = 0, Z = 0$, loại bỏ toàn bộ dữ liệu thừa (pruning) và lưu thành file `.glb` độc lập.

### 2. Mô Hình Dữ Liệu Catalog (Mesh Catalog Schema)
Schema của từng bản ghi trong danh mục mô hình:
```typescript
interface MeshCatalogItem {
  id: string;
  sourceFile: string;
  meshName: string;
  category: 'TERRAIN' | 'FOLIAGE' | 'PROP' | 'OBSTACLE' | 'CHARACTER' | 'ENVIRONMENT';
  description: string;
  vertexCount: number;
  triangleCount: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  normalizedDimensions: {
    width: number;
    height: number;
    depth: number;
  };
  materialNames: string[];
  isObstacle: boolean;
  obstacleRadius?: number;
  tags: string[];
  prefabPath?: string;
}
```

### 3. Nạp Lười & Quản Lý VRAM Phía Client (Runtime Prefab Repository)
- Khởi tạo `PrefabCatalog` làm điểm truy cập duy nhất cho danh mục prefab đã cắt.
- Mở rộng kho tài nguyên game client hỗ trợ tiền tố khóa `prefab:<id>`.
- **Tối ưu VRAM**: Khi một prefab được nạp, cấu trúc `BufferGeometry` và `Material` được lưu trong bộ nhớ đệm. Các lần gọi tiếp theo sẽ thực hiện deep clone các nút `THREE.Group` và `THREE.Mesh` nhưng giữ nguyên con trỏ tham chiếu đến cùng một vùng nhớ đệm đỉnh và texture trên GPU.
- **Vật thể dự phòng (Placeholder Fallback)**: Khi tải prefab thất bại (mất mạng, đường dẫn sai), sinh một khối hình học sơ cấp (khối hộp hoặc khối nón) có màu sắc đại diện cho danh mục (`FOLIAGE` màu xanh lá, `PROP` màu vàng hổ phách, `OBSTACLE` màu đá xám) kèm cảnh báo trên console, ngăn chặn văng ứng dụng.

### 4. Thiết Kế Bản Mẫu Vùng Đất Tùy Biến (`PROCEDURAL_SANCTUARY`)
- Mở rộng schema cấu hình vùng đất từ Google Sheets với 3 trường dữ liệu:
  - `template`: nhận giá trị `PROCEDURAL_SANCTUARY`.
  - `theme`: một trong các giá trị `FOREST`, `GARDEN`, `RUINS`, `VILLAGE`.
  - `decorDensity`: một trong các giá trị `LOW`, `MEDIUM`, `HIGH`.
- **Cấu trúc đảo 3D**:
  - Tự động sinh đĩa địa hình nguyên khối (PBR `MeshStandardMaterial`): mặt đĩa cỏ xanh phẳng trên cùng, chân vách đá côn ngược sa thạch trầm tích bên dưới, và đường viền bờ cát trang trí mép ngoài.
  - Bán kính đảo được tính tự động từ tham số `width` và `depth` khai báo trên Google Sheets.
- **Thuật toán sinh số giả ngẫu nhiên có hạt giống (Seeded PRNG)**:
  - Áp dụng thuật toán Linear Congruential Generator (LCG) với hạt giống là mã băm của `zone.id`.
  - Đảm bảo tính tất định 100%: mọi vị trí cây cối, tảng đá, ghế đá của một vùng đất đều cố định vĩnh viễn trên mọi thiết bị học sinh.
- **Quy tắc vùng đệm an toàn (Keep-out Zones)**:
  - Vùng Cổng Dịch Chuyển (Return Portal): khoảng cách an toàn tối thiểu $\ge 3.5\text{m}$.
  - Vùng Bia Đá Tri Thức (Knowledge Monolith): khoảng cách an toàn tối thiểu $\ge 2.2\text{m}$.
  - Khoảng cách giữa các vật cản lớn: tối thiểu $\ge 2.5\text{m}$.

---

## Testing Decisions

### Triết Lý Kiểm Thử
- **Chỉ kiểm thử hành vi ngoại vi tại các Điểm Khớp (Seams)**, tuyệt đối không kiểm thử tiểu tiết triển khai nội bộ.
- Mọi bài kiểm thử phải chạy hoàn toàn tự động, độc lập, không phụ thuộc trình duyệt WebGL hay màn hình đồ họa thực tế (Headless Node.js test runner).

### Các Điểm Khớp Được Kiểm Thử (Testing Seams)

1. **Điểm Khớp 1: Khảo Sát Catalog (Model Scanner Seam)**
   - *Hành vi kiểm thử*: Đưa vào thư mục mô hình 3D thực tế, kiểm tra đầu ra danh mục đạt chuẩn schema `MeshCatalogItem[]`, các trường kích thước không âm, phân loại đúng 6 danh mục ngữ nghĩa, và bán kính va chạm được suy diễn chính xác.
   - *Độ sâu*: Kiểm thử toàn diện cấp module CLI.

2. **Điểm Khớp 2: Cắt Tách Prefab (Prefab Slicer Seam)**
   - *Hành vi kiểm thử*: Đưa mesh vào bộ cắt, kiểm tra file nhị phân GLB xuất ra là hợp lệ, đỉnh thấp nhất của vật thể nằm chính xác tại $Y = 0$, tâm đối xứng mặt bằng nằm tại $X = 0, Z = 0$, và ma trận pháp tuyến được biến đổi đúng.

3. **Điểm Khớp 3: Kho Tài Nguyên Client (Asset Repository Seam)**
   - *Hành vi kiểm thử*: Yêu cầu nạp prefab hợp lệ nhận về đối tượng `THREE.Group` kèm vật cản `obstacle`; yêu cầu nạp prefab không tồn tại nhận về khối hình học dự phòng fallback an toàn không gây văng ứng dụng.

4. **Điểm Khớp 4: Sinh Đảo Tùy Biến (Procedural Land Builder Seam)**
   - *Hành vi kiểm thử*: Đưa cấu hình `RemoteZoneData` mang `template = PROCEDURAL_SANCTUARY`, kiểm tra:
     - Tọa độ tâm đảo, Cổng Dịch Chuyển và điểm xuất hiện `arrival`.
     - Số lượng Bia Đá Tri Thức tương ứng số câu hỏi.
     - Vùng đệm an toàn: xác nhận không có bất kỳ vật cản nào nằm trong bán kính $3.0\text{m}$ quanh cổng dịch chuyển.
     - Tính tất định: cùng một `zone.id` luôn sinh ra danh sách vật cản và vị trí prefab đồng nhất qua nhiều lần thực thi.

### Tiền Lệ Kiểm Thử Trong Dự Án (Prior Art)
- Kế thừa mô hình kiểm thử headless Three.js từ `tests/spatial_world.test.ts`, `tests/asset_repository.test.ts` và `tests/sheets_sync.test.ts`.

---

## Out of Scope

1. **Bóc tách Animation xương phức tạp**: Các mô hình nhân vật hoạt họa nhiều khớp xương (Elsa, Milo, Sanrio) được giữ nguyên khối, không phân rã thành các chuyển động con.
2. **Trình biên tập 3D kéo thả trực tiếp trong game (In-game 3D Editor)**: Giáo viên cấu hình thông qua Google Sheets thay vì một giao diện Blender thu nhỏ trong trình duyệt.
3. **Thay thế Engine Three.js**: Giữ vững nền tảng Three.js hiện tại, không chuyển dịch sang Babylon.js hay PlayCanvas.
4. **Tự động chuyển đổi texture KTX2/Basis**: Các prefab giữ nguyên cấu trúc vật liệu palette/PBR hiện có của mô hình nguồn.

---

## Further Notes

- Danh mục mô hình [public/data/meshCatalog.json](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/public/data/meshCatalog.json) và các Mảnh Ghép Mô Hình trong [public/3dmodel/prefabs/](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/public/3dmodel/prefabs/) đã được tạo sẵn trong dự án.
- Khi bổ sung thêm file mô hình mới vào `public/3dmodel/`, chỉ cần thực hiện 2 lệnh:
  ```bash
  npm run scan:models
  npm run slice:prefabs
  ```
- Toàn bộ 152 bài kiểm thử hiện có của dự án đã vượt qua 100%, bảo đảm không gây ra bất kỳ tác dụng phụ nào tới các vùng đất cũ (`Starter Village`, `Knowledge Flower Garden`, `Archimedes Sanctuary`, `Green Park Sanctuary`).
