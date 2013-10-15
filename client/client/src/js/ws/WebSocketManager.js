var WebSocketManager = function (localVideoPreview, remoteVideo) {
    var me = this;
    me.calls = [];
    me.isOpened = false;
    me.configLoaded = false;
    me.webRtcMediaManager = new WebRtcMediaManager(localVideoPreview, remoteVideo);
    me.soundControl = new SoundControl();
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
        getUserData: function (user) {
            me.user = user;
            notifyRegisterRequired(user.regRequired);
            notifyConnected();
        },

        getVersion: function (version) {
            notifyVersion(version);
        },

        registered: function (sipHeader) {
            notifyRegistered();
        },

        ring: function (call, sipHeader) {
            proccessCall(call);
            notify(call);
        },

        sessionProgress: function (call, sipHeader) {
            proccessCall(call);
        },

        setRemoteSDP: function (call, sdp, isInitiator, sipHeader) {
            proccessCall(call);
            //this.stopSound("RING");
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

        notifyMessage: function (message, notificationResult, sipObject) {
            messenger.notifyMessage(message, notificationResult, sipObject);
        },

        notifyAudioCodec: function (codec) {
        },

        notifySubscription: function (subscriptionObject, sipObject){
            notifySubscription(subscriptionObject, sipObject);
        },

        notifyXcapResponse: function (xcapResponse){
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
        trace("logoff");
        this.webSocket.close();
    },

    subscribe: function (subscribeObject) {
        this.webSocket.send("subscribe",subscribeObject);
    },

    sendXcapRequest: function (xcapUrl) {
        this.webSocket.send("sendXcapRequest",xcapUrl);
    },

    call: function (callRequest) {
        var me = this;
        openInfoView("Configuring WebRTC connection...", 0, 60);
        this.webRtcMediaManager.createOffer(function (sdp) {
            closeInfoView();
            callRequest.sdp = sdp;
            me.webSocket.send("call", callRequest);
        }, false);
        return 0;
    },

    msrpCall: function (callRequest){
        var me = this;
        me.webSocket.send("msrpCall", callRequest);
        return 0;
    },

    setSendVideo: function (callId, hasVideo) {
        var me = this;
        this.webRtcMediaManager.createOffer(function (sdp) {
            me.webSocket.send("changeMediaRequest", {callId: callId, sdp: sdp});
        }, hasVideo);
        return 0;
    },

    answer: function (callId) {
        var me = this;
        openInfoView("Configuring WebRTC connection...", 0, 60);
        this.webRtcMediaManager.createAnswer(function (sdp) {
                closeInfoView();
                me.webSocket.send("answer", {callId: callId, sdp: sdp});
            }
        );
    },

    hangup: function (callId) {
        if (callId){
            this.webSocket.send("hangup", callId);
        } else {
            if (this.calls.length == 0) {
                closeInfoView();
                toCallState();
                this.webRtcMediaManager.close();
            }
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
        if(this.isOpened) {
            this.webSocket.send("pushLogs", logs)
            return true;
        } else {
            return false;
        }
    },

    getAccessToAudio: function () {
        this.webRtcMediaManager.getAccessToAudio();
    },

    getAccessToVideo: function () {
        this.webRtcMediaManager.getAccessToVideo();
    },

    getVolume: function () {
        return this.webRtcMediaManager.remoteVideo.volume * 100;
    },

    setVolume:function(value){
        this.webRtcMediaManager.remoteVideo.volume = value / 100;
    },


    hasAccessToAudio: function () {
        return this.webRtcMediaManager.isAudioMuted;
    },


    hasAccessToVideo: function () {
        return this.webRtcMediaManager.isVideoMuted;
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
        this.webSocket.send("sendInstantMessage",message);
    },

    notificationResult: function (result) {
        this.webSocket.send("notificationResult",result);
    }

};
