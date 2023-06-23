import { ApiClient, HelixClipFilter } from '@twurple/api'
import { ClientCredentialsAuthProvider } from '@twurple/auth'
import {
  ConnectionAdapter,
  DirectConnectionAdapter,
  DirectConnectionAdapterConfig,
  EventSubChannelCheerEvent,
  EventSubChannelFollowEvent,
  EventSubChannelRaidEvent,
  EventSubChannelRedemptionAddEvent,
  EventSubChannelSubscriptionEvent,
  EventSubChannelSubscriptionGiftEvent,
  EventSubListener,
  EventSubStreamOnlineEvent,
  EventSubSubscription,
  ReverseProxyAdapter,
  ReverseProxyAdapterConfig
} from '@twurple/eventsub'
import { spawn } from 'child_process'
import EventEmitter from 'events'
import _ from 'lodash'
import { EOL } from 'os'
import stringArgv from 'string-argv'
import { AuthServer, AuthServerConfig } from './authserver'

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
  upId: string
  downId :string
  redeemId: string
} & AdapterConfig

export enum EventName {
  SUB = 'sub',
  SUB_MESSAGE = 'subMessage',
  CHEER = 'cheer',
  GIFTSUB = 'giftsub',
  POINTSUP = 'pointsUp',
  POINTSDOWN = 'pointsDown',
  REDEEM = 'redeem',
  FOLLOW = 'follow',
  LIVE = 'live',
  RAID = 'raid',
}

export class CaesarEventSub {
  private appAuth: ClientCredentialsAuthProvider
  private userAuth: AuthServer
  private apiClient: ApiClient
  private adapter: ConnectionAdapter
  private listener: EventSubListener
  private event: EventEmitter = new EventEmitter()
  private userId: string
  private downId : string
  private upId: string
  private redeemId: string
  private start = new Date()

  constructor (private config: Config) {
    this.appAuth = new ClientCredentialsAuthProvider(this.config.appAuth.clientId, this.config.appAuth.clientSecret, this.config.appAuth.impliedScopes)
    this.userAuth = new AuthServer(this.config.userAuth)
    this.upId = this.config.upId
    this.downId = this.config.downId
    this.redeemId = this.config.redeemId

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
  on (event: EventName.POINTSUP, listener: (event: EventSubChannelRedemptionAddEvent) => any): void
  on (event: EventName.POINTSDOWN, listener: (event: EventSubChannelRedemptionAddEvent) => any): void
  on (event: EventName.REDEEM, listener: (event: EventSubChannelRedemptionAddEvent) => any): void
  on (event: EventName.FOLLOW, listener: (event: EventSubChannelFollowEvent) => any): void
  on (event: EventName.LIVE, listener: (event: EventSubStreamOnlineEvent) => any): void
  on (event: EventName.RAID, listener: (event: EventSubChannelRaidEvent) => any): void
  on (event: EventName, listener: (...args: any[]) => any) {
    this.event.on(event, listener)
  }

  private async handleSub (name: string, fn: () => Promise<EventSubSubscription>) {
    try {
      const sub = await fn()
      console.log('eventsub %s initialized', name)
      this.subscriptions.set(name, sub)
      await new Promise<void>((resolve) => setTimeout(resolve, 500))
    } catch (err) {
      console.error('failed to initialize eventsub \'%s\'' + EOL + 'reason %s', name, err)
    }
  }

  async init () {
    await this.userAuth.getAccessToken()
    console.log('user token received')

    const user = await this.apiClient.users.getUserByName(this.config.user)
    if (!user) throw new Error('can\'t find user by name: ' + this.config.user)

    console.log('id for user', this.config.user, 'is', user.id)
    this.userId = user.id

    await this.apiClient.eventSub.deleteAllSubscriptions()
    console.log('deleted all subscriptions')

    await this.listener.start()
      .then(() => console.log('webhook for eventsubs is listening'))
      .catch(err => { console.log('listener failed to listen', err) })

    await new Promise((resolve) => setTimeout(resolve, 1000))

    await this.handleSub(EventName.SUB_MESSAGE, () => this.listener.subscribeToChannelSubscriptionMessageEvents({ id: this.userId }, e => {
      // do something when a subscription was received
      console.log(e.userDisplayName, 'subscribed with a tier', e.tier, 'subscription')
      this.event.emit(EventName.SUB, e)
    }))

    await this.handleSub(EventName.SUB, () => this.listener.subscribeToChannelSubscriptionEvents({ id: this.userId }, e => {
      // do something when a subscription was received
      console.log(e.userDisplayName, 'subscribed with a tier', e.tier, 'subscription')
      this.event.emit(EventName.SUB, e)
    }))

    await this.handleSub(EventName.GIFTSUB, () => this.listener.subscribeToChannelSubscriptionGiftEvents({ id: this.userId }, e => {
      // do something when a sub was gifted
      console.log(e.gifterDisplayName, 'gifted', e.amount || 1, 'tier', e.tier, 'subscriptions')
      this.event.emit(EventName.GIFTSUB, e)
    }))

    await this.handleSub(EventName.CHEER, () => this.listener.subscribeToChannelCheerEvents({ id: this.userId }, e => {
      // do something when bits have been cheered
      console.log(e.userDisplayName, 'cheered', e.bits, 'with message:', e.message)
      this.event.emit(EventName.CHEER, e)
    }))

    if (this.downId) {
      await this.handleSub(EventName.POINTSDOWN, () => this.listener.subscribeToChannelRedemptionAddEventsForReward({ id: this.userId }, this.downId, e => {
        console.log(e.userDisplayName, 'redeemed Power Down with this message:', e.input)
        this.event.emit(EventName.POINTSDOWN, e)
      }))
    }

    if (this.upId) {
      await this.handleSub(EventName.POINTSUP, () => this.listener.subscribeToChannelRedemptionAddEventsForReward({ id: this.userId }, this.upId, e => {
        console.log(e.userDisplayName, 'redeemed Power Up with this message:', e.input)
        this.event.emit(EventName.POINTSUP, e)
      }))
    }

    if (this.redeemId) {
      await this.handleSub(EventName.REDEEM, () => this.listener.subscribeToChannelRedemptionAddEventsForReward({ id: this.userId }, this.redeemId, e => {
        console.log(e.userDisplayName, 'redeemed Credits with this message:', e.input)
        this.event.emit(EventName.REDEEM, e)
      }))
    }

    await this.handleSub(EventName.FOLLOW, () => this.listener.subscribeToChannelFollowEvents({ id: this.userId }, e => {
      console.log(e.userDisplayName, 'followed')
      this.event.emit(EventName.FOLLOW, e)
    }))

    await this.handleSub(EventName.RAID, () => this.listener.subscribeToChannelRaidEventsFrom({ id: this.userId }, e => {
      console.log(e.raidingBroadcasterDisplayName, 'raided with: ', e.viewers)
      this.event.emit(EventName.RAID, e)
    }))

    this.handleSub(EventName.LIVE, () => this.listener.subscribeToStreamOnlineEvents({ id: this.userId }, e => {
      console.log(e.broadcasterDisplayName, 'went live ')
      this.event.emit(EventName.LIVE, e)
    }))
  }

  async getSubscriptions () {
    return await this.apiClient.subscriptions.getSubscriptionsPaginated({ id: this.userId }).getAll()
  }

  async getClips (useTime?: boolean | Date) {
    const clipFilter: HelixClipFilter = useTime
      ? {
          startDate: typeof useTime === 'boolean'
            ? this.start.toISOString()
            : useTime.toISOString(),
          endDate: new Date().toISOString()
        }
      : undefined

    return await this.apiClient.clips
      .getClipsForBroadcasterPaginated({ id: this.userId }, clipFilter)
      .getAll()
      .then((clips) => clips.map(clip => ({ url: clip.embedUrl })))
  }

  listEventSubs () {
    Array.from(this.subscriptions.entries())
      .forEach(([name]) => console.log('-', name))
  }

  async getEventSubs () {
    return this.apiClient.eventSub.getSubscriptions()
      .then(result => {
        console.log(result.total, 'subscriptions:')
        const ml = String(result.data.length).length
        result.data.forEach((sub, i) => console.log(String(i + 1).padStart(ml) + ':', _.pick(sub, ['type', 'status'])))
      })
  }

  async testSub (name: string) {
    const sub = this.subscriptions.get(name)
    if (!sub) {
      console.log('you need to tell me what subscription you want, available are:', Array.from(this.subscriptions.keys()))
      return
    }

    const test = await sub.getCliTestCommand()
    const [cmd, ...cmdArgs] = stringArgv(test)
    await new Promise<number>((resolve, reject) => {
      const cp = spawn(cmd, cmdArgs, { stdio: 'inherit' })
      cp.on('exit', code => resolve(code))
      cp.on('error', err => reject(err))
    })
  }

  async stop () {
    for (const [name, sub] of Array.from(this.subscriptions.entries())) {
      await sub.stop()
      console.log('eventsub', name, 'stopped')
    }
    await this.listener.stop()
    console.log('stopped listening')
  }
}
