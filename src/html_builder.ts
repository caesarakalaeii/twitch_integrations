import { CheerEvent, GiftEvent, RaidEvent, StreamEvents, SubStreak, UserEvent } from './event_collector'
import { testMessages, testUsernames } from './test_vars'

// Example usage
export function mockEvents () {
  const events: StreamEvents = {
    newSubs: [],
    currentSubs: [],
    gifted: [],
    cheers: [],
    redeems: [],
    follows: [],
    raids: [],
    streaks: [],
    clips: []
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
    } else if (i < 8 * max / functions) {
      const streakEvent : SubStreak = {
        user: name,
        full_amount: Math.floor(Math.random() * 30),
        streak: Math.floor(Math.random() * 30),
        tier: 1 + Math.floor(Math.random() * 2),
        message
      }
      events.streaks.push(streakEvent)
    } else {
      events.redeems.push(userEvent)
    }
  }
  events.clips = []

  return events
}

// server has been removed from this file
// use the api server from main.ts with /credits?mock
