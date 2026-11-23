#!/bin/bash
# media-local/ 의 파일을 R2 버킷에 같은 경로로 올린다. 사용: npm run upload-media -- <버킷이름>
# 이미 올린 파일도 다시 올린다(덮어쓰기). 먼저 `npx wrangler login` 이 필요하다.
set -e
BUCKET="${1:?버킷 이름을 적어 주세요. 예: npm run upload-media -- madelog-media}"
cd "$(dirname "$0")/../media-local"
# R2 무료 한도는 10GB-month(초과 시 자동 과금). 9GB 를 넘기지 않도록 올리기 전에 크기를 확인한다.
# media-local 은 R2 에 올리는 내용 전부라서, 이 폴더 크기가 곧 올린 뒤의 R2 사용량(상한)이다.
LIMIT_KB=$((9 * 1024 * 1024)); WARN_KB=$((LIMIT_KB * 8 / 10))
SIZE_KB=$(find . -type f ! -name .DS_Store -print0 | xargs -0 du -ck | tail -1 | cut -f1)
echo "올릴 용량: $((SIZE_KB / 1024)) MB / 한도 9216 MB"
if [ "$SIZE_KB" -gt "$LIMIT_KB" ]; then
  echo "중단: 9GB 를 넘습니다. 안 쓰는 파일을 media-local 에서 줄인 뒤 다시 실행해 주세요." >&2; exit 1
fi
[ "$SIZE_KB" -gt "$WARN_KB" ] && echo "주의: 한도의 80% 를 넘었습니다. 정리를 고려해 주세요."
n=0; total=$(find . -type f ! -name .DS_Store | wc -l | tr -d ' ')
find . -type f ! -name .DS_Store | sed 's|^\./||' | sort | while read -r f; do
  n=$((n+1))
  case "$f" in
    *.webp) ct=image/webp;; *.jpg|*.jpeg) ct=image/jpeg;; *.png) ct=image/png;;
    *.mp4) ct=video/mp4;; *.txt) ct=text/plain;; *) ct=application/octet-stream;;
  esac
  echo "[$n/$total] $f"
  npx wrangler r2 object put "$BUCKET/$f" --file "$f" --content-type "$ct" --cache-control "public, max-age=86400" --remote >/dev/null
done
echo "완료"
