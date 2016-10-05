'use strict';

var WSPlayer = require('./WSPlayer').WSPlayer;
var browser = require('webrtc-adapter').browserDetails;
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

window.AudioContext = window.AudioContext || window.webkitAudioContext;
try {
    var audioContext = new AudioContext();
} catch(e) {
    console.warn("Failed to create audio context");
}

var createConnection = function(options, handlers) {
    return new Promise(function(resolve, reject) {
        var WSPlayer_;
        var id = options.id;
        var display = options.display;

        var canvas = document.createElement("canvas");
        display.appendChild(canvas);
        canvas.id = id;

        var createOffer = function(options) {
            return new Promise(function (resolve, reject) {
                resolve(DEFAULT_SDP);
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

        try{
            WSPlayer_ = new WSPlayer(canvas, handlers);

            var config = {};
            config.urlWsServer = options.mainUrl;
            config.token = options.authToken;
            config.receiverPath = receiverLocation;
            config.decoderPath = decoderLocation;
            config.streamId = id;

            WSPlayer_.initLogger(3);
            WSPlayer_.init(config,audioContext);
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
        resolve(exports);
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

/**
 * Check WebSocket available
 *
 * @returns {boolean} WSPlayer available
 */
var available = function(){
    //return (browser.browser == "Not a supported browser.") ? false : true;
    return true;
};

module.exports = {
    createConnection: createConnection,
    getMediaAccess: getMediaAccess,
    releaseMedia: releaseMedia,
    available: available,
    listDevices: listDevices,
    configure: function(configuration) {
        receiverLocation = configuration.receiverLocation || receiverLocation;
        decoderLocation = configuration.decoderLocation || decoderLocation;
    }
};