import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ---- 공통 조각 ----------------------------------------------------------
const ratio = {
  width: z.number().int().positive(),
  height: z.number().int().positive(),
};

// 극단 비율 경고(9:21보다 길거나 3:1보다 넓음): 빌드는 막지 않고 경고만 남긴다.
function warnExtremeRatio(id: string, width: number, height: number) {
  const r = width / height;
  if (r < 9 / 21 || r > 3) {
    console.warn(`[ratio] ${id}: ${width}x${height} 은(는) 극단적인 비율입니다.`);
  }
}

// ---- 영상 작품 ---------------------------------------------------------
// content/works/<슬러그>/index.md
const clip = z.object({
  title: z.string(),
  video: z.string(), // media 기준 경로 예: clips/part1/clip-1.mp4
  해상도: z.string().optional(), // 예: 1280x720
  길이: z.number().optional(), // 초
  날짜: z.coerce.date().optional(),
  prompt: z.string().optional(), // 같은 폴더의 clip-N.txt 파일명 (있을 때만)
  refs: z.array(z.number().int()).optional(), // references[].no
});

const reference = z.object({
  no: z.number().int().positive(),
  name: z.string(),
  type: z.string(), // 소스 이미지·캐릭터·장소·효과·완성본·캐릭터 시트·스토리보드 …
  tool: z.string().optional(),
  image: z.string(),
  prompt: z.string().optional(),
  품질: z.string().optional(),
  해상도: z.string().optional(),
  비율: z.string().optional(),
  생성일: z.coerce.date().optional(),
  clip: z.number().int().optional(),
});

const works = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './content/works' }),
  schema: z
    .object({
      title: z.string(),
      date: z.coerce.date(),
      summary: z.string().default(''),
      model: z.array(z.string()).default([]), // 예: ["Veo 3.1"]
      tags: z.array(z.string()).default([]),
      featured: z.boolean().optional(),
      final: z.string().optional(), // 완성본 영상 (없으면 clips[0])
      finalLength: z.number().optional(), // 완성본 길이(초)
      poster: z.string(),
      ...ratio,
      references: z.array(reference).default([]),
      clips: z.array(clip).min(1),
    })
    .superRefine((v, ctx) => {
      warnExtremeRatio(v.title, v.width, v.height);
    }),
});

// ---- 이미지(화보) 작품 --------------------------------------------------
// content/images/<YYYYMMDD-NN>.md  (본문 = 프롬프트 전문, 없으면 비워 둠)
const images = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/images' }),
  schema: z
    .object({
      title: z.string(),
      image: z.string(),
      alt: z.string().optional(),
      ...ratio,
      tags: z.array(z.string()).default([]),
      model: z.string(),
      featured: z.boolean().optional(),
      품질: z.string().optional(),
      해상도: z.string().optional(),
      비율: z.string().optional(),
      생성일: z.coerce.date(),
      from: z.string().optional(), // 비어 있으면 독립 화보, 영상 슬러그면 영상 리소스
    })
    .superRefine((v, ctx) => {
      warnExtremeRatio(v.title, v.width, v.height);
    }),
});

export const collections = { works, images };
