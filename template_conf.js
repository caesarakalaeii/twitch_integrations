const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const storedSecret = path.join(os.homedir(), 'YOUR_PROXY_SECRET')

function createSecret () {
  const secret = crypto.randomBytes(2 ** 8).toString('base64url')
  fs.writeFileSync(storedSecret, secret)
  return secret
}

const { clientId, clientSecret } = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'YOUR_TWITCH_SECRETS')))

/** @type {import('./dist/main').Config} */
const config = {
  eventSub: {
    upId: 'POWER_UP_REDEEM_ID',
    downId: 'POWER_DOWN_REDEEM_ID',
    appAuth: {
      clientId,
      clientSecret
    },
    userAuth: {
      clientId,
      clientSecret,
      redirectUri: 'http://localhost:18080/auth/code',
      scopes: [
        'channel:read:subscriptions',
        'bits:read',
        'channel:read:redemptions',
        'moderator:read:followers'
      ]
    },
    user: 'YOUR_CHANNEL_NAME',
    adapterType: 'proxy',
    adapter: {
      hostName: 'YOUR_SUB_DOMAIN',
      port: 8080
    },

    secret: fs.existsSync(storedSecret)
      ? fs.readFileSync(storedSecret).toString()
      : createSecret()
  },
  api: {
    port: 38080,
    hostname: 'localhost'
  },
  arduino: {
    serial: {
      path: 'YOUR_COM_PORT',
      baudRate: 9600,
      log: true
    },
    action: {
      money: 1,
      tens: 2,
      shockUp: 3,
      shockDown: 4
    }
  },
  minBits: 50,
  time: {
    sub: 500,
    bit: 10,
    controll: 100
  },
  taser: {
    delay: 500,
    power: {
      min: 0,
      max: 25,
      start: 10
    }
  },
  credits: {
    newSubs: true,
    gifts: true,
    redeems: true,
    follows: true,
    cheers: true,
    currentSubs: true,
    raids: true,
    redeemId: 'YOUR_CREDIT_REDEEM_ID'
  }
}

module.exports = config
