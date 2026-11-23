import { getCollection, type CollectionEntry } from 'astro:content';

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
