// 진입 연출 여부를 첫 페인트 전에 정한다(해시가 있거나 이미 스크롤됐으면 생략, 재방문이면 짧게)
(function () {
  try {
    if (location.hash || window.scrollY > 4 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var r = document.documentElement.classList;
    r.add('hm-intro');
    if (sessionStorage.getItem('hm-seen')) r.add('hm-fast');
    sessionStorage.setItem('hm-seen', '1');
  } catch (e) {}
})();
