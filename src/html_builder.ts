import fs from 'fs';
import { StreamEvents, UserEvent } from './event_collector';
import { messages, usernames } from './test_vars';
import { htmlString } from './html_base';
import ejs from 'ejs';
import { publicDecrypt } from 'crypto';

async function saveToFile(filename: string, streamEvents: StreamEvents){
  const html = ejs.render(htmlString, streamEvents);;
  await fs.promises.writeFile(filename, html)
  console.log('HTML file saved successfully!');
      
}


// Example usage
const events: StreamEvents = {
  newSubs: [],
  currentSubs: [],
  cheers: [],
  redeems: [],
  follows: [],
};
for(let i = 0; i<200; i++){
  var name =  usernames[i%(usernames.length-1)]
  if(i>60){
    var message =  messages [i%(messages.length-1)]
      var userEvent: UserEvent = {
        user: name,
        message: message
      }
    }
  if(i<40){
    events.currentSubs.push(name)
  }
  else if(i<80){
    events.follows.push(name)
  }
  else if(i<120){
    events.newSubs.push(userEvent)
  }
  else if(i<160){
    events.cheers.push(userEvent)
  }
  else if(i<200){
    events.redeems.push(userEvent)
  }
    
}




saveToFile('output.html', events).catch(err=>console.error(err));