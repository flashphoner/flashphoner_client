'use strict';

var swfobject = require('swfobject');
var Promise = require('promise-polyfill');
var uuid_v1 = require('uuid/v1');
var connections = {};
var flashScope;
var swfLocation = "media-provider.swf";
var DEFAULT_SDP = "v=0\r\n" +
    "o=- 1988962254 1988962254 IN IP4 0.0.0.0\r\n" +
    "c=IN IP4 0.0.0.0\r\n" +
    "t=0 0\r\n" +
    "a=sdplang:en\r\n" +
    "m=video 0 RTP/AVP 112\r\n" +
    "a=rtpmap:112 H264/90000\r\n" +
    "a=fmtp:112 packetization-mode=1; profile-level-id=420020\r\n" +
    "a=VIDEO_STATE\r\n" +
    "m=audio 0 RTP/AVP 8 0 100 102 103 104 105 106 107 108 109 110\r\n" +
    "a=rtpmap:0 PCMU/8000\r\n" +
    "a=rtpmap:8 PCMA/8000\r\n" +
    "a=rtpmap:100 SPEEX/16000\r\n" +
    "a=rtpmap:102 mpeg4-generic/48000/1\r\n" +
    "a=rtpmap:103 mpeg4-generic/8000/1\r\n" +
    "a=rtpmap:104 mpeg4-generic/11025/1\r\n" +
    "a=rtpmap:105 mpeg4-generic/12000/1\r\n" +
    "a=rtpmap:106 mpeg4-generic/16000/1\r\n" +
    "a=rtpmap:107 mpeg4-generic/22050/1\r\n" +
    "a=rtpmap:108 mpeg4-generic/24000/1\r\n" +
    "a=rtpmap:109 mpeg4-generic/32000/1\r\n" +
    "a=rtpmap:110 mpeg4-generic/44100/1\r\n" +
    "a=AUDIO_STATE\r\n";

var CACHED_INSTANCE_POSTFIX = "CACHED_FLASH_INSTANCE";
var defaultConstraints;
var logger;
var LOG_PREFIX = "flash";

var createConnection = function(options) {
    return new Promise(function(resolve, reject) {
        var id = options.id;
        var authToken = options.authToken;
        var display = options.display || options.localDisplay;
        var flashBufferTime = options.flashBufferTime || 0;

        var url = getConnectionUrl(options.mainUrl, options.flashProto, options.flashPort);

        //todo state from flash instance
        var state = function () {
            return "new";
        };

        var flash = getCacheInstance(display);
        if (flash) {
            flash.reset(id);
            flash.id = id;
            installCallback(flash, 'addLogMessage', function(message){
                logger.info(LOG_PREFIX, "Flash["+id+"]:" + message);
            });
            installCallback(flash, 'connectionStatus', function(status){
                removeCallback(flash, 'connectionStatus');
                if (status === "Success") {
                    connections[id] = exports;
                    resolve(exports);
                } else {
                    reject(new Error("Flash connection returned status " + status));
                }
            });
            flash.connect(url, authToken, options.login);
        } else {
            loadSwf(id, display, options.flashShowFullScreenButton || "false").then(function (swf) {
                installCallback(swf, 'connectionStatus', function (status) {
                    removeCallback(swf, 'connectionStatus');
                    if (status === "Success") {
                        connections[id] = exports;
                        resolve(exports);
                    } else {
                        reject(new Error("Flash connection returned status " + status));
                    }
                });
                flash = swf;
                flash.connect(url, authToken, options.login);
            }).catch(reject);
        }

        var createOffer = function (options) {
            return new Promise(function (resolve, reject) {
                var receiveAudio = options.receiveAudio == undefined ? false : options.receiveAudio;
                var receiveVideo = options.receiveVideo == undefined ? false : options.receiveVideo;
                var sendAudio = flash.isHasAudio();
                var sendVideo = flash.isHasVideo();
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
                var o = {};
                o.sdp = sdp;
                o.hasAudio = flash.isHasAudio();
                o.hasVideo = flash.isHasVideo();
                resolve(o);
            });
        };

        var createAnswer = function (options) {
            return new Promise(function (resolve, reject) {
                var receiveAudio = options.receiveAudio == undefined ? true : options.receiveAudio;
                var receiveVideo = options.receiveVideo == undefined ? false : options.receiveVideo;
                var sendAudio = flash.isHasAudio();
                var sendVideo = flash.isHasVideo();
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

        var changeAudioCodec = function(codec) {
            flash.changeAudioCodec(codec);
        };

        var setRemoteSdp = function(sdp, reinit, id) {
            logger.debug(LOG_PREFIX,"setRemoteSDP:");
            logger.debug(LOG_PREFIX,sdp);
            return new Promise(function(resolve, reject){
                var state = extractMediaState(sdp);
                if (reinit)
                    flash.updateId(id);
                flash.setup(state.incoming, state.outgoing, flash.isHasAudio(), flash.isHasVideo(), flashBufferTime, reinit);
                resolve(connections[id]);
            });
        };

        var close = function(cacheCamera) {
            if (flash) {
                flash.disconnect();
                if (!getCacheInstance(display) && flash.hasAccessToAudio() && cacheCamera) {
                    cacheInstance(flash);
                } else {
                    clearCallbacks(flash);
                    swfobject.removeSWF(flash.id);
                }
                flash = null;
            }
        };

        var getVolume = function() {
            if (flash) {
                return flash.getVolume();
            }
            return -1;
        };
        var setVolume = function(volume) {
            if (flash) {
                flash.setVolume(volume);
            }
        };
        var muteAudio = function() {
            if (flash) {
                flash.muteAudio();
            }
        };
        var unmuteAudio = function() {
            if (flash) {
                flash.unmuteAudio();
            }
        };
        var isAudioMuted = function() {
            if (flash) {
                return flash.isAudioMuted();
            }
            return true;
        };
        var muteVideo = function() {
            if (flash) {
                flash.muteVideo();
            }
        };
        var unmuteVideo = function() {
            if (flash) {
                flash.unmuteVideo();
            }
        };
        var isVideoMuted = function() {
            if (flash) {
                return flash.isVideoMuted();
            }
            return true;
        };
        var getStats = function(callbackFn) {
            if (flash) {
                var statistics = flash.getStats();
                var param;
                if (statistics.hasOwnProperty("incoming")) {
                    for (param in statistics.incoming.info) {
                        if (param.indexOf("audio") > -1) {
                            statistics.incoming.audio[param] = statistics.incoming.info[param];
                        }
                        if (param.indexOf("video") > -1) {
                            statistics.incoming.video[param] = statistics.incoming.info[param];
                        }
                    }
                    delete statistics.incoming.info;
                }
                if (statistics.hasOwnProperty("outgoing")) {
                    for (param in statistics.outgoing.info) {
                        if (param.indexOf("audio") > -1) {
                            statistics.outgoing.audio[param] = statistics.outgoing.info[param];
                        }
                        if (param.indexOf("video") > -1) {
                            statistics.outgoing.video[param] = statistics.outgoing.info[param];
                        }
                    }
                    delete statistics.outgoing.info;
                }
                statistics.type = "flash";
                callbackFn(statistics);
            }
        };

        var fullScreen = function() {
            if (flash) {
                flash.fullScreen();
            }
        };

        var switchCam = function () {
        };

        var switchMic = function () {
        };

        var setMicrophoneGain = function (volume) {
        };

        var switchToScreen = function () {
        };

        var switchToCam = function () {
        };

        var exports = {};
        exports.state = state;
        exports.createOffer = createOffer;
        exports.createAnswer = createAnswer;
        exports.setRemoteSdp = setRemoteSdp;
        exports.changeAudioCodec = changeAudioCodec;
        exports.close = close;
        exports.setVolume = setVolume;
        exports.setMicrophoneGain = setMicrophoneGain;
        exports.getVolume = getVolume;
        exports.muteAudio = muteAudio;
        exports.unmuteAudio = unmuteAudio;
        exports.isAudioMuted = isAudioMuted;
        exports.muteVideo = muteVideo;
        exports.unmuteVideo = unmuteVideo;
        exports.isVideoMuted = isVideoMuted;
        exports.getStats = getStats;
        exports.fullScreen = fullScreen;
        exports.switchCam = switchCam;
        exports.switchMic = switchMic;
        exports.switchToScreen = switchToScreen;
        exports.switchToCam = switchToCam;
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

/**
 *
 * @param id This can be string representing scopeId or object element (swf)
 * @param name callback name
 * @param value callback function
 */
function installCallback(id, name, value) {
    installFlashScope();
    var scopeId = getInstanceScopeId(id);
    if (flashScope[scopeId] == undefined) {
        flashScope[scopeId] = {};
    }
    flashScope[scopeId][name] = value;
}

/**
 *
 * @param id This can be string representing scopeId or object element (swf)
 * @param name callback name
 */
function removeCallback(id, name) {
    delete flashScope[getInstanceScopeId(id)][name];
}

function cacheInstance(flash) {
    installCallback(flash, 'addLogMessage', function(message){
        logger.info(LOG_PREFIX, "Flash["+flash.id+"]:" + message);
    });
    removeCallback(flash, "connectionStatus");
    flash.reset(flash.id + CACHED_INSTANCE_POSTFIX);
    flash.id = flash.id + CACHED_INSTANCE_POSTFIX;
}

/**
 *
 * @param id This can be string representing scopeId or object element (swf)
 */
function clearCallbacks(id) {
    delete flashScope[getInstanceScopeId(id)];
}

function getInstanceScopeId(flash) {
    if (typeof flash === "string") {
        return flash;
    }
    for (var i = 0; i < flash.children.length; i++) {
        if (flash.children[i].name == "scopeId") {
            return flash.children[i].value;
        }
    }
}

var getMediaAccess = function(constraints, display) {
    return new Promise(function(resolve, reject) {
        var flash = getCacheInstance(display);
        if (!flash) {
            var id = uuid_v1() + CACHED_INSTANCE_POSTFIX;
            loadSwf(id, display).then(function (swf) {
                //todo return camera and mic id
                installCallback(swf, "accessGranted", function () {
                    removeCallback(swf, "accessGranted");
                    resolve(display);
                });
                installCallback(swf, "accessDenied", function () {
                    removeCallback(swf, "accessDenied");
                    reject(new Error("Failed to get access to audio and video"));
                });
                if (!constraints) {
                    constraints = defaultConstraints;
                }
                if (!swf.getMediaAccess(normalizeConstraints(constraints))) {
                    reject(new Error("Failed to get access to audio and video"));
                }
            });
        } else {
            installCallback(flash, "accessGranted", function () {
                removeCallback(flash, "accessGranted");
                resolve(display);
            });
            installCallback(flash, "accessDenied", function () {
                removeCallback(flash, "accessDenied");
                reject(new Error("Failed to get access to audio and video"));
            });
            if (!flash.getMediaAccess(normalizeConstraints(constraints))) {
                reject(new Error("Failed to get access to audio and video"));
            }
        }
    });
};

var releaseMedia = function(display) {
    var flash = getCacheInstance(display);
    if (flash) {
        clearCallbacks(flash);
        swfobject.removeSWF(flash.id);
        return true;
    }
    return false;
};

//swf helpers
//TODO wrap params to object
var loadSwf = function(id, display, showFullScreenButton) {
    return new Promise(function(resolve, reject){
        var swf;
        var divWrapper = document.createElement('div');
        divWrapper.id = id;
        display.appendChild(divWrapper);
        var flashvars = {
            id: id,
            showFullScreenButton: showFullScreenButton || "false"
        };
        var params = {};
        params.menu = "true";
        params.swliveconnect = "true";
        params.allowFullScreen = "true";
        params.allowscriptaccess = "always";
        params.wmode = "opaque";
        params.scopeId = id;
        var attributes = {};
        attributes.allowfullscreen = "true";
        installCallback(id, 'addLogMessage', function(message){
            logger.info(LOG_PREFIX, "Flash["+id+"]:" + message);
        });
        installCallback(id, 'initialized', function(){
            resolve(swf);
        });
        installCallback(id, 'videoResolution', function(width, height){
            swf.videoWidth = width;
            swf.videoHeight = height;
            setTimeout(function(){
                var event = new CustomEvent("resize");
                swf.dispatchEvent(event);
            }, 10);
            setTimeout(function(){
                var event = new CustomEvent("playing");
                swf.dispatchEvent(event);
            }, 10);
        });
        //todo switch from id to element (divWrapper)
        swfobject.embedSWF(swfLocation, id, "100%", "100%", "11.2.0", "expressInstall.swf", flashvars, params, attributes, function (ret) {
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
        if (display.children[i] && display.children[i].id.indexOf(CACHED_INSTANCE_POSTFIX) != -1) {
            logger.info(LOG_PREFIX, "FOUND FLASH CACHED INSTANCE, id " + display.children[i].id);
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
function getConnectionUrl(mainUrl, proto, port) {
    var a = document.createElement('a');
    a.href = mainUrl;
    return proto +"://"+ a.hostname+":"+port+"/";
}

/**
 * Check Flash Player available
 *
 * @returns {boolean} flash player available
 */
var available = function() {
    return swfobject.hasFlashPlayerVersion("11.2.0");
};

var listDevices = function() {
    return new Promise(function(resolve, reject) {
        var display = document.createElement('div');
        display.setAttribute("style","width:1px;height:1px");
        var id = uuid_v1();
        //attach display to document, otherwise swf won't be loaded
        document.body.appendChild(display);
        loadSwf(id, display).then(function(swf){
            var list = swf.listDevices();
            //remove swf, display
            swfobject.removeSWF(id);
            document.body.removeChild(display);
            resolve(list);
        }, reject);
    });
};

function normalizeConstraints(constraints) {
    if (constraints && typeof constraints.video !== 'undefined') {
        if (constraints.video.hasOwnProperty('frameRate') && constraints.video.frameRate !== 'object') {
            var frameRate = constraints.video.frameRate;
            if (frameRate == 0 || isNaN(frameRate)) {
                delete constraints.video.frameRate;
            }
        }
        if (constraints.video === false) {
            delete constraints.video;
        } else if (constraints.video === true) {
            // Set default video constraints
            constraints.video= {
                width: 320,
                height: 240
            }
        } else {
            if (constraints.video.hasOwnProperty('width')) {
                var width = constraints.video.width;
                if (isNaN(width) || width == 0) {
                    logger.warn(LOG_PREFIX, "Width or height property has zero/NaN value, set default resolution 320x240");
                    constraints.video.width = 320;
                    constraints.video.height = 240;
                }
                if (typeof width == 'object') {
                    constraints.video.width = constraints.video.width.exact || constraints.video.width.max || constraints.video.width.min;
                }
            }
            if (constraints.video.hasOwnProperty('height')) {
                var height = constraints.video.height;
                if (isNaN(height) || height == 0) {
                    logger.warn(LOG_PREFIX, "Width or height property has zero/NaN value, set default resolution 320x240");
                    constraints.video.width = 320;
                    constraints.video.height = 240;
                }
                if (typeof height == 'object') {
                    constraints.video.height = constraints.video.height.exact || constraints.video.height.max || constraints.video.height.min;
                }
            }
        }
    }
    return constraints;
}

//CustomEvent IE polyfill
(function () {
    function CustomEvent ( event, params ) {
        params = params || { bubbles: false, cancelable: false, detail: undefined };
        var evt = document.createEvent( 'CustomEvent' );
        evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
        return evt;
    }

    CustomEvent.prototype = window.Event.prototype;

    window.CustomEvent = CustomEvent;
})();

var playFirstSound = function () {
    return true;
};

var playFirstVideo = function () {
    return new Promise(function (resolve, reject) {
        resolve();
    });
};

module.exports = {
    createConnection: createConnection,
    getMediaAccess: getMediaAccess,
    releaseMedia: releaseMedia,
    available: available,
    listDevices: listDevices,
    playFirstSound: playFirstSound,
    playFirstVideo: playFirstVideo,
    configure: function(configuration) {
        swfLocation = configuration.flashMediaProviderSwfLocation;
        defaultConstraints = configuration.constraints;
        logger = configuration.logger;
        logger.info(LOG_PREFIX, "Initialized");
    }
};


