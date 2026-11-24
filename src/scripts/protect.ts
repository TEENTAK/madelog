// 미디어 저장 억제용(우클릭 메뉴·끌어다 놓기 차단). 완전한 방어는 아니다 — 주소는 공개돼 있어 개발자 도구로는 받을 수 있다.
// 텍스트·링크의 우클릭은 그대로 둔다.
const MEDIA = 'img, video, .media, .ov, .tile, .vwin, .player, .mv-stage, .rimg, .sq, .strip-btn';
const onMedia = (t: EventTarget | null) => t instanceof Element && !!t.closest(MEDIA);
document.addEventListener('contextmenu', (e) => { if (onMedia(e.target)) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (onMedia(e.target)) e.preventDefault(); });
