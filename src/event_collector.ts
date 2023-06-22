
import { wait } from './wait'

export type UserEvent = {
    user: string,
    message: string
}

export interface StreamEvents{
  newSubs: UserEvent[]
  currentSubs: string[]
  cheers: UserEvent[]
  redeems: UserEvent[]
  follows: string[]
}

export class EventCollector implements StreamEvents {
  
  constructor () {
    const x: StreamEvents = { newSubs: [], currentSubs: [], cheers: [], redeems: [], follows: [] }
    this.streamEvents = x
  }
  streamEvents: StreamEvents
  newSubs: UserEvent[]
  currentSubs: string[]
  cheers: UserEvent[]
  redeems: UserEvent[]
  follows: string[]

  async addSubs(userEvents: UserEvent[]){
    for (var userEvent of userEvents){
            if(!this.streamEvents.newSubs.includes(userEvent)){
                this.streamEvents.currentSubs.push(userEvent.user)
            }
    }
  }

  async addFollow(user: string){
    this.streamEvents.follows.push(user)
  }
  
  async addNewSub(userEvent: UserEvent){
    this.streamEvents.newSubs.push(userEvent)
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
