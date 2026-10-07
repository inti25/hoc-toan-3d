import test from 'node:test';
import assert from 'node:assert/strict';
import { Adventure, type StorageAdapter } from '../src/core/adventure';
import { freshState, parseSave } from '../src/core/state';
import { mergeStates } from '../src/core/SyncManager';
import { SHOP_CATALOG } from '../src/data/shopCatalog';
import { ShopModal } from '../src/ui/ShopModal';

function createMemoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    }
  };
}

test('SHOP_CATALOG defines 3 permanent footstep trails and 1 consumable double XP charm', () => {
  assert.equal(SHOP_CATALOG.length, 4);
  const trails = SHOP_CATALOG.filter((i) => i.type === 'trail');
  const charms = SHOP_CATALOG.filter((i) => i.type === 'charm');
  assert.equal(trails.length, 3);
  assert.equal(charms.length, 1);

  const flowerTrail = SHOP_CATALOG.find((i) => i.id === 'trail_flower');
  assert.ok(flowerTrail);
  assert.equal(flowerTrail.price, 80);

  const doubleXp = SHOP_CATALOG.find((i) => i.id === 'charm_double_xp');
  assert.ok(doubleXp);
  assert.equal(doubleXp.price, 50);
});

test('SaveState parses and serializes inventory, equippedTrail, and charms properly', () => {
  const rawJson = JSON.stringify({
    version: 1,
    xp: 120,
    coins: 90,
    inventory: ['trail_flower', 'trail_stardust'],
    equippedTrail: 'trail_flower',
    charms: { charm_double_xp: 3 }
  });

  const parsed = parseSave(rawJson);
  assert.deepEqual(parsed.inventory, ['trail_flower', 'trail_stardust']);
  assert.equal(parsed.equippedTrail, 'trail_flower');
  assert.equal(parsed.charms.charm_double_xp, 3);
});

test('buyShopItem rejects purchase when student does not have enough coins', () => {
  const state = freshState();
  state.coins = 30; // Not enough for trail_flower (80)
  const adventure = new Adventure(state, createMemoryStorage());

  const result = adventure.buyShopItem('trail_flower');
  assert.equal(result.success, false);
  assert.match(result.message, /cần thêm 50 xu/i);
  assert.equal(adventure.getState().coins, 30);
  assert.equal(adventure.getState().inventory.length, 0);
});

test('buyShopItem successfully buys cosmetic trail, deducts coins, adds to inventory, and auto-equips', () => {
  const state = freshState();
  state.coins = 100;
  const adventure = new Adventure(state, createMemoryStorage());

  const result = adventure.buyShopItem('trail_flower');
  assert.equal(result.success, true);
  assert.equal(adventure.getState().coins, 20); // 100 - 80
  assert.ok(adventure.getState().inventory.includes('trail_flower'));
  assert.equal(adventure.getState().equippedTrail, 'trail_flower');

  // Attempting to buy again fails with friendly message
  const repeat = adventure.buyShopItem('trail_flower');
  assert.equal(repeat.success, false);
  assert.match(repeat.message, /đã sở hữu/i);
  assert.equal(adventure.getState().coins, 20);
});

test('buyShopItem stacks consumable charms', () => {
  const state = freshState();
  state.coins = 150;
  const adventure = new Adventure(state, createMemoryStorage());

  const r1 = adventure.buyShopItem('charm_double_xp');
  assert.equal(r1.success, true);
  assert.equal(adventure.getCharmCount('charm_double_xp'), 1);
  assert.equal(adventure.getState().coins, 100);

  const r2 = adventure.buyShopItem('charm_double_xp');
  assert.equal(r2.success, true);
  assert.equal(adventure.getCharmCount('charm_double_xp'), 2);
  assert.equal(adventure.getState().coins, 50);
});

test('equipTrail equips owned trail and unequips with empty string', () => {
  const state = freshState();
  state.inventory = ['trail_flower', 'trail_frost'];
  const adventure = new Adventure(state, createMemoryStorage());

  const unowned = adventure.equipTrail('trail_stardust');
  assert.equal(unowned.success, false);

  const equipFrost = adventure.equipTrail('trail_frost');
  assert.equal(equipFrost.success, true);
  assert.equal(adventure.getEquippedTrail(), 'trail_frost');

  const unequip = adventure.equipTrail('');
  assert.equal(unequip.success, true);
  assert.equal(adventure.getEquippedTrail(), '');
});

test('recordQuizResult consumes 1 double XP charm and doubles XP from 10 to 20', () => {
  const state = freshState();
  state.charms = { charm_double_xp: 2 };
  const adventure = new Adventure(state, createMemoryStorage());

  // 1st answer with active charm:
  const delta1 = adventure.recordQuizResult({ isCorrect: true, questionId: 'm2_3' });
  assert.equal(delta1.isCorrect, true);
  assert.equal(delta1.doubleXpApplied, true);
  assert.equal(delta1.xpGained, 20); // 10 * 2
  assert.equal(adventure.getCharmCount('charm_double_xp'), 1);
  assert.equal(adventure.getState().xp, 20);

  // 2nd answer with 1 charm remaining:
  const delta2 = adventure.recordQuizResult({ isCorrect: true, questionId: 'm2_4' });
  assert.equal(delta2.doubleXpApplied, true);
  assert.equal(delta2.xpGained, 20);
  assert.equal(adventure.getCharmCount('charm_double_xp'), 0);
  assert.equal(adventure.getState().xp, 40);

  // 3rd answer when charms depleted: normal 10 XP
  const delta3 = adventure.recordQuizResult({ isCorrect: true, questionId: 'm2_5' });
  assert.equal(delta3.doubleXpApplied, false);
  assert.equal(delta3.xpGained, 10);
  assert.equal(adventure.getState().xp, 50);
});

test('mergeStates unions inventory, keeps equipped trail, and preserves max charm count', () => {
  const local = freshState();
  local.inventory = ['trail_flower'];
  local.equippedTrail = 'trail_flower';
  local.charms = { charm_double_xp: 2 };

  const remote = freshState();
  remote.inventory = ['trail_flower', 'trail_stardust'];
  remote.equippedTrail = 'trail_stardust';
  remote.charms = { charm_double_xp: 3 };

  const merged = mergeStates(local, remote);
  assert.deepEqual(merged.inventory.sort(), ['trail_flower', 'trail_stardust'].sort());
  assert.equal(merged.equippedTrail, 'trail_flower'); // local takes precedence
  assert.equal(merged.charms.charm_double_xp, 3); // max(2, 3)
});

test('ShopModal inventory-only mode renders without shop tab and uses inventory title', () => {
  const state = freshState();
  const adventure = new Adventure(state, createMemoryStorage());
  let openedTitle = '';
  let openedBody = '';
  let openedKind = '';

  const modal = new ShopModal({
    adventure,
    world: null,
    audio: { playCue: () => {} } as any,
    updateHUD: () => {},
    toast: () => {},
    openDialog: (title, body, kind) => {
      openedTitle = title;
      openedBody = body;
      openedKind = kind;
    },
    closeDialog: () => {}
  });

  modal.open('inventory', 'inventory');
  assert.equal(openedTitle, '🎒 Túi Đồ Dũng Sĩ');
  assert.equal(openedKind, 'inventory');
  assert.ok(!openedBody.includes('id="shop-tab-shop"'));
  assert.ok(openedBody.includes('id="shop-go-to-stall"'));
  assert.match(openedBody, /Đến Tiệm Tạp Hóa 🛍️/);
  assert.match(openedBody, /Trang bị hiệu ứng bước chân để tỏa sáng/);
});

test('ShopModal full mode renders both tabs and uses shop title', () => {
  const state = freshState();
  const adventure = new Adventure(state, createMemoryStorage());
  let openedTitle = '';
  let openedBody = '';
  let openedKind = '';

  const modal = new ShopModal({
    adventure,
    world: null,
    audio: { playCue: () => {} } as any,
    updateHUD: () => {},
    toast: () => {},
    openDialog: (title, body, kind) => {
      openedTitle = title;
      openedBody = body;
      openedKind = kind;
    },
    closeDialog: () => {}
  });

  modal.open('shop', 'full');
  assert.equal(openedTitle, '🛍️ Tiệm Tạp Hóa Vương Quốc');
  assert.equal(openedKind, 'shop');
  assert.ok(openedBody.includes('id="shop-tab-shop"'));
  assert.ok(openedBody.includes('id="shop-tab-inv"'));
});

