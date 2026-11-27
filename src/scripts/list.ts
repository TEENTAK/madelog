import { bindPreview } from './preview';
import { PAGE_SIZE } from '../site';

// 영상 리스트: 데이터는 이미 페이지에 있고(서버 요청 없음), "몇 개씩 그릴지"만 다룬다.
const PAGE = PAGE_SIZE.video;

const root = document.querySelector<HTMLElement>('[data-list]');
if (root) {
  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-card]')];
  const moreWrap = root.querySelector<HTMLElement>('[data-more]')!;
  const moreBtn = moreWrap.querySelector<HTMLButtonElement>('button')!;
  const endMark = root.querySelector<HTMLElement>('[data-end]')!;
  const emptyMark = root.querySelector<HTMLElement>('[data-empty]')!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-chip]')];
  const search = root.querySelector<HTMLInputElement>('[data-search]')!;
  const sortBtn = root.querySelector<HTMLButtonElement>('[data-sort]')!;

  // 장르·검색·정렬은 주소에 남긴다(?genre=&q=&sort=old). 이미지 목록과 같은 방식. 모르는 장르 값은 무시
  const params = new URLSearchParams(location.search);
  const g = params.get('genre') ?? '';
  let tag = chips.some((c) => c.dataset.chip === g) ? g : '';
  let q = params.get('q') ?? '';
  let desc = params.get('sort') !== 'old';
  let shown = PAGE;
  search.value = q;
  const syncUrl = () => {
    const u = new URL(location.href);
    const set = (k: string, v: string) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set('genre', tag); set('q', q.trim()); set('sort', desc ? '' : 'old');
    if (u.href !== location.href) history.replaceState(history.state, '', u);
  };

  const render = () => {
    syncUrl();
    const needle = q.trim().toLowerCase();
    const match = (c: HTMLElement) =>
      (!tag || (c.dataset.tags ?? '').split('|').includes(tag)) &&
      (!needle || (c.dataset.title ?? '').toLowerCase().includes(needle) || (c.dataset.tags ?? '').toLowerCase().includes(needle));
    const list = cards.filter(match).sort((a, b) => (a.dataset.date! < b.dataset.date! ? 1 : -1) * (desc ? 1 : -1));
    const visible = new Set(list.slice(0, shown));
    cards.forEach((c) => (c.hidden = !visible.has(c)));
    list.forEach((c) => grid.appendChild(c));
    const remain = list.length - shown;
    moreWrap.hidden = remain <= 0;
    moreBtn.querySelector('small')!.textContent = remain > 0 ? `${remain}개 남음` : '';
    endMark.hidden = !(remain <= 0 && list.length > PAGE);
    emptyMark.hidden = list.length > 0;
    chips.forEach((b) => {
      const on = (b.dataset.chip ?? '') === tag;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    sortBtn.textContent = desc ? '최신순 ↓' : '오래된순 ↑';
    bindPreview(grid);
  };

  const reset = () => { shown = PAGE; render(); };
  chips.forEach((b) => b.addEventListener('click', () => {
    tag = b.dataset.chip ?? '';
    reset();
  }));
  search.addEventListener('input', () => { q = search.value; reset(); });
  sortBtn.addEventListener('click', () => { desc = !desc; reset(); });
  moreBtn.addEventListener('click', () => { shown += PAGE; render(); });
  // 결과 없음 → 장르·검색 초기화
  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    tag = ''; q = ''; search.value = '';
    reset(); search.focus();
  });
  render();
}
