import type { VItem } from './viewer';

// /images.json 을 한 번만 받아 둔다. 타일에 마우스를 올리거나 누르는 순간 미리 받기 시작한다.
let p: Promise<Record<string, VItem>> | null = null;
export const loadImageItems = () => {
  if (!p) p = fetch('/images.json').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).catch((e) => { p = null; throw e; });
  return p;
};
const warm = (e: Event) => { if ((e.target as Element | null)?.closest?.('[data-tile]')) loadImageItems().catch(() => {}); };
document.addEventListener('pointerover', warm, { passive: true });
document.addEventListener('focusin', warm);
