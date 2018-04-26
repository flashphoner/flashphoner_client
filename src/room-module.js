'use strict';
var SESSION_STATUS = require('./constants').SESSION_STATUS;
var STREAM_STATUS = require('./constants').STREAM_STATUS;
var Promise = require('promise-polyfill');
var util = require('./util');
var uuid_v1 = require('uuid/v1');
var ROOM_REST_APP = "roomApp";

/**
 * Room api based on core api
 *
 * @namespace roomApi
 */

/**
 * Initialize connection
 *
 * @param {Object} options session options
 * @param {String} options.urlServer Server address in form of [ws,wss]://host.domain:port
 * @param {String} options.username Username to login with
 * @returns {roomApi.Session}
 * @memberof roomApi
 * @method connect
 */
var appSession = function(options) {
    /**
     * Represents connection to room api app
     *
     * @namespace roomApi.Session
     */
    var callbacks = {};
    var rooms = {};
    var username_ = options.username;
    var exports;
    var roomHandlers = {};
    var session = Flashphoner.createSession({
        urlServer: options.urlServer,
        mediaOptions: options.mediaOptions,
        appKey: (options.appKey && options.appKey.length!=0) ? options.appKey: ROOM_REST_APP,
        custom: {
            login: options.username,
            token: options.token
        }
    }).on(SESSION_STATUS.ESTABLISHED, function(session){
        if (callbacks[session.status()]) {
            callbacks[session.status()](exports);
        }
    }).on(SESSION_STATUS.APP_DATA, function(data){
        if (roomHandlers[data.payload.roomName]) {
            roomHandlers[data.payload.roomName](data.payload);
        } else {
            console.warn("Failed to find room");
        }
    }).on(SESSION_STATUS.DISCONNECTED, sessionDied).on(SESSION_STATUS.FAILED, sessionDied);

    //teardown helper
    function sessionDied(session) {
        if (callbacks[session.status()]) {
            callbacks[session.status()](exports);
        }
    }

    /**
     * Disconnect session
     *
     * @memberof roomApi.Session
     * @inner
     */
    var disconnect = function(){
        session.disconnect();
    };

    /**
     * Get session status
     *
     * @returns {string} One of {@link Flashphoner.constants.SESSION_STATUS}
     * @memberof roomApi.Session
     * @inner
     */
    var status = function() {
        return session.status();
    };

    /**
     * Get session id
     *
     * @returns {string} session id
     * @memberof roomApi.Session
     * @inner
     */
    var id = function() {
        return session.id();
    };

    /**
     * Get server address
     *
     * @returns {string} Server url
     * @memberof roomApi.Session
     * @inner
     */
    var getServerUrl = function() {
        return session.getServerUrl();
    };

    /**
     * Get session username
     *
     * @returns {string} username
     * @memberof roomApi.Session
     * @inner
     */
    var username = function() {
        return username_;
    };

    /**
     * Get rooms
     *
     * @returns {roomApi.Room[]}
     * @memberof roomApi.Session
     * @inner
     */
    var getRooms = function(){
        return util.copyObjectToArray(rooms);
    };


    /**
     * Add session event callback.
     *
     * @param {string} event One of {@link Flashphoner.constants.SESSION_STATUS} events
     * @param {Session~eventCallback} callback Callback function
     * @returns {roomApi.Session} Session
     * @throws {TypeError} Error if event is not specified
     * @throws {Error} Error if callback is not a valid function
     * @memberof roomApi.Session
     * @inner
     */
    var on = function(event, callback) {
        if (!event) {
            throw new Error("Event can't be null", "TypeError");
        }
        if (!callback || typeof callback !== 'function') {
            throw new Error("Callback needs to be a valid function");
        }
        callbacks[event] = callback;
        return exports;
    };

    /**
     * Join room
     *
     * @param {Object} options Room options
     * @param {String} options.name Room name
     * @returns {roomApi.Room}
     * @memberof roomApi.Session
     * @inner
     */
    var join = function(options) {
        /**
         * Room
         *
         * @namespace roomApi.Room
         */
        var room = {};
        var name_ = options.name;
        var participants = {};
        var callbacks = {};
        var stateStreams = {};
        roomHandlers[name_] = function(data) {
            /**
             * Room participant
             *
             * @namespace roomApi.Room.Participant
             */
            var participant;
            if (data.name == "STATE") {
                if (data.info) {
                    for (var i = 0; i < data.info.length; i++) {
                        participantFromState(data.info[i]);
                    }
                    stateStreams = {};
                }
                if (callbacks["STATE"]) {
                    callbacks["STATE"](room);
                }
            } else if (data.name == "JOINED") {
                participants[data.info] = {
                    streams: {},
                    name: function(){
                        return data.info;
                    },
                    sendMessage: attachSendMessage(data.info),
                    getStreams: function() { return util.copyObjectToArray(this.streams);}
                };
                if (callbacks["JOINED"]) {
                    callbacks["JOINED"](participants[data.info]);
                }
            } else if (data.name == "LEFT") {
                participant = participants[data.info];
                delete participants[data.info];
                if (callbacks["LEFT"]) {
                    callbacks["LEFT"](participant);
                }
            } else if (data.name == "PUBLISHED") {
                participant = participants[data.info.login];
                participant.streams[data.info.name] = {
                    play: play(data.info.name),
                    stop: stop(data.info.name),
                    id: id(data.info.name),
                    streamName: function() {return data.info.name}
                };
                if (callbacks["PUBLISHED"]) {
                    callbacks["PUBLISHED"](participant);
                }
            } else if (data.name == "FAILED" || data.name == "UNPUBLISHED") {
                participant = participants[data.info.login];
                if (participant != null)
                    delete participant.streams[data.info.name];
            } else if (data.name == "MESSAGE") {
                if (callbacks["MESSAGE"]) {
                    callbacks["MESSAGE"]({
                        from: participants[data.info.from],
                        text: data.info.text
                    });
                }
            }
        };

        //participant creation helper
        function participantFromState(state) {
            var participant = {};

            if (state.hasOwnProperty("login")) {
                var login = state.login;
                var streamName = state.name;
                stateStreams[streamName] = {
                    /**
                     * Play participant stream
                     *
                     * @param {HTMLElement} display Div element stream should be displayed in
                     * @returns {Stream} Local stream object
                     * @memberof roomApi.Room.Participant.Stream
                     * @inner
                     */
                    play: play(streamName),
                    /**
                     * Stop participant stream
                     *
                     * @memberof roomApi.Room.Participant.Stream
                     * @inner
                     */
                    stop: stop(streamName),
                    /**
                     * Get participant stream id
                     *
                     * @returns {String} Stream id
                     * @memberof roomApi.Room.Participant.Stream
                     * @inner
                     */
                    id: id(streamName),
                    /**
                     * Get participant stream name
                     *
                     * @returns {String} Stream name
                     * @memberof roomApi.Room.Participant.Stream
                     * @inner
                     */
                    streamName: function(){return streamName}
                };

                if (participants[login] != null) {
                    participant = participants[login];
                } else {
                    participant = {
                        streams: {},
                        /**
                         * Get participant name
                         *
                         * @returns {String} Participant name
                         * @memberof roomApi.Room.Participant
                         * @inner
                         */
                        name: function(){
                            return login;
                        },
                        /**
                         * Send message to participant
                         *
                         * @param {String} message Message to send
                         * @param {Function} error Error callback
                         * @memberof roomApi.Room.Participant
                         * @inner
                         */
                        sendMessage: attachSendMessage(login),
                        /**
                         * Get participant streams
                         *
                         * @returns {Array<roomApi.Room.Participant.Stream>} Streams
                         * @memberof roomApi.Room.Participant
                         * @inner
                         */
                        getStreams: function() { return util.copyObjectToArray(this.streams);}
                    };
                    participants[participant.name()] = participant;
                }
                /**
                 * Room participant
                 *
                 * @namespace roomApi.Room.Participant.Stream
                 */
            } else {
                participant = {
                    streams: {},
                    name: function(){
                        return state;
                    },
                    sendMessage: attachSendMessage(state),
                    getStreams: function() {return util.copyObjectToArray(this.streams);}
                }
            }
            if (Object.keys(stateStreams).length !=0 ) {
                for (var k in stateStreams) {
                    if (stateStreams.hasOwnProperty(k)) {
                        participant.streams[k] = stateStreams[k];
                        delete stateStreams[k];
                    }
                }
            }
            participants[participant.name()] = participant;
            return participant;
        }

        /**
         * Get room name
         *
         * @returns {String} Room name
         * @memberof roomApi.Room
         * @inner
         */
        var name = function() {
            return name_;
        };

        /**
         * Leave room
         *
         * @returns {Promise<room>}
         * @memberof roomApi.Room
         * @inner
         */
        var leave = function() {
            return new Promise(function(resolve, reject){
                sendAppCommand("leave", {name: name_}).then(function(){
                    cleanUp();
                    resolve(room);
                }, function(){
                    cleanUp();
                    reject(room);
                });

                function cleanUp() {
                    //clear streams
                    var streams = session.getStreams();
                    for (var i = 0; i < streams.length; i++) {
                        if (streams[i].name().indexOf(name_ + "-" + username_) !== -1 && streams[i].status() != STREAM_STATUS.UNPUBLISHED) {
                            streams[i].stop();
                        } else if (streams[i].name().indexOf(name_) !== -1 && streams[i].status() != STREAM_STATUS.STOPPED) {
                            streams[i].stop();
                        }
                    }
                    delete roomHandlers[name_];
                    delete rooms[name_];
                }
            });
        };

        /**
         * Publish stream inside room
         *
         * @param {Object} options Stream options
         * @param {string=} options.name Stream name
         * @param {Object=} options.constraints Stream constraints
         * @param {Boolean=} options.record Enable stream recording
         * @param {Boolean=} options.cacheLocalResources Display will contain local video after stream release
         * @param {HTMLElement} options.display Div element stream should be displayed in
         * @returns {Stream}
         * @memberof roomApi.Room
         * @inner
         */
        var publish = function(options) {
            options.name = (options.name) ? (name_ + "-" + username_ + "-" + uuid_v1().substr(0,4) + "-" + options.name) : (name_ + "-" + username_ + "-" + uuid_v1().substr(0,4));
            options.cacheLocalResources = (typeof options.cacheLocalResources === "boolean") ? options.cacheLocalResources : true;
            options.custom = {name: name_};
            var stream = session.createStream(options);
            stream.publish();
            return stream;
        };

        /**
         * Add room event callback.
         *
         * @param {string} event One of {@link roomApi.events} events
         * @param {roomApi.Room~eventCallback} callback Callback function
         * @returns {roomApi.Room} room
         * @throws {TypeError} Error if event is not specified
         * @throws {Error} Error if callback is not a valid function
         * @memberof roomApi.Room
         * @inner
         */
        var on = function(event, callback) {
            if (!event) {
                throw new Error("Event can't be null", "TypeError");
            }
            if (!callback || typeof callback !== 'function') {
                throw new Error("Callback needs to be a valid function");
            }
            callbacks[event] = callback;
            return room;
        };

        /**
         * Get participants
         *
         * @returns {roomApi.Room.Participant}
         * @memberof roomApi.Room
         * @inner
         */
        var getParticipants = function() {
            return util.copyObjectToArray(participants);
        };

        //participant helpers
        function play(streamName) {
            return function(display){
                var stream = session.createStream({name: streamName, display: display, custom: {name: name_}});
                stream.play();
                return stream;
            }
        }

        function stop(streamName) {
            return function() {
                var streams = session.getStreams();
                for (var i = 0; i < streams.length; i++) {
                    if (streams[i].name() == streamName && streams[i].status() != STREAM_STATUS.UNPUBLISHED) {
                        streams[i].stop();
                    }
                }
            }
        }

        function id(streamName) {
            return function() {
                var streams = session.getStreams();
                for (var i = 0; i < streams.length; i++) {
                    if (streams[i].name() == streamName)
                        return streams[i].id();
                }
            }
        }

        function attachSendMessage(recipientName) {
            return function(text, error) {
                var message = {
                    roomConfig: {
                        name: name_
                    },
                    to: recipientName,
                    text: text
                };
                sendAppCommand("sendMessage", message).then(function(){}, function(){
                    if (error) {
                        error();
                    }
                });
            }
        }

        //sendData helper
        function sendAppCommand(commandName, data) {
            var command = {
                command: commandName,
                options: data
            };
            return session.sendData(command);
        }

        sendAppCommand("join", {name: name_}).then(function(){}, function(info){
            if (callbacks["FAILED"]) {
                callbacks["FAILED"](room, info.info);
            }
        });
        room.name = name;
        room.leave = leave;
        room.publish = publish;
        room.getParticipants = getParticipants;
        room.on = on;
        rooms[name_] = room;
        return room;
    };


    exports =  {
        disconnect: disconnect,
        id: id,
        getServerUrl: getServerUrl,
        username: username,
        status: status,
        getRooms: getRooms,
        join: join,
        on: on
    };
    return exports;
};

var events = {
    STATE: "STATE",
    JOINED: "JOINED",
    LEFT: "LEFT",
    PUBLISHED: "PUBLISHED",
    MESSAGE: "MESSAGE",
    FAILED: "FAILED"
};

module.exports = {
    connect: appSession,
    events: events
};