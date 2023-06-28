import { CheerEvent, GiftEvent, RaidEvent, StreamEvents, SubStreak, UserEvent } from './event_collector'
import { PlainSub } from './eventsub'
import { testImages, testMessages, testUsernames } from './test_vars'
import crypto from 'crypto'

// Example usage
export function mockEvents () {
  const events: StreamEvents = {
    newSubs: [],
    gifted: [],
    cheers: [],
    redeems: [],
    follows: [],
    raids: [],
    streaks: []
  }
  const max = 60
  const functions = 9
  for (let i = 0; i < max; i++) {
    const name = testUsernames[i % (testUsernames.length - 1)]
    const message = testMessages[i % (testMessages.length - 1)]
    const userEvent: UserEvent = {
      user: name,
      message
    }

    if (i < 3 * max / functions) {
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
    } else if (i < 8 * max / functions) {
      const streakEvent: SubStreak = {
        user: name,
        userId: crypto.randomUUID(),
        full_amount: Math.floor(Math.random() * 30),
        streak: Math.floor(Math.random() * 30),
        tier: 1 + Math.floor(Math.random() * 3),
        message,
        event: null
      }
      events.streaks.push(streakEvent)
    } else {
      events.redeems.push(userEvent)
    }
  }

  return events
}

export function mockSubs () {
  return new Array(Math.floor(Math.random()) * 100 + 20).fill(null).map(() => mockSub(Math.random() > 0.5))
}

export function mockSub (isGift : boolean) {
  const userName = testUsernames[Math.floor(Math.random() * testUsernames.length)]
  const userId = crypto.createHash('sha256').update(userName).digest('base64url')
  let gifterDisplayName: null | string
  let gifterName: null | string
  let gifterId: null | string
  let streakMonths: number
  let cumulativeMonths: number
  let messageText: string
  const profilePictureUrl = testImages[Math.floor(Math.random() * testImages.length)]
  if (Math.random() > 0.7) {
    streakMonths = Math.floor(Math.random() * 20) + 1
    cumulativeMonths = streakMonths + Math.floor(Math.random() * 20)
    messageText = testMessages[Math.floor(Math.random() * testMessages.length)]
  }
  if (isGift) {
    gifterDisplayName = testUsernames[Math.floor(Math.random() * testUsernames.length)]
    gifterName = gifterDisplayName
    gifterId = crypto.createHash('sha256').update(userName).digest('base64url')
  }
  const isNew = Math.random() > 0.5
  return <PlainSub> {
    broadcasterDisplayName: 'CaesarLP',
    broadcasterName: 'caesarlp',
    broadcasterId: '67241623',
    userDisplayName: userName,
    userName,
    userId,
    tier: '1000',
    user: {
      displayName: userName,
      description: '',
      profilePictureUrl
    },
    gifterDisplayName,
    gifterName,
    gifterId,
    isGift,
    isNew,
    cumulativeMonths,
    durationMonths: cumulativeMonths,
    messageText,
    streakMonths
  }
}

// server has been removed from this file
// use the api server from main.ts with /credits?mock
