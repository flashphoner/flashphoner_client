'use strict';

var adapter = require('webrtc-adapter');
var uuid_v1 = require('uuid/v1');
var util = require('./util');
var connections = {};
var LOCAL_CACHED_VIDEO = "-LOCAL_CACHED_VIDEO";
var REMOTE_CACHED_VIDEO = "-REMOTE_CACHED_VIDEO";
var extensionId;
var defaultConstraints;
var logger;
var LOG_PREFIX = "webrtc";
var audioContext;

var createConnection = function (options) {
    return new Promise(function (resolve, reject) {
        var id = options.id;
        var connectionConfig = options.connectionConfig || {"iceServers": []};
        var connectionConstraints = options.connectionConstraints || {};
        if (!connectionConstraints.hasOwnProperty("optional")) {
            connectionConstraints.optional = [{"DtlsSrtpKeyAgreement": true}];
        }
        connectionConfig.bundlePolicy = "max-compat";
        var connection = new RTCPeerConnection(connectionConfig, connectionConstraints);
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
            localVideo.id = id + "-local";
            connection.addStream(localVideo.srcObject);

            remoteVideo = getCacheInstance(remoteDisplay);
            if (!remoteVideo) {
                remoteVideo = document.createElement('video');
                remoteDisplay.appendChild(remoteVideo);
            }
            remoteVideo.id = id + "-remote";
            /**
             * Workaround for Android 6, 7, Chrome 61.
             * https://bugs.chromium.org/p/chromium/issues/detail?id=769622
             */
            remoteVideo.style = "border-radius: 1px";
        } else {
            var cachedVideo = getCacheInstance(display);
            if (!cachedVideo || cachedVideo.id.indexOf(REMOTE_CACHED_VIDEO) !== -1) {
                if (cachedVideo) {
                    remoteVideo = cachedVideo;
                } else {
                    remoteVideo = document.createElement('video');
                    display.appendChild(remoteVideo);
                }
                remoteVideo.id = id;
                /**
                 * Workaround for Android 6, 7, Chrome 61.
                 * https://bugs.chromium.org/p/chromium/issues/detail?id=769622
                 */
                remoteVideo.style = "border-radius: 1px";
            } else {
                localVideo = cachedVideo;
                localVideo.id = id;
                connection.addStream(localVideo.srcObject);
            }
        }

        connection.ontrack = function (event) {
            if (remoteVideo) {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.onloadedmetadata = function (e) {
                    if (remoteVideo) {
                        remoteVideo.play();
                    }
                };
            }
        };
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
                remoteVideo.id = remoteVideo.id + REMOTE_CACHED_VIDEO;
                remoteVideo = null;
            }
            if (localVideo && !getCacheInstance((localDisplay || display)) && cacheCamera) {
                localVideo.id = localVideo.id + LOCAL_CACHED_VIDEO;
                unmuteAudio();
                unmuteVideo();
                localVideo = null;
            } else if (localVideo) {
                removeVideoElement(localVideo);
                localVideo.id = localVideo.id + LOCAL_CACHED_VIDEO;
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
                } else if (adapter.browserDetails.browser == "safari") {
                    if (options.receiveAudio) {
                        connection.addTransceiver('audio');
                    }
                    if (options.receiveVideo) {
                        connection.addTransceiver('video');
                    }
                }
                var constraints = {
                    offerToReceiveAudio: options.receiveAudio ? 1 : 0,
                    offerToReceiveVideo: options.receiveVideo ? 1 : 0
                };
                //create offer and set local sdp
                connection.createOffer(constraints).then(function (offer) {
                    connection.setLocalDescription(offer).then(function () {
                        var o = {};
                        o.sdp = util.stripCodecs(offer.sdp, options.stripCodecs);
                        o.hasAudio = hasAudio;
                        o.hasVideo = hasVideo;
                        resolve(o);
                    });
                });
            });
        };
        var createAnswer = function (options) {
            return new Promise(function (resolve, reject) {
                //create offer and set local sdp
                connection.createAnswer().then(function (answer) {
                    connection.setLocalDescription(answer).then(function () {
                        resolve(util.stripCodecs(answer.sdp, options.stripCodecs));
                    });
                });
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
                connection.setRemoteDescription(rtcSdp).then(function () {
                    //use in edge for ice
                    if (adapter.browserDetails.browser == "edge") {
                        // var sdpArray = sdp.split("\n");
                        // var i;
                        // for (i = 0; i < sdpArray.length; i++) {
                        //     if (sdpArray[i].indexOf("m=video") == 0) {
                        //         break;
                        //     }
                        //     if (sdpArray[i].indexOf("a=candidate:1 1") == 0 || sdpArray[i].indexOf("a=candidate:2 1") == 0) {
                        //         var rtcIceCandidate = new RTCIceCandidate({
                        //             candidate: sdpArray[i],
                        //             sdpMid: "audio",
                        //             sdpMLineIndex: 0
                        //         });
                        //         connection.addIceCandidate(rtcIceCandidate);
                        //     }
                        // }
                        // var video = false;
                        // for (i = 0; i < sdpArray.length; i++) {
                        //     if (sdpArray[i].indexOf("m=video") == 0) {
                        //         video = true;
                        //     }
                        //     if (video && (sdpArray[i].indexOf("a=candidate:1 1") == 0 || sdpArray[i].indexOf("a=candidate:2 1") == 0)) {
                        //         var rtcIceCandidate2 = new RTCIceCandidate({
                        //             candidate: sdpArray[i],
                        //             sdpMid: "video",
                        //             sdpMLineIndex: 1
                        //         });
                        //         connection.addIceCandidate(rtcIceCandidate2);
                        //     }
                        // }
                        connection.addIceCandidate(null);
                    }
                    resolve();
                }).catch(function (error) {
                    reject(error);
                });
            });
        };

        var getVolume = function () {
            if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getAudioTracks().length > 0) {
                //return remoteVideo.srcObject.getAudioTracks()[0].volume * 100;
                return remoteVideo.volume * 100;
            }
            return -1;
        };
        var setVolume = function (volume) {
            if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getAudioTracks().length > 0) {
                remoteVideo.volume = volume / 100;
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
                if (adapter.browserDetails.browser == "chrome") {
                    connection.getStats(null).then(function (rawStats) {
                        var results = rawStats;
                        var result = {type: "chrome", outgoingStreams: {}, incomingStreams: {}};
                        if (rawStats instanceof Map) {
                            rawStats.forEach(function (v, k, m) {
                                handleResult(v);
                            });
                        } else {
                            for (var i = 0; i < results.length; ++i) {
                                handleResult(results[i]);
                            }
                        }

                        function handleResult(res) {
                            var resultPart = util.processRtcStatsReport(adapter.browserDetails.browser, res);
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
                } else if (adapter.browserDetails.browser == "firefox") {
                    connection.getStats(null).then(function (rawStats) {
                        var result = {type: "firefox", outgoingStreams: {}, incomingStreams: {}};
                        for (var k in rawStats) {
                            if (rawStats.hasOwnProperty(k)) {
                                var resultPart = util.processRtcStatsReport(adapter.browserDetails.browser, rawStats[k]);
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

        var fullScreen = function () {
            var video = document.getElementById(id);
            if (video) {
                if (!document.fullscreenElement && !document.mozFullScreenElement &&
                    !document.webkitFullscreenElement && !document.msFullscreenElement) {
                    if (video.requestFullscreen) {
                        video.requestFullscreen();
                    } else if (video.msRequestFullscreen) {
                        video.msRequestFullscreen();
                    } else if (video.mozRequestFullScreen) {
                        video.mozRequestFullScreen();
                    } else if (video.webkitRequestFullscreen) {
                        video.webkitRequestFullscreen();
                    } else if (video.webkitEnterFullscreen) {
                        video.webkitEnterFullscreen();
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
        exports.fullScreen = fullScreen;
        connections[id] = exports;
        resolve(exports);
    });
};

var getMediaAccess = function (constraints, display) {
    return new Promise(function (resolve, reject) {
        if (!constraints) {
            constraints = defaultConstraints;
            var cacheInstance = getCacheInstance(display);
            if (cacheInstance && cacheInstance.srcObject) {
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
                if (adapter.browserDetails.browser == "chrome") {
                    delete constraints.video.frameRate;
                    delete constraints.video.height;
                    delete constraints.video.width;
                }
                getAccess(constraints, true);
            }, reject);
        } else {
            getAccess(constraints);
        }

        function getAccess(constraints, screenShare) {
            logger.info(LOG_PREFIX, constraints);
            var requestAudioConstraints = null;
            if (screenShare) {
                if (constraints.audio && adapter.browserDetails.browser == "chrome") {
                    requestAudioConstraints = constraints.audio;
                    delete constraints.audio;
                }
            }
            navigator.getUserMedia(constraints, function (stream) {
                var video = getCacheInstance(display);
                if (!video) {
                    video = document.createElement('video');
                    display.appendChild(video);
                }
                video.id = uuid_v1() + LOCAL_CACHED_VIDEO;
                //show local camera
                video.srcObject = stream;
                //mute audio
                video.muted = true;
                video.onloadedmetadata = function (e) {
                    video.play();
                };
                // This hack for chrome only, firefox supports screen-sharing + audio natively
                if (requestAudioConstraints && adapter.browserDetails.browser == "chrome") {
                    logger.info(LOG_PREFIX, "Request for audio stream");
                    navigator.getUserMedia({audio: requestAudioConstraints}, function (stream) {
                        logger.info(LOG_PREFIX, "Got audio stream, add it to video stream");
                        video.srcObject.addTrack(stream.getAudioTracks()[0]);
                        resolve(display);
                    });
                } else {
                    resolve(display);
                }
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
        if (display.children[i] && (display.children[i].id.indexOf(LOCAL_CACHED_VIDEO) != -1 || display.children[i].id.indexOf(REMOTE_CACHED_VIDEO) != -1)) {
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
        video.srcObject = null;
    }

}

/**
 * Check WebRTC available
 *
 * @returns {boolean} webrtc available
 */
var available = function () {
    //return (adapter.browserDetails.browser != "edge") ? navigator.getUserMedia && RTCPeerConnection : false;
    return ('getUserMedia' in navigator && 'RTCPeerConnection' in window);
};

var listDevices = function (labels) {
    var getConstraints = function (devices) {
        var constraints = {};
        for (var i = 0; i < devices.length; i++) {
            var device = devices[i];
            if (device.kind == "audioinput") {
                constraints.audio = true;
            } else if (device.kind == "videoinput") {
                constraints.video = true;
            } else {
                logger.info(LOG_PREFIX, "unknown device " + device.kind + " id " + device.deviceId);
            }
        }
        return constraints;
    };

    var getList = function (devices) {
        var list = {
            audio: [],
            video: []
        };
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
        return list;
    };

    return new Promise(function (resolve, reject) {
        navigator.mediaDevices.enumerateDevices().then(function (devices) {
            if (labels) {
                var display = document.createElement("div");
                getMediaAccess(getConstraints(devices), display).then(function () {
                    navigator.mediaDevices.enumerateDevices().then(function (devicesWithLabales) {
                        resolve(getList(devicesWithLabales));
                        releaseMedia(display);
                    }, reject);
                }, reject);
            } else {
                resolve(getList(devices));
            }
        }, reject);
    });
};

function normalizeConstraints(constraints) {
    if (constraints.video) {
        if (constraints.video.hasOwnProperty('frameRate') && typeof constraints.video.frameRate !== 'object') {
            // Set default FPS value
            var frameRate = (constraints.video.frameRate == 0) ? 30 : constraints.video.frameRate;
            constraints.video.frameRate = {
                min: frameRate,
                max: frameRate
            }
        }
        if (constraints.video.hasOwnProperty('width') && typeof constraints.video.width !== 'object') {
            var width = constraints.video.width;
            if ((isNaN(width) || width == 0)) {
                logger.warn(LOG_PREFIX, "Width or height property has zero/NaN value, set default resolution 320x240");
                constraints.video.width = 320;
                constraints.video.height = 240;
            }
        }
        if (constraints.video.hasOwnProperty('height') && typeof constraints.video.height !== 'object') {
            var height = constraints.video.height;
            if (isNaN(height) || height == 0) {
                logger.warn(LOG_PREFIX, "Width or height property has zero/NaN value, set default resolution 320x240");
                constraints.video.width = 320;
                constraints.video.height = 240;
            }
        }
    }
    if (constraints.audio) {
        // The WebRTC AEC implementation doesn't work well on stereophonic sound and makes mono on output
        if (constraints.audio.stereo) {
            constraints.audio.echoCancellation = false;
            constraints.audio.googEchoCancellation = false
        }
    }
    return constraints;
}

var playFirstSound = function () {
    if (audioContext) {
        var buffer = audioContext.createBuffer(1, 441, 44100);
        var output = buffer.getChannelData(0);
        for (var i = 0; i < output.length; i++) {
            output[i] = 0;
        }
        var source = audioContext.createBufferSource();
        source.buffer = buffer;
        // Connect to output (speakers)
        source.connect(audioContext.destination);
        // Play sound
        if (source.start) {
            source.start(0);
        } else if (source.play) {
            source.play(0);
        } else if (source.noteOn) {
            source.noteOn(0);
        }
        return true;
    }
    return false;
};

var playFirstVideo = function (display, isLocal, src) {
    if (!getCacheInstance(display)) {
        var video = document.createElement('video');
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");
        display.appendChild(video);
        video.id = uuid_v1() + (isLocal ? LOCAL_CACHED_VIDEO : REMOTE_CACHED_VIDEO);
        if (src) {
            video.src = src;
        } else {
            video.src = "../../dependencies/media/preloader.mp4";
        }
        video.play();
    }
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
        audioContext = configuration.audioContext;
        logger = configuration.logger;
        logger.info(LOG_PREFIX, "Initialized");
    }
};