// 미디어 주소는 이 파일 한 곳에서만 만든다.
// 로컬 개발: PUBLIC_MEDIA_BASE_URL 없음 → /media (public/media 가 media-local 을 가리킴)
// 공개 후:   PUBLIC_MEDIA_BASE_URL=https://<커스텀 도메인 또는 R2 주소>
const base = (import.meta.env.PUBLIC_MEDIA_BASE_URL ?? '/media').replace(/\/$/, '');

export const mediaUrl = (path: string) => `${base}/${path.replace(/^\//, '')}`;

// works/<슬러그>/ 아래 R2 경로 규칙
export const workMedia = (slug: string, file: string) => mediaUrl(`works/${slug}/${file}`);
