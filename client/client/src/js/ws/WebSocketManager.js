var WebSocketManager = function (localVideoPreview, remoteVideo) {
    var me = this;
    me.calls = [];
    me.isOpened = false;
    me.configLoaded = false;
    me.webRtcMediaManager = new WebRtcMediaManager(localVideoPreview, remoteVideo);
    me.soundControl = new SoundControl();
    me.stripCodecs = new Array();

    var rtcManager = this.webRtcMediaManager;
    var proccessCall = function (call) {
        for (var i in me.calls) {
            if (call.id == me.calls[i].id) {
                me.calls[i] = call;
                return;
            }
        }
        me.calls.push(call);
        notifyAddCall(call);
    };

    var getCall = function (callId) {
        for (var i in me.calls) {
            if (callId == me.calls[i].id) {
                return me.calls[i];
            }
        }
    };

    var removeCall = function (callId) {
        for (var i in me.calls) {
            if (callId == me.calls[i].id) {
                me.calls.splice(i, 1);
            }
        }
        if (me.calls.length == 0) {
            rtcManager.close();
        }
    };

    this.callbacks = {
        ping: function () {
            me.webSocket.send("pong");
        },

        getUserData: function (user) {
            me.user = user;
            notifyRegisterRequired(user.regRequired);
            notifyConnected();
        },

        getVersion: function (version) {
            notifyVersion(version);
        },

        registered: function (sipHeader) {
            notifyRegistered(sipHeader);
        },

        notifyTryingResponse: function (call, sipHeader) {
            trace("notifyTryingResponse call.id:" + call.id);
            proccessCall(call);
        },

        ring: function (call, sipHeader) {
            trace("ring call.state: "+call.state+" call.id: "+call.id);
            proccessCall(call);
            notify(call);
        },

        sessionProgress: function (call, sipHeader) {
            trace("sessionProgress call.state: "+call.state+" call.id: "+call.id )
            proccessCall(call);
            notify(call);
        },

        setRemoteSDP: function (call, sdp, isInitiator, sipHeader) {
            proccessCall(call);
            this.stopSound("RING");
            rtcManager.setRemoteSDP(sdp, isInitiator);
            if (!isInitiator && rtcManager.getConnectionState() == "established") {
                me.answer(call.id);
            }
        },

        talk: function (call, sipHeader) {
            proccessCall(call);
            notify(call);
        },

        hold: function (call, sipHeader) {
            proccessCall(call);
            notify(call);
        },

        callbackHold: function (callId, isHold) {
            var call = getCall(callId);
            notifyCallbackHold(call, isHold);
        },

        finish: function (call, sipHeader) {
            proccessCall(call);
            notify(call);
            notifyRemoveCall(call);
            removeCall(call.id);
        },

        busy: function (call, sipHeader) {
            proccessCall(call);
            notify(call);
        },

        fail: function (errorCode, sipHeader) {
            notifyError(errorCode);
        },

        notifyVideoFormat: function (videoFormat) {
            //notifyVideoFormat(videoFormat);
        },
        
        notifyBugReport: function (filename) {
            notifyBugReport(filename);
        },

        notifyMessage: function (message, notificationResult, sipObject) {
            messenger.notifyMessage(message, notificationResult, sipObject);
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


};

WebSocketManager.prototype = {

    login: function (loginObject, WCSUrl) {
        var me = this;
        me.webSocket = $.websocket(WCSUrl, {
            open: function () {
                me.isOpened = true;
                me.webSocket.send("connect", loginObject);
            },
            close: function (event) {
                me.isOpened = false;
                if (!event.originalEvent.wasClean) {
                    notifyError(CONNECTION_ERROR);
                }
                notifyCloseConnection();
                me.webRtcMediaManager.close();
            },
            error: function () {
            },
            context: me,
            events: me.callbacks
        });
        return 0;
    },

    loginByToken: function (WCSUrl, token, pageUrl) {
        var me = this;
        var obj = {};
        obj.token = token;
        obj.pageUrl = pageUrl;

        me.login(obj, WCSUrl);
        return 0;
    },

    callByToken: function (callRequest) {
        var me = this;
        openInfoView("Configuring WebRTC connection...", 0);
        this.webRtcMediaManager.createOffer(function (sdp) {
            closeInfoView();
            callRequest.sdp = sdp;
            me.webSocket.send("call", callRequest);
        }, false);
        return 0;

    },

    logoff: function () {
        trace("WebSocketManager - logoff");
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
        openInfoView("Configuring WebRTC connection...", 0, 60);
        this.webRtcMediaManager.createOffer(function (sdp) {
            closeInfoView();
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

    setSendVideo: function (callId, hasVideo) {
//        var me = this;
//        this.webRtcMediaManager.createOffer(function (sdp) {
//            me.webSocket.send("changeMediaRequest", {callId: callId, sdp: sdp});
//        }, hasVideo);
//        return 0;
    },

    answer: function (callId, hasVideo) {
        var me = this;
        openInfoView("Configuring WebRTC connection...", 0, 60);
        /**
         * If we receive INVITE without SDP, we should send answer with SDP based on webRtcMediaManager.createOffer because we do not have remoteSdp here
         */
        if (this.webRtcMediaManager.lastReceivedSdp !== null && this.webRtcMediaManager.lastReceivedSdp.length == 0) {
            this.webRtcMediaManager.createOffer(function (sdp) {
                closeInfoView();
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
                closeInfoView();
                me.webSocket.send("answer", {callId: callId, hasVideo: hasVideo, sdp: sdp});
            }, hasVideo);
        }
    },

    hangup: function (callId) {
        if (callId) {
            this.webSocket.send("hangup", callId);
        }
    },

    setStatusHold: function (callId, isHold) {
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
            this.webSocket.send("pushLogs", logs)
            return true;
        } else {
            return false;
        }
    },

    submitBugReport: function (reportObject) {
        if (this.isOpened) {
            this.webSocket.send("submitBugReport", reportObject)
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

    hasActiveAudioStream: function(){
        return this.webRtcMediaManager.hasActiveAudioStream();
    },

    getInfoAboutMe: function () {
        return this.user;
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
    },

    setCookie: function (c_name, value) {
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + 100);
        var c_value = escape(value) + "; expires=" + exdate.toUTCString();
        document.cookie = c_name + "=" + c_value;
    },

    playSound: function (sound) {
        this.soundControl.playSound(sound);
    },

    stopSound: function (sound) {
        this.soundControl.stopSound(sound);
    },

    sendMessage: function (message) {
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
                    	    if ( m < mLineSplitted.length-1 ){
                    		newMLine = newMLine + " ";            
                    	    }
                        }                        
                    }
                    sdpArray[i]=newMLine;
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

