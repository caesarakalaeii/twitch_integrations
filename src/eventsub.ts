import { ApiClient } from '@twurple/api'
import { ClientCredentialsAuthProvider } from '@twurple/auth'
import {
  ConnectionAdapter,
  DirectConnectionAdapter,
  DirectConnectionAdapterConfig,
  EventSubChannelCheerEvent,
  EventSubChannelSubscriptionEvent,
  EventSubChannelSubscriptionGiftEvent,
  EventSubListener,
  EventSubSubscription,
  ReverseProxyAdapter,
  ReverseProxyAdapterConfig
} from '@twurple/eventsub'
import EventEmitter from 'events'

export type DirectAdapterConfig = {
  adapterType: 'direct'
  adapter: DirectConnectionAdapterConfig
}
export type ProxyAdapterConfig = {
  adapterType: 'proxy'
  adapter: ReverseProxyAdapterConfig
}
export type AdapterConfig = DirectAdapterConfig | ProxyAdapterConfig

export type Config = {
  /** some OAuth client id
   * @see https://google.com/search?q=twitch+api+clientid */
  clientId: string
  /** some OAuth client secret
   * @see https://google.com/search?q=twitch+api+clientsecret */
  clientSecret: string
  /** optional stuff for OAuth prly don't need it */
  impliedScopes?: string[]
  /** this is supposed to be a randomly generated fixed string, so make sure you generate it exactly once */
  secret: string
  /** if you don't want to have your webhook listen directly to 443 (I'd recommend some apache2 proxy in front of this) */
  port?: number
  /** your user id
   * @see https://google.com/search?q=twitch+user+id */
  user: string
} & AdapterConfig

export enum EventName {
  SUB = 'sub',
  CHEER = 'cheer',
  GIFTSUB = 'giftsub'
}

export class CaesarEventSub {
  private authProvider: ClientCredentialsAuthProvider
  private apiClient: ApiClient
  private adapter: ConnectionAdapter
  private listener: EventSubListener
  private event: EventEmitter = new EventEmitter()

  constructor (private config: Config) {
    this.authProvider = new ClientCredentialsAuthProvider(config.clientId, config.clientSecret, config.impliedScopes)
    this.apiClient = new ApiClient({ authProvider: this.authProvider })
    switch (this.config.adapterType) {
      case 'direct':
        this.adapter = new DirectConnectionAdapter(this.config.adapter)
        break
      case 'proxy':
        this.adapter = new ReverseProxyAdapter(this.config.adapter)
        break
    }
    this.listener = new EventSubListener({
      adapter: this.adapter,
      apiClient: this.apiClient,
      secret: this.config.secret
    })
  }

  private subscriptions:EventSubSubscription[] = []

  on (event: EventName.GIFTSUB, listener: (event: EventSubChannelSubscriptionGiftEvent) => any): void
  on (event: EventName.SUB, listener: (event: EventSubChannelSubscriptionEvent) => any): void
  on (event: EventName.CHEER, listener: (event: EventSubChannelCheerEvent) => any): void
  on (event: EventName, listener: (...args: any[]) => any) {
    this.event.on(event, listener)
  }

  async init () {
    await this.authProvider.getAccessToken()
    console.log('we did it boys, we have a token')
    await this.listener.listen(this.config.port)
    console.log('it seems the eventlistener do be listening')

    const subSub = await this.listener.subscribeToChannelSubscriptionEvents(this.config.user, e => {
      // do something when a subscription was received
      console.log(e.userDisplayName, 'subscribed with a tier', e.tier, 'subscription')
      this.event.emit(EventName.SUB, e)
    })
    this.subscriptions.push(subSub)
    console.log('we subscribed to subscription events')

    const giftSub = await this.listener.subscribeToChannelSubscriptionGiftEvents(this.config.user, e => {
      // do something when a sub was gifted
      console.log(e.gifterDisplayName, 'gifted', e.amount, 'tier', e.tier, 'subscriptions')
      this.event.emit(EventName.GIFTSUB, e)
    })
    this.subscriptions.push(giftSub)
    console.log('we subscribed to subscription gift events')

    const cheerSub = await this.listener.subscribeToChannelCheerEvents(this.config.user, e => {
      // do something when bits have been cheered
      console.log(e.userDisplayName, 'cheered', e.bits, 'with message:', e.message)
      this.event.emit(EventName.CHEER, e)
    })
    this.subscriptions.push(cheerSub)
    console.log('we subscribed to bits events')
  }

  async stop () {
    for (const sub of this.subscriptions) {
      await sub.stop()
    }
    await this.listener.unlisten()
  }
}
