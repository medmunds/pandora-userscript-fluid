(function () {
    var pandoraConfig = {
        // Update title bar (to make it useful for minimized windows).
        // You can include any of ${artist}, ${song}, ${album}, ${station},
        // and time ${elapsed} or ${remaining} time in the song.
        // Set to null to leave title bar alone.
        titleFormat: '${artist} - ${song} - ${album}',

        // Display a notification when the song changes. (You'll need Growl installed.)
        // You can include any of the variables from titleFormat above, as well as
        // ${albumArtUrl}, ${songUrl}, ${albumUrl}, and ${artistUrl}.
        // Set to null to skip notifications.
        notificationFormat: {
            title: '${song}',
            description: 'by ${artist}\non ${album}\n[${station}]',
            identifier: 'Pandora',
            sticky: false,
            icon: '${albumArtUrl}'
        },

        // Set dockMenuItems to commands you want to include in the dock menu.
        dockMenuItems: {
            'Play': 'play',
            'Pause': 'pause',
            'Pause for 5 minutes': 'pauseAndRestart',
            'Thumbs Down': 'thumbsDown',
            'Thumbs Up': 'thumbsUp',
            'Skip Track': 'skip',
            'Louder': 'volumeUp',
            'Softer': 'volumeDown'
        },

        // Set true if you want the mouse wheel to control volume.
        // (Only applies over the playerBar controls -- so that you can
        // still use the wheel for scrolling elsewhere in the window.)
        mouseWheelAdjustsVolume: true,

        // Set autoRestartAfterError true to try to recover from Pandora
        // streaming errors that interrupt playback.
        autoRestartAfterError: true
    };

    //
    // (You shouldn't need to edit anything below here)
    //

    function initialize(config) {
        // Window Title
        if (config.titleFormat) {
            var titleFormatter = Formatter(config.titleFormat);
            function updateTitle() {
                var state = getPlayerState(titleFormatter.params),
                    title = titleFormatter(state);
                if (title != document.title) {
                    document.title = title;
                }
            }
            // Observe the window title too -- Pandora changes it during
            // tuning, after we've already set it. (So we set it back!)
            var titleParams = titleFormatter.params.concat(['_title']);
            observePlayerState(titleParams, debounce(updateTitle, 0));
        }

        // Notifications
        if (config.notificationFormat && window.fluid && window.fluid.showGrowlNotification) {
            var notificationFormatter = ObjectFormatter(config.notificationFormat);
            function notify() {
                var state = getPlayerState(notificationFormatter.params),
                    notification = notificationFormatter(state),
                    stringified = JSON.stringify(notification);
                if (localStorage.lastNotification != stringified) {
                    localStorage.lastNotification = stringified;
                    window.fluid.showGrowlNotification(notification);
                }
            }
            observePlayerState(notificationFormatter.params, debounce(notify, 0));
        }

        // Dock menu items
        if (config.dockMenuItems && window.fluid && window.fluid.addDockMenuItem) {
            Object.keys(config.dockMenuItems).forEach(function(label) {
                var command = config.dockMenuItems[label];
                if (playerCommands[command]) {
                    window.fluid.addDockMenuItem(label, playerCommands[command]);
                } else {
                    console.error("Don't know how to '" + command + "' [Pandora UserScript dockMenuItems]");
                }
            });
        }

        // Wheel volume
        if (config.mouseWheelAdjustsVolume) {
            var playerBar = document.querySelector('#playerBar');
            playerBar.addEventListener('wheel', function(event) {
                event.preventDefault();
                var delta = - event.deltaY; // scroll up = louder volume
                //console.log("Adjusting volume", delta);
                adjustVolume(delta);
            });
        }

        // Restart after error
        if (config.autoRestartAfterError) {
            // If the reload toast ever appears in the DOM, click it
            setInterval(playerCommands.restartIfError, 5 * SECONDS);
        }
    }


    //
    // Pandora Playback Control
    //

    function makeClicker(selector) {
        return function() {
            var element = document.querySelector(selector);
            if (element)
                element.click();
        }
    }

    function adjustVolume(delta) {
        // Volume is a jQuery-UI Draggable
        var $volumeBackground = $('.volumeBackground'),
            $volumeKnob = $('.volumeKnob'),
            wasVisible = $volumeBackground.is(':visible');
        // Can only pretend to drag while controls are visible
        $volumeBackground.show();
        $volumeKnob
            .css('left', $volumeKnob.position().left + delta)
            .click(); // prod uiDraggable into noticing the change (will also clamp it)
        if (!wasVisible) {
            $volumeBackground.hide();
        }
    }

    var playerCommands = {
        play:       makeClicker('#playerBar .playButton a'),
        pause:      makeClicker('#playerBar .pauseButton a'),
        thumbsDown: makeClicker('#playerBar .thumbDownButton a'),
        thumbsUp:   makeClicker('#playerBar .thumbUpButton a'),
        skip:       makeClicker('#playerBar .skipButton a'),
        volumeUp:   adjustVolume.bind(this, 10),
        volumeDown: adjustVolume.bind(this, -10),
        pauseAndRestart: function(delay) {
            playerCommands.pause();
            setTimeout(playerCommands.play, delay || 5 * MINUTES);
        },

        restartIfError: makeClicker('.toastItemReload')
    };


    //
    // Pandora Player State
    //

    var playerProps = {
        // (Property value is element's textContent.trim() unless attr specified)
        song:       { selector: '.playerBarSong' },
        album:      { selector: '.playerBarAlbum' },
        artist:     { selector: '.playerBarArtist' },
        elapsed:    { selector: '.elapsedTime' },
        remaining:  { selector: '.remainingTime' },
        songUrl:    { selector: '.playerBarSong',   attr: 'href' },
        albumUrl:   { selector: '.playerBarAlbum',  attr: 'href' },
        artistUrl:  { selector: '.playerBarArtist', attr: 'href' },
        // Station name: pick up the current shuffle station when shuffling; else the selected station
        station: { selector: '.shuffleStationLabelCurrent .stationNameText, .stationListItem.selected .stationNameText',
                   observe: { selector: '.stationListHolder', expensive: true, // also catches rollover in station list
                              options: { subtree: true, attributes: true, attributeFilter: ['class'] } }
                 },
        // The player does a clever fade-through on album art, so there are multiple
        // .albumArt img nodes in the DOM at once. We need some custom observing...
        albumArtUrl: { selector: '.albumArt img:last-child', attr: 'src',
                       observe: { selector: '.albumArt', options: { childList: true } } },

        // The window title -- observable so we can fight with Pandora over it during launch.
        _title: { selector: 'title' }
    };

    // Return an object with the current Pandora player state.
    // Optional props is a list of playerProps to query.
    function getPlayerState(props) {
        var state = {};
        props = props || Object.keys(playerProps);
        props.forEach(function(prop) {
            var propDef = playerProps[prop];
            if (propDef) {
                var element = propDef && document.querySelector(propDef.selector);
                state[prop] = element
                    ? (propDef.attr
                        ? element.getAttribute(propDef.attr)
                        : element.textContent.trim())
                    : "";
            }
        });
        //console.log('PlayerState', state);
        return state;
    }

    // Calls callback whenever specific Pandora player props change.
    // Props is a list of playerProps to observe.
    // (You probably want to debounce if you're observing multiple props.)
    function observePlayerState(props, callback) {
        props = props.filter(function(prop) { return !!playerProps[prop]; }); // filter out unknown props
        var observer = new MutationObserver(callback),
            cheapProps = props.filter(function(prop) {
                var propDef = playerProps[prop], observeDef = propDef.observe || propDef;
                return !observeDef.expensive;
            });
        if (cheapProps.length > 1) {
            // Skip observing expensive props, unless we're not observing anything else.
            // (Assumes some other observed prop will change whenever an expensive one does.)
            props = cheapProps;
        }
        props.forEach(function(prop) {
            var propDef = playerProps[prop],
                observeDef = propDef.observe || propDef,
                element = document.querySelector(observeDef.selector),
                options = observeDef.options ||
                    (observeDef.attr
                        ? { attributes: true, attributeFilter: [observeDef.attr] } // specific attribute
                        : { childList: true, characterData: true, subtree: true }); // textContent
            if (element) {
                observer.observe(element, options);
                //console.log("observing", element, options);
            } else {
                //console.log("can't find element to observe", prop, observeDef);
            }
        });
        window.addEventListener('unload', observer.disconnect.bind(observer)); // shouldn't really be needed, but...
        return observer;
    }


    //
    // Utilities
    //

    var SECONDS = 1000,
        MINUTES = 60 * SECONDS;

    // String substitution: generates function(replacements) that
    // replaces ${key} in template with replacements[key] value.
    // .params is a list of unique keys used in the template.
    function Formatter(template) {
        var paramRe = /\$\{(\w+)\}/g,  // ${key}
            paramsUsed = {},
            match;

        while ((match = paramRe.exec(template)) !== null) {
            paramsUsed[match[1]] = true;
        }
        var replace = function(replacements) {
            return template.replace(paramRe, function(match, name) {
                return replacements.hasOwnProperty(name) ? replacements[name] : match[0];
            });
        };
        replace.params = Object.keys(paramsUsed);
        //console.log('Formatter', template, replace.params);
        return replace;
    }

    // Generates function(replacements) that applies a Formatter
    // to each string prop-val of templateObj, and copies remaining prop-vals.
    // .params is the union of keys used in all the string templates.
    function ObjectFormatter(templateObj) {
        var keys = Object.keys(templateObj),
            formatters = {},
            paramsUsed = {};

        keys.forEach(function(key) {
            var templateValue = templateObj[key];
            if (typeof templateObj[key] == 'string') {
                formatters[key] = Formatter(templateValue);
                formatters[key].params.forEach(function(param) { paramsUsed[param] = true; });
            } else {
                formatters[key] = function(replacements) { return templateValue; }
            }
        });

        var replace = function(replacements) {
            var result = {};
            keys.forEach(function(key) {
                result[key] = formatters[key](replacements);
            });
            return result;
        };
        replace.params = Object.keys(paramsUsed);
        //console.log('ObjectFormatter', templateObj, replace.params);
        return replace;
    }


    // Trailing-edge debounce, adapted from Underscore
    function debounce(func, wait) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Kick it all off
    initialize(pandoraConfig);
})();
