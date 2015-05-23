## Query string shortcuts ##

Add these to the URL querystring to toggle some flags.

Some examples:

  * https://www.cubeslam.com/?play&level=4
  * https://www.cubeslam.com/?play&level=4&ns=multi
  * https://www.cubeslam.com/?god
  * https://www.cubeslam.com/a-level-name?quality=best

### Network ###

  * `buffer` - should the rtc signal buffer candidates before sending them
  * `signal` - set to `ws` to use the WebSocket signal for rtc

### Multiplayer ###

  * `autonav` - automatically press buttons to get to the game (use https:// to go all the way without accepting camera more than once)
  * `render` - set to `sync` to render the sync game in a 2d renderer window
  * `ai` - turns on the AI for the opponent (not very useful)
  * `verify` - stores hashes and the states for verification. set to a number (ms) to start an interval which sends them over the network. or use `.`-key to do it manually.

### Singleplayer ###

  * `play` - go directly to a game against Bob

### Game play ###

  * `quality` - webgl rendering quality. possible values are `best`, `high`, `low`, `mobile`
  * `god` - no player can die
  * `momentum` - set to `off` to turn off paddle momentum
  * `round` - set to a number to start at that particular round
  * `extras` - set to a comma separated list of extras to override the level extras.
  * `framerate` - set to a number to set the games framerate
  * `speed` - set to a number to set the games unit speed. which all speeds are based upon.
  * `ns` - the namespace of levels. can be either `single`, `mobile` or `multi`.
  * `level` - the level to play. can be any number but there's up to 11 scripted levels. after that it'll be randomized.

### Localization ###

  * `lang` - set to a locale like `en` or `sv` to override the browser locale

### Debug ###

  * `dev` - enables the settings gui
  * `see` - set to a path to start at (see `lib/app.js` for available paths)
  * `mobile` - force mobile
  * `paused` - start game in paused mode. step forward a frame using `.`-key.
  * `silent` - don't load in sounds
  * `dmaf` - turn on dmaf logs