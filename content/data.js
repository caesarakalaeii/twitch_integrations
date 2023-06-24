function transformData () {
  document.querySelectorAll('[data-date]').forEach((elem) => {
    elem.textContent = new Date(elem.getAttribute('data-date')).toLocaleString()
  })
}

window.addEventListener('DOMContentLoaded', transformData)
