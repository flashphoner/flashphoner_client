function Flashphoner() {
    if (arguments.callee.instance) {
        return arguments.callee.instance;
    }
    arguments.callee.instance = this;

    this.clientVersion = "UNKNOWN_VERSION";

    this.webRtcMediaManager = undefined;
    this.webRtcCallSessionId = undefined;
    this.flashMediaManager = undefined;
    this.wsPlayerMediaManager = undefined;
    this.connection = null;
    this.configuration = new Configuration();
    this.calls = new DataMap();
    this.publishStreams = new DataMap();
    this.playStreams = new DataMap();
    this.messages = {};
    this.isOpened = false;
    this.listeners = {};
    this.version = undefined;
    this.mediaProviders = new DataMap();
    this.intervalId = -1;
    this.firefoxCodecReplaicer = {"pcma": "PCMA", "pcmu": "PCMU", "g722": "G722", "OPUS": "opus", "SHA-256": "sha-256"};
    this.firefoxScreenSharingExtensionInstalled = false;
}

Flashphoner.getInstance = function () {
    return new Flashphoner();
};

Flashphoner.prototype = {

    isChrome: function(){
        return (navigator.userAgent.indexOf("Chrome") > -1) && (navigator.userAgent.indexOf("Edge") == -1);
    },

    isFF: function(){
        return (navigator.userAgent.indexOf("Mozilla") > -1) && (navigator.userAgent.indexOf("Firefox") > -1) && (navigator.userAgent.indexOf("Edge") == -1);
    },

    initFlash: function (elementId, pathToSWF) {

        var me = this;

        if (me.isChrome() || me.isFF()) {
            //Don't init Flash player for Chrome browser because it has some bugs in version 46 (Flash no longer detects webcam in Chrome)
            //Once Flash is not loaded, WebRTC will be used everywhere in Chrome until the Flash Player bug is not resolved
            //https://productforums.google.com/forum/#!topic/chrome/QjT1GR2IYzM;context-place=forum/chrome
            trace("Flash won't be initialized for Chrome");
            return;
        }

        if (typeof swfobject != 'undefined') {
            var params = {};
            params.menu = "true";
            params.swliveconnect = "true";
            params.allowfullscreen = "true";
            params.allowscriptaccess = "always";
            //in case of Safari wmode should be "window"
            if ((navigator.userAgent.indexOf("Safari") > -1) && !(navigator.userAgent.indexOf("Chrome") > -1)) {
                params.wmode = "window";
                //workaround for safari browser, FPNR-403
                swfobject.switchOffAutoHideShow();
            } else if ((navigator.userAgent.indexOf("Mozilla") > -1) && (navigator.userAgent.indexOf("Firefox") > -1)) {
                params.wmode = "window";
            } else {
                params.wmode = "transparent";
            }
            var attributes = {};
            var flashvars = {};
            if (swfobject.hasFlashPlayerVersion("11.2")) {
                swfobject.embedSWF(pathToSWF, elementId, "100%", "100%", "11.2.202", "expressInstall.swf", flashvars, params, attributes, function (e) {
                    me.flashMediaManager = e.ref;
                    me.mediaProviders.add(MediaProvider.Flash, me.flashMediaManager);
                });
            } else {
                trace("Problem: Flash not found")
            }
        } else {
            trace("Warning: swfobject.js does not include and flash does not load");
        }
    },

    initFlashMediaManager: function () {
        if (isFlashphonerAPILoaded && this.userData) {
            this.flashMediaManager.connect(this.configuration.urlFlashServer, this.userData, this.configuration);
        }
    },

    initWSPlayerMediaManager: function () {
        if (this.userData && this.wsPlayerMediaManager) {
            var config = {};
            config.token = this.userData.authToken;
            config.urlWsServer = this.connection.urlServer;
            config.receiverPath = this.configuration.wsPlayerReceiverPath;
            config.videoWidth = this.configuration.videoWidth;
            config.videoHeight = this.configuration.videoHeight;
            config.startWithVideoOnly = this.configuration.wsPlayerStartWithVideoOnly;
            this.wsPlayerMediaManager.initLogger(0);
            this.wsPlayerMediaManager.init(config);
        }
    },

    initWebRTC: function () {
        var me = this;
        if (navigator.mozGetUserMedia) {
            trace("This appears to be Firefox");

            if (typeof(mozRTCPeerConnection) === undefined) {
                trace("Please, update your browser to use WebRTC");
            } else {
                me.webRtcMediaManager = new WebRtcMediaManager();
                me.mediaProviders.add(MediaProvider.WebRTC, me.webRtcMediaManager);

                webrtcDetectedBrowser = "firefox";

                RTCPeerConnection = mozRTCPeerConnection;

                RTCSessionDescription = mozRTCSessionDescription;

                RTCIceCandidate = mozRTCIceCandidate;

                getUserMedia = navigator.mozGetUserMedia.bind(navigator);

                attachMediaStream = function (element, stream) {
                    element.mozSrcObject = stream;
                    element.play();
                };

                reattachMediaStream = function (to, from) {
                    to.mozSrcObject = from.mozSrcObject;
                    to.play();
                };

                //MediaStream.prototype.getVideoTracks = function () {
                //    return [];
                //};
                //
                //MediaStream.prototype.getAudioTracks = function () {
                //    return [];
                //};
            }
        } else if (navigator.webkitGetUserMedia) {
            trace("This appears to be Chrome");

            if (typeof(webkitRTCPeerConnection) === undefined) {
                trace("Please, update your browser to use WebRTC");
            } else {
                me.webRtcMediaManager = new WebRtcMediaManager();
                me.mediaProviders.add(MediaProvider.WebRTC, me.webRtcMediaManager);

                webrtcDetectedBrowser = "chrome";

                RTCPeerConnection = webkitRTCPeerConnection;

                getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

                attachMediaStream = function (element, stream) {
                    var URL = window.URL || window.webkitURL;
                    element.src = URL.createObjectURL(stream);
                    element.play();
                };

                reattachMediaStream = function (to, from) {
                    to.src = from.src;
                    element.play();
                };

                //if (!webkitMediaStream.prototype.getVideoTracks) {
                //    webkitMediaStream.prototype.getVideoTracks = function () {
                //        return this.videoTracks;
                //    };
                //}
                //
                //if (!webkitMediaStream.prototype.getAudioTracks) {
                //    webkitMediaStream.prototype.getAudioTracks = function () {
                //        return this.audioTracks;
                //    };
                //}
            }
        } else {
            trace("Browser does not appear to be WebRTC-capable");
        }

        var MediaStream = window.MediaStream;

        if (typeof MediaStream === 'undefined' && typeof webkitMediaStream !== 'undefined') {
            MediaStream = webkitMediaStream;
        }

        /*global MediaStream:true */
        if (typeof MediaStream !== 'undefined' && !('stop' in MediaStream.prototype)) {
            MediaStream.prototype.stop = function() {
                this.getAudioTracks().forEach(function(track) {
                    track.stop();
                });

                this.getVideoTracks().forEach(function(track) {
                    track.stop();
                });
            };
        }

        if (this.webRtcMediaManager) {
            this.webRtcMediaManager.onLocalScreenMediaStreamEnded = function(mediaSessionId) {
                var streams = me.publishStreams.array();
                streams.some(function(stream) {
                    if (stream.mediaSessionId == mediaSessionId) {
                        stream.status = StreamStatus.LocalStreamStopped;
                        me.invokeListener(WCSEvent.StreamStatusEvent, [
                            stream
                        ]);

                        //stop stream
                        me.unPublishStream(stream);
                        return true;
                    }
                });
            }
        }
    },

    addListener: function (event, listener, thisArg) {
        this.listeners[event] = {func: listener, thisArg: thisArg};
    },

    invokeListener: function (event, argsArray) {
        var listener = this.listeners[event];
        if (listener) {
            listener.func.apply(listener.thisArg ? listener.thisArg : window, argsArray);
        }
    },

    addOrUpdateCall: function (call) {
        var me = this;
        if (me.calls.get(call.callId)) {
            me.calls.update(call.callId, call);
        } else {
            me.calls.add(call.callId, call);

            if (!call.mediaProvider) {
                call.mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
            }

            if ((!this.webRtcCallSessionId) && MediaProvider.WebRTC == call.mediaProvider) {
                this.webRtcCallSessionId = call.callId;
                me.webRtcMediaManager.newConnection(call.callId, new WebRtcMediaConnection(me.webRtcMediaManager, me.configuration.stunServer, me.configuration.useDTLS | true, me.configuration.remoteMediaElementId, call.callId));
            }

            if (call.incoming || call.parentCallId !== undefined) {
                me.invokeListener(WCSEvent.OnCallEvent, [
                    call
                ]);
            }
        }
    },

    init: function (configuration) {
        var me = this;
        if (!configuration) {
            configuration = new Configuration();
        }
        if (!configuration.remoteMediaElementId) {
            configuration.remoteMediaElementId = 'remoteMediaElement';
            var _body = document.getElementsByTagName('body') [0];
            var remoteMediaElement = document.createElement('audio');
            remoteMediaElement.id = configuration.remoteMediaElementId;
            _body.appendChild(remoteMediaElement);
        }

        if (!configuration.pathToSWF) {
            configuration.pathToSWF = '../../../dependencies/flash/MediaManager.swf';
        }

        if (!configuration.elementIdForSWF && typeof swfobject != 'undefined') {
            configuration.elementIdForSWF = 'flashVideoDiv';
            var _body = document.getElementsByTagName('body') [0];
            var flashVideoDiv = document.createElement('div');
            flashVideoDiv.style.width = '322px';
            flashVideoDiv.style.height = '176px';
            flashVideoDiv.innerHTML = '<div id="' + configuration.elementIdForSWF + '"></div>';
            _body.appendChild(flashVideoDiv);

        }


        me.configuration = configuration;
        me.initWebRTC();
        if (me.configuration.elementIdForSWF && me.configuration.pathToSWF) {
            me.initFlash(me.configuration.elementIdForSWF, me.configuration.pathToSWF);
        }
        if (me.configuration.wsPlayerCanvas) {
            me.wsPlayerMediaManager = new WSPlayer(me.configuration.wsPlayerCanvas);
            me.mediaProviders.add(MediaProvider.WSPlayer, me.wsPlayerMediaManager);
        }

        if (me.configuration.localMediaElementId) {
            try {
                getElement(me.configuration.localMediaElementId).volume = 0;
            }catch(err) {
                console.info("This browser may not support video.volume: "+err);
            }
        }

        this.callbacks = {
            ping: function () {
                me.webSocket.send("pong");
            },

            getUserData: function (userData) {
                me.userData = userData;
                if (me.flashMediaManager) {
                    me.initFlashMediaManager();
                }
                if (me.wsPlayerMediaManager) {
                    me.initWSPlayerMediaManager();
                }
                for (var prop in userData) {
                    me.connection[prop] = me.userData[prop];
                }
                me.connection.status = ConnectionStatus.Established;
                me.invokeListener(WCSEvent.ConnectionStatusEvent, [
                    me.connection
                ]);
            },

            getVersion: function (version) {
                me.version = version;
            },

            registered: function (event) {
                me.invokeListener(WCSEvent.RegistrationStatusEvent, [
                    event
                ]);
            },

            notifyIncomingCall: function (call) {
                trace("notifyIncomingCall call.callId:" + call.callId);
                me.addOrUpdateCall(call);
            },

            notifyTransferEvent: function (call) {
                trace("notifyTransferEvent " + call.status);
                if (call.status == "PENDING") {
                    me.invokeListener(WCSEvent.OnTransferEvent, [
                        call
                    ]);
                } else {
                    me.invokeListener(WCSEvent.TransferStatusEvent, [
                        call
                    ]);
                }
            },

            notifyTryingResponse: function (call) {
                trace("notifyTryingResponse call.callId:" + call.callId);
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    call
                ]);
            },

            ring: function (call) {
                trace("ring call.status: " + call.status + " call.callId: " + call.callId);
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    call
                ]);
            },

            sessionProgress: function (call) {
                trace("sessionProgress call.state: " + call.state + " call.callId: " + call.callId);
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    call
                ]);
            },

            setRemoteSDP: function (id, sdp, isInitiator) {
                //if (sdp.search("a=recvonly") != -1) {
                //    sdp = me.handleVideoSSRC(sdp);
                //}
                console.log("setRemoteSDP: " + sdp);
                if (me.webRtcMediaManager) {
                    if (navigator.mozGetUserMedia) {
                        for (var c in me.firefoxCodecReplaicer) {
                            sdp = sdp.split(c).join(me.firefoxCodecReplaicer[c]);
                        }
                    }

                    if (me.configuration.stripCodecs && me.configuration.stripCodecs.length > 0) {
                        sdp = me.stripCodecsSDP(sdp, false);
                        console.log("Apply strip codecs");
                    }
                    me.webRtcMediaManager.setRemoteSDP(id, sdp, isInitiator);
                }
            },

            notifyAudioCodec: function (id, codec) {
                var call = me.calls.get(id);
                if (me.flashMediaManager && call && MediaProvider.Flash == call.mediaProvider) {
                    me.flashMediaManager.setAudioCodec(id, codec);
                }
            },

            binaryData: function (data) {
                me.invokeListener(WCSEvent.OnBinaryEvent, [
                    data
                ]);
            },

            base64BinaryData: function (data) {
                var result = {};
                var raw = window.atob(data);
                var rawLength = raw.length;
                var array = new Uint8Array(new ArrayBuffer(rawLength));

                for (i = 0; i < rawLength; i++) {
                    array[i] = raw.charCodeAt(i);
                }
                result.data = array;
                console.log("received data length " + result.data.length);
                me.invokeListener(WCSEvent.OnBinaryEvent, [
                    result
                ]);
            },

            notifyVideoFormat: function (videoFormat) {
            },

            talk: function (call) {
                me.addOrUpdateCall(call);
                if (!call.isMsrp) {
                    me.mediaProviders.get(call.mediaProvider).talk(call.callId, call.hasVideo);
                }
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    call
                ]);
            },

            hold: function (call) {
                me.addOrUpdateCall(call);
                me.mediaProviders.get(call.mediaProvider).hold(call.callId);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    call
                ]);
            },

            callbackHold: function (callId, isHold) {
                trace("callbackHold " + isHold);
            },

            finish: function (call) {
                me.finish(call);
            },

            busy: function (call) {
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    call
                ]);
            },

            fail: function (event) {
                if (event.hasOwnProperty("apiMethod")) {
                    var actualEvent = WCSEvent[event.apiMethod];
                    //Finish Call before raising of FAILED event to close resources properly such as peer connection
                    if (event.apiMethod == "CallStatusEvent") {
                        var call = me.calls.get(event.id);
                        if (call) {
                            call.status = CallStatus.FINISH;
                            me.finish(call);
                        }
                    }
                    delete event.apiMethod;
                    me.invokeListener(actualEvent, [
                        event
                    ]);
                } else {
                    me.invokeListener(WCSEvent.ErrorStatusEvent, [
                        event
                    ]);
                }
            },

            notifyBugReport: function (filename) {
                me.invokeListener(WCSEvent.BugReportStatusEvent, [
                    {filename: filename}
                ]);
            },

            notifyMessage: function (message, notificationResult) {
                var sentMessage = me.messages[message.id];
                if (sentMessage != null) {
                    sentMessage.status = message.status;
                }
                if (message.status == MessageStatus.RECEIVED) {
                    //here we will choose what to display on multiple contacts in "from".
                    if (message.from.indexOf(",") != -1) {
                        var fromList = message.from.split(",");
                        message.from = fromList[0];
                    }
                    notificationResult.status = "OK";
                    me.notificationResult(notificationResult);
                    me.invokeListener(WCSEvent.OnMessageEvent, [
                        message
                    ]);
                } else {
                    if (message.status == MessageStatus.ACCEPTED) {
                        if (!sentMessage.isImdnRequired) {
                            me.removeSentMessage(sentMessage);
                        }
                    } else if (message.status == MessageStatus.FAILED) {
                        me.removeSentMessage(sentMessage);
                    } else if (message.status == MessageStatus.IMDN_NOTIFICATION_SENT && sentMessage == null) {
                        me.messages[message.id] = message;
                    } else if (message.status == MessageStatus.IMDN_DELIVERED) {
                        me.removeSentMessage(sentMessage);
                        notificationResult.status = "OK";
                        me.notificationResult(notificationResult);
                    } else if (message.status == MessageStatus.IMDN_FAILED || message.status == MessageStatus.IMDN_FORBIDDEN || message.status == MessageStatus.IMDN_ERROR) {
                        me.removeSentMessage(sentMessage);
                        notificationResult.status = "OK";
                        me.notificationResult(notificationResult);
                    }
                    me.invokeListener(WCSEvent.MessageStatusEvent, [
                        message
                    ]);
                }
            },

            notifyRecordComplete: function (recordReport) {
                me.invokeListener(WCSEvent.RecordingStatusEvent, [
                    recordReport
                ]);
            },

            notifySubscription: function (subscription, sipObject) {
                me.invokeListener(WCSEvent.SubscriptionStatusEvent, [
                    subscription
                ]);
            },

            notifyXcapResponse: function (xcapResponse) {
                me.invokeListener(WCSEvent.XcapStatusEvent, [
                    xcapResponse
                ]);
            },

            notifyStreamStatusEvent: function (stream) {
                //clean resources if status is failed
                if (stream.status == StreamStatus.Failed) {
                    var removedStream;
                    if (stream.published) {
                        removedStream = me.publishStreams.remove(stream.name);
                    } else {
                        removedStream = me.playStreams.remove(stream.name);
                    }
                    if (removedStream) {
                        me.releaseMediaManagerStream(removedStream);
                    }
                } else {
                    if (stream.published) {
                        me.publishStreams.update(stream.id, stream);
                    } else {
                        me.playStreams.update(stream.id, stream);
                    }
                }
                me.invokeListener(WCSEvent.StreamStatusEvent, [
                    stream
                ]);
            },

            OnDataEvent: function (data) {
                me.invokeListener(WCSEvent.OnDataEvent, [
                    data
                ]);
                me.webSocket.send("DataStatusEvent", {status: "ACCEPTED", operationId: data.operationId});
            },

            DataStatusEvent: function (status) {
                me.invokeListener(WCSEvent.DataStatusEvent, [
                    status
                ]);
            }
        };
    },

    removeSentMessage: function (sentMessage) {
        var me = this;
        setTimeout(function () {
            me.messages[sentMessage.id] = null;
        }, 5000);
    },


    connect: function (connection) {
        var me = this;
        me.connection = connection;
        if (me.connection.sipRegisterRequired == undefined) {
            me.connection.sipRegisterRequired = me.configuration.sipRegisterRequired;
        }
        me.connection.sipContactParams = me.connection.sipContactParams | me.configuration.sipContactParams;
        for (var item in me.connection) {
            if (me.connection[item] != null && me.connection[item] != undefined && !Array.isArray(me.connection[item])) {
                me.connection[item] = $.trim(me.connection[item]);
            }
        }

        if (!me.connection.mediaProviders || me.connection.mediaProviders.length == 0) {
            me.connection.mediaProviders = Object.keys(me.mediaProviders.getData());
        }
        me.connection.urlServer = me.connection.urlServer || me.configuration.urlWsServer;
        me.connection.width = me.connection.width || me.configuration.videoWidth;
        me.connection.height = me.connection.height || me.configuration.videoHeight;
        me.connection.clientVersion = me.clientVersion;
        //workaround for old Safari (5.X)
        if ((navigator.userAgent.indexOf("Safari") > -1) && !(navigator.userAgent.indexOf("Chrome") > -1)) {
            me.connection.urlServer = me.connection.urlServer.slice(-1) == "/" ? me.connection.urlServer + "websocket" : me.connection.urlServer + "/websocket";
        }

        var getLocation = function (href) {
            var l = document.createElement("a");
            l.href = href;
            return l;
        };
        var l = getLocation(me.connection.urlServer);

        if (!me.configuration.urlFlashServer) {
            me.configuration.urlFlashServer = "rtmfp://" + l.hostname + ":1935";
        }

        me.webSocket = $.websocket(me.connection.urlServer, {
            open: function () {
                me.isOpened = true;
                me.webSocket.send("connection", me.connection);
            },
            close: function (event) {
                me.isOpened = false;
                if (!event.originalEvent.wasClean) {
                    me.connection.status = ConnectionStatus.Failed;
                } else {
                    me.connection.status = ConnectionStatus.Disconnected;
                }
                me.invokeListener(WCSEvent.ConnectionStatusEvent, [
                    me.connection, event.originalEvent
                ]);
                if (me.webRtcMediaManager) {
                    me.webRtcMediaManager.disconnect();
                }
                if (me.flashMediaManager) {
                    me.flashMediaManager.disconnect();
                }
                me.webRtcCallSessionId = undefined;
                me.calls = new DataMap();
                me.publishStreams = new DataMap();
                me.playStreams = new DataMap();
            },
            error: function () {
                me.connection.status = ConnectionStatus.Failed;
                me.invokeListener(WCSEvent.ConnectionStatusEvent, [
                    me.connection
                ]);
            },
            context: me,
            events: me.callbacks
        });
        return 0;
    },

    invokeProblem: function (status) {
        this.invokeListener(WCSEvent.ErrorStatusEvent, [
            status
        ]);
    },

    disconnect: function () {
        trace("WebSocketManager - disconnect");
        this.webSocket.close();
    },

    subscribe: function (subscribeObject) {
        this.webSocket.send("subscribe", subscribeObject);
    },

    sendXcapRequest: function (xcapObject) {
        this.webSocket.send("sendXcapRequest", xcapObject);
    },

    call: function (call) {
        var me = this;

        call.callId = createUUID();
        call.incoming = false;
        if (!call.isMsrp) {
            call.isMsrp = false;
        }
        if (call.hasAudio == undefined) {
            call.hasAudio = true;
        }
        if (!call.hasVideo) {
            call.hasVideo = false;
        }

        if (!call.receiveVideo) {
            call.receiveVideo = false;
        }

        me.addOrUpdateCall(call);

        var internalCall = function () {
            if (MediaProvider.WebRTC == call.mediaProvider) {
                me.webRtcMediaManager.createOffer(call.callId, function (sdp) {
                    //here we will strip codecs from SDP if requested
                    if (me.configuration.stripCodecs && me.configuration.stripCodecs.length > 0) {
                        sdp = me.stripCodecsSDP(sdp, true);
                        console.log("New SDP: " + sdp);
                    }
                    sdp = me.removeCandidatesFromSDP(sdp);
                    call.sdp = sdp;
                    me.webSocket.send("call", call);
                }, call.hasAudio, call.hasVideo, call.receiveVideo);
            } else if (MediaProvider.Flash == call.mediaProvider) {
                me.webSocket.send("call", call);
            }
        };
        if (call.hasAudio) {
            me.checkAndGetAccess(call.mediaProvider, call.hasVideo, internalCall, []);
        } else {
            internalCall();
        }
        return call;
    },

    msrpCall: function (callRequest) {
        var me = this;
        callRequest.callId = createUUID();
        me.webSocket.send("call", callRequest);
        return callRequest;
    },

    answer: function (call) {
        var me = this;
        me.checkAndGetAccess(call.mediaProvider, call.hasVideo, function () {
            if (MediaProvider.WebRTC == call.mediaProvider) {
                /**
                 * If we receive INVITE without SDP, we should send answer with SDP based on webRtcMediaManager.createOffer because we do not have remoteSdp here
                 */
                if (me.webRtcMediaManager.receivedEmptyRemoteSDP(call.callId)) {
                    me.webRtcMediaManager.createOffer(call.callId, function (sdp) {
                        //here we will strip codecs from SDP if requested
                        if (me.configuration.stripCodecs && me.configuration.stripCodecs.length > 0) {
                            sdp = me.stripCodecsSDP(sdp, true);
                            console.log("New SDP: " + sdp);
                        }
                        call.sdp = me.removeCandidatesFromSDP(sdp);
                        me.webSocket.send("answer", call);
                    }, true, call.hasVideo);
                } else {
                    /**
                     * If we receive a normal INVITE with SDP we should create answering SDP using normal createAnswer method because we already have remoteSdp here.
                     */
                    me.webRtcMediaManager.createAnswer(call.callId, function (sdp) {
                        call.sdp = sdp;
                        me.webSocket.send("answer", call);
                    }, call.hasVideo);
                }
            } else if (MediaProvider.Flash == call.mediaProvider) {
                me.webSocket.send("answer", call);
            }
        }, []);
    },

    changeVideoState: function (call, enable) {
        var me = this;
        if (MediaProvider.Flash == call.mediaProvider) {
            if (!call.hasVideo) {
                me.webSocket.send("updateCallToVideo", call.callId);
                call.hasVideo = true;
            }
            me.flashMediaManager.changeVideoState(call.callId, enable);
        } else {
            //todo uncomment after firefox implement reoffer
            //this.webRtcMediaManager.createOffer(call.callId, function (sdp) {
            //    me.webSocket.send("changeVideoState", {callId: call.callId, sdp: sdp});
            //}, true, call.hasVideo);
        }
        return 0;
    },

    hangup: function (call) {
        if (call) {
            this.webSocket.send("hangup", {callId: call.callId});
        }
    },

    finish: function (call) {
        this.calls.remove(call.callId);
        if (this.calls.getSize() == 0 && MediaProvider.WebRTC == call.mediaProvider) {
            var sessionId = this.webRtcCallSessionId;
            this.webRtcCallSessionId = undefined;
            this.mediaProviders.get(call.mediaProvider).close(sessionId);
        }
        if (MediaProvider.Flash == call.mediaProvider) {
            this.mediaProviders.get(call.mediaProvider).close(call.callId);
        }
        this.invokeListener(WCSEvent.CallStatusEvent, [
            call
        ]);
    },

    hold: function (call) {
        this.webSocket.send("hold", {callId: call.callId});
    },

    holdForTransfer: function (call) {
        this.webSocket.send("hold", {callId: call.callId, holdForTransfer: true});
    },

    unhold: function (call) {
        this.webSocket.send("unhold", {callId: call.callId});
    },

    transfer: function (transferObj) {
        this.webSocket.send("transfer", transferObj);
    },

    sendDTMF: function (dtmfObj) {
        if (!dtmfObj.type) {
            dtmfObj.type = DtmfType.rfc2833;
        }
        this.webSocket.send("sendDtmf", dtmfObj);
    },

    getCallStatistics: function (call, callbackFn) {
        if (MediaProvider.Flash == call.mediaProvider) {
            this.getStreamStatistics(call.callId, call.mediaProvider, callbackFn)
        } else {
            this.getStreamStatistics(this.webRtcCallSessionId, call.mediaProvider, callbackFn);
        }
    },

    getStreamStatistics: function (mediaSessionId, mediaProvider, callbackFn) {
        var me = this;
        if (MediaProvider.Flash == mediaProvider) {
            var statistics = this.flashMediaManager.getStatistics(mediaSessionId);
            var param;
            for (param in statistics.incomingStreams.info) {
                if (param.indexOf("audio") > -1) {
                    statistics.incomingStreams.audio[param] = statistics.incomingStreams.info[param];
                }
                if (param.indexOf("video") > -1) {
                    statistics.incomingStreams.video[param] = statistics.incomingStreams.info[param];
                }
            }
            delete statistics.incomingStreams.info;
            for (param in statistics.outgoingStreams.info) {
                if (param.indexOf("audio") > -1) {
                    statistics.outgoingStreams.audio[param] = statistics.outgoingStreams.info[param];
                }
                if (param.indexOf("video") > -1) {
                    statistics.outgoingStreams.video[param] = statistics.outgoingStreams.info[param];
                }
            }
            delete statistics.outgoingStreams.info;

            statistics.type = "flash";
            callbackFn(statistics);
        } else {
            this.webRtcMediaManager.getStatistics(mediaSessionId, callbackFn);
        }
    },

    getWSPlayerStatistics: function (type) {
        return this.wsPlayerMediaManager.getStreamStatistics(type);
    },

    setUseProxy: function (useProxy) {
        if (this.isOpened) {
            this.webSocket.send("setUseProxy", useProxy);
        }
    },

    pushLogs: function (logsObject) {
        if (this.isOpened) {
            this.webSocket.send("pushLogs", logsObject);
            return true;
        } else {
            return false;
        }
    },

    submitBugReport: function (reportObject) {
        if (this.isOpened) {
            this.webSocket.send("submitBugReport", reportObject);
            return true;
        } else {
            return false;
        }
    },

    setLTState: function (state) {
        trace("setLTState: " + state);
        this.webSocket.send("setLTState", {state: state});
    },

    getAccess: function (mediaProvider, hasVideo) {
        var me = this;
        setTimeout(function () {
            if (hasVideo) {
                if (!me.mediaProviders.get(mediaProvider).getAccessToAudioAndVideo()) {
                    me.invokeProblem({
                        status: WCSError.MIC_CAM_ACCESS_PROBLEM,
                        info: "Failed to get access to microphone or not found"
                    });
                }
            } else {
                if (!me.mediaProviders.get(mediaProvider).getAccessToAudio()) {
                    me.invokeProblem({
                        status: WCSError.MIC_ACCESS_PROBLEM,
                        info: "Failed to get access to microphone and camera or not found"
                    });
                }
            }
        }, 50);

    },

    hasAccess: function (mediaProvider, hasVideo) {
        var mp = this.mediaProviders.get(mediaProvider);
        if (hasVideo) {
            return mp.hasAccessToAudioAndVideo && mp.hasAccessToAudioAndVideo();
        } else {
            return mp.hasAccessToAudio && mp.hasAccessToAudio();
        }
    },

    releaseCameraAndMicrophone: function (mediaProvider) {
        this.mediaProviders.get(mediaProvider).releaseCameraAndMicrophone();
    },

    getVolume: function (call) {
        if (MediaProvider.Flash == call.mediaProvider) {
            this.mediaProviders.get(call.mediaProvider).setVolume(call.callId, value);
        } else {
            this.mediaProviders.get(call.mediaProvider).setVolume(this.webRtcCallSessionId, value);
        }
    },

    setVolume: function (call, value) {
        if (MediaProvider.Flash == call.mediaProvider) {
            this.mediaProviders.get(call.mediaProvider).setVolume(call.callId, value);
        } else {
            this.mediaProviders.get(call.mediaProvider).setVolume(this.webRtcCallSessionId, value);
        }
    },

    muteVideo: function (mediaProvider) {
        if (!mediaProvider) {
            mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
        }
        this.mediaProviders.get(mediaProvider).muteVideo();

    },

    unmuteVideo: function (mediaProvider) {
        if (!mediaProvider) {
            mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
        }
        this.mediaProviders.get(mediaProvider).unmuteVideo();
    },

    isVideoMuted: function (mediaProvider) {
        if (!mediaProvider) {
            mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
        }
        return this.mediaProviders.get(mediaProvider).isVideoMuted();

    },

    mute: function (mediaProvider) {
        if (!mediaProvider) {
            mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
        }
        this.mediaProviders.get(mediaProvider).mute();
    },

    unmute: function (mediaProvider) {
        if (!mediaProvider) {
            mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
        }
        this.mediaProviders.get(mediaProvider).unmute();
    },

    //works only for WSPlayer
    playFirstSound: function () {
        if (this.wsPlayerMediaManager) {
            this.wsPlayerMediaManager.playFirstSound();
        }
    },

    sendMessage: function (message) {
        var id = createUUID();
        message.id = id;
        message.from = this.userData.sipLogin;
        message.contentType = message.contentType || this.configuration.msgContentType;
        message.isImdnRequired = message.isImdnRequired || this.configuration.imdnEnabled;
        this.messages[id] = message;
        this.webSocket.send("sendMessage", message);
    },

    notificationResult: function (result) {
        this.webSocket.send("notificationResult", result);
    },

    sendData: function (data) {
        this.webSocket.send("sendData", data);
    },

    publishStream: function (stream) {
        var me = this;
        var mediaSessionId = createUUID();

        stream.mediaSessionId = mediaSessionId;
        stream.published = true;
        if (stream.record == undefined) {
            stream.record = false;
        }
        if (stream.hasVideo == undefined) {
            stream.hasVideo = true;
        }
        if (!stream.mediaProvider) {
            stream.mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
        }

        me.checkAndGetAccess(stream.mediaProvider, stream.hasVideo, function () {
            if (MediaProvider.WebRTC == stream.mediaProvider) {
                me.webRtcMediaManager.newConnection(mediaSessionId, new WebRtcMediaConnection(me.webRtcMediaManager, me.configuration.stunServer, me.configuration.useDTLS | true, undefined, mediaSessionId));

                me.webRtcMediaManager.createOffer(mediaSessionId, function (sdp) {
                    trace("Publish name " + stream.name);
                    if (me.configuration.stripCodecs && me.configuration.stripCodecs.length > 0) {
                        sdp = me.stripCodecsSDP(sdp, true);
                        console.log("New SDP: " + sdp);
                    }
                    stream.sdp = me.removeCandidatesFromSDP(sdp);
                    me.webSocket.send("publishStream", stream);
                    me.publishStreams.add(stream.name, stream);
                }, true, stream.hasVideo);
            } else if (MediaProvider.Flash == stream.mediaProvider) {
                //todo add pcma/pcmu
                stream.sdp = "v=0\r\n" +
                    "o=- 1988962254 1988962254 IN IP4 0.0.0.0\r\n" +
                    "c=IN IP4 0.0.0.0\r\n" +
                    "t=0 0\r\n" +
                    "a=sdplang:en\r\n" +
                    "m=video 0 RTP/AVP 112\r\n" +
                    "a=rtpmap:112 H264/90000\r\n" +
                    "a=fmtp:112 packetization-mode=1; profile-level-id=420020\r\n" +
                    "a=sendonly\r\n" +
                    "m=audio 0 RTP/AVP 0 8 100\r\n" +
                    "a=rtpmap:0 PCMU/8000\r\n" +
                    "a=rtpmap:8 PCMA/8000\r\n" +
                    "a=rtpmap:100 SPEEX/16000\r\n" +
                    "a=sendonly\r\n";
                me.webSocket.send("publishStream", stream);
                me.publishStreams.add(stream.name, stream);
                me.flashMediaManager.publishStream(stream.mediaSessionId, true, stream.hasVideo);
            }
        }, []);

    },

    unPublishStream: function (stream) {
        console.log("Unpublish stream " + stream.name);
        var me = this;
        var removedStream = me.publishStreams.remove(stream.name);
        if (removedStream) {
            if (MediaProvider.WebRTC == removedStream.mediaProvider) {
                me.webRtcMediaManager.close(removedStream.mediaSessionId);
            } else if (MediaProvider.Flash == removedStream.mediaProvider) {
                me.flashMediaManager.unPublishStream(removedStream.mediaSessionId);
            }
            me.webSocket.send("unPublishStream", removedStream);
        }
    },

    shareScreen: function (stream, extensionId) {
        console.log("Share screen with name " + stream.name);
        var me = this;
        var mediaSessionId = createUUID();

        stream.mediaSessionId = mediaSessionId;
        stream.published = true;
        if (stream.record == undefined) {
            stream.record = false;
        }
        if (stream.hasVideo == undefined) {
            stream.hasVideo = true;
        }

        stream.mediaProvider = MediaProvider.WebRTC;
        me.getScreenAccess(extensionId, function(response) {
            if (response.success) {
                me.webRtcMediaManager.newConnection(mediaSessionId, new WebRtcMediaConnection(me.webRtcMediaManager, me.configuration.stunServer, me.configuration.useDTLS | true, undefined, mediaSessionId));

                me.webRtcMediaManager.createOffer(mediaSessionId, function (sdp) {
                    trace("Publish name for screen sharing " + stream.name);
                    if (me.configuration.stripCodecs && me.configuration.stripCodecs.length > 0) {
                        sdp = me.stripCodecsSDP(sdp, true);
                        console.log("New SDP: " + sdp);
                    }
                    stream.sdp = me.removeCandidatesFromSDP(sdp);
                    me.webSocket.send("publishStream", stream);
                    me.publishStreams.add(stream.name, stream);
                }, true, stream.hasVideo, false, true);
            }
        });
    },

    playStream: function (stream) {
        var me = this;
        var streamObj = me.playStreams.get(stream.name);
        if (streamObj) {
            console.log("Request resume for stream " + stream.name);
            if (streamObj.mediaProvider == MediaProvider.WSPlayer) {
                me.wsPlayerMediaManager.resume();
            }
            me.webSocket.send("playStream", streamObj);
            return;
        }
        var mediaSessionId = createUUID();
        stream.mediaSessionId = mediaSessionId;
        stream.published = false;
        if (stream.record == undefined) {
            stream.record = false;
        }
        if (!stream.mediaProvider) {
            stream.mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
        }


        if (MediaProvider.WebRTC == stream.mediaProvider) {

            me.webRtcMediaManager.newConnection(mediaSessionId, new WebRtcMediaConnection(me.webRtcMediaManager, me.configuration.stunServer, me.configuration.useDTLS | true, stream.remoteMediaElementId || me.configuration.remoteMediaElementId, mediaSessionId));


            if (stream.hasVideo == undefined) {
                stream.hasVideo = true;
            }

            me.webRtcMediaManager.createOffer(mediaSessionId, function (sdp) {
                console.log("playStream name " + stream.name);
                if (me.configuration.stripCodecs && me.configuration.stripCodecs.length > 0) {
                    sdp = me.stripCodecsSDP(sdp, true);
                    console.log("New SDP: " + sdp);
                }
                stream.sdp = me.removeCandidatesFromSDP(sdp);
                me.webSocket.send("playStream", stream);

                me.playStreams.add(stream.name, stream);
            }, false, false, stream.hasVideo);
            //!stream.sdp is for wsPlayer backward compatibility
        } else if (MediaProvider.Flash == stream.mediaProvider && !stream.sdp){
            //todo add pcma/pcmu
            stream.sdp = "v=0\r\n" +
                "o=- 1988962254 1988962254 IN IP4 0.0.0.0\r\n" +
                "c=IN IP4 0.0.0.0\r\n" +
                "t=0 0\r\n" +
                "a=sdplang:en\r\n"+
                "m=video 0 RTP/AVP 112\r\n" +
                "a=rtpmap:112 H264/90000\r\n" +
                "a=fmtp:112 packetization-mode=1; profile-level-id=420020\r\n" +
                "a=recvonly\r\n" +
                "m=audio 0 RTP/AVP 0 8 100\r\n" +
                "a=rtpmap:0 PCMU/8000\r\n" +
                "a=rtpmap:8 PCMA/8000\r\n" +
                "a=rtpmap:100 SPEEX/16000\r\n" +
                "a=recvonly\r\n";
            me.webSocket.send("playStream", stream);
            me.playStreams.add(stream.name, stream);
            me.flashMediaManager.playStream(stream.mediaSessionId);
        } else if (MediaProvider.WSPlayer == stream.mediaProvider) {
            stream.sdp = "v=0\r\n" +
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
            me.webSocket.send("playStream", stream);
            me.playStreams.add(stream.name, stream);
            me.wsPlayerMediaManager.play();
        } else {
            console.log("playStream name " + stream.name);
            me.webSocket.send("playStream", stream);
            me.playStreams.add(stream.name, stream);
        }
        return stream;
    },

    stopStream: function (stream) {
        console.log("unSubscribe stream " + stream.name);
        var me = this;
        var removedStream = me.playStreams.remove(stream.name);
        if (removedStream) {
            me.releaseMediaManagerStream(removedStream);
            me.webSocket.send("stopStream", removedStream);
        }
    },

    //Works only with websocket streams
    pauseStream: function (stream) {
        console.log("Pause stream " + stream.name);
        if (MediaProvider.WSPlayer == stream.mediaProvider && this.wsPlayerMediaManager) {
            this.wsPlayerMediaManager.pause();
        }
        this.webSocket.send("pauseStream", stream);
    },

    releaseMediaManagerStream: function (stream) {
        var me = this;
        if (MediaProvider.WebRTC == stream.mediaProvider && me.webRtcMediaManager) {
            me.webRtcMediaManager.close(stream.mediaSessionId);
        } else if (MediaProvider.Flash == stream.mediaProvider && me.flashMediaManager) {
            if (stream.published) {
                me.flashMediaManager.unPublishStream(stream.mediaSessionId);
            } else {
                me.flashMediaManager.stopStream(stream.mediaSessionId);
            }
        } else if (MediaProvider.WSPlayer == stream.mediaProvider && me.wsPlayerMediaManager) {
            me.wsPlayerMediaManager.stop();
        }
    },

    removeCandidatesFromSDP: function (sdp) {
        var sdpArray = sdp.split("\n");

        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search("a=candidate:") != -1) {
                sdpArray[i] = "";
            }
        }

        //normalize sdp after modifications
        var result = "";
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i] != "") {
                result += sdpArray[i] + "\n";
            }
        }

        return result;
    },

    stripCodecsSDP: function (sdp, removeCandidates) {
        var sdpArray = sdp.split("\n");

        //search and delete codecs line
        var pt = [];
        var i;
        for (p = 0; p < this.configuration.stripCodecs.length; p++) {
            console.log("Searching for codec " + this.configuration.stripCodecs[p]);
            for (i = 0; i < sdpArray.length; i++) {
                if (sdpArray[i].search(this.configuration.stripCodecs[p]) != -1 && sdpArray[i].indexOf("a=rtpmap") == 0) {
                    console.log(this.configuration.stripCodecs[p] + " detected");
                    pt.push(sdpArray[i].match(/[0-9]+/)[0]);
                    sdpArray[i] = "";
                }
            }
        }

        if (removeCandidates) {
            for (i = 0; i < sdpArray.length; i++) {
                if (sdpArray[i].search("a=candidate:") != -1) {
                    sdpArray[i] = "";
                }
            }
        }

        if (pt.length) {
            //searching for fmtp
            for (p = 0; p < pt.length; p++) {
                for (i = 0; i < sdpArray.length; i++) {
                    if (sdpArray[i].search("a=fmtp:" + pt[p]) != -1) {
                        console.log("PT " + pt[p] + " detected");
                        sdpArray[i] = "";
                    }
                }
            }

            //delete entries from m= line
            for (i = 0; i < sdpArray.length; i++) {
                if (sdpArray[i].search("m=audio") != -1) {
                    console.log("m line detected " + sdpArray[i]);
                    var mLineSplitted = sdpArray[i].split(" ");
                    var newMLine = "";
                    for (m = 0; m < mLineSplitted.length; m++) {
                        if (pt.indexOf(mLineSplitted[m]) == -1 || m <= 2) {
                            newMLine += mLineSplitted[m];
                            if (m < mLineSplitted.length - 1) {
                                newMLine = newMLine + " ";
                            }
                        }
                    }
                    sdpArray[i] = newMLine;
                    console.log("Resulting m= line is: " + sdpArray[i]);
                    break;
                }
            }
        }

        //normalize sdp after modifications
        var result = "";
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i] != "") {
                result += sdpArray[i] + "\n";
            }
        }

        return result;
    },

    handleVideoSSRC: function (sdp) {
        var sdpArray = sdp.split("\n");
        var videoPart = false;
        var recvonly = false;
        var ssrcPos = -1;
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search("m=video") != -1) {
                videoPart = true;
            }
            if (sdpArray[i].search("a=ssrc") != -1 && videoPart) {
                ssrcPos = i;
            }
            if (sdpArray[i].search("a=recvonly") != -1 && videoPart) {
                recvonly = true;
            }
            if (sdpArray[i].search("m=audio") != -1 && videoPart) {
                break;
            }
        }

        if (recvonly && ssrcPos != -1) {
            sdpArray[ssrcPos] = "";
        }

        //normalize sdp after modifications
        var result = "";
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i] != "") {
                result += sdpArray[i] + "\n";
            }
        }

        return result;
    },

    getScreenAccess: function (extensionId, callback) {
        this.webRtcMediaManager.getScreenAccess(extensionId, callback);
    },

    isScreenSharingExtensionInstalled: function(extensionId, callback) {
        if (this.isChrome()) {
            chrome.runtime.sendMessage(extensionId, {type: "isInstalled"}, function (response) {
                if (response) {
                    callback(true);
                } else {
                    callback(false);
                }
            });
        } else if (this.isFF()) {
            callback(this.firefoxScreenSharingExtensionInstalled);
        }
    },

    checkAndGetAccess: function (mediaProvider, hasVideo, func, args) {
        var me = this;
        if (args === undefined) {
            args = [];
        }
        if (!this.hasAccess(mediaProvider, hasVideo)) {
            if (this.intervalId == -1) {
                var checkAccessFunc = function () {
                    if (me.hasAccess(mediaProvider, hasVideo)) {
                        clearInterval(me.intervalId);
                        me.intervalId = -1;
                        me.checkAndGetAccess(mediaProvider, hasVideo, func, args);
                    }
                };
                this.intervalId = setInterval(checkAccessFunc, 500);
            }
            this.getAccess(mediaProvider, hasVideo);
        } else if (this.hasAccess(mediaProvider, hasVideo)) {
            func.apply(this, args);
        } else {
            trace("Microphone is not plugged in");
        }
    },

    getCookie: function (c_name) {
        var i, x, y, ARRcookies = document.cookie.split(";");
        for (i = 0; i < ARRcookies.length; i++) {
            x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
            x = x.replace(/^\s+|\s+$/g, "");
            if (x == c_name) {
                return ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
            }
        }
        return "";
    },

    setCookie: function (c_name, value) {
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + 100);
        var c_value = escape(value) + "; expires=" + exdate.toUTCString();
        document.cookie = c_name + "=" + c_value;
        return value;
    }
};

var isFlashphonerAPILoaded = false;
function notifyFlashphonerAPILoaded() {
    isFlashphonerAPILoaded = true;
    Flashphoner.getInstance().initFlashMediaManager();
}

var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;

var WebRtcMediaManager = function () {
    this.webRtcMediaConnections = new DataMap();
    this.audioMuted = 1;
    this.videoMuted = 1;
    this.remoteSDP = {};
    this.onLocalScreenMediaStreamEnded = null;
};

WebRtcMediaManager.prototype.getVolume = function (id) {
    var webRtcMediaConnection = this.webRtcMediaConnections.get(id);
    return webRtcMediaConnection.remoteMediaElement.volume;
};

WebRtcMediaManager.prototype.setVolume = function (id, volume) {
    var webRtcMediaConnection = this.webRtcMediaConnections.get(id);
    webRtcMediaConnection.remoteMediaElement.volume = volume / 100;
};

WebRtcMediaManager.prototype.isVideoMuted = function () {
    if (this.localAudioVideoStream) {
        return !this.localAudioVideoStream.getVideoTracks()[0].enabled;
    } else {
        return true;
    }
};

WebRtcMediaManager.prototype.muteVideo = function () {
    if (this.localAudioVideoStream) {
        this.localAudioVideoStream.getVideoTracks()[0].enabled = false;
    }
};

WebRtcMediaManager.prototype.unmuteVideo = function () {
    if (this.localAudioVideoStream) {
        this.localAudioVideoStream.getVideoTracks()[0].enabled = true;
    }
};

WebRtcMediaManager.prototype.mute = function () {
    if (this.localAudioStream) {
        this.localAudioStream.getAudioTracks()[0].enabled = false;
    }
    if (this.localAudioVideoStream) {
        this.localAudioVideoStream.getAudioTracks()[0].enabled = false;
    }
};

WebRtcMediaManager.prototype.unmute = function () {
    if (this.localAudioStream) {
        this.localAudioStream.getAudioTracks()[0].enabled = true;
    }
    if (this.localAudioVideoStream) {
        this.localAudioVideoStream.getAudioTracks()[0].enabled = true;
    }
};

WebRtcMediaManager.prototype.hasAccessToAudio = function () {
    return this.audioMuted == -1;
};

WebRtcMediaManager.prototype.hasAccessToAudioAndVideo = function () {
    return this.videoMuted == -1;
};

WebRtcMediaManager.prototype.newConnection = function (id, webRtcMediaConnection) {
    if (this.remoteSDP[id] || this.remoteSDP[id] == "") {
        webRtcMediaConnection.setRemoteSDP(this.remoteSDP[id], false);
        delete this.remoteSDP[id];
    }
    this.webRtcMediaConnections.add(id, webRtcMediaConnection);
};

WebRtcMediaManager.prototype.receivedEmptyRemoteSDP = function (id) {
    var webRtcMediaConnection = this.webRtcMediaConnections.get(id);
    return !webRtcMediaConnection || webRtcMediaConnection.lastReceivedSdp == "";
};

WebRtcMediaManager.prototype.createOffer = function (id, callback, hasAudio, hasVideo, receiveVideo, screenCapture) {
    var webRtcMediaConnection = this.webRtcMediaConnections.get(id);
    webRtcMediaConnection.createOffer(callback, hasAudio, hasVideo, receiveVideo, screenCapture);
};

WebRtcMediaManager.prototype.createAnswer = function (id, callback, hasVideo) {
    var webRtcMediaConnection = this.webRtcMediaConnections.get(id);
    webRtcMediaConnection.createAnswer(callback, hasVideo);
};

WebRtcMediaManager.prototype.setRemoteSDP = function (id, sdp, isInitiator) {
    var webRtcMediaConnection = this.webRtcMediaConnections.get(id);
    if (webRtcMediaConnection) {
        webRtcMediaConnection.setRemoteSDP(sdp, isInitiator);
    } else {
        this.remoteSDP[id] = sdp;
    }
};

WebRtcMediaManager.prototype.getStatistics = function (callId, callbackFn) {
    var webRtcMediaConnection = this.webRtcMediaConnections.get(callId);
    webRtcMediaConnection.getStatistics(callbackFn);
};


WebRtcMediaManager.prototype.setAudioCodec = function (id, codec) {
};

WebRtcMediaManager.prototype.talk = function (callId, hasVideo) {

};

WebRtcMediaManager.prototype.hold = function (callId) {
};

WebRtcMediaManager.prototype.close = function (id) {
    var connection = this.webRtcMediaConnections.remove(id);
    if (connection) {
        connection.close();
        this.unmute();
        this.unmuteVideo();
    }
};

WebRtcMediaManager.prototype.disconnect = function () {
    for (var id in this.webRtcMediaConnections.getData()) {
        this.webRtcMediaConnections.remove(id).close();
    }
};

WebRtcMediaManager.prototype.getAccessToAudioAndVideo = function () {
    var me = this;
    if (!me.localAudioVideoStream) {
        var requestedMedia = {};
        requestedMedia.audio = true;
        requestedMedia.video = {};
        //FF differs from Chrome
        if (webrtcDetectedBrowser == "firefox") {
            requestedMedia.video.width = Flashphoner.getInstance().configuration.videoWidth;
            requestedMedia.video.height = Flashphoner.getInstance().configuration.videoHeight;
        } else {
            requestedMedia.video = {
                mandatory: {
                    maxWidth: Flashphoner.getInstance().configuration.videoWidth,
                    maxHeight: Flashphoner.getInstance().configuration.videoHeight
                },
                optional: []
            };

            if (Flashphoner.getInstance().configuration.forceResolution) {
                requestedMedia.video.mandatory.minWidth = Flashphoner.getInstance().configuration.videoWidth;
                requestedMedia.video.mandatory.minHeight = Flashphoner.getInstance().configuration.videoHeight;
            }
        }
        getUserMedia(requestedMedia, function (stream) {
                var localMediaElement = getElement(Flashphoner.getInstance().configuration.localMediaElementId);
                if (localMediaElement) {
                    attachMediaStream(localMediaElement, stream);
                }
                me.localAudioVideoStream = stream;
                if (webrtcDetectedBrowser != "firefox") {
                    me.audioMuted = -1;
                }
                me.videoMuted = -1;
            }, function (error) {
                trace("Failed to get access to local media. Error code was " + error.code + ".");
                me.audioMuted = 1;
                me.videoMuted = 1;
                var status = {
                    status: WCSError.MIC_CAM_ACCESS_PROBLEM,
                    info: "Failed to get access to microphone and camera. Error code was " + error.code + "."
                };
                Flashphoner.getInstance().invokeProblem(status);
            }
        );
    }
    return true;
};

WebRtcMediaManager.prototype.getScreenAccess = function (extensionId, callback) {
    var me = this;
    if (Flashphoner.getInstance().isChrome()) {
        chrome.runtime.sendMessage(extensionId, {type: "isInstalled"}, function (response) {
            if (response) {
                chrome.runtime.sendMessage(extensionId, {type: "getSourceId"}, function (response) {
                    if (response.error) {
                        var status = {
                            status: WCSError.SCREEN_ACCESS_PROBLEM,
                            info: "Permission denied"
                        };
                        Flashphoner.getInstance().invokeProblem(status);
                    } else {
                        var screen_constraints = {
                            audio: false,
                            video: {
                                mandatory: {
                                    maxWidth: Flashphoner.getInstance().configuration.screenSharingVideoWidth,
                                    maxHeight: Flashphoner.getInstance().configuration.screenSharingVideoHeight,
                                    chromeMediaSourceId: response.sourceId,
                                    chromeMediaSource: "desktop"
                                },
                                optional: []
                            }
                        };
                        if (Flashphoner.getInstance().configuration.screenSharingVideoFps) {
                            screen_constraints.video.mandatory.maxFrameRate = Flashphoner.getInstance().configuration.screenSharingVideoFps;
                        }
                        getUserMedia(screen_constraints, function (stream) {
                                var localMediaElement2 = getElement(Flashphoner.getInstance().configuration.localMediaElementId2);
                                if (localMediaElement2) {
                                    attachMediaStream(localMediaElement2, stream);
                                }
                                me.localScreenCaptureStream = stream;
                                callback({success: true});
                            }, function (error) {
                                trace("Failed to get access to screen capture. Error code was " + error.code + ".");
                                callback({success: false});
                                var status = {
                                    status: WCSError.SCREEN_ACCESS_PROBLEM,
                                    info: "Failed to get access to screen capture. Error code was " + error.code + "."
                                };
                                Flashphoner.getInstance().invokeProblem(status);
                            }
                        );
                    }
                });
            } else {
                var status = {
                    status: WCSError.SCREEN_EXTENSION_UNAVAILABLE,
                    info: "Screen sharing extension not available!"
                };
                Flashphoner.getInstance().invokeProblem(status);
            }
        });
    } else if (Flashphoner.getInstance().isFF()) {
        if (Flashphoner.getInstance().firefoxScreenSharingExtensionInstalled) {
            var constraints = {
                video: {
                    //can be screen, window or application
                    //todo add to method arguments
                    mediaSource: 'application',
                    mandatory: {
                        maxWidth: Flashphoner.getInstance().configuration.screenSharingVideoWidth,
                        maxHeight: Flashphoner.getInstance().configuration.screenSharingVideoHeight
                    }
                }
            };
            if (Flashphoner.getInstance().configuration.screenSharingVideoFps) {
                constraints.video.mandatory.maxFrameRate = Flashphoner.getInstance().configuration.screenSharingVideoFps;
            }
            getUserMedia(constraints, function (stream) {
                    var localMediaElement2 = getElement(Flashphoner.getInstance().configuration.localMediaElementId2);
                    if (localMediaElement2) {
                        attachMediaStream(localMediaElement2, stream);
                    }
                    me.localScreenCaptureStream = stream;
                    callback({success: true});
                }, function (error) {
                    trace("Failed to get access to screen capture. Error code was " + error.code + ".");
                    callback({success: false});
                    var status = {
                        status: WCSError.SCREEN_ACCESS_PROBLEM,
                        info: "Failed to get access to screen capture. Error code was " + error.code + "."
                    };
                    Flashphoner.getInstance().invokeProblem(status);
                }
            );
        } else {
            var status = {
                status: WCSError.SCREEN_EXTENSION_UNAVAILABLE,
                info: "Screen sharing extension not available!"
            };
            Flashphoner.getInstance().invokeProblem(status);
        }
    } else {
        var status = {
            status: WCSError.SCREEN_EXTENSION_UNAVAILABLE,
            info: "Screen sharing is not supported in this browser!"
        };
        Flashphoner.getInstance().invokeProblem(status);
    }
};

WebRtcMediaManager.prototype.getAccessToAudio = function () {
    var me = this;
    if (!me.localAudioStream) {
        getUserMedia({audio: true}, function (stream) {
                me.localAudioStream = stream;
                me.audioMuted = -1;
            }, function (error) {
                var status = {
                    status: WCSError.MIC_ACCESS_PROBLEM,
                    info: "Failed to get access to microphone. Error code was " + error.code + "."
                };
                Flashphoner.getInstance().invokeProblem(status);
                me.audioMuted = 1;
            }
        );
    }
    return true;
};

WebRtcMediaManager.prototype.releaseCameraAndMicrophone = function () {
    if (this.localAudioStream) {
        this.localAudioStream.stop();
        this.localAudioStream = null;
    }
    if (this.localAudioVideoStream) {
        this.localAudioVideoStream.stop();
        this.localAudioVideoStream = null;
    }
    if (this.localScreenCaptureStream) {
        this.localScreenCaptureStream.stop();
        this.localScreenCaptureStream = null;
    }
    this.audioMuted = 1;
    this.videoMuted = 1;
};

var WebRtcMediaConnection = function (webRtcMediaManager, stunServer, useDTLS, remoteMediaElementId, id) {
    var me = this;
    me.webRtcMediaManager = webRtcMediaManager;
    me.peerConnection = null;
    me.peerConnectionState = 'new';
    me.remoteAudioVideoMediaStream = null;
    if (remoteMediaElementId) {
        me.remoteMediaElement = getElement(remoteMediaElementId);
    }
    me.stunServer = stunServer;
    me.useDTLS = useDTLS;
    me.lastReceivedSdp = null;
    me.id = id;
    //stun server by default
    //commented to speedup WebRTC call establishment
    //me.stunServer = "stun.l.google.com:19302";
};

WebRtcMediaConnection.prototype.init = function () {
    trace("WebRtcMediaConnection - init");
    this.hasVideo = false;
    this.peerConnection = null;
    this.peerConnectionState = 'new';
    this.remoteAudioVideoMediaStream = null;
};

WebRtcMediaConnection.prototype.close = function () {
    //Commented to prevent termination of rtcMediaManager after MSRP call
    trace("WebRtcMediaConnection - close()");
    if (this.peerConnectionState != 'finished') {
        this.peerConnectionState = 'finished';
        if (this.peerConnection) {
            trace("WebRtcMediaConnection - PeerConnection will be closed");
            if (this.remoteMediaElement) {
                this.remoteMediaElement.pause();
            }
            //check if this was screen sharing media and close it
            if (this.webRtcMediaManager.localScreenCaptureStream) {
                //todo use this.peerConnection.getStreamById() when available in firefox
                var localStreams = this.peerConnection.getLocalStreams();
                var me = this;
                localStreams.some(function (mediaStream) {
                    if (me.webRtcMediaManager.localScreenCaptureStream.id == mediaStream.id) {
                        me.webRtcMediaManager.localScreenCaptureStream.getVideoTracks()[0].stop();
                        me.webRtcMediaManager.localScreenCaptureStream = null;
                        return true;
                    }
                })
            }
            this.peerConnection.close();
        }
    } else {
        console.log("peerConnection already closed, do nothing!");
    }
};


WebRtcMediaConnection.prototype.createPeerConnection = function () {
    trace("WebRtcMediaConnection - createPeerConnection()");
    var application = this;
    if (application.stunServer !== undefined && application.stunServer.length > 0) {
        pc_config = {
            "iceServers": [
                {"url": "stun:" + application.stunServer}
            ]
        };
    } else {
        pc_config = {"iceServers": []};
    }
    this.peerConnection = new RTCPeerConnection(pc_config, {
        "optional": [
            {"DtlsSrtpKeyAgreement": application.useDTLS}
        ]
    });

    this.peerConnection.onaddstream = function (event) {
        application.onOnAddStreamCallback(event);
    };


    this.peerConnection.onremovestream = function (event) {
        application.onOnRemoveStreamCallback(event);
    };
};

WebRtcMediaConnection.prototype.onOnAddStreamCallback = function (event) {
    trace("WebRtcMediaConnection - onOnAddStreamCallback(): event=" + event);
    trace("WebRtcMediaConnection - onOnAddStreamCallback(): event=" + event.stream);
    trace("WebRtcMediaConnection - onOnAddStreamCallback(): event=" + this.remoteMediaElement);
    if (this.peerConnection != null) {
        this.remoteAudioVideoMediaStream = event.stream;
        if (this.remoteMediaElement) {
            attachMediaStream(this.remoteMediaElement, this.remoteAudioVideoMediaStream);
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onOnAddStreamCallback(): this.peerConnection is null, bug in state machine!, bug in state machine!");
    }
};

WebRtcMediaConnection.prototype.onOnRemoveStreamCallback = function (event) {
    trace("WebRtcMediaConnection - onOnRemoveStreamCallback(): event=" + event);
    if (this.peerConnection != null) {
        this.remoteAudioVideoMediaStream = null;
        if (this.remoteMediaElement) {
            this.remoteMediaElement.pause();
        }
    } else {
        console.warn("SimpleWebRtcSipPhone:onOnRemoveStreamCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaConnection.prototype.waitGatheringIce = function () {
    var me = this;
    if (me.peerConnection != null) {
        sendSdp = function () {
            if (me.peerConnection != null) {
                trace("WebRtcMediaConnection - waitGatheringIce() iceGatheringState=" + me.peerConnection.iceGatheringState);
                if (me.peerConnection.iceGatheringState == "complete") {
                    trace("WebRtcMediaConnection - setLocalSDP: sdp=" + me.peerConnection.localDescription.sdp);
                    if (me.peerConnectionState == 'preparing-offer') {
                        me.peerConnectionState = 'offer-sent';
                        me.createOfferCallback(me.peerConnection.localDescription.sdp);// + this.candidates);
                    }
                    else if (me.peerConnectionState == 'preparing-answer') {
                        me.peerConnectionState = 'established';
                        me.createAnswerCallback(me.peerConnection.localDescription.sdp);// + this.candidates);
                    }
                    else if (me.peerConnectionState == 'established') {
                    }
                    else {
                        console.log("WebRtcMediaConnection - onIceCandidateCallback(): RTCPeerConnection bad state!");
                    }
                    clearInterval(me.iceIntervalId);
                }
            } else {
                clearInterval(me.iceIntervalId);
            }
        };
        me.iceIntervalId = setInterval(sendSdp, 500);

    }
    else {
        console.warn("WebRtcMediaConnection - onIceCandidateCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaConnection.prototype.getConstraints = function (receiveVideo, screenCapture) {
    var constraints = {};
    if (webrtcDetectedBrowser == "firefox") {
        constraints = {offerToReceiveAudio: !screenCapture, offerToReceiveVideo: receiveVideo};
    } else {
        constraints = {optional: [], mandatory: {OfferToReceiveAudio: true, OfferToReceiveVideo: receiveVideo}};
    }
    return constraints;
};

WebRtcMediaConnection.prototype.createOffer = function (createOfferCallback, hasAudio, hasVideo, receiveVideo, screenCapture) {
    trace("WebRtcMediaConnection - createOffer()");
    var me = this;
    try {
        if (me.getConnectionState() != "established") {
            trace("Connection state is not established. Initializing...");
            me.init();
        }
        var mandatory = {};
        if (me.peerConnection == null) {
            trace("peerConnection is null");
            me.createPeerConnection();
            if (screenCapture) {
                if (me.webRtcMediaManager.localScreenCaptureStream) {
                    me.peerConnection.addStream(me.webRtcMediaManager.localScreenCaptureStream);
                    mandatory = me.getConstraints(receiveVideo, screenCapture);
                    me.webRtcMediaManager.localScreenCaptureStream.onended = function(event) {
                        if (me.peerConnectionState != 'finished') {
                            me.webRtcMediaManager.onLocalScreenMediaStreamEnded(me.id);
                        }
                    }
                }
            } else if (hasAudio && hasVideo) {
                if (me.webRtcMediaManager.videoTrack) {
                    me.webRtcMediaManager.localAudioVideoStream.addTrack(me.webRtcMediaManager.videoTrack);
                    me.webRtcMediaManager.videoTrack = null;
                }
                me.peerConnection.addStream(me.webRtcMediaManager.localAudioVideoStream);
            } else if (hasAudio) {
                if (me.webRtcMediaManager.localAudioStream) {
                    me.peerConnection.addStream(me.webRtcMediaManager.localAudioStream);
                } else {
                    var localAudioVideoStream = me.webRtcMediaManager.localAudioVideoStream;
                    if (localAudioVideoStream.getVideoTracks().length > 0) {
                        me.webRtcMediaManager.videoTrack = localAudioVideoStream.getVideoTracks()[0];
                        localAudioVideoStream.removeTrack(me.webRtcMediaManager.videoTrack);
                    }
                    me.peerConnection.addStream(me.webRtcMediaManager.localAudioVideoStream);
                }
                mandatory = me.getConstraints(receiveVideo);
            } else {
                if (receiveVideo == undefined) {
                    receiveVideo = true;
                }
                mandatory = me.getConstraints(receiveVideo);
            }
        }
        me.createOfferCallback = createOfferCallback;
        me.peerConnection.createOffer(function (offer) {
            me.onCreateOfferSuccessCallback(offer);
        }, function (error) {
            me.onCreateOfferErrorCallback(error);
        }, mandatory);

    }
    catch (exception) {
        console.error("WebRtcMediaConnection - createOffer(): catched exception:" + exception);
    }
};

WebRtcMediaConnection.prototype.createAnswer = function (createAnswerCallback, hasVideo) {
    var me = this;
    trace("WebRtcMediaConnection - createAnswer() me.getConnectionState(): " + me.getConnectionState() + " me.hasVideo: " + me.hasVideo);
    if (me.getConnectionState() != "established") {
        me.init();
    }
    try {

        if (me.peerConnection == null) {
            me.createPeerConnection();
            if (hasVideo) {
                if (me.webRtcMediaManager.videoTrack) {
                    me.webRtcMediaManager.localAudioVideoStream.addTrack(me.webRtcMediaManager.videoTrack);
                    me.webRtcMediaManager.videoTrack = null;
                }
                me.peerConnection.addStream(me.webRtcMediaManager.localAudioVideoStream);
            } else {
                if (me.webRtcMediaManager.localAudioStream) {
                    me.peerConnection.addStream(me.webRtcMediaManager.localAudioStream);
                } else {
                    var localAudioVideoStream = me.webRtcMediaManager.localAudioVideoStream;
                    if (localAudioVideoStream.getVideoTracks().length > 0) {
                        me.webRtcMediaManager.videoTrack = localAudioVideoStream.getVideoTracks()[0];
                        localAudioVideoStream.removeTrack(me.webRtcMediaManager.videoTrack);
                    }
                    me.peerConnection.addStream(me.webRtcMediaManager.localAudioVideoStream);
                }
            }
        }
        me.createAnswerCallback = createAnswerCallback;

        var sdpOffer = new RTCSessionDescription({
            type: 'offer',
            sdp: me.lastReceivedSdp
        });
        me.peerConnectionState = 'offer-received';
        me.peerConnection.setRemoteDescription(sdpOffer, function () {
            me.onSetRemoteDescriptionSuccessCallback();
        }, function (error) {
            me.onSetRemoteDescriptionErrorCallback(error);
        });
    }
    catch (exception) {
        console.error("WebRtcMediaConnection - createAnswer(): catched exception:" + exception);
    }
};

WebRtcMediaConnection.prototype.onCreateOfferSuccessCallback = function (offer) {
    trace("WebRtcMediaConnection - onCreateOfferSuccessCallback this.peerConnection: " + this.peerConnection + " this.peerConnectionState: " + this.peerConnectionState);
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'new' || this.peerConnectionState == 'established') {
            var application = this;
            this.peerConnectionState = 'preparing-offer';
            this.peerConnection.setLocalDescription(offer, function () {
                application.onSetLocalDescriptionSuccessCallback(offer.sdp);
            }, function (error) {
                application.onSetLocalDescriptionErrorCallback(error);
            });
        }
        else {
            console.error("WebRtcMediaConnection - onCreateOfferSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateOfferSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaConnection.prototype.onSetLocalDescriptionSuccessCallback = function (sdp) {
    trace("WebRtcMediaConnection - onSetLocalDescriptionSuccessCallback");
    if (webrtcDetectedBrowser == "firefox") {
        trace("WebRtcMediaConnection - onSetLocalDescriptionSuccessCallback: sdp=" + sdp);
        if (this.peerConnectionState == 'preparing-offer') {
            trace("Current PeerConnectionState is 'preparing-offer' sending offer...");
            this.peerConnectionState = 'offer-sent';
            this.createOfferCallback(sdp);
        }
        else if (this.peerConnectionState == 'preparing-answer') {
            trace("Current PeerConnectionState is 'preparing-answer' going to established...");
            this.peerConnectionState = 'established';
            this.createAnswerCallback(sdp);
        }
    } else {
        this.waitGatheringIce();
    }
};

WebRtcMediaConnection.prototype.getConnectionState = function () {
    return this.peerConnectionState;
};

WebRtcMediaConnection.prototype.setRemoteSDP = function (sdp, isInitiator) {
    trace("WebRtcMediaConnection - setRemoteSDP: isInitiator: " + isInitiator + " sdp=" + sdp);
    if (isInitiator) {
        var sdpAnswer = new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
        });
        var application = this;
        this.peerConnectionState = 'answer-received';
        this.peerConnection.setRemoteDescription(sdpAnswer, function () {
            application.onSetRemoteDescriptionSuccessCallback();
        }, function (error) {
            application.onSetRemoteDescriptionErrorCallback(error);
        });
    } else {
        this.lastReceivedSdp = sdp;
    }
};

WebRtcMediaConnection.prototype.onSetRemoteDescriptionSuccessCallback = function () {
    trace("onSetRemoteDescriptionSuccessCallback");
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'answer-received') {
            trace("Current PeerConnectionState is 'answer-received' changing the PeerConnectionState to 'established'");
            this.peerConnectionState = 'established';
        }
        else if (this.peerConnectionState == 'offer-received') {
            trace("Current PeerConnectionState is 'offer-received' creating appropriate answer...");
            var application = this;
            this.peerConnection.createAnswer(function (answer) {
                application.onCreateAnswerSuccessCallback(answer);
            }, function (error) {
                application.onCreateAnswerErrorCallback(error);
            });
        }
        else {
            console.log("WebRtcMediaConnection - onSetRemoteDescriptionSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onSetRemoteDescriptionSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaConnection.prototype.onCreateAnswerSuccessCallback = function (answer) {
    trace("onCreateAnswerSuccessCallback " + this.peerConnection);
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'offer-received') {
            trace("Current PeerConnectionState is 'offer-received', preparing answer...");
            // Prepare answer.
            var application = this;
            this.peerConnectionState = 'preparing-answer';
            this.peerConnection.setLocalDescription(answer, function () {
                application.onSetLocalDescriptionSuccessCallback(answer.sdp);
            }, function (error) {
                application.onSetLocalDescriptionErrorCallback(error);
            });
        }
        else {
            console.log("WebRtcMediaConnection - onCreateAnswerSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateAnswerSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaConnection.prototype.getStatistics = function (callbackFn) {
    var me = this;
    if (this.peerConnection && this.peerConnection.getRemoteStreams()[0] && webrtcDetectedBrowser == "chrome") {
        if (this.peerConnection.getStats) {
            this.peerConnection.getStats(function (rawStats) {
                var results = rawStats.result();
                var result = {type: "chrome", outgoingStreams: {}, incomingStreams: {}};
                for (var i = 0; i < results.length; ++i) {
                    var resultPart = me.processGoogRtcStatsReport(results[i]);
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
            }, function (error) {
                console.log("Error received " + error);
            });

        }
    } else if (this.peerConnection && this.peerConnection.getRemoteStreams()[0] && webrtcDetectedBrowser == "firefox") {
        if (this.peerConnection.getStats) {
            this.peerConnection.getStats(null, function (rawStats) {
                var result = {type: "firefox", outgoingStreams: {}, incomingStreams: {}};
                for (var k in rawStats) {
                    if (rawStats.hasOwnProperty(k)) {
                        var resultPart = me.processRtcStatsReport(rawStats[k]);
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
            }, function (error) {
                console.log("Error received " + error);
            });
        }
    }
};

WebRtcMediaConnection.prototype.processRtcStatsReport = function (report) {
    /**
     * RTCStatsReport http://mxr.mozilla.org/mozilla-central/source/dom/webidl/RTCStatsReport.webidl
     */
    var result = null;
    if (report.type && (report.type == "outboundrtp" || report.type == "inboundrtp") && report.id.indexOf("rtcp") == -1) {
        result = {};
        for (var k in report) {
            if (report.hasOwnProperty(k)) {
                result[k] = report[k];
            }
        }
    }

    return result;
};

WebRtcMediaConnection.prototype.processGoogRtcStatsReport = function (report) {
    /**
     * Report types: googComponent, googCandidatePair, googCertificate, googLibjingleSession, googTrack, ssrc
     */
    var gotResult = false;
    var result = null;
    if (report.type && report.type == "googCandidatePair") {
        //check if this is active pair
        if (report.stat("googActiveConnection") == "true") {
            gotResult = true;
        }
    }

    if (report.type && report.type == "ssrc") {
        gotResult = true;
    }

    if (gotResult) {
        //prepare object
        result = {};
        result.timestamp = report.timestamp;
        result.id = report.id;
        result.type = report.type;
        if (report.names) {
            var names = report.names();
            for (var i = 0; i < names.length; ++i) {
                var attrName = names[i];
                result[attrName] = report.stat(attrName);
            }
        }
    }
    return result;
};

WebRtcMediaConnection.prototype.onCreateAnswerErrorCallback = function (error) {
    console.error("WebRtcMediaConnection - onCreateAnswerErrorCallback(): error: " + error);
};
WebRtcMediaConnection.prototype.onCreateOfferErrorCallback = function (error) {
    console.error("WebRtcMediaConnection - onCreateOfferErrorCallback(): error: " + error);
};
WebRtcMediaConnection.prototype.onSetLocalDescriptionErrorCallback = function (error) {
    console.error("WebRtcMediaConnection - onSetLocalDescriptionErrorCallback(): error: " + error);
};
WebRtcMediaConnection.prototype.onSetRemoteDescriptionErrorCallback = function (error) {
    console.error("WebRtcMediaConnection - onSetRemoteDescriptionErrorCallback(): error: " + error);
};

Configuration = function () {
    this.remoteMediaElementId = null;
    this.localMediaElementId = null;
    this.localMediaElementId2 = null;
    this.elementIdForSWF = null;
    this.pathToSWF = null;
    this.urlWsServer = null;
    this.urlFlashServer = null;
    this.sipRegisterRequired = true;
    this.sipContactParams = null;

    this.wsPlayerCanvas = null;
    this.wsPlayerReceiverPath = null;
    this.wsPlayerStartWithVideoOnly = false;

    this.videoWidth = 640;
    this.videoHeight = 480;
    this.screenSharingVideoWidth = 1920;
    this.screenSharingVideoHeight = 1080;
    this.screenSharingVideoFps = 10;
    this.forceResolution = false;
    this.audioReliable = false;
    this.videoReliable = false;
    this.flashBufferTime = null;

    this.stunServer = "";

    this.stripCodecs = [];

    this.imdnEnabled = false;
    this.msgContentType = "text/plain";

    this.pushLogEnabled = false;
};

var Connection = function () {
    this.urlServer = undefined;
    this.sipLogin = "";
    this.sipPassword = "";
    this.sipAuthenticationName = "";
    this.sipDomain = "";
    this.sipOutboundProxy = "";
    this.sipPort = 5060;
    this.sipRegisterRequired = true;
    this.appKey = "defaultApp";
    this.status = ConnectionStatus.Pending;
    this.mediaProviders = [];
    this.width = "";
    this.height = "";
};

var ConnectionStatus = function () {
};
ConnectionStatus.Pending = "PENDING";
ConnectionStatus.Registered = "REGISTERED";
ConnectionStatus.Established = "ESTABLISHED";
ConnectionStatus.Disconnected = "DISCONNECTED";
ConnectionStatus.Failed = "FAILED";

var RegistrationStatus = function () {
};
RegistrationStatus.Registered = "REGISTERED";
RegistrationStatus.Unregistered = "UNREGISTERED";
RegistrationStatus.Failed = "FAILED";

var Call = function () {
    this.callId = "";
    this.status = "";
    this.caller = "";
    this.callee = "";
    this.incoming = false;
    this.receiveVideo = false;
    this.visibleName = "";
    this.inviteParameters = {};
    this.mediaProvider = undefined;
};

MediaProvider = function () {
};
MediaProvider.WebRTC = "WebRTC";
MediaProvider.Flash = "Flash";
MediaProvider.WSPlayer = "WSPlayer";

var CallStatus = function () {
};
CallStatus.RING = "RING";
CallStatus.RING_MEDIA = "RING_MEDIA";
CallStatus.HOLD = "HOLD";
CallStatus.ESTABLISHED = "ESTABLISHED";
CallStatus.FINISH = "FINISH";
CallStatus.BUSY = "BUSY";
CallStatus.SESSION_PROGRESS = "SESSION_PROGRESS";
CallStatus.FAILED = "FAILED";

var DtmfType = function () {
};

DtmfType.info = "INFO";
DtmfType.info_relay = "INFO_RELAY";
DtmfType.rfc2833 = "RFC2833";

var Message = function () {
    this.from = "";
    this.to = "";
    this.visibleName = undefined;
    this.body = "";
    this.contentType = "";
    this.isImdnRequired = false;
};

var MessageStatus = function () {
};
MessageStatus.SENT = "SENT";
MessageStatus.ACCEPTED = "ACCEPTED";
MessageStatus.FAILED = "FAILED";
MessageStatus.IMDN_NOTIFICATION_SENT = "IMDN_NOTIFICATION_SENT";
MessageStatus.IMDN_DELIVERED = "IMDN_DELIVERED";
MessageStatus.IMDN_FAILED = "IMDN_FAILED";
MessageStatus.IMDN_FORBIDDEN = "IMDN_FORBIDDEN";
MessageStatus.IMDN_ERROR = "IMDN_ERROR";
MessageStatus.RECEIVED = "RECEIVED";

var Stream = function () {
    this.mediaSessionId = null;
    this.name = "";
    this.published = false;
    this.hasVideo = false;
    this.status = StreamStatus.Pending;
    this.sdp = "";
    this.info = null;
    this.remoteMediaElementId = null;
    this.record = false;
};

var StreamStatus = function () {
};
StreamStatus.Pending = "PENDING";
StreamStatus.Publishing = "PUBLISHING";
StreamStatus.Playing = "PLAYING";
StreamStatus.Paused = "PAUSED";
StreamStatus.Unpublished = "UNPUBLISHED";
StreamStatus.Stoped = "STOPPED";
StreamStatus.Failed = "FAILED";
StreamStatus.LocalStreamStopped = "LOCAL_STREAM_STOPPED";

var WCSEvent = function () {
};
WCSEvent.ErrorStatusEvent = "ERROR_STATUS_EVENT";
WCSEvent.ConnectionStatusEvent = "CONNECTION_STATUS_EVENT";
WCSEvent.RegistrationStatusEvent = "REGISTRATION_STATUS_EVENT";
WCSEvent.OnCallEvent = "ON_CALL_EVENT";
WCSEvent.CallStatusEvent = "CALL_STATUS_EVENT";
WCSEvent.OnMessageEvent = "ON_MESSAGE_EVENT";
WCSEvent.MessageStatusEvent = "MESSAGE_STATUS_EVENT";
WCSEvent.RecordingStatusEvent = "RECORDING_STATUS_EVENT";
WCSEvent.SubscriptionStatusEvent = "SUBSCRIPTION_STATUS_EVENT";
WCSEvent.StreamStatusEvent = "ON_STREAM_STATUS_EVENT";
WCSEvent.XcapStatusEvent = "XCAP_STATUS_EVENT";
WCSEvent.BugReportStatusEvent = "BUG_REPORT_STATUS_EVENT";
WCSEvent.OnDataEvent = "ON_DATA_EVENT";
WCSEvent.DataStatusEvent = "DATA_STATUS_EVENT";
WCSEvent.TransferStatusEvent = "TRANSFER_STATUS_EVENT";
WCSEvent.OnTransferEvent = "ON_TRANSFER_EVENT";
WCSEvent.OnBinaryEvent = "ON_BINARY_EVENT";

var WCSError = function () {
};
WCSError.MIC_ACCESS_PROBLEM = "MIC_ACCESS_PROBLEM";
WCSError.MIC_CAM_ACCESS_PROBLEM = "MIC_CAM_ACCESS_PROBLEM";
WCSError.SCREEN_ACCESS_PROBLEM = "SCREEN_ACCESS_PROBLEM";
WCSError.SCREEN_EXTENSION_UNAVAILABLE = "SCREEN_EXTENSION_UNAVAILABLE";
WCSError.AUTHENTICATION_FAIL = "AUTHENTICATION_FAIL";
WCSError.USER_NOT_AVAILABLE = "USER_NOT_AVAILABLE";
WCSError.TOO_MANY_REGISTER_ATTEMPTS = "TOO_MANY_REGISTER_ATTEMPTS";
WCSError.LICENSE_RESTRICTION = "LICENSE_RESTRICTION";
WCSError.LICENSE_NOT_FOUND = "LICENSE_NOT_FOUND";
WCSError.INTERNAL_SIP_ERROR = "INTERNAL_SIP_ERROR";
WCSError.CONNECTION_ERROR = "CONNECTION_ERROR";
WCSError.REGISTER_EXPIRE = "REGISTER_EXPIRE";
WCSError.SIP_PORTS_BUSY = "SIP_PORTS_BUSY";
WCSError.MEDIA_PORTS_BUSY = "MEDIA_PORTS_BUSY";
WCSError.WRONG_SIPPROVIDER_ADDRESS = "WRONG_SIPPROVIDER_ADDRESS";
WCSError.CALLEE_NAME_IS_NULL = "CALLEE_NAME_IS_NULL";
WCSError.WRONG_FLASHPHONER_XML = "WRONG_FLASHPHONER_XML";
WCSError.PAYMENT_REQUIRED = "PAYMENT_REQUIRED";
WCSError.REST_AUTHORIZATION_FAIL = "REST_AUTHORIZATION_FAIL";
WCSError.REST_FAIL = "REST_FAIL";


var DataMap = function () {
    this.data = {};
};

DataMap.prototype = {

    add: function (id, data) {
        this.data[id] = data;
    },

    update: function (id, data) {
        this.data[id] = data;
    },

    get: function (id) {
        return this.data[id];
    },

    remove: function (id) {
        var data = this.data[id];
        delete this.data[id];
        return data;
    },

    getSize: function () {
        return Object.size(this.data);
    },

    getData: function () {
        return this.data;
    },

    array: function () {
        var callArray = [];
        for (var o in this.data) {
            callArray.push(this.data[o]);
        }
        return callArray;
    }
};

function getElement(str) {
    return document.getElementById(str);
}

var isMobile = {
    Android: function () {
        return navigator.userAgent.match(/Android/i);
    },
    BlackBerry: function () {
        return navigator.userAgent.match(/BlackBerry/i);
    },
    iOS: function () {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    Opera: function () {
        return navigator.userAgent.match(/Opera Mini/i);
    },
    Windows: function () {
        return navigator.userAgent.match(/IEMobile/i);
    },
    any: function () {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
    }
};

Object.size = function (obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

function escapeXmlTags(stringXml) {
    return stringXml.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function createUUID() {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");

    return uuid.substring(0, 18);
}


function trace(logMessage) {

    var today = new Date();
    // get hours, minutes and seconds
    var hh = today.getUTCHours().toString();
    var mm = today.getUTCMinutes().toString();
    var ss = today.getUTCSeconds().toString();
    var ms = today.getUTCMilliseconds().toString();

    // Add leading '0' to see 14:08:06.001 instead of 14:8:6.1
    hh = hh.length == 1 ? "0" + hh : hh;
    mm = mm.length == 1 ? "0" + mm : mm;
    ss = ss.length == 1 ? "0" + ss : ss;
    ms = ms.length == 1 ? "00" + ms : ms.length == 2 ? "0" + ms : ms;

    // set time
    var time = "UTC " + hh + ':' + mm + ':' + ss + '.' + ms;

    var logMessage = time + ' - ' + logMessage;

    var console = $("#console");

    if (console.length > 0) {

        // Check if console is scrolled down? Or may be you are reading previous messages.
        var isScrolled = (console[0].scrollHeight - console.height() + 1) / (console[0].scrollTop + 1 + 37);
        console.append(logMessage + '<br>');
    }
    //check if push_log enabled
    if (Flashphoner.getInstance().configuration.pushLogEnabled) {
        var result = Flashphoner.getInstance().pushLogs({logs: logs + logMessage + '\n'});
        if (!result) {
            logs += logMessage + '\n';
        } else {
            logs = "";
        }
    } else {
        logs = "";
    }

    try {
        window.console.debug(logMessage);
    } catch (err) {
        //Not supported. For example IE
    }

    //Autoscroll cosole if you are not reading previous messages
    if (isScrolled < 1) {
        console[0].scrollTop = console[0].scrollHeight;
    }
}

function addLogMessage(message) {
    trace("Flash - " + message);
}
