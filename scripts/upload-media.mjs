// media-local/ → R2. 지난번에 올린 뒤 바뀌었거나 새로 생긴 파일만 올린다.
// 사용: npm run upload-media -- <버킷> [--dry] [--init] [--prune]
//   --dry   올릴 파일·지울 파일 목록만 보여 준다(아무것도 바꾸지 않음)
//   --init  지금 media-local 상태를 "이미 올림"으로 기록만 한다(처음 한 번, 이미 R2에 다 올라가 있을 때)
//   --prune media-local 에서 지운 파일을 R2 에서도 지운다(기본은 목록만 알려 줌)
// 기록 파일: .r2-manifest-<버킷>.tsv (경로 · 크기 · 수정시각 · md5). Git 에 올리지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'media-local');
const args = process.argv.slice(2);
const bucket = args.find((a) => !a.startsWith('--'));
const flag = (f) => args.includes(f);
if (!bucket) { console.error('버킷 이름을 적어 주세요. 예: npm run upload-media -- madelog-media'); process.exit(1); }
const MANIFEST = path.join(ROOT, `.r2-manifest-${bucket}.tsv`);

// R2 무료 한도 10GB-month(초과 시 자동 과금). media-local 크기가 곧 올린 뒤의 R2 사용량(상한)이라 9GB 를 넘기지 않는다.
const LIMIT = 9 * 1024 ** 3, WARN = LIMIT * 0.8;
const TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };
const CACHE = 'public, max-age=86400';

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.name === '.DS_Store' || e.name.startsWith('._')) return [];
  return e.isDirectory() ? walk(p) : e.isFile() ? [p] : [];
});
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

const old = new Map();
if (fs.existsSync(MANIFEST)) for (const line of fs.readFileSync(MANIFEST, 'utf8').split('\n')) {
  const [rel, size, mtime, hash] = line.split('\t'); if (rel && hash) old.set(rel, { size: +size, mtime: +mtime, hash });
}

const files = walk(SRC).map((f) => {
  const st = fs.statSync(f);
  return { abs: f, rel: path.relative(SRC, f).split(path.sep).join('/'), size: st.size, mtime: Math.floor(st.mtimeMs) };
}).sort((a, b) => a.rel.localeCompare(b.rel));

const total = files.reduce((n, f) => n + f.size, 0);
const mb = (b) => (b / 1024 ** 2).toFixed(1);
console.log(`media-local 용량: ${mb(total)} MB / 한도 9216 MB`);
if (total > LIMIT) { console.error('중단: 9GB 를 넘습니다. 안 쓰는 파일을 media-local 에서 줄인 뒤 다시 실행해 주세요.'); process.exit(1); }
if (total > WARN) console.log('주의: 한도의 80% 를 넘었습니다. 정리를 고려해 주세요.');

// 크기·수정시각이 같으면 그대로, 다르면 md5 로 실제 내용이 바뀌었는지 확인
const next = new Map(), todo = [];
for (const f of files) {
  const o = old.get(f.rel);
  if (o && o.size === f.size && o.mtime === f.mtime) { next.set(f.rel, o); continue; }
  const hash = md5(f.abs);
  if (o && o.hash === hash) { next.set(f.rel, { size: f.size, mtime: f.mtime, hash }); continue; }
  todo.push({ ...f, hash });
}
const gone = [...old.keys()].filter((k) => !files.some((f) => f.rel === k));
const save = () => fs.writeFileSync(MANIFEST, [...next].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}\t${v.size}\t${v.mtime}\t${v.hash}`).join('\n') + '\n');

console.log(`올릴 파일: ${todo.length}개 (${mb(todo.reduce((n, f) => n + f.size, 0))} MB) · 그대로: ${files.length - todo.length}개 · 로컬에서 지운 파일: ${gone.length}개`);
if (flag('--dry')) { todo.forEach((f) => console.log(`  + ${f.rel}`)); gone.forEach((g) => console.log(`  - ${g}`)); process.exit(0); }
if (flag('--init')) { todo.forEach((f) => next.set(f.rel, { size: f.size, mtime: f.mtime, hash: f.hash })); save(); console.log(`기록만 했습니다: ${MANIFEST}`); process.exit(0); }

const wrangler = (...a) => spawnSync('npx', ['wrangler', 'r2', 'object', ...a, '--remote'], { stdio: ['ignore', 'ignore', 'inherit'] }).status === 0;
let fail = 0;
todo.forEach((f, i) => {
  console.log(`[${i + 1}/${todo.length}] ${f.rel}`);
  const type = TYPES[path.extname(f.rel).toLowerCase()] ?? 'application/octet-stream';
  if (wrangler('put', `${bucket}/${f.rel}`, '--file', f.abs, '--content-type', type, '--cache-control', CACHE)) {
    next.set(f.rel, { size: f.size, mtime: f.mtime, hash: f.hash }); save(); // 중간에 멈춰도 올린 것까지는 기록
  } else { fail++; console.error(`  실패: ${f.rel}`); }
});
if (gone.length) {
  if (flag('--prune')) gone.forEach((g) => { console.log(`삭제: ${g}`); if (!wrangler('delete', `${bucket}/${g}`)) { fail++; next.set(g, old.get(g)); } });
  else { console.log('R2 에만 남아 있는 파일(로컬에서 지움). 지우려면 --prune 을 붙여 다시 실행하세요:'); gone.forEach((g) => { console.log(`  - ${g}`); next.set(g, old.get(g)); }); }
}
save();
console.log(fail ? `끝: 실패 ${fail}개. 다시 실행하면 실패한 것만 다시 올립니다.` : '완료');
process.exit(fail ? 1 : 0);
