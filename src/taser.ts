import EventEmitter from 'events';

export type TaserConfig = {
  power: {
    min: number
    max: number
    start: number
  }
}

export class Taser {
  protected power: number = 0
  protected event: EventEmitter = new EventEmitter()

  on (eventName: 'dec', listener: (power: number) => any): this
  on (eventName: 'inc', listener: (power: number) => any): this
  on (eventName: string, listener: (...args: any) => any): this {
    this.event.on(eventName, listener)
    return this
  }

  constructor (protected config: TaserConfig) {
    this.power = config.power.start
  }

  async increasePower () {
    if (this.power < this.config.power.max) {
      this.power++
      this.event.emit('inc')
    }
  }

  async decreasePower() {
    if (this.power > this.config.power.min) {
      this.power--
      this.event.emit('dec')
    }
  }
}
