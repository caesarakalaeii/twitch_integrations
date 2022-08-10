/* global BufferEncoding */
import { SerialPort, SerialPortOpenOptions } from 'serialport'
import { Queue } from './queue'
import { wait } from './wait'

export type Keyword = 'money' | 'tens'

export type ArduinoConfig = {
  serial: SerialPortOpenOptions<any>
  action: Record<Keyword, number>
}

export class Arduino {
  serial: SerialPort
  queue: Queue

  constructor (private config: ArduinoConfig) {
    this.serial = new SerialPort(this.config.serial)
    this.queue = new Queue()
  }

  private send (type: Keyword, active: boolean) {
    return new Promise<void>((resolve, reject) => {
      this.serial.write(Buffer.from([(this.config.action[type] << 1) + (active ? 1 : 0)]), (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  on (keyword: Keyword) {
    this.queue.add(() => this.send(keyword, true))
  }

  off (keyword: Keyword) {
    this.queue.add(() => this.send(keyword, false))
  }

  async onFor (keyword: Keyword, time: number) {
    this.on(keyword)
    await wait(time)
  }
}
