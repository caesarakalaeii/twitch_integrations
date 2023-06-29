import { format } from 'util'

export function wait (time: number) {
  return new Promise<void>(resolve => {
    setTimeout(() => resolve(), time)
  })
}

const MAX = 5

export function waitFor<T = any> (label: string, fn: () => PromiseLike<T>) {
  return new Promise<T>((resolve, reject) => {
    let iterations = 0
    const start = process.hrtime()
    const prom = Promise.resolve(fn())
    const interval = setInterval(() => {
      const text = 'Waiting ' + '.'.repeat(iterations++ % MAX)
      process.stdout.write('\r' + text.padEnd(process.stdout.columns, ' '))
    }, 100)

    prom.then((res) => resolve(res)).catch((err) => reject(err)).finally(() => {
      const time = process.hrtime(start)
      clearInterval(interval)
      process.stdout.write('\r' + ' '.repeat(process.stdout.columns) + '\r')
      process.stdout.write(format('finished %s. (took %ds %dms)\n', label, time[0], Math.floor(time[1] / 1e6)))
    })
  })
}
