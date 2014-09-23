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
    this.messenger = new Messenger();
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

var Messenger = function () {

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


