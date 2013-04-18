var WebRtcMediaManager = function (localVideoPreview, remoteVideo, hasVideo) {
    var me = this;

    me.peerConnection = null;
    me.peerConnectionState = 'new';
    me.remoteAudioVideoMediaStream = null;
    me.remoteVideo = remoteVideo;

    function gotLocalAudioVideoStream(localStream) {
        me.localAudioVideoMediaStream = localStream;
        localVideoPreview.src = webkitURL.createObjectURL(localStream);
        localVideoPreview.play();

    }

    function gotLocalAudioVideoFailed(error) {
        addLogMessage("Failed to get access to local media. Error code was " + error.code + ".");
    }

    navigator.webkitGetUserMedia({audio: true, video: true}, gotLocalAudioVideoStream, gotLocalAudioVideoFailed);
};

WebRtcMediaManager.prototype.close = function () {
    if (this.peerConnection) {
        this.remoteVideo.pause();
        this.remoteVideo.src = null;
        this.peerConnection.close();
    }
    this.peerConnection = null;
    this.peerConnectionState = 'new';
    this.remoteAudioVideoMediaStream = null;
};


WebRtcMediaManager.prototype.createPeerConnection = function () {
    console.debug("WebRtcMediaManager:createPeerConnection()");
    var application = this;
    this.peerConnection = new webkitRTCPeerConnection({"iceServers": [
        {"url": "stun:stun.l.google.com:19302"}
    ]}, {"optional": [
        {"DtlsSrtpKeyAgreement": true}
    ]});

    this.peerConnection.onaddstream = function (event) {
        application.onOnAddStreamCallback(event);
    };

    this.peerConnection.onremovestream = function (event) {
        application.onOnRemoveStreamCallback(event);
    };

    this.peerConnection.onicecandidate = function (rtcIceCandidateEvent) {
        application.onIceCandidateCallback(rtcIceCandidateEvent);
    };
};

WebRtcMediaManager.prototype.onOnAddStreamCallback = function (event) {
    console.debug("WebRtcMediaManager:onOnAddStreamCallback(): event=" + event);

    if (this.peerConnection != null) {
        this.remoteAudioVideoMediaStream = event.stream;
        var url = webkitURL.createObjectURL(this.remoteAudioVideoMediaStream);
        console.debug("WebRtcMediaManager:onOnAddStreamCallback():url=" + url);
        this.remoteVideo.src = url;
        this.remoteVideo.play();
        this.remoteVideo.style.visibility = "visible";
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
        this.remoteVideo.src = null;
        this.remoteVideo.style.visibility = "hidden";
    } else {
        console.warn("SimpleWebRtcSipPhone:onOnRemoveStreamCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onIceCandidateCallback = function (rtcIceCandidateEvent) {
    if (this.peerConnection != null) {
        if (rtcIceCandidateEvent.candidate == null) {
            if (this.peerConnectionState == 'preparing-offer') {
                this.peerConnectionState = 'offer-sent';
                this.createCallFn(this.peerConnection.localDescription.sdp);// + this.candidates);
            }
            else if (this.peerConnectionState == 'preparing-answer') {
                this.peerConnectionState = 'established';
                this.answerCallFn(this.peerConnection.localDescription.sdp);// + this.candidates);
            }
            else if (this.peerConnectionState == 'established') {
            }
            else {
                console.log("WebRtcMediaManager:onIceCandidateCallback(): RTCPeerConnection bad state!");
            }
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onIceCandidateCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.createOffer = function (createCallFn) {
    console.debug("WebRtcMediaManager:createOffer()");
    try {
        this.createPeerConnection();
        this.peerConnection.addStream(this.localAudioVideoMediaStream);
        this.createCallFn = createCallFn;
        var application = this;
        this.peerConnection.createOffer(function (offer) {
            application.onCreateOfferSuccessCallback(offer);
        }, function (error) {
            application.onCreateOfferErrorCallback(error);
        }, {"optional": [], "mandatory": {"OfferToReceiveAudio": true, "OfferToReceiveVideo": true}});
    }
    catch (exception) {
        console.error("WebRtcMediaManager:createOffer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.createAnswer = function (answerCallFn) {
    console.debug("WebRtcMediaManager:createAnswer()");
    try {
        this.createPeerConnection();
        this.peerConnection.addStream(this.localAudioVideoMediaStream);
        this.answerCallFn = answerCallFn;
        var application = this;
        var sdpOffer = new RTCSessionDescription({
            type: 'offer',
            sdp: application.lastReceivedSdp
        });
        console.debug("WebRtcMediaManager:setRemoteSDP: offer=" + JSON.stringify(sdpOffer));
        this.peerConnectionState = 'offer-received';
        this.peerConnection.setRemoteDescription(sdpOffer, function () {
            application.onSetRemoteDescriptionSuccessCallback();
        }, function (error) {
            application.onSetRemoteDescriptionErrorCallback(error);
        });
    }
    catch (exception) {
        console.error("MobicentsWebRTCPhone:createAnswer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.onCreateOfferSuccessCallback = function (offer) {
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'new') {
            var application = this;
            this.peerConnectionState = 'preparing-offer';

            this.peerConnection.setLocalDescription(offer, function () {
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


WebRtcMediaManager.prototype.setRemoteSDP = function (sdp, isInitiator) {
    console.debug("WebRtcMediaManager:setRemoteSDP()");
    if (isInitiator) {
        var sdpAnswer = new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
        });
        var application = this;
        this.peerConnectionState = 'answer-received';
        console.debug("WebRtcMediaManager:setRemoteSDP: answer=" + JSON.stringify(sdpAnswer));
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
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'answer-received') {
            this.peerConnectionState = 'established';
        }
        else if (this.peerConnectionState == 'offer-received') {
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
            console.log("MobicentsWebRTCPhone:onSetRemoteDescriptionSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onSetRemoteDescriptionSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaManager.prototype.onCreateAnswerSuccessCallback = function (answer) {
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'offer-received') {
            // Prepare answer.
            var application = this;
            this.peerConnectionState = 'preparing-answer';
            this.peerConnection.setLocalDescription(answer, function () {
            }, function (error) {
                application.onSetLocalDescriptionErrorCallback(error);
            });
        }
        else {
            console.log("MobicentsWebRTCPhone:onCreateAnswerSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateAnswerSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


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
