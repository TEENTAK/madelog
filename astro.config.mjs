import { defineConfig } from 'astro/config';

// 정적 사이트. 배포 주소가 정해지면 site 를 채운다(OG·sitemap 용).
export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
});
