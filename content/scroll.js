// speed is the number of pixels scrolled per second

/**
 * @typedef {Object} ScrollControlOptions
 * @prop {number} [hspeed]
 * @prop {number} [vspeed]
 * @prop {number} [refreshRate]
 *
 * @class
 * @prop {HTMLElement} elem
 * @prop {ScrollControlOptions}
 */
function ScrollControl (elem, options) {
  this.elem = elem
  this.verticalSpeed = 240
  this.horizontalSpeed = 0
  this.refreshRate = 60

  /** @param {ScrollControlOptions} [options] */
  this.setOptions = function (options) {
    this.verticalSpeed = options?.vspeed || this.verticalSpeed
    this.horizontalSpeed = options?.hspeed || this.horizontalSpeed
    this.refreshRate = Math.max(options?.refreshRate || this.refreshRate, 0)
    this.vStep = this.verticalSpeed / this.refreshRate
    this.hStep = this.horizontalSpeed / this.refreshRate
    this.delay = 1000 / this.refreshRate
  }.bind(this)

  this.scrollStep = function scrollStep () {
    this.elem.scrollBy(this.hStep, this.vStep)
  }.bind(this)

  this.start = function start () {
    this.stop()
    this.interval = setInterval(() => this.scrollStep(), this.delay)
  }.bind(this)

  this.stop = function stop () {
    if (this.interval) {
      clearInterval(this.interval)
    }
  }.bind(this)

  this.setOptions(options)
}

window.addEventListener('DOMContentLoaded', () => {
  const scrollctl = new ScrollControl(document.getElementById('scroll'))
  scrollctl.start()
  window.scrollctl = scrollctl
})
