function Flashphoner() {
    if (arguments.callee.instance) {
        return arguments.callee.instance;
    }
    arguments.callee.instance = this;

    this.connection = null;
    this.calls = new DataMap();
    this.messages = {};
    this.isOpened = false;
    this.stripCodecs = [];
    this.listeners = {};
    this.version = undefined;
}

Flashphoner.getInstance = function () {
    return new Flashphoner();
};

Flashphoner.prototype = {

    addListener: function (event, listener, thisArg) {
        this.listeners[event] = {func: listener, thisArg: thisArg};
    },

    invokeListener: function (event, argsArray) {
        var listener = this.listeners[event];
        if (listener) {
            listener.func.apply(listener.thisArg, argsArray);
        }
    },

    init: function (localVideoPreview, remoteVideo) {
        var me = this;
        me.webRtcMediaManager = new WebRtcMediaManager(localVideoPreview, remoteVideo);

        var addOrUpdateCall = function (call) {
            if (me.calls.get(call.id)) {
                me.calls.update(call);
            } else {
                me.calls.add(call);
                me.invokeListener(WCSEvent.OnCallEvent, [
                    {call: call}
                ]);
            }
        };

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
                me.invokeListener(WCSEvent.OnRegistrationEvent, [
                    {connection: me.connection, sipObject: sipHeader}
                ]);
            },

            notifyTryingResponse: function (call, sipHeader) {
                trace("notifyTryingResponse call.id:" + call.id);
                addOrUpdateCall(call);
            },

            ring: function (call, sipHeader) {
                trace("ring call.state: " + call.state + " call.id: " + call.id);
                addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            sessionProgress: function (call, sipHeader) {
                trace("sessionProgress call.state: " + call.state + " call.id: " + call.id);
                addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            setRemoteSDP: function (call, sdp, isInitiator, sipHeader) {
                addOrUpdateCall(call);
                SoundControl.getInstance().stopSound("RING");
                me.webRtcMediaManager.setRemoteSDP(sdp, isInitiator);
                if (!isInitiator && me.webRtcMediaManager.getConnectionState() == "established") {
                    me.answer(call.id);
                }
            },

            talk: function (call, sipHeader) {
                addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            hold: function (call, sipHeader) {
                addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            finish: function (call, sipHeader) {
                me.calls.remove(call.id);
                if (me.calls.length == 0) {
                    me.webRtcMediaManager.close();
                }
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            busy: function (call, sipHeader) {
                addOrUpdateCall(call);
                me.invokeListener(WCSEvent.CallStatusEvent, [
                    {call: call, sipObject: sipHeader}
                ]);
            },

            fail: function (errorCode, sipHeader) {
                me.invokeListener(WCSEvent.OnErrorEvent, [
                    {code: errorCode, sipObject: sipHeader}
                ]);
            },

            notifyVideoFormat: function (videoFormat) {
            },

            notifyBugReport: function (filename) {
                notifyBugReport(filename);
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
                        {message: message, sipObject:sipObject}
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
                        {message: message, sipObject:sipObject}
                    ]);
                }
            },

            notifyAudioCodec: function (codec) {
            },

            notifyRecordComplete: function (reportObject) {
                notifyRecordComplete(reportObject);
            },

            notifySubscription: function (subscriptionObject, sipObject) {
                notifySubscription(subscriptionObject, sipObject);
            },

            notifyXcapResponse: function (xcapResponse) {
                notifyXcapResponse(xcapResponse);
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
        var configuration = Configuration.getInstance();
        me.connection.registerRequired = configuration.registerRequired;
        me.connection.useDTLS = configuration.useDTLS;
        if (configuration.contactParams != null && configuration.contactParams.length != 0) {
            me.connection.contactParams = configuration.contactParams;
        }
        me.connection.status = ConnectionStatus.Pending;
        me.webSocket = $.websocket(configuration.urlServer, {
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
                me.webRtcMediaManager.close();
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

    loginByToken: function (token, pageUrl) {
        var me = this;
        var obj = {};
        obj.token = token;
        obj.pageUrl = pageUrl;

        me.connect(obj);
        return 0;
    },

    callByToken: function (callRequest) {
        var me = this;
        trace("Configuring WebRTC connection...");
        this.webRtcMediaManager.createOffer(function (sdp) {
            callRequest.sdp = sdp;
            me.webSocket.send("call", callRequest);
        }, false);
        return 0;

    },

    disconnect: function () {
        trace("WebSocketManager - disconnect");
        this.webSocket.close();
    },

    subscribe: function (subscribeObject) {
        this.webSocket.send("subscribe", subscribeObject);
    },

    sendXcapRequest: function (xcapUrl) {
        this.webSocket.send("sendXcapRequest", xcapUrl);
    },

    call: function (callRequest) {
        var me = this;
        trace("Configuring WebRTC connection...");
        this.webRtcMediaManager.createOffer(function (sdp) {
            //here we will strip codecs from SDP if requested
            if (me.stripCodecs.length) {
                sdp = me.stripCodecsSDP(sdp);
                console.log("New SDP: " + sdp);
            }
            sdp = me.removeCandidatesFromSDP(sdp);
            callRequest.sdp = sdp;
            me.webSocket.send("call", callRequest);
        }, callRequest.hasVideo);
        return 0;
    },

    msrpCall: function (callRequest) {
        var me = this;
        me.webSocket.send("msrpCall", callRequest);
        return 0;
    },

    setSendVideo: function (hasVideo) {
//        var me = this;
//        this.webRtcMediaManager.createOffer(function (sdp) {
//            me.webSocket.send("changeMediaRequest", {callId: callId, sdp: sdp});
//        }, hasVideo);
//        return 0;
    },

    answer: function (callId, hasVideo) {
        var me = this;
        trace("Configuring WebRTC connection...");
        /**
         * If we receive INVITE without SDP, we should send answer with SDP based on webRtcMediaManager.createOffer because we do not have remoteSdp here
         */
        if (this.webRtcMediaManager.lastReceivedSdp !== null && this.webRtcMediaManager.lastReceivedSdp.length == 0) {
            this.webRtcMediaManager.createOffer(function (sdp) {
                //here we will strip codecs from SDP if requested
                if (me.stripCodecs.length) {
                    sdp = me.stripCodecsSDP(sdp);
                    console.log("New SDP: " + sdp);
                }
                sdp = me.removeCandidatesFromSDP(sdp);
                me.webSocket.send("answer", {callId: callId, hasVideo: hasVideo, sdp: sdp});
            }, hasVideo);
        } else {
            /**
             * If we receive a normal INVITE with SDP we should create answering SDP using normal createAnswer method because we already have remoteSdp here.
             */
            this.webRtcMediaManager.createAnswer(function (sdp) {
                me.webSocket.send("answer", {callId: callId, hasVideo: hasVideo, sdp: sdp});
            }, hasVideo);
        }
    },

    hangup: function (callId) {
        if (callId) {
            this.webSocket.send("hangup", callId);
        }
    },

    hold: function (callId, isHold) {
        this.webSocket.send("hold", {callId: callId, isHold: isHold});
    },

    transfer: function (callId, callee) {
        this.webSocket.send("transfer", {callId: callId, callee: callee});
    },

    sendDTMF: function (callId, dtmf) {
        this.webSocket.send("sendDtmf", {callId: callId, dtmf: dtmf});
    },

    setUseProxy: function (useProxy) {
        if (this.isOpened) {
            this.webSocket.send("setUseProxy", useProxy);
        }
    },

    pushLogs: function (logs) {
        if (this.isOpened) {
            this.webSocket.send("pushLogs", logs);
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
        this.webRtcMediaManager.getAccessToAudioAndVideo();
    },

    getAccessToAudio: function () {
        this.webRtcMediaManager.getAccessToAudio();
    },

    getVolume: function () {
        return this.webRtcMediaManager.remoteVideo.volume * 100;
    },

    setVolume: function (value) {
        this.webRtcMediaManager.remoteVideo.volume = value / 100;
    },

    hasAccessToAudio: function () {
        return this.webRtcMediaManager.isAudioMuted == -1;
    },

    hasAccessToVideo: function () {
        return this.webRtcMediaManager.isVideoMuted == -1;
    },

    hasActiveAudioStream: function () {
        return this.webRtcMediaManager.hasActiveAudioStream();
    },

    sendMessage: function (message) {
        var id = createUUID();
        message.id = id;
        message.from = this.user.login;
        message.isImdnRequired = Configuration.getInstance().imdnEnabled;
        this.messages[id] = message;
        this.webSocket.send("sendInstantMessage", message);
    },

    notificationResult: function (result) {
        this.webSocket.send("notificationResult", result);
    },

    getStats: function () {
        this.webRtcMediaManager.requestStats();
    },

    setStripCodecs: function (array) {
        this.stripCodecs = array;
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
        console.dir(this.stripCodecs);

        //search and delete codecs line
        var pt = [];
        for (p = 0; p < this.stripCodecs.length; p++) {
            console.log("Searching for codec " + this.stripCodecs[p]);
            for (i = 0; i < sdpArray.length; i++) {
                if (sdpArray[i].search(this.stripCodecs[p]) != -1 && sdpArray[i].indexOf("a=rtpmap") == 0) {
                    console.log(this.stripCodecs[p] + " detected");
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
    },

    setStunServer: function (server) {
        this.webRtcMediaManager.setStunServer(server);
    }

};

var WebRtcMediaManager = function (localVideoPreview, remoteVideo) {
    var me = this;

    me.peerConnection = null;
    me.peerConnectionState = 'new';
    me.remoteAudioVideoMediaStream = null;
    me.remoteVideo = remoteVideo;
    me.localVideo = localVideoPreview;
    me.localVideo.volume = 0;
    me.isAudioMuted = 1;
    me.isVideoMuted = 1;
    //stun server by default
    //commented to speedup WebRTC call establishment
    //me.stunServer = "stun.l.google.com:19302";
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
            this.remoteVideo.src = null;
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
        {"DtlsSrtpKeyAgreement": Configuration.getInstance().useDTLS}
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

WebRtcMediaManager.prototype.getAccessToAudioAndVideo = function () {
    var me = this;
    if (!me.localAudioVideoStream) {
        getUserMedia({audio: true, video: true}, function (stream) {
                attachMediaStream(me.localVideo, stream);
                me.localAudioVideoStream = stream;
                me.isAudioMuted = -1;
                me.isVideoMuted = -1;
            }, function (error) {
                trace("Failed to get access to local media. Error code was " + error.code + ".");
                closeInfoView(3000);
                me.isAudioMuted = 1;
                me.isVideoMuted = 1;
            }
        );
    }
};


WebRtcMediaManager.prototype.getAccessToAudio = function () {
    var me = this;
    if (!me.localAudioStream) {
        getUserMedia({audio: true}, function (stream) {
                me.localAudioStream = stream;
                me.isAudioMuted = -1;
            }, function (error) {
                trace("Failed to get access to local media. Error code was " + error.code + ".");
                closeInfoView(3000);
                me.isAudioMuted = 1;
            }
        );
    }
};

WebRtcMediaManager.prototype.createOffer = function (createOfferCallback, hasVideo) {
    trace("WebRtcMediaManager - createOffer()");
    var me = this;
    try {
        if (me.getConnectionState() != "established") {
            trace("Connection state is not established. Initializing...");
            me.init();
        }
        if (me.peerConnection == null) {
            trace("peerConnection is null");
            me.createPeerConnection();
            if (hasVideo) {
                me.peerConnection.addStream(me.localAudioVideoStream);
            } else {
                me.peerConnection.addStream(me.localAudioStream);
            }
        }
        me.createOfferCallback = createOfferCallback;
        me.peerConnection.createOffer(function (offer) {
            me.onCreateOfferSuccessCallback(offer);
        }, function (error) {
            me.onCreateOfferErrorCallback(error);
        });

    }
    catch (exception) {
        console.error("WebRtcMediaManager - createOffer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.createAnswer = function (createAnswerCallback, hasVideo) {
    var me = this;
    trace("WebRtcMediaManager - createAnswer() me.getConnectionState(): "+me.getConnectionState()+" me.hasVideo: "+me.hasVideo);
    if (me.getConnectionState() != "established") {
        me.init();
    }
    try {

        if (me.peerConnection == null) {
            me.createPeerConnection();
            if (hasVideo) {
                me.peerConnection.addStream(me.localAudioVideoStream);
            } else {
                me.peerConnection.addStream(me.localAudioStream);
            }
        } else {
            if (hasVideo) {
                me.peerConnection.addStream(me.localVideoStream);
                me.hasVideo = true;
            } else {
                if (me.localVideoStream) {
                    me.peerConnection.removeStream(me.localVideoStream);
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
    trace("WebRtcMediaManager - onCreateOfferSuccessCallback this.peerConnection: "+this.peerConnection+" this.peerConnectionState: "+this.peerConnectionState);
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
    trace("WebRtcMediaManager - setRemoteSDP: isInitiator: "+isInitiator+" sdp=" + sdp);
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
    trace("onCreateAnswerSuccessCallback "+this.peerConnection);
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

WebRtcMediaManager.prototype.setStunServer = function (server) {
    this.stunServer = server;
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
            }, function(error) {
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
            }, function(error) {
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
}

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
    if (!this.remoteAudioVideoMediaStream){
        trace("WebRtcMediaManager - no audio tracks");
        return false;
    }
    var l = this.remoteAudioVideoMediaStream.getAudioTracks().length;
    trace("WebRtcMediaManager - hasAudio length: "+l);
    if (l){
        return true;
    }else{
        return false;
    }
};

Configuration = function (configLoadedListener) {
    if (arguments.callee.instance) {
        var instance = arguments.callee.instance;
        if (configLoadedListener) {
            instance.configLoadedListener = configLoadedListener;
        }
        return instance;
    }
    arguments.callee.instance = this;
    if (configLoadedListener) {
        this.configLoadedListener = configLoadedListener;
    }


    this.flashphoner_UI = null;
    this.flashphonerListener = new DefaultListener();
    this.useWebRTC = false;
    this.urlServer = null;
    this.wcsIP = null;
    this.wsPort = "8080";
    this.flashPort = "1935";
    this.appName = "phone_app";
    this.loadBalancerUrl = null;
    this.jsonpSuccess = false;
    this.token = null;
    this.registerRequired = true;
    this.useDTLS = true;
    this.videoWidth = 320;
    this.videoHeight = 240;
    this.pushLogEnabled = false;
    this.ringSound = "sounds/CALL_OUT.ogg";
    this.busySound = "sounds/BUSY.ogg";
    this.registerSound = "sounds/REGISTER.ogg";
    this.finishSound = "sounds/HANGUP.ogg";
    this.messageSound = "sounds/MESSAGE.ogg";
    this.xcapUrl = null;
    this.msrpCallee = null;
    this.subscribeEvent = null;
    this.contactParams = null;
    this.imdnEnabled = false;
    this.msgContentType = "text/plain";
    this.stripCodecs = [];
    this.stunServer = "";
    this.disableLocalRing = false;
    this.modeLT = false;
    this.hangupLT = 0;
    this.answerLT = 0;
    this.callLT = 0;
    this.disableUnknownMsgFiltering = false;
    this.suppressRingOnActiveAudioStream = false;

    $.ajax({
        type: "GET",
        url: "flashphoner.xml",
        dataType: "xml",
        success: this.parseFlashphonerXml,
        context: this
    });
};

Configuration.getInstance = function(configLoadedListener) {
    return new Configuration(configLoadedListener);
};

Configuration.prototype = {

    getText: function (el){
        return el.textContent || el.text || "";
    },

    parseFlashphonerXml: function (xml) {
        var me = this;
        var wcsIP = $(xml).find("wcs_server");
        if (wcsIP.length > 0) {
            this.wcsIP = this.getText(wcsIP[0]);
        } else {
            trace("Can not find 'wcs_server' in flashphoner.xml", 0);
            return;
        }
        var wsPort = $(xml).find("ws_port");
        if (wsPort.length > 0) {
            this.wsPort = this.getText(wsPort[0]);
        }
        var wssPort = $(xml).find("wss_port");
        if (wssPort.length > 0) {
            this.wssPort = this.getText(wssPort[0]);
        }
        var useWss= $(xml).find("use_wss");
        if (useWss.length > 0) {
            this.useWss = "true" == this.getText(useWss[0]);
        }

        var flashPort = $(xml).find("flash_port");
        if (flashPort.length > 0) {
            this.flashPort = this.getText(flashPort[0]);
        }
        var appName = $(xml).find("application");
        if (appName.length > 0) {
            this.appName = this.getText(appName[0]);
        }
        var loadBalancerUrl = $(xml).find("load_balancer_url");
        if (loadBalancerUrl.length > 0) {
            this.loadBalancerUrl = this.getText(loadBalancerUrl[0]);
        }
        var token = $(xml).find("token");
        if (token.length > 0) {
            this.token = this.getText(token[0]);
        }
        var registerRequired = $(xml).find("register_required");
        if (registerRequired.length > 0) {
            this.registerRequired = (this.getText(registerRequired[0]) === "true");
        }

        var useDTLS = $(xml).find("use_dtls");
        if (useDTLS.length > 0) {
            this.useDTLS = (this.getText(useDTLS[0]) === "true");
        }

        var videoWidth = $(xml).find("video_width");
        if (videoWidth.length > 0) {
            this.videoWidth = this.getText(videoWidth[0]);
        }
        var videoHeight = $(xml).find("video_height");
        if (videoHeight.length > 0) {
            this.videoHeight = this.getText(videoHeight[0]);
        }

        var pushLogEnabled = $(xml).find("push_log");
        if (pushLogEnabled.length) {
            this.pushLogEnabled = pushLogEnabled.text();
        }

        //Sounds for WebRTC implementation
        var ringSound = $(xml).find("ring_sound");
        if (ringSound.length > 0) {
            if (this.getText(ringSound[0]).length) {
                this.ringSound = this.getText(ringSound[0]);
            }
        }
        var busySound = $(xml).find("busy_sound");
        if (busySound.length > 0) {
            if (this.getText(busySound[0]).length) {
                this.busySound = this.getText(busySound[0]);
            }
        }
        var registerSound = $(xml).find("register_sound");
        if (registerSound.length > 0) {
            if (this.getText(registerSound[0]).length) {
                this.registerSound = this.getText(registerSound[0]);
            }
        }
        var messageSound = $(xml).find("message_sound");
        if (messageSound.length > 0) {
            if (this.getText(messageSound[0]).length) {
                this.messageSound = this.getText(messageSound[0]);
            }
        }
        var finishSound = $(xml).find("finish_sound");
        if (finishSound.length > 0) {
            if (this.getText(finishSound[0]).length) {
                this.finishSound = this.getText(finishSound[0]);
            }
        }

        var xcapUrl = $(xml).find("xcap_url");
        if (xcapUrl.length > 0) {
            if (this.getText(xcapUrl[0]).length) {
                this.xcapUrl = this.getText(xcapUrl[0]);
            }
        }

        var msrpCallee = $(xml).find("msrp_callee");
        if (msrpCallee.length > 0) {
            if (this.getText(msrpCallee[0]).length) {
                this.msrpCallee = this.getText(msrpCallee[0]);
            }
        }

        var subscribeEvent = $(xml).find("subscribe_event");
        if (subscribeEvent.length > 0) {
            if (this.getText(subscribeEvent[0]).length) {
                this.subscribeEvent = this.getText(subscribeEvent[0]);
            }
        }

        var contactParams = $(xml).find("contact_params");
        if (contactParams.length > 0) {
            if (this.getText(contactParams[0]).length) {
                this.contactParams = this.getText(contactParams[0]);
            }
        }

        var imdnEnabled = $(xml).find("imdn_enabled");
        if (imdnEnabled.length > 0) {
            if (this.getText(imdnEnabled[0]).length) {
                this.imdnEnabled = Boolean(this.getText(imdnEnabled[0]));
            }
        }

        var disableLocalRing = $(xml).find("disable_local_ring");
        if (disableLocalRing.length > 0) {
            if (this.getText(disableLocalRing[0]).length) {
                this.disableLocalRing = Boolean(this.getText(disableLocalRing[0]));
            }
        }
        console.log("disableLocalRing: "+this.disableLocalRing);

        //Message content type by default "text/plain", can be "message/cpim"
        var msgContentType = $(xml).find("msg_content_type");
        if (msgContentType.length > 0) {
            this.msgContentType = msgContentType.text();
            console.log("Message content type: " + this.msgContentType);
        }

        var stripCodecs = $(xml).find("strip_codecs");
        if (stripCodecs.length > 0) {
            var tempCodecs = this.getText(stripCodecs[0]).split(",");
            for (i = 0; i < tempCodecs.length; i++) {
                if (tempCodecs[i].length) this.stripCodecs[i] = tempCodecs[i];
                console.log("Codec " + tempCodecs[i] + " will be removed from SDP!");
            }
        }

        //stun server address
        var stunServer = $(xml).find("stun_server");
        if (stunServer.length > 0) {
            this.stunServer = stunServer.text();
            console.log("Stun server: " + this.stunServer);
        }

        //variable participating in api load, can bee null, webrtc, flash
        var streamingType = $(xml).find("streaming");
        if (streamingType.length > 0) {
            if (streamingType.text() == "webrtc") {
                console.log("Force WebRTC usage!");
                isWebRTCAvailable = true;
            } else if (streamingType.text() == "flash") {
                console.log("Force Flash usage!");
                isWebRTCAvailable = false;
            } else {
                console.log("Bad streaming property " + streamingType.text() +
                    ", can be webrtc or flash. Using default behaviour!")
            }
        }

        //Load Tool mode on/off
        var modeLT = $(xml).find("modeLT");
        if (modeLT.length > 0) {
            if (this.getText(modeLT[0]).length) {
                this.modeLT = Boolean(this.getText(modeLT[0]));
            }
        }

        //call duration in seconds when Load Tool is enabled, callee will hangup after this timeout.
        // Hangup will not occur in case of 0 timeout.
        var hangupLT = $(xml).find("hangupLT");
        if (hangupLT.length > 0) {
            this.hangupLT = this.getText(hangupLT[0]);
        }

        //Answer timeout when Load Tool is enabled, if greater than 0 callee answer the call after specified amount of seconds
        var answerLT = $(xml).find("answerLT");
        if (answerLT.length > 0) {
            this.answerLT = this.getText(answerLT[0]);
        }

        //Recall timeout when Load Tool is enabled, specifies how long caller must wait after hangup to place another call.
        var callLT = $(xml).find("callLT");
        if (callLT.length > 0) {
            this.callLT = this.getText(callLT[0]);
        }

        var disableUnknownMsgFiltering = $(xml).find("disable_unknown_msg_filtering");
        if (disableUnknownMsgFiltering.length > 0) {
            this.disableUnknownMsgFiltering = (this.getText(disableUnknownMsgFiltering[0]) === "true");
        }

        var suppressRingOnActiveAudioStream = $(xml).find("suppress_ring_on_active_audio_stream");
        if (suppressRingOnActiveAudioStream.length > 0) {
            this.suppressRingOnActiveAudioStream = (this.getText(suppressRingOnActiveAudioStream[0]) === "true");
        }

        //get load balancer url if load balancing enabled
        if (me.loadBalancerUrl != null) {
            trace("Configuration - Retrieve server url from load balancer");

            /*
             * this timeout is a workaround to catch errors from ajax request
             * Unfortunately jQuery do not support error callback in case of JSONP
             */
            setTimeout(function () {
                //check status of ajax request
                if (!me.jsonpSuccess) {
                    trace("Configuration - Error occurred while retrieving load balancer data, please check your load balancer url " +
                        me.loadBalancerUrl);
                    me.loadAPI();
                }
            }, 10000)
            var loadBalancerData = null;
            $.ajax({
                type: "GET",
                url: me.loadBalancerUrl,
                dataType: "jsonp",
                data: loadBalancerData,
                success: function (loadBalancerData) {
                    me.wcsIP = loadBalancerData.server;
                    me.wsPort = loadBalancerData.ws;
                    me.wssPort = loadBalancerData.wss;
                    me.flashPort = loadBalancerData.flash;
                    me.jsonpSuccess = true;
                    trace("Configuration - Connection data from load balancer: "
                        + "wcsIP " + loadBalancerData.server
                        + ", wsPort " + loadBalancerData.ws
                        + ", wssPort " + loadBalancerData.wss
                        + ", flashPort " + loadBalancerData.flash);
                    me.loadAPI();
                }
            });
        } else {
            me.loadAPI();
        }
    },

    loadAPI: function () {
        var me = this;
        if (isWebRTCAvailable) {
            me.useWebRTC = true;
            var protocol = "ws://";
            var port = this.wsPort;
            if (this.useWss){
                protocol = "wss://";
                port = this.wssPort;
            }
            me.urlServer = protocol + this.wcsIP + ":" + port;
            me.flashphoner = Flashphoner.getInstance();
            me.flashphoner.init(getElement('localVideoPreview'), getElement('remoteVideo'));
            if (me.stripCodecs.length) me.flashphoner.setStripCodecs(me.stripCodecs);
            if (me.stunServer != "") me.flashphoner.setStunServer(me.stunServer);
            me.flashphoner_UI = new UIManagerWebRtc();
            if (me.modeLT) me.flashphonerListener = new LoadToolListener();
            //todo use events
            me.configLoadedListener.apply(this);
        } else {
            me.useWebRTC = false;
            me.urlServer = "rtmfp://" + this.wcsIP + ":" + this.flashPort + "/" + this.appName;
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
            flashvars.config = "flashphoner.xml";

            if (this.hasFlash()) {
                swfobject.embedSWF("flashphoner_js_api.swf", "videoDiv", "100%", "100%", "11.2.202", "expressInstall.swf", flashvars, params, attributes, function (e) {
                    me.flashphoner = e.ref;
                    me.flashphoner_UI = new UIManagerFlash();
                    if (me.modeLT) me.flashphonerListener = new LoadToolListener();
                });
            } else {
                notifyFlashNotFound();
            }

        }

    },

    hasFlash: function () {
        return swfobject.hasFlashPlayerVersion("11.2");
    },

    getFlashphonerUI: function () {
        return this.flashphoner_UI;
    },

    getFlashphonerListener: function () {
        return this.flashphonerListener;
    },

    getToken: function () {
        return this.token;
    }
};

var SoundControl = function () {
    if ( arguments.callee.instance ) {
        return arguments.callee.instance;
    }
    arguments.callee.instance = this;

    var configuration = Configuration.getInstance();
    me = this;
    //Init sounds
    me.registerSound = me.initSound(configuration.registerSound, false, "auto");
    me.messageSound = me.initSound(configuration.messageSound, false, "auto");
    me.ringSound = me.initSound(configuration.ringSound, true, "none");
    me.busySound = me.initSound(configuration.busySound, false, "none");
    me.finishSound = me.initSound(configuration.finishSound, false, "none");
};

SoundControl.getInstance = function() {
    return new SoundControl();
};

SoundControl.prototype = {

    //Creates HTML5 audio tag
    initSound: function (src, loop, preload) {
        if (typeof loop == 'undefined') {
            loop = false;
        }
        var audioTag = document.createElement("audio");
        audioTag.autoplay = false;
        audioTag.preload = preload;
        if (loop) {
            audioTag.loop = true;
        }
        //add src tag to audio tag
        audioTag.src = src;
        document.body.appendChild(audioTag);
        return audioTag;
    },

    //plays audio
    playSound: function (soundName) {
        switch (soundName) {
            case "RING":
                if (!Configuration.getInstance().disableLocalRing){
                    me.ringSound.play();
                }
                break;
            case "BUSY":
                me.busySound.play();
                break;
            case "REGISTER":
                me.registerSound.play();
                break;
            case "FINISH":
                me.finishSound.play();
                break;
            case "MESSAGE":
                me.messageSound.play();
                break;
            default:
                console.error("Do not know what to play on " + soundName);

        }
    },

    //stops audio
    stopSound: function (soundName) {
        switch (soundName) {
            case "RING":
                if (me.ringSound && !me.ringSound.paused) {
                    me.ringSound.pause();
                    me.ringSound.currentTime = 0;
                }
                break;
            default:
                console.error("Do not know what to stop on " + soundName);

        }
    }
};

var Connection = function () {
    this.login = "";
    this.password = "";
    this.authenticationName = "";
    this.domain = "";
    this.outboundProxy = "";
    this.port = 5060;
    this.useProxy = true;
    this.registerRequired = true;
    this.useDTLS = true;
    this.useSelfSigned = !isMobile.any();
    this.appKey = "defaultVoIPApp";
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

var CallStatus = function(){
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

var WCSEvent = function () {
};
WCSEvent.OnErrorEvent = "ON_ERROR_EVENT";
WCSEvent.ConnectionStatusEvent = "CONNECTION_STATUS_EVENT";
WCSEvent.OnRegistrationEvent = "ON_REGISTRATION_EVENT";
WCSEvent.OnCallEvent = "ON_CALL_EVENT";
WCSEvent.CallStatusEvent = "CALL_STATUS_EVENT";
WCSEvent.OnMessageEvent = "ON_MESSAGE_EVENT";
WCSEvent.MessageStatusEvent = "MESSAGE_STATUS_EVENT";
WCSEvent.OnRecordCompleteEvent = "ON_RECORD_COMPLETE_EVENT";
WCSEvent.OnSubscriptionEvent = "ON_SUBSCRIPTION_EVENT";
WCSEvent.OnXcapStatusEvent = "ON_XCAP_STATUS_EVENT";
WCSEvent.OnBugReportEvent = "ON_BUG_REPORT_EVENT";

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

    add: function (data) {
        this.data[data.id] = data;
    },

    update: function (data) {
        this.data[data.id] = data;
    },

    get: function (id) {
        return this.data[id];
    },

    remove: function (id) {
        this.data[id] = undefined;
    },

    getSize: function () {
        return Object.size(this.data);
    },

    array: function () {
        var callArray = [];
        for (var o in this.data) {
            callArray.push(this.data[o]);
        }
        return callArray;
    }
};

var DefaultListener = function () {

};

DefaultListener.prototype = {
    onCall: function () {
        trace("DefaultListener: onCall");
    },

    onIncomingCall: function (callId) {
        trace("DefaultListener: onIncomingCall");
    },

    onAnswer: function (callId) {
        trace("DefaultListener: onAnswer");
    },

    onError: function () {
        trace("DefaultListener: onError");
    },

    onHangup: function () {
        trace("DefaultListener: onHangup");
    },

    onRegistered: function () {
        trace("DefaultListener: onRegistered");
    },

    onRemoveCall: function () {
        trace("DefaultListener: onRemoveCall");
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

    var console = $("#console");

    // Check if console is scrolled down? Or may be you are reading previous messages.
    var isScrolled = (console[0].scrollHeight - console.height() + 1) / (console[0].scrollTop + 1 + 37);

    var logMessage = time + ' - ' + logMessage;

    //check if push_log enabled
    if (Configuration.getInstance().pushLogEnabled) {
        var result = flashphoner.pushLogs(logs + logMessage + '\n');
        if (!result) {
            logs += logMessage + '\n';
        } else {
            logs = "";
        }
    } else {
        logs = "";
    }

    console.append(logMessage + '<br>');
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

    if(typeof(mozRTCPeerConnection) === undefined) {
        console.log("Please, update your browser to use WebRTC");
    } else {
        isWebRTCAvailable = true;

        webrtcDetectedBrowser = "firefox";

        RTCPeerConnection = mozRTCPeerConnection;

        RTCSessionDescription = mozRTCSessionDescription;

        RTCIceCandidate = mozRTCIceCandidate;

        getUserMedia = navigator.mozGetUserMedia.bind(navigator);

        attachMediaStream = function(element, stream) {
            element.mozSrcObject = stream;
            element.play();
        };

        reattachMediaStream = function(to, from) {
            to.mozSrcObject = from.mozSrcObject;
            to.play();
        };

        MediaStream.prototype.getVideoTracks = function() {
            return [];
        };

        MediaStream.prototype.getAudioTracks = function() {
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

        attachMediaStream = function(element, stream) {
            element.src = webkitURL.createObjectURL(stream);
            element.play();
        };

        reattachMediaStream = function(to, from) {
            to.src = from.src;
            element.play();
        };

        if (!webkitMediaStream.prototype.getVideoTracks) {
            webkitMediaStream.prototype.getVideoTracks = function() {
                return this.videoTracks;
            };
        }

        if (!webkitMediaStream.prototype.getAudioTracks) {
            webkitMediaStream.prototype.getAudioTracks = function() {
                return this.audioTracks;
            };
        }
    }
} else {
    console.log("Browser does not appear to be WebRTC-capable");
}
