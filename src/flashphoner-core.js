'use strict';

var uuid = require('node-uuid');
var constants = require("./constants.js");
var MediaProvider = {
    WebRTC: require("./webrtc-media-provider.js")
};

var sessions = {};

var initialized = false;

var init = function(options) {
    initialized = true;
};

var getSessions = function() {
    var sessionsCopy = [];
    for (var prop in sessions) {
        if(sessions.hasOwnProperty(prop)) {
            sessionsCopy.push(sessions[prop]);
        }
    }
    return sessionsCopy;
};

var getSession = function(id) {
    return sessions[id];
};

var createSession = function(options) {
    if (!initialized) {
        throw new Error("Flashphoner API is not initialized");
    }

    if (!options || !options.urlServer) {
        throw new TypeError("options.urlServer must be provided");
    }

    var id = uuid.v1();
    var sessionStatus = constants.SESSION_STATUS.PENDING;
    var urlServer = options.urlServer;
    var appKey = options.appKey || "defaultApp";
    var authToken;
    var mediaConnections = {};
    var streamRefreshHandlers = {};
    var streams = {};
    var exports = {};
    var callbacks = {};

    //connect session to server
    var wsConnection = new WebSocket(urlServer);
    wsConnection.onerror = function() {
        onSessionStatusChange(constants.SESSION_STATUS.FAILED);
    };
    wsConnection.onclose = function() {
        onSessionStatusChange(constants.SESSION_STATUS.DISCONNECTED);
    };
    wsConnection.onopen = function() {
        onSessionStatusChange(constants.SESSION_STATUS.CONNECTED);
        wsConnection.send(JSON.stringify({
            message: "connection",
            data: [
                {
                    appKey: appKey,
                    mediaProviders: ["WebRTC"]
                }
            ]
        }));
    };
    wsConnection.onmessage = function(event) {
        //console.dir(event);
        var data = JSON.parse(event.data);
        var message = data.message;
        var obj = data.data[0];
        switch (message) {
            case 'ping':
                wsConnection.send(JSON.stringify({message: "pong", data: []}));
                break;
            case 'getUserData':
                authToken = obj.authToken;
                onSessionStatusChange(constants.SESSION_STATUS.ESTABLISHED);
                break;
            case 'setRemoteSDP':
                var mediaConnectionId = data.data[0].trim();
                var sdp = data.data[1];
                if (mediaConnections[mediaConnectionId]) {
                    mediaConnections[mediaConnectionId].setRemoteSdp(sdp).then(function(){
                    });
                } else {
                    console.error("Media connection not found, id " + mediaConnectionId);
                }
                break;
            case 'notifyStreamStatusEvent':
                if (streamRefreshHandlers[obj.mediaSessionId]) {
                    streamRefreshHandlers[obj.mediaSessionId](obj);
                }
                break;
            default:
                //console.log("Unknown server message " + message);
        }
    };

    function onSessionStatusChange(newStatus) {
        sessionStatus = newStatus;
        if (sessionStatus == constants.SESSION_STATUS.DISCONNECTED || sessionStatus == constants.SESSION_STATUS.FAILED) {
            //remove session from list
            delete sessions[id];
        }
        if (callbacks[sessionStatus]) {
            callbacks[sessionStatus](exports);
        }
    }

    var createStream = function(options){
        //check session state
        if (sessionStatus !== constants.SESSION_STATUS.ESTABLISHED) {
            throw new Error('Invalid session state');
        }

        //check options
        if (!options) {
            throw new TypeError("options must be provided");
        }
        if (!options.name) {
            throw new TypeError("options.name must be provided");
        }

        var id = uuid.v1();
        var name = options.name;
        var mediaProvider = "WebRTC";
        var published = false;
        var status = constants.STREAM_STATUS.NEW;
        var remoteElement = options.remoteElement || document.createElement('video');
        var callbacks = {};
        streamRefreshHandlers[id] = function(stream) {
            status = stream.status;
            if (status == constants.STREAM_STATUS.FAILED || status == constants.STREAM_STATUS.STOPPED ||
                status == constants.STREAM_STATUS.UNPUBLISHED) {
                delete streams[id];
                delete streamRefreshHandlers[id];
                mediaConnections[id].close();
                delete mediaConnections[id];
            }
            if (callbacks[status]) {
                callbacks[status](exports);
            }
        };
        var exports = {};
        exports.play = function() {
            if (status !== constants.STREAM_STATUS.NEW) {
                throw new Error("Invalid stream state");
            }
            //create mediaProvider connection
            var mediaConnection = MediaProvider[mediaProvider].createConnection({
                id: id,
                remoteElement: remoteElement
            });
            mediaConnections[id] = mediaConnection;
            mediaConnection.createOffer().then(function(sdp){
                //webrtc offer created, request stream
                wsConnection.send(JSON.stringify({message: "playStream", data: [{
                    mediaSessionId: id,
                    name: name,
                    published: published,
                    hasVideo: true,
                    hasAudio: true,
                    status: status,
                    record: false,
                    sdp: sdp
                }]}));
            });
        };

        exports.publish = function() {
            if (status !== constants.STREAM_STATUS.NEW) {
                throw new Error("Invalid stream state");
            }
            //get access to camera
            MediaProvider[mediaProvider].getAccessToAudioAndVideo().then(function(stream){
                //show local camera
                remoteElement.srcObject = stream;
                //mute audio
                remoteElement.muted = true;
                remoteElement.play();
                published = true;
                //create mediaProvider connection
                var mediaConnection = MediaProvider[mediaProvider].createConnection({
                    id: id,
                    localStream: stream
                });
                mediaConnections[id] = mediaConnection;
                mediaConnection.createOffer().then(function(sdp){
                    //webrtc offer created, request stream
                    wsConnection.send(JSON.stringify({message: "publishStream", data: [{
                        mediaSessionId: id,
                        name: name,
                        published: published,
                        hasVideo: true,
                        hasAudio: true,
                        status: status,
                        record: false,
                        sdp: sdp
                    }]}));
                });

            }).catch(function(error){
                throw error;
            });
        };

        exports.stop = function() {
            if (published) {
                if (remoteElement) {
                    remoteElement.pause();
                }
                wsConnection.send(JSON.stringify({message: "unPublishStream", data: [{
                    mediaSessionId: id,
                    name: name,
                    published: published,
                    hasVideo: true,
                    hasAudio: true,
                    status: status,
                    record: false
                }]}));
            } else {
                wsConnection.send(JSON.stringify({message: "stopStream", data: [{
                    mediaSessionId: id,
                    name: name,
                    published: published,
                    hasVideo: true,
                    hasAudio: true,
                    status: status,
                    record: false
                }]}));
            }
        };

        exports.status = function() {
            return status;
        };

        exports.id = function() {
            return id;
        };

        exports.name = function() {
            return name;
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

        streams[id] = exports;
        return exports;

    };

    exports.disconnect = function(){
        if (wsConnection) {
            wsConnection.close();
        }
    };

    exports.id = function() {
        return id;
    };

    exports.status = function() {
        return sessionStatus;
    };

    exports.getStream = function(streamId) {
        return streams[streamId];
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

    exports.createStream = createStream;

    //save interface to global map
    sessions[id] = exports;
    return exports;
};

module.exports = {
    init: init,
    createSession: createSession,
    getSession: getSession,
    getSessions: getSessions,
    constants: constants
};