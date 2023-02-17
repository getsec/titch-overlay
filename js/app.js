function fancyTimeFormat(duration) {
  // Hours, minutes and seconds
  const hrs = ~~(duration / 3600);
  const mins = ~~((duration % 3600) / 60);
  const secs = ~~duration % 60;

  // Output like "1:01" or "4:03:59" or "123:03:59"
  let ret = "";

  if (hrs > 0) {
    ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
  }

  ret += "" + mins + ":" + (secs < 10 ? "0" : "");
  ret += "" + secs;

  return ret;
}

function hide() {
  p.classList.toggle('hideP'); // toggle the hideP class
}
function show() {
  p.classList.toggle('bottom-banner'); // toggle the hideP class
}

(function() {
    const WsSubscribers = {
        __subscribers: {},
        websocket: undefined,
        webSocketConnected: false,
        registerQueue: [],
        init: function(port, debug, debugFilters) {
            port = port || 49322;
            debug = debug || false;
            if (debug) {
                if (debugFilters !== undefined) {
                    console.warn("WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped");
                } else {
                    console.warn("WebSocket Debug Mode enabled without filters applied. All events will be dumped to console");
                    console.warn("To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function");
                }
            }
            WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
            WsSubscribers.webSocket.onmessage = function (event) {
                let jEvent = JSON.parse(event.data);
                if (!jEvent.hasOwnProperty('event')) {
                    return;
                }
                let eventSplit = jEvent.event.split(':');
                let channel = eventSplit[0];
                let event_event = eventSplit[1];
                if (debug) {
                    if (!debugFilters) {
                        // console.log(channel, event_event, jEvent);
                    } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
                        console.log(channel, event_event, jEvent);
                    }
                }
                WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
            };
            WsSubscribers.webSocket.onopen = function () {
                WsSubscribers.triggerSubscribers("ws", "open");
                WsSubscribers.webSocketConnected = true;
                WsSubscribers.registerQueue.forEach((r) => {
                    WsSubscribers.send("wsRelay", "register", r);
                });
                WsSubscribers.registerQueue = [];
            };
            WsSubscribers.webSocket.onerror = function () {
                WsSubscribers.triggerSubscribers("ws", "error");
                WsSubscribers.webSocketConnected = false;
            };
            WsSubscribers.webSocket.onclose = function () {
                WsSubscribers.triggerSubscribers("ws", "close");
                WsSubscribers.webSocketConnected = false;
            };
        },
        /**
         * Add callbacks for when certain events are thrown
         * Execution is guaranteed to be in First In First Out order
         * @param channels
         * @param events
         * @param callback
         */
        subscribe: function(channels, events, callback) {
            if (typeof channels === "string") {
                let channel = channels;
                channels = [];
                channels.push(channel);
            }
            if (typeof events === "string") {
                let event = events;
                events = [];
                events.push(event);
            }
            channels.forEach(function(c) {
                events.forEach(function (e) {
                    if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
                        WsSubscribers.__subscribers[c] = {};
                    }
                    if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                        WsSubscribers.__subscribers[c][e] = [];
                        if (WsSubscribers.webSocketConnected) {
                            WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                        } else {
                            WsSubscribers.registerQueue.push(`${c}:${e}`);
                        }
                    }
                    WsSubscribers.__subscribers[c][e].push(callback);
                });
            })
        },
        clearEventCallbacks: function (channel, event) {
            if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
                WsSubscribers.__subscribers[channel] = {};
            }
        },
        triggerSubscribers: function (channel, event, data) {
            if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
                WsSubscribers.__subscribers[channel][event].forEach(function(callback) {
                    if (callback instanceof Function) {
                        callback(data);
                    }
                });
            }
        },
        send: function (channel, event, data) {
            if (typeof channel !== 'string') {
                console.error("Channel must be a string");
                return;
            }
            if (typeof event !== 'string') {
                console.error("Event must be a string");
                return;
            }
            if (channel === 'local') {
                this.triggerSubscribers(channel, event, data);
            } else {
                let cEvent = channel + ":" + event;
                WsSubscribers.webSocket.send(JSON.stringify({
                    'event': cEvent,
                    'data': data
                }));
            }
        }
    };

    $(() => {
        let logged = false;
        window.appState = {};

        const render = (d) => {
            if (!logged) {
                console.log(d);
                logged = true;
     
            }

            const renderGame = (d) => {
                team1 = d.game.teams[0];
                team2 = d.game.teams[1];

                team1Score = team1.score;
                team2Score = team2.score;

                team1name = team1.name;
                team2name = team2.name;

                $('.team-left-score').text(team1Score);
                $('.team-right-score').text(team2Score);

                $('.team-left-name').text(team1name);
                $('.team-right-name').text(team2name);

                gameTime = d.game.time_seconds;

                $('.game-time').text(fancyTimeFormat(gameTime));


                // remove everything after underscore
                try {
                    spectating = d.game.target
                    freindlySpectatorName = spectating.split('_')[0];
                    $('.spectating-player').text(freindlySpectatorName);



                    // player stats
                    currentSpecStats = d.players[d.game.target];
                    currentSpecScore = currentSpecStats.score;
                    currentSpecGoals = currentSpecStats.goals;
                    currentSpecShots = currentSpecStats.shots;
                    currentSpecAssists = currentSpecStats.assists;
                    currentSpecSaves = currentSpecStats.saves;

                    $('.spectating-score').text(`Score: ${currentSpecScore}`);
                    $('.spectating-goals').text(`Goals: ${currentSpecGoals}`);
                    $('.spectating-shots').text(`Shots: ${currentSpecShots}`);
                    $('.spectating-assists').text(`Assists: ${currentSpecShots}`);
                    $('.spectating-saves').text(`Shots ${currentSpecShots}`);
                    try {
                        var p = document.getElementsByClassName('hideP')
                        p[0].classList.remove('hideP')
                    } catch (error) {
                        
                    }
   

                } catch (error) {
                    console.log('not spectating')
                    $('.spectating-score').text('');
                    $('.spectating-goals').text('');
                    $('.spectating-shots').text('');
                    $('.spectating-assists').text('');
                    $('.spectating-saves').text('');
                    var p = document.getElementsByClassName('bottom-banner')
                    p[0].classList.add('hideP')
              
             
                }
               
                


                $('.app').show();
            }
        
            const renderPlayer = (player, index) => {
                const playerNum = index;
    
                const boostPct = player.boost / 100;

                $(`.players-team${player.team} .player${playerNum} .name`).text(player.name);
                $(`.players-team${player.team} .player${playerNum} .boost`).text(player.boost);
                $(`.players-team${player.team } .player${playerNum} .boost-indicator`).css('transform', `scaleX(${boostPct})`);

                // check against last state for changes
                if (window.appState.d && window.appState.d.players.hasOwnProperty(player.id)) {
                    const oldPlayer = window.appState.d.players[player.id];
                    if (oldPlayer) {
                        // goals
                        if (player.goals > oldPlayer.goals) {
                            $(`.players-team${player.team} .player${playerNum} .player-boost`).addClass('is-goal');

                            setTimeout(() => {
                                $(`.players-team${player.team} .player${playerNum} .player-boost`).removeClass('is-goal');
                            }, 4000);
                        }

                        // assists
                        if (player.assists > oldPlayer.assists) {
                            $(`.players-team${player.team} .player${playerNum} .player-boost`).addClass('is-assist');

                            setTimeout(() => {
                                $(`.players-team${player.team} .player${playerNum} .player-boost`).removeClass('is-assist');
                            }, 4000);
                        }

                        // demos
                        if (player.demos > oldPlayer.demos) {
                            $(`.players-team${player.team} .player${playerNum} .player-boost`).addClass('is-demo');

                            setTimeout(() => {
                                $(`.players-team${player.team} .player${playerNum} .player-boost`).removeClass('is-demo');
                            }, 4000);
                        }

                    }
                }

                if (player.isSonic) {
                    $(`.players-team${player.team} .player${playerNum} .player-boost`).addClass('is-sonic');
                } else {
                    $(`.players-team${player.team} .player${playerNum} .player-boost`).removeClass('is-sonic');
                }
            };

            const team0Players = [];
            const team1Players = [];
            
            if (d.game) {
                renderGame(d);
            }

            if (d.players) {
                Object.keys(d.players).forEach(pindex => {                        
                    if (d.players[pindex].team === 0) {
                        team0Players.push(d.players[pindex]);
                    } else {
                        team1Players.push(d.players[pindex]);
                    }
                });
    
                /*
                *
                *       TEAM 1
                * 
                */
                team0Players.forEach((player, index) => {
                    renderPlayer(player, index);
                });

    
                if (team0Players.length === 1) {
                    $('.players-team0 .player0').show();
                    $('.players-team0 .player1').hide();
                    $('.players-team0 .player2').hide();
                }
    
                if (team0Players.length === 2) {
                    $('.players-team0 .player0').show();
                    $('.players-team0 .player1').show();
                    $('.players-team0 .player2').hide();
                }
    
                if (team0Players.length === 3) {
                    $('.players-team0 .player0').show();
                    $('.players-team0 .player1').show();
                    $('.players-team0 .player2').show();
                }
    
    
                /*
                *
                *       TEAM 2
                * 
                */
                team1Players.forEach((player, index) => {
                    renderPlayer(player, index);
                });
    
                if (team1Players.length === 1) {
                    $('.players-team1 .player0').show();
                    $('.players-team1 .player1').hide();
                    $('.players-team1 .player2').hide();
                }
    
                if (team1Players.length === 2) {
                    $('.players-team1 .player0').show();
                    $('.players-team1 .player1').show();
                    $('.players-team1 .player2').hide();
                }
    
                if (team1Players.length === 3) {
                    $('.players-team1 .player0').show();
                    $('.players-team1 .player1').show();
                    $('.players-team1 .player2').show();
                }
    
                $('.app').show();
            }
            
            // clone without reference
            // do it the old way as OBS probably can't handle
            // ES6 destructuring
            window.appState.d = JSON.parse(JSON.stringify(d));
        };

        if (window.location.search === '?simulate=1') {
            //
            //  SIMULATED GAME
            //
            const players = {};
            for (let i = 0; i < 6; i++) {
                players[`player_${i + 1}`] = {
                    "assists": 0,
                    "attacker": "string",
                    "boost": 33,
                    "cartouches": 0,
                    "demos": 0,
                    "goals": 0,
                    "hasCar": true,
                    "id": `player_${i + 1}`,
                    "isDead": false,
                    "isPowersliding": false,
                    "isSonic": false,
                    "location": {
                        "X": 0,
                        "Y": 0,
                        "Z": 0,
                        "pitch": 0,
                        "roll": 0,
                        "yaw": 0
                    },
                    "name": `Player ${i + 1}`,
                    "onGround": true,
                    "onWall": false,
                    "primaryID": `player_${i + 1}`,
                    "saves": 0,
                    "score": 0,
                    "shortcut": 0,
                    "shots": 0,
                    "speed": 0,
                    "team": i < 3 ? 0 : 1,
                    "touches": 0
                };
            }

            window.appStatePending = {
                simulation: true,
                d: {
                    game: {
                        teams: {
                            0: {
                                name: "BLUE",
                                score: 0,
                            },
                            1: {
                                name: "ORANGE",
                                score: 0,
                            }
                        },
                    },
                    players: players
                }
            };

            console.log('setting interval');
            setInterval(() => {
                render(window.appStatePending.d);
            }, 2000);
        } else {
            //
            //  LIVE GAME
            //

            WsSubscribers.init(49322, false);
            WsSubscribers.subscribe("game","update_state", (d) => {
                render(d);
            });
        }
    });
})();