// 전체 탭 대표 영상: 화면에 보이면 무음 자동재생, 영상 영역을 누르면 재생/일시정지, 소리 켜기 버튼.
// 모션 줄이기 설정·데이터 절약 모드에서는 자동재생하지 않고 포스터 + 재생 버튼(누르면 재생)으로 둔다.
export function initHeroVideo() {
  const box = document.querySelector<HTMLElement>('[data-hero-video]');
  const video = box?.querySelector<HTMLVideoElement>('video.hero-video');
  if (!box || !video) return;
  const toggle = box.querySelector<HTMLButtonElement>('[data-hv="toggle"]')!;
  const sound = box.querySelector<HTMLButtonElement>('[data-hv="sound"]');
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  let held = rm.matches || saveData; // true = 사용자가 멈췄거나 자동재생을 하지 않는 상태
  let visible = false;

  const load = () => {
    if (video.src) return;
    video.src = video.dataset.src!;
    video.addEventListener('playing', () => video.classList.add('on'), { once: true });
  };
  const ui = () => {
    const playing = !video.paused;
    box.classList.toggle('is-playing', playing);
    toggle.setAttribute('aria-label', playing ? '대표 영상 일시정지' : '대표 영상 재생');
    if (sound) {
      const label = video.muted ? '소리 켜기' : '소리 끄기';
      sound.setAttribute('aria-pressed', String(!video.muted));
      sound.setAttribute('aria-label', label); sound.title = label;
      sound.classList.toggle('on', !video.muted);
    }
  };
  const sync = () => {
    if (visible && !held && !document.hidden) {
      load();
      // 자동재생이 막히면(저전력 모드 등) 재생 버튼을 보여 준다
      video.play().catch(() => { held = true; ui(); });
    } else video.pause();
  };

  video.addEventListener('play', ui);
  video.addEventListener('pause', ui);
  video.addEventListener('volumechange', ui);
  toggle.addEventListener('click', () => { held = !video.paused; if (!held) visible = true; sync(); });
  sound?.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.paused) { held = false; visible = true; sync(); } // 소리를 켜면 멈춰 있어도 재생
    ui();
  });
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(box);
  document.addEventListener('visibilitychange', sync);
  rm.addEventListener('change', () => { if (rm.matches) { held = true; sync(); } });
  ui();
}
