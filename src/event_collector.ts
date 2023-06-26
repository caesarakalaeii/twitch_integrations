import { HelixSubscription } from '@twurple/api'
import { EventSubChannelCheerEvent, EventSubChannelSubscriptionGiftEvent, EventSubChannelRedemptionAddEvent, EventSubChannelSubscriptionEvent, EventSubChannelFollowEvent, EventSubChannelRaidEvent, EventSubChannelSubscriptionMessageEvent } from '@twurple/eventsub-base'
import type { PlainClip } from './eventsub'

export type UserEvent = {
    user: string,
    message: string
}
export type SubStreak = {
  user: string,
  message: string,
  streak: number,
  full_amount: number,
  tier: number
}
export type CheerEvent = {
  amount: number,
  user: string,
  messages: string[]
}

export type GiftEvent = {
  user: string,
  amount: number
}

export type RaidEvent = {
  user: string,
  amount: number
}

export interface StreamEvents{
  newSubs: string[]
  currentSubs: string[]
  gifted: GiftEvent[]
  cheers: CheerEvent[]
  redeems: UserEvent[]
  follows: string[]
  raids: RaidEvent[]
  streaks: SubStreak[]
  clips?: PlainClip[]
}

export class EventCollector implements StreamEvents {
  newSubs: string[] = []
  currentSubs: string[] = []
  gifted: GiftEvent[] = []
  cheers: CheerEvent[] = []
  redeems: UserEvent[] = []
  follows: string[] = []
  raids: RaidEvent[] = []
  streaks: SubStreak[] = []
  clips?: PlainClip[] = []

  async addSubs (user : string) {
    this.currentSubs.push(user)
  }

  async addGifted (e: EventSubChannelSubscriptionGiftEvent) {
    const gift = this.gifted.find(item => item.user === e.gifterDisplayName)
    if (gift) {
      gift.amount += e.amount
    } else {
      this.gifted.push({
        user: e.gifterDisplayName,
        amount: e.amount
      })
    }
  }

  async addFollow (e: EventSubChannelFollowEvent) {
    this.follows.push(e.userDisplayName)
  }

  async addNewSub (e : EventSubChannelSubscriptionEvent) {
    this.newSubs.push(e.userDisplayName)
  }

  async addCheer (e: EventSubChannelCheerEvent) {
    const cheer = this.cheers.find(item => item.user === e.userDisplayName)

    if (cheer) {
      cheer.amount += e.bits
      cheer.messages.push(e.message)
    } else {
      this.cheers.push({
        user: e.userDisplayName,
        amount: e.bits,
        messages: [e.message]
      })
    }
  }

  async addRaid (e: EventSubChannelRaidEvent) {
    const raid = this.raids.find(item => item.user === e.raidingBroadcasterDisplayName)
    if (raid) {
      raid.amount += e.viewers
    } else {
      this.raids.push({
        user: e.raidingBroadcasterDisplayName,
        amount: e.viewers
      })
    }
  }

  async addRedeem (e: EventSubChannelRedemptionAddEvent) {
    this.redeems.push({
      user: e.userDisplayName,
      message: e.input
    })
  }

  async addAllSubs (subs: HelixSubscription[]) {
    for (const sub in subs) {
      console.log('Sub Handled: ', sub)
      this.currentSubs.push(sub)
    }
  }

  async addSubStreak (e : EventSubChannelSubscriptionMessageEvent) {
    this.streaks.push({
      user: e.userDisplayName,
      message: e.messageText,
      tier: +e.tier / 1000, // somehow converts from String to number, Tiers are given in 1000s, fo whatever reason
      streak: e.streakMonths,
      full_amount: e.cumulativeMonths
    })
    const testEquals = (userName) => userName === e.userDisplayName
    // if it exist remove from Sub list
    let duplicate = this.currentSubs.findIndex(testEquals)
    if (duplicate > -1) this.currentSubs.splice(duplicate, 1)
    // if it exists remover from new Subs
    duplicate = this.newSubs.findIndex(testEquals)
    if (duplicate > -1) this.newSubs.splice(duplicate, 1)
  }
}
