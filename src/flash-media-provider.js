'use strict';

var swfobject = require('swfobject');
var Promise = require('promise-polyfill');
var connections = {};
var flashScope;
var DEFAULT_SDP = "v=0\r\n" +
    "o=- 1988962254 1988962254 IN IP4 0.0.0.0\r\n" +
    "c=IN IP4 0.0.0.0\r\n" +
    "t=0 0\r\n" +
    "a=sdplang:en\r\n" +
    "m=video 0 RTP/AVP 112\r\n" +
    "a=rtpmap:112 H264/90000\r\n" +
    "a=fmtp:112 packetization-mode=1; profile-level-id=420020\r\n" +
    "a=VIDEO_STATE\r\n" +
    "m=audio 0 RTP/AVP 8 0 100\r\n" +
    "a=rtpmap:0 PCMU/8000\r\n" +
    "a=rtpmap:8 PCMA/8000\r\n" +
    "a=rtpmap:100 SPEEX/16000\r\n" +
    "a=AUDIO_STATE\r\n";

var CACHED_INSTANCE_ID = "CACHED_FLASH_INSTANCE";

var createConnection = function(options) {
    return new Promise(function(resolve, reject) {
        var id = options.id;
        var authToken = options.authToken;
        var display = options.display;

        var url = getConnectionUrl(options.mainUrl);

        //todo state from flash instance
        var state = function () {
            return "new";
        };

        var flash = getCacheInstance(display);
        if (flash) {
            flash.reset(id);
            flash.id = id;
            installCallback(id, 'addLogMessage', function(message){
                console.log("Flash["+id+"]:" + message);
            });
            installCallback(id, 'connectionStatus', function(status){
                removeCallback(id, 'connectionStatus');
                if (status === "Success") {
                    connections[id] = exports;
                    resolve(exports);
                } else {
                    reject(new Error("Flash connection returned status " + status));
                }
            });
            flash.connect(url, authToken);
        } else {
            loadSwf(id, display).then(function (swf) {
                installCallback(id, 'connectionStatus', function (status) {
                    removeCallback(id, 'connectionStatus');
                    if (status === "Success") {
                        connections[id] = exports;
                        resolve(exports);
                    } else {
                        reject(new Error("Flash connection returned status " + status));
                    }
                });
                flash = swf;
                flash.connect(url, authToken);
            }).catch(reject);
        }

        var createOffer = function (options) {
            return new Promise(function (resolve, reject) {
                var receiveAudio = options.receiveAudio == undefined ? false : options.receiveAudio;
                var receiveVideo = options.receiveVideo == undefined ? false : options.receiveVideo;
                var sendAudio = options.sendAudio == undefined ? false : options.sendAudio;
                var sendVideo = options.sendVideo == undefined ? false : options.sendVideo;
                var sdp = DEFAULT_SDP;
                if (receiveAudio && sendAudio) {
                    sdp = sdp.replace("AUDIO_STATE", "sendrecv");
                } else if (receiveAudio && !sendAudio) {
                    sdp = sdp.replace("AUDIO_STATE", "recvonly");
                } else if (!receiveAudio && sendAudio) {
                    sdp = sdp.replace("AUDIO_STATE", "sendonly");
                } else {
                    sdp = sdp.replace("AUDIO_STATE", "inactive");
                }
                if (receiveVideo && sendVideo) {
                    sdp = sdp.replace("VIDEO_STATE", "sendrecv");
                } else if (receiveVideo && !sendVideo) {
                    sdp = sdp.replace("VIDEO_STATE", "recvonly");
                } else if (!receiveVideo && sendVideo) {
                    sdp = sdp.replace("VIDEO_STATE", "sendonly");
                } else {
                    sdp = sdp.replace("VIDEO_STATE", "inactive");
                }
                resolve(sdp);
            });
        };

        var setRemoteSdp = function(sdp) {
            return new Promise(function(resolve, reject){
                var state = extractMediaState(sdp);
                setTimeout(function(){
                    flash.setup(state.incoming, state.outgoing, true, true);
                }, 100);
                resolve(connections[id]);
            });
        };

        var close = function(cacheCamera) {
            clearCallbacks(id);
            flash.disconnect();
            if (!getCacheInstance(display) && flash.hasAccessToAudio() && cacheCamera) {
                flash.reset(CACHED_INSTANCE_ID);
                flash.id = CACHED_INSTANCE_ID;
            } else {
                swfobject.removeSWF(flash.id);
            }
        };

        var exports = {};
        exports.state = state;
        exports.createOffer = createOffer;
        exports.setRemoteSdp = setRemoteSdp;
        exports.close = close;
    });
};

//install global part to use flash ExternalInterface
function installFlashScope() {
    if (flashScope == undefined) {
        var globalApiObject = window.Flashphoner;
        if (globalApiObject == undefined) {
            throw new Error("Can't install global scope, there is no window.Flashphoner variable.");
        }
        globalApiObject['FlashApiScope'] = {};
        flashScope = window.Flashphoner.FlashApiScope;
    }
}

function installCallback(id, name, value) {
    installFlashScope();
    if (flashScope[id] == undefined) {
        flashScope[id] = {};
    }
    flashScope[id][name] = value;
}

function removeCallback(id, name) {
    delete flashScope[id][name];
}

function clearCallbacks(id) {
    delete flashScope[id];
}

var getAccessToAudioAndVideo = function(display) {
    return new Promise(function(resolve, reject) {
        if (!getCacheInstance(display)) {
            loadSwf(CACHED_INSTANCE_ID, display).then(function (swf) {
                //todo return camera and mic id
                installCallback(CACHED_INSTANCE_ID, "accessGranted", function () {
                    removeCallback(CACHED_INSTANCE_ID, "accessGranted");
                    resolve({});
                });
                if (!swf.getAccessToAudioAndVideo()) {
                    reject(new Error("Failed to get access to audio and video"));
                }
            });
        } else {
            resolve();
        }
    });
};

//swf helpers
var loadSwf = function(id, display) {
    return new Promise(function(resolve, reject){
        var swf;
        var divWrapper = document.createElement('div');
        divWrapper.id = id;
        display.appendChild(divWrapper);
        var flashvars = {id: id};
        var params = {};
        params.menu = "true";
        params.swliveconnect = "true";
        params.allowfullscreen = "true";
        params.allowscriptaccess = "always";
        params.wmode = "opaque";
        var attributes = {};
        installCallback(id, 'addLogMessage', function(message){
            console.log("Flash["+id+"]:" + message);
        });
        installCallback(id, 'initialized', function(){
            resolve(swf);
        });
        //todo switch from id to element (divWrapper)
        swfobject.embedSWF("media-provider.swf", id, "100%", "100%", "11.2.0", "expressInstall.swf", flashvars, params, attributes, function (ret) {
            swf = ret.ref;
            if (!ret.success) {
                reject(new Error("Failed to load flash media provider swf with id " + id));
            }
        });
    });
};

function getCacheInstance(display) {
    var i;
    for (i = 0; i < display.children.length; i++) {
        if (display.children[i] && display.children[i].id == CACHED_INSTANCE_ID) {
            console.log("FOUND FLASH CACHED INSTANCE");
            return display.children[i];
        }
    }
}

//sdp helper, extract state from server sdp
function extractMediaState(sdp) {
    var state = {
        incoming: false,
        outgoing: false
    };
    if (sdp.indexOf("a=sendrecv") != -1) {
        state.incoming = true;
        state.outgoing = true;
    } else if (sdp.indexOf("a=recvonly") != -1) {
        state.outgoing = true;
    } else if (sdp.indexOf("a=sendonly") != -1) {
        state.incoming = true;
    }
    return state;
}

//connection ip
function getConnectionUrl(mainUrl) {
    var a = document.createElement('a');
    a.href = mainUrl;
    return "rtmfp://"+ a.hostname+":1935/";
}

/**
 * Check Flash Player available
 *
 * @returns {boolean} flash player available
 */
var available = function() {
    return swfobject.hasFlashPlayerVersion("11.2.0");
};

module.exports = {
    createConnection: createConnection,
    getAccessToAudioAndVideo: getAccessToAudioAndVideo,
    available: available
};


