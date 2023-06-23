import { CaesarEventSub, EventName } from './eventsub'
import { loadFile } from '@kounadev/loadfile'
import { CaesarEventSubConfig } from '.'
import { Relais, RelaisConfig } from './relais'
import { Arduino, ArduinoConfig, Keyword } from './arduino'
import { Taser, TaserConfig } from './taser'
import { Queue } from './queue'
import express, { Handler } from 'express'
import bodyParser from 'body-parser'
import bcrypt from 'bcrypt'
import compression from 'compression'
import { EventCollector } from './event_collector'
import { lookup } from 'mime-types'
import path from 'path'
import repl from 'repl'
import _ from 'lodash'

type Credentials = {
  username: string
  password: string
}

export type Config = {
  eventSub: CaesarEventSubConfig
  relais?: RelaisConfig
  arduino?: ArduinoConfig
  taser?: TaserConfig
  time: {
    sub: number
    bit: number
    control: number
  }
  minBits: number
  api: {
    port: number
    hostname?: string
    credentials?: Credentials[]
  }
  credits: Partial<{
    newSubs: boolean,
    gifts: boolean,
    redeems: boolean,
    follows: boolean,
    cheers: boolean,
    currentSubs: boolean,
    raids: boolean,
    redeemId: string
  }>
}

const createAuthMiddleware:{(creds: Credentials[]): Handler} = function (creds) {
  return function (req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.sendStatus(401)
    }

    const [method, data] = authHeader.split(/\s/)

    if (method.toLowerCase() !== 'basic') {
      return res.sendStatus(401)
    }

    const [username, password] = Buffer.from(data, 'base64').toString().split(':')

    const cred = creds.find(cred => cred.username === username)

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
}

type Scope = {
  config: Config
  ecol: EventCollector
  arduino: Arduino
  relais: Relais
}

export async function startServer ({ config, arduino, relais, ecol }: Scope) {
  const app = express()

  app.set('view engine', 'ejs')

  if (Array.isArray(config?.api?.credentials) && config?.api?.credentials?.length) {
    console.log('using auth middleware')
    app.use(createAuthMiddleware(config.api.credentials))
  }
  app.use(compression())
  app.use(bodyParser.json())

  app.use('/content', express.static(path.join(__dirname, '../content'), {
    setHeaders (res, path) {
      const mime = lookup(path)
      if (mime) {
        res.setHeader('content-type', mime)
      }
    }
  }))

  app.get('/credits', (req, res) => {
    res.render('credits', ecol)
  })

  if (arduino) {
    app.post('/arduino/:keyword/:command', (req, res) => {
      const { keyword, command } = req.params
      const t = String(req.query.t)

      if (!arduino.isKeyword(keyword)) {
        return res.status(400).end('Illegal Keyword')
      }

      switch (command.toLowerCase()) {
        case 'on':
          arduino.on(keyword as Keyword)
          res.sendStatus(200)
          break
        case 'onfor':
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

  return await new Promise<void>((resolve) => {
    app.listen(config.api.port, config.api.hostname, () => {
      console.log(`API listening on ${config.api.hostname || 'localhost'}:${config.api.port}`)
      resolve()
    })
  })
}

export async function main () {
  const config = await loadFile<Config>('config.js')
  const esub = new CaesarEventSub(config.eventSub)
  let relais:Relais
  let arduino:Arduino
  let taser:Taser
  let eventCollector:EventCollector
  const queue = new Queue()

  if (config.relais) relais = new Relais(config.relais)
  if (config.arduino) arduino = new Arduino(config.arduino)
  if (config.taser) {
    taser = new Taser(config.taser)
      .on('dec', async (power) => {
        if (arduino) await arduino.onFor('shockDown', config.time.control)
        console.log('taser power has been decreased to power', power)
      })
      .on('inc', async (power) => {
        if (arduino) await arduino.onFor('shockUp', config.time.control)
        console.log('taser power has been increased to power', power)
      })

    console.log('taser config:', config.taser)
  }
  if (config?.credits) {
    eventCollector = new EventCollector()
  }

  esub.on(EventName.SUB, e => {
    if (!e.isGift) {
      if (relais) queue.add(() => relais.onFor('relais', config.time.sub))
      if (arduino) queue.add(() => arduino.onFor('money', config.time.sub))
      if (config?.credits?.newSubs) queue.add(() => eventCollector.addNewSub(e))
    }
  })

  esub.on(EventName.GIFTSUB, e => {
    if (relais) queue.add(() => relais.onFor('relais', config.time.sub * e.amount))
    if (arduino) queue.add(() => arduino.onFor('money', config.time.sub * e.amount))
    if (config?.credits?.gifts)queue.add(() => eventCollector.addGifted(e))
  })

  esub.on(EventName.CHEER, e => {
    if (e.bits >= config.minBits) {
      if (relais) queue.add(() => relais.onFor('relais', config.time.bit * e.bits))
      if (arduino) queue.add(() => arduino.onFor('money', config.time.bit * e.bits))
      if (config?.credits?.cheers) queue.add(() => eventCollector.addCheer(e))
    }
  })

  esub.on(EventName.POINTSDOWN, e => {
    if (taser) taser.decreasePower()
  })

  esub.on(EventName.POINTSUP, e => {
    if (taser) taser.increasePower()
  })

  esub.on(EventName.REDEEM, e => {
    if (config?.credits?.redeems)queue.add(() => eventCollector.addRedeem(e))
  })

  esub.on(EventName.FOLLOW, e => {
    if (config?.credits?.follows) queue.add(() => eventCollector.addFollow(e))
  })

  esub.on(EventName.RAID, e => {
    if (config?.credits?.raids) queue.add(() => eventCollector.addRaid(e))
  })

  if (config.api) {
    await startServer({ config, arduino, relais, ecol: eventCollector })
  }

  await esub.init()

  return await new Promise<void>((resolve) => {
    const replServer = repl.start({
      input: process.stdin,
      output: process.stdout,
      preview: true
    })

    _.merge(replServer.context, {
      esub
    })

    replServer.on('close', () => resolve())
  })
}
