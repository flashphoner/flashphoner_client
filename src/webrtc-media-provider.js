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
var createMicGainNode;
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
        //tweak for custom video players #WCS-1511
        var remoteVideo = options.remoteVideo;
        var videoCams = [];
        var switchCamCount = 0;
        var mics = [];
        var switchMicCount = 0;
        var customStream = options.customStream;
        var currentAudioTrack;
        var currentVideoTrack;
        var systemSoundTrack;
        var constraints = options.constraints ? options.constraints : {};
        var screenShare = false;

        if (bidirectional) {
            localVideo = getCacheInstance(localDisplay);
            if(localVideo) {
                //made for safari, if sip call without audio and video, because function playFirstVideo() creates a video element
                if(localVideo.srcObject) {
                    localVideo.id = id + "-local";
                    connection.addStream(localVideo.srcObject);
                } else {
                    localVideo = null;
                }
            }
            remoteVideo = getCacheInstance(remoteDisplay);
            if (!remoteVideo) {
                remoteVideo = document.createElement('video');
                remoteDisplay.appendChild(remoteVideo);
            }
            remoteVideo.id = id + "-remote";

            if (options.audioOutputId  && typeof remoteVideo.setSinkId !== "undefined") {
                remoteVideo.setSinkId(options.audioOutputId);
            }
            /**
             * Workaround for Android 6, 7, Chrome 61.
             * https://bugs.chromium.org/p/chromium/issues/detail?id=769622
             */
            remoteVideo.style = "border-radius: 1px";
        } else {
            //tweak for custom video players. In order to put MediaStream in srcObject #WCS-1511
            if (!remoteVideo) {
                var cachedVideo = getCacheInstance(display);
                if (!cachedVideo || cachedVideo.id.indexOf(REMOTE_CACHED_VIDEO) !== -1 || !cachedVideo.srcObject) {
                    if (cachedVideo) {
                        remoteVideo = cachedVideo;
                    } else {
                        remoteVideo = document.createElement('video');
                        display.appendChild(remoteVideo);
                    }
                    remoteVideo.id = id;
                    if (options.audioOutputId && typeof remoteVideo.setSinkId !== "undefined") {
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
                        remoteVideo.play().catch(function (e) {
                            if(adapter.browserDetails.browser == 'chrome' && audioContext.state == 'suspended') {
                                //WCS-1698. fix autoplay in chrome 71
                                logger.info(LOG_PREFIX, "Autoplay detected! Trying to play a video with a muted sound...");
                                if (browserDetails.browser == 'safari') remoteVideo.playsInline = true;
                                remoteVideo.muted = true;
                                remoteVideo.play();
                            } else {
                                logger.error(LOG_PREFIX, e);
                            }
                        });
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
        connection.onicecandidate = function (event) {
            logger.debug(LOG_PREFIX, "Added icecandidate: "+event.candidate.candidate);
        };
        var state = function () {
            return connection.signalingState;
        };
        var close = function (cacheCamera) {
            if (remoteVideo) {
                removeVideoElement(remoteVideo);
                //tweak for custom video players #WCS-1511
                if(!options.remoteVideo) {
                    remoteVideo.id = remoteVideo.id + REMOTE_CACHED_VIDEO;
                }
                remoteVideo = null;
            }
            if (localVideo && !getCacheInstance((localDisplay || display)) && cacheCamera) {
                localVideo.id = localVideo.id + LOCAL_CACHED_VIDEO;
                unmuteAudio();
                unmuteVideo();
                localVideo = null;
            } else if (localVideo) {
                localVideo.id = localVideo.id + LOCAL_CACHED_VIDEO;
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

        var unmuteRemoteAudio = function () {
            if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getAudioTracks().length > 0) {
                remoteVideo.muted = false;
            }
        };

        var muteRemoteAudio = function () {
            if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getAudioTracks().length > 0) {
                remoteVideo.muted = true;
            }
        };

        var isRemoteAudioMuted = function () {
            if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getAudioTracks().length > 0) {
                return remoteVideo.muted;
            }
            return true;
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
                    if (stats) {
                        stats.forEach(function (stat) {
                            if (stat.type == 'outbound-rtp' && !stat.isRemote) {
                                if (stat.mediaType == 'audio') {
                                    result.outboundStream.audioStats = stat;
                                } else if (stat.mediaType == 'video') {
                                    result.outboundStream.videoStats = stat;
                                } else {
                                    result.otherStats.push(stat);
                                }
                            } else if (stat.type == 'inbound-rtp' && !stat.isRemote) {
                                //safari does not have a mediaType variable for incoming statistics
                                if (stat.mediaType == 'audio' || (browser == 'safari' && stat.id.indexOf('Audio') != -1)) {
                                    result.inboundStream.audioStats = stat;
                                } else if (stat.mediaType == 'video' || (browser == 'safari' && stat.id.indexOf('Video') != -1)) {
                                    result.inboundStream.videoStats = stat;
                                } else {
                                    result.otherStats.push(stat);
                                }
                            } else {
                                result.otherStats.push(stat);
                            }
                        });
                        callbackFn(result);
                    }
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
                        //hack for iOS safari. Video is getting paused when switching from fullscreen to normal mode.
                        video.addEventListener("pause", function(){
                            video.play();
                        });
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
                if (localVideo && localVideo.srcObject && videoCams.length > 1 && !customStream && !screenShare) {
                    connection.getSenders().forEach(function (sender) {
                        if (sender.track.kind === 'audio') return;
                        switchCamCount = (switchCamCount + 1) % videoCams.length;
                        sender.track.stop();
                        var cam = (typeof deviceId !== "undefined") ? deviceId : videoCams[switchCamCount];
                        //use the settings that were set during connection initiation
                        var clonedConstraints = Object.assign({}, constraints);
                        clonedConstraints.video.deviceId = {exact: cam};
                        clonedConstraints.audio = false;
                        navigator.mediaDevices.getUserMedia(clonedConstraints).then(function (newStream) {
                            var newVideoTrack = newStream.getVideoTracks()[0];
                            newVideoTrack.enabled = localVideo.srcObject.getVideoTracks()[0].enabled;
                            var audioTrack = localVideo.srcObject.getAudioTracks()[0];
                            sender.replaceTrack(newVideoTrack);
                            localVideo.srcObject = newStream;
                            // On Safari mobile _newStream_ doesn't contain audio track, so we need to add track from previous stream
                            if (localVideo.srcObject.getAudioTracks().length == 0 && audioTrack) {
                                localVideo.srcObject.addTrack(audioTrack);
                            }
                            logger.info("Switch camera to " + cam);
                            resolve(cam);
                        }).catch(function (reason) {
                            logger.error(LOG_PREFIX, reason);
                            reject(reason);
                        });
                    });
                } else {
                    reject(constants.ERROR_INFO.CAN_NOT_SWITCH_CAM);
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
                        if(microphoneGain) {
                            microphoneGain.release();
                        }
                        var mic = (typeof deviceId !== "undefined") ? deviceId : mics[switchMicCount];
                        //use the settings that were set during connection initiation
                        var clonedConstraints = Object.assign({}, constraints);
                        clonedConstraints.audio.deviceId = {exact: mic};
                        clonedConstraints.video = false;
                        navigator.mediaDevices.getUserMedia(clonedConstraints).then(function (newStream) {
                            if(microphoneGain) {
                                var currentGain = microphoneGain.gain.value;
                                microphoneGain = createGainNode(newStream);
                                microphoneGain.gain.value = currentGain;
                            }
                            var newAudioTrack = newStream.getAudioTracks()[0];
                            newAudioTrack.enabled = localVideo.srcObject.getAudioTracks()[0].enabled;
                            currentAudioTrack = newAudioTrack;
                            var videoTrack = localVideo.srcObject.getVideoTracks()[0];
                            if(systemSoundTrack) {
                                var mixedTrack = mixAudioTracks(new MediaStream([newAudioTrack]), new MediaStream([systemSoundTrack]));
                                mixedTrack.enabled = newAudioTrack.enabled;
                                sender.replaceTrack(mixedTrack);
                                localVideo.srcObject = new MediaStream([mixedTrack]);
                            } else {
                                sender.replaceTrack(newAudioTrack);
                                localVideo.srcObject = newStream;
                            }
                            if(videoTrack) {
                                localVideo.srcObject.addTrack(videoTrack);
                            }
                            logger.info("Switch mic to " + mic);
                            resolve(mic);
                        }).catch(function (reason) {
                            logger.error(LOG_PREFIX, reason);
                            reject(reason);
                        });
                    });
                } else {
                    reject(constants.ERROR_INFO.CAN_NOT_SWITCH_MIC);
                }
            });
        };

        var switchToScreen = function (source) {
            return new Promise(function(resolve,reject) {
                if (!screenShare) {
                    var clonedConstraints = {
                        video: Object.assign({}, constraints.video),
                        audio: Object.assign({}, constraints.audio)
                    };
                    if(adapter.browserDetails.browser === 'firefox') {
                        clonedConstraints.video.mediaSource = source;
                    }
                    getScreenDeviceId(clonedConstraints).then(function (screenSharingConstraints) {
                        clonedConstraints.sourceId = screenSharingConstraints.sourceId;
                        if(screenSharingConstraints.audioMandatory) {
                            clonedConstraints.audio = {
                                mandatory: screenSharingConstraints.audioMandatory,
                                optional: []
                            };
                        } else {
                            delete clonedConstraints.audio;
                        }
                        if (adapter.browserDetails.browser == "firefox") {
                            clonedConstraints.video = screenSharingConstraints;
                        } else if (adapter.browserDetails.browser == "chrome") {
                            delete clonedConstraints.video;
                            clonedConstraints.video = {
                                mandatory: screenSharingConstraints.mandatory
                            }
                        }
                        navigator.mediaDevices.getUserMedia(clonedConstraints).then(function (stream) {
                            connection.getSenders().forEach(function (sender) {
                                if (sender.track.kind === 'audio') return;
                                currentAudioTrack = localVideo.srcObject.getAudioTracks()[0];
                                currentVideoTrack = localVideo.srcObject.getVideoTracks()[0];
                                var newVideoTrack = stream.getVideoTracks()[0];
                                newVideoTrack.enabled = currentVideoTrack.enabled;
                                sender.replaceTrack(newVideoTrack);
                                localVideo.srcObject = stream;
                                if (stream.getAudioTracks()[0]) {
                                    systemSoundTrack = stream.getAudioTracks()[0];
                                    connection.getSenders().forEach(function (sender) {
                                        if (sender.track.kind === 'video') return;
                                        var mixedTrack = mixAudioTracks(stream, new MediaStream([sender.track]));
                                        mixedTrack.enabled = currentAudioTrack.enabled;
                                        sender.replaceTrack(mixedTrack);
                                        localVideo.srcObject.removeTrack(stream.getAudioTracks()[0]);
                                        localVideo.srcObject.addTrack(mixedTrack);
                                        currentAudioTrack.enabled = true;
                                    });
                                } else {
                                    localVideo.srcObject.addTrack(currentAudioTrack);
                                }
                            });
                            logger.info("Switch to screen");
                            screenShare = true;
                            resolve();
                        }).catch(function(reason){
                            logger.error(reason);
                            reject(reason);
                        });
                    }).catch(function(reason){
                        logger.error(reason);
                        reject(reason);
                    });
                }
            });
        };

        var switchToCam = function () {
            if (screenShare) {
                connection.getSenders().forEach(function (sender) {
                    if (sender.track.kind === 'audio') return;
                    currentVideoTrack.enabled = sender.track.enabled;
                    sender.track.stop();
                    localVideo.srcObject = new MediaStream([currentVideoTrack]);
                    sender.replaceTrack(currentVideoTrack);
                    if (currentAudioTrack) {
                        connection.getSenders().forEach(function (sender) {
                            if (sender.track.kind === 'video') return;
                            if (systemSoundTrack) {
                                currentAudioTrack.enabled = sender.track.enabled;
                                sender.track.stop();
                                systemSoundTrack.stop();
                                systemSoundTrack = null;
                                sender.replaceTrack(currentAudioTrack);
                            }
                            localVideo.srcObject.addTrack(currentAudioTrack);
                        });
                    }
                });
            }
            logger.info("Switch to cam");
            screenShare = false;
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
        exports.unmuteRemoteAudio = unmuteRemoteAudio;
        exports.muteRemoteAudio = muteRemoteAudio;
        exports.isRemoteAudioMuted = isRemoteAudioMuted;
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
        if(!constraints.video && !constraints.audio && !constraints.customStream) {
            resolve(display);
            return;
        }
        //check if this is screen sharing
        if (constraints.video && constraints.video.type && constraints.video.type == "screen") {
            delete constraints.video.type;
            var requestAudioConstraints = null;
            getScreenDeviceId(constraints).then(function (screenSharingConstraints) {
                //copy constraints
                constraints.sourceId = screenSharingConstraints.sourceId;
                requestAudioConstraints = constraints.audio;
                if(screenSharingConstraints.audioMandatory) {
                    constraints.audio = {
                        mandatory: screenSharingConstraints.audioMandatory,
                        optional: []
                    };
                }
                delete screenSharingConstraints.audioMandatory;
                delete screenSharingConstraints.sourceId;

                for (var prop in screenSharingConstraints) {
                    if (screenSharingConstraints.hasOwnProperty(prop)) {
                        constraints.video[prop] = screenSharingConstraints[prop];
                    }
                }
                if (adapter.browserDetails.browser == "chrome") {
                    delete constraints.video.frameRate;
                    delete constraints.video.height;
                    delete constraints.video.width;
                    delete constraints.systemSound;
                }
                getAccess(constraints, true, requestAudioConstraints);
            }, reject);
        } else {
            getAccess(constraints);
        }

        function getAccess(constraints, screenShare, requestAudioConstraints) {
            logger.info(LOG_PREFIX, constraints);
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
    if (createMicGainNode && stream.getAudioTracks().length > 0 && adapter.browserDetails.browser == "chrome") {
        //WCS-1696. We need to start audioContext to work with gain control
        audioContext.resume();
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
    var sourceAudioTrack = stream.getAudioTracks()[0];
    gainNode.sourceAudioTrack = sourceAudioTrack;
    gainNode.release = function () {
        this.sourceAudioTrack.stop();
        this.disconnect();
    };
    stream.addTrack(outputStream.getAudioTracks()[0]);
    stream.removeTrack(sourceAudioTrack);
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
                            var result = {
                                mandatory: o,
                                sourceId: response.sourceId
                            };
                            if(response.systemSoundAccess) {
                                result.audioMandatory = {
                                    chromeMediaSource: "desktop",
                                    chromeMediaSourceId: response.sourceId,
                                    echoCancellation: true
                                }
                            }
                            resolve(result);
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
            if(video.id.indexOf(LOCAL_CACHED_VIDEO) != -1 && tracks[i].kind == 'audio' && microphoneGain) {
                microphoneGain.release();
            }
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
                logger.debug(LOG_PREFIX, "unknown device " + device.kind + " id " + device.deviceId);
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
            var micCount = 0;
            var camCount = 0;
            if (device.kind.indexOf("audio" + kind) === 0 && device.deviceId != "communications") {
                ret.type = (device.kind == "audioinput") ? "mic" : "speaker";
                if (ret.type == "mic" && ret.label == "") {
                    ret.label = 'microphone' + ++micCount;
                }
                list.audio.push(ret);
            } else if (device.kind.indexOf("video" + kind) === 0) {
                if (ret.label == "") {
                    ret.label = 'camera' + ++camCount;
                }
                ret.type = "camera";
                list.video.push(ret);
            } else {
                logger.debug(LOG_PREFIX, "unknown device " + device.kind + " id " + device.deviceId);
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
                    navigator.getUserMedia(getConstraints(devices), function (stream) {
                        navigator.mediaDevices.enumerateDevices().then(function (devicesWithLabales) {
                            resolve(getList(devicesWithLabales));
                            stream.getTracks().forEach(function (track) {
                                track.stop();
                            });
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
                ideal: frameRate
            }
        }
        if (constraints.video === true) {
            constraints.video = {};
        }
        if (typeof constraints.video === 'object') {
            var width = constraints.video.width;
            var height = constraints.video.height;
            if (adapter.browserDetails.browser == "safari") {
                if (!width || !height) {
                    constraints.video.width = {min: 320, max: 640};
                    constraints.video.height = {min: 240, max: 480};
                } else if (typeof width !== 'object' || typeof height !== 'object') {
                    constraints.video.width = {min: width, max: width};
                    constraints.video.height = {min: height, max: height};
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
        video.setAttribute("playsInline", "");
        display.appendChild(video);
        video.id = uuid_v1() + (isLocal ? LOCAL_CACHED_VIDEO : REMOTE_CACHED_VIDEO);
        /**
         * WCS-1560. We do not need to put src in the video element and play it
         * if (src) {
         *      video.src = src;
         * } else {
         *      video.src = "../../dependencies/media/preloader.mp4";
         * }
         * video.play();
         */
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
        createMicGainNode = (typeof configuration.createMicGainNode !== 'undefined') ? configuration.createMicGainNode : true;
        logger.info(LOG_PREFIX, "Initialized");
    }
};
