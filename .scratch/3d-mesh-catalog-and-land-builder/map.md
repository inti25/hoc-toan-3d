## Destination

Bản đặc tả kiến trúc, công cụ CLI (sử dụng `@gltf-transform`) để phân tích toàn bộ thư mục `public/3dmodel/`, trích xuất metadata hình học và ngữ nghĩa ra `meshCatalog.json`, bóc tách các Mảnh Ghép Mô Hình (`.glb` prefab) tái sử dụng được, và kiến tạo Bản Mẫu Vùng Đất Tùy Biến (`PROCEDURAL_SANCTUARY`) sinh các hòn đảo 3D mới theo chủ đề cấu hình từ Google Sheets.

## Notes

- **Domain**: Đồ họa 3D WebGL (Three.js), xử lý mô hình GLTF/GLB nhị phân trong Node.js, sinh cảnh quan động (procedural generation), tích hợp Google Sheets.
- **Skills tư vấn**: `domain-modeling`, `codebase-design`, `prototype`, `tdd`.
- **Standing Preferences**:
  - Dùng `@gltf-transform/core` trong môi trường CLI Node.js (`tsx`) để phân tích và trích xuất GLB chuẩn chỉ, không phụ thuộc headless DOM hay Three.js ngoài trình duyệt.
  - Mỗi prefab xuất ra phải được chuẩn hóa tâm xoay (pivot origin tại chân mesh $y=0$ và tâm $x=0, z=0$) để dễ dàng đặt lên bề mặt đảo mới.
  - Phân loại ngữ nghĩa rõ ràng: `TERRAIN`, `FOLIAGE`, `PROP`, `OBSTACLE`, `CHARACTER`.
  - Giữ vững nguyên tắc tải nhẹ cho thiết bị học sinh (PWA mobile friendly).

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01: Bộ Khảo Sát Mô Hình 3D (3D Mesh Catalog Schema) và Script Quét CLI @gltf-transform](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/.scratch/3d-mesh-catalog-and-land-builder/issues/01-gltf-transform-cli-and-mesh-catalog-schema.md): Hoàn thành Schema MeshCatalogItem, module phân loại ngữ nghĩa 6 danh mục, script `npm run scan:models` quét 7 file 3D bóc tách 181 thực thể trong 0.14s kèm 100% test pass.
- [02: Bộ Cắt Tách Mô Hình (Prefab Slicer CLI) và Xuất GLB Độc Lập Chuẩn Hóa](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/.scratch/3d-mesh-catalog-and-land-builder/issues/02-prefab-slicer-and-standalone-glb-exporter.md): Xây dựng bộ cắt prefab với kỹ thuật nướng tọa độ tâm đáy Y=0 và ma trận pháp tuyến, lệnh `npm run slice:prefabs` xuất 180 prefab GLB độc lập siêu nhẹ (20-80KB) vào `public/3dmodel/prefabs/` trong 3.38s, cập nhật `prefabPath` vào catalog JSON và 100% test pass.
- [03: Tích Hợp Prefab Catalog vào AssetRepository và Engine Game Client](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/.scratch/3d-mesh-catalog-and-land-builder/issues/03-asset-repository-integration-and-prefab-instantiation.md): Triển khai PrefabCatalog và mở rộng AssetRepository hỗ trợ key `prefab:*` lazy-load, deep-clone chia sẻ VRAM, fallback placeholder chống crash mạng và hàm `instantiatePrefab` tự động tính toán bán kính vật cản obstacle.
- [04: Bản Mẫu Vùng Đất Tùy Biến (PROCEDURAL_SANCTUARY) Sinh Đảo Động Từ Catalog](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/.scratch/3d-mesh-catalog-and-land-builder/issues/04-procedural-custom-land-builder-from-catalog.md): Xây dựng ProceduralLandBuilder sinh đảo 3D PBR, hỗ trợ theme & decorDensity từ Google Sheets, bố trí cổng dịch chuyển 2 chiều, bia đá tri thức, rải prefab tất định theo PRNG seed và kiểm soát vùng an toàn (keep-out zones).

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

- Trình biên tập đảo trực quan 3D trên Web (In-game 3D Land Editor): giao diện kéo thả trực tiếp trong game để giáo viên tự sắp đặt vị trí prefab cho vùng đất mới.
- Tự động nén texture (KTX2 / WebP) và tạo LOD (Level of Detail) cho các prefab để tối ưu RAM trên điện thoại cấu hình yếu.
- Hệ sinh thái biến thể màu sắc (Color Tinting / Shader variations) theo mùa hoặc thời tiết cho các prefab cây cối trong vùng đất mới.

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->

- Bóc tách animation skeletal phức tạp của nhân vật (Elsa, Sanrio) thành các hành động riêng lẻ (các nhân vật chỉ được catalog metadata nguyên khối).
- Thay thế hoàn toàn Three.js bằng engine game khác (Babylon.js / PlayCanvas).
- Viết phần mềm tạo mô hình 3D từ đầu (Blender clone trong trình duyệt).
