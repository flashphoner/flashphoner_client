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
var microphoneGain;
var constants = require('./constants');


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
        var videoCams = [];
        var switchCamCount = 0;
        var mics = [];
        var switchMicCount = 0;
        var customStream = options.customStream;

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

            if (options.audioOutputId) {
                remoteVideo.setSinkId(options.audioOutputId);
            }
            /**
             * Workaround for Android 6, 7, Chrome 61.
             * https://bugs.chromium.org/p/chromium/issues/detail?id=769622
             */
            remoteVideo.style = "border-radius: 1px";
        } else {
            var cachedVideo = getCacheInstance(display);
            if (!cachedVideo || cachedVideo.id.indexOf(REMOTE_CACHED_VIDEO) !== -1 || !cachedVideo.srcObject) {
                if (cachedVideo) {
                    remoteVideo = cachedVideo;
                } else {
                    remoteVideo = document.createElement('video');
                    display.appendChild(remoteVideo);
                }
                remoteVideo.id = id;
                if (options.audioOutputId) {
                    remoteVideo.setSinkId(options.audioOutputId);
                }
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
        if (localVideo) {
            var videoTrack = localVideo.srcObject.getVideoTracks()[0];
            if (videoTrack) {
                listDevices(false).then(function (devices) {
                    devices.video.forEach(function (device) {
                        if (videoTrack.label === device.label) {
                            switchCamCount = videoCams.length;
                        }
                        videoCams.push(device.id);
                    })
                });
            }
            var audioTrack = localVideo.srcObject.getAudioTracks()[0];
            if (audioTrack) {
                listDevices(false).then(function (devices) {
                    devices.audio.forEach(function (device) {
                        if (audioTrack.label === device.label) {
                            switchMicCount = mics.length;
                        }
                        mics.push(device.id);
                    })
                });
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

        var setAudioOutputId = function (id) {
            if (remoteVideo) {
                return remoteVideo.setSinkId(id);
            }
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

        var setMicrophoneGain = function (volume) {
            if (microphoneGain) {
                microphoneGain.gain.value = volume / 100;
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
            var browser = adapter.browserDetails.browser;
            if (connection && (browser == 'chrome' || browser == 'firefox' || browser == 'safari')) {
                var result = {outboundStream:{}, inboundStream:{}, otherStats:[]};
                result.type = browser;
                connection.getStats(null).then(function (stats) {
                    stats.forEach(function (stat) {
                        if(stat.type == 'outbound-rtp' && !stat.isRemote) {
                            if(stat.mediaType == 'audio') {
                                result.outboundStream.audioStats = stat;
                            } else {
                                result.outboundStream.videoStats = stat;
                            }
                        } else if(stat.type == 'inbound-rtp' && !stat.isRemote) {
                            if(stat.mediaType == 'audio') {
                                result.inboundStream.audioStats = stat;
                            } else {
                                result.inboundStream.videoStats = stat;
                            }
                        } else {
                            result.otherStats.push(stat);
                        }
                    });
                    callbackFn(result);
                });
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
        };

        var switchCam = function (deviceId) {
            return new Promise(function(resolve,reject) {
                if (localVideo && localVideo.srcObject && videoCams.length > 1 && !customStream) {
                    connection.getSenders().forEach(function (sender) {
                        if (sender.track.kind === 'audio') return;
                        switchCamCount = (switchCamCount + 1) % videoCams.length;
                        sender.track.stop();
                        var cam = (typeof deviceId !== "undefined") ? deviceId : videoCams[switchCamCount];
                        navigator.mediaDevices.getUserMedia({video: {deviceId: {exact: cam}}}).then(function (newStream) {
                            sender.replaceTrack(newStream.getVideoTracks()[0]);
                            localVideo.srcObject = newStream;
                            logger.info("Switch camera to " + cam);
                            resolve(cam);
                        }).catch(function (reason) {
                            logger.error(LOG_PREFIX, reason);
                            reject(reason);
                        });
                    });
                } else {
                    reject(null);
                }
            });

        };

        var switchMic = function (deviceId) {
            return new Promise(function(resolve,reject) {
                if (localVideo && localVideo.srcObject && mics.length > 1 && !customStream) {
                    connection.getSenders().forEach(function (sender) {
                        if (sender.track.kind === 'video') return;
                        switchMicCount = (switchMicCount + 1) % mics.length;
                        sender.track.stop();
                        var constraints = {};
                        if (localVideo.srcObject.getVideoTracks().length > 0) {
                            constraints.video = {};
                            var track = localVideo.srcObject.getVideoTracks()[0];
                            var trackConstraints = track.getConstraints();
                            if (trackConstraints.hasOwnProperty('advanced')) {
                                trackConstraints.advanced.forEach(function (k) {
                                    for (var i in k) {
                                        if (k.hasOwnProperty(i)) {
                                            constraints.video[i] = k[i];
                                        }
                                    }
                                })
                            } else {
                                for (var i in trackConstraints) {
                                    if (trackConstraints.hasOwnProperty(i)) {
                                        constraints.video[i] = trackConstraints[i];
                                    }
                                }
                            }
                        }
                        var mic = (typeof deviceId !== "undefined") ? deviceId : mics[switchMicCount];
                        constraints.audio = {deviceId: {exact: mic}};
                        navigator.mediaDevices.getUserMedia(constraints).then(function (newStream) {
                            sender.replaceTrack(newStream.getAudioTracks()[0]);
                            localVideo.srcObject = newStream;
                            logger.info("Switch mic to " + mic);
                            resolve(mic);
                        }).catch(function (reason) {
                            logger.error(LOG_PREFIX, reason);
                            reject(reason);
                        });
                    });
                } else {
                    reject(null);
                }
            });
        };

        var exports = {};
        exports.state = state;
        exports.createOffer = createOffer;
        exports.createAnswer = createAnswer;
        exports.setRemoteSdp = setRemoteSdp;
        exports.changeAudioCodec = changeAudioCodec;
        exports.close = close;
        exports.setAudioOutputId = setAudioOutputId;
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
        connections[id] = exports;
        resolve(exports);
    });
};


var mixAudioTracks = function (stream1, stream2) {
    var stream1Sound = audioContext.createMediaStreamSource(stream1);
    var stream2Sound = audioContext.createMediaStreamSource(stream2);
    var destination = audioContext.createMediaStreamDestination();
    var newStream = destination.stream;
    stream1Sound.connect(destination);
    stream2Sound.connect(destination);
    return newStream.getAudioTracks()[0];
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
                constraints.sourceId = screenSharingConstraints.sourceId;
                constraints.systemSound = screenSharingConstraints.systemSoundAccess;
                delete screenSharingConstraints.sourceId;
                delete screenSharingConstraints.systemSoundAccess;

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
                if (constraints.systemSound) {
                    constraints.audio = {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: constraints.sourceId,
                            echoCancellation: true
                        },
                        optional: []
                    };
                    delete constraints.systemSound;
                }
            }
            if (constraints.customStream) {
                //get tracks if we have at least one defined constraint
                if (constraints.audio || constraints.video) {
                    //remove customStream from constraints before passing to GUM
                    var normalizedConstraints = {
                        audio: constraints.audio ? constraints.audio : false,
                        video: constraints.video ? constraints.video : false
                    };
                    navigator.getUserMedia(normalizedConstraints, function (stream) {
                        //add resulting tracks to customStream
                        stream.getTracks().forEach(function (track) {
                            constraints.customStream.addTrack(track);
                        });
                        //display customStream
                        loadVideo(display, constraints.customStream, screenShare, requestAudioConstraints, resolve, constraints);
                    }, reject);
                } else {
                    //display customStream
                    loadVideo(display, constraints.customStream, screenShare, requestAudioConstraints, resolve, constraints);
                }
            } else {
                navigator.getUserMedia(constraints, function (stream) {
                    loadVideo(display, stream, screenShare, requestAudioConstraints, resolve, constraints);
                }, reject);
            }
        }
    });
};

var loadVideo = function (display, stream, screenShare, requestAudioConstraints, resolve, constraints) {
    var video = getCacheInstance(display);
    if (!video) {
        video = document.createElement('video');
        display.appendChild(video);
    }
    if (stream.getAudioTracks().length > 0 && adapter.browserDetails.browser == "chrome") {
        microphoneGain = createGainNode(stream);
    }
    video.id = uuid_v1() + LOCAL_CACHED_VIDEO;
    video.srcObject = stream;
    //mute audio
    video.muted = true;
    video.onloadedmetadata = function (e) {
        if (screenShare && !window.chrome) {
            setScreenResolution(video, stream, constraints);
        }
        video.play();
    };
    if (constraints.systemSound && adapter.browserDetails.browser == "chrome") {
        addSystemSound();
    } else {
        resolveCallback();
    }

    function resolveCallback() {
        // This hack for chrome only, firefox supports screen-sharing + audio natively
        if (requestAudioConstraints && adapter.browserDetails.browser == "chrome") {
            logger.info(LOG_PREFIX, "Request for audio stream");
            navigator.getUserMedia({audio: requestAudioConstraints}, function (stream) {
                logger.info(LOG_PREFIX, "Got audio stream, add it to video stream");
                if (video.srcObject.getAudioTracks()[0]) {
                    var mixedTrack = mixAudioTracks(stream, video.srcObject);
                    var originalTrack = video.srcObject.getAudioTracks()[0];
                    video.srcObject.removeTrack(originalTrack);
                    video.srcObject.addTrack(mixedTrack);
                } else {
                    video.srcObject.addTrack(stream.getAudioTracks()[0]);
                }
                resolve(display);
            });
        } else {
            resolve(display);
        }
    }

    function addSystemSound() {
        chrome.runtime.sendMessage(extensionId, {type: "isInstalled"}, function (response) {
            if (response) {
                chrome.runtime.sendMessage(extensionId, {type: "getSourceId"}, function (response) {
                    if (response.error) {
                        resolveCallback();
                        logger.error(LOG_PREFIX, response.error);
                    } else {
                        if (response.systemSoundAccess) {
                            var constraints = {
                                audio: {
                                    mandatory: {
                                        chromeMediaSource: 'desktop',
                                        chromeMediaSourceId: response.sourceId,
                                        echoCancellation: true
                                    },
                                    optional: []
                                },
                                video: {
                                    mandatory: {
                                        chromeMediaSource: 'desktop',
                                        chromeMediaSourceId: response.sourceId
                                    },
                                    optional: []
                                }
                            };
                            navigator.getUserMedia(constraints, function (audioStream) {
                                if (stream.getAudioTracks().length > 0) {
                                    var originalAudioTrack = stream.getAudioTracks()[0];
                                    var mixedTrack = mixAudioTracks(stream, audioStream);
                                    stream.addTrack(mixedTrack);
                                    stream.removeTrack(originalAudioTrack);
                                } else {
                                    stream.addTrack(audioStream.getAudioTracks()[0]);
                                }
                                resolveCallback();
                            }, function (reason) {
                                resolveCallback();
                                logger.error(LOG_PREFIX, reason);
                            });
                        } else {
                            resolveCallback();
                            logger.error(LOG_PREFIX, "System sound: access is denied by the user");
                        }
                    }
                });
            } else {
                resolveCallback();
            }
        });
    }
};

var createGainNode = function (stream) {
    var audioCtx = audioContext;
    var source = audioCtx.createMediaStreamSource(stream);
    var gainNode = audioCtx.createGain();
    var destination = audioCtx.createMediaStreamDestination();
    var outputStream = destination.stream;
    source.connect(gainNode);
    gainNode.connect(destination);
    var newTrack = outputStream.getAudioTracks()[0];
    var originalTrack = stream.getAudioTracks()[0];
    stream.addTrack(newTrack);
    stream.removeTrack(originalTrack);
    return gainNode;
};

//Fix to set screen resolution for screen sharing in Firefox
var setScreenResolution = function (video, stream, constraints) {
    var newHeight;
    var newWidth;
    var videoRatio;
    if (video.videoWidth > video.videoHeight) {
        videoRatio = video.videoWidth / video.videoHeight;
        newHeight = constraints.video.videoWidth / videoRatio;
        newWidth = constraints.video.videoWidth;
    } else {
        videoRatio = video.videoHeight / video.videoWidth;
        newWidth = constraints.video.videoHeight / videoRatio;
        newHeight = constraints.video.videoHeight;
    }
    console.log("videoRatio === " + videoRatio);
    stream.getVideoTracks()[0].applyConstraints({height: newHeight, width: newWidth});
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
                            resolve({
                                mandatory: o,
                                sourceId: response.sourceId,
                                systemSoundAccess: response.systemSoundAccess
                            });
                        }
                    });
                } else {
                    reject(new Error("Screen sharing extension is not available"));
                }
            });
        } else {
            //firefox case
            o.mediaSource = constraints.video.mediaSource;

            o.width = {};
            o.height = {};
            o.frameRate = {
                min: constraints.video.frameRate.max,
                max: constraints.video.frameRate.max
            };
            o.videoWidth = constraints.video.width;
            o.videoHeight = constraints.video.height;
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
    if (!display) return;
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

var listDevices = function (labels, kind) {
    if (!kind) {
        kind = constants.MEDIA_DEVICE_KIND.INPUT;
    } else if (kind == "all") {
        kind = "";
    }
    var getConstraints = function (devices) {
        var constraints = {};
        for (var i = 0; i < devices.length; i++) {
            var device = devices[i];
            if (device.kind.indexOf("audio"+ kind) === 0) {
                constraints.audio = true;
            } else if (device.kind.indexOf("video"+ kind) === 0) {
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
            if (device.kind.indexOf("audio" + kind) === 0 && device.deviceId != "communications") {
                ret.type = (device.kind == "audioinput") ? "mic" : "speaker";
                list.audio.push(ret);
            } else if (device.kind.indexOf("video" + kind) === 0) {
                ret.type = "camera";
                list.video.push(ret);
            } else {
                logger.info(LOG_PREFIX, "unknown device " + device.kind + " id " + device.deviceId);
            }
        }
        return list;
    };

    return new Promise(function (resolve, reject) {
        if(kind === constants.MEDIA_DEVICE_KIND.OUTPUT && adapter.browserDetails.browser !== "chrome") {
            reject({message: "Only supported in chrome"});
        } else {
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
        }
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
        if (constraints.video === true) {
            constraints.video = {};
        }
        if (typeof constraints.video === 'object') {
            var width = constraints.video.width;
            var height = constraints.video.height;
            if (adapter.browserDetails.browser == "safari") {
                if (!width || !height || typeof width !== 'object' || typeof height !== 'object') {
                    constraints.video.width = {min: 320, max: 640};
                    constraints.video.height = {min: 240, max: 480};
                }
            } else if (isNaN(width) || width === 0 || isNaN(height) || height === 0) {
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