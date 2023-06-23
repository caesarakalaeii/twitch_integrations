import fs from 'fs';
import { StreamEvents, UserEvent } from './event_collector';
import { messages, usernames } from './test_vars';
import { htmlString } from './html_base';
import ejs from 'ejs';

async function saveToFile(filename: string, streamEvents: StreamEvents){
  const html = ejs.render(htmlString, streamEvents);;
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
};
let max = 60
for(let i = 0; i<max; i++){
  var name =  usernames[i%(usernames.length-1)]
  var message =  messages [i%(messages.length-1)]
  var userEvent: UserEvent = {
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
    events.cheers.push(userEvent)
  }
  else if(i<6*max/7){
    var amount = Math.floor(Math.random()*100)
    userEvent.message = `Gifted ${amount} Subs`
    events.gifted.push(userEvent)
  }
  else{
    events.redeems.push(userEvent)
  }
    
}




saveToFile('output.html', events).catch(err=>console.error(err));