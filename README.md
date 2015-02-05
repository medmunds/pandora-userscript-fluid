# Userscripts and userstyle for a Fluid Pandora App

Trying to use [FluidApp](http://fluidapp.com/) for a Pandora desktop player?
These userscripts and userstyles:

* Let Pandora **remember you're logged in,** what station you're
  playing, etc. (Works around a FluidApp bug with localStorage.)

* Display the current song in the app's **titlebar** -- so it shows up
  in the dock menu and in the dock icon when you minimize the app.
  You can easily customize the title format.

* Show a Growl **notification**\* at the start of each song.
  You can easily customize the notification format.

* Resize the Pandora UI to keep it useful as you shrink the window.
  (All the way down to a functional 425x96px **mini player**.)

* Control the volume with the **mouse wheel**.

* Add Pandora playback controls to the **dock menu**.
  You can easily customize (or translate) these.

\* For notifications, you'll need Growl installed, even though 
OSX now has native notifications. (Because FluidApp 
uses an extremely old version of Growl.)


## Installation

There are _two_ userscripts and one userstyle to install in your
Pandora Fluid app:

* pandora-fluid.user.js: install as a userscript for `*pandora.com*`

    This script provides UI improvements and notifications.
    You can customize several options at the top of the script.

* pandora-fluid.user.css: install as a userstyle for `*pandora.com*`

    This stylesheet provides responsive sizing to keep the Pandora
    UI useful as you shrink the window.

* localstorage-fluid.user.js: install as a userscript for `*pandora.com*`
  
    This script works around the FluidApp bug that localStorage isn't
    persisted between runs. It's what you need so Pandora will remember
    you're logged in. (There's nothing to customize.)
    
    (It may also be helpful for other sites that have similar problems 
    with FluidApp's buggy localStorage.)


## Running Pandora without Flash Player

Pandora is perfectly happy to run with native HTML audio, but for
some reason forces Flash in Webkit browsers. (Perhaps Webkit audio
was buggy when they originally wrote the player code, years ago.)

Set your Fluid app's User Agent to "Firefox" to convince Pandora
to use native HTML audio and avoid installing Flash. (Change the
User Agent in the app menu -- it's a few items down from 
Preferences.) 


## Suggested Fluid app preferences

* General
    * New windows open with: home page
    * Home page: https://www.pandora.com/

* Behavior
    * Closing the last browser window: only hides the window.
      (So Command-W won't interrupt the music.)
    * On startup: DON'T restore windows and tabs from last time.
      (Pandora remembers what station you were playing; 
      restoring the url just confuses it.)

* Security: you can use any cookie settings you prefer.
  (They won't affect staying logged in.)
