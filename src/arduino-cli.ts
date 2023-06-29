import _ from 'lodash'
import repl from 'repl'
import { SerialPort } from 'serialport'
import yargs from 'yargs'

async function main () {
  const args = await yargs
    .option('path', {
      type: 'string'
    })
    .option('baud', {
      type: 'number',
      default: 9600
    })
    .argv

  if (!args.path) {
    console.error('path is required.')
    process.exit(0)
  }

  const serial = new SerialPort({ path: args.path, baudRate: args.baud })
  serial.pipe(process.stdout)

  return await new Promise<void>((resolve) => {
    const replServer = repl.start()
    _.merge(replServer.context, {
      send: (val: any) => new Promise<void>((resolve, reject) => {
        serial.write(val, (err) => {
          if (err) return reject(err)
          console.log('wrote', val, 'to serial')
          resolve()
        })
      })
    })

    replServer.on('exit', () => resolve())
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
