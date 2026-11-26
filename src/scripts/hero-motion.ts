// 전체 탭 히어로 스크롤 모션. 라이브러리 없이 scroll + requestAnimationFrame만 쓴다. 값은 HERO-MOTION-SPEC.md 6절.
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const WORDS = [
  { x: -72, y: -40, r: -4 },
  { x: -44, y: 36, r: 3 },
  { x: -96, y: 70, r: -6 },
];
const COL = 432; // CSS --col-w 와 같은 값(영상 창이 왼쪽 열 폭만큼 이동)

// 카운터: 첫 로딩 때 0부터 채운다(모션 줄이기 설정이면 최종값 그대로)
function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nums = document.querySelectorAll<HTMLElement>('.hero-home .stats dd');
  nums.forEach((el, i) => {
    const to = parseInt(el.textContent || '0', 10);
    if (!to) return;
    el.textContent = '0';
    const delay = 500 + i * 80, dur = 1100;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const t = clamp((now - t0) / dur);
      el.textContent = String(Math.round(to * easeOut(t)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function initHeroMotion() {
  countUp();
  const track = document.querySelector<HTMLElement>('[data-motion]');
  const stage = track?.querySelector<HTMLElement>('.motion-stage');
  if (!track || !stage) return;
  const q = <T extends HTMLElement>(k: string) => track.querySelector<T>(`[data-l="${k}"]`);
  const L = {
    eyebrow: q('eyebrow'), sub: q('sub'), stats: q('stats'), vwin: q('vwin'), info: q('info'), cue: q('cue'),
    ghost: track.querySelector<HTMLElement>('.hero-ghost'),
    words: [q('w0'), q('w1'), q('w2')],
  };

  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width:1240px)');
  let tabbed = false, enabled = false, printing = false, p = 0, raf = 0;

  const canRun = () => !rm.matches && wide.matches && innerHeight >= 640 && !tabbed && !printing;
  const all = () => [L.eyebrow, L.sub, L.stats, L.vwin, L.info, L.cue, L.ghost, ...L.words].filter(Boolean) as HTMLElement[];
  const put = (el: HTMLElement | null, tx = 0, ty = 0, rot = 0, op = 1, sc = 1) => {
    if (!el) return;
    el.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0)${rot ? ` rotate(${rot.toFixed(2)}deg)` : ''}${sc !== 1 ? ` scale(${sc.toFixed(3)})` : ''}`;
    el.style.opacity = op.toFixed(3);
  };
  const setInert = (el: HTMLElement | null, on: boolean) => { if (el) el.toggleAttribute('inert', on); };

  function render() {
    // 0 ~ 0.15 ↓ cue / ghost 등장
    const cue = smooth(seg(p, 0, 0.15));
    put(L.cue, 0, 0, 0, 1 - cue);
    const gIn = smooth(seg(p, 0, 0.15)), gOut = smooth(seg(p, 0.5, 0.75));
    put(L.ghost, -innerWidth * 0.08 * gOut, 0, 0, gIn * (1 - gOut), 0.9 + 0.1 * gIn);
    // 0.05 ~ 0.45 헤드라인 분해
    const w = smooth(seg(p, 0.05, 0.45));
    L.words.forEach((el, i) => put(el, WORDS[i].x * w, WORDS[i].y * w, WORDS[i].r * w, 1 - w));
    // 0.05 ~ 0.3 설명 · eyebrow
    const t = smooth(seg(p, 0.05, 0.3));
    put(L.sub, 0, -36 * t, 0, 1 - t);
    put(L.eyebrow, 0, -36 * t, 0, 1 - t);
    // 0.1 ~ 0.4 카운터
    const s = smooth(seg(p, 0.1, 0.4));
    put(L.stats, 0, 44 * s, 0, 1 - s);
    setInert(L.stats, s > 0.5);
    // 0.1 ~ 0.6 영상 창: 크기 그대로, 이동만(그림자만 강해짐)
    const v = smooth(seg(p, 0.1, 0.6));
    put(L.vwin, -COL * v, 30 * v, 0, 1);
    if (L.vwin) L.vwin.style.boxShadow = `0 ${24 + 10 * v}px ${60 + 30 * v}px rgba(0,0,0,${(0.17 + 0.1 * v).toFixed(3)})`;
    // 0.62 ~ 0.9 작품 정보
    const i = easeOut(seg(p, 0.62, 0.9));
    put(L.info, 0, 65 * (1 - i), 0, i);
    setInert(L.info, i < 0.5);
  }

  function target() {
    const top = parseFloat(getComputedStyle(stage!).top) || 0;
    const raw = (top - track!.getBoundingClientRect().top) / Math.max(1, track!.offsetHeight - stage!.offsetHeight);
    return clamp(raw / 0.9);
  }
  function tick() {
    raf = 0;
    if (!enabled) return;
    const tg = target();
    p += (tg - p) * 0.12;
    if (Math.abs(tg - p) < 0.0005) p = tg;
    render();
    if (p !== tg) raf = requestAnimationFrame(tick);
  }
  const schedule = () => { if (enabled && !raf) raf = requestAnimationFrame(tick); };

  function enable() {
    if (enabled) return;
    enabled = true;
    track!.classList.add('is-motion-enabled');
    p = target(); // 중간에서 시작해도(새로고침·뒤로 가기) 튀지 않게 바로 맞춘다
    render();
  }
  function disable() {
    if (!enabled) return;
    enabled = false;
    cancelAnimationFrame(raf); raf = 0;
    track!.classList.remove('is-motion-enabled');
    all().forEach((el) => { el.style.transform = ''; el.style.opacity = ''; el.style.boxShadow = ''; el.removeAttribute('inert'); });
  }
  const evaluate = () => (canRun() ? enable() : disable());

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', () => { evaluate(); if (enabled) { p = target(); render(); } }, { passive: true });
  addEventListener('keydown', (e) => { if (e.key === 'Tab' && !tabbed) { tabbed = true; evaluate(); } });
  addEventListener('beforeprint', () => { printing = true; evaluate(); });
  addEventListener('afterprint', () => { printing = false; evaluate(); });
  rm.addEventListener('change', evaluate);
  wide.addEventListener('change', evaluate);
  evaluate();
}
