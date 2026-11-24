import { defineConfig } from 'astro/config';

// 정적 사이트. site 는 OG 절대 주소용이며, 도메인을 사면 바꾼다.
export default defineConfig({
  site: 'https://madelog.teentak.workers.dev',
  output: 'static',
  trailingSlash: 'ignore',
  // 작은 스크립트를 HTML에 인라인하지 않는다(CSP script-src 'self' 유지)
  vite: { build: { assetsInlineLimit: 0 } },
});
