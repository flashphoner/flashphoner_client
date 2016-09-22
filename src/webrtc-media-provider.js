'use strict';

var adapter = require('webrtc-adapter');
var uuid = require('node-uuid');
var connections = {};
var CACHED_INSTANCE_POSTFIX = "-CACHED_WEBRTC_INSTANCE";
var extensionId;
var defaultConstraints;

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
                removeVideoElement(video);
                video = null;
            }
            if (localStream && !getCacheInstance(display) && cacheCamera) {
                localStream.id = localStream.id + CACHED_INSTANCE_POSTFIX;
                unmuteAudio();
                unmuteVideo();
                localStream = null;
            } else if (localStream) {
                removeVideoElement(localStream);
                localStream = null;
            }
            if (connection.signalingState !== "closed") {
                connection.close();
            }
            delete connections[id];
        };
        var createOffer = function (options) {
            return new Promise(function (resolve, reject) {
                var hasAudio = true;
                var hasVideo = true;
                if (localStream) {
                    if (!localStream.srcObject.getAudioTracks()[0]) {
                        hasAudio = false;
                    }
                    if (!localStream.srcObject.getVideoTracks()[0]) {
                        hasVideo = false;
                    }
                }
                var constraints = {
                    offerToReceiveAudio: hasAudio,
                    offerToReceiveVideo: hasVideo
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

        var getVolume = function() {
            if (video && video.srcObject && video.srcObject.getAudioTracks().length > 0) {
                return video.srcObject.getAudioTracks()[0].volume * 100;
            }
            return -1;
        };
        var setVolume = function(volume) {
            if (video && video.srcObject && video.srcObject.getAudioTracks().length > 0) {
                video.srcObject.getAudioTracks()[0].volume = volume/100;
            }
        };
        var muteAudio = function() {
            if (localStream && localStream.srcObject && localStream.srcObject.getAudioTracks().length > 0) {
                localStream.srcObject.getAudioTracks()[0].enabled = false;
            }
        };
        var unmuteAudio = function() {
            if (localStream && localStream.srcObject && localStream.srcObject.getAudioTracks().length > 0) {
                localStream.srcObject.getAudioTracks()[0].enabled = true;
            }
        };
        var isAudioMuted = function() {
            if (localStream && localStream.srcObject && localStream.srcObject.getAudioTracks().length > 0) {
                return !localStream.srcObject.getAudioTracks()[0].enabled;
            }
            return true;
        };
        var muteVideo = function() {
            if (localStream && localStream.srcObject && localStream.srcObject.getVideoTracks().length > 0) {
                localStream.srcObject.getVideoTracks()[0].enabled = false;
            }
        };
        var unmuteVideo = function() {
            if (localStream && localStream.srcObject && localStream.srcObject.getVideoTracks().length > 0) {
                localStream.srcObject.getVideoTracks()[0].enabled = true;
            }
        };
        var isVideoMuted = function() {
            if (localStream && localStream.srcObject && localStream.srcObject.getVideoTracks().length > 0) {
                return !localStream.srcObject.getVideoTracks()[0].enabled;
            }
            return true;
        };

        var exports = {};
        exports.state = state;
        exports.createOffer = createOffer;
        exports.setRemoteSdp = setRemoteSdp;
        exports.close = close;
        exports.setVolume = setVolume;
        exports.getVolume = getVolume;
        exports.muteAudio = muteAudio;
        exports.unmuteAudio = unmuteAudio;
        exports.isAudioMuted = isAudioMuted;
        exports.muteVideo = muteVideo;
        exports.unmuteVideo = unmuteVideo;
        exports.isVideoMuted = isVideoMuted;
        connections[id] = exports;
        resolve(exports);
    });
};

var getMediaAccess = function(constraints, display) {
    return new Promise(function(resolve, reject) {
        if (!constraints) {
            constraints = defaultConstraints;
            if (getCacheInstance(display)) {
                resolve(display);
                return;
            }
        } else {
            constraints = normalizeConstraints(constraints);
            releaseMedia(display);
        }
        //check if this is screen sharing
        if (constraints.video && constraints.video.type && constraints.video.type == "screen") {
            delete constraints.video.type;
            getScreenDeviceId(constraints).then(function(screenSharingConstraints){
                //copy constraints
                for (var prop in screenSharingConstraints) {
                    if (screenSharingConstraints.hasOwnProperty(prop)) {
                        constraints.video[prop] = screenSharingConstraints[prop];
                    }
                }
                if (adapter.browserDetails.browser == "chrome" ) {
                    delete constraints.video.frameRate;
                    delete constraints.video.height;
                    delete constraints.video.width;
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
                var playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(function(e) {console.warn(e)});
                }
                resolve(display);
            }, reject);
        }
    });
};

var getScreenDeviceId = function(constraints) {
    return new Promise(function(resolve, reject){
        var o = {};
        if (window.chrome) {
            chrome.runtime.sendMessage(extensionId, {type: "isInstalled"}, function (response) {
                if (response) {
                    o.maxWidth = constraints.video.width;
                    o.maxHeight = constraints.video.height;
                    o.maxFrameRate = constraints.video.frameRate.max;
                    o.chromeMediaSource = "desktop";
                    chrome.runtime.sendMessage(extensionId, {type: "getSourceId"}, function (response) {
                        if (response.error) {
                            reject(new Error("Screen access denied"));
                        } else {
                            o.chromeMediaSourceId = response.sourceId;
                            resolve({mandatory: o});
                        }
                    });
                } else {
                    reject(new Error("Screen sharing extension is not available"));
                }
            });
        } else {
            //firefox case
            o.mediaSource = "window";
            o.width = {
                min: constraints.video.width,
                max: constraints.video.width
            };
            o.height = {
                min: constraints.video.height,
                max: constraints.video.height
            };
            o.frameRate = {
                min: constraints.video.frameRate.max,
                max: constraints.video.frameRate.max
            };
            resolve(o);
        }
    });
};

var releaseMedia = function(display) {
    var video = getCacheInstance(display);
    if (video) {
        removeVideoElement(video);
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

function removeVideoElement(video) {
    if (video.srcObject) {
        //pause
        video.pause();
        //stop media tracks
        var tracks = video.srcObject.getTracks();
        for (var i = 0; i < tracks.length; i++) {
            tracks[i].stop();
        }
    }
    if (video.parentNode) {
        video.parentNode.removeChild(video);
    }
}
/**
 * Check WebRTC available
 *
 * @returns {boolean} webrtc available
 */
var available = function(){
    return (adapter.browserDetails.browser != "edge") ? navigator.getUserMedia && RTCPeerConnection : false;
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

function normalizeConstraints(constraints) {
    if (constraints.video) {
        if (constraints.video.hasOwnProperty('frameRate')) {
            // Set default FPS value
            var frameRate = (constraints.video.frameRate == 0) ? 30 : constraints.video.frameRate;
            constraints.video.frameRate = {
                min: frameRate,
                max: frameRate
            }
        }
    }
    return constraints;
}

module.exports = {
    createConnection: createConnection,
    getMediaAccess: getMediaAccess,
    releaseMedia: releaseMedia,
    listDevices: listDevices,
    available: available,
    configure: function(configuration) {
        extensionId = configuration.extensionId;
        defaultConstraints = configuration.constraints;
    }
};