import { HelixSubscription } from '@twurple/api'
import { EventSubChannelCheerEvent, EventSubChannelSubscriptionGiftEvent, EventSubChannelRedemptionAddEvent, EventSubChannelSubscriptionEvent, EventSubChannelFollowEvent, EventSubChannelRaidEvent } from '@twurple/eventsub'

export type UserEvent = {
    user: string,
    message: string
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
  clips?: { url: string }[]
}

export class EventCollector implements StreamEvents {
  streamEvents: StreamEvents
  newSubs: string[]
  currentSubs: string[]
  gifted: GiftEvent[]
  cheers: CheerEvent[]
  redeems: UserEvent[]
  follows: string[]
  raids: RaidEvent[]
  clips?: { url: string }[]

  constructor(){
    this.streamEvents= {
    newSubs: [],
    gifted: [],
    currentSubs: [],
    cheers: [],
    redeems: [],
    follows: [],
    raids: [],
    }
  }
  

  async addSubs (user : string) {
    this.streamEvents.currentSubs.push(user)
  }

  async addGifted (e: EventSubChannelSubscriptionGiftEvent) {
    const gift = this.streamEvents.gifted.find(item => item.user === e.gifterDisplayName)
    if (gift) {
      gift.amount += e.amount
    } else {
      this.streamEvents.gifted.push({
        user: e.gifterDisplayName,
        amount: e.amount
      })
    }
  }

  async addFollow (e: EventSubChannelFollowEvent) {
    this.streamEvents.follows.push(e.userDisplayName)
  }

  async addNewSub (e : EventSubChannelSubscriptionEvent) {
    this.streamEvents.newSubs.push(e.userDisplayName)
  }

  async addCheer (e: EventSubChannelCheerEvent) {
    const cheer = this.streamEvents.cheers.find(item => item.user === e.userDisplayName)

    if (cheer) {
      cheer.amount += e.bits
      cheer.messages.push(e.message)
    } else {
      this.streamEvents.cheers.push({
        user: e.userDisplayName,
        amount: e.bits,
        messages: [e.message]
      })
    }
  }

  async addRaid (e: EventSubChannelRaidEvent) {
    const raid = this.streamEvents.raids.find(item => item.user === e.raidingBroadcasterDisplayName)
    if (raid) {
      raid.amount += e.viewers
    } else {
      this.streamEvents.raids.push({
        user: e.raidingBroadcasterDisplayName,
        amount: e.viewers
      })
    }
  }

  async addRedeem (e: EventSubChannelRedemptionAddEvent) {
    this.streamEvents.redeems.push({
      user: e.userDisplayName,
      message: e.input
    })
  }
  async addAllSubs(subs: HelixSubscription[]){
    for(const sub in subs){
      console.log("Sub Handled: ", sub)
      this.currentSubs.push(sub)
    }
  }

  async getStreamEvents () {
    return this.streamEvents
  }
}
