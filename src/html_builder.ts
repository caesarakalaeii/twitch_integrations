import fs from 'fs';
import path from 'path';
import { CheerEvent, GiftEvent, StreamEvents, UserEvent } from './event_collector';
import { testMessages, testUsernames } from './test_vars';
import ejs from 'ejs';
import express from 'express';
import { lookup } from 'mime-types';

async function saveToFile(filename: string, streamEvents: StreamEvents){
  const data = await fs.promises.readFile(path.join(__dirname, "../views/credits_template.html"))
  const html = ejs.render(data.toString(), streamEvents);;
  await fs.promises.writeFile(filename, html)
  console.log('HTML file saved successfully!');
      
}

// Example usage
function mockEvents() {
  const events: StreamEvents = {
    newSubs: [],
    currentSubs: [],
    gifted:[],
    cheers: [],
    redeems: [],
    follows: [],
  };
  const max = 60
  for(let i = 0; i<max; i++){
    const name =  testUsernames[i%(testUsernames.length-1)]
    const message =  testMessages [i%(testMessages.length-1)]
    const userEvent: UserEvent = {
      user: name,
      message: message
    }
       
    if(i<2*max/7){
      events.currentSubs.push(name)
    }
    else if(i<3*max/7){
      events.follows.push(name)
    }
    else if(i<4*max/7){
      events.newSubs.push(name)
    }
    else if(i<5*max/7){
      const cheerEvent :CheerEvent ={
        user: name,
        amount: Math.floor(Math.random()*100),
        messages: [message]
      }
      for (let i = 1; i< Math.floor(Math.random()*5); i++){
        cheerEvent.messages.push(testMessages[Math.floor(Math.random()*(testMessages.length-1))])
      }
      events.cheers.push(cheerEvent)
    }
    else if(i<6*max/7){
      var giftEvent: GiftEvent = {
        user: name,
        amount: Math.floor(Math.random()*100)
      }
      events.gifted.push(giftEvent)
    }
    else{
      events.redeems.push(userEvent)
    }
  }

  return events
}

async function startServer() {
  const app = express()

  app.set('view engine', 'ejs')
  app.use('/content', express.static(path.join(__dirname, '../content'), {
    setHeaders(res, path, stat) {
      const mime = lookup(path)
      if (mime) {
        res.setHeader('content-type', mime)
      }
    },
  }))
  app.get('/mock', (req, res) => res.render('credits_template', mockEvents()))

  await new Promise<void>(resolve => app.listen(3000, () => resolve()))
}

startServer()
  .then(() => 'listening')
  .catch((err) => console.error(err))
