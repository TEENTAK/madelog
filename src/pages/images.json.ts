import { getImages, imageItem } from '../lib/images';
import { getWorks } from '../lib/works';

// 이미지 모달 데이터: { [이미지 id]: VItem }. 모달을 처음 열 때 한 번만 받는다(scripts/image-data.ts).
export async function GET() {
  const titles = Object.fromEntries((await getWorks()).map((w) => [w.id, w.data.title]));
  const images = await getImages(true);
  const map = Object.fromEntries(images.map((i) => [i.id, imageItem(i, i.data.from ? titles[i.data.from] : undefined)]));
  return new Response(JSON.stringify(map), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
