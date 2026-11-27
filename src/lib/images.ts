import { getCollection, type CollectionEntry } from 'astro:content';
import { mediaUrl } from './media';
import { fmtDate } from './works';

export type ImageWork = CollectionEntry<'images'>;

// 낱장 화보(from 없음)만 목록에 쓴다. from 이 있는 항목은 영상 리소스.
export async function getImages(includeResources = false): Promise<ImageWork[]> {
  const all = await getCollection('images');
  return all
    .filter((i) => includeResources || !i.data.from)
    .sort((a, b) => b.data.생성일.valueOf() - a.data.생성일.valueOf() || a.id.localeCompare(b.id));
}

// Pinterest식 열: 순서대로 가장 짧은 열에 넣는다(높이 = 1/비율, 타일 높이 상한 10/21 반영). 열 높이가 고르게 맞는다
export const tileRatio = (i: ImageWork) => Math.max(i.data.width / i.data.height, 10 / 21);
export const toColumns = (items: ImageWork[], cols = 4): ImageWork[][] => {
  const out: ImageWork[][] = Array.from({ length: cols }, () => []);
  const h = new Array(cols).fill(0);
  items.forEach((it) => { const k = h.indexOf(Math.min(...h)); out[k].push(it); h[k] += 1 / tileRatio(it); });
  return out;
};

// 이미지 모달 한 장의 데이터(제목·프롬프트·상세). 목록 HTML에는 넣지 않고 /images.json 으로 따로 받는다.
export const imageItem = (item: ImageWork, sourceTitle?: string) => {
  const d = item.data;
  return {
    kind: 'image' as const, title: d.title, label: d.tags[0] ?? '', src: mediaUrl(`images/${d.image}`), prompt: (item.body ?? '').trim(),
    details: [['모델명', d.model], ['품질', d.품질 ?? ''], ['해상도', (d.해상도 ?? `${d.width}x${d.height}`).replace('x', ' × ')], ['비율', d.비율 ?? ''], ['생성일', fmtDate(d.생성일)]] as [string, string][],
    ...(d.from ? { source: { href: `/p/${d.from}`, label: sourceTitle ?? d.from } } : {}),
  };
};
