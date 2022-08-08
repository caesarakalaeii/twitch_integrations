import { Gpio, Direction, Edge, Options } from 'onoff'

export type PinConfig = {
  gpio: number,
  direction: Direction,
  edge?: Edge
  options: Options
}

export type PinName = 'example'

export type RelaisConfig = {
  pin: {[U in PinName]: PinConfig}
}

export class Relais {
  pin: {[U in PinName]?: Gpio} = {}

  constructor (private config: RelaisConfig) {
    for (const [k, v] of Object.entries(this.config.pin)) {
      this.pin[k] = new Gpio(v.gpio, v.direction, v.edge, v.options)
    }
  }

  async exampleAction () {
    await this.pin.example?.write(Gpio.HIGH)
  }
}
