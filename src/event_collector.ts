import { EventSubChannelCheerEvent, EventSubChannelSubscriptionGiftEvent, EventSubChannelRedemptionAddEvent, EventSubChannelSubscriptionEvent, EventSubChannelFollowEvent, EventSubChannelRaidEvent, EventSubChannelSubscriptionMessageEvent } from '@twurple/eventsub-base'

export type UserEvent = {
  user: string,
  message: string
}
export type SubStreak = {
  user: string,
  userId: string,
  message: string,
  streak: number,
  fullAmount: number,
  tier: number,
  event: EventSubChannelSubscriptionMessageEvent
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
  gifted: GiftEvent[]
  cheers: CheerEvent[]
  redeems: UserEvent[]
  follows: string[]
  raids: RaidEvent[]
  streaks: SubStreak[]
}

export class EventCollector implements StreamEvents {
  newSubs: string[] = []
  gifted: GiftEvent[] = []
  cheers: CheerEvent[] = []
  redeems: UserEvent[] = []
  follows: string[] = []
  raids: RaidEvent[] = []
  streaks: SubStreak[] = []

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

  async addNewSub (e: EventSubChannelSubscriptionEvent) {
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

  async addSubStreak (e: EventSubChannelSubscriptionMessageEvent) {
    this.streaks.push({
      user: e.userDisplayName,
      userId: e.userId,
      message: e.messageText,
      tier: Number(e.tier) / 1000,
      streak: e.streakMonths,
      fullAmount: e.cumulativeMonths,
      event: e
    })
  }
}
