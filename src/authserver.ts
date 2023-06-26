import { AccessToken, AccessTokenMaybeWithUserId, AccessTokenWithUserId, AuthProvider, exchangeCode, RefreshingAuthProvider } from '@twurple/auth'
import { UserIdResolvable } from '@twurple/common'
import express, { Application } from 'express'
import _ from 'lodash'

export type AuthServerBaseConfig = {
  apiUrl: string
}

export type AuthServerUserConfig = {
  userId: UserIdResolvable
  clientId: string
  clientSecret: string
  scopes: string[]
  code?: string
  redirectUri: string
}

export const defaultConfig: AuthServerBaseConfig & Partial<AuthServerUserConfig> = {
  apiUrl: 'https://id.twitch.tv/oauth2/authorize'
}

export type AuthServerConfig = AuthServerUserConfig & AuthServerBaseConfig

export class AuthServer implements AuthProvider {
  private app: Application
  private authorizer?: {
    resolve: (code: string) => any,
    reject: (reason: any) => any
  }

  private config: AuthServerConfig
  private port: number

  constructor (config: Partial<AuthServerConfig>) {
    this.config = _.merge(defaultConfig, config) as unknown as AuthServerConfig
    this.app = express()
    this.init()
  }

  getCurrentScopesForUser: (user: UserIdResolvable) => string[]
  getAccessTokenForUser: (user: UserIdResolvable, scopes?: string[]) => Promise<AccessTokenWithUserId>
  getAccessTokenForIntent?: (intent: string, scopes?: string[]) => Promise<AccessTokenWithUserId>
  getAppAccessToken?: (forceNew?: boolean) => Promise<AccessToken>
  getAnyAccessToken: (user?: UserIdResolvable) => Promise<AccessTokenMaybeWithUserId>
  refreshAccessTokenForUser?: (user: UserIdResolvable) => Promise<AccessTokenWithUserId>
  refreshAccessTokenForIntent?: (intent: string) => Promise<AccessTokenWithUserId>

  init () {
    const url = new URL(this.config.redirectUri)
    if (url.hostname.toLowerCase() !== 'localhost') {
      throw new Error('redirect URI can only be on http://localhost')
    }
    this.port = Number(url.port) || 8080

    this.app.get('/auth', (req, res) => {
      const { scope } = req.query
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        response_type: 'code',
        scope: scope as string
      })
      res.redirect(new URL('?' + params.toString(), this.config.apiUrl).toString())
    })

    this.app.get(url.pathname, (req, res) => {
      const { code, scope } = req.query
      const authorizer = this.authorizer
      if (authorizer) {
        this.currentScopes = (scope as string).split(' ')
        authorizer?.resolve(code as string)
        res.status(200).end('authorization code received')
      } else {
        res.sendStatus(404)
      }
    })
    console.log('starting AuthServer on port:', this.port)
    this.app.listen(this.port)
  }

  get clientId (): string {
    return this.config.clientId
  }

  authorizationType?: string
  currentScopes: string[]

  private refreshingProvider?: RefreshingAuthProvider

  getAccessToken: (userId?: UserIdResolvable, scopes?: string[]) => Promise<AccessToken> = async (userId?: UserIdResolvable, scopes?: string[]) => {
    if (this.refreshingProvider) {
      return await this.refreshingProvider.getAccessTokenForUser(userId, scopes)
    } else {
      const code = this.config.code || await this.auth(scopes)
      const token = await exchangeCode(this.config.clientId, this.config.clientSecret, code, this.config.redirectUri)
      this.refreshingProvider = new RefreshingAuthProvider({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        onRefresh: () => this.refresh(userId)
      })
      return token
    }
  }

  refresh?: (userId: UserIdResolvable) => Promise<AccessToken> = async (userId: UserIdResolvable) => {
    if (this.refreshingProvider) {
      return await this.refreshingProvider.refreshAccessTokenForUser(userId)
    }
    throw new Error('cannot refresh when there is no token')
  }

  private async auth (scopes?: string[]) {
    return await new Promise<string>((resolve, reject) => {
      console.log('go to', `http://localhost:${this.port}/auth?` + new URLSearchParams({
        scope: Array.from(new Set([
          ...this.config.scopes,
          ...(scopes || [])
        ])).join(' ')
      }))
      this.authorizer = { resolve, reject }
    })
  }
}
