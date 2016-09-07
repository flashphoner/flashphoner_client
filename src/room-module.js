'use strict';
var SESSION_STATUS = require('./constants').SESSION_STATUS;
var Promise = require('promise-polyfill');
var util = require('./util');
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
    var username = options.username;
    var exports;
    var roomHandlers = {};
    var session = Flashphoner.createSession({
        urlServer: options.urlServer,
        appKey: ROOM_REST_APP,
        custom: {
            login: options.username
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
                }
                if (callbacks["STATE"]) {
                    callbacks["STATE"](room);
                }
            } else if (data.name == "JOINED") {
                participants[data.info] = {
                    name: function(){
                        return data.info;
                    },
                    sendMessage: attachSendMessage(data.info)
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
                participant.play = attachPlay(data.info.name);
                if (callbacks["PUBLISHED"]) {
                    callbacks["PUBLISHED"](participant);
                }
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
                participant = {
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
                     * Play participant stream
                     *
                     * @param {HTMLElement} display Div element stream should be displayed in
                     * @returns {Stream} Local stream object
                     * @memberof roomApi.Room.Participant
                     * @inner
                     */
                    play: attachPlay(streamName),
                    /**
                     * Send message to participant
                     *
                     * @param {String} message Message to send
                     * @param {Function} error Error callback
                     * @memberof roomApi.Room.Participant
                     * @inner
                     */
                    sendMessage: attachSendMessage(login)
                }
            } else {
                participant = {
                    name: function(){
                        return state;
                    },
                    sendMessage: attachSendMessage(state)
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
         * @memberof roomApi.Room
         * @inner
         */
        var leave = function() {
            sendAppCommand("leave", {name: name_}).then(function(){});
            delete roomHandlers[name_];
            delete rooms[name_];
        };

        /**
         * Publish stream inside room
         *
         * @param {HTMLElement} display Div element stream should be displayed in
         * @returns {Stream}
         * @memberof roomApi.Room
         * @inner
         */
        var publish = function(display) {
            var stream = session.createStream({name: (name_ + "-" + username), display: display, cacheLocalResources: true, custom: {name: name_}});
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
        function attachPlay(streamName) {
            return function(display){
                var stream = session.createStream({name: streamName, display: display, custom: {name: name_}});
                stream.play();
                return stream;
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