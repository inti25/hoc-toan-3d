import { SHOP_CATALOG, type ShopItem } from '../data/shopCatalog';
import type { Adventure } from '../core/adventure';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/audio';

export interface ShopModalContext {
  adventure: Adventure;
  world: World | null | (() => World | null);
  audio: AudioManager;
  updateHUD: () => void;
  toast: (msg: string) => void;
  openDialog: (title: string, body: string, kind: string) => void;
  closeDialog: () => void;
}

export class ShopModal {
  private currentTab: 'shop' | 'inventory' = 'shop';
  private currentMode: 'full' | 'inventory' = 'full';

  constructor(private ctx: ShopModalContext) {}

  private getWorld(): World | null {
    return typeof this.ctx.world === 'function' ? this.ctx.world() : this.ctx.world;
  }

  open(initialTab: 'shop' | 'inventory' = 'shop', mode: 'full' | 'inventory' = 'full') {
    this.currentMode = mode;
    this.currentTab = mode === 'inventory' ? 'inventory' : initialTab;
    this.render();
  }

  private render() {
    const state = this.ctx.adventure.getState();
    const coins = state.coins;
    const inventory = state.inventory || [];
    const equippedTrail = state.equippedTrail || '';
    const charms = state.charms || {};

    const tipText = this.currentMode === 'inventory'
      ? '🌟 Trang bị hiệu ứng bước chân để tỏa sáng trên hành trình, bùa x2 XP sẽ tự kích hoạt khi giải đúng câu hỏi!'
      : '🌟 Giải đúng câu hỏi cùng Milo để nhận thêm xu nhé! (+5 xu/câu đúng)';

    const bannerHtml = `
      <div class="shop-balance-banner">
        <div class="shop-balance-info">
          <span class="shop-coin-emblem">🪙</span>
          <div class="shop-balance-text">
            <span class="shop-balance-label">Kho báu của bé</span>
            <span class="shop-balance-val">${coins} <small>xu</small></span>
          </div>
        </div>
        <div class="shop-balance-tip">
          ${tipText}
        </div>
      </div>
    `;

    const tabsHtml = this.currentMode === 'inventory' ? '' : `
      <div class="shop-tab-nav" role="tablist">
        <button id="shop-tab-shop" class="shop-tab-btn ${this.currentTab === 'shop' ? 'active' : ''}" role="tab" aria-selected="${this.currentTab === 'shop'}">
          🛍️ Tiệm Tạp Hóa
        </button>
        <button id="shop-tab-inv" class="shop-tab-btn ${this.currentTab === 'inventory' ? 'active' : ''}" role="tab" aria-selected="${this.currentTab === 'inventory'}">
          🎒 Túi Đồ Dũng Sĩ (${inventory.length + (charms['charm_double_xp'] ? 1 : 0)})
        </button>
      </div>
    `;

    let contentHtml = '';

    if (this.currentTab === 'shop') {
      const cardsHtml = SHOP_CATALOG.map((item) => {
        const isOwned = item.type === 'trail' && inventory.includes(item.id);
        const isEquipped = item.id === equippedTrail;
        const charmCount = item.type === 'charm' ? (charms[item.id] || 0) : 0;
        const canAfford = coins >= item.price;

        let badgeClass = 'common';
        if (item.rarity === 'rare') badgeClass = 'rare';
        if (item.rarity === 'legendary') badgeClass = 'legendary';
        if (isEquipped) badgeClass = 'equipped';

        let actionBtnHtml = '';
        if (item.type === 'trail') {
          if (isEquipped) {
            actionBtnHtml = `
              <span class="shop-card-owned-tag">✨ Đang dùng</span>
              <button class="shop-btn unequip-btn" data-action="unequip">Gỡ</button>
            `;
          } else if (isOwned) {
            actionBtnHtml = `
              <span class="shop-card-owned-tag">✓ Đã sở hữu</span>
              <button class="shop-btn equip-btn" data-action="equip" data-id="${item.id}">Trang bị</button>
            `;
          } else {
            actionBtnHtml = `
              <div class="shop-card-price">🪙 ${item.price} <small>xu</small></div>
              <button class="shop-btn buy-btn" data-action="buy" data-id="${item.id}" ${canAfford ? '' : 'disabled title="Bé chưa đủ xu"'}>
                Đổi quà
              </button>
            `;
          }
        } else {
          // Consumable charm
          actionBtnHtml = `
            <div class="shop-card-price">🪙 ${item.price} <small>xu</small></div>
            <button class="shop-btn buy-btn" data-action="buy" data-id="${item.id}" ${canAfford ? '' : 'disabled title="Bé chưa đủ xu"'}>
              Mua thêm
            </button>
          `;
        }

        return `
          <div class="shop-card ${isEquipped ? 'equipped' : ''} ${item.type === 'charm' ? 'charm-card' : ''}">
            <div class="shop-card-top">
              <div class="shop-card-icon" style="background:${item.themeColor}15;border-color:${item.themeColor}40">
                ${item.icon}
              </div>
              <div class="shop-card-meta">
                <div class="shop-card-title">${item.name}</div>
                <span class="shop-badge ${badgeClass}">${isEquipped ? 'Đang trang bị' : item.badge}</span>
                ${item.type === 'charm' && charmCount > 0 ? `<span class="shop-badge rare" style="margin-left:4px">Có: ${charmCount}</span>` : ''}
              </div>
            </div>
            <p class="shop-card-desc">${item.description}</p>
            <div class="shop-card-bottom">
              ${actionBtnHtml}
            </div>
          </div>
        `;
      }).join('');

      contentHtml = `
        <div class="shop-item-grid">
          ${cardsHtml}
        </div>
      `;
    } else {
      // Inventory Tab
      const ownedTrails = SHOP_CATALOG.filter((i) => i.type === 'trail' && inventory.includes(i.id));
      const ownedCharms = SHOP_CATALOG.filter((i) => i.type === 'charm' && (charms[i.id] || 0) > 0);

      if (ownedTrails.length === 0 && ownedCharms.length === 0) {
        if (this.currentMode === 'inventory') {
          contentHtml = `
            <div class="shop-empty-state">
              <div class="shop-empty-icon">🎒</div>
              <div class="shop-empty-text">Túi đồ của bé đang trống!</div>
              <p style="font-size:12px;margin:6px 0 16px">Hãy ghé thăm Tiệm Tạp Hóa tại Làng Khởi Đầu để sắm những hiệu ứng bước chân và bùa may mắn nhé!</p>
              <button id="shop-go-to-stall" class="shop-btn buy-btn" style="display:inline-flex">
                Đến Tiệm Tạp Hóa 🛍️
              </button>
            </div>
          `;
        } else {
          contentHtml = `
            <div class="shop-empty-state">
              <div class="shop-empty-icon">🎒</div>
              <div class="shop-empty-text">Túi đồ của bé đang trống!</div>
              <p style="font-size:12px;margin:6px 0 16px">Hãy ghé qua tab <b>Tiệm Tạp Hóa</b> để đổi xu lấy những hiệu ứng bước chân lấp lánh nhé.</p>
              <button id="shop-go-to-catalog" class="shop-btn buy-btn" style="display:inline-flex">
                Ghé Tiệm Tạp Hóa ngay 🛍️
              </button>
            </div>
          `;
        }
      } else {
        const trailCards = ownedTrails.map((item) => {
          const isEquipped = item.id === equippedTrail;
          return `
            <div class="shop-card ${isEquipped ? 'equipped' : ''}">
              <div class="shop-card-top">
                <div class="shop-card-icon" style="background:${item.themeColor}15;border-color:${item.themeColor}40">
                  ${item.icon}
                </div>
                <div class="shop-card-meta">
                  <div class="shop-card-title">${item.name}</div>
                  <span class="shop-badge ${isEquipped ? 'equipped' : 'common'}">
                    ${isEquipped ? '✨ Đang trang bị' : 'Đã sở hữu'}
                  </span>
                </div>
              </div>
              <p class="shop-card-desc">${item.description}</p>
              <div class="shop-card-bottom">
                ${isEquipped
                  ? `<button class="shop-btn unequip-btn" data-action="unequip" style="width:100%;justify-content:center">Gỡ hiệu ứng</button>`
                  : `<button class="shop-btn equip-btn" data-action="equip" data-id="${item.id}" style="width:100%;justify-content:center">Trang bị ngay</button>`
                }
              </div>
            </div>
          `;
        }).join('');

        const charmCards = ownedCharms.map((item) => {
          const count = charms[item.id] || 0;
          return `
            <div class="shop-card charm-card">
              <div class="shop-card-top">
                <div class="shop-card-icon" style="background:${item.themeColor}15;border-color:${item.themeColor}40">
                  ${item.icon}
                </div>
                <div class="shop-card-meta">
                  <div class="shop-card-title">${item.name}</div>
                  <span class="shop-badge rare">Số lượng: ${count} bùa</span>
                </div>
              </div>
              <p class="shop-card-desc">${item.description}</p>
              <div class="shop-card-bottom">
                <span style="font-size:12px;font-weight:700;color:#7c3aed">⚡ Tự động dùng khi trả lời đúng</span>
              </div>
            </div>
          `;
        }).join('');

        contentHtml = `
          <div class="shop-item-grid">
            ${trailCards}
            ${charmCards}
          </div>
        `;
      }
    }

    const bodyHtml = `
      <div class="shop-modal-container">
        ${bannerHtml}
        ${tabsHtml}
        ${contentHtml}
      </div>
    `;

    const dialogTitle = this.currentMode === 'inventory' ? '🎒 Túi Đồ Dũng Sĩ' : '🛍️ Tiệm Tạp Hóa Vương Quốc';
    const dialogKind = this.currentMode === 'inventory' ? 'inventory' : 'shop';
    this.ctx.openDialog(dialogTitle, bodyHtml, dialogKind);
    this.wireListeners();
  }

  private wireListeners() {
    if (typeof document === 'undefined') return;
    const tabShop = document.getElementById('shop-tab-shop');
    const tabInv = document.getElementById('shop-tab-inv');
    const goToCatalog = document.getElementById('shop-go-to-catalog');
    const goToStall = document.getElementById('shop-go-to-stall');

    if (tabShop) {
      tabShop.onclick = () => {
        this.currentTab = 'shop';
        this.render();
      };
    }

    if (tabInv) {
      tabInv.onclick = () => {
        this.currentTab = 'inventory';
        this.render();
      };
    }

    if (goToCatalog) {
      goToCatalog.onclick = () => {
        this.currentTab = 'shop';
        this.render();
      };
    }

    if (goToStall) {
      goToStall.onclick = () => {
        this.ctx.closeDialog();
        const w = this.getWorld();
        if (w) {
          w.teleport(-12.4, -1.5);
          this.ctx.toast('Dũng sĩ đã đến Tiệm Tạp Hóa Vương Quốc! 🛍️');
        }
      };
    }

    // Action buttons: buy, equip, unequip
    document.querySelectorAll<HTMLButtonElement>('.shop-btn[data-action]').forEach((btn) => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        const itemId = btn.dataset.id;

        if (action === 'buy' && itemId) {
          const res = this.ctx.adventure.buyShopItem(itemId);
          if (res.success) {
            this.ctx.audio.playCue('jump');
            this.getWorld()?.burstPlayer(1.2);
            if (res.item?.type === 'trail') {
              this.getWorld()?.setEquippedTrail(this.ctx.adventure.getEquippedTrail());
            }
            this.ctx.toast(res.message);
            this.ctx.updateHUD();
            this.render();
          } else {
            this.ctx.toast(res.message);
          }
        } else if (action === 'equip' && itemId) {
          const res = this.ctx.adventure.equipTrail(itemId);
          if (res.success) {
            this.getWorld()?.setEquippedTrail(itemId);
            this.ctx.audio.playCue('jump');
            this.ctx.toast(res.message);
            this.render();
          } else {
            this.ctx.toast(res.message);
          }
        } else if (action === 'unequip') {
          const res = this.ctx.adventure.equipTrail('');
          if (res.success) {
            this.getWorld()?.setEquippedTrail('');
            this.ctx.toast(res.message);
            this.render();
          }
        }
      };
    });
  }
}
