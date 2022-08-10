import { AccessToken, AuthProvider, AuthProviderTokenType, exchangeCode, RefreshingAuthProvider } from '@twurple/auth'
import { randomBytes } from 'crypto'
import express, { Application } from 'express'
import _ from 'lodash'

export type AuthServerBaseConfig = {
  apiUrl: string
}

export type AuthServerUserConfig = {
  port: number
  clientId: string
  clientSecret: string
  scopes: string[]
}

export const defaultConfig: AuthServerBaseConfig & Partial<AuthServerUserConfig> = {
  apiUrl: 'https://id.twitch.tv/oauth2/authorize'
}

export type AuthServerConfig = AuthServerUserConfig & AuthServerBaseConfig

export class AuthServer implements AuthProvider {
  private app: Application
  private authorizers: Map<string, {
    resolve: (code: string) => any,
    reject: (reason: any) => any
  }> = new Map()
  private config: AuthServerConfig

  constructor (config: Partial<AuthServerConfig>) {
    this.config = _.merge(defaultConfig, config) as unknown as AuthServerConfig
    this.app = express()
    this.init()
  }

  init () {
    this.app.get('/auth/:uuid', (req, res, next) => {
      const { uuid } = req.params
      const { scope } = req.query
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: `http://localhost:${this.config.port}/auth/${uuid}/code`,
        response_type: 'code',
        scope: scope as string
      })
      res.redirect(new URL('?' + params.toString(), this.config.apiUrl).toString())
    })

    this.app.get('/auth/:uuid/code', (req, res, next) => {
      const { uuid } = req.params
      const { code, scope, state } = req.query
      const authorizer = this.authorizers.get(uuid)
      if (authorizer) {
        this.currentScopes = (scope as string).split(' ')
        authorizer?.resolve(code as string)
      } else {
        res.sendStatus(404)
      }
    })

    this.app.listen(this.config.port, () => {
      console.log('AuthServer listening on port', this.config.port)
    })
  }

  get clientId (): string {
    return this.config.clientId
  }
  tokenType: AuthProviderTokenType = 'app'
  authorizationType?: string
  currentScopes: string[]

  private refreshingProvider?: RefreshingAuthProvider

  getAccessToken: (scopes?: string[]) => Promise<AccessToken> = async (scopes?: string[]) => {
    if (this.refreshingProvider) {
      return await this.refreshingProvider.getAccessToken(scopes)
    } else {
      return await this.auth(scopes)
        .then(code => exchangeCode(this.config.clientId, this.config.clientSecret, code, `http://localhost:${this.config.port}`))
        .then(token => {
          this.refreshingProvider = new RefreshingAuthProvider({
            clientId: this.config.clientId,
            clientSecret: this.config.clientSecret,
          }, token)
          return token
        })
    }
  }
  refresh?: () => Promise<AccessToken> = async () => {
    if (this.refreshingProvider) {
      return await this.refreshingProvider.refresh()
    }
    throw new Error('cannot refresh when there is no token')
  }

  async auth (scopes?: string[]) {
    const uuid = randomBytes(16).toString('base64url')
    return await new Promise<string>((resolve, reject) => {
      console.log('go to', `http://localhost:${this.config.port}/auth/${uuid}?` + new URLSearchParams({
        scope: Array.from(new Set([
        ...this.config.scopes,
        ...(scopes || [])
        ])).join(' ')
      }))
      this.authorizers.set(uuid, { resolve, reject })
    })
  }
}
