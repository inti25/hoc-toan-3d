export const CHARACTERS = [
  { id: 'boy',         emoji: '👦', label: 'Nhà thám hiểm',   title: 'Nhà thám hiểm'      },
  { id: 'girl',        emoji: '👧', label: 'Nhà khám phá',    title: 'Nhà khám phá'        },
  { id: 'kuromi',      emoji: '🖤', label: 'Kuromi',          title: 'Dũng Sĩ Bóng Tối'   },
  { id: 'hellokitty',  emoji: '🎀', label: 'Hello Kitty',     title: 'Công Chúa Điều Tốt'  },
  { id: 'mymelody',    emoji: '🌸', label: 'My Melody',       title: 'Nàng Thơ Hoa Cỏ'    },
  { id: 'cinnamoroll', emoji: '☁️', label: 'Cinnamoroll',     title: 'Thám Tử Mây Bông'    },
] as const;

export type AvatarId = typeof CHARACTERS[number]['id'];

export const ALL_AVATAR_IDS: AvatarId[] = CHARACTERS.map(c => c.id as AvatarId);

export function getCharacter(id: string) {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}
