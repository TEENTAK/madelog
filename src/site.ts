// 사이트 공통 설정. 값이 정해지면 여기서만 바꾼다.
export const site = {
  name: 'MADE.LOG',
  email: 'teentak@gmail.com',
  description: '만든 것의 기록. AI로 만든 영상과 이미지를 모았습니다.',
  // 공개 주소가 정해지면 astro.config.mjs 의 site 와 함께 채운다 (OG 이미지 절대 주소용)
  models: {
    video: ['VEO', 'OMNI FLASH'],
    image: ['GPT IMAGE', 'NANO BANANA'],
  },
};

// 목록에서 한 번에 여는 개수. 페이지(.astro)와 스크립트가 이 값을 같이 쓴다
export const PAGE_SIZE = { video: 8, image: 12 } as const;
