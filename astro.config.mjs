import { defineConfig } from 'astro/config';

// 정적 사이트. site 는 OG 절대 주소용이며, 도메인을 사면 바꾼다.
export default defineConfig({
  site: 'https://madelog.teentak.workers.dev',
  output: 'static',
  trailingSlash: 'ignore',
});
