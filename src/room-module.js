'use strict';
var uuid = require('node-uuid');
var SESSION_STATUS = require('./constants').SESSION_STATUS;

var ROOM_REST_APP = "roomApp";

/**
 * Initialize connection
 *
 * @param {Object} options session options
 * @param {String} options.urlServer Server address in form of [ws,wss]://host.domain:port
 * @param {String} options.username Username to login with
 */
var appSession = function(options){
    var callbacks = {};
    var rooms = {};
    var username = options.username;
    var exports = {};
    var roomHandlers = {};
    var session = Flashphoner.createSession({
        urlServer: options.urlServer,
        appKey: ROOM_REST_APP,
        custom: {
            login: options.username
        }
    }).on(SESSION_STATUS.ESTABLISHED, function(session){
        if (callbacks["CONNECTED"]) {
            callbacks["CONNECTED"](exports);
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
        if (callbacks["DISCONNECTED"]) {
            callbacks["DISCONNECTED"](exports);
        }
    }

    exports.disconnect = function(){
        session.disconnect();
    };

    exports.getRooms = function(){
        var roomsCopy = [];
        for (var prop in rooms) {
            if(rooms.hasOwnProperty(prop)) {
                roomsCopy.push(rooms[prop]);
            }
        }
        return roomsCopy;
    };

    exports.on = function(event, callback) {
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
     */
    exports.join = function(options) {
        var room = {};
        var name_ = options.name;
        var participants = {};
        var callbacks = {};
        roomHandlers[name_] = function(data){
            var participant;
            if (data.name == "STATE") {
                if (data.info) {
                    for (var i = 0; i < data.info.length; i++) {
                        var pState = data.info[i];
                        if (pState.hasOwnProperty("login")) {
                            participants[pState.login] = {
                                name: pState.login,
                                subscribe: attachSubscribe(pState.name),
                                sendMessage: attachSendMessage(pState.name)
                            }
                        } else {
                            participants[pState] = {
                                name: pState,
                                sendMessage: attachSendMessage(pState)
                            }
                        }
                    }
                }
                if (callbacks["STATE"]) {
                    callbacks["STATE"](participants);
                }
            } else if (data.name == "JOINED") {
                participant = {
                    name: data.info,
                    sendMessage: attachSendMessage(data.info)
                };
                participants[participant.name] = participant;
                if (callbacks["JOINED"]) {
                    callbacks["JOINED"](participant);
                }
            } else if (data.name == "LEFT") {
                participant = participants[data.info];
                delete participants[participant.name];
                if (callbacks["LEFT"]) {
                    callbacks["LEFT"](participant);
                }
            } else if (data.name == "PUBLISHED") {
                participant = participants[data.info.login];
                participant.subscribe = attachSubscribe(data.info.name);
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

        /**
         * Get room name
         *
         * @returns {String} Room name
         */
        room.name = function() {
            return name_;
        };

        /**
         * Leave room
         */
        room.leave = function() {
            sendAppCommand("leave", {name: name_});
            delete roomHandlers[name_];
            delete rooms[name_];
        };

        /**
         * Publish stream
         *
         * @param {HTMLElement} display Div element stream should be displayed in
         * @returns {Stream}
         */
        room.publish = function(display) {
            var stream = session.createStream({name: (name_ + "-" + username), display: display, custom: {name: name_}});
            stream.publish();
            return stream;
        };

        room.on = function(event, callback) {
            if (!event) {
                throw new Error("Event can't be null", "TypeError");
            }
            if (!callback || typeof callback !== 'function') {
                throw new Error("Callback needs to be a valid function");
            }
            callbacks[event] = callback;
            return room;
        };

        //participant helpers
        function attachSubscribe(streamName) {
            return function(display){
                var stream = session.createStream({name: streamName, display: display, custom: {name: name_}});
                stream.play();
                return stream;
            }
        }

        function attachSendMessage(recipientName) {
            return function(text) {
                var message = {
                    roomConfig: {
                        name: name_
                    },
                    to: recipientName,
                    text: text
                };
                sendAppCommand("sendMessage", message);
            }
        }

        //sendData helper
        function sendAppCommand(commandName, data) {
            var command = {
                operationId: uuid.v1(),
                payload: {
                    command: commandName,
                    options: data
                }
            };
            session.sendData(command);
        }

        sendAppCommand("join", {name: name_});
        rooms[name_] = room;
        return room;
    };

    return exports;
};

var events = {
    CONNECTED: "CONNECTED",
    JOINED: "JOINED",
    LEFT: "LEFT",
    PUBLISHED: "PUBLISHED",
    FAILED: "FAILED"
};

module.exports = {
    connect: appSession,
    events: events
};