# UserpageBot
UserpageBot is a wikibot that creates userpages for FANDOM volunteers/staff. It reads an IRC feed of edits and checks if a userpage exists for watched users, and creates them as needed.

## Setup
1. Install Node.js on your system
2. Clone this repo to your system (git clone https://github.com/tya/userpagebot)
3. Run `npm install`
4. Fill out `config.json.sample` and rename it to `config.json`
5. Start the bot with `node bot.js`

Or if you want to auto-start and what not
1. Install `pm2` with `npm install pm2 -g`
2. Start it with `pm2 start bot.js` 
3. Check out https://github.com/Unitech/pm2#startup-script-generation
