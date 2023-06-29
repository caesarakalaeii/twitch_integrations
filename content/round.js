const cornerBorderProp = {
  0: 'borderTopLeftRadius',
  1: 'borderBottomLeftRadius',
  2: 'borderBottomRightRadius',
  3: 'borderTopRightRadius',
}

/** @param {HTMLElement} elem */
function rounded (elem) {
  const corners = new Set(elem.getAttribute('data-rounded-corners')
    .split(',')
    .map((c) => c.trim().toLowerCase()))

  function round() {
    const rect = elem.getBoundingClientRect()
    const dim = (Math.min(rect.width, rect.height) / 2).toFixed() + 'px'

    for (const [c, prop] of Object.entries(cornerBorderProp)) {
      console.log(c, prop, corners.has(c))
      if (corners.has(c)) {
        elem.style[prop] = dim
      } else {
        delete elem.style[prop]
      }
    }
  }

  elem.addEventListener('resize', round)
  round()
}

window.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.rounded[data-rounded-corners]').forEach((elem) => rounded(elem))
})
