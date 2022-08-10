import { CaesarEventSub, EventName } from './eventsub'
import { loadFile } from '@kounadev/loadfile'
import { CaesarEventSubConfig } from '.'
import { Relais, RelaisConfig } from './relais'
import { Arduino, ArduinoConfig } from './arduino'
import { Queue } from './queue'

export type Config = {
  eventSub: CaesarEventSubConfig
  relais?: RelaisConfig
  arduino?: ArduinoConfig
  time: {
    sub: number
    bit: number
  }
  minBits: number
}

export async function main () {
  const config = await loadFile<Config>('config.js')
  const esub = new CaesarEventSub(config.eventSub)
  let relais:Relais
  let arduino:Arduino
  const queue = new Queue()
  
  if (config.relais) relais = new Relais(config.relais)
  if (config.arduino) arduino = new Arduino(config.arduino)

  esub.on(EventName.SUB, e => {
    if (!e.isGift) {
      if (relais) queue.add(() => relais.onFor('relais', config.time.sub))
      if (arduino) queue.add(() => arduino.onFor('money', config.time.sub))
    }
  })

  esub.on(EventName.GIFTSUB, e => {
    if (relais) queue.add(() => relais.onFor('relais', config.time.sub * e.amount))
    if (arduino) queue.add(() => arduino.onFor('money', config.time.sub * e.amount))
  })

  esub.on(EventName.CHEER, e => {
    if (e.bits >= config.minBits) {
      if (relais) queue.add(() => relais.onFor('relais', config.time.bit * e.bits))
      if (arduino) queue.add(() => arduino.onFor('money', config.time.bit * e.bits))
    }
  })

  await esub.init()
}
