// 이미지 목록: 12개씩 열기(처음 한 번은 자동, 이후 "더 보기"), 모델·태그 필터, 검색(제목·태그), 정렬, 영상 리소스 포함 스위치.
// 타일은 모두 HTML에 들어 있고 hidden 으로 숨겨져 있다. 보이는 묶음이 바뀔 때마다 열 4개에 순서대로 다시 나눠 담는다.
const PAGE = 12; // pages/images/index.astro 의 PAGE 와 같은 값

export function initImageList() {
  const masonry = document.querySelector<HTMLElement>('[data-masonry]');
  const more = document.querySelector<HTMLElement>('[data-more]');
  const sentinel = document.querySelector<HTMLElement>('[data-sentinel]');
  if (!masonry || !more || !sentinel) return null;
  const cols = [...masonry.querySelectorAll<HTMLElement>('.mc')];
  const tiles = [...masonry.querySelectorAll<HTMLElement>('[data-tile]')].sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-model-chip]')];
  const tagChips = [...document.querySelectorAll<HTMLButtonElement>('[data-tag-chip]')];
  const sw = document.querySelector<HTMLButtonElement>('[data-res-switch]');
  const search = document.querySelector<HTMLInputElement>('[data-search]');
  const sortBtn = document.querySelector<HTMLButtonElement>('[data-sort]');
  const emptyMark = document.querySelector<HTMLElement>('[data-empty]');
  // 정렬을 바꿔도 모달의 이전·다음 순서가 화면과 같도록 data-order 를 다시 매긴다(최신순 = 원래 값)
  const base = new Map(tiles.map((t) => [t, Number(t.dataset.order)]));
  const last = Math.max(...base.values());

  let model = '', tag = '', q = '', desc = true, withRes = false, shown = PAGE;

  // 필터·검색·정렬은 주소에 남긴다(?model=&tag=&q=&sort=old&res=1). 새로고침·공유해도 같은 목록
  const params = new URLSearchParams(location.search);
  const known = (list: HTMLButtonElement[], key: 'modelChip' | 'tagChip', v: string | null) => (v && list.some((c) => c.dataset[key] === v) ? v : '');
  model = known(chips, 'modelChip', params.get('model'));
  tag = known(tagChips, 'tagChip', params.get('tag'));
  q = params.get('q') ?? '';
  desc = params.get('sort') !== 'old';
  withRes = !!sw && params.get('res') === '1';
  const syncUrl = () => {
    const u = new URL(location.href);
    const set = (k: string, v: string) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set('model', model); set('tag', tag); set('q', q.trim()); set('sort', desc ? '' : 'old'); set('res', withRes ? '1' : '');
    if (u.href !== location.href) history.replaceState(history.state, '', u);
  };
  const paint = () => {
    chips.forEach((c) => { const on = (c.dataset.modelChip ?? '') === model; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
    tagChips.forEach((c) => { const on = (c.dataset.tagChip ?? '') === tag; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
    sw?.setAttribute('aria-checked', String(withRes));
    if (search && search.value !== q) search.value = q;
    tiles.forEach((t) => { t.dataset.order = String(desc ? base.get(t)! : last - base.get(t)!); });
    if (sortBtn) sortBtn.textContent = desc ? '최신순 ↓' : '오래된순 ↑';
  };
  let autoPending = true, busy = false, failed: HTMLElement[] = [];

  const hit = (t: HTMLElement) => {
    const n = q.trim().toLowerCase();
    return !n || (t.dataset.title ?? '').toLowerCase().includes(n) || (t.dataset.tags ?? '').toLowerCase().includes(n);
  };
  const matching = () => tiles.filter((t) => (!t.dataset.res || withRes) && (!model || t.dataset.model === model) && (!tag || (t.dataset.tags ?? '').split('|').includes(tag)) && hit(t))
    .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
  const imgOf = (t: HTMLElement) => t.querySelector<HTMLImageElement>('img')!;

  function layout() {
    syncUrl();
    const vis = matching().slice(0, shown);
    tiles.forEach((t) => { t.hidden = true; });
    vis.forEach((t, i) => { t.hidden = false; cols[i % cols.length].appendChild(t); });
    setState();
  }

  // 새로 열린 타일은 이미지가 올 때까지 회색 shimmer. 모두 도착하면 버튼 상태를 되돌린다
  function watch(list: HTMLElement[]) {
    const waiting = list.filter((t) => { const i = imgOf(t); return !(i.complete && i.naturalWidth); });
    if (!waiting.length) return;
    busy = true; failed = []; setState();
    let left = waiting.length;
    const done = (t: HTMLElement, ok: boolean) => {
      t.classList.remove('sk'); if (!ok) failed.push(t);
      if (--left === 0) { busy = false; setState(); }
    };
    waiting.forEach((t) => {
      const img = imgOf(t); t.classList.add('sk'); img.loading = 'eager';
      img.addEventListener('load', () => done(t, true), { once: true });
      img.addEventListener('error', () => done(t, false), { once: true });
    });
    setTimeout(() => { if (left > 0) { left = 0; waiting.forEach((t) => t.classList.remove('sk')); busy = false; setState(); } }, 15000);
  }

  function loadMore() {
    if (busy) return;
    const before = Math.min(shown, matching().length);
    shown += PAGE; layout();
    watch(matching().slice(before, shown));
  }

  function setState() {
    const total = matching().length, remaining = Math.max(0, total - shown);
    more.innerHTML = '';
    if (busy) {
      more.innerHTML = '<button type="button" class="chip" aria-busy="true">불러오는 중…</button>';
    } else if (failed.length) {
      more.innerHTML = '<p class="more-note">불러오지 못했어요. 네트워크를 확인해 주세요.</p><button type="button" class="chip on" data-retry>다시 시도</button>';
    } else if (remaining > 0 && !autoPending) {
      more.innerHTML = `<button type="button" class="chip chip--primary" data-more-btn>더 보기 <small>+${Math.min(PAGE, remaining)}</small></button>`;
    } else if (remaining === 0 && total > PAGE) {
      more.innerHTML = `<div class="end">ALL ${total} STILLS LOADED</div><button type="button" class="chip" data-top>맨 위로 ↑</button>`;
    }
    more.hidden = !more.innerHTML;
    if (emptyMark) emptyMark.hidden = total > 0;
  }

  more.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-more-btn]')) loadMore();
    else if (t.closest('[data-top]')) window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    else if (t.closest('[data-retry]')) {
      const list = failed; failed = [];
      list.forEach((tile) => { const i = imgOf(tile); const s = i.src; i.removeAttribute('src'); i.src = s; });
      watch(list);
    }
  });

  function setModel(m: string) {
    model = m; shown = PAGE; paint();
    layout(); watch(matching().slice(0, shown));
  }
  chips.forEach((c) => c.addEventListener('click', () => setModel(c.dataset.modelChip ?? '')));
  search?.addEventListener('input', () => {
    q = search.value; shown = PAGE;
    layout(); watch(matching().slice(0, shown));
  });
  function setSort(d: boolean) {
    desc = d; shown = PAGE; paint();
    layout(); watch(matching().slice(0, shown));
  }
  sortBtn?.addEventListener('click', () => setSort(!desc));
  function setTag(v: string) {
    tag = v; shown = PAGE; paint();
    layout(); watch(matching().slice(0, shown));
  }
  tagChips.forEach((c) => c.addEventListener('click', () => setTag(c.dataset.tagChip ?? '')));
  function setRes(on: boolean) {
    withRes = on; shown = PAGE; paint();
    layout(); watch(matching().slice(0, shown));
  }
  sw?.addEventListener('click', () => setRes(sw.getAttribute('aria-checked') !== 'true'));

  // 처음 한 번만 자동으로 다음 묶음. 목록 끝 600px 앞에 닿으면 연다
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting || !autoPending) return;
      autoPending = false; io.disconnect();
      if (matching().length > shown) loadMore(); else setState();
    }, { rootMargin: '0px 0px 600px 0px' });
    io.observe(sentinel);
  } else { autoPending = false; }

  // 결과 없음 → 필터 초기화(정렬은 유지)
  document.querySelector('[data-reset]')?.addEventListener('click', () => {
    model = ''; tag = ''; q = ''; withRes = false; shown = PAGE; paint();
    layout(); watch(matching().slice(0, shown)); search?.focus();
  });

  paint();
  layout(); watch(matching().slice(0, shown));

  return {
    // 주소의 #id 타일이 닫힌 묶음·다른 필터·리소스 꺼짐 상태에 있으면 보이게 연다
    ensureVisible(id: string) {
      const t = tiles.find((x) => x.dataset.id === id); if (!t) return;
      if (t.dataset.res && !withRes) setRes(true);
      if (model && t.dataset.model !== model) setModel('');
      if (tag && !(t.dataset.tags ?? '').split('|').includes(tag)) setTag('');
      if (q && !hit(t)) { q = ''; paint(); layout(); }
      const idx = matching().indexOf(t);
      if (idx >= shown) { shown = Math.ceil((idx + 1) / PAGE) * PAGE; layout(); watch(matching().slice(0, shown)); }
    },
  };
}
