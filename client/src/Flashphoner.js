function Flashphoner() {
    if (arguments.callee.instance) {
        return arguments.callee.instance;
    }
    arguments.callee.instance = this;

    this.webRtcMediaManagers = new DataMap();
    this.flashMediaManager = undefined;
    this.connection = null;
    this.configuration = new Configuration();
    this.calls = new DataMap();
    this.streams = new DataMap();
    this.messages = {};
    this.isOpened = false;
    this.listeners = {};
    this.version = undefined;
}

Flashphoner.getInstance = function () {
    return new Flashphoner();
};

Flashphoner.prototype = {

    initFlashMediaManager: function(elementId, pathToSWF){
        var me = this;
        var params = {};
        params.menu = "true";
        params.swliveconnect = "true";
        params.allowfullscreen = "true";
        params.allowscriptaccess = "always";
        //in case of Safari wmode should be "window"
        if((navigator.userAgent.indexOf("Safari") > -1) && !(navigator.userAgent.indexOf("Chrome") > -1)) {
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
            });
        } else {
            trace("Problem: Flash not found")
        }
    },

    configure: function (configuration) {
        this.configuration = configuration;
    },

    addListener: function (event, listener, thisArg) {
        this.listeners[event] = {func: listener, thisArg: thisArg};
    },

    invokeListener: function (event, argsArray) {
        var listener = this.listeners[event];
        if (listener) {
            listener.func.apply(listener.thisArg, argsArray);
        }
    },

    addOrUpdateCall: function (call) {
        var me = this;
        if (me.calls.get(call.callId)) {
            me.calls.update(call.callId, call);
        } else {
            me.calls.add(call.callId, call);
            me.invokeListener(WCSEvent.OnCallEvent, [
                {call: call}
            ]);
            me.webRtcMediaManagers.add(call.callId, new WebRtcMediaManager(me.configuration.stunServer, me.configuration.useDTLS, me.localVideo, me.remoteVideo));
        }
    },

    init: function (localVideo, remoteVideo, pathToSWF) {
        var me = this;
        me.initFlashMediaManager("flashVideoDiv", pathToSWF);
        me.localVideo = localVideo;
        me.remoteVideo = remoteVideo;


        this.callbacks = {
            ping: function () {
                me.webSocket.send("pong");
            },

            getUserData: function (user) {
                me.user = user;
                for (var prop in user) {
                    me.connection[prop] = me.user[prop];
                }
                me.connection.status = ConnectionStatus.Established;
                me.invokeListener(WCSEvent.ConnectionStatusEvent, [
                    {connection: me.connection}
                ]);
            },

            getVersion: function (version) {
                me.version = version;
            },

            registered: function (sipHeader) {
                me.invokeListener(WCSEvent.RegistrationStatusEvent, [
                    {connection: me.connection, sipObject: sipHeader}
                ]);
            },

            notifyTryingResponse: function (call, sipHeader) {
                trace("notifyTryingResponse call.callId:" + call.callId);
                me.addOrUpdateCall(call);
            },

            ring: function (call, sipHeader) {
                trace("ring call.state: " + call.state + " call.callId: " + call.callId);
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            sessionProgress: function (call, sipHeader) {
                trace("sessionProgress call.state: " + call.state + " call.callId: " + call.callId);
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            setRemoteSDP: function (id, sdp, isInitiator) {
                var webRtcMediaManager = me.webRtcMediaManagers.get(id);
                webRtcMediaManager.setRemoteSDP(sdp, isInitiator);
            },

            talk: function (call, sipHeader) {
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            hold: function (call, sipHeader) {
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            finish: function (call, sipHeader) {
//                me.calls.remove(call.callId);
                me.webRtcMediaManagers.remove(call.callId).close();
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            busy: function (call, sipHeader) {
                me.addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            fail: function (errorCode, sipHeader) {
                me.invokeListener(WCSEvent.ErrorStatusEvent, [
                    {code: errorCode, sipObject: sipHeader}
                ]);
            },

            notifyVideoFormat: function (videoFormat) {
            },

            notifyBugReport: function (filename) {
                me.invokeListener(WCSEvent.BugReportStatusEvent, [
                    {filename: filename}
                ]);
            },

            notifyMessage: function (message, notificationResult, sipObject) {
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
                        {message: message, sipObject: sipObject}
                    ]);
                } else {
                    if (message.status == MessageStatus.ACCEPTED) {
                        if (!sentMessage.isImdnRequired) {
                            me.removeSentMessage(sentMessage);
                        }
                    } else if (message.status == MessageStatus.FAILED) {
                        me.removeSentMessage(sentMessage);
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
                        {message: message, sipObject: sipObject}
                    ]);
                }
            },

            notifyAudioCodec: function (codec) {
            },

            notifyRecordComplete: function (recordReport) {
                me.invokeListener(WCSEvent.RecordingStatusEvent, [
                    recordReport
                ]);
            },

            notifySubscription: function (subscription, sipObject) {
                me.invokeListener(WCSEvent.SubscriptionStatusEvent, [
                    {subscription: subscription, sipObject: sipObject}
                ]);
            },

            notifyXcapResponse: function (xcapResponse) {
                me.invokeListener(WCSEvent.XcapStatusEvent, [
                    xcapResponse
                ]);
            },

            notifyStreamStatusEvent: function (stream) {
                me.streams.update(stream.id, stream);
                me.invokeListener(WCSEvent.StreamStatusEvent, [
                    stream
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
        me.connection.useDTLS = me.configuration.useDTLS;
        me.connection.sipRegisterRequired = me.connection.sipRegisterRequired || me.configuration.sipRegisterRequired;
        me.connection.sipContactParams = me.connection.sipContactParams || me.configuration.sipContactParams;

        me.connection.status = ConnectionStatus.Pending;
        me.webSocket = $.websocket(connection.urlServer || me.configuration.urlWsServer, {
            open: function () {
                me.isOpened = true;
                me.webSocket.send("connect", me.connection);
            },
            close: function (event) {
                me.isOpened = false;
                if (!event.originalEvent.wasClean) {
                    me.connection.status = ConnectionStatus.Error;
                } else {
                    me.connection.status = ConnectionStatus.Disconnected;
                }
                me.invokeListener(WCSEvent.ConnectionStatusEvent, [
                    {connection: me.connection}
                ]);
                for (var id in me.webRtcMediaManagers.getData()) {
                    me.webRtcMediaManagers.remove(id).close();
                }
            },
            error: function () {
                me.connection.status = ConnectionStatus.Error;
                me.invokeListener(WCSEvent.ConnectionStatusEvent, [
                    {connection: me.connection}
                ]);
            },
            context: me,
            events: me.callbacks
        });
        return 0;
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
        trace("Configuring WebRTC connection...");

        call.callId = createUUID();
        me.addOrUpdateCall(call);

        var webRtcMediaManager = me.webRtcMediaManagers.get(call.callId);
        webRtcMediaManager.createOffer(function (sdp) {
            //here we will strip codecs from SDP if requested
            if (me.configuration.stripCodecs.length) {
                sdp = me.stripCodecsSDP(sdp);
                console.log("New SDP: " + sdp);
            }
            sdp = me.removeCandidatesFromSDP(sdp);
            call.sdp = sdp;
            me.webSocket.send("call", call);
        }, true, call.hasVideo);
        return 0;
    },

    msrpCall: function (callRequest) {
        var me = this;
        me.webSocket.send("msrpCall", callRequest);
        return 0;
    },

    answer: function (call) {
        var me = this;
        trace("Configuring WebRTC connection...");
        /**
         * If we receive INVITE without SDP, we should send answer with SDP based on webRtcMediaManager.createOffer because we do not have remoteSdp here
         */
        var webRtcMediaManager = this.webRtcMediaManagers.get(call.callId);
        if (webRtcMediaManager.lastReceivedSdp !== null && webRtcMediaManager.lastReceivedSdp.length == 0) {
            webRtcMediaManager.createOffer(function (sdp) {
                //here we will strip codecs from SDP if requested
                if (me.configuration.stripCodecs.length) {
                    sdp = me.stripCodecsSDP(sdp);
                    console.log("New SDP: " + sdp);
                }
                call.sdp = me.removeCandidatesFromSDP(sdp);
                me.webSocket.send("answer", call);
            }, true, call.hasVideo);
        } else {
            /**
             * If we receive a normal INVITE with SDP we should create answering SDP using normal createAnswer method because we already have remoteSdp here.
             */
            webRtcMediaManager.createAnswer(function (sdp) {
                call.sdp = sdp;
                me.webSocket.send("answer", call);
            }, call.hasVideo);
        }
    },

    hangup: function (call) {
        if (call) {
            this.webSocket.send("hangup", {callId: call.callId});
        }
    },

    hold: function (call) {
        this.webSocket.send("hold", {callId: call.callId});
    },

    unhold: function (call) {
        this.webSocket.send("unhold", {callId: call.callId});
    },

    transfer: function (transferObj) {
        this.webSocket.send("transfer", transferObj);
    },

    sendDTMF: function (dtmfObj) {
        this.webSocket.send("sendDtmf", dtmfObj);
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

    getAccessToAudioAndVideo: function () {
        WebRtcMediaManager.getAccessToAudioAndVideo();
    },

    getAccessToAudio: function () {
        WebRtcMediaManager.getAccessToAudio();
    },

    getVolume: function () {
        return this.remoteVideo.volume * 100;
    },

    setVolume: function (value) {
        this.remoteVideo.volume = value / 100;
    },

    hasAccessToAudio: function () {
        return WebRtcMediaManager.isAudioMuted == -1;
    },

    hasAccessToVideo: function () {
        return WebRtcMediaManager.isVideoMuted == -1;
    },

    hasActiveAudioStream: function () {
        return WebRtcMediaManager.hasActiveAudioStream();
    },

    sendMessage: function (message) {
        var id = createUUID();
        message.id = id;
        message.from = this.user.login;
        message.contentType = message.contentType || this.configuration.msgContentType;
        message.isImdnRequired = message.isImdnRequired || this.configuration.imdnEnabled;
        this.messages[id] = message;
        this.webSocket.send("sendMessage", message);
    },

    notificationResult: function (result) {
        this.webSocket.send("notificationResult", result);
    },

    getStats: function (sessionId) {
        this.webRtcMediaManagers.get(sessionId).requestStats();
    },

    publishStream: function (stream) {
        var me = this;
        stream.mediaSessionId = createUUID();
        stream.published = true;
        stream.hasVideo = true;

        var webRtcMediaManager = new WebRtcMediaManager(me.configuration.stunServer, me.configuration.useDTLS, me.remoteVideo);

        webRtcMediaManager.createOffer(function (sdp) {
            trace("Publish name " + stream.name);
            stream.sdp = me.removeCandidatesFromSDP(sdp);
            me.webSocket.send("publishStream", stream);

            me.webRtcMediaManagers.add(stream.mediaSessionId, webRtcMediaManager);
            me.streams.add(stream.name, stream);
        }, true, true);
    },

    unPublishStream: function (stream) {
        console.log("Unpublish stream " + stream.name);
        var me = this;
        var removedStream = me.streams.remove(stream.name);
        me.webRtcMediaManagers.remove(removedStream.mediaSessionId).close();
        me.webSocket.send("unPublishStream", removedStream);
    },

    playStream: function (stream) {
        var me = this;
        var webRtcMediaManager = new WebRtcMediaManager(me.configuration.stunServer, me.configuration.useDTLS, me.remoteVideo);
        stream.mediaSessionId = createUUID();
        stream.published = false;
        stream.hasVideo = true;

        webRtcMediaManager.createOffer(function (sdp) {
            console.log("playStream name " + stream.name);
            stream.sdp = me.removeCandidatesFromSDP(sdp);
            me.webSocket.send("playStream", stream);

            me.webRtcMediaManagers.add(stream.mediaSessionId, webRtcMediaManager);
            me.streams.add(stream.name, stream);
        }, false, false);
    },

    stopStream: function (stream) {
        console.log("unSubscribe stream " + stream.name);
        var me = this;
        var removedStream = me.streams.remove(stream.name);
        me.webRtcMediaManagers.remove(removedStream.mediaSessionId).close();
        me.webSocket.send("stopStream", removedStream);
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

    stripCodecsSDP: function (sdp) {
        var sdpArray = sdp.split("\n");
        console.dir(this.configuration.stripCodecs);

        //search and delete codecs line
        var pt = [];
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

        if (pt.length) {
            //searching for fmtp
            for (p = 0; p < pt.length; p++) {
                for (i = 0; i < sdpArray.length; i++) {
                    if (sdpArray[i].search("a=fmtp:" + pt[p]) != -1) {
                        console.log("PT " + pt[p] + " detected");
                        sdpArray[i] = "";
                    }
                    if (sdpArray[i].search("a=candidate:") != -1) {
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
    }
};

var WebRtcMediaManager = function (stunServer, useDTLS, remoteVideo) {
    var me = this;

    me.peerConnection = null;
    me.peerConnectionState = 'new';
    me.remoteAudioVideoMediaStream = null;
    me.remoteVideo = remoteVideo;
    me.stunServer = stunServer;
    me.useDTLS = useDTLS;
    //stun server by default
    //commented to speedup WebRTC call establishment
    //me.stunServer = "stun.l.google.com:19302";
};

WebRtcMediaManager.isAudioMuted = 1;
WebRtcMediaManager.isVideoMuted = 1;
WebRtcMediaManager.getAccessToAudioAndVideo = function () {

    if (!WebRtcMediaManager.localAudioVideoStream) {
        getUserMedia({audio: true, video: true}, function (stream) {
                attachMediaStream(Flashphoner.getInstance().localVideo, stream);
                WebRtcMediaManager.localAudioVideoStream = stream;
                WebRtcMediaManager.isAudioMuted = -1;
                WebRtcMediaManager.isVideoMuted = -1;
            }, function (error) {
                trace("Failed to get access to local media. Error code was " + error.code + ".");
                WebRtcMediaManager.isAudioMuted = 1;
                WebRtcMediaManager.isVideoMuted = 1;
            }
        );
    }
};
WebRtcMediaManager.getAccessToAudio = function () {
    if (!WebRtcMediaManager.localAudioStream) {
        getUserMedia({audio: true}, function (stream) {
                WebRtcMediaManager.localAudioStream = stream;
                WebRtcMediaManager.isAudioMuted = -1;
            }, function (error) {
                trace("Failed to get access to local media. Error code was " + error.code + ".");
                WebRtcMediaManager.isAudioMuted = 1;
            }
        );
    }
};

WebRtcMediaManager.prototype.init = function () {
    trace("WebRtcMediaManager - init");
    var me = this;

    me.hasVideo = false;
    this.peerConnection = null;
    this.peerConnectionState = 'new';
    this.remoteAudioVideoMediaStream = null;
};

WebRtcMediaManager.prototype.close = function () {
    //Commented to prevent termination of rtcMediaManager after MSRP call
    trace("WebRtcMediaManager - close()");
    if (this.peerConnectionState != 'finished') {
        this.peerConnectionState = 'finished';
        if (this.peerConnection) {
            trace("WebRtcMediaManager - PeerConnection will be closed");
            this.peerConnection.close();
            this.remoteVideo.pause();
        }
    } else {
        console.log("peerConnection already closed, do nothing!");
    }
};


WebRtcMediaManager.prototype.createPeerConnection = function () {
    trace("WebRtcMediaManager - createPeerConnection()");
    var application = this;
    if (application.stunServer !== undefined && application.stunServer.length > 0) {
        pc_config = {"iceServers": [
            {"url": "stun:" + application.stunServer}
        ]};
    } else {
        pc_config = {"iceServers": []};
    }
    this.peerConnection = new RTCPeerConnection(pc_config, {"optional": [
        {"DtlsSrtpKeyAgreement": application.useDTLS}
    ]});

    this.peerConnection.onaddstream = function (event) {
        application.onOnAddStreamCallback(event);
    };


    this.peerConnection.onremovestream = function (event) {
        application.onOnRemoveStreamCallback(event);
    };
};

WebRtcMediaManager.prototype.onOnAddStreamCallback = function (event) {
    trace("WebRtcMediaManager - onOnAddStreamCallback(): event=" + event);
    trace("WebRtcMediaManager - onOnAddStreamCallback(): event=" + event.stream);
    trace("WebRtcMediaManager - onOnAddStreamCallback(): event=" + this.remoteVideo);
    if (this.peerConnection != null) {
        this.remoteAudioVideoMediaStream = event.stream;
        attachMediaStream(this.remoteVideo, this.remoteAudioVideoMediaStream);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onOnAddStreamCallback(): this.peerConnection is null, bug in state machine!, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onOnRemoveStreamCallback = function (event) {
    trace("WebRtcMediaManager - onOnRemoveStreamCallback(): event=" + event);
    if (this.peerConnection != null) {
        this.remoteAudioVideoMediaStream = null;
        this.remoteVideo.pause();
    } else {
        console.warn("SimpleWebRtcSipPhone:onOnRemoveStreamCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.waitGatheringIce = function () {
    var me = this;
    if (me.peerConnection != null) {
        sendSdp = function () {
            if (me.peerConnection != null) {
                trace("WebRtcMediaManager - waitGatheringIce() iceGatheringState=" + me.peerConnection.iceGatheringState);
                if (me.peerConnection.iceGatheringState == "complete") {
                    trace("WebRtcMediaManager - setLocalSDP: sdp=" + me.peerConnection.localDescription.sdp);
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
                        console.log("WebRtcMediaManager - onIceCandidateCallback(): RTCPeerConnection bad state!");
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
        console.warn("WebRtcMediaManager - onIceCandidateCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.createOffer = function (createOfferCallback, hasAudio, hasVideo) {
    trace("WebRtcMediaManager - createOffer()");
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
            if (hasAudio && hasVideo) {
                me.peerConnection.addStream(WebRtcMediaManager.localAudioVideoStream);
            } else if (hasAudio) {
                me.peerConnection.addStream(WebRtcMediaManager.localAudioStream);
            } else {
                mandatory = {optional: [], mandatory: { OfferToReceiveAudio: true, OfferToReceiveVideo: true}}
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
        console.error("WebRtcMediaManager - createOffer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.createAnswer = function (createAnswerCallback, hasVideo) {
    var me = this;
    trace("WebRtcMediaManager - createAnswer() me.getConnectionState(): " + me.getConnectionState() + " me.hasVideo: " + me.hasVideo);
    if (me.getConnectionState() != "established") {
        me.init();
    }
    try {

        if (me.peerConnection == null) {
            me.createPeerConnection();
            if (hasVideo) {
                me.peerConnection.addStream(WebRtcMediaManager.localAudioVideoStream);
            } else {
                me.peerConnection.addStream(WebRtcMediaManager.localAudioStream);
            }
        } else {
            if (hasVideo) {
                me.peerConnection.addStream(WebRtcMediaManager.localVideoStream);
                me.hasVideo = true;
            } else {
                if (WebRtcMediaManager.localVideoStream) {
                    me.peerConnection.removeStream(WebRtcMediaManager.localVideoStream);
                }
                me.hasVideo = false;
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
        console.error("WebRtcMediaManager - createAnswer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.onCreateOfferSuccessCallback = function (offer) {
    trace("WebRtcMediaManager - onCreateOfferSuccessCallback this.peerConnection: " + this.peerConnection + " this.peerConnectionState: " + this.peerConnectionState);
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
            console.error("WebRtcMediaManager - onCreateOfferSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateOfferSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onSetLocalDescriptionSuccessCallback = function (sdp) {
    trace("WebRtcMediaManager - onSetLocalDescriptionSuccessCallback");
    if (webrtcDetectedBrowser == "firefox") {
        trace("WebRtcMediaManager - onSetLocalDescriptionSuccessCallback: sdp=" + sdp);
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

WebRtcMediaManager.prototype.getConnectionState = function () {
    return this.peerConnectionState;
};

WebRtcMediaManager.prototype.setRemoteSDP = function (sdp, isInitiator) {
    trace("WebRtcMediaManager - setRemoteSDP: isInitiator: " + isInitiator + " sdp=" + sdp);
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

WebRtcMediaManager.prototype.onSetRemoteDescriptionSuccessCallback = function () {
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
            console.log("WebRtcMediaManager - onSetRemoteDescriptionSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onSetRemoteDescriptionSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaManager.prototype.onCreateAnswerSuccessCallback = function (answer) {
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
            console.log("WebRtcMediaManager - onCreateAnswerSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateAnswerSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.requestStats = function () {
    var me = this;
    if (this.peerConnection && this.peerConnection.getRemoteStreams()[0] && webrtcDetectedBrowser == "chrome") {
        if (this.peerConnection.getStats) {
            this.peerConnection.getStats(function (rawStats) {
                var results = rawStats.result();
                var result = {};
                for (var i = 0; i < results.length; ++i) {
                    var resultPart = me.processGoogRtcStatsReport(results[i]);
                    if (resultPart != null) {
                        if (resultPart.type == "googCandidatePair") {
                            result.activeCandidate = resultPart;
                        } else if (resultPart.type == "ssrc") {
                            if (resultPart.packetsLost == -1) {
                                result.outgoingStream = resultPart;
                            } else {
                                result.incomingStream = resultPart;
                            }
                        }
                    }
                }
                console.log(JSON.stringify(stats, null, '\t'));
            }, function (error) {
                console.log("Error received " + error);
            });

        }
    } else if (this.peerConnection && this.peerConnection.getRemoteStreams()[0] && webrtcDetectedBrowser == "firefox") {
        if (this.peerConnection.getStats) {
            this.peerConnection.getStats(null, function (rawStats) {
                var result = {};
                for (var k in rawStats) {
                    if (rawStats.hasOwnProperty(k)) {
                        var resultPart = me.processRtcStatsReport(rawStats[k]);
                        if (resultPart != null) {
                            if (resultPart.type == "outboundrtp") {
                                result.outgoingStream = resultPart;
                            } else if (resultPart.type == "inboundrtp") {
                                result.incomingStream = resultPart;
                            }
                        }
                    }
                }
                console.log(JSON.stringify(stats, null, '\t'));
            }, function (error) {
                console.log("Error received " + error);
            });
        }
    }
};

WebRtcMediaManager.prototype.processRtcStatsReport = function (report) {
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

WebRtcMediaManager.prototype.processGoogRtcStatsReport = function (report) {
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

WebRtcMediaManager.prototype.onCreateAnswerErrorCallback = function (error) {
    console.error("WebRtcMediaManager - onCreateAnswerErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onCreateOfferErrorCallback = function (error) {
    console.error("WebRtcMediaManager - onCreateOfferErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onSetLocalDescriptionErrorCallback = function (error) {
    console.error("WebRtcMediaManager - onSetLocalDescriptionErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onSetRemoteDescriptionErrorCallback = function (error) {
    console.error("WebRtcMediaManager - onSetRemoteDescriptionErrorCallback(): error: " + error);
};

WebRtcMediaManager.prototype.hasActiveAudioStream = function () {
    if (!this.remoteAudioVideoMediaStream) {
        trace("WebRtcMediaManager - no audio tracks");
        return false;
    }
    var l = this.remoteAudioVideoMediaStream.getAudioTracks().length;
    trace("WebRtcMediaManager - hasAudio length: " + l);
    if (l) {
        return true;
    } else {
        return false;
    }
};

Configuration = function () {
    this.urlWsServer = null;
    this.urlFlashServer = null;
    this.sipRegisterRequired = true;
    this.sipContactParams = null;

    this.useDTLS = true;

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
    this.useProxy = true;
    this.useDTLS = true;
    this.useSelfSigned = !isMobile.any();
    this.appKey = "defaultApp";
    this.status = ConnectionStatus.New;
};

var ConnectionStatus = function () {
};
ConnectionStatus.New = "NEW";
ConnectionStatus.Pending = "PENDING";
ConnectionStatus.Established = "ESTABLISHED";
ConnectionStatus.Disconnected = "DISCONNECTED";
ConnectionStatus.Error = "ERROR";

var Call = function () {
    this.callId = "";
    this.status = "";
    this.caller = "";
    this.callee = "";
    this.incoming = false;
    this.visibleName = "";
    this.inviteParameters = "";
};

var CallStatus = function () {
};
CallStatus.RING = "RING";
CallStatus.RING_MEDIA = "RING_MEDIA";
CallStatus.HOLD = "HOLD";
CallStatus.TALK = "TALK";
CallStatus.FINISH = "FINISH";
CallStatus.BUSY = "BUSY";
CallStatus.SESSION_PROGRESS = "SESSION_PROGRESS";

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
    this.status = StreamStatus.New;
    this.sdp = "";
    this.message = "";
};

var StreamStatus = function () {
};
StreamStatus.New = "NEW";
StreamStatus.Pending = "PENDING";
StreamStatus.Publishing = "PUBLISHING";
StreamStatus.Playing = "PLAYING";
StreamStatus.Unpublished = "UNPUBLISHED";
StreamStatus.Stoped = "STOPED";
StreamStatus.Error = "ERROR";

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

var WCSError = function () {
};
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
        this.data[id] = undefined;
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
        var result = Flashphoner.getInstance().pushLogs({logs:logs + logMessage + '\n'});
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

var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var isWebRTCAvailable = false;

if (navigator.mozGetUserMedia) {
    console.log("This appears to be Firefox");

    if (typeof(mozRTCPeerConnection) === undefined) {
        console.log("Please, update your browser to use WebRTC");
    } else {
        isWebRTCAvailable = true;

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

        MediaStream.prototype.getVideoTracks = function () {
            return [];
        };

        MediaStream.prototype.getAudioTracks = function () {
            return [];
        };
    }
} else if (navigator.webkitGetUserMedia) {
    console.log("This appears to be Chrome");

    if (typeof(webkitRTCPeerConnection) === undefined) {
        console.log("Please, update your browser to use WebRTC");
    } else {
        isWebRTCAvailable = true;

        webrtcDetectedBrowser = "chrome";

        RTCPeerConnection = webkitRTCPeerConnection;

        getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

        attachMediaStream = function (element, stream) {
            element.src = webkitURL.createObjectURL(stream);
            element.play();
        };

        reattachMediaStream = function (to, from) {
            to.src = from.src;
            element.play();
        };

        if (!webkitMediaStream.prototype.getVideoTracks) {
            webkitMediaStream.prototype.getVideoTracks = function () {
                return this.videoTracks;
            };
        }

        if (!webkitMediaStream.prototype.getAudioTracks) {
            webkitMediaStream.prototype.getAudioTracks = function () {
                return this.audioTracks;
            };
        }
    }
} else {
    console.log("Browser does not appear to be WebRTC-capable");
}
