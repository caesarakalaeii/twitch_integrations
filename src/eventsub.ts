import { ApiClient, HelixClip, HelixClipFilter, HelixGame, HelixUser } from '@twurple/api'
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
import fs from 'fs'
import _ from 'lodash'
import { EOL } from 'os'
import stringArgv from 'string-argv'
import { AuthServer, AuthServerConfig } from './authserver'
import path from 'path'

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
  clipsDir: string
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

type ClipPick = Pick<HelixClip, 'creationDate' | 'duration' | 'embedUrl' | 'thumbnailUrl' |
  'url' | 'creatorId' | 'creatorDisplayName' | 'gameId' | 'views' | 'title' | 'broadcasterDisplayName' |
  'broadcasterId' | 'id' | 'vodOffset'>
type UserPick = Pick<HelixUser, 'displayName' | 'description' | 'profilePictureUrl'>
type GamePick = Pick<HelixGame, 'name' | 'boxArtUrl'>

export type PlainClip = {
  game: GamePick,
  creator: UserPick,
  broadcaster: UserPick,
} & ClipPick

export async function youtubeDLP (url: string, options?: { output?: string, format?: string }) {
  const args: string[] = []
  if (options?.format) {
    args.push('-f', options.format)
  }
  args.push(url)
  if (options?.output) {
    args.push('-o', options.output)
  }

  return await new Promise<void>((resolve, reject) => {
    const cp = spawn('yt-dlp', args, {
      stdio: 'inherit',
      cwd: process.cwd()
    })

    cp.on('exit', (code) => code === 0
      ? resolve()
      : reject(new Error('child process exited with code ' + code)))
  })
}

export class CaesarEventSub {
  private appAuth: ClientCredentialsAuthProvider
  private userAuth: AuthServer
  public readonly apiClient: ApiClient
  private adapter: ConnectionAdapter
  public readonly listener: EventSubListener
  public readonly event: EventEmitter = new EventEmitter()
  private __userId: string
  public get userId () { return this.__userId }
  private downId : string
  private upId: string
  private redeemId: string
  public readonly start = new Date()
  public readonly clipsDir: string

  constructor (public readonly config: Config) {
    this.appAuth = new ClientCredentialsAuthProvider(this.config.appAuth.clientId, this.config.appAuth.clientSecret, this.config.appAuth.impliedScopes)
    this.userAuth = new AuthServer(this.config.userAuth)
    this.upId = this.config.upId
    this.downId = this.config.downId
    this.redeemId = this.config.redeemId
    this.clipsDir = this.config.clipsDir || './clips'

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

    fs.promises.mkdir(this.clipsDir, {
      recursive: true
    }).catch((err) => console.error(err))
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
    this.__userId = user.id

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

  userToPlain (user: HelixUser) {
    return {
      displayName: user.displayName,
      description: user.description,
      profilePictureUrl: user.profilePictureUrl
    }
  }

  gameToPlain (game: HelixGame) {
    return {
      name: game.name,
      boxArtUrl: game.boxArtUrl
    }
  }

  async clipToPlain (clip: HelixClip): Promise<PlainClip> {
    const filePath = path.join(this.clipsDir, clip.id + '.json')

    const accessible = await fs.promises.access(filePath, fs.constants.R_OK)
      .then(() => true)
      .catch(() => false)
    if (accessible) {
      return fs.promises.readFile(filePath).then((data) => JSON.parse(data.toString()))
    }

    const [game, broadcaster, creator] = await Promise.all([
      clip.getGame().then((res) => this.gameToPlain(res)),
      clip.getBroadcaster().then((res) => this.userToPlain(res)),
      clip.getCreator().then((res) => this.userToPlain(res))
    ])

    const plain:PlainClip = {
      creationDate: clip.creationDate,
      duration: clip.duration,
      embedUrl: clip.embedUrl,
      thumbnailUrl: clip.thumbnailUrl,
      url: clip.url,
      creatorId: clip.creatorId,
      creatorDisplayName: clip.creatorDisplayName,
      gameId: clip.gameId,
      views: clip.views,
      title: clip.title,
      broadcasterDisplayName: clip.broadcasterDisplayName,
      broadcasterId: clip.broadcasterId,
      id: clip.id,
      vodOffset: clip.vodOffset,
      broadcaster,
      creator,
      game
    }

    await fs.promises.writeFile(filePath, JSON.stringify(plain, null, '  '))
      .catch((err) => console.warn('could not save %s. reason %s', filePath, err))
    return plain
  }

  async getClips (useTime?: boolean | number | string | Date) {
    const clipFilter: HelixClipFilter = useTime
      ? {
          startDate: typeof useTime === 'boolean'
            ? this.start.toISOString()
            : new Date(useTime).toISOString(),
          endDate: new Date().toISOString()
        }
      : undefined

    const clips = await this.apiClient.clips
      .getClipsForBroadcasterPaginated({ id: this.userId }, clipFilter)
      .getAll()
      .then((clips) => Promise.all(clips.map((clip) => this.clipToPlain(clip))))

    const clipPaths = clips.map((clip) => path.join(this.clipsDir, clip.id + '.mp4'))

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const clipPath = clipPaths[i]
      if (fs.existsSync(clipPath)) {
        continue
      }
      await youtubeDLP(clip.url, { output: clipPath })
    }

    return clips
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
