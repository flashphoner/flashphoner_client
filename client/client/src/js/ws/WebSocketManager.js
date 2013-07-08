var WebSocketManager = function (url, localVideoPreview, remoteVideo) {
    var me = this;
    me.url = url;
    me.calls = [];
    me.isOpened = false;
    me.configLoaded = false;
    me.webRtcMediaManager = new WebRtcMediaManager(localVideoPreview, remoteVideo);
    me.soundControl = new SoundControl();
    me.messenger = new Messenger(this);
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
                me.calls.splice(i,1);
            }
        }
        if (me.calls.length == 0){
            rtcManager.close();
        }
    };

    this.callbacks = {
        getUserData: function (user) {
            me.user = user;
            notifyRegisterRequired(user.regRequired);
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
            rtcManager.setRemoteSDP(sdp, isInitiator);
            if (!isInitiator && rtcManager.getConnectionState() == "established") {
                me.answer(call.id, true);
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

        notifyVideoFormat: function (call) {
            proccessCall(call);
            //notifyVideoFormat(call);
        },

        notifyMessage: function (message, notificationResult, sipObject) {
            me.messenger.notifyMessage(message, notificationResult, sipObject);
        },

        notifyAudioCodec: function (codec) {
        }
    };


};

WebSocketManager.prototype = {

    login: function (loginObject) {
        var me = this;
        me.webSocket = $.websocket(me.url, {
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

    logoff: function () {
        this.webSocket.close();
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

    setSendVideo: function (callId, hasVideo) {
        var me = this;
        this.webRtcMediaManager.createOffer(function (sdp) {
            me.webSocket.send("changeMediaRequest", {callId: callId, sdp: sdp});
        }, hasVideo);
        return 0;
    },

    answer: function (callId, hasAudio) {
        var me = this;
        openInfoView("Configuring WebRTC connection...", 0, 60);
        this.webRtcMediaManager.createAnswer(function (sdp) {
            closeInfoView();
            me.webSocket.send("answer", {callId: callId, sdp: sdp});
        }, hasAudio);
    },

    hangup: function (callId) {
        this.webSocket.send("hangup", callId);
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

    viewVideo: function () {
        this.webRtcMediaManager.viewVideo();
    },

    viewAccessMessage: function () {

    },

    isMuted: function () {
        return -1;
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
        this.messenger.sendMessage(message);
    }

};
