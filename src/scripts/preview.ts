// 카드에 마우스를 올리면 짧은 미리보기(preview.mp4, 무음)를 재생한다. 터치 기기는 정지 이미지 그대로.
const canHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function bindPreview(scope: ParentNode = document) {
  if (!canHover || reduced) return;
  scope.querySelectorAll<HTMLElement>('[data-card][data-preview]').forEach((card) => {
    if (card.dataset.previewBound) return;
    card.dataset.previewBound = '1';
    let video: HTMLVideoElement | null = null;
    let timer = 0;
    const stop = () => { clearTimeout(timer); video?.remove(); video = null; };
    // 마우스가 그리드를 지나가기만 할 때는 받지 않도록 150ms 머문 뒤 시작
    card.addEventListener('pointerenter', () => { clearTimeout(timer); timer = window.setTimeout(start, 150); });
    const start = () => {
      const media = card.querySelector('.media');
      if (!media || video) return;
      video = document.createElement('video');
      video.src = card.dataset.preview!;
      video.disablePictureInPicture = true; video.disableRemotePlayback = true;
      video.muted = true; video.loop = true; video.playsInline = true; video.autoplay = true;
      video.setAttribute('aria-hidden', 'true');
      video.addEventListener('error', stop);
      media.prepend(video);
      video.play().catch(stop);
    };
    card.addEventListener('pointerleave', stop);
    card.addEventListener('focusout', stop);
  });
}
