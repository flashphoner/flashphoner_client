'use strict';

var webrtcAdapter = require('webrtc-adapter');
var uuid = require('uuid/v1');
var util = require('./util');
var connections = {};
var CACHED_INSTANCE_POSTFIX = "-CACHED_WEBRTC_INSTANCE";
var extensionId;
var defaultConstraints;
var logger;
var LOG_PREFIX = "webrtc";
var Promise = require('es6-promise').Promise;

var createConnection = function (options) {
    return new Promise(function (resolve, reject) {
        var id = options.id;
        var connectionConfig = options.connectionConfig || {"iceServers": []};
        var connection = new RTCPeerConnection(connectionConfig, {
            "optional": [
                {"DtlsSrtpKeyAgreement": true}
            ]
        });
        //unidirectional display
        var display = options.display;
        //bidirectional local
        var localDisplay = options.localDisplay;
        //bidirectional remote
        var remoteDisplay = options.remoteDisplay;
        var bidirectional = options.bidirectional;
        var localVideo;
        var remoteVideo;
        if (bidirectional) {
            localVideo = getCacheInstance(localDisplay);
            remoteVideo = document.createElement('video');
            localVideo.id = id + "-local";
            remoteVideo.id = id + "-remote";
            remoteDisplay.appendChild(remoteVideo);
            connection.addStream(localVideo.srcObject);
        } else {
            localVideo = getCacheInstance(display);
            if (localVideo) {
                localVideo.id = id;
                connection.addStream(localVideo.srcObject);
            } else {
                remoteVideo = document.createElement('video');
                remoteVideo.id = id;
                display.appendChild(remoteVideo);
            }
        }

        connection.ontrack = function (event) {
            if (remoteVideo) {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.onloadedmetadata = function(e) {
                    if (remoteVideo) {
                        remoteVideo.play();
                    }
                };
            }
        };

        connection.onaddstream = function (event) {
            if (remoteVideo) {
                remoteVideo.onloadedmetadata = function (e) {
                    if (remoteVideo) {
                        remoteVideo.play();
                    }
                };
                remoteVideo.addEventListener('loadedmetadata', function() {
                    if (remoteVideo) {
                        remoteVideo.play();
                    }
                });
                remoteVideo = attachMediaStream(remoteVideo, event.stream);
                remoteVideo.srcObject = event.stream;
            }
        };;
        connection.onremovestream = function (event) {
            if (remoteVideo) {
                remoteVideo.pause();
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
            if (remoteVideo) {
                removeVideoElement(remoteVideo);
                remoteVideo = null;
            }
            if (localVideo && !getCacheInstance((localDisplay || display)) && cacheCamera) {
                localVideo.id = localVideo.id + CACHED_INSTANCE_POSTFIX;
                unmuteAudio();
                unmuteVideo();
                localVideo = null;
            } else if (localVideo) {
                removeVideoElement(localVideo);
                localVideo = null;
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
                if (localVideo) {
                    if (!localVideo.srcObject.getAudioTracks()[0]) {
                        hasAudio = false;
                    }
                    if (!localVideo.srcObject.getVideoTracks()[0]) {
                        hasVideo = false;
                        options.receiveVideo = false;
                    }
                }
                var constraints = {
                    offerToReceiveAudio: options.receiveAudio? 1 : 0,
                    offerToReceiveVideo: options.receiveVideo? 1 : 0
                };
                //create offer and set local sdp
                connection.createOffer(function (offer) {
                    connection.setLocalDescription(offer, function () {
                        var o = {};
                        o.sdp = util.stripCodecs(offer.sdp, options.stripCodecs);
                        o.hasAudio = hasAudio;
                        o.hasVideo = hasVideo;
                        resolve(o);
                    }, function(error) {
                        console.log(error);
                    });
                }, function(error) {
                    console.log(error);
                }, constraints);
            });
        };
        var createAnswer = function (options) {
            return new Promise(function (resolve, reject) {
                //create offer and set local sdp
                connection.createAnswer(function (answer) {
                    connection.setLocalDescription(answer, function () {
                        resolve(util.stripCodecs(answer.sdp, options.stripCodecs));
                    }, function(error) {
                        console.log(error);
                    });
                }, function(error) {
                    console.log(error);
                }, {});
            });
        };
        var changeAudioCodec = function (codec) {
            return false;
        };
        var setRemoteSdp = function (sdp) {
            logger.debug(LOG_PREFIX, "setRemoteSDP:");
            logger.debug(LOG_PREFIX, sdp);
            return new Promise(function (resolve, reject) {
                var sdpType;
                if (connection.signalingState == 'have-local-offer') {
                    sdpType = 'answer';
                } else {
                    sdpType = 'offer';
                }
                var rtcSdp = new RTCSessionDescription({
                    type: sdpType,
                    sdp: sdp
                });
                connection.setRemoteDescription(rtcSdp, function () {
                    resolve();
                }, function (error) {
                    reject(error);
                });
            });
        };

        var getVolume = function () {
            if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getAudioTracks().length > 0) {
                //return remoteVideo.srcObject.getAudioTracks()[0].volume * 100;
                if (remoteVideo.tagName == "OBJECT" || remoteVideo.tagName == "object") {
                    console.log("Volume change does not support for Temasys");
                } else {
                    return remoteVideo.volume * 100;
                }
            }
            return -1;
        };
        var setVolume = function (volume) {
            if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getAudioTracks().length > 0) {
                if (remoteVideo.tagName == "OBJECT" || remoteVideo.tagName == "object") {
                    console.log("Volume change does not support for Temasys");
                } else {
                    remoteVideo.volume = volume / 100;
                }
            }
        };
        var muteAudio = function () {
            if (localVideo && localVideo.srcObject && localVideo.srcObject.getAudioTracks().length > 0) {
                localVideo.srcObject.getAudioTracks()[0].enabled = false;
            }
        };
        var unmuteAudio = function () {
            if (localVideo && localVideo.srcObject && localVideo.srcObject.getAudioTracks().length > 0) {
                localVideo.srcObject.getAudioTracks()[0].enabled = true;
            }
        };
        var isAudioMuted = function () {
            if (localVideo && localVideo.srcObject && localVideo.srcObject.getAudioTracks().length > 0) {
                return !localVideo.srcObject.getAudioTracks()[0].enabled;
            }
            return true;
        };
        var muteVideo = function () {
            if (localVideo && localVideo.srcObject && localVideo.srcObject.getVideoTracks().length > 0) {
                localVideo.srcObject.getVideoTracks()[0].enabled = false;
            }
        };
        var unmuteVideo = function () {
            if (localVideo && localVideo.srcObject && localVideo.srcObject.getVideoTracks().length > 0) {
                localVideo.srcObject.getVideoTracks()[0].enabled = true;
            }
        };
        var isVideoMuted = function () {
            if (localVideo && localVideo.srcObject && localVideo.srcObject.getVideoTracks().length > 0) {
                return !localVideo.srcObject.getVideoTracks()[0].enabled;
            }
            return true;
        };
        var getStats = function (callbackFn) {
            if (connection) {
                if (webrtcAdapter.browserDetails.browser == "chrome") {
                    connection.getStats(null).then(function (rawStats) {
                        var results = rawStats;
                        var result = {type: "chrome", outgoingStreams: {}, incomingStreams: {}};
                        for (var i = 0; i < results.length; ++i) {
                            var resultPart = util.processRtcStatsReport(webrtcAdapter.browserDetails.browser, results[i]);
                            if (resultPart != null) {
                                if (resultPart.type == "googCandidatePair") {
                                    result.activeCandidate = resultPart;
                                } else if (resultPart.type == "ssrc") {
                                    if (resultPart.transportId.indexOf("audio") > -1) {
                                        if (resultPart.id.indexOf("send") > -1) {
                                            result.outgoingStreams.audio = resultPart;
                                        } else {
                                            result.incomingStreams.audio = resultPart;
                                        }

                                    } else {
                                        if (resultPart.id.indexOf("send") > -1) {
                                            result.outgoingStreams.video = resultPart;
                                        } else {
                                            result.incomingStreams.video = resultPart;
                                        }

                                    }
                                }
                            }
                        }
                        callbackFn(result);
                    }).catch(function (error) {
                        callbackFn(error)
                    });
                } else if (webrtcAdapter.browserDetails.browser == "firefox") {
                    connection.getStats(null).then(function (rawStats) {
                        var result = {type: "firefox", outgoingStreams: {}, incomingStreams: {}};
                        for (var k in rawStats) {
                            if (rawStats.hasOwnProperty(k)) {
                                var resultPart = util.processRtcStatsReport(webrtcAdapter.browserDetails.browser, rawStats[k]);
                                if (resultPart != null) {
                                    if (resultPart.type == "outboundrtp") {
                                        if (resultPart.id.indexOf("audio") > -1) {
                                            result.outgoingStreams.audio = resultPart;
                                        } else {
                                            result.outgoingStreams.video = resultPart;
                                        }
                                    } else if (resultPart.type == "inboundrtp") {
                                        if (resultPart.id.indexOf("audio") > -1) {
                                            result.incomingStreams.audio = resultPart;
                                        } else {
                                            result.incomingStreams.video = resultPart;
                                        }
                                    }
                                }
                            }
                        }
                        callbackFn(result);
                    }).catch(function (error) {
                        callbackFn(error)
                    });
                }
            }
        };

        var exports = {};
        exports.state = state;
        exports.createOffer = createOffer;
        exports.createAnswer = createAnswer;
        exports.setRemoteSdp = setRemoteSdp;
        exports.changeAudioCodec = changeAudioCodec;
        exports.close = close;
        exports.setVolume = setVolume;
        exports.getVolume = getVolume;
        exports.muteAudio = muteAudio;
        exports.unmuteAudio = unmuteAudio;
        exports.isAudioMuted = isAudioMuted;
        exports.muteVideo = muteVideo;
        exports.unmuteVideo = unmuteVideo;
        exports.isVideoMuted = isVideoMuted;
        exports.getStats = getStats;
        connections[id] = exports;
        resolve(exports);
    });
};

var getMediaAccess = function (constraints, display) {
    return new Promise(function (resolve, reject) {
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
            getScreenDeviceId(constraints).then(function (screenSharingConstraints) {
                //copy constraints
                for (var prop in screenSharingConstraints) {
                    if (screenSharingConstraints.hasOwnProperty(prop)) {
                        constraints.video[prop] = screenSharingConstraints[prop];
                    }
                }
                if (webrtcAdapter.browserDetails.browser == "chrome") {
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
            logger.info(LOG_PREFIX, constraints);
            navigator.getUserMedia(constraints, function (stream) {
                var video = document.createElement('video');
                display.appendChild(video);
                video.id = uuid_v1() + CACHED_INSTANCE_POSTFIX;
                //mute audio
                video.muted = true;
                video.onloadedmetadata = function (e) {
                    video.play();
                };
                video.addEventListener('loadedmetadata', function() {
                    video.play();
                });
                video = attachMediaStream(video, stream);
                video.srcObject = stream;
                resolve(display);
            }, reject);
        }
    });
};

var getScreenDeviceId = function (constraints) {
    return new Promise(function (resolve, reject) {
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

var releaseMedia = function (display) {
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
            logger.info(LOG_PREFIX, "FOUND WEBRTC CACHED INSTANCE, id " + display.children[i].id);
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
var available = function () {
    return (webrtcAdapter.browserDetails.browser != "edge") ? navigator.getUserMedia && RTCPeerConnection : false;
};

var listDevices = function (labels) {
    return new Promise(function (resolve, reject) {
        var list = {
            audio: [],
            video: []
        };
        if (labels) {
            var display = document.createElement("div");
            getMediaAccess({audio: true, video: {}}, display).then(function () {
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
                        logger.info(LOG_PREFIX, "unknown device " + device.kind + " id " + device.deviceId);
                    }
                }
                resolve(list);
            }, reject);
        }
    });
};

function normalizeConstraints(constraints) {
    if (constraints.video) {
        if (Flashphoner.isUsingTemasys()) {
            delete constraints.video.deviceId;
        }
        if (constraints.video.hasOwnProperty('frameRate') && typeof constraints.video.frameRate !== 'object') {
            // Set default FPS value
            var frameRate = (constraints.video.frameRate == 0) ? 30 : constraints.video.frameRate;
            constraints.video.frameRate = {
                min: frameRate,
                max: frameRate
            }
        }
        if (constraints.video.hasOwnProperty('width')) {
            var width = constraints.video.width;
            if (isNaN(width) || width == 0) {
                logger.warn(LOG_PREFIX, "Width or height property has zero/NaN value, set default resolution 320x240");
                constraints.video.width = 320;
                constraints.video.height = 240;
            }
        }
        if (constraints.video.hasOwnProperty('height')) {
            var height = constraints.video.height;
            if (isNaN(height) || height == 0) {
                logger.warn(LOG_PREFIX, "Width or height property has zero/NaN value, set default resolution 320x240");
                constraints.video.width = 320;
                constraints.video.height = 240;
            }
        }
    }
    if (constraints.audio) {
        if (Flashphoner.isUsingTemasys()) {
            delete constraints.audio.deviceId;
        }
        // The WebRTC AEC implementation doesn't work well on stereophonic sound and makes mono on output
        if (constraints.audio.stereo) {
            constraints.audio.echoCancellation = false;
            constraints.audio.googEchoCancellation = false
        }
    }
    return constraints;
}

// TODO implement
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
    listDevices: listDevices,
    playFirstSound: playFirstSound,
    playFirstVideo: playFirstVideo,
    available: available,
    configure: function (configuration) {
        extensionId = configuration.extensionId;
        defaultConstraints = configuration.constraints;
        logger = configuration.logger;
        logger.info(LOG_PREFIX, "Initialized");
    }
};