// Notion "image prompt" DB → content/images/*.md + media-local/images/*.webp
//   npm run sync-notion                    character 행만 가져온다(이미 가져온 행은 건너뜀)
//   npm run sync-notion -- --photo=poster  다른 photo 값 가져오기
//   npm run sync-notion -- --dry           파일을 쓰지 않고 목록만 보기
//   npm run sync-notion -- --force         이미 가져온 행도 이미지·프롬프트를 다시 만든다(제목 등 손으로 고친 값은 유지)
// 토큰은 .env 의 NOTION_TOKEN (npm 스크립트가 --env-file=.env 로 읽는다)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';

const API = (process.env.NOTION_API_BASE ?? 'https://api.notion.com').replace(/\/$/, '');
const TOKEN = process.env.NOTION_TOKEN;
const DB = process.env.NOTION_DB ?? '38b6af0c174180ec9410d4f213459bf5';
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');
const PHOTO = opt('photo', 'character');
const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'content/images');
const MEDIA = path.join(ROOT, 'media-local/images');
const ORIG = path.join(ROOT, 'originals/images');

// Notion 값 → 사이트 값
const TOOL_NAME = { GPT: 'GPT Image 2.0', Gemini: 'Gemini', Grok: 'Grok', 'Google Flow': 'Google Flow' };
const PHOTO_TAG = { character: '캐릭터' };

if (!TOKEN || TOKEN.includes('여기에')) { console.error('NOTION_TOKEN 이 비어 있습니다. .env 를 확인하세요.'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function notion(p, body) {
  for (let t = 0; t < 5; t++) {
    const res = await fetch(API + p, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep((Number(res.headers.get('retry-after')) || 2) * 1000); continue; }
    if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await sleep(350); // 초당 3건 제한 여유
    return res.json();
  }
  throw new Error('Notion 요청이 계속 제한되었습니다(429).');
}

async function listAll(fn) {
  const out = []; let cursor;
  do { const r = await fn(cursor); out.push(...r.results); cursor = r.has_more ? r.next_cursor : undefined; } while (cursor);
  return out;
}

const plain = (rt = []) => rt.map((t) => t.plain_text).join('');
const TEXT_BLOCKS = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'quote', 'callout', 'bulleted_list_item', 'numbered_list_item', 'code'];
export function promptFrom(blocks) {
  return blocks
    .filter((b) => TEXT_BLOCKS.includes(b.type))
    .map((b) => { const s = plain(b[b.type].rich_text).trim(); return b.type === 'bulleted_list_item' && s ? `- ${s}` : s; })
    .filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function imageFrom(blocks) {
  const b = blocks.find((x) => x.type === 'image');
  if (!b) return null;
  return b.image.type === 'file' ? b.image.file.url : b.image.external.url;
}
const kstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function ratioLabel(w, h) {
  const r = w / h;
  for (const [a, b] of [[1, 1], [3, 4], [4, 3], [2, 3], [3, 2], [4, 5], [5, 4], [9, 16], [16, 9], [9, 21]]) if (Math.abs(r - a / b) < 0.02) return `${a}:${b}`;
  const g = gcd(w, h); return `${w / g}:${h / g}`;
}

// 이미 가져온 행(notion 필드)과 날짜별 번호 파악
fs.mkdirSync(CONTENT, { recursive: true }); fs.mkdirSync(MEDIA, { recursive: true }); fs.mkdirSync(ORIG, { recursive: true });
const known = new Map(); const maxNo = {};
for (const f of fs.readdirSync(CONTENT).filter((x) => x.endsWith('.md'))) {
  const id = f.replace(/\.md$/, ''); const txt = fs.readFileSync(path.join(CONTENT, f), 'utf8');
  const m = txt.match(/^notion:\s*["']?([0-9a-f-]+)["']?\s*$/m); if (m) known.set(m[1], id);
  const n = id.match(/^(\d{8})-(\d+)$/); if (n) maxNo[n[1]] = Math.max(maxNo[n[1]] ?? 0, +n[2]);
}

console.log(`Notion 조회: photo = ${PHOTO}`);
const rows = await listAll((cursor) => notion(`/v1/databases/${DB}/query`, {
  page_size: 100, start_cursor: cursor,
  filter: { property: 'photo', select: { equals: PHOTO } },
  sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
}));
console.log(`${rows.length}건 (이미 가져온 ${rows.filter((r) => known.has(r.id)).length}건)`);

const perModel = {}; let made = 0, skipped = 0, failed = 0;
for (const row of rows) {
  const props = row.properties;
  const models = (props.model?.multi_select ?? []).map((o) => o.name);
  const tools = (props.tool?.multi_select ?? []).map((o) => o.name);
  const wardrobe = (props.wardrobe?.multi_select ?? []).map((o) => o.name);
  const who = models[0] ?? 'Image';
  perModel[who] = (perModel[who] ?? 0) + 1;

  const existing = known.get(row.id);
  if (existing && !FORCE) { skipped++; continue; }

  const date = kstDate(row.created_time); const ymd = date.replaceAll('-', '');
  let id = existing;
  if (!id) { maxNo[ymd] = (maxNo[ymd] ?? 0) + 1; id = `${ymd}-${String(maxNo[ymd]).padStart(2, '0')}`; }
  const title = `${who} ${String(perModel[who]).padStart(2, '0')}`;
  if (DRY) { console.log(`  [dry] ${id}  ${title}`); continue; }

  try {
    const blocks = await listAll((cursor) => notion(`/v1/blocks/${row.id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`));
    const url = imageFrom(blocks); const prompt = promptFrom(blocks);
    if (!url) { console.warn(`  ! ${id}: 이미지 블록이 없어 건너뜁니다`); failed++; continue; }
    const res = await fetch(url); if (!res.ok) throw new Error(`이미지 다운로드 ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (path.extname(new URL(url).pathname) || '.png').toLowerCase();
    fs.writeFileSync(path.join(ORIG, `${id}${ext}`), buf);
    const { data, info } = await sharp(buf, { failOn: 'none' }).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(MEDIA, `${id}.webp`), data);

    const file = path.join(CONTENT, `${id}.md`);
    let fm = {
      title, image: `${id}.webp`, width: info.width, height: info.height,
      tags: [PHOTO_TAG[PHOTO] ?? PHOTO, ...models, ...wardrobe],
      model: tools.map((t) => TOOL_NAME[t] ?? t).join(' / ') || 'unknown',
      해상도: `${info.width}x${info.height}`, 비율: ratioLabel(info.width, info.height), 생성일: date, notion: row.id,
    };
    if (existing && fs.existsSync(file)) { // 다시 만들 때 손으로 고친 제목·태그는 유지
      const old = YAML.parse(fs.readFileSync(file, 'utf8').split('---')[1] ?? '') ?? {};
      fm = { ...fm, title: old.title ?? fm.title, tags: old.tags ?? fm.tags, featured: old.featured };
      if (fm.featured === undefined) delete fm.featured;
    }
    fs.writeFileSync(file, `---\n${YAML.stringify(fm, { lineWidth: 0 })}---\n\n${prompt}\n`);
    console.log(`  ✓ ${id}  ${title}  ${info.width}×${info.height}`);
    made++;
  } catch (e) { console.warn(`  ! ${id}: ${e.message}`); failed++; }
}
console.log(`\n완료: 새로 ${made}건, 건너뜀 ${skipped}건, 실패 ${failed}건${DRY ? ' (dry-run: 파일은 쓰지 않음)' : ''}`);
if (!DRY && made) console.log('다음: npm run dev 로 /images 와 / 에서 확인하세요.');
