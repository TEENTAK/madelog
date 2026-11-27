// 빠진 썸네일만 만든다(이미 있으면 건너뜀). 새 작품·새 이미지는 new-work / sync-notion 이 만들므로 보통은 처음 한 번만 쓴다.
//   이미지: media-local/images/<이름>.webp → <이름>-sm.webp (가로 640, 목록 타일용)
//   클립:   media-local/works/<슬러그>/clips/**/<이름>.mp4 → 같은 이름 .webp (첫 프레임, 가로 ≤640)
// 사용: npm run thumbs   (다 만든 뒤 npm run upload-media -- madelog-media 로 R2에 올린다)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const media = path.join(root, 'media-local');
const walk = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
  .filter((e) => !e.name.startsWith('.'))
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
let made = 0;

for (const f of walk(path.join(media, 'images')).filter((f) => f.endsWith('.webp') && !f.endsWith('-sm.webp'))) {
  const out = f.replace(/\.webp$/, '-sm.webp');
  if (fs.existsSync(out)) continue;
  await sharp(f).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
  made++; console.log('  ✓', path.relative(media, out));
}

for (const f of walk(path.join(media, 'works')).filter((f) => /\/clips\/.*\.mp4$/.test(f))) {
  const out = f.replace(/\.mp4$/, '.webp');
  if (fs.existsSync(out)) continue;
  // ffmpeg 빌드에 따라 libwebp 가 없을 수 있어 PNG로 한 장 뽑아 sharp 로 webp 변환
  const png = execFileSync('ffmpeg', ['-v', 'error', '-ss', '0.1', '-i', f, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], { maxBuffer: 64 * 1024 * 1024 });
  await sharp(png).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
  made++; console.log('  ✓', path.relative(media, out));
}
console.log(`썸네일 ${made}개 만듦`);
