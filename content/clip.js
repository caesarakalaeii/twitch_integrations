const VISIBLE_CLASS = 'visible'
const CONTROLLER_SELECTOR = '.clip.controller'

/**
 *
 * @param {HTMLDivElement} elem
 */
function ClipControl (elem) {
  this.controller = elem
  this.clipId = elem.getAttribute('data-clip-id');

  if (!this.clipId) {
    return
  }
  
  /** @type {boolean} */
  this.visible = false
  /** @type {string} */
  this.linkedSelector = ':not(' + CONTROLLER_SELECTOR + ')[data-clip-id=' + this.clipId + ']'
  /** @type {HTMLElement[]} */
  this.linked = Array.prototype.slice.call(document.querySelectorAll(this.linkedSelector))

  /** @type {HTMLElement} */
  this.background = document.querySelector('.clip.background' + this.linkedSelector)
  /** @type {HTMLElement} */
  this.foreground = document.querySelector('.clip.background' + this.linkedSelector)

  /** @type {HTMLVideoElement} */
  this.video = this.background.querySelector('video')

  this.show = () => {
    this.visible = true
    for (const l of this.linked) {
      l.classList.add(VISIBLE_CLASS)   
    }
    this.video.play()
  }

  this.hide = () => {
    this.visible = false
    for (const l of this.linked) {
      l.classList.remove(VISIBLE_CLASS)
    }
  }

  this.toggle = () => {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  return this
}

window.addEventListener('DOMContentLoaded', () => {
  /** @type {ClipControl[]} */
  const clips = []
  document.querySelectorAll(CONTROLLER_SELECTOR).forEach((elem) => clips.push(new ClipControl(elem)))

  let i = 0
  const next = () => {
    const clip = clips[i++ % clips.length]
    clip.video.addEventListener('ended', () => {
      clip.toggle()
      next()
    })
    clip.toggle()
  }
  next()
})
