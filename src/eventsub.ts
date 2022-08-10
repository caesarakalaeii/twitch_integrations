import { ApiClient } from '@twurple/api'
import { AuthProvider, ClientCredentialsAuthProvider } from '@twurple/auth'
import { AuthServerConfig, AuthServer } from './authserver'
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
  ReverseProxyAdapterConfig,
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

export type UserAuthConfig = {
  authType: 'user',
  auth: AuthServerConfig
}
type ClientAuth = {
  clientId: string
  clientSecret: string
  impliedScopes?: string[]
}
export type AppAuthConfig = {
  authType: 'app',
  auth: ClientAuth
}
export type AuthConfig = UserAuthConfig | AppAuthConfig

export type Config = {

  secret: string
  /** if you don't want to have your webhook listen directly to 443 (I'd recommend some apache2 proxy in front of this) */
  port?: number
  /** your user id
   * @see https://google.com/search?q=twitch+user+id */
  user: string
  appAuth: ClientAuth
  userAuth: AuthServerConfig
} & AdapterConfig

export enum EventName {
  SUB = 'sub',
  CHEER = 'cheer',
  GIFTSUB = 'giftsub'
}

export class CaesarEventSub {
  private appAuth: ClientCredentialsAuthProvider
  private userAuth: AuthServer
  private apiClient: ApiClient
  private adapter: ConnectionAdapter
  private listener: EventSubListener
  private event: EventEmitter = new EventEmitter()
  private userId: string

  constructor (private config: Config) {
    this.appAuth = new ClientCredentialsAuthProvider(this.config.appAuth.clientId, this.config.appAuth.clientSecret, this.config.appAuth.impliedScopes)
    this.userAuth = new AuthServer(this.config.userAuth)
    this.apiClient = new ApiClient({
      authProvider: this.appAuth
    })

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

  private subscriptions:Map<string, EventSubSubscription> = new Map()

  on (event: EventName.GIFTSUB, listener: (event: EventSubChannelSubscriptionGiftEvent) => any): void
  on (event: EventName.SUB, listener: (event: EventSubChannelSubscriptionEvent) => any): void
  on (event: EventName.CHEER, listener: (event: EventSubChannelCheerEvent) => any): void
  on (event: EventName, listener: (...args: any[]) => any) {
    this.event.on(event, listener)
  }

  private async handleSub (name: string, fn: () => Promise<EventSubSubscription>) {
    try {
      const sub = await fn()
      console.log('sub', name, 'initialized')
      this.subscriptions.set(name, sub)
    } catch (err) {
      console.error('failed to initialize sub', name, 'reason:', err)
    }
  }

  async init () {
    await this.userAuth.auth()

    const user = await this.apiClient.users.getUserByName(this.config.user)
    if (!user) throw new Error('can\'t find user by name: ' + this.config.user)

    console.log('we have the user id:', user.id)
    this.userId = user.id

    await this.apiClient.eventSub.deleteAllSubscriptions()
    console.log('deleted all subscriptions')

    await this.listener.listen()
    .then(() => console.log('it seems the eventlistener do be listening'))
    .catch(err => { console.log('listener failed to listen', err) })

    this.handleSub('subs', () => this.listener.subscribeToChannelSubscriptionEvents({ id: this.userId }, e => {
      // do something when a subscription was received
      console.log(e.userDisplayName, 'subscribed with a tier', e.tier, 'subscription')
      this.event.emit(EventName.SUB, e)
    }))

    this.handleSub('giftsubs', () => this.listener.subscribeToChannelSubscriptionGiftEvents({ id: this.userId }, e => {
      // do something when a sub was gifted
      console.log(e.gifterDisplayName, 'gifted', e.amount || 1, 'tier', e.tier, 'subscriptions')
      this.event.emit(EventName.GIFTSUB, e)
    }))

    this.handleSub('cheers', () => this.listener.subscribeToChannelCheerEvents({ id: this.userId }, e => {
      // do something when bits have been cheered
      console.log(e.userDisplayName, 'cheered', e.bits, 'with message:', e.message)
      this.event.emit(EventName.CHEER, e)
    }))
  }

  async stop () {
    for (const [name, sub] of Array.from(this.subscriptions.entries())) {
      await sub.stop()
      console.log('sub', name, 'stopped')
    }
    await this.listener.unlisten()
    console.log('stopped listening')
  }
}
