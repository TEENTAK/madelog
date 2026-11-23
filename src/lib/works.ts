import { getCollection, type CollectionEntry } from 'astro:content';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { workMedia } from './media';

export type Work = CollectionEntry<'works'>;

// 태그 사전: content/tags.yaml 의 genres (장르 → 색 이름). 없는 태그는 회색 모델 태그.
const dict = yaml.parse(fs.readFileSync(path.resolve('content/tags.yaml'), 'utf8')) as { genres: Record<string, string> };
export const tagClass = (tag: string) => (dict.genres[tag] ? `tag--${dict.genres[tag]}` : 'tag--model');

export const fmtDate = (d: Date) => d.toISOString().slice(0, 10).replaceAll('-', '.');
export const fmtDur = (sec: number) => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export async function getWorks(): Promise<Work[]> {
  const all = await getCollection('works');
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.data.title.localeCompare(b.data.title, 'ko'));
}

// 카드의 길이 배지: 완성본이 있으면 완성본 길이(finalLength), 없으면 첫 클립
export const totalDuration = (w: Work) => w.data.clips.reduce((n, c) => n + (c.길이 ?? 0), 0);
export const cardDuration = (w: Work) => (w.data.final ? (w.data.finalLength ?? totalDuration(w)) : (w.data.clips[0].길이 ?? 0));

export const posterUrl = (w: Work) => workMedia(w.id, w.data.poster);
export const thumbUrl = (w: Work) => workMedia(w.id, 'thumb.webp');
export const previewUrl = (w: Work) => workMedia(w.id, 'preview.mp4');
export const ratioOf = (w: Work) => w.data.width / w.data.height;

// featured 가 있으면 그 작품, 없으면 최신작
export const pickFeatured = (works: Work[]) => works.find((w) => w.data.featured) ?? works[0];
