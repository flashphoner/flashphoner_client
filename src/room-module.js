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
var appSession = function(options) {
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

    exports.disconnect = function(){
        session.disconnect();
    };

    exports.status = function() {
        return session.status();
    };

    exports.id = function() {
        return session.id();
    };

    exports.getRooms = function(){
        return copyObjectToArray(rooms);
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
        roomHandlers[name_] = function(data) {
            var participant;
            if (data.name == "STATE") {
                if (data.info) {
                    for (var i = 0; i < data.info.length; i++) {
                        var pState = data.info[i];
                        if (pState.hasOwnProperty("login")) {
                            participants[pState.login] = {
                                name: pState.login,
                                play: attachPlay(pState.name),
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
                    callbacks["STATE"](room);
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
            sendAppCommand("leave", {name: name_}).then(function(){});
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

        room.getParticipants = function() {
            return copyObjectToArray(participants);
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

        sendAppCommand("join", {name: name_}).then(function(){}, function(){
            if (callbacks["FAILED"]) {
                callbacks["FAILED"](room);
            }
        });
        rooms[name_] = room;
        return room;
    };

    return exports;
};

function copyObjectToArray(obj) {
    var ret = [];
    for (var prop in obj) {
        if(obj.hasOwnProperty(prop)) {
            ret.push(obj[prop]);
        }
    }
    return ret;
}

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