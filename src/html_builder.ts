import fs from 'fs';
import { StreamEvents } from './event_collector';
import { htmlString } from './html_base';
import ejs from 'ejs';


async function saveToFile(filename: string, streamEvents: StreamEvents){
    const html = ejs.render(htmlString, streamEvents);;
    await fs.promises.writeFile(filename, html)
      if (err) {
        console.error('Error saving HTML file:', err);
      } else {
        console.log('HTML file saved successfully!');
      }
}
  


// Example usage
const events: StreamEvents = {
  newSubs: [
    { user: 'User1', message: "Hello from 1" },
    { user: 'User2', message: "Hello from 1" },
    { user: 'User3', message: "Hello from 1" },
  ],
  currentSubs: ['User4', 'User5', 'User6'],
  cheers: [
    { user: 'User7', message: "Hello from 1" },
    { user: 'User8', message: "Hello from 1" },
  ],
  redeems: [
    { user: 'User9', message: "Hello from 1" },
    { user: 'User10', message: "Hello from 1" },
  ],
  follows: ['User11', 'User12', 'User13'],
};

saveToFile('output.html', events).catch(err=>console.error(err));