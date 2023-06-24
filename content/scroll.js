function pageScroll () {
  document.getElementById('scroll').scrollBy(0, 1)
  // eslint-disable-next-line no-undef
  scrolldelay = setTimeout(pageScroll, 10)
}
window.addEventListener('DOMContentLoaded', function () {
  pageScroll()
})
