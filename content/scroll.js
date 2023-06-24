function pageScroll() {
  document.getElementById('scroll').scrollBy(0,1);
  scrolldelay = setTimeout(pageScroll,10);
}
window.addEventListener('DOMContentLoaded', function() {
  pageScroll()
})
