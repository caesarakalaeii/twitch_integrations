import fs from 'fs';
import path from 'path';
import { CheerEvent, GiftEvent, RaidEvent, StreamEvents, UserEvent } from './event_collector';
import { long_message, testMessages, testUsernames } from './test_vars';
import ejs from 'ejs';

async function saveToFile(filename: string, streamEvents: StreamEvents){
  const data = await fs.promises.readFile(path.join(__dirname, "../views/credits_template.html"))
  const html = ejs.render(data.toString(), streamEvents);;
  await fs.promises.writeFile(filename, html)
  console.log('HTML file saved successfully!');
      
}


// Example usage
const events: StreamEvents = {
  newSubs: [],
  currentSubs: [],
  gifted:[],
  cheers: [],
  redeems: [],
  follows: [],
  raids:[]
};
const max = 60
let long = false
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
    cheerEvent.messages.push[long_message]
    long = true
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
  else if(i<7*max/8){
    var raidEvent: RaidEvent = {
      user: name,
      amount: Math.floor(Math.random()*100)
    }
    events.raids.push(raidEvent)
  }
  else{
  events.redeems.push(userEvent)
  }

  async setAllSubs(){
    
  }
  
}
  


saveToFile('output.html', events).catch(err=>console.error(err));