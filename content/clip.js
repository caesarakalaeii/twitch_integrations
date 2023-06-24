/**
 * 
 * @param {HTMLDivElement} elem 
 */
function ClipControl(elem) {
  this.elem = elem
  /** @type {HTMLVideoElement} */
  this.video = elem.querySelector('video')

  this.toggle = function() {
    this.elem.classList.toggle('visible')
    if (this.elem.classList.contains('visible')) {
      this.video.play()
    } else {
      this.video.pause()
    }
  }

  return this
}

window.addEventListener('DOMContentLoaded', () => {
  /** @type {ClipControl[]} */
  const clips = []
  document.querySelectorAll('.background-clip').forEach((elem) => clips.push(new ClipControl(elem)))

  let i = 0;
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
