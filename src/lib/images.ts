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

// 열 수만큼 라운드로빈으로 나눠 Pinterest식 열을 만든다 (열 높이는 들쭉날쭉 허용)
export const toColumns = <T>(items: T[], cols = 4): T[][] => {
  const out: T[][] = Array.from({ length: cols }, () => []);
  items.forEach((it, i) => out[i % cols].push(it));
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
