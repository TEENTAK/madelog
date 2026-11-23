#!/bin/bash
# media-local/ 의 파일을 R2 버킷에 같은 경로로 올린다. 사용: npm run upload-media -- <버킷이름>
# 이미 올린 파일도 다시 올린다(덮어쓰기). 먼저 `npx wrangler login` 이 필요하다.
set -e
BUCKET="${1:?버킷 이름을 적어 주세요. 예: npm run upload-media -- madelog-media}"
cd "$(dirname "$0")/../media-local"
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
