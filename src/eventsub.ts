import { ClientCredentialsAuthProvider } from '@twurple/auth'
import { ApiClient } from '@twurple/api'
import { DirectConnectionAdapter, DirectConnectionAdapterConfig, EventSubListener, EventSubSubscription } from '@twurple/eventsub'

export type Config = {
  /** some OAuth client id
   * @see https://google.com/search?q=twitch+api+clientid */
  clientId: string
  /** some OAuth client secret
   * @see https://google.com/search?q=twitch+api+clientsecret */
  clientSecret: string
  /** optional stuff for OAuth prly don't need it */
  impliedScopes?: string[]
  /** this is for the webhook, since it assumes you use HTTPS you will need a cert */
  adapter: DirectConnectionAdapterConfig
  /** this is supposed to be a randomly generated fixed string, so make sure you generate it exactly once */
  secret: string
  /** if you don't want to have your webhook listen directly to 443 (I'd recommend some apache2 proxy in front of this) */
  port?: number
  /** your user id
   * @see https://google.com/search?q=twitch+user+id */
  user: string
}

export class CaesarEventSub {
  private authProvider: ClientCredentialsAuthProvider
  private apiClient: ApiClient
  private adapter: DirectConnectionAdapter
  private listener: EventSubListener

  constructor (private config: Config) {
    this.authProvider = new ClientCredentialsAuthProvider(config.clientId, config.clientSecret, config.impliedScopes)
    this.apiClient = new ApiClient({ authProvider: this.authProvider })
    this.adapter = new DirectConnectionAdapter(config.adapter)
    this.listener = new EventSubListener({
      adapter: this.adapter,
      apiClient: this.apiClient,
      secret: this.config.secret
    })
  }

  private subscriptions:EventSubSubscription[] = []

  async init () {
    const subSub = await this.listener.subscribeToChannelSubscriptionEvents(this.config.user, e => {
      // do something when a subscription was received
      if (!e.isGift) {
        console.log(e.userDisplayName, 'subscribed with a tier', e.tier, 'subscription')
      }
    })
    this.subscriptions.push(subSub)

    const giftSub = await this.listener.subscribeToChannelSubscriptionGiftEvents(this.config.user, e => {
      // do something when a sub was gifted
      console.log(e.gifterDisplayName, 'gifted', e.amount, 'tier', e.tier, 'subscriptions')
    })
    this.subscriptions.push(giftSub)

    const cheerSub = await this.listener.subscribeToChannelCheerEvents(this.config.user, e => {
      // do something when bits have been cheered
      console.log(e.userDisplayName, 'cheered', e.bits, 'with message:', e.message)
    })
    this.subscriptions.push(cheerSub)

    await this.listener.listen(this.config.port)
  }

  async stop () {
    for (const sub of this.subscriptions) {
      await sub.stop()
    }
    await this.listener.unlisten()
  }
}
