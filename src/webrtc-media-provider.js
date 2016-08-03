'use strict';

require('webrtc-adapter');
var connections = {};
var CACHED_INSTANCE_ID = "CACHED_WEBRTC_INSTANCE";

var createConnection = function(options) {
    return new Promise(function(resolve, reject) {
        var id = options.id;
        var connectionConfig = options.connectionConfig || {"iceServers": []};
        var connection = new RTCPeerConnection(connectionConfig, {
            "optional": [
                {"DtlsSrtpKeyAgreement": true}
            ]
        });
        var remoteStream;
        var display = options.display;
        var localStream = getCacheInstance(display);
        var video;
        if (localStream) {
            connection.addStream(localStream.srcObject);
            localStream.id = id;
        } else {
            video = document.createElement('video');
            video.id = id;
            display.appendChild(video);
        }
        connection.onaddstream = function (event) {
            remoteStream = event.stream;
            if (video) {
                video.srcObject = remoteStream;
                video.play();
            }
        };
        connection.onremovestream = function (event) {
            remoteStream = null;
            if (video) {
                video.pause();
            }
        };
        connection.onsignalingstatechange = function (event) {
        };
        connection.oniceconnectionstatechange = function (event) {
        };
        var state = function () {
            return connection.signalingState;
        };
        var close = function () {
            if (video) {
                removeVideoElement(display, video);
            }
            if (localStream && !getCacheInstance(display)) {
                localStream.id = CACHED_INSTANCE_ID;
            } else if (localStream) {
                removeVideoElement(display, localStream);
            }
            connection.close();
            delete connections[id];
        };
        var createOffer = function (options) {
            return new Promise(function (resolve, reject) {
                var constraints = {
                    offerToReceiveAudio: options.receiveAudio == undefined ? true : options.receiveAudio,
                    offerToReceiveVideo: options.receiveVideo == undefined ? true : options.receiveVideo
                };
                //create offer and set local sdp
                connection.createOffer(constraints).then(function (offer) {
                    connection.setLocalDescription(offer).then(function () {
                        resolve(offer.sdp);
                    });
                });
            });
        };
        var setRemoteSdp = function (sdp) {
            return new Promise(function (resolve, reject) {
                //todo check signalling state
                var sdpAnswer = new RTCSessionDescription({
                    type: 'answer',
                    sdp: sdp
                });
                connection.setRemoteDescription(sdpAnswer).then(function () {
                    resolve();
                }).catch(function (error) {
                    reject(error);
                });
            });
        };

        var exports = {};
        exports.state = state;
        exports.createOffer = createOffer;
        exports.setRemoteSdp = setRemoteSdp;
        exports.close = close;
        connections[id] = exports;
        resolve(exports);
    });
};

var getAccessToAudioAndVideo = function(display) {
    return new Promise(function(resolve, reject) {
        if (getCacheInstance(display)) {
            resolve();
            return;
        }
        var constraints = {
            audio: true,
            video: {
                width: 320,
                height: 240
            }
        };
        navigator.getUserMedia(constraints, function(stream){
            var video = document.createElement('video');
            display.appendChild(video);
            video.id = CACHED_INSTANCE_ID;
            //show local camera
            video.srcObject = stream;
            //mute audio
            video.muted = true;
            video.play();
            resolve(stream);
        }, reject);
    });
};

function getCacheInstance(display) {
    var i;
    for (i = 0; i < display.children.length; i++) {
        if (display.children[i] && display.children[i].id == CACHED_INSTANCE_ID) {
            console.log("FOUND WEBRTC CACHED INSTANCE");
            return display.children[i];
        }
    }
}

function removeVideoElement(display, video) {
    //pause
    video.pause();
    //stop media tracks
    var tracks = video.srcObject.getTracks();
    for (var i = 0; i < tracks.length; i++) {
        tracks[i].stop();
    }
    video.srcObject = '';
    display.removeChild(video);
}

module.exports = {
    createConnection: createConnection,
    getAccessToAudioAndVideo: getAccessToAudioAndVideo
};