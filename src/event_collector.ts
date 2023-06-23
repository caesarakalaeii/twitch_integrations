
export type UserEvent = {
    user: string,
    message: string
}
export type GiftEvent = {
  user: string,
  amount: number
}
export interface StreamEvents{
  newSubs: string[]
  currentSubs: string[]
  gifted: GiftEvent[]
  cheers: UserEvent[]
  redeems: UserEvent[]
  follows: string[]
}

export class EventCollector implements StreamEvents {
  
  constructor () {
  }
  streamEvents: StreamEvents
  newSubs: string[]
  gifted: GiftEvent[]
  currentSubs: string[]
  cheers: UserEvent[]
  redeems: UserEvent[]
  follows: string[]

  async addSubs(user : string){
    this.streamEvents.currentSubs.push(user)
  }

  async addGifted(giftEvent : GiftEvent){
    this.streamEvents.gifted.push(giftEvent)
  }

  async addFollow(user: string){
    this.streamEvents.follows.push(user)
  }
  
  async addNewSub(user: string){
    this.streamEvents.newSubs.push(user)
  }

  async addCheer(userEvent: UserEvent){
    this.streamEvents.cheers.push(userEvent)
  }

  async addRedeem(userEvent: UserEvent){
    this.streamEvents.redeems.push(userEvent) // Not sure if they'll have a massage
  }

  async getStreamEvents(){
    return this.streamEvents
  }


}
