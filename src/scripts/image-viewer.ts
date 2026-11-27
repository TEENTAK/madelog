import { Layer } from './viewer';
import { loadImageItems } from './image-data';

// 이미지 타일을 크게 여는 뷰어(홈 Stills · 이미지 목록 공용). 주소는 #<이미지 id> 로 공유한다.
// tiles(): 이전·다음 순서가 되는 타일 목록(화면에 보이는 순서), beforeOpen: 주소로 바로 들어왔을 때 타일을 보이게 여는 함수
export function bindImageViewer(root: HTMLElement, tiles: () => HTMLElement[], beforeOpen?: (id: string) => void) {
  const L = new Layer(root);
  let list: HTMLElement[] = [];
  let seq = 0;
  const opts = {
    counter: (a: number, n: number) => `${a} / ${n}`,
    onNavigate: (i: number) => { const id = list[i].dataset.id!; history.replaceState(history.state, '', `#${id}`); beforeOpen?.(id); },
    onClose: () => { if (history.state?.mv) history.back(); else { history.replaceState(null, '', location.pathname + location.search); render(); } },
  };
  async function render() {
    const my = ++seq;
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) { L.close(); return; }
    beforeOpen?.(id);
    const next = tiles();
    const i = next.findIndex((t) => t.dataset.id === id);
    if (i < 0) { L.close(); return; }
    if (L.isOpen) { list = next; if (L.cur !== i) L.show(i); return; }
    let data;
    try { data = await loadImageItems(); } catch { return; } // 데이터를 못 받으면 열지 않는다(주소만 남음)
    if (my !== seq) return; // 기다리는 사이 다른 이동이 있었다
    list = next;
    L.open(list.map((t) => data[t.dataset.id!]), i, opts, list[i]);
  }
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tile]');
    if (!t || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    history.pushState({ mv: 1 }, '', `#${t.dataset.id}`); render();
  });
  window.addEventListener('popstate', render);
  render();
}
