import test from 'node:test';
import assert from 'node:assert/strict';
import { Adventure, type StorageAdapter } from '../src/core/adventure';
import { freshState, parseSave } from '../src/core/state';
import { mergeStates } from '../src/core/SyncManager';
import { getProduceForAnimalKind, SHOP_CATALOG } from '../src/data/shopCatalog';
import { getLevel, getLevelTitle, LEVEL_XP } from '../src/data/config';
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

test('SHOP_CATALOG defines 4 permanent footstep trails, 3 charms, and 5 non-purchasable farm produce items', () => {
  assert.equal(SHOP_CATALOG.length, 12);
  const trails = SHOP_CATALOG.filter((i) => i.type === 'trail');
  const charms = SHOP_CATALOG.filter((i) => i.type === 'charm');
  const produces = SHOP_CATALOG.filter((i) => i.type === 'produce');
  assert.equal(trails.length, 4);
  assert.equal(charms.length, 3);
  assert.equal(produces.length, 5);
  assert.ok(produces.every((p) => p.purchasable === false && (p.sellPrice ?? 0) > 0));

  const flowerTrail = SHOP_CATALOG.find((i) => i.id === 'trail_flower');
  assert.ok(flowerTrail);
  assert.equal(flowerTrail.price, 80);

  const doubleXp = SHOP_CATALOG.find((i) => i.id === 'charm_double_xp');
  assert.ok(doubleXp);
  assert.equal(doubleXp.price, 50);

  assert.equal(getProduceForAnimalKind('pig'), 'produce_truffle');
  assert.equal(getProduceForAnimalKind('dog'), 'produce_bone');
});

test('LEVEL_XP supports 20 levels while preserving legacy Lv1..Lv5 thresholds', () => {
  assert.equal(LEVEL_XP.length, 20);
  assert.deepEqual(LEVEL_XP.slice(0, 5), [0, 100, 250, 450, 700]);
  assert.equal(getLevel(10450), 20);
  assert.equal(getLevelTitle(20), 'Đại Kiến Trúc Sư Vương Quốc');
});

test('SaveState parses v1 legacy produce_* items into produceBag and serializes v2 cleanly', () => {
  const rawJson = JSON.stringify({
    version: 1,
    xp: 120,
    coins: 90,
    inventory: ['trail_flower', 'trail_stardust', 'produce_milk', 'produce_truffle'],
    equippedTrail: 'trail_flower',
    charms: { charm_double_xp: 3 }
  });

  const parsed = parseSave(rawJson);
  assert.equal(parsed.version, 2);
  assert.deepEqual(parsed.inventory, ['trail_flower', 'trail_stardust']);
  assert.equal(parsed.produceBag.produce_milk, 1);
  assert.equal(parsed.produceBag.produce_truffle, 1);
  assert.equal(parsed.equippedTrail, 'trail_flower');
  assert.equal(parsed.charms.charm_double_xp, 3);
});

test('buyShopItem rejects purchase when student does not have enough coins or tries buying produce', () => {
  const state = freshState();
  state.coins = 30;
  const adventure = new Adventure(state, createMemoryStorage());

  const result = adventure.buyShopItem('trail_flower');
  assert.equal(result.success, false);
  assert.match(result.message, /cần thêm 50 xu/i);
  assert.equal(adventure.getState().coins, 30);

  const buyProduce = adventure.buyShopItem('produce_milk');
  assert.equal(buyProduce.success, false);
});

test('buyShopItem successfully buys cosmetic trail, deducts coins, adds to inventory, and auto-equips', () => {
  const state = freshState();
  state.coins = 100;
  const adventure = new Adventure(state, createMemoryStorage());

  const result = adventure.buyShopItem('trail_flower');
  assert.equal(result.success, true);
  assert.equal(adventure.getState().coins, 20);
  assert.ok(adventure.getState().inventory.includes('trail_flower'));
  assert.equal(adventure.getState().equippedTrail, 'trail_flower');

  const repeat = adventure.buyShopItem('trail_flower');
  assert.equal(repeat.success, false);
  assert.match(repeat.message, /đã sở hữu/i);
  assert.equal(adventure.getState().coins, 20);
});

test('buyShopItem stacks consumable charms and sellProduce / tradeProduceForCharm work cleanly', () => {
  const state = freshState();
  state.coins = 150;
  const adventure = new Adventure(state, createMemoryStorage());

  const r1 = adventure.buyShopItem('charm_double_xp');
  assert.equal(r1.success, true);
  assert.equal(adventure.getCharmCount('charm_double_xp'), 1);
  assert.equal(adventure.getState().coins, 100);

  adventure.addProduceToInventory('produce_truffle', 2);
  adventure.addProduceToInventory('produce_milk', 1);
  const sellRes = adventure.sellProduce('produce_milk', 1);
  assert.equal(sellRes.success, true);
  assert.equal(sellRes.coinsGained, 20);
  assert.equal(adventure.getProduceCount('produce_milk'), 0);

  const tradeRes = adventure.tradeProduceForCharm('charm_double_xp');
  assert.equal(tradeRes.success, true);
  assert.equal(adventure.getProduceCount('produce_truffle'), 0);
  assert.equal(adventure.getCharmCount('charm_double_xp'), 2);
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

test('charm_double_xp applies uniformly across recordQuizResult, bloomFlower, wakeParkTree, and activateMonolith', () => {
  const state = freshState();
  state.charms = { charm_double_xp: 3 };
  const adventure = new Adventure(state, createMemoryStorage());

  const delta1 = adventure.recordQuizResult({ isCorrect: true, questionId: 'm2_3' });
  assert.equal(delta1.doubleXpApplied, true);
  assert.equal(delta1.xpGained, 20);

  const flowerDelta = adventure.bloomFlower(0);
  assert.equal(flowerDelta.doubleXpApplied, true);
  assert.equal(flowerDelta.xpGained, 30);

  const treeDelta = adventure.wakeParkTree(0, 'tree_1', 12, 5);
  assert.equal(treeDelta.doubleXpApplied, true);
  assert.equal(treeDelta.xpGained, 40);
  assert.equal(adventure.getCharmCount('charm_double_xp'), 0);

  // Separate park zones do not collide on progress
  assert.equal(adventure.isParkTreeAwakened(0, 12, 'tree_1'), true);
  assert.equal(adventure.isParkTreeAwakened(0, 99, 'tree_1'), false);
});

test('mergeStates unions inventory, produceBag, solvedEntities, and preserves max charm count', () => {
  const local = freshState();
  local.inventory = ['trail_flower'];
  local.equippedTrail = 'trail_flower';
  local.charms = { charm_double_xp: 2 };
  local.produceBag = { produce_milk: 3 };

  const remote = freshState();
  remote.inventory = ['trail_flower', 'trail_stardust'];
  remote.equippedTrail = 'trail_stardust';
  remote.charms = { charm_double_xp: 3 };
  remote.produceBag = { produce_milk: 1, produce_truffle: 2 };

  const merged = mergeStates(local, remote);
  assert.deepEqual(merged.inventory.sort(), ['trail_flower', 'trail_stardust'].sort());
  assert.equal(merged.equippedTrail, 'trail_flower');
  assert.equal(merged.charms.charm_double_xp, 3);
  assert.equal(merged.produceBag.produce_milk, 3);
  assert.equal(merged.produceBag.produce_truffle, 2);
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
});

test('ShopModal full mode renders purchasable items only and shows produce exchange when produceBag non-empty', () => {
  const state = freshState();
  state.produceBag = { produce_milk: 2 };
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
  assert.match(openedBody, /Quầy Thu Mua Nông Sản/);
  assert.ok(!openedBody.includes('data-action="buy" data-id="produce_milk"'));
});
