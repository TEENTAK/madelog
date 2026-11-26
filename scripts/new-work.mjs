#!/usr/bin/env node
// 새 영상 작품 추가
//   node scripts/new-work.mjs <정리된 작품 폴더> [--slug 이름] [--yes] [--force]
//
// 입력 폴더 구조:  clips/(part1/)clip-N.mp4 · refs/(part1/)*.png · prompts/* · final.mp4|mov · _rename-map.tsv
// 만드는 것:
//   media-local/works/<슬러그>/  clips/ · refs/*.webp · poster.webp · thumb.webp · preview.mp4 · final.mp4
//   content/works/<슬러그>/index.md  (이미 있으면 덮어쓰지 않음 — 직접 고친 내용을 지키기 위해. 덮어쓰려면 --force)
// 필요: ffmpeg, ffprobe (libwebp, libx264 포함)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const has = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').match(/^--(slug)$/));
if (!positional[0]) { console.error('사용법: node scripts/new-work.mjs <작품 폴더> [--slug 이름] [--yes] [--force]'); process.exit(1); }

const src = path.resolve(positional[0]);
const slug = opt('slug') ?? path.basename(src);
const out = path.join(root, 'media-local', 'works', slug);
const contentDir = path.join(root, 'content', 'works', slug);

// ---- 도구 ----------------------------------------------------------------
const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
const ff = (a) => run('ffmpeg', ['-y', '-v', 'error', ...a]);
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const walk = (dir) =>
  !fs.existsSync(dir) ? [] :
  fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    .sort(natural);

const probe = (f) => {
  const o = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-show_entries', 'format=duration', '-of', 'json', f]));
  return { width: o.streams[0].width, height: o.streams[0].height, duration: Math.round(parseFloat(o.format.duration) * 10) / 10 };
};

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const ratioLabel = (w, h) => {
  const r = w / h;
  for (const [n, d] of [[1, 1], [3, 4], [4, 3], [9, 16], [16, 9], [2, 3], [3, 2], [21, 9], [9, 21]]) {
    if (Math.abs(r - n / d) / (n / d) < 0.02) return `${n}:${d}`;
  }
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
};

// ---- 간단한 YAML 직렬화 (문자열은 JSON 따옴표 문자열 = 유효한 YAML) --------
const y = (v, ind = 0) => {
  const pad = ' '.repeat(ind);
  if (Array.isArray(v)) {
    return v.map((i) => (i && typeof i === 'object' ? `${pad}- ${y(i, ind + 2).trimStart()}` : `${pad}- ${y(i)}`)).join('\n');
  }
  if (v && typeof v === 'object') {
    return Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => {
        if (Array.isArray(x)) return x.length ? `${pad}${k}:\n${y(x, ind + 2)}` : `${pad}${k}: []`;
        if (x && typeof x === 'object') return `${pad}${k}:\n${y(x, ind + 2)}`;
        return `${pad}${k}: ${y(x)}`;
      })
      .join('\n');
  }
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
};

// ---- 입력 읽기 -------------------------------------------------------------
if (!fs.existsSync(src)) { console.error(`폴더를 찾을 수 없습니다: ${src}`); process.exit(1); }
const clipFiles = walk(path.join(src, 'clips')).filter((f) => /\.(mp4|mov)$/i.test(f));
const refFiles = walk(path.join(src, 'refs')).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const promptFiles = walk(path.join(src, 'prompts'));
const finalSrc = ['final.mp4', 'final.mov'].map((n) => path.join(src, n)).find((f) => fs.existsSync(f));
if (!clipFiles.length) { console.error('clips/ 안에 영상이 없습니다.'); process.exit(1); }

let originalName = slug;
const mapFile = path.join(src, '_rename-map.tsv');
if (fs.existsSync(mapFile)) {
  const m = fs.readFileSync(mapFile, 'utf8').match(/^# original folder: (.+)$/m);
  if (m) originalName = m[1].trim();
}

const rel = (base, f) => path.relative(base, f).split(path.sep).join('/');

// ---- 미디어 만들기 ---------------------------------------------------------
const skipIfExists = (target, fn) => {
  if (fs.existsSync(target) && !has('force')) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fn();
};

console.log(`\n▶ ${slug}  (${originalName})`);

const clips = clipFiles.map((f) => {
  const r = rel(src, f).replace(/\.mov$/i, '.mp4');
  const target = path.join(out, r);
  skipIfExists(target, () => ff(['-i', f, '-c', 'copy', '-movflags', '+faststart', target]));
  const p = probe(f);
  const part = r.match(/part(\d+)/)?.[1];
  const no = r.match(/clip-(\w+)\.mp4$/)?.[1] ?? '';
  return {
    title: `${part ? `Part ${part} · ` : ''}클립 ${no}`.trim(),
    video: r,
    해상도: `${p.width}x${p.height}`,
    길이: p.duration,
    mtime: fs.statSync(f).mtime,
    p,
  };
});

let finalPath;
if (finalSrc) {
  finalPath = 'final.mp4';
  skipIfExists(path.join(out, finalPath), () =>
    /\.mov$/i.test(finalSrc)
      ? ff(['-i', finalSrc, '-c:v', 'libx264', '-crf', '24', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(out, finalPath)])
      : ff(['-i', finalSrc, '-c', 'copy', '-movflags', '+faststart', path.join(out, finalPath)]));
}

// 포스터·썸네일·미리보기의 기준 영상: 완성본 → 첫 클립
const baseVideo = finalSrc ?? clipFiles[0];
const base = probe(baseVideo);
const ss = String(Math.min(1, base.duration / 2));
skipIfExists(path.join(out, 'poster.webp'), () => ff(['-ss', ss, '-i', baseVideo, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '85', path.join(out, 'poster.webp')]));
skipIfExists(path.join(out, 'thumb.webp'), () => ff(['-ss', ss, '-i', baseVideo, '-frames:v', '1', '-vf', "scale='min(600,iw)':-2", '-c:v', 'libwebp', '-quality', '80', path.join(out, 'thumb.webp')]));
skipIfExists(path.join(out, 'preview.mp4'), () => ff(['-i', baseVideo, '-t', '4', '-an', '-vf', "scale='min(480,iw)':-2", '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'preview.mp4')]));

const refTypeOf = (name) =>
  /storyboard/i.test(name) ? '스토리보드' :
  /character|reference ?sheet/i.test(name) ? '캐릭터 시트' :
  /keyframe/i.test(name) ? '키프레임' : '소스 이미지';

// 레퍼런스 표시 이름: part1/keyframe-4a → "Part 1 · 키프레임 4A", storyboard → "스토리보드". md 에서 직접 고쳐도 된다
const refLabel = (rel) => {
  const parts = rel.split('/');
  const base = parts.pop();
  const part = parts.map((d) => d.replace(/^part[-_ ]?(\d+)$/i, 'Part $1')).join(' · ');
  const name = base
    .replace(/^keyframe[-_ ]?(\w*)$/i, (_, n) => `키프레임${n ? ' ' + n.toUpperCase() : ''}`)
    .replace(/^storyboard[-_ ]?(\w*)$/i, (_, n) => `스토리보드${n ? ' ' + n.toUpperCase() : ''}`)
    .replace(/^character[-_ ]?(.*)$/i, (_, n) => `캐릭터${n ? ' · ' + n : ''}`);
  return part ? `${part} · ${name}` : name;
};

const references = refFiles.map((f, i) => {
  const r = rel(src, f).replace(/\.\w+$/, '.webp');
  skipIfExists(path.join(out, r), () => ff(['-i', f, '-vf', "scale='min(1600,iw)':-2", '-c:v', 'libwebp', '-quality', '85', path.join(out, r)]));
  const p = probe(f);
  return {
    no: i + 1,
    name: refLabel(rel(path.join(src, 'refs'), f).replace(/\.\w+$/, '')),
    type: refTypeOf(path.basename(f)),
    image: r,
    해상도: `${p.width}x${p.height}`,
    비율: ratioLabel(p.width, p.height),
  };
});

// ---- 콘텐츠 md ---------------------------------------------------------------
let title = originalName, summary = '', model = [], tags = [];
if (!has('yes') && process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  title = (await rl.question(`제목 [${title}]: `)) || title;
  summary = await rl.question('한 줄 소개(비워도 됨): ');
  model = (await rl.question('모델(쉼표로 구분, 예: Veo 3.1, Seedance): ')).split(',').map((s) => s.trim()).filter(Boolean);
  tags = (await rl.question('태그(쉼표로 구분, 예: 로맨스, 일상): ')).split(',').map((s) => s.trim()).filter(Boolean);
  rl.close();
}

const date = new Date(Math.min(...clips.map((c) => c.mtime))).toISOString().slice(0, 10);
const front = {
  title, date, summary, model, tags,
  final: finalPath,
  finalLength: finalPath ? base.duration : undefined,
  poster: 'poster.webp',
  width: base.width, height: base.height,
  references,
  clips: clips.map(({ mtime, p, ...c }) => c),
};

const mdPath = path.join(contentDir, 'index.md');
if (fs.existsSync(mdPath) && !has('force')) {
  console.log(`  index.md 가 이미 있어 그대로 둡니다 (덮어쓰려면 --force)`);
} else {
  fs.mkdirSync(contentDir, { recursive: true });
  const body = promptFiles.length
    ? `\n<!-- 프롬프트 원문은 같은 폴더의 prompts/ 에 있습니다. 제작기를 여기에 적으세요. -->\n`
    : `\n<!-- 제작기를 여기에 적으세요. -->\n`;
  fs.writeFileSync(mdPath, `---\n${y(front)}\n---\n${body}`);
  for (const f of promptFiles) {
    const t = path.join(contentDir, 'prompts', rel(path.join(src, 'prompts'), f));
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.copyFileSync(f, t);
  }
  console.log(`  content/works/${slug}/index.md 생성 (클립 ${clips.length} · 레퍼런스 ${references.length} · 프롬프트 ${promptFiles.length})`);
}
console.log(`  media-local/works/${slug}/ 준비 완료`);
