import { CaesarEventSub, EventName } from './eventsub'
import { loadFile } from '@kounadev/loadfile'
import { CaesarEventSubConfig } from '.'
import { Relais, RelaisConfig } from './relais'
import { Arduino, ArduinoConfig, Keyword } from './arduino'
import { Queue } from './queue'
import express, { Handler } from 'express'
import bodyParser from 'body-parser'
import bcrypt from 'bcrypt'
import compression from 'compression'

export type Config = {
  eventSub: CaesarEventSubConfig
  relais?: RelaisConfig
  arduino?: ArduinoConfig
  time: {
    sub: number
    bit: number
  }
  minBits: number
  api: {
    port: number
    hostname?: string
    credentials: {
      username: string
      password: string
    }[]
  }
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
  
  const app = express()
  const authMiddleware:Handler = function (req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.sendStatus(401)
    }

    const [method, data, ...rest] = authHeader.split(/\s/)

    if (method.toLowerCase() !== 'basic') {
      return res.sendStatus(401)
    }

    const [username, password] = Buffer.from(data, 'base64').toString().split(':')

    const cred = config.api.credentials.find(cred => cred.username === username)

    bcrypt.compare(password, cred.password)
      .then(result => {
        if (result) {
          next()
        } else {
          res.sendStatus(401)
        }
      })
      .catch(err => {
        console.error(err)
        if (!res.headersSent) {
          res.sendStatus(401)
        }
      })
  }

  app.use(authMiddleware)
  app.use(compression())
  app.use(bodyParser.json())

  if (arduino) {
    app.post('/arduino/:keyword/:command', (req, res) => {
      const { keyword, command } = req.params
  
      if (!arduino.isKeyword(keyword)) {
        return res.status(400).end('Illegal Keyword')
      }
  
      switch (command.toLowerCase()) {
        case 'on':
          arduino.on(keyword as Keyword)
          res.sendStatus(200)
          break
        case 'onfor':
          const { t } = req.query
          arduino.onFor(keyword as Keyword, t ? Number(t) : 1000)
            .then(() => res.sendStatus(200))
            .catch(err => {
              console.error(err)
              res.sendStatus(500)
            })
          break
        case 'off':
          arduino.off(keyword as Keyword)
          res.sendStatus(200)
          break
        default:
          res.status(400).end('Unknown Command')
          break
      }
    })
    console.log('API using', '/arduino/:keyword/:command')
    console.log('- keywords:', arduino.keywords)
    console.log('- commands', ['on', 'off', 'onfor'])
    console.log('the command \'onfor\' allows for query parameter \'t\' to give the time in ms')
  }

  app.listen(config.api.port, config.api.hostname, () => {
    console.log(`API listening on ${config.api.hostname || 'localhost'}:${config.api.port}`)
  })

  await esub.init()
}
