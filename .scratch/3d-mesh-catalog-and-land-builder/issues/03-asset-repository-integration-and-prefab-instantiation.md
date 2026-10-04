Title: Tích Hợp Prefab Catalog vào AssetRepository và Engine Game Client
Type: task
Status: resolved
Assignee: Antigravity
Blocked by:

## Question

Làm thế nào để nâng cấp `AssetRepository` trong client Three.js để hỗ trợ nạp động, quản lý bộ nhớ đệm và nhân bản (instantiate / clone) các Mảnh Ghép Mô Hình (Prefab Mesh) theo ID từ `meshCatalog.json` thay vì hardcode tĩnh trong `types.ts`?

Chi tiết cần thiết kế và hiện thực:
1. **Dynamic Asset Loading**: Cơ chế cho phép nạp lazy-load các prefab `.glb` theo yêu cầu của từng vùng đất (ví dụ chỉ tải `prefab:tree_oak` và `prefab:lamp_post` khi người chơi đặt chân tới vùng đất sử dụng chúng).
2. **Deep Cloning & Material Sharing**: Cơ chế nhân bản an toàn (instantiate) một prefab nhiều lần trong scene mà chia sẻ chung `BufferGeometry` và `Material` nhằm tối ưu GPU Draw Calls và bộ nhớ trên thiết bị di động.
3. **Fallback & Graceful Degradation**: Cơ chế hiển thị hình học cơ bản (placeholder low-poly box/cylinder với màu đại diện từ catalog) nếu prefab chưa nạp xong hoặc gặp lỗi mạng.
4. **Collision Hull Auto-registration**: Tự động đọc thuộc tính `obstacleRadius` từ `meshCatalog.json` khi đặt một prefab vào scene để tự động thêm vào `SpatialWorld` và `obstacles` mà không cần code dò tìm mesh thủ công.

## Answer

### 1. Trình Quản Lý Danh Mục Prefab (`src/world/assets/PrefabCatalog.ts`)
- Xây dựng lớp singleton `PrefabCatalog` nạp bất đồng bộ file `data/meshCatalog.json` và đánh chỉ mục truy vấn:
  - `getItem(id)`: Lấy chi tiết metadata một prefab.
  - `getItemsByCategory(cat)` & `getItemsBySubCategory(sub)`: Lọc danh sách theo nhóm (cây cối, đá, đèn, ghế, nhân vật).
  - `getRandomItem(filter)`: Lấy ngẫu nhiên prefab phù hợp tiêu chí sinh cảnh quan.
  - `createPlaceholder(item)`: Tự động sinh vật thể hình học cơ bản (thân trụ + nón lá cho cây; khối đa diện cho tảng đá; hộp cho đồ vật) đảm bảo trò chơi hiển thị mượt mà không bao giờ bị đứng hình khi mất mạng hoặc đang nạp ngầm.

### 2. Tích Hợp Prefab vào `AssetRepository` (`src/world/assets/AssetRepository.ts`)
- **Mở rộng `AssetKey`**: Hỗ trợ định danh `prefab:${string}` song song với `map:*` và `avatar:*`.
- **Nạp lười (Lazy Loading)**: Chỉ tải tệp `.glb` prefab tương ứng từ `3dmodel/prefabs/<id>.glb` khi có yêu cầu sử dụng trong scene.
- **Tiết kiệm VRAM (Geometry & Material Sharing)**: Phương thức `instantiate(key)` sử dụng `cached.clone(true)`, chỉ tạo mới các node phân cấp và ma trận biến đổi, giữ nguyên liên kết tới các đối tượng `BufferGeometry` và `Material` gốc của GPU.

### 3. Tự Động Định Vị & Đăng Ký Vật Cản (`instantiatePrefab`)
- Phương thức mới `instantiatePrefab(id, { position, rotationY, scale })`:
  - Thiết lập vị trí 3D $(x, y, z)$, góc quay trục $Y$ và hệ số co giãn `scale`.
  - Tự động đọc trường `obstacleRadius` và `isObstacle` từ catalog JSON.
  - Trả về đối tượng `{ group, item, obstacle }`, trong đó `obstacle` được tính toán sẵn bán kính `obstacle.radius = item.obstacleRadius * scale`.
  - Giúp việc cắm cây, đặt đá và cập nhật lưới va chạm `SpatialWorld` trở nên tức thì mà không cần duyệt cây phân cấp mesh thủ công.

### 4. Kiểm Thử Toàn Diện (`tests/asset_repository.test.ts`)
- Bổ sung 3 test suite kiểm thử tra cứu danh mục, khả năng sinh placeholder fallback cho cây/đá/đồ vật, và tính toán bán kính vật cản tự động cho cột đèn vs hoa cỏ đi xuyên. Toàn bộ 150 tests trong dự án vượt qua (100% pass), bundle production build thành công.

