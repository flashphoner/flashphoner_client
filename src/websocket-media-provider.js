'use strict';

var WSPlayer = require('./WSPlayer').WSPlayer;
var util = require('./util');
var WSPlayer_ = new WSPlayer();
var connections = {};
var receiverLocation = "./WSReceiver2.js";
var decoderLocation = "./video-worker2.js";
var DEFAULT_SDP = "v=0\r\n" +
    "o=- 1988962254 1988962254 IN IP4 0.0.0.0\r\n" +
    "c=IN IP4 0.0.0.0\r\n" +
    "t=0 0\r\n" +
    "a=sdplang:en\r\n" +
    "m=video 0 RTP/AVP 32\r\n" +
    "a=rtpmap:32 MPV/90000\r\n" +
    "a=recvonly\r\n" +
    "m=audio 0 RTP/AVP 0\r\n" +
    "a=rtpmap:0 PCMU/8000\r\n" +
    "a=recvonly\r\n";

var logger;
var LOG_PREFIX = "websocket";
var audioContext;

var createConnection = function(options, handlers) {
    return new Promise(function(resolve, reject) {
        var id = options.id;
        var display = options.display;

        var canvas = document.createElement("canvas");
        display.appendChild(canvas);
        canvas.id = id;

        var createOffer = function(options) {
            return new Promise(function (resolve, reject) {
                var o ={};
                o.sdp = DEFAULT_SDP;
                o.player = WSPlayer_;
                resolve(o);
            });
        };
        var setRemoteSdp = function(sdp) {
            return new Promise(function (resolve,reject){
                resolve();
            });
        };
        var close = function() {
            WSPlayer_.stop();
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            delete connections[id];
        };
        var unmuteRemoteAudio = function () {
            audioContext.resume();
        };
        var muteRemoteAudio = function () {
            audioContext.suspend();
        };
        var isRemoteAudioMuted = function () {
            if(audioContext.state == 'suspended') {
                return true;
            }
            return false;
        };
        var setVolume = function(volume) {
            WSPlayer_.setVolume(volume);
        };
        var getVolume = function() {
            if (WSPlayer_) {
                return WSPlayer_.getVolume();
            }
            return -1;
        };
        var fullScreen = function() {
            if (canvas) {
                if (!document.fullscreenElement && !document.mozFullScreenElement &&
                    !document.webkitFullscreenElement && !document.msFullscreenElement) {
                    if (canvas.requestFullscreen) {
                        canvas.requestFullscreen();
                    } else if (canvas.msRequestFullscreen) {
                        canvas.msRequestFullscreen();
                    } else if (canvas.mozRequestFullScreen) {
                        canvas.mozRequestFullScreen();
                    } else if (canvas.webkitRequestFullscreen) {
                        canvas.webkitRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                }
            }
        }

        try {

            var config = {};
            config.urlWsServer = options.mainUrl;
            config.token = options.authToken;
            config.receiverPath = receiverLocation;
            config.decoderPath = decoderLocation;
            config.streamId = id;
            config.api = handlers;
            config.canvas = canvas;
            config.videoWidth = 320;
            config.videoHeight = 240;
            config.startWithVideoOnly = false;
            config.keepLastFrame = false;

            var reinit = false;
            if (WSPlayer_.initialized) {
                reinit = true;
            }
            WSPlayer_.initLogger(0);
            WSPlayer_.init(config, audioContext, reinit);
        } catch (e) {
            reject(new Error('Failed to init stream receiver ' + e));
        }
        var exports = {};
        exports.createOffer = createOffer;
        exports.setRemoteSdp = setRemoteSdp;
        exports.close = close;
        exports.unmuteRemoteAudio = unmuteRemoteAudio;
        exports.muteRemoteAudio = muteRemoteAudio;
        exports.isRemoteAudioMuted = isRemoteAudioMuted;
        exports.setVolume = setVolume;
        exports.getVolume = getVolume;
        exports.fullScreen = fullScreen;
        connections[id] = exports;
        resolve(connections[id]);
    });
};

// return Promise(reject)
var getMediaAccess = function() {
    return new Promise(function(resolve, reject) {
        reject(new Error("This provider doesn't support getMediaAccess"));
    });
};

var listDevices = function() {
    return new Promise(function(resolve, reject) {
       reject(new Error("This provider doesn't support listDevices"));
    });
};

// always false
var releaseMedia = function() {
    return false;
};

var playFirstSound = function(noise) {
    var audioBuffer = audioContext.createBuffer(1, 441, 44100);
    var output = audioBuffer.getChannelData(0);
    for (var i = 0; i < output.length; i++) {
        if (noise) {
            output[i] = Math.random() * 2 - 1;
        } else {
            output[i] = 0;
        }
    }
    var src = audioContext.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(audioContext.destination);
    src.start(0);
};

var playFirstVideo = function() {
    return new Promise(function (resolve, reject) {
        resolve();
    });
};

/**
 * Check WebSocket available
 *
 * @returns {boolean} WSPlayer available
 */
var available = function(audioContext){
    return (audioContext) ? true : false;
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
        audioContext = configuration.audioContext;
        receiverLocation = configuration.receiverLocation || receiverLocation;
        decoderLocation = configuration.decoderLocation || decoderLocation;
        logger = configuration.logger;
        logger.info(LOG_PREFIX, "Initialized");
    }
};