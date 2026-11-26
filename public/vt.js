// 페이지 전환(Cross-document View Transitions): 카드·대표 영상 창 → 상세 페이지 플레이어가 이어지는 모션.
// 첫 렌더 전에 pagereveal 을 받아야 해서 <head> 에서 바로 읽는 작은 스크립트로 둔다. 지원하지 않는 브라우저는 일반 이동.
(function () {
  var NAME = 'work-media';
  var norm = function (p) { return p.replace(/\/+$/, '') || '/'; };
  // 목록(전체·영상) 쪽에서 /p/<slug> 로 가는 링크를 가진 썸네일
  var mediaFor = function (path) {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (norm(a.pathname) !== path) continue;
      var box = a.closest('.card') ? a.closest('.card').querySelector('.media') : a.closest('.vwin');
      if (box && box.getBoundingClientRect().height > 0) return box;
    }
    return null;
  };
  var mark = function (el, vt) {
    if (!el || !vt) return;
    el.style.viewTransitionName = NAME;
    vt.finished.finally(function () { el.style.viewTransitionName = ''; });
  };
  // 나가는 페이지: 목록 → 상세면 누른 썸네일에 이름을 붙인다(상세의 .player 는 CSS로 같은 이름)
  addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var to = norm(new URL(e.activation.entry.url).pathname);
    if (/^\/p\//.test(to) && !/^\/p\//.test(norm(location.pathname))) mark(mediaFor(to), e.viewTransition);
  });
  // 들어오는 페이지: 상세 → 목록(뒤로 가기 등)이면 방금 본 작품의 썸네일에 이름을 붙인다
  addEventListener('pagereveal', function (e) {
    if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
    var from = norm(new URL(navigation.activation.from.url).pathname);
    if (/^\/p\//.test(from) && !/^\/p\//.test(norm(location.pathname))) mark(mediaFor(from), e.viewTransition);
  });
})();
