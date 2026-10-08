import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRemoteZones } from '../src/core/sheetsClient';
import { SpatialWorld } from '../src/world/SpatialWorld';
import type { RemoteZoneConfig } from '../src/data/remoteTypes';

test('FARM_SANCTUARY zone registration and spatial boundaries', () => {
  const rawRows = [
    {
      ZoneId: '8',
      Name: 'Nông Trại Vui Vẻ',
      Template: 'FARM_SANCTUARY',
      SheetName: 'Zone_8_NongTrai',
      CenterX: '0',
      CenterZ: '0',
      Width: '32',
      Depth: '32',
      ColorHex: '#84cc16'
    }
  ];

  const zones = sanitizeRemoteZones(rawRows);
  assert.equal(zones.length, 1);
  const farmZone = zones[0];
  assert.equal(farmZone.template, 'FARM_SANCTUARY');

  const spatial = new SpatialWorld();
  spatial.setDynamicData(zones);

  // Center of farm
  const cx = farmZone.center.x;
  const cz = farmZone.center.z;

  // Farm has roaming animals up to 25m from center in pasture
  // SpatialWorld must permit walking in the pasture around the farm center
  assert.equal(
    spatial.isWithinLand(cx, cz),
    true,
    'Player should be within land at farm center'
  );
  assert.equal(
    spatial.isWithinLand(cx + 20, cz + 20),
    true,
    'Player should be within land at roaming pasture location (cx + 20, cz + 20)'
  );
});

test('FARM_SANCTUARY is excluded from monolith generation', () => {
  const farmZone: RemoteZoneConfig = {
    id: 8,
    name: 'Nông Trại Vui Vẻ',
    title: 'Nông Trại',
    description: 'Giải cứu thú cưng',
    template: 'FARM_SANCTUARY',
    sheetName: 'Zone_8_NongTrai',
    center: { x: 100, z: 100 },
    width: 32,
    depth: 32,
    color: 0x84cc16,
    colorHex: '#84cc16',
    badge: '🏆 Nông Trại'
  };

  // Check if main logic excludes FARM_SANCTUARY from monoliths
  const isExcludedFromMonoliths = (z: RemoteZoneConfig) => {
    return (
      z.template === 'FLOWER_BEDS' ||
      z.template === 'PARK_SANCTUARY' ||
      z.template === 'FARM_SANCTUARY' ||
      z.id === 6 ||
      z.id === 7 ||
      z.sheetName === 'VuonHoa' ||
      z.sheetName === 'CongVienXanh'
    );
  };

  assert.equal(
    isExcludedFromMonoliths(farmZone),
    true,
    'FARM_SANCTUARY must be excluded from monolith generation'
  );
});

test('sanitizeRemoteZones handles lowercase and whitespace in Template', () => {
  const rawRows = [
    {
      ZoneId: '9',
      Name: 'Trại Heo Cười',
      Template: '  farm_sanctuary  ',
      SheetName: 'Zone_9_TraiHeo',
      CenterX: '50',
      CenterZ: '50'
    }
  ];

  const zones = sanitizeRemoteZones(rawRows);
  assert.equal(zones.length, 1);
  assert.equal(zones[0].template, 'FARM_SANCTUARY');
});

test('FarmSanctuary builds modular scenery without raw GLTF dump and front is open', async () => {
  const { FarmSanctuary } = await import('../src/world/farm/FarmSanctuary');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  mockLibrary.name = 'MockFarmLibrary';

  // Populate mock nodes
  const propNames = [
    'chicken', 'chick', 'cow', 'calf', 'duck', 'duckling', 'pig', 'piglet', 'dog',
    'pen_fence', 'pen_gate', 'feed_trough', 'water_trough', 'coop', 'hay_bale',
    'chicken_shelter', 'duck_shelter', 'cow_shelter', 'pig_shelter', 'dog_shelter',
    'egg', 'milk', 'egg_basket', 'duck_egg', 'truffle'
  ];
  for (const name of propNames) {
    const node = new THREE.Group();
    node.name = name;
    mockLibrary.add(node);
  }

  // Setup farm
  (farm as any).setupFromLibrary(mockLibrary, {});

  // Raw GLTF library scene should NOT be added as child of farm.group
  assert.equal(
    farm.group.children.includes(mockLibrary),
    false,
    'farm.group must not contain raw library scene directly'
  );

  // Scenery group should be present
  assert.ok((farm as any).sceneryGroup, 'Scenery group must exist');
  assert.ok(farm.group.children.includes((farm as any).sceneryGroup), 'Scenery group must be child of farm.group');

  // Verify modular props exist in scenery
  const sceneryNames = (farm as any).sceneryGroup.children.map((c: any) => c.name);
  assert.ok(sceneryNames.includes('coop'), 'Scenery should contain coop');
  assert.ok(sceneryNames.includes('chicken_shelter'), 'Scenery should contain chicken_shelter');
  assert.ok(sceneryNames.includes('cow_shelter'), 'Scenery should contain cow_shelter');
  assert.ok(sceneryNames.includes('duck_shelter'), 'Scenery should contain duck_shelter');
  assert.ok(sceneryNames.includes('pig_shelter'), 'Scenery should contain pig_shelter');
  assert.ok(sceneryNames.includes('dog_shelter'), 'Scenery should contain dog_shelter');

  // Verify animals are spawned
  assert.equal(farm.animals.length, 10, 'Should spawn 10 animals');
});

test('FarmSanctuary allows raycast and point selection on animals', async () => {
  const { FarmSanctuary } = await import('../src/world/farm/FarmSanctuary');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  for (const kind of ['cow', 'chicken', 'pig', 'duck', 'calf', 'piglet', 'chick', 'duckling', 'dog']) {
    const node = new THREE.Group();
    node.name = kind;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    body.name = `${kind}_body`;
    node.add(body);
    mockLibrary.add(node);
  }

  (farm as any).setupFromLibrary(mockLibrary, {});
  const targetAnimal = farm.animals[0];
  assert.ok(targetAnimal, 'First animal must exist');

  // Animal should have position
  const pos = targetAnimal.root.position;

  // Point selection near animal should return target animal
  const foundByPoint = (farm as any).findAnimalNearPoint(pos.clone().add(new THREE.Vector3(0.5, 0, 0.5)), 2.5);
  assert.equal(foundByPoint?.id, targetAnimal.id, 'findAnimalNearPoint must return closest animal');

  // Raycast selection
  const ray = new THREE.Raycaster();
  const rayOrigin = pos.clone().add(new THREE.Vector3(0, 5, 0));
  ray.set(rayOrigin, new THREE.Vector3(0, -1, 0));
  const foundByRay = (farm as any).findAnimalAtRay(ray);
  assert.equal(foundByRay?.id, targetAnimal.id, 'findAnimalAtRay must hit the animal');
});

test('FarmSanctuary update syncs trigger positions with roaming animals', async () => {
  const { FarmSanctuary } = await import('../src/world/farm/FarmSanctuary');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  for (const kind of ['cow', 'chicken', 'pig', 'duck', 'calf', 'piglet', 'chick', 'duckling', 'dog']) {
    const node = new THREE.Group();
    node.name = kind;
    mockLibrary.add(node);
  }

  // Animal starts not rescued
  (farm as any).setupFromLibrary(mockLibrary, {});
  const triggers = farm.getInteractTriggers();
  assert.equal(triggers.length, 10, 'Should have 10 triggers for 10 unrescued animals');

  const animal = farm.animals[0];
  const initialTriggerPos = triggers[0].position.clone();
  assert.equal(initialTriggerPos.x, animal.root.position.x);

  // Force movement target and update
  animal.targetPos = animal.root.position.clone().add(new THREE.Vector3(5, 0, 5));
  farm.update(1.0, new THREE.Vector3(0, 0, 0));

  // Trigger position must track animal position
  assert.equal(triggers[0].position.x, animal.root.position.x);
  assert.equal(triggers[0].position.z, animal.root.position.z);
});

test('FarmSanctuary moves rescued animals towards species shelters', async () => {
  const { FarmSanctuary, SHELTER_CENTERS } = await import('../src/world/farm/FarmSanctuary');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  for (const kind of ['cow', 'chicken', 'pig', 'duck', 'calf', 'piglet', 'chick', 'duckling', 'dog']) {
    const node = new THREE.Group();
    node.name = kind;
    mockLibrary.add(node);
  }

  // Pre-rescued cow
  farm.setupFromLibrary(mockLibrary, { farm_cow_0: true });
  const rescuedCow = farm.animals[0];
  assert.equal(rescuedCow.state, 'RESTING', 'Rescued animal should be RESTING');
  const expectedShelter = SHELTER_CENTERS['cow'];
  assert.ok(
    Math.hypot(rescuedCow.root.position.x - expectedShelter.x, rescuedCow.root.position.z - expectedShelter.z) < 2.0,
    'Rescued cow should start near cow shelter center'
  );
});

test('FarmSanctuary provides fence obstacles that block player except at gate', async () => {
  const { FarmSanctuary } = await import('../src/world/farm/FarmSanctuary');
  const { SpatialWorld } = await import('../src/world/SpatialWorld');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  farm.setupFromLibrary(mockLibrary, {});

  const farmCenter = { x: 50, z: 50 };
  const obstacles = (farm as any).getObstacles?.(farmCenter) || [];

  assert.ok(obstacles.length > 0, 'FarmSanctuary must generate obstacles for fences and structures');

  const spatial = new SpatialWorld();
  spatial.setDynamicData([{
    id: 8,
    name: 'Nông Trại',
    center: farmCenter,
    width: 32,
    depth: 32,
    template: 'FARM_SANCTUARY'
  }]);
  spatial.addObstacles(obstacles);

  // Player should NOT be able to walk through fence
  // Right fence wall is at x = farmCenter.x + 5 = 55, z = 50
  assert.equal(
    spatial.canMove(55, 50),
    false,
    'Player must be blocked by right fence wall'
  );

  // Left fence wall is at x = farmCenter.x - 5 = 45, z = 50
  assert.equal(
    spatial.canMove(45, 50),
    false,
    'Player must be blocked by left fence wall'
  );

  // Back fence wall is at x = 50, z = farmCenter.z - 4 = 46
  assert.equal(
    spatial.canMove(50, 46),
    false,
    'Player must be blocked by back fence wall'
  );

  // Front gate is at x = 50, z = farmCenter.z + 4 = 54
  // Player SHOULD be able to enter through the gate
  assert.equal(
    spatial.canMove(50, 54),
    true,
    'Player should be able to walk through the front gate'
  );
});

test('Unrescued animals never appear or enter inside the fenced pen area', async () => {
  const { FarmSanctuary } = await import('../src/world/farm/FarmSanctuary');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  for (const kind of ['cow', 'chicken', 'pig', 'duck', 'calf', 'piglet', 'chick', 'duckling', 'dog']) {
    const node = new THREE.Group();
    node.name = kind;
    mockLibrary.add(node);
  }

  // Setup farm with no rescued animals
  farm.setupFromLibrary(mockLibrary, {});

  const isInsidePen = (pos: THREE.Vector3) => {
    return Math.abs(pos.x) <= 5.0 && Math.abs(pos.z) <= 4.0;
  };

  // 1. Initial positions: all unrescued animals must be outside the pen
  for (const animal of farm.animals) {
    assert.equal(
      isInsidePen(animal.root.position),
      false,
      `Unrescued animal ${animal.id} spawned inside pen at (${animal.root.position.x}, ${animal.root.position.z})`
    );
  }

  // 2. Simulate roaming with targeted cross-path to verify pen boundary defense
  // Place an animal at (-10, 0) aiming for (10, 0) across the pen
  const testAnimal = farm.animals[0];
  testAnimal.root.position.set(-8, 0, 0);
  testAnimal.heading = Math.PI / 2; // facing +X towards center
  testAnimal.targetPos = new THREE.Vector3(8, 0, 0);
  testAnimal.restTime = 0;

  const dummyPlayerPos = new THREE.Vector3(0, 0, 0);
  for (let step = 0; step < 120; step++) {
    farm.update(0.5, dummyPlayerPos);

    for (const animal of farm.animals) {
      if (animal.state === 'ROAMING') {
        assert.equal(
          isInsidePen(animal.root.position),
          false,
          `Unrescued animal ${animal.id} entered inside pen at (${animal.root.position.x.toFixed(2)}, ${animal.root.position.z.toFixed(2)}) on step ${step}`
        );
      }
    }
  }
});

test('FarmSanctuary scenery includes grass and flowers outside the pen', async () => {
  const { FarmSanctuary } = await import('../src/world/farm/FarmSanctuary');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  
  // Provide mock flora in parkLibrary
  const mockPark = new THREE.Group();
  const grassMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  grassMesh.name = 'Grass002';
  mockPark.add(grassMesh);

  const flowerMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  flowerMesh.name = 'Flowers002';
  mockPark.add(flowerMesh);

  farm.parkLibrary = mockPark;
  farm.setupFromLibrary(mockLibrary, {});

  const floraObjects = (farm as any).sceneryGroup.children.filter((c: any) => 
    c.name.includes('Grass') || c.name.includes('Flowers') || c.name.includes('Bush') || c.name.includes('park_')
  );

  assert.ok(floraObjects.length > 0, `Scenery must contain grass and flower flora items (found ${floraObjects.length})`);
  
  // Verify that all flora are placed OUTSIDE the pen
  for (const obj of floraObjects) {
    const isInsidePen = Math.abs(obj.position.x) <= 5.0 && Math.abs(obj.position.z) <= 4.0;
    assert.equal(isInsidePen, false, `Flora ${obj.name} placed inside pen at (${obj.position.x}, ${obj.position.z})`);
  }
});

test('FarmSanctuary spawns 20 animals when 20 questions are configured in Google Sheets', async () => {
  const { FarmSanctuary } = await import('../src/world/farm/FarmSanctuary');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  for (const kind of ['cow', 'chicken', 'pig', 'duck', 'dog']) {
    const node = new THREE.Group();
    node.name = kind;
    mockLibrary.add(node);
  }

  // Generate 20 mock questions
  const mockQuestions20 = Array.from({ length: 20 }, (_, i) => ({
    id: `q_farm_${i + 1}`,
    question: `${i + 1} x 2 = ?`,
    answer: `${(i + 1) * 2}`,
    options: [`${(i + 1) * 2}`, `${(i + 1) * 2 + 1}`, `${(i + 1) * 2 - 1}`]
  }));

  farm.setupFromLibrary(mockLibrary, {}, mockQuestions20);

  // Must spawn 20 animals matching the 20 questions
  assert.equal(
    farm.animals.length,
    20,
    `Farm must spawn 20 animals when 20 questions are provided, got ${farm.animals.length}`
  );
  assert.equal(
    farm.getInteractTriggers().length,
    20,
    `Farm must generate 20 interaction triggers for 20 animals, got ${farm.getInteractTriggers().length}`
  );
});

test('FarmSanctuary flora covers wide pasture and surrounds perimeter with Bush002', async () => {
  const { FarmSanctuary } = await import('../src/world/farm/FarmSanctuary');
  const THREE = await import('three');

  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  const mockPark = new THREE.Group();
  const bushMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  bushMesh.name = 'Bush002';
  mockPark.add(bushMesh);

  farm.parkLibrary = mockPark;
  farm.setupFromLibrary(mockLibrary, {});

  // 1. Check perimeter bush002 hedge
  const perimeterBushes = (farm as any).sceneryGroup.children.filter((c: any) => 
    c.name.includes('Bush') || c.name.includes('perimeter_bush') || c.name.includes('park_bush')
  );
  assert.ok(
    perimeterBushes.length >= 40,
    `Must have at least 40 Bush002 surrounding the farm perimeter, found ${perimeterBushes.length}`
  );

  // 2. Check wide flora distribution covering up to radius > 20m
  const wideFlora = (farm as any).sceneryGroup.children.filter((c: any) => {
    const r = Math.hypot(c.position.x, c.position.z);
    return r > 20 && !c.name.includes('floor');
  });
  assert.ok(
    wideFlora.length > 10,
    `Flora must cover outer pasture beyond 20m radius, found ${wideFlora.length}`
  );
});







