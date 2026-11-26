# MADE.LOG

개인 AI 이미지·영상 작업물 아카이브 사이트. **프롬프트를 공유하는 사이트가 아니라 본인 작업물을 보관·전시하는 용도**라서 프롬프트는 있을 때만 보여 주는 선택 정보다. Astro 7 정적 사이트, 한국어 UI.

## 환경과 명령
- Mac, **Node 22.23.4 이상 필요**(Astro 7.4.13). 낮으면 먼저 Node를 올린다. 영상·이미지 처리에는 ffmpeg/ffprobe(libwebp, libx264)가 필요하다.
- `npm run dev` → http://localhost:4321 · `npm run build` · `npm run preview`
- `npm run new-work -- <작품 폴더> [--slug 이름] [--yes] [--force]` — 새 영상 작품 추가(아래 참고)
- `npm run sync-notion -- [--dry] [--force] [--photo=값]` — Notion DB의 이미지·프롬프트를 `content/images/`로 가져온다(아래 참고). 토큰은 `.env`의 `NOTION_TOKEN`(Git 제외, 채팅·로그에 출력 금지)
- 배포: Cloudflare Workers(정적 자산, `wrangler.jsonc`) → https://madelog.teentak.workers.dev. GitHub `TEENTAK/madelog`의 `main`에 push하면 Workers Builds가 `npm run build` → `npx wrangler deploy`를 자동 실행한다. 미디어는 R2 버킷 `madelog-media`(공개 개발 URL, 주소는 `.env.production`의 `PUBLIC_MEDIA_BASE_URL`)에서 불러온다. 도메인은 아직 없다(구입하면 R2 사용자 지정 도메인·Workers 도메인과 `astro.config.mjs`의 `site`, `.env.production`을 바꾼다).
- 미디어를 추가·변경하면 `npm run upload-media -- madelog-media`로 R2에 올린다(코드 push와 별개). 바뀐 파일만 올리며 기록은 `.r2-manifest-<버킷>.tsv`(Git 제외). `--dry`는 목록만, `--init`은 기록만(이미 다 올라가 있을 때 처음 한 번), `--prune`은 로컬에서 지운 파일을 R2에서도 지운다. 로컬에서 바로 배포할 때는 `npm run deploy`(빌드 후 `dist/media` 제거). 처음엔 `npx wrangler login`이 필요하다.
- 콘텐츠(`content/`)만 고쳐도 push해야 사이트에 반영된다.
- **R2 저장 용량은 9GB를 넘기지 않는다**(무료 한도 10GB-month, 초과 시 자동 과금). `scripts/upload-media.mjs`가 `media-local` 크기를 확인해 9GB 초과 시 중단하고 7.2GB 초과 시 경고한다. 영상·이미지를 크게 추가하기 전에 현재 용량을 먼저 알리고, 원본이 아닌 웹용 변환본만 올린다. `media-local`에서 지운 파일은 업로드 때 목록으로 알려 주고, `--prune`을 붙여야 R2에서도 지운다.

## 폴더 구조
```
content/works/<슬러그>/index.md   영상 작품(frontmatter + 제작기 본문), prompts/ 에 프롬프트 원문
content/images/<YYYYMMDD-NN>.md   이미지(화보) 1장 = 파일 1개 (본문 = 프롬프트 전문, 없으면 비움)
content/tags.yaml                 태그 사전: 장르 → 색 이름(없는 태그는 회색 tag--model)
media-local/                      Git 제외. R2 경로와 같은 구조. public/media 가 이 폴더를 가리킨다
src/content.config.ts             스키마(Zod). width/height 필수, 극단 비율은 빌드 경고만
src/lib/media.ts                  미디어 주소는 여기서만 만든다(PUBLIC_MEDIA_BASE_URL, 기본 /media)
src/styles/design-system.css      디자인 시스템 v0.8 — 캔버스와 같은 파일(캔버스는 이 파일을 업로드해 연결), 고치면 캔버스도 맞춘다
src/styles/pages.css              페이지 전용 배치 규칙
src/pages/                        / (전체) · /videos · /images · /p/<슬러그>
src/scripts/                      viewer.ts(공유 뷰어 모달) · hero-motion.ts(전체 탭 히어로) · image-list.ts(이미지 12개씩·필터)
scripts/sync-notion.mjs           Notion 동기화
```

## 원본과 새 작품 추가
- 원본은 `~/Documents/AI Creative-Storage/VIDEO`, `.../IMAGES`에 있다. 작품은 폴더 안에서 `clips/`(part1/ 등 하위 가능)·`refs/`·`prompts/`·`_archive/`·`_rename-map.tsv`로 정리한다. 삭제하지 않고 이동만 한다. `VIDEO/_TEST`는 보류분이라 무시한다.
- 폴더 이름은 영문 슬러그다(사이트 주소가 된다). 정리된 폴더를 `new-work`에 주면 `media-local/works/<슬러그>/`(clips, refs/*.webp, poster·thumb·preview, final.mp4)와 `content/works/<슬러그>/index.md` 초안이 만들어진다. `index.md`가 이미 있으면 덮어쓰지 않는다(`--force`로만).
- 초안의 모델·태그·한 줄 소개는 비어 있으니 직접 채운다. `.rtf` 프롬프트는 복사만 되고 텍스트 변환은 아직 안 했다.
- 현재 작품 4개: aeri-jealousy, owner-gets-fired, summer-festival-romance, toward-summer-sea (모델·태그·한 줄 소개 입력 완료).
- 이미지는 Notion에서 가져온다: `character` 사진 64장(`content/images/20261001-01..64.md`, 모델 GPT Image 2.0). 원본은 `originals/images/`, 변환본(webp ≤2048px)은 `media-local/images/<id>.webp`(둘 다 Git 제외). 매핑: 제목 `<모델> NN`, id `YYYYMMDD-NN`(KST 생성일), frontmatter에 `notion: <page id>`. 이미 있는 항목은 건너뛰며(`--force`여도 수동 제목·태그·featured 보존), 다른 사진 종류는 `--photo=값`으로 추가한다. 영상 리소스 이미지는 `from` 필드로 구분하고 기본 목록에서 제외한다.

## 확정된 결정
- 헤더 메뉴: 전체 / 영상 / 이미지. 푸터 이메일 teentak@gmail.com, 마퀴 모델명은 버전 없는 대표명만(`src/site.ts`: VEO, OMNI FLASH / GPT IMAGE, NANO BANANA). 작품 데이터 `model`에는 실제 버전을 적는다. About 페이지·이메일 수집·로그인·관리자 화면·다국어는 만들지 않는다.
- 디자인: 화이트·그레이·블랙, 포인트 컬러는 #e4f222, 포인트 위 가는 선은 `--primary-line`(#bcc631, 1px: 로고·eyebrow 점, 주 버튼 보더). 모델 태그와 장르 태그는 같은 폰트. 폰트 Pretendard / Inter Tight / Geist Mono. 태그는 파스텔.
- 영상 리스트는 줄맞춤(`.gal`), 한 번에 **8개씩** 더 보기. 전체 탭은 고정 3열 그리드(`.vgrid`, 16:9 상자 + 블러 여백). 이미지는 Pinterest식 masonry, 12개씩(첫 로드 후 한 번 자동, 이후 "더 보기" 버튼, 스켈레톤), 모델별 필터 칩, 리소스 포함 토글(리소스가 있을 때만 표시). `PAGE` 값은 `images/index.astro`와 `image-list.ts`가 같아야 한다.
- 전체 탭은 최신순 자동(영상 6·이미지 12) + `featured: true`는 앞에 고정. 필터는 주소(`?genre=`)에 반영, 검색은 제목·태그만.
- **NEW 태그는 쓰지 않는다**(삭제). 히어로의 `LATEST`/`FEATURED` 표시만 남긴다.
- **영상은 원본보다 크게 확대해 재생하지 않는다.** 영상 해상도는 대부분 720p급(720×1280 / 1280×720)이고 클립 길이는 대부분 6~10초다(30초 넘는 것도 일부 있음).
- 히어로 대표 영상: `featured: true`가 있으면 그것, 없으면 최신작. 원본은 1280×720으로 준비하고 표시는 좌우 배치를 유지한 채 컨테이너에 맞춰 약 720~800px. 기본 무음 + 소리 켜기 버튼, 모션이 꺼진 환경에서는 포스터 + 재생 버튼.
- 이미지 공유 미리보기(OG)는 필요 없고 `#해시` 주소만 쓴다. 영상 작품 상세(`/p/<슬러그>`)는 OG 이미지를 둔다.
- 상세 섹션 이름은 Making / References / Video Clip(Title Case), "비슷한 작품"은 없고 이전·다음 이동만 둔다.
- 이미지 모달과 영상 상세의 레퍼런스·클립은 공유 뷰어(`viewer.ts`)로 열고 `#해시`(`#clip-N`, `#ref-N`, 이미지는 `#<id>`)로 공유한다.
- 전체 탭 히어로는 `HERO-MOTION-SPEC.md`대로 스크롤 모션을 적용했다(`hero-motion.ts`). 1240px 미만·높이 640 미만·reduced-motion·Tab 키·인쇄에서는 끈다. 모바일 모션(명세 §10)은 미구현. "made." 아래 강조(`.mk`)는 제거했고, 숫자 카운터는 첫 로드 때 0에서 올라간다.

## 남은 작업
1. (완료) 프롬프트 `.txt` 변환과 클립 연결. `toward-summer-sea`는 원문이 없어 프롬프트·`refs`를 비워 둔다(원문이 생기면 `prompts/`에 넣고 클립에 `prompt`·`refs` 추가).
2. 모바일·태블릿 히어로 모션(명세 §10), 카운터 숫자별 시차.
3. 이미지가 늘면 태그 필터 줄 추가, 다른 Notion 사진 종류 가져오기(`--photo=`).
4. 도메인 구입 후 R2 사용자 지정 도메인(`r2.dev`은 요청 수 제한이 있어 임시용)과 사이트 주소로 교체. 휴대폰 화면 점검.
5. 캔버스의 푸터 이메일·마퀴 자리표시값을 실제 값으로 맞추기(선택).

## 작업 규칙
- 사용자는 한국어로 대화하고, 기술 용어는 영어를 병기하는 것을 선호한다. 풀이 과정은 짧게, 불확실하면 추측하지 말고 질문한다.
- 원본 폴더의 파일을 지우지 않는다. `content/`의 `index.md`를 사용자가 직접 고쳤을 수 있으니 덮어쓰지 않는다.
- 디자인 시스템 CSS를 고치면 캔버스(https://claude.ai/artifact/CxnTjqXNmwsRDjzBHkaEu9)의 연결 주소도 다시 맞춰야 하니, 고치기 전에 먼저 알린다.

## 보안·보호 (2026-11-24)
- `public/_headers`: 보안 헤더 + CSP(`script-src 'self'`). 외부 주소(폰트 CDN, R2 주소)를 새로 쓰면 CSP도 같이 고친다. **R2 사용자 지정 도메인으로 바꾸면 `img-src`·`media-src`의 `https://*.r2.dev`를 새 도메인으로 교체.** 인라인 스크립트는 쓰지 않는다(`public/hm-intro.js`처럼 파일로 둔다. `astro.config.mjs`의 `assetsInlineLimit: 0`이 작은 번들 스크립트의 인라인화를 막는다).
- 이미지·영상 우클릭/끌기 방지는 `src/scripts/protect.ts` + `pages.css` 끝부분. **억제용일 뿐 완전한 방어가 아니다**(미디어 주소가 공개라 개발자 도구로는 받을 수 있음). 모달은 프롬프트 영역(`.prompt`)만 텍스트 선택 가능.
- 파비콘: `public/favicon.svg|ico`, `apple-touch-icon.png`(검정 바탕 + 프라이머리 점).
