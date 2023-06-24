function pageScroll () {
  document.getElementById('scroll').scrollBy(0, 2)
  // eslint-disable-next-line no-undef
  scrolldelay = setTimeout(pageScroll, 10)
}
window.addEventListener('DOMContentLoaded', function () {
  pageScroll()
})
