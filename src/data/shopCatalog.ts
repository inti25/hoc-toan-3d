export type ShopItemType = 'trail' | 'charm';
export type ItemRarity = 'common' | 'rare' | 'legendary';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: ShopItemType;
  icon: string;
  badge: string;
  rarity: ItemRarity;
  themeColor: string;
  particleColors?: number[];
}

export const SHOP_CATALOG: readonly ShopItem[] = [
  {
    id: 'trail_flower',
    name: 'Bước Chân Nở Hoa',
    description: 'Mỗi bước chân nở ra những cánh hoa và chồi non rực rỡ sắc màu của Vườn Hoa Tri Thức.',
    price: 80,
    type: 'trail',
    icon: '🌸',
    badge: 'Hiệu Ứng Vĩnh Viễn',
    rarity: 'common',
    themeColor: '#10b981',
    particleColors: [0xff69b4, 0xffd166, 0x06d6a0, 0xf72585, 0x70e000]
  },
  {
    id: 'trail_stardust',
    name: 'Bụi Sao Lấp Lánh',
    description: 'Dấu chân dũng sĩ tỏa ánh sáng hoàng kim lung linh như bầu trời sao Đỉnh Núi Tư Duy.',
    price: 150,
    type: 'trail',
    icon: '✨',
    badge: 'Hiệu Ứng Vĩnh Viễn',
    rarity: 'rare',
    themeColor: '#f59e0b',
    particleColors: [0xffd700, 0xffbe0b, 0xfff8e7, 0xfb5607, 0xffe600]
  },
  {
    id: 'trail_frost',
    name: 'Băng Tuyết Pha Lê',
    description: 'Để lại những tinh thể băng óng ánh và bông tuyết huyền ảo khi di chuyển trong Vương Quốc.',
    price: 250,
    type: 'trail',
    icon: '❄️',
    badge: 'Hiệu Ứng Huyền Thoại',
    rarity: 'legendary',
    themeColor: '#0ea5e9',
    particleColors: [0x00f5d4, 0x70d6ff, 0xe0fbfc, 0x00b4d8, 0x90e0ef]
  },
  {
    id: 'charm_double_xp',
    name: 'Bùa Nhân Đôi XP',
    description: 'Nhân đôi XP (+10 XP ➔ +20 XP) ở câu hỏi tiếp theo! Tự động kích hoạt khi giải đúng bài toán.',
    price: 50,
    type: 'charm',
    icon: '📜',
    badge: 'Bùa Phép Tiêu Hao',
    rarity: 'rare',
    themeColor: '#8b5cf6'
  }
] as const;

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_CATALOG.find((item) => item.id === id);
}

export function getShopItemsByType(type: ShopItemType): ShopItem[] {
  return SHOP_CATALOG.filter((item) => item.type === type);
}
