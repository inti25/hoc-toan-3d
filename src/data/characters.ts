export const CHARACTERS = [
  { id: 'baochau', emoji: '💗', label: 'Bảo Châu', title: 'Bảo Châu' },
  { id: 'kuromi', emoji: '🖤', label: 'Kuromi', title: 'Kuromi' },
  { id: 'hellokitty', emoji: '🎀', label: 'Hello Kitty', title: 'Hello Kitty' },
  { id: 'mymelody', emoji: '🌸', label: 'My Melody', title: 'My Melody' },
  { id: 'cinnamoroll', emoji: '☁️', label: 'Cinnamoroll', title: 'Cinnamoroll' },
  { id: 'elsa', emoji: '❄️', label: 'Nữ hoàng băng giá', title: 'Nữ hoàng băng giá' },
  { id: 'vanillish', emoji: '🍧', label: 'Kem', title: 'Kem' },
] as const;

export type AvatarId = typeof CHARACTERS[number]['id'];

export const DEFAULT_AVATAR_ID: AvatarId = CHARACTERS[0].id;

export const ALL_AVATAR_IDS: AvatarId[] = CHARACTERS.map(c => c.id as AvatarId);

export function getCharacter(id: string) {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}
