import path from 'path'
import { CheerEvent, GiftEvent, RaidEvent, StreamEvents, UserEvent } from './event_collector'
import { testMessages, testUsernames } from './test_vars'
import express from 'express'
import { lookup } from 'mime-types'

// Example usage
function mockEvents () {
  const events: StreamEvents = {
    newSubs: [],
    currentSubs: [],
    gifted: [],
    cheers: [],
    redeems: [],
    follows: [],
    raids: [],
    clips: []
  }
  const max = 60
  const functions = 8
  for (let i = 0; i < max; i++) {
    const name = testUsernames[i % (testUsernames.length - 1)]
    const message = testMessages[i % (testMessages.length - 1)]
    const userEvent: UserEvent = {
      user: name,
      message
    }

    if (i < 2 * max / functions) {
      events.currentSubs.push(name)
    } else if (i < 3 * max / functions) {
      events.follows.push(name)
    } else if (i < 4 * max / functions) {
      events.newSubs.push(name)
    } else if (i < 5 * max / functions) {
      const cheerEvent :CheerEvent = {
        user: name,
        amount: Math.floor(Math.random() * 100),
        messages: [message]
      }
      for (let i = 1; i < Math.floor(Math.random() * 5); i++) {
        cheerEvent.messages.push(testMessages[Math.floor(Math.random() * (testMessages.length - 1))])
      }
      events.cheers.push(cheerEvent)
    } else if (i < 6 * max / functions) {
      const giftEvent: GiftEvent = {
        user: name,
        amount: Math.floor(Math.random() * 100)
      }
      events.gifted.push(giftEvent)
    } else if (i < 7 * max / functions) {
      const raidEvent: RaidEvent = {
        user: name,
        amount: Math.floor(Math.random() * 100)
      }
      events.raids.push(raidEvent)
    } else {
      events.redeems.push(userEvent)
    }
  }
  events.clips = [
    {
      url: 'https://clips.twitch.tv/embed?clip=AnimatedOddKleeWoofer-D_ga_NkwKzPXPuyz'
    },
    {
      url: 'https://clips.twitch.tv/embed?clip=BreakableDreamyFloofKappaClaus-oymvKUiue9Sqs1_7'
    },
    {
      url: 'https://clips.twitch.tv/embed?clip=ThankfulShakingClintKreygasm-fyV_XrFDEIIIN6Yt'
    },
    {
      url: 'https://clips.twitch.tv/embed?clip=CredulousPoisedLEDTwitchRPG-CtTa4-g8wcCbMgdj'
    }
  ]

  return events
}

async function startServer () {
  const app = express()

  app.set('view engine', 'ejs')
  app.use('/content', express.static(path.join(__dirname, '../content'), {
    setHeaders (res, path) {
      const mime = lookup(path)
      if (mime) {
        res.setHeader('content-type', mime)
      }
    }
  }))
  app.get('/mock', (req, res) => res.render('credits', mockEvents()))

  await new Promise<void>(resolve => app.listen(3000, () => resolve()))
}

startServer()
  .then(() => 'listening')
  .catch((err) => console.error(err))
