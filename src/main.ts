import { loadFile } from '@kounadev/loadfile'
import bcrypt from 'bcrypt'
import bodyParser from 'body-parser'
import compression from 'compression'
import express, { Handler, NextFunction, Request, Response } from 'express'
import fs from 'fs'
import _ from 'lodash'
import { lookup } from 'mime-types'
import path from 'path'
import repl from 'repl'
import { EventCollector } from './event_collector'
import { CustomEventSub, EventName, Config as CaesarEventSubConfig } from './eventsub'
import { Queue } from './queue'
import { mockEvents, mockSubs } from './html_builder'

type Credentials = {
  username: string
  password: string
}

export type Config = {
  eventSub: CaesarEventSubConfig
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
    clips: boolean,
    newSubs: boolean,
    gifts: boolean,
    redeems: boolean,
    follows: boolean,
    cheers: boolean,
    currentSubs: boolean,
    raids: boolean,
    announcedSubs: boolean,
    redeemId: string,
    clipLimit: number
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
  esub: CustomEventSub
}

export const CHUNK_SIZE = 10 ** 6 // 1MB chunk size
export async function fileStream (filePath: string, req: Request, res: Response, next: NextFunction) {
  const fileStat = await fs.promises.stat(filePath).catch((err) => {
    console.error(err)
    return null
  })

  if (!fileStat) {
    return res.sendStatus(404)
  }

  const fileSize = fileStat.size
  const range = req.headers.range
  const mimeType = lookup(filePath) || 'application/octet-stream'

  if (range) {
    const [start, end] = range.replace(/bytes=/, '').split('-')
    const fileStart = parseInt(start, 10)
    const fileEnd = end ? parseInt(end, 10) : fileSize - 1
    const chunkSize = fileEnd - fileStart + 1

    res.status(206) // Partial Content
    res.setHeader('Content-Range', `bytes ${fileStart}-${fileEnd}/${fileSize}`)
    res.setHeader('Content-Length', chunkSize)
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Policy', 'max-age=3600')

    const fileStream = fs.createReadStream(filePath, { start: fileStart, end: fileEnd })

    fileStream.on('open', () => {
      fileStream.pipe(res)
    })

    fileStream.on('error', (err) => {
      console.error(err)
      next(err)
    })
  } else {
    res.status(200) // OK
    res.setHeader('Content-Length', fileSize)
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Policy', 'max-age=3600')

    const fileStream = fs.createReadStream(filePath)

    fileStream.on('open', () => {
      fileStream.pipe(res)
    })

    fileStream.on('error', (err) => {
      console.error(err)
      next(err)
    })
  }
}

export async function startServer ({ config, ecol, esub }: Scope) {
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

  app.use('/clip/:id', (req, res, next) => (async () => {
    const id = req.params.id
    const filePath = path.join(esub.clipsDir, id + '.mp4')

    await fileStream(filePath, req, res, next)
  })().catch((err) => next(err)))

  if (config.credits) {
    app.get('/credits', (req, res, next) => {
      (async () => {
        const noScroll = typeof req.query.noScroll !== 'undefined'
        const mock = typeof req.query.mock !== 'undefined'
        const unmuted = typeof req.query.unmuted !== 'undefined'
        const autoplay = typeof req.query.autoplay !== 'undefined'
        const clipstart = req.query.clipstart as string | undefined
        const clips = await esub.getClips(clipstart)
        const subs = mock ? mockSubs() : await esub.joinSubs(ecol)

        res.render('credits', _.merge({
          clips,
          subs,
          noScroll,
          unmuted,
          autoplay,
          parent: req.hostname
        }, mock ? mockEvents() : {}, ecol))
      })().catch((err) => next(err))
    })
    console.log('using /credits endpoint')
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
  const esub = new CustomEventSub(config.eventSub)
  let eventCollector: EventCollector
  const queue = new Queue()

  if (config?.credits) {
    eventCollector = new EventCollector()
  }

  esub.on(EventName.SUB, e => {
    if (!e.isGift) {
      if (config?.credits?.newSubs) queue.add(() => eventCollector.addNewSub(e))
    }
  })

  esub.on(EventName.GIFTSUB, e => {
    if (config?.credits?.gifts)queue.add(() => eventCollector.addGifted(e))
  })

  esub.on(EventName.CHEER, e => {
    if (e.bits >= config.minBits) {
      if (config?.credits?.cheers) queue.add(() => eventCollector.addCheer(e))
    }
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
    await startServer({ config, ecol: eventCollector, esub })
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
