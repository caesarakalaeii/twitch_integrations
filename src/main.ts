import { CaesarEventSub, EventName } from './eventsub'
import { loadFile } from '@kounadev/loadfile'
import { CaesarEventSubConfig } from '.'
import { Relais, RelaisConfig } from './relais'
import { Queue } from './queue'

export type Config = {
  eventSub: CaesarEventSubConfig
  relais: RelaisConfig
  time: {
    sub: number
    bit: number
  }
}

export async function main () {
  const config = await loadFile<Config>('config.js')
  const esub = new CaesarEventSub(config.eventSub)
  const relais = new Relais(config.relais)
  const queue = new Queue()

  esub.on(EventName.SUB, e => {
    if (!e.isGift) {
      queue.add(() => relais.onFor('relais', config.time.sub))
    }
  })

  esub.on(EventName.GIFTSUB, e => {
    queue.add(() => relais.onFor('relais', config.time.sub * e.amount))
  })

  esub.on(EventName.CHEER, e => {
    queue.add(() => relais.onFor('relais', config.time.bit * e.bits))
  })

  await esub.init()
}
