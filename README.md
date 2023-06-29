# twitch_integrations  
### This application allows for highly customizable Twitch integrations.  
Please be sure to Credit Kouna and CaesarLP, when using.
## Current features:  
✔️ Get events from Twitch API to send commands to an Arduino  
✔️ Get redeems, and subs to compile a credit screen

# TO-DO  
❌ Collecting followers is bugged and nonfunctional  
❌ Sub-Streaks not yet added to .html  
❌ Add Persistence to prevent data loss in cases of crashing  

# HOW TO USE:  

A working install of Node-JS and yt-dkp is needed.  
You'll need a decent understanding of web servers or someone who does.  
Setting up a reverse proxy using nginx in a docker container is recommended.  
Change the CAPITALIZED parts of the template_conf.js and rename it to config.js.  
If there are any parts, you want to change, do so as well.  
Pay close attention to the comments.  
Add your secret files to your home directory.  
To run the program open up a terminal, and change the directory to the root of this repository.  
To be save run 'npm i' before, but it is only necessary once and after updates.  
Finally run 'npm run start:dev'.  
If credits are enabled, they will be displayed at [localhost:38080/credits](http://localhost:38080/credits), per default.  


