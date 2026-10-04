Title: Bộ Cắt Tách Mô Hình (Prefab Slicer CLI) và Xuất GLB Độc Lập Chuẩn Hóa
Type: task
Status: resolved
Assignee: Antigravity
Blocked by:

## Question

Làm thế nào để xây dựng tính năng bóc tách Mảnh Ghép Mô Hình (Prefab Slicer) trong script CLI Node.js để cắt các mesh có thể tái sử dụng từ mô hình cảnh quan tổng hợp lớn (`park.glb`, `cozy_lake.glb`) thành các tệp `.glb` độc lập siêu nhẹ trong `public/3dmodel/prefabs/`?

Các vấn đề kỹ thuật trọng tâm cần giải quyết:
1. **Cô lập Sub-graph & Pruning**: Khi trích xuất một node hoặc mesh (ví dụ cụm cây `Tree_01`, ghế đá `Bench_02`, cột đèn `Lamp_03`), làm sao cắt đứt quan hệ với toàn bộ scene khổng lồ còn lại và dọn dẹp (prune) sạch sẽ các buffer, bufferView, accessor, texture không liên quan để file GLB xuất ra chỉ có dung lượng vài KB đến vài chục KB?
2. **Chuẩn hóa Tâm Xoay (Pivot Alignment)**: Tọa độ gốc của mesh trong model cảnh quan thường nằm lệch rất xa tâm (vì đặt ở vị trí trong công viên). Khi xuất thành prefab độc lập, làm sao tịnh tiến lại hình học (mesh vertices) sao cho tâm đáy $x=0, y=0, z=0$ nằm đúng chân đế của vật thể?
3. **Bảo toàn Vật Liệu & Texture**: Đối với các mesh dùng chung Texture Atlas hoặc PBR Material (như cây cối trong park.glb), làm sao giữ nguyên hiển thị màu sắc đúng khi nạp độc lập trong Three.js?
4. **Cập nhật Catalog**: Bổ sung đường dẫn `prefabPath` (`3dmodel/prefabs/<id>.glb`) và thông tin kích thước chuẩn hóa vào `meshCatalog.json`.

## Answer

### 1. Kỹ Thuật Cô Lập & Dọn Dẹp Sub-graph (`scripts/prefabSlicer.ts`)
- Sử dụng `cloneDocument` từ `@gltf-transform/functions` để nhân bản nhanh tài liệu gốc đã được cache trong bộ nhớ RAM.
- Trích xuất toàn bộ cây node con mang mesh của thực thể mục tiêu, di chuyển vào một `Scene` mới độc lập và dọn sạch các node bên ngoài.
- Áp dụng hàm `prune()` tự động giải phóng toàn bộ các `Buffer`, `BufferView`, `Accessor`, `Texture` và `Material` không liên quan.
- Kết quả: File GLB prefab bóc tách đạt dung lượng siêu nhẹ (cột đèn `Lamp003` chỉ **23 KB** so với file gốc `park.glb` **6.75 MB**; cây thông `Pine002` chỉ **25 KB**; cây cổ thụ `Tree002` chỉ **83 KB**).

### 2. Thuật Toán Chuẩn Hóa Chân Đế & Ma Trận Pháp Tuyến (Pivot & Normal Baking)
- Thay vì giữ các ma trận offset phức tạp từ mô hình gốc, thuật toán nướng trực tiếp (bake) tọa độ thế giới vào từng đỉnh trong accessor `POSITION`:
  - $p_{new}.x = (M_{world} \cdot p_{old}).x - center_X$
  - $p_{new}.y = (M_{world} \cdot p_{old}).y - bottom_Y$ (đặt chân đế vật thể chạm đúng $Y = 0$)
  - $p_{new}.z = (M_{world} \cdot p_{old}).z - center_Z$
- Ma trận pháp tuyến $M_{norm} = \text{normalMatrix}(M_{world})$ được áp dụng vào accessor `NORMAL` và chuẩn hóa vector đơn vị (`normalize`), đảm bảo ánh sáng và đổ bóng hiển thị hoàn hảo trong Three.js.
- Các node và root của prefab được reset về ma trận đơn vị (`identity transform`), cho phép Game Engine chỉ cần gọi `model.position.set(x, 0, z)` và `model.rotation.y = angle` để cắm thẳng lên bề mặt đảo mới.

### 3. Công Cụ CLI & Đồng Bộ Danh Mục (`scripts/slicePrefabs.ts`)
- Tích hợp lệnh `npm run slice:prefabs` hỗ trợ các tham số linh hoạt (`--catalog`, `--out`, `--categories`, `--ids`, `--limit`, `--verbose`).
- Xử lý bóc tách thành công **180 file GLB prefab** độc lập vào thư mục `public/3dmodel/prefabs/` trong **3.38 giây**.
- Tự động cập nhật thuộc tính `prefabPath` (`3dmodel/prefabs/<id>.glb`) vào [public/data/meshCatalog.json](file:///d:/Work/Github/vuong-quoc-cuu-chuong-3d/public/data/meshCatalog.json).

### 4. Kiểm Thử Tự Động (`tests/prefab_slicer.test.ts`)
- Bộ kiểm thử tự động xác nhận prefab được cắt có đúng 1 mesh, chân đế $Y_{min} = 0$, tâm $X=0, Z=0$, kích thước giảm hơn 98% và bộ lọc category hoạt động chính xác. Toàn bộ 147 tests vượt qua (100% pass).

