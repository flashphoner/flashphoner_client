'use strict';

var PULL_PATH = "/rest-api/pull";
var STREAM_PATH = "/rest-api/stream";
var CONNECTION_PATH = "/rest-api/connection";
var PUSH_PATH = "/rest-api/push";
var RTSP_PATH = "/rest-api/rtsp";
var API_PATH = "/rest-api/api";
var CDN_PATH = "/rest-api/cdn";
var CALL_PATH = "/rest-api/call";
var MIXER_PATH = "/rest-api/mixer";

var instance = function (url, coreUrl) {
    var pullApi = function() {
        var api = url + PULL_PATH;
        var pull = function (remoteUri, localName, remoteName) {
            return send(api + "/pull", {
                uri: remoteUri,
                localStreamName: localName,
                remoteStreamName: remoteName
            });
        };
        var push = function (remoteUri, localName, remoteName) {
            return send(api + "/push", {
                uri: remoteUri,
                localStreamName: localName,
                remoteStreamName: remoteName
            });
        };
        var terminate = function (localName, remoteName) {
            return send(api + "/terminate", {
                localStreamName: localName,
                remoteStreamName: remoteName
            });
        };
        var findAll = function () {
            return send(api + "/find_all");
        };
        return {
            pull: pull,
            push: push,
            terminate: terminate,
            findAll: findAll
        };
    };

    var stream = function() {
        var api = url + STREAM_PATH;
        var find = function (mediaSessionId, name, published, metrics) {
            if (metrics) {
                return send(api + "/find", {
                    mediaSessionId: mediaSessionId,
                    name: name,
                    published: published,
                    display: ["metrics"]
                });
            }
            return send(api + "/find", {
                mediaSessionId: mediaSessionId,
                name: name,
                published: published
            });
        };
        var findAll = function () {
            return send(api + "/find_all");
        };
        var terminate = function (mediaSessionId) {
            return send(api + "/terminate", {
                mediaSessionId: mediaSessionId
            });
        };
        return {
            find: find,
            findAll: findAll,
            terminate: terminate
        };
    };

    var connection = function() {
        var api = url + CONNECTION_PATH;
        var find = function (clientVersion) {
            return send(api + "/find", {
                clientVersion: clientVersion
            });
        };
        var findAll = function () {
            return send(api + "/find_all");
        };
        var setLogLevel = function (sessionId, logLevel) {
            return send(api + "/set_log_level", {
                sessionId: sessionId,
                logLevel: logLevel
            });
        };
        var terminate = function (sessionId) {
            return send(api + "/terminate", {
                sessionId: sessionId
            });
        };
        return {
            find: find,
            findAll: findAll,
            setLogLevel: setLogLevel,
            terminate: terminate
        }
    };

    var push = function() {
        var api = url + PUSH_PATH;
        var push = function (streamName, rtmpUrl, fullUrl = false) {
            return send(api + "/startup", {
                streamName: streamName,
                rtmpUrl: rtmpUrl,
                rtmpTransponderFullUrl: fullUrl
            });
        };
        var find = function (streamName, rtmpUrl) {
            return send(api + "/find", {
                streamName: streamName,
                rtmpUrl: rtmpUrl
            });
        };
        var findAll = function () {
            return send(api + "/find_all");
        };
        var terminate = function (mediaSessionId) {
            return send(api + "/terminate", {
                mediaSessionId: mediaSessionId
            });
        };
        var mute = function (mediaSessionId) {
            return send(api + "/mute", {
                mediaSessionId: mediaSessionId
            });
        };
        var unmute = function (mediaSessionId) {
            return send(api + "/unmute", {
                mediaSessionId: mediaSessionId
            });
        };
        var soundOn = function (mediaSessionId, soundFile, loop) {
            return send(api + "/sound_on", {
                mediaSessionId: mediaSessionId,
                soundFile: soundFile,
                loop: loop
            });
        };
        var soundOff = function (mediaSessionId) {
            return send(api + "/sound_off", {
                mediaSessionId: mediaSessionId,
                soundFile: soundFile,
                loop: loop
            });
        };
        return {
            push: push,
            find: find,
            findAll: findAll,
            terminate: terminate,
            mute: mute,
            unmute: unmute,
            soundOn: soundOn,
            soundOff: soundOff
        };
    };

    var stat = function() {
        var api = "?action=stat";
        var poll = function () {
            return new Promise(function (resolve, reject) {
                var preventCache = new Date();
                send(coreUrl + api + "&preventCache="+preventCache, null, true).then(function (stats) {
                    var split = stats.split("\n");
                    var ret = {};
                    var currentHeader = "unknown";
                    for (var i = 0; i < split.length; i++) {
                        if (split[i][0] == "-") {
                            //header
                            var header = split[i].match(/-+([A-z]+) */);
                            if (header[1]) {
                                //found and parsed
                                currentHeader = header[1].toLowerCase();
                                ret[currentHeader] = {};
                            } else {
                                console.warn("Failed to parse header from " + split[i]);
                            }
                        } else {
                            var pair = split[i].split("=");
                            ret[currentHeader][pair[0]] = pair[1];
                        }
                    }
                    resolve(ret);
                }, reject);
            });
        };
        return {
            poll: poll
        };
    };
    var rtsp = function() {
        var api = url + RTSP_PATH;
        var pull = function (uri) {
            return send(api + "/startup", {
                uri: uri
            });
        };
        var find = function (uri, status) {
            return send(api + "/find", {
                uri: uri,
                status: status
            });
        };
        var findAll = function () {
            return send(api + "/find_all");
        };
        var terminate = function (uri, status) {
            return send(api + "/terminate", {
                uri: uri,
                status: status
            });
        };
        return {
            pull: pull,
            find: find,
            findAll: findAll,
            terminate: terminate
        };
    };
    var cdn = function() {
        var api = url + CDN_PATH;
        var showRoutes = function() {
            return send(api + "/show_routes");
        };
        return {
            showRoutes: showRoutes
        };
    };
    var api = function() {
        var api = url + API_PATH;
        var createSession = function(connection) {
            return send(api + "/create-session", connection);
        };
        var findAll = function () {
            return send(api + "/find_all");
        };
        var terminate = function (connection) {
            return send(api + "/terminate", connection);
        };
        var call = function (call) {
            return send(api + "/call", call);
        };
        var hangup = function (call) {
            return send(api + "/hangup", call);
        };
        return {
            createSession: createSession,
            findAll: findAll,
            terminate: terminate,
            call: call,
            hangup: hangup
        }
    };
    var call = function() {
        var api = url + CALL_PATH;
        var startup = function(params) {
            return send(api + "/startup", params);
        };
        var findAll = function() {
            return send(api + "/find_all");
        };
        var find = function(params) {
            return send(api + "/find", params);
        };
        var terminate = function(params) {
            return send(api + "/terminate", params);
        };
        var sendDtmf = function(params) {
            return send(api + "/send_dtmf", params);
        };
        var injectSound = function(params) {
            return send(api + "/inject_sound", params);
        };
        var injectStream = function() {
            var subApi = api + "/inject_stream";
            var startup = function(params) {
                return send(subApi + "/startup", params);
            };
            var terminate = function(params) {
                return send(subApi + "/terminate", params);
            };
            return {
                startup : startup,
                terminate : terminate
            }
        };
        return {
            startup : startup,
            findAll : findAll,
            find : find,
            terminate : terminate,
            sendDtmf : sendDtmf,
            injectSound : injectSound,
            injectStream : injectStream()
        }
    };
    var mixer = function() {
        var api = url + MIXER_PATH;
        var startup = function(params) {
            return send(api + "/startup", params);
        };
        var add = function(params) {
            return send(api + "/add", params);
        };
        var remove = function(params) {
            return send(api + "/remove", params);
        };
        var findAll = function() {
            return send(api + "/find_all");
        };
        var terminate = function(params) {
            return send(api + "/terminate", params);
        };
        return {
            startup : startup,
            add : add,
            remove : remove,
            findAll : findAll,
            terminate : terminate
        }
    };

    return {
        pull: pullApi(),
        stream: stream(),
        connection: connection(),
        push: push(),
        rtsp: rtsp(),
        stat: stat(),
        api: api(),
        cdn: cdn(),
        call: call(),
        mixer: mixer()
    };
};
/** XHR WRAPPER **/
var send = function(uri, data, responseIsText) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        if (data) {
            xhr.open('POST', uri, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        } else {
            xhr.open('GET', uri, true);
        }
        xhr.responseType = 'text';
        xhr.onload = function (e) {
            if (this.status == 200) {
                if (this.response) {
                    if (!responseIsText) {
                        resolve(JSON.parse(this.response));
                    } else {
                        resolve(this.response);
                    }
                } else {
                    resolve();
                }
            } else {
                reject(this);
            }
        };
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4){
                if(xhr.status === 200){
                    //success
                } else {
                    reject();
                }
            }
        };
        if (data) {
            xhr.send(JSON.stringify(data));
        } else {
            xhr.send();
        }
    });
};



module.exports = {
    instance: instance
};
