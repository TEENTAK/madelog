// 공용 뷰어 모달. 한 겹 = Layer 하나. 여러 겹(클립 위에 이미지)은 스택으로 관리한다.
export type VItem = {
  kind: 'image' | 'video';
  title: string;
  label: string; // 종류 태그 옆 보조 태그 (예: 캐릭터 시트, 생성 결과)
  src: string;
  prompt?: string;
  details: [string, string][];
  refs?: { no: number; name: string; src: string }[]; // 영상일 때 사용한 레퍼런스
  source?: { href: string; label: string }; // 영상 리소스 이미지의 출처 영상
};

export type OpenOpts = {
  counter?: (i: number, n: number) => string; // 기본 "N / M"
  strip?: boolean; // 썸네일 줄 (이미지 + 항목 2개 이상)
  onNavigate?: (i: number) => void; // 화살표·썸네일로 이동했을 때
  onRef?: (no: number) => void; // 클립 모달의 레퍼런스 썸네일 클릭
  onClose?: () => void; // 사용자가 닫았을 때(✕, Esc, 바깥)
};

const stack: Layer[] = [];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 닫힘 애니메이션 길이: pages.css .mv-dim 의 transition 값을 읽는다(값을 두 곳에 적지 않게)
const outMs = (el: HTMLElement) => (parseFloat(getComputedStyle(el).transitionDuration) || 0) * 1000;
const sync = () => { document.body.style.overflow = stack.length ? 'hidden' : ''; };

export class Layer {
  root: HTMLElement;
  dialog: HTMLElement;
  items: VItem[] = [];
  cur = 0;
  opts: OpenOpts = {};
  opener: HTMLElement | null = null;
  isOpen = false;
  private outTimer = 0;
  private q = (n: string) => this.root.querySelector<HTMLElement>(`[data-v="${n}"]`)!;

  constructor(root: HTMLElement) {
    this.root = root;
    this.dialog = root.querySelector<HTMLElement>('[role=dialog]')!;
    this.q('close').addEventListener('click', () => this.requestClose());
    root.addEventListener('click', (e) => { if (e.target === root) this.requestClose(); });
    this.bindSwipe();
    this.q('prev').addEventListener('click', () => this.go(this.cur - 1));
    this.q('next').addEventListener('click', () => this.go(this.cur + 1));
    const more = this.q('more');
    more.addEventListener('click', () => this.clamp(more.getAttribute('aria-expanded') === 'true'));
    // 접힌 미리보기를 눌러도 펼친다
    this.q('acc-body').addEventListener('click', () => { if (this.q('pf').classList.contains('is-clamp')) this.clamp(false); });
    const copy = this.q('copy');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(this.items[this.cur].prompt ?? ''); copy.textContent = '복사했습니다'; }
      catch { copy.textContent = '복사하지 못했습니다'; }
      setTimeout(() => (copy.textContent = '복사'), 1800);
    });
  }

  // 터치: 좌우로 밀면 이전·다음, 아래로 끌면 닫기(영상 조작 막대 위에서는 무시)
  private bindSwipe() {
    const area = this.root.querySelector<HTMLElement>('.viewer'); if (!area) return;
    let x0 = 0, y0 = 0, on = false;
    area.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || (e.target as Element).closest('video, button')) { on = false; return; }
      on = true; x0 = e.clientX; y0 = e.clientY;
    });
    area.addEventListener('pointerup', (e) => {
      if (!on) return; on = false;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) this.go(this.cur + (dx < 0 ? 1 : -1));
      else if (dy > 90 && dy > Math.abs(dx) * 1.3) this.requestClose();
    });
    area.addEventListener('pointercancel', () => { on = false; });
  }

  requestClose() { this.opts.onClose ? this.opts.onClose() : this.close(); }

  go(i: number) {
    if (i < 0 || i >= this.items.length || i === this.cur) return;
    this.show(i);
    this.opts.onNavigate?.(i);
  }

  open(items: VItem[], i: number, opts: OpenOpts = {}, opener?: HTMLElement | null) {
    this.items = items; this.opts = opts;
    if (!this.isOpen) {
      this.opener = opener ?? (document.activeElement as HTMLElement | null);
      clearTimeout(this.outTimer); this.root.classList.remove('is-in');
      this.isOpen = true; this.root.hidden = false; stack.push(this); sync();
      // 다음 프레임에 is-in → 배경 페이드 + 창이 살짝 떠오르며 열림(모바일은 아래에서 올라옴)
      requestAnimationFrame(() => requestAnimationFrame(() => this.root.classList.add('is-in')));
      this.dialog.focus();
    }
    this.buildStrip();
    this.show(i);
  }

  close(restoreFocus = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    (this.q('video') as HTMLVideoElement).pause();
    this.root.classList.remove('is-in');
    clearTimeout(this.outTimer);
    if (reduced()) this.root.hidden = true;
    else this.outTimer = window.setTimeout(() => { if (!this.isOpen) this.root.hidden = true; }, outMs(this.root));
    const k = stack.indexOf(this); if (k >= 0) stack.splice(k, 1); sync();
    if (restoreFocus) this.opener?.focus();
  }

  // 프롬프트 아코디언: 접힘 = 4줄 미리보기(CSS max-height), 펼침 = 실제 높이까지 열리는 애니메이션
  private clamp(on: boolean) {
    const pf = this.q('pf'), body = this.q('acc-body');
    pf.classList.toggle('is-clamp', on);
    pf.classList.toggle('is-open', !on);
    this.q('more').setAttribute('aria-expanded', String(!on));
    if (on) {
      // 'none'(펼침 완료)에서 접을 때도 움직이도록 현재 높이를 먼저 고정한 뒤 해제
      if (body.style.maxHeight === 'none') { body.style.maxHeight = `${body.scrollHeight}px`; void body.offsetHeight; }
      body.style.maxHeight = '';
    } else {
      body.style.maxHeight = `${body.scrollHeight}px`;
      // 다 열리면 높이 제한을 풀어 창 크기가 바뀌어도 잘리지 않게(애니메이션이 끝난 시점 = transitionend)
      body.addEventListener('transitionend', () => { if (pf.classList.contains('is-open')) body.style.maxHeight = 'none'; }, { once: true });
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) body.style.maxHeight = 'none';
    }
  }

  private buildStrip() {
    const strip = this.q('strip'); strip.innerHTML = '';
    const on = !!this.opts.strip && this.items.length > 1 && this.items.every((x) => x.kind === 'image');
    strip.hidden = !on;
    if (!on) return;
    this.items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'strip-btn'; b.setAttribute('aria-label', `${i + 1}번째`);
      const im = document.createElement('img'); im.src = it.src; im.alt = ''; im.loading = 'lazy';
      b.appendChild(im); b.addEventListener('click', () => this.go(i)); strip.appendChild(b);
    });
  }

  show(i: number) {
    this.cur = i; const it = this.items[i]; const n = this.items.length;
    const img = this.q('img') as HTMLImageElement, vid = this.q('video') as HTMLVideoElement;
    if (it.kind === 'image') {
      vid.pause(); vid.removeAttribute('src'); vid.hidden = true;
      img.hidden = false; img.alt = it.title;
      // 이미지 바꿀 때 크로스페이드: 새 이미지가 도착하면 나타난다
      if (img.getAttribute('src') !== it.src) {
        img.classList.add('is-loading');
        img.onload = img.onerror = () => img.classList.remove('is-loading');
        img.src = it.src;
      }
    } else {
      img.hidden = true; vid.hidden = false; vid.src = it.src; vid.load();
    }
    this.q('title').textContent = it.title;
    this.q('kind').textContent = it.kind === 'image' ? '이미지' : '영상';
    const label = this.q('label'); label.textContent = it.label; label.hidden = !it.label;
    (this.q('prev') as HTMLElement).hidden = n < 2 || i === 0;
    (this.q('next') as HTMLElement).hidden = n < 2 || i === n - 1;
    const count = this.q('count'); count.hidden = n < 2;
    count.textContent = (this.opts.counter ?? ((a, b) => `${a} / ${b}`))(i + 1, n);
    [...this.q('strip').children].forEach((c, k) => c.setAttribute('aria-current', String(k === i)));

    // REFERENCES (클립)
    const rw = this.q('refs-wrap'), rl = this.q('refs'); rl.innerHTML = '';
    rw.hidden = !it.refs?.length;
    it.refs?.forEach((r) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ref'; b.setAttribute('aria-label', `레퍼런스 ${r.no} ${r.name}`);
      b.innerHTML = '<div class="rimg"><span class="bd bd--sm"></span><img alt="" loading="lazy"></div><div class="ref-name"></div>';
      b.querySelector('.bd')!.textContent = String(r.no);
      b.querySelector('img')!.src = r.src;
      b.querySelector('.ref-name')!.textContent = r.name;
      b.addEventListener('click', () => this.opts.onRef?.(r.no));
      rl.appendChild(b);
    });

    // PROMPT (있을 때만, 이미지는 기본 접힘)
    const pw = this.q('prompt-wrap'); pw.hidden = !it.prompt;
    if (it.prompt) {
      const pf = this.q('pf'), more = this.q('more') as HTMLButtonElement;
      this.q('prompt').textContent = it.prompt;
      pf.classList.remove('is-clamp', 'is-open'); this.q('acc-body').style.maxHeight = '';
      // 이미지의 긴 프롬프트만 접는다. 짧거나 영상 클립이면 펼친 채 고정(토글 없음)
      const acc = it.kind === 'image' && this.q('prompt').scrollHeight > 4 * 22 + 24;
      pf.classList.toggle('acc--static', !acc);
      more.disabled = !acc;
      if (acc) this.clamp(true); else more.removeAttribute('aria-expanded');
    }

    // DETAILS
    const det = this.q('details'); det.innerHTML = '';
    const rows: [string, string, string?][] = [...(it.source ? [['출처 영상', it.source.label, it.source.href] as [string, string, string]] : []), ...it.details.map((d) => [d[0], d[1]] as [string, string])];
    rows.filter((r) => r[1]).forEach(([k, v, href]) => {
      const row = document.createElement('div'); row.className = 'drow';
      const a = document.createElement('span'); a.textContent = k;
      let b: HTMLElement;
      if (href) { b = document.createElement('a'); (b as HTMLAnchorElement).href = href; b.textContent = `${v} ↗`; }
      else { b = document.createElement('b'); b.textContent = v; }
      row.append(a, b); det.appendChild(row);
    });
  }
}

// 가장 위 겹에만 키보드 적용
document.addEventListener('keydown', (e) => {
  const top = stack[stack.length - 1]; if (!top) return;
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement instanceof HTMLVideoElement) return;
  if (e.key === 'Escape') { e.preventDefault(); top.requestClose(); }
  else if (e.key === 'ArrowLeft') top.go(top.cur - 1);
  else if (e.key === 'ArrowRight') top.go(top.cur + 1);
  else if (e.key === 'Tab') {
    const f = [...top.dialog.querySelectorAll<HTMLElement>('button, a[href], video[controls]')].filter((x) => !x.hidden && !x.closest('[hidden]'));
    if (!f.length) return; const a = f[0], z = f[f.length - 1], cur = document.activeElement;
    if (e.shiftKey && (cur === a || cur === top.dialog)) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && cur === z) { e.preventDefault(); a.focus(); }
  }
});
