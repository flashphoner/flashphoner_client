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
        var setVolume = function(volume) {
            WSPlayer_.setVolume(volume);
        };
        var getVolume = function() {
            if (WSPlayer_) {
                return WSPlayer_.getVolume();
            }
            return -1;
        };


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
        exports.setVolume = setVolume;
        exports.getVolume = getVolume;
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

var playFirstSound = function() {
    var audioBuffer = audioContext.createBuffer(1, 441, 44100);
    var output = audioBuffer.getChannelData(0);
    for (var i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    var src = audioContext.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(audioContext.destination);
    src.start(0);
};

/**
 * Check WebSocket available
 *
 * @returns {boolean} WSPlayer available
 */
var available = function(){
    return (audioContext) ? true : false;
};

module.exports = {
    createConnection: createConnection,
    getMediaAccess: getMediaAccess,
    releaseMedia: releaseMedia,
    available: available,
    listDevices: listDevices,
    playFirstSound: playFirstSound,
    configure: function(configuration) {
        audioContext = configuration.audioContext;
        receiverLocation = configuration.receiverLocation || receiverLocation;
        decoderLocation = configuration.decoderLocation || decoderLocation;
        logger = configuration.logger;
        logger.info(LOG_PREFIX, "Initialized");
    }
};