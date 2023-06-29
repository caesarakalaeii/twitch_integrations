const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const storedSecret = path.join(os.homedir(), 'YOUR_PROXY_SECRET') // path where your proxy secrets lay

function createSecret () {
  const secret = crypto.randomBytes(2 ** 8).toString('base64url')
  fs.writeFileSync(storedSecret, secret)
  return secret
}

const { clientId, clientSecret } = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'YOUR_TWITCH_SECRETS'))) // path where your twitch secrets lay

/** @type {import('./dist/main').Config} */
const config = {
  eventSub: {
    upId: 'POWER_UP_REDEEM_ID', // redeemId from the Redemtion; get it here: https://www.instafluff.tv/TwitchCustomRewardID/?channel=YOURTWITCHCHANNEL
    downId: 'POWER_DOWN_REDEEM_ID', // same as above, just another Redemtion
    appAuth: {
      clientId, // this is your clientID, if you don't know: https://dev.twitch.tv/docs/authentication/register-app/
      clientSecret // the client secret also outlined in aboves source
    },
    userAuth: {
      clientId,
      clientSecret,
      redirectUri: 'http://localhost:18080/auth/code', // this is the redirect URL set in the App registration
      scopes: [ // these are the needed scopes, outlided here: https://dev.twitch.tv/docs/authentication/scopes/ IF YOU DON'T KNOW DON'T TOUCH THESE
        'channel:read:subscriptions',
        'bits:read',
        'channel:read:redemptions',
        'moderator:read:followers'
      ]
    },
    user: 'YOUR_CHANNEL_NAME', // Your channel name
    adapterType: 'proxy', // only change this if you are not using a reverse proxy HIGHLY DISCOURAGED
    adapter: {
      hostName: 'YOUR_SUB_DOMAIN', // change this to the subdomain of your reverse proxy
      port: 8080
    },

    secret: fs.existsSync(storedSecret)
      ? fs.readFileSync(storedSecret).toString()
      : createSecret()
  },
  api: {
    port: 38080, // the port on wich the api will listen on commands, also used for displaying the credits
    hostname: 'localhost'
  },
  arduino: {
    serial: {
      path: 'YOUR_COM_PORT', // the port your Arduino is connected to, see here: https://support.arduino.cc/hc/en-us/articles/4406856349970-Select-board-and-port-in-Arduino-IDE
      baudRate: 9600,
      log: true
    },
    action: { // encoding used to send commands to the arduino
      money: 1,
      tens: 2,
      shockUp: 3,
      shockDown: 4
    }
  },
  minBits: 50, // minimum Bits to trigger the "Money" event
  time: {
    sub: 500, // trigger time of the "Money" event for Subs
    bit: 10, // trigger time of the "Money" event for Subs
    controll: 100 // trigger time of the "Tens" event
  },
  taser: { // timing and max, min, start values for the "tens" Event
    delay: 500,
    power: {
      min: 0,
      max: 25,
      start: 10
    }
  },
  credits: { // flags to enable/disable parts of the credits
    newSubs: true,
    gifts: true,
    redeems: true,
    follows: true,
    cheers: true,
    currentSubs: true,
    raids: true,
    redeemId: 'YOUR_CREDIT_REDEEM_ID' // another redeemID, check with above, for more info
  }
}

module.exports = config
