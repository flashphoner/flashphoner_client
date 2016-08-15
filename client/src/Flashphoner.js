function Flashphoner() {
    if (arguments.callee.instance) {
        return arguments.callee.instance;
    }
    arguments.callee.instance = this;

    this.clientVersion = "UNKNOWN_VERSION";
    this.clientOSVersion = window.navigator.appVersion;
    this.clientBrowserVersion = window.navigator.userAgent;

    this.webRtcMediaManager = undefined;
    this.webRtcCallSessionId = undefined;
    this.flashMediaManager = undefined;
    this.swfLoaded = undefined;
    this.wsPlayerMediaManager = undefined;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    try {
        this.audioContext = new AudioContext();
    } catch(e) {
        console.warn("Failed to create audio context");
    }
    this.connection = null;
    this.configuration = new Configuration();
    this.calls = new DataMap();
    this.publishStreams = new DataMap();
    this.playStreams = new DataMap();
    this.messages = {};
    this.isOpened = false;
    this.listeners = {};
    this.roomListeners = {};
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

        if ( (me.isChrome() || me.isFF()) && !me.configuration.forceFlashForWebRTCBrowser ) {
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
            params.bgcolor = (Object.keys(me.configuration.swfParams).length === 0) ? "000000" : me.configuration.swfParams.bgcolor;
            //in case of Safari wmode should be "window"
            if ((navigator.userAgent.indexOf("Safari") > -1) && !(navigator.userAgent.indexOf("Chrome") > -1)) {
                params.wmode = (Object.keys(me.configuration.swfParams).length === 0) ? "window" : me.configuration.swfParams.wmode;
                //workaround for safari browser, FPNR-403
                swfobject.switchOffAutoHideShow();
            } else if ((navigator.userAgent.indexOf("Mozilla") > -1) && (navigator.userAgent.indexOf("Firefox") > -1)) {
                params.wmode = (Object.keys(me.configuration.swfParams).length === 0) ? "window" : me.configuration.swfParams.wmode;
            } else {
                params.wmode = (Object.keys(me.configuration.swfParams).length === 0) ? "transparent" : me.configuration.swfParams.wmode;
            }
            var attributes = {};
            var flashvars = {};
            if (swfobject.hasFlashPlayerVersion("11.2")) {
                swfobject.embedSWF(pathToSWF, elementId, "100%", "100%", "11.2.202", "expressInstall.swf", flashvars, params, attributes, function (e) {
                    me.flashMediaManager = e.ref;
                    me.swfLoaded = true;
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
            config.decoderPath = this.configuration.wsPlayerDecoderPath;
            config.videoWidth = this.configuration.videoWidth;
            config.videoHeight = this.configuration.videoHeight;
            config.startWithVideoOnly = this.configuration.wsPlayerStartWithVideoOnly;
            config.keepLastFrame = this.configuration.wsPlayerKeepLastFrame;
            this.wsPlayerMediaManager.initLogger(0);
            this.wsPlayerMediaManager.init(config, this.audioContext);
        }
    },

    checkMediaDevices: function() {
        return !(navigator.mediaDevices === undefined || navigator.mediaDevices.getUserMedia === undefined);
    },

    initWebRTC: function () {
        var me = this;
        if (webrtcDetectedBrowser) {
            me.webRtcMediaManager = new WebRtcMediaManager();
            me.mediaProviders.add(MediaProvider.WebRTC, me.webRtcMediaManager);

            var MediaStream = window.MediaStream;

            if (typeof MediaStream === 'undefined' && typeof webkitMediaStream !== 'undefined') {
                MediaStream = webkitMediaStream;
            }

            /*global MediaStream:true */
            if (typeof MediaStream !== 'undefined' && !('stop' in MediaStream.prototype)) {
                MediaStream.prototype.stop = function () {
                    this.getAudioTracks().forEach(function (track) {
                        track.stop();
                    });

                    this.getVideoTracks().forEach(function (track) {
                        track.stop();
                    });
                };
            }

            this.webRtcMediaManager.onLocalScreenMediaStreamEnded = function (mediaSessionId) {
                var streams = me.publishStreams.array();
                streams.some(function (stream) {
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
                me.webRtcMediaManager.newConnection(call.callId, new WebRtcMediaConnection(me.webRtcMediaManager, me.configuration.stunServer, me.configuration.useDTLS, me.configuration.remoteMediaElementId, call.callId));
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
            me.wsPlayerMediaManager = new WSPlayer(me.configuration.wsPlayerCanvas, me);
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
                me.invokeListener(WCSEvent.OnVideoFormatEvent, [videoFormat]);
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

            notifyStreamInfoEvent: function (streamInfo) {
                me.invokeListener(WCSEvent.StreamInfoEvent, [
                    streamInfo
                ]);
            },

            notifyStreamStatusEvent: function (stream) {
                //clean resources if status is failed
                if (stream.status == StreamStatus.Failed) {
                    var removedStream;
                    if (stream.published) {
                        removedStream = me.publishStreams.remove(stream.mediaSessionId);
                    } else {
                        removedStream = me.playStreams.remove(stream.mediaSessionId);
                    }
                    if (removedStream) {
                        me.releaseMediaManagerStream(removedStream);
                    }
                } else {
                    if (stream.mediaProvider == MediaProvider.Flash) {
                        if (stream.status == StreamStatus.Publishing) {
                            me.flashMediaManager.publishStream(stream.mediaSessionId, true, stream.hasVideo, (stream.bitrate)?stream.bitrate:0, (stream.quality)?stream.quality:0);
                        }
                        if (stream.status == StreamStatus.Playing) {
                            me.flashMediaManager.playStream(stream.mediaSessionId);
                        }
                    }
                    if (stream.published) {
                        me.publishStreams.update(stream.mediaSessionId, stream);
                    } else {
                        me.playStreams.update(stream.mediaSessionId, stream);
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
            },

            notifyRoomStatusEvent: function (roomStatusEventListener) {
                me.invokeRoomStatusEventListener(roomStatusEventListener.room, [
                    roomStatusEventListener
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
        me.connection.clientOSVersion = me.clientOSVersion;
        me.connection.clientBrowserVersion = me.clientBrowserVersion;
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
                if (event.originalEvent.wasClean || event.originalEvent.code == 1000) {
                    me.connection.status = ConnectionStatus.Disconnected;
                } else {
                    me.connection.status = ConnectionStatus.Failed;
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
                if (me.wsPlayerMediaManager) {
                    me.wsPlayerMediaManager.stop();
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
            this.mediaProviders.get(call.mediaProvider).getVolume(call.callId, value);
        } else {
            this.mediaProviders.get(call.mediaProvider).getVolume(this.webRtcCallSessionId, value);
        }
    },

    getVolumeOnStreaming: function(provider) {
        if(provider == MediaProvider.WebRTC) {
            return getElement(this.configuration.remoteMediaElementId).volume;
        } else {
            return this.mediaProviders.get(provider).getVolume();
        }
    },

    setVolume: function (call, value) {
        if (MediaProvider.Flash == call.mediaProvider) {
            this.mediaProviders.get(call.mediaProvider).setVolume(call.callId, value);
        } else {
            this.mediaProviders.get(call.mediaProvider).setVolume(this.webRtcCallSessionId, value);
        }
    },

    setVolumeOnStreaming: function (provider, value) {
        if (provider == MediaProvider.WSPlayer) {
            this.mediaProviders.get(provider).setVolume(value/100);
        } else if (provider == MediaProvider.Flash) {
            this.mediaProviders.get(provider).setVolume(0, value);
        } else {
           getElement(this.configuration.remoteMediaElementId).volume = value/100;
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

    setMicrophoneGain: function(volume,mediaProvider) {
        if (MediaProvider.WSPlayer == mediaProvider) {
            console.warn("Flash or WebRTC media provider supported only!");
            return;
        }
        if (!mediaProvider) {
            mediaProvider = Object.keys(Flashphoner.getInstance().mediaProviders.getData())[0];
        }
        this.mediaProviders.get(mediaProvider).setMicrophoneGain(volume);
    },

    //works only for WSPlayer
    playFirstSound: function () {
        var audioBuffer = this.audioContext.createBuffer(1, 441, 44100);
        var output = audioBuffer.getChannelData(0);
        for (var i = 0; i < output.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        var src = this.audioContext.createBufferSource();
        src.buffer = audioBuffer;
        src.connect(this.audioContext.destination);
        src.start(0);
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

    requestStreamInfo:function(stream) {
        console.log("requestStreamInfo stream " + stream.name);
        this.webSocket.send("requestStreamInfo", stream);
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
                me.webRtcMediaManager.newConnection(mediaSessionId, new WebRtcMediaConnection(me.webRtcMediaManager, me.configuration.stunServer, me.configuration.useDTLS, undefined, mediaSessionId));

                me.webRtcMediaManager.createOffer(mediaSessionId, function (sdp) {
                    trace("Publish name " + stream.name);
                    if (me.configuration.stripCodecs && me.configuration.stripCodecs.length > 0) {
                        sdp = me.stripCodecsSDP(sdp, true);
                        console.log("New SDP: " + sdp);
                    }
                    stream.sdp = me.removeCandidatesFromSDP(sdp);
                    me.webSocket.send("publishStream", stream);
                    me.publishStreams.add(stream.mediaSessionId, stream);
                }, true, stream.hasVideo);
            } else if (MediaProvider.Flash == stream.mediaProvider) {
                //todo add pcma/pcmu
                //Priority codec is important because of mediamanager initialize microphone with alaw by default
                stream.sdp = "v=0\r\n" +
                    "o=- 1988962254 1988962254 IN IP4 0.0.0.0\r\n" +
                    "c=IN IP4 0.0.0.0\r\n" +
                    "t=0 0\r\n" +
                    "a=sdplang:en\r\n" +
                    "m=video 0 RTP/AVP 112\r\n" +
                    "a=rtpmap:112 H264/90000\r\n" +
                    "a=fmtp:112 packetization-mode=1; profile-level-id=420020\r\n" +
                    "a=sendonly\r\n" +
                    "m=audio 0 RTP/AVP 8 0 100\r\n" +
                    "a=rtpmap:0 PCMU/8000\r\n" +
                    "a=rtpmap:8 PCMA/8000\r\n" +
                    "a=rtpmap:100 SPEEX/16000\r\n" +
                    "a=sendonly\r\n";
                me.webSocket.send("publishStream", stream);
                me.publishStreams.add(stream.mediaSessionId, stream);

            }
        }, []);

    },

    unPublishStream: function (stream) {
        console.log("Unpublish stream " + stream.name);
        var me = this;
        var removedStream = me.publishStreams.search('name',stream.name);
        if (removedStream) {
            me.publishStreams.remove(removedStream.mediaSessionId);
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
        stream.hasAudio = false; 
        stream.mediaProvider = MediaProvider.WebRTC;
        me.getScreenAccess(extensionId, function(response) {
            if (response.success) {
                me.webRtcMediaManager.newConnection(mediaSessionId, new WebRtcMediaConnection(me.webRtcMediaManager, me.configuration.stunServer, me.configuration.useDTLS, undefined, mediaSessionId));

                me.webRtcMediaManager.createOffer(mediaSessionId, function (sdp) {
                    trace("Publish name for screen sharing " + stream.name);
                    if (me.configuration.stripCodecs && me.configuration.stripCodecs.length > 0) {
                        sdp = me.stripCodecsSDP(sdp, true);
                        console.log("New SDP: " + sdp);
                    }
                    stream.sdp = me.removeCandidatesFromSDP(sdp);
                    me.webSocket.send("publishStream", stream);
                    me.publishStreams.add(stream.mediaSessionId, stream);
                }, true, stream.hasVideo, false, true);
            }
        });
    },

    playStream: function (stream) {
        var me = this;
        if (!stream.remoteMediaElementId) {
            var streamObj = me.playStreams.search('name',stream.name);
            if (streamObj) {
                console.log("Request resume for stream " + stream.name);
                if (streamObj.mediaProvider == MediaProvider.WSPlayer) {
                    me.wsPlayerMediaManager.resume();
                }
                me.webSocket.send("playStream", streamObj);
                return;
            }
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

            me.webRtcMediaManager.newConnection(mediaSessionId, new WebRtcMediaConnection(me.webRtcMediaManager, me.configuration.stunServer, me.configuration.useDTLS, stream.remoteMediaElementId || me.configuration.remoteMediaElementId, mediaSessionId));


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

                me.playStreams.add(stream.mediaSessionId, stream);
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
            me.playStreams.add(stream.mediaSessionId, stream);
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
            me.playStreams.add(stream.mediaSessionId, stream);
            me.wsPlayerMediaManager.play(stream);
        } else {
            console.log("playStream name " + stream.name);
            me.webSocket.send("playStream", stream);
            me.playStreams.add(stream.mediaSessionId, stream);
        }
        return stream;
    },

    stopStream: function (stream) {
        console.log("unSubscribe stream " + stream.name);
        var me = this;
        var streamObj;
        if (stream.remoteMediaElementId) {
            streamObj = me.playStreams.search('remoteMediaElementId', stream.remoteMediaElementId);
        } else {
            streamObj = me.playStreams.search('name',stream.name);
        }
        if (streamObj) {
            me.playStreams.remove(streamObj.mediaSessionId);
            me.releaseMediaManagerStream(streamObj);
            me.webSocket.send("stopStream", streamObj);
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

    subscribeRoom:function (roomName, roomEventListener, thisArg) {
        this.roomListeners[roomName] = {func: roomEventListener, thisArg: thisArg};
        this.webSocket.send("subscribeRoom", {name:roomName});
    },

    sendRoomData:function (roomName, data) {
        this.webSocket.send("sendRoomData", {name:roomName, data:data});
    },

    invokeRoomStatusEventListener: function (roomName, argsArray) {
        var listener = this.roomListeners[roomName];
        if (listener) {
            listener.func.apply(listener.thisArg ? listener.thisArg : window, argsArray);
        }
    },

    unsubscribeRoom: function (roomName) {
        delete this.roomListeners[roomName];
        this.webSocket.send("unsubscribeRoom", {name:roomName});
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

    notifyMediaProviderEvent: function (e) {
        if (e.mediaProvider == MediaProvider.WSPlayer) {
            switch (e.status) {
                case "failed":
                    if (this.connection.status != ConnectionStatus.Disconnected) {
                        this.invokeListener(WCSEvent.MediaProviderStatusEvent, [
                            {mediaProvider: MediaProvider.WSPlayer, status: ConnectionStatus.Failed}
                        ]);
                        this.initWSPlayerMediaManager();
                    }
                    break;
                case "closed":
                    if (this.connection.status != ConnectionStatus.Disconnected) {
                        this.invokeListener(WCSEvent.MediaProviderStatusEvent, [
                            {mediaProvider: MediaProvider.WSPlayer, status: ConnectionStatus.Disconnected}
                        ]);
                    }
                    break;
                case "connected":
                    var playStreamsArray = this.playStreams.array();
                    var i;
                    //check if we have active stream
                    for (i = 0; i < playStreamsArray.length; i++) {
                        if (playStreamsArray[i].mediaProvider == MediaProvider.WSPlayer &&
                            playStreamsArray[i].status == StreamStatus.Playing ||
                            playStreamsArray[i].status == StreamStatus.Paused) {
                            this.wsPlayerMediaManager.play(playStreamsArray[i]);
                            break;
                        }
                    }
                    this.invokeListener(WCSEvent.MediaProviderStatusEvent, [
                        {mediaProvider: MediaProvider.WSPlayer, status: ConnectionStatus.Established}
                    ]);
                    break;
            }
        }
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
        var localMediaVideoSourceId = Flashphoner.getInstance().configuration.videoSourceId;
        if (localMediaVideoSourceId != null && localMediaVideoSourceId != lastVideoSourceId) {
            trace("Video source was changed from " + lastVideoSourceId + " to " + localMediaVideoSourceId);
            me.releaseCameraAndMicrophone(mediaProvider);
            me.webRtcMediaManager.localAudioVideoStream = undefined;
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
    },

    getWsPlayerLastVideoFrame: function () {
        if (this.wsPlayerMediaManager && this.wsPlayerMediaManager.getLastVideoFrame) {
            return this.wsPlayerMediaManager.getLastVideoFrame();
        }
    }
};

var isFlashphonerAPILoaded = false;
function notifyFlashphonerAPILoaded() {
    isFlashphonerAPILoaded = true;
    Flashphoner.getInstance().initFlashMediaManager();
}

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

WebRtcMediaManager.prototype.setMicrophoneGain = function (volume) {
    if (this.microphoneGain)
        this.microphoneGain.gain.value = volume;
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
    if (this.localAudioVideoStream && this.localAudioVideoStream.getVideoTracks().length > 0) {
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


function createGainNode(stream) {
    var audioCtx = Flashphoner.getInstance().audioContext;
    var source = audioCtx.createMediaStreamSource(stream);
    var gainNode = audioCtx.createGain();
    var destination = audioCtx.createMediaStreamDestination();
    var outputStream = destination.stream;
    // source -> gainNode -> destination -> peerConnection
    source.connect(gainNode);
    gainNode.connect(destination);
    // replace audiotrack to new which contain gainNode
    var newTrack = outputStream.getAudioTracks()[0];
    stream.addTrack(newTrack);
    var originalTrack = stream.getAudioTracks()[0];
    stream.removeTrack(originalTrack);
    return gainNode;
}

var lastVideoSourceId;
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
            if (Flashphoner.getInstance().configuration.videoSourceId != null) {
                requestedMedia.video.optional = [{sourceId: Flashphoner.getInstance().configuration.videoSourceId}];
                lastVideoSourceId = Flashphoner.getInstance().configuration.videoSourceId;
            }
        } else {
            requestedMedia.video = {
                mandatory: {
                    maxWidth: Flashphoner.getInstance().configuration.videoWidth,
                    maxHeight: Flashphoner.getInstance().configuration.videoHeight
                },
                optional: []
            };

            if (Flashphoner.getInstance().configuration.videoSourceId != null) {
                requestedMedia.video.optional = [{sourceId: Flashphoner.getInstance().configuration.videoSourceId}];
                lastVideoSourceId = Flashphoner.getInstance().configuration.videoSourceId;
            }

            if (Flashphoner.getInstance().configuration.forceResolution) {
                requestedMedia.video.mandatory.minWidth = Flashphoner.getInstance().configuration.videoWidth;
                requestedMedia.video.mandatory.minHeight = Flashphoner.getInstance().configuration.videoHeight;
            }
        }
        var mediaStream = function (stream) {
            var localMediaElement = getElement(Flashphoner.getInstance().configuration.localMediaElementId);
            if (localMediaElement) {
                attachMediaStream(localMediaElement, stream);
            }
            me.localAudioVideoStream = stream;

            if (webrtcDetectedBrowser == "chrome" && Flashphoner.getInstance().configuration.gainControllerEnabled) {
                me.microphoneGain = createGainNode(stream);
            }

            if (webrtcDetectedBrowser != "firefox") {
                me.audioMuted = -1;
            }
            me.videoMuted = -1;
        };
        var error = function (error) {
            trace("Failed to get access to local media. Error code was " + error.code + ".");
            me.audioMuted = 1;
            me.videoMuted = 1;
            var status = {
                status: WCSError.MIC_CAM_ACCESS_PROBLEM,
                info: "Failed to get access to microphone and camera. Error code was " + error.code + "."
            };
            Flashphoner.getInstance().invokeProblem(status);
        };
        if (Flashphoner.getInstance().checkMediaDevices()) {
            navigator.mediaDevices.getUserMedia(requestedMedia)
                .then(mediaStream)
                .catch(error);
        } else {
            getUserMedia(requestedMedia, mediaStream, error);
        }
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
                        var mediaStream = function (stream) {
                            var localMediaElement2 = getElement(Flashphoner.getInstance().configuration.localMediaElementId2);
                            if (localMediaElement2) {
                                attachMediaStream(localMediaElement2, stream);
                            }
                            me.localScreenCaptureStream = stream;
                            callback({success: true});
                        };
                        var error = function (error) {
                            trace("Failed to get access to screen capture. Error code was " + error.code + ".");
                            callback({success: false});
                            var status = {
                                status: WCSError.SCREEN_ACCESS_PROBLEM,
                                info: "Failed to get access to screen capture. Error code was " + error.code + "."
                            };
                            Flashphoner.getInstance().invokeProblem(status);
                        };
                        if (Flashphoner.getInstance().checkMediaDevices()) {
                            navigator.mediaDevices.getUserMedia(screen_constraints)
                                .then(mediaStream)
                                .catch(error);
                        } else {
                            getUserMedia(screen_constraints, mediaStream, error);
                        };
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
                    mediaSource: 'window',
                    mandatory: {
                        maxWidth: Flashphoner.getInstance().configuration.screenSharingVideoWidth,
                        maxHeight: Flashphoner.getInstance().configuration.screenSharingVideoHeight
                    }
                }
            };
            if (Flashphoner.getInstance().configuration.screenSharingVideoFps) {
                constraints.video.mandatory.maxFrameRate = Flashphoner.getInstance().configuration.screenSharingVideoFps;
            }
            var mediaStream = function (stream) {
                var localMediaElement2 = getElement(Flashphoner.getInstance().configuration.localMediaElementId2);
                if (localMediaElement2) {
                    attachMediaStream(localMediaElement2, stream);
                }
                me.localScreenCaptureStream = stream;
                callback({success: true});
            };
            var error = function (error) {
                trace("Failed to get access to screen capture. Error code was " + error.code + ".");
                callback({success: false});
                var status = {
                    status: WCSError.SCREEN_ACCESS_PROBLEM,
                    info: "Failed to get access to screen capture. Error code was " + error.code + "."
                };
                Flashphoner.getInstance().invokeProblem(status);
            };
            if (Flashphoner.getInstance().checkMediaDevices()) {
                trace("");
                navigator.mediaDevices.getUserMedia(constraints)
                    .then(mediaStream)
                    .catch(error);
            } else {
                getUserMedia(constraints, mediaStream, error);
            }
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
        var mediaStream = function (stream) {
            me.localAudioStream = stream;
            me.audioMuted = -1;
        };
        var error = function (error) {
            var status = {
                status: WCSError.MIC_ACCESS_PROBLEM,
                info: "Failed to get access to microphone. Error code was " + error.code + "."
            };
            Flashphoner.getInstance().invokeProblem(status);
            me.audioMuted = 1;
        };
        if (Flashphoner.getInstance().checkMediaDevices()) {
            navigator.mediaDevices.getUserMedia({audio: true})
                .then(mediaStream)
                .catch(error);
        } else {
            getUserMedia({audio: true}, mediaStream, error);
        }
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

    //If we set false immediately, we use false, if it is undefined
    if (useDTLS===false || useDTLS==='false'){
        me.useDTLS = false;
    }else{
        me.useDTLS = true;
    }

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
            var playPromise = this.remoteMediaElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(function (error) {
                    trace(error);
                });
            }
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
    if (webrtcDetectedBrowser == "chrome" && (Flashphoner.getInstance().configuration.maxBitRate != null || Flashphoner.getInstance().configuration.minBitRate != null)) {
        // Search VP8 payload in SDP
        var a = sdp.split("\r\n");
        var attr = "a=fmtp:";
        for (var i=0; i< a.length; i++) {
            if (/a=rtpmap:\d+ VP8.*/gi.test(a[i])) {
                attr += a[i].replace(/(a=rtpmap:)(\d+)( VP8.*)/,'$2');
            }
        }
        if (Flashphoner.getInstance().configuration.minBitRate != null) {
            attr += " x-google-min-bitrate=" + Flashphoner.getInstance().configuration.minBitRate + ";";
        }
        if (Flashphoner.getInstance().configuration.maxBitRate != null) {
            attr += " x-google-max-bitrate=" + Flashphoner.getInstance().configuration.maxBitRate + ";";
        }
        attr += "\r\n";
        trace("Appending bitrate limit: " + attr);
        sdp = sdp.replace(/(a=rtpmap:100 .*\r\n)/g, '$1'+attr);
    }
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
    this.videoSourceId = null;
    this.elementIdForSWF = null;
    this.pathToSWF = null;
    this.swfParams = {};
    this.urlWsServer = null;
    this.urlFlashServer = null;
    this.forceFlashForWebRTCBrowser = null;
    this.sipRegisterRequired = true;
    this.sipContactParams = null;

    this.wsPlayerCanvas = null;
    this.wsPlayerReceiverPath = null;
    this.wsPlayerStartWithVideoOnly = false;
    this.wsPlayerKeepLastFrame = false;

    this.videoWidth = 640;
    this.videoHeight = 480;
    this.screenSharingVideoWidth = 1920;
    this.screenSharingVideoHeight = 1080;
    this.screenSharingVideoFps = 10;
    this.forceResolution = false;
    this.audioReliable = false;
    this.videoReliable = false;
    this.flashBufferTime = null;

    // kbps (ex. minBitRate=200 means 200kbps)
    this.minBitRate = null;
    this.maxBitRate = null;

    this.gainControllerEnabled = false;

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

var RoomStatusEvent = function() {
    this.room = null;
    this.status = null;
    this.login = null;
    this.streamName = null;
    this.time = null;
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

var StreamInfo = function() {
    this.mediaSessionId = null;
    this.name = null;
    this.samplingTime = null;
    this.recordTimestamp = null;
    this.recordStarted = null;
};

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
StreamStatus.PlaybackProblem = "PLAYBACK_PROBLEM";

var WCSEvent = function () {
};
WCSEvent.ErrorStatusEvent = "ERROR_STATUS_EVENT";
WCSEvent.ConnectionStatusEvent = "CONNECTION_STATUS_EVENT";
WCSEvent.MediaProviderStatusEvent = "MEDIA_PROVIDER_STATUS_EVENT";
WCSEvent.RegistrationStatusEvent = "REGISTRATION_STATUS_EVENT";
WCSEvent.OnCallEvent = "ON_CALL_EVENT";
WCSEvent.CallStatusEvent = "CALL_STATUS_EVENT";
WCSEvent.OnMessageEvent = "ON_MESSAGE_EVENT";
WCSEvent.MessageStatusEvent = "MESSAGE_STATUS_EVENT";
WCSEvent.RecordingStatusEvent = "RECORDING_STATUS_EVENT";
WCSEvent.SubscriptionStatusEvent = "SUBSCRIPTION_STATUS_EVENT";
WCSEvent.StreamStatusEvent = "ON_STREAM_STATUS_EVENT";
WCSEvent.StreamInfoEvent= "ON_STREAM_INFO_EVENT";
WCSEvent.XcapStatusEvent = "XCAP_STATUS_EVENT";
WCSEvent.BugReportStatusEvent = "BUG_REPORT_STATUS_EVENT";
WCSEvent.OnDataEvent = "ON_DATA_EVENT";
WCSEvent.DataStatusEvent = "DATA_STATUS_EVENT";
WCSEvent.TransferStatusEvent = "TRANSFER_STATUS_EVENT";
WCSEvent.OnTransferEvent = "ON_TRANSFER_EVENT";
WCSEvent.OnBinaryEvent = "ON_BINARY_EVENT";
WCSEvent.OnVideoFormatEvent = "ON_VIDEO_FORMAT_EVENT";

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
        if (this.get(id)) {
            this.data[id] = data;
        } else {
            console.log("Update failed, key " + id + " doesn't exist");
        }
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
    },

    search: function(key,value) {
        for (var o in this.data) {
            if (this.data[o].hasOwnProperty(key) && this.data[o][key] == value) {
                return this.data[o];
            }
        }
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

var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;
var webrtcMinimumVersion = null;
var webrtcUtils = {
    log: function () {
        // suppress console.log output when being included as a module.
        if (typeof module !== 'undefined' ||
            typeof require === 'function' && typeof define === 'function') {
            return;
        }
        console.log.apply(console, arguments);
    }
};

if (typeof window === 'object') {
    if (window.HTMLMediaElement && !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
            get: function () {
                // If prefixed srcObject property exists, return it.
                // Otherwise use the shimmed property, _srcObject
                return 'mozSrcObject' in this ? this.mozSrcObject : this._srcObject;
            },
            set: function (stream) {
                if ('mozSrcObject' in this) {
                    this.mozSrcObject = stream;
                } else {
                    // Use _srcObject as a private property for this shim
                    this._srcObject = stream;
                    // TODO: revokeObjectUrl(this.src) when !stream to release resources?
                    this.src = URL.createObjectURL(stream);
                }
            }
        });
    }
    // Proxy existing globals
    getUserMedia = window.navigator && window.navigator.getUserMedia;
}

// Attach a media stream to an element.
attachMediaStream = function (element, stream) {
    element.srcObject = stream;
};

reattachMediaStream = function (to, from) {
    to.srcObject = from.srcObject;
};

if (typeof window === 'undefined' || !window.navigator) {
    webrtcUtils.log('This does not appear to be a browser');
    webrtcDetectedBrowser = 'not a browser';
} else if (navigator.mozGetUserMedia && window.mozRTCPeerConnection) {
    webrtcUtils.log('This appears to be Firefox');

    webrtcDetectedBrowser = 'firefox';

    // the detected firefox version.
    webrtcDetectedVersion =
        parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

    // the minimum firefox version still supported by adapter.
    webrtcMinimumVersion = 31;

    // The RTCPeerConnection object.
    window.RTCPeerConnection = function (pcConfig, pcConstraints) {
        if (webrtcDetectedVersion < 38) {
            // .urls is not supported in FF < 38.
            // create RTCIceServers with a single url.
            if (pcConfig && pcConfig.iceServers) {
                var newIceServers = [];
                for (var i = 0; i < pcConfig.iceServers.length; i++) {
                    var server = pcConfig.iceServers[i];
                    if (server.hasOwnProperty('urls')) {
                        for (var j = 0; j < server.urls.length; j++) {
                            var newServer = {
                                url: server.urls[j]
                            };
                            if (server.urls[j].indexOf('turn') === 0) {
                                newServer.username = server.username;
                                newServer.credential = server.credential;
                            }
                            newIceServers.push(newServer);
                        }
                    } else {
                        newIceServers.push(pcConfig.iceServers[i]);
                    }
                }
                pcConfig.iceServers = newIceServers;
            }
        }
        return new mozRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
    };

    // The RTCSessionDescription object.
    if (!window.RTCSessionDescription) {
        window.RTCSessionDescription = mozRTCSessionDescription;
    }

    // The RTCIceCandidate object.
    if (!window.RTCIceCandidate) {
        window.RTCIceCandidate = mozRTCIceCandidate;
    }

    // getUserMedia constraints shim.
    getUserMedia = function (constraints, onSuccess, onError) {
        var constraintsToFF37 = function (c) {
            if (typeof c !== 'object' || c.require) {
                return c;
            }
            var require = [];
            Object.keys(c).forEach(function (key) {
                if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
                    return;
                }
                var r = c[key] = (typeof c[key] === 'object') ?
                    c[key] : {ideal: c[key]};
                if (r.min !== undefined ||
                    r.max !== undefined || r.exact !== undefined) {
                    require.push(key);
                }
                if (r.exact !== undefined) {
                    if (typeof r.exact === 'number') {
                        r.min = r.max = r.exact;
                    } else {
                        c[key] = r.exact;
                    }
                    delete r.exact;
                }
                if (r.ideal !== undefined) {
                    c.advanced = c.advanced || [];
                    var oc = {};
                    if (typeof r.ideal === 'number') {
                        oc[key] = {min: r.ideal, max: r.ideal};
                    } else {
                        oc[key] = r.ideal;
                    }
                    c.advanced.push(oc);
                    delete r.ideal;
                    if (!Object.keys(r).length) {
                        delete c[key];
                    }
                }
            });
            if (require.length) {
                c.require = require;
            }
            return c;
        };
        if (webrtcDetectedVersion < 38) {
            webrtcUtils.log('spec: ' + JSON.stringify(constraints));
            if (constraints.audio) {
                constraints.audio = constraintsToFF37(constraints.audio);
            }
            if (constraints.video) {
                constraints.video = constraintsToFF37(constraints.video);
            }
            webrtcUtils.log('ff37: ' + JSON.stringify(constraints));
        }
        return navigator.mozGetUserMedia(constraints, onSuccess, onError);
    };

    navigator.getUserMedia = getUserMedia;

    // Shim for mediaDevices on older versions.
    if (!navigator.mediaDevices) {
        navigator.mediaDevices = {
            getUserMedia: requestUserMedia,
            addEventListener: function () {
            },
            removeEventListener: function () {
            }
        };
    }
    navigator.mediaDevices.enumerateDevices =
        navigator.mediaDevices.enumerateDevices || function () {
            return new Promise(function (resolve) {
                var infos = [
                    {kind: 'audioinput', deviceId: 'default', label: '', groupId: ''},
                    {kind: 'videoinput', deviceId: 'default', label: '', groupId: ''}
                ];
                resolve(infos);
            });
        };

    if (webrtcDetectedVersion < 41) {
        // Work around http://bugzil.la/1169665
        var orgEnumerateDevices =
            navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = function () {
            return orgEnumerateDevices().catch(function (e) {
                if (e.name === 'NotFoundError') {
                    return [];
                }
                throw e;
            });
        };
    }
} else if (navigator.webkitGetUserMedia && (!!window.chrome || navigator.userAgent.match(/Opera|OPR\//))) {
    webrtcUtils.log('This appears to be Chrome');

    webrtcDetectedBrowser = 'chrome';

    // the detected chrome version.
    webrtcDetectedVersion =
        parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);

    // the minimum chrome version still supported by adapter.
    webrtcMinimumVersion = 38;

    // The RTCPeerConnection object.
    window.RTCPeerConnection = function (pcConfig, pcConstraints) {
        // Translate iceTransportPolicy to iceTransports,
        // see https://code.google.com/p/webrtc/issues/detail?id=4869
        if (pcConfig && pcConfig.iceTransportPolicy) {
            pcConfig.iceTransports = pcConfig.iceTransportPolicy;
        }

        var pc = new webkitRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
        var origGetStats = pc.getStats.bind(pc);
        pc.getStats = function (selector, successCallback, errorCallback) { // jshint ignore: line
            var self = this;
            var args = arguments;

            // If selector is a function then we are in the old style stats so just
            // pass back the original getStats format to avoid breaking old users.
            if (arguments.length > 0 && typeof selector === 'function') {
                return origGetStats(selector, successCallback);
            }

            var fixChromeStats = function (response) {
                var standardReport = {};
                var reports = response.result();
                reports.forEach(function (report) {
                    var standardStats = {
                        id: report.id,
                        timestamp: report.timestamp,
                        type: report.type
                    };
                    report.names().forEach(function (name) {
                        standardStats[name] = report.stat(name);
                    });
                    standardReport[standardStats.id] = standardStats;
                });

                return standardReport;
            };

            if (arguments.length >= 2) {
                var successCallbackWrapper = function (response) {
                    args[1](fixChromeStats(response));
                };

                return origGetStats.apply(this, [successCallbackWrapper, arguments[0]]);
            }

            // promise-support
            return new Promise(function (resolve, reject) {
                if (args.length === 1 && selector === null) {
                    origGetStats.apply(self, [
                        function (response) {
                            resolve.apply(null, [fixChromeStats(response)]);
                        }, reject]);
                } else {
                    origGetStats.apply(self, [resolve, reject]);
                }
            });
        };

        return pc;
    };

    // add promise support
    ['createOffer', 'createAnswer'].forEach(function (method) {
        var nativeMethod = webkitRTCPeerConnection.prototype[method];
        webkitRTCPeerConnection.prototype[method] = function () {
            var self = this;
            if (arguments.length < 1 || (arguments.length === 1 &&
                typeof(arguments[0]) === 'object')) {
                var opts = arguments.length === 1 ? arguments[0] : undefined;
                return new Promise(function (resolve, reject) {
                    nativeMethod.apply(self, [resolve, reject, opts]);
                });
            } else {
                return nativeMethod.apply(this, arguments);
            }
        };
    });

    ['setLocalDescription', 'setRemoteDescription',
        'addIceCandidate'].forEach(function (method) {
        var nativeMethod = webkitRTCPeerConnection.prototype[method];
        webkitRTCPeerConnection.prototype[method] = function () {
            var args = arguments;
            var self = this;
            return new Promise(function (resolve, reject) {
                nativeMethod.apply(self, [args[0],
                    function () {
                        resolve();
                        if (args.length >= 2) {
                            args[1].apply(null, []);
                        }
                    },
                    function (err) {
                        reject(err);
                        if (args.length >= 3) {
                            args[2].apply(null, [err]);
                        }
                    }]
                );
            });
        };
    });

    // getUserMedia constraints shim.
    var constraintsToChrome = function (c) {
        if (typeof c !== 'object' || c.mandatory || c.optional) {
            return c;
        }
        var cc = {};
        Object.keys(c).forEach(function (key) {
            if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
                return;
            }
            var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
            if (r.exact !== undefined && typeof r.exact === 'number') {
                r.min = r.max = r.exact;
            }
            var oldname = function (prefix, name) {
                if (prefix) {
                    return prefix + name.charAt(0).toUpperCase() + name.slice(1);
                }
                return (name === 'deviceId') ? 'sourceId' : name;
            };
            if (r.ideal !== undefined) {
                cc.optional = cc.optional || [];
                var oc = {};
                if (typeof r.ideal === 'number') {
                    oc[oldname('min', key)] = r.ideal;
                    cc.optional.push(oc);
                    oc = {};
                    oc[oldname('max', key)] = r.ideal;
                    cc.optional.push(oc);
                } else {
                    oc[oldname('', key)] = r.ideal;
                    cc.optional.push(oc);
                }
            }
            if (r.exact !== undefined && typeof r.exact !== 'number') {
                cc.mandatory = cc.mandatory || {};
                cc.mandatory[oldname('', key)] = r.exact;
            } else {
                ['min', 'max'].forEach(function (mix) {
                    if (r[mix] !== undefined) {
                        cc.mandatory = cc.mandatory || {};
                        cc.mandatory[oldname(mix, key)] = r[mix];
                    }
                });
            }
        });
        if (c.advanced) {
            cc.optional = (cc.optional || []).concat(c.advanced);
        }
        return cc;
    };

    getUserMedia = function (constraints, onSuccess, onError) {
        if (constraints.audio) {
            constraints.audio = constraintsToChrome(constraints.audio);
        }
        if (constraints.video) {
            constraints.video = constraintsToChrome(constraints.video);
        }
        webrtcUtils.log('chrome: ' + JSON.stringify(constraints));
        return navigator.webkitGetUserMedia(constraints, onSuccess, onError);
    };
    navigator.getUserMedia = getUserMedia;

    if (!navigator.mediaDevices) {
        navigator.mediaDevices = {
            getUserMedia: requestUserMedia,
            enumerateDevices: function () {
                return new Promise(function (resolve) {
                    var kinds = {audio: 'audioinput', video: 'videoinput'};
                    return MediaStreamTrack.getSources(function (devices) {
                        resolve(devices.map(function (device) {
                            return {
                                label: device.label,
                                kind: kinds[device.kind],
                                deviceId: device.id,
                                groupId: ''
                            };
                        }));
                    });
                });
            }
        };
    }

    // A shim for getUserMedia method on the mediaDevices object.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (!navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia = function (constraints) {
            return requestUserMedia(constraints);
        };
    } else {
        // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
        // function which returns a Promise, it does not accept spec-style
        // constraints.
        var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = function (c) {
            webrtcUtils.log('spec:   ' + JSON.stringify(c)); // whitespace for alignment
            c.audio = constraintsToChrome(c.audio);
            c.video = constraintsToChrome(c.video);
            webrtcUtils.log('chrome: ' + JSON.stringify(c));
            return origGetUserMedia(c);
        };
    }

    // Dummy devicechange event methods.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
        navigator.mediaDevices.addEventListener = function () {
            webrtcUtils.log('Dummy mediaDevices.addEventListener called.');
        };
    }
    if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
        navigator.mediaDevices.removeEventListener = function () {
            webrtcUtils.log('Dummy mediaDevices.removeEventListener called.');
        };
    }

    // Attach a media stream to an element.
    attachMediaStream = function (element, stream) {
        if (webrtcDetectedVersion >= 43) {
            element.srcObject = stream;
        } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
        } else {
            webrtcUtils.log('Error attaching stream to element.');
        }
    };
    reattachMediaStream = function (to, from) {
        if (webrtcDetectedVersion >= 43) {
            to.srcObject = from.srcObject;
        } else {
            to.src = from.src;
        }
    };

} else if (navigator.mediaDevices && navigator.userAgent.match(
        /Edge\/(\d+).(\d+)$/)) {
    webrtcUtils.log('This appears to be Edge');
    // Setup FLASH as media provider for Edge
    webrtcDetectedBrowser = null;

    webrtcDetectedVersion =
        parseInt(navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)[2], 10);

    // the minimum version still supported by adapter.
    webrtcMinimumVersion = 12;
} else {
    webrtcUtils.log('Browser does not appear to be WebRTC-capable');
}

// Returns the result of getUserMedia as a Promise.
function requestUserMedia(constraints) {
    return new Promise(function (resolve, reject) {
        getUserMedia(constraints, resolve, reject);
    });
}

var webrtcTesting = {};
Object.defineProperty(webrtcTesting, 'version', {
    set: function (version) {
        webrtcDetectedVersion = version;
    }
});

if (typeof module !== 'undefined') {
    var RTCPeerConnection;
    if (typeof window !== 'undefined') {
        RTCPeerConnection = window.RTCPeerConnection;
    }
    module.exports = {
        RTCPeerConnection: RTCPeerConnection,
        getUserMedia: getUserMedia,
        attachMediaStream: attachMediaStream,
        reattachMediaStream: reattachMediaStream,
        webrtcDetectedBrowser: webrtcDetectedBrowser,
        webrtcDetectedVersion: webrtcDetectedVersion,
        webrtcMinimumVersion: webrtcMinimumVersion,
        webrtcTesting: webrtcTesting
        //requestUserMedia: not exposed on purpose.
        //trace: not exposed on purpose.
    };
} else if ((typeof require === 'function') && (typeof define === 'function')) {
    // Expose objects and functions when RequireJS is doing the loading.
    define([], function () {
        return {
            RTCPeerConnection: window.RTCPeerConnection,
            getUserMedia: getUserMedia,
            attachMediaStream: attachMediaStream,
            reattachMediaStream: reattachMediaStream,
            webrtcDetectedBrowser: webrtcDetectedBrowser,
            webrtcDetectedVersion: webrtcDetectedVersion,
            webrtcMinimumVersion: webrtcMinimumVersion,
            webrtcTesting: webrtcTesting
            //requestUserMedia: not exposed on purpose.
            //trace: not exposed on purpose.
        };
    });
}
