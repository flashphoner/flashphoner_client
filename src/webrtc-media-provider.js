'use strict';

require('webrtc-adapter');
var uuid = require('node-uuid');
var connections = {};
var CACHED_INSTANCE_POSTFIX = "-CACHED_WEBRTC_INSTANCE";
var extensionId;

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
                var playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(function(e) {console.warn(e)});
                }
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
        var close = function (cacheCamera) {
            if (video) {
                removeVideoElement(display, video);
            }
            if (localStream && !getCacheInstance(display) && cacheCamera) {
                localStream.id = localStream.id + CACHED_INSTANCE_POSTFIX;
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

var getMediaAccess = function(constraints, display) {
    return new Promise(function(resolve, reject) {
        if (getCacheInstance(display)) {
            resolve(display);
            return;
        }
        //check if this is screen sharing
        if (constraints.video && constraints.video.type && constraints.video.type == "screen") {
            delete constraints.video.type;
            getScreenDeviceId().then(function(screenSharingConstraints){
                //copy constraints
                for (var prop in screenSharingConstraints) {
                    if (screenSharingConstraints.hasOwnProperty(prop)) {
                        constraints.video[prop] = screenSharingConstraints[prop];
                    }
                }
                getAccess(constraints);
            }, reject);
        } else {
            getAccess(constraints);
        }

        function getAccess(constraints) {
            console.dir(constraints);
            navigator.getUserMedia(constraints, function(stream){
                var video = document.createElement('video');
                display.appendChild(video);
                video.id = uuid.v1() + CACHED_INSTANCE_POSTFIX;
                //show local camera
                video.srcObject = stream;
                //mute audio
                video.muted = true;
                video.play();
                resolve(display);
            }, reject);
        }
    });
};

var getScreenDeviceId = function() {
    return new Promise(function(resolve, reject){
        if (window.chrome) {
            chrome.runtime.sendMessage(extensionId, {type: "isInstalled"}, function (response) {
                if (response) {
                    chrome.runtime.sendMessage(extensionId, {type: "getSourceId"}, function (response) {
                        if (response.error) {
                            reject(new Error("Screen access denied"));
                        } else {
                            resolve({
                                mandatory: {
                                    chromeMediaSourceId: response.sourceId,
                                    chromeMediaSource: "desktop"
                                }
                            });
                        }
                    });
                } else {
                    reject(new Error("Screen sharing extension is not available"));
                }
            });
        } else {
            //firefox case
            resolve({mediaSource: "screen"});
        }
    });
};

var releaseMedia = function(display) {
    var video = getCacheInstance(display);
    if (video) {
        removeVideoElement(display, video);
        return true;
    }
    return false;
};

function getCacheInstance(display) {
    var i;
    for (i = 0; i < display.children.length; i++) {
        if (display.children[i] && display.children[i].id.indexOf(CACHED_INSTANCE_POSTFIX) != -1) {
            console.log("FOUND WEBRTC CACHED INSTANCE, id " + display.children[i].id);
            return display.children[i];
        }
    }
}

function removeVideoElement(display, video) {
    if (video.srcObject) {
        //pause
        video.pause();
        //stop media tracks
        var tracks = video.srcObject.getTracks();
        for (var i = 0; i < tracks.length; i++) {
            tracks[i].stop();
        }
    }
    display.removeChild(video);
}
/**
 * Check WebRTC available
 *
 * @returns {boolean} webrtc available
 */
var available = function(){
    return navigator.getUserMedia && RTCPeerConnection;
};

var listDevices = function(labels) {
    return new Promise(function(resolve, reject) {
        var list = {
            audio: [],
            video: []
        };
        if (labels) {
            var display = document.createElement("div");
            getMediaAccess({audio: true, video: {}}, display).then(function(){
                releaseMedia(display);
                populateList();
            }, reject);
        } else {
            populateList();
        }

        function populateList() {
            navigator.mediaDevices.enumerateDevices().then(function (devices) {
                for (var i = 0; i < devices.length; i++) {
                    var device = devices[i];
                    var ret = {
                        id: device.deviceId,
                        label: device.label
                    };
                    if (device.kind == "audioinput") {
                        ret.type = "mic";
                        list.audio.push(ret);
                    } else if (device.kind == "videoinput") {
                        ret.type = "camera";
                        list.video.push(ret);
                    } else {
                        console.log("unknown device " + device.kind + " id " + device.deviceId);
                    }
                }
                resolve(list);
            }, reject);
        }
    });
};

module.exports = {
    createConnection: createConnection,
    getMediaAccess: getMediaAccess,
    releaseMedia: releaseMedia,
    listDevices: listDevices,
    available: available,
    configure: function(screenSharingExtensionId) {
        extensionId = screenSharingExtensionId;
    }
};