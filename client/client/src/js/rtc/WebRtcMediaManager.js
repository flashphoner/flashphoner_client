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
    console.debug("WebRtcMediaManager.init");
    var me = this;

    me.hasVideo = false;
    this.peerConnection = null;
    this.peerConnectionState = 'new';
    this.remoteAudioVideoMediaStream = null;
};

WebRtcMediaManager.prototype.close = function () {
    //Commented to prevent termination of rtcMediaManager after MSRP call
    console.debug("WebRtcMediaManager:close()");
    if (this.peerConnectionState != 'finished') {
        this.peerConnectionState = 'finished';
        if (this.peerConnection) {
            console.debug("WebRtcMediaManager:PeerConnection will be closed");
            this.peerConnection.close();
            this.remoteVideo.pause();
            this.remoteVideo.src = null;
        }
    } else {
        console.log("peerConnection already closed, do nothing!");
    }
};


WebRtcMediaManager.prototype.createPeerConnection = function () {
    console.debug("WebRtcMediaManager:createPeerConnection()");
    var application = this;
    if (webrtcDetectedBrowser == "firefox") {
        pc_config = {"iceServers": [
            {"url": "stun:" + application.stunServer}
        ]};
    } else {
        pc_config = {"iceServers": [
            {"url": "stun:" + application.stunServer}
        ]};
    }
    this.peerConnection = new RTCPeerConnection(pc_config, {"optional": [
        {"DtlsSrtpKeyAgreement": false}
    ]});

    this.peerConnection.onaddstream = function (event) {
        application.onOnAddStreamCallback(event);
    };


    this.peerConnection.onremovestream = function (event) {
        application.onOnRemoveStreamCallback(event);
    };
};

WebRtcMediaManager.prototype.onOnAddStreamCallback = function (event) {
    console.debug("WebRtcMediaManager:onOnAddStreamCallback(): event=" + event);
    console.debug("WebRtcMediaManager:onOnAddStreamCallback(): event=" + event.stream);
    console.debug("WebRtcMediaManager:onOnAddStreamCallback(): event=" + this.remoteVideo);
    if (this.peerConnection != null) {
        this.remoteAudioVideoMediaStream = event.stream;
        attachMediaStream(this.remoteVideo, this.remoteAudioVideoMediaStream);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onOnAddStreamCallback(): this.peerConnection is null, bug in state machine!, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onOnRemoveStreamCallback = function (event) {
    console.debug("WebRtcMediaManager:onOnRemoveStreamCallback(): event=" + event);
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
                console.debug("WebRtcMediaManager:waitGatheringIce() iceGatheringState=" + me.peerConnection.iceGatheringState);
                if (me.peerConnection.iceGatheringState == "complete") {
                    console.debug("WebRtcMediaManager:setLocalSDP: sdp=" + me.peerConnection.localDescription.sdp);
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
                        console.log("WebRtcMediaManager:onIceCandidateCallback(): RTCPeerConnection bad state!");
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
        console.warn("WebRtcMediaManager:onIceCandidateCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.getAccessToAudioAndVideo = function () {
    var me = this;
    if (!me.localAudioVideoStream) {
        getUserMedia({audio: true, video: true}, function (stream) {
                me.localAudioVideoStream = stream;
                me.isAudioMuted = -1;
                me.isVideoMuted = -1;
            }, function (error) {
                addLogMessage("Failed to get access to local media. Error code was " + error.code + ".");
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
                addLogMessage("Failed to get access to local media. Error code was " + error.code + ".");
                closeInfoView(3000);
                me.isAudioMuted = 1;
            }
        );
    }
};

WebRtcMediaManager.prototype.getAccessToVideo = function () {
    var me = this;
    if (!me.localVideoStream) {
        getUserMedia({video: true}, function (stream) {
            attachMediaStream(me.localVideo, stream);
            me.localVideoStream = stream;
            me.isVideoMuted = -1;
        }, function (error) {
            addLogMessage("Failed to get access to local media. Error code was " + error.code + ".");
            me.isVideoMuted = 1;
        });
    }
};

WebRtcMediaManager.prototype.createOffer = function (createOfferCallback, hasVideo) {
    console.debug("WebRtcMediaManager:createOffer()");
    var me = this;
    try {
        if (me.getConnectionState() != "established") {
            console.debug("Connection state is not established. Initializing...");
            me.init();
        }
        if (me.peerConnection == null) {
            console.debug("peerConnection is null");
            me.createPeerConnection();
            if (hasVideo) {
                me.peerConnection.addStream(me.localAudioStream);
            } else {
                me.peerConnection.addStream(me.localAudioVideoStream);
            }
        }
        me.createOfferCallback = createOfferCallback;
        me.peerConnection.createOffer(function (offer) {
            me.onCreateOfferSuccessCallback(offer);
        }, function (error) {
            me.onCreateOfferErrorCallback(error);
        }, {"optional": [], 'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': true }});

    }
    catch (exception) {
        console.error("WebRtcMediaManager:createOffer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.createAnswer = function (createAnswerCallback, hasVideo) {
    var me = this;
    console.debug("WebRtcMediaManager:createAnswer() me.getConnectionState(): "+me.getConnectionState()+" me.hasVideo: "+me.hasVideo);
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
        console.error("WebRtcMediaManager:createAnswer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.onCreateOfferSuccessCallback = function (offer) {
    console.debug("onCreateOfferSuccessCallback this.peerConnection: "+this.peerConnection+" this.peerConnectionState: "+this.peerConnectionState);
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
            console.error("WebRtcMediaManager:onCreateOfferSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateOfferSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onSetLocalDescriptionSuccessCallback = function (sdp) {
    console.debug("onSetLocalDescriptionSuccessCallback");
    if (webrtcDetectedBrowser == "firefox") {
        console.debug("WebRtcMediaManager:onSetLocalDescriptionSuccessCallback: sdp=" + sdp);
        if (this.peerConnectionState == 'preparing-offer') {
            console.debug("Current PeerConnectionState is 'preparing-offer' sending offer...");
            this.peerConnectionState = 'offer-sent';
            this.createOfferCallback(sdp);
        }
        else if (this.peerConnectionState == 'preparing-answer') {
            console.debug("Current PeerConnectionState is 'preparing-answer' going to established...");
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
    console.debug("WebRtcMediaManager:setRemoteSDP: isInitiator: "+isInitiator+" sdp=" + sdp);
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
    console.debug("onSetRemoteDescriptionSuccessCallback");
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'answer-received') {
            console.debug("Current PeerConnectionState is 'answer-received' changing the PeerConnectionState to 'established'");
            this.peerConnectionState = 'established';
        }
        else if (this.peerConnectionState == 'offer-received') {
            console.debug("Current PeerConnectionState is 'offer-received' creating appropriate answer...");
            var application = this;
            this.peerConnection.createAnswer(function (answer) {
                application.onCreateAnswerSuccessCallback(answer);
            }, function (error) {
                application.onCreateAnswerErrorCallback(error);
            }, {'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': true }});
        }
        else {
            console.log("WebRtcMediaManager:onSetRemoteDescriptionSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onSetRemoteDescriptionSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaManager.prototype.onCreateAnswerSuccessCallback = function (answer) {
    console.debug("onCreateAnswerSuccessCallback "+this.peerConnection);
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'offer-received') {
            console.debug("Current PeerConnectionState is 'offer-received', preparing answer...");
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
            console.log("WebRtcMediaManager:onCreateAnswerSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateAnswerSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.setStunServer = function (server) {
    this.stunServer = server;
}

WebRtcMediaManager.prototype.onCreateAnswerErrorCallback = function (error) {
    console.error("WebRtcMediaManager:onCreateAnswerErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onCreateOfferErrorCallback = function (error) {
    console.error("WebRtcMediaManager:onCreateOfferErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onSetLocalDescriptionErrorCallback = function (error) {
    console.error("WebRtcMediaManager:onSetLocalDescriptionErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onSetRemoteDescriptionErrorCallback = function (error) {
    console.error("WebRtcMediaManager:onSetRemoteDescriptionErrorCallback(): error: " + error);
};
