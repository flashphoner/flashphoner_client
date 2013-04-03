var WebRtcMediaManager = function (localVideoPreview, remoteVideo, hasVideo) {
    var me = this;
    me.INITIAL_STATE = "INITIAL_STATE";

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


WebRtcMediaManager.prototype.createPeerConnection = function () {
    console.debug("WebRtcMediaManager:createPeerConnection()");
    var application = this;
    this.peerConnection = new webkitRTCPeerConnection({"iceServers": [
        {"url": "stun:stun.l.google.com:19302"}
    ]}, {"optional":[{"DtlsSrtpKeyAgreement":true}]});

    this.peerConnection.onaddstream = function (event) {
        application.onPeerConnectionOnAddStreamCallback(event);
    };

    this.peerConnection.onremovestream = function (event) {
        application.onPeerConnectionOnRemoveStreamCallback(event);
    };

    this.peerConnection.onopen = function (event) {
        application.onPeerConnectionOnOpenCallback(event);
    };

    this.peerConnection.onstatechange = function (event) {
        application.onPeerConnectionStateChangeCallback(event);
    };

    this.peerConnection.onicecandidate = function (rtcIceCandidateEvent) {
        application.onPeerConnectionIceCandidateCallback(rtcIceCandidateEvent);
    };

    this.peerConnection.onnegotationneeded = function (event) {
        application.onPeerConnectionIceNegotationNeededCallback(event);
    };

    this.peerConnection.ongatheringchange = function (event) {
        application.onPeerConnectionGatheringChangeCallback(event);
    };

    this.peerConnection.onicechange = function (event) {
        application.onPeerConnectionIceChangeCallback(event);
    };

    this.peerConnection.onidentityresult = function (event) {
        application.onPeerConnectionIdentityResultCallback(event);
    };
};

WebRtcMediaManager.prototype.onPeerConnectionOnAddStreamCallback = function (event) {
    console.debug("WebRtcMediaManager:onPeerConnectionOnAddStreamCallback(): event=" + event);

    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionOnAddStreamCallback():this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnAddStreamCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnAddStreamCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnAddStreamCallback: this.peerConnectionState=" + this.peerConnectionState);

        this.remoteAudioVideoMediaStream = event.stream;
        var url = webkitURL.createObjectURL(this.remoteAudioVideoMediaStream);
        console.debug("WebRtcMediaManager:onPeerConnectionOnAddStreamCallback():url=" + url);
        this.remoteVideo.src = url;
        this.remoteVideo.play();
        this.remoteVideo.style.visibility = "visible";
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionOnAddStreamCallback(): this.peerConnection is null, bug in state machine!, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionOnRemoveStreamCallback = function (event) {
    console.debug("WebRtcMediaManager:onPeerConnectionOnRemoveStreamCallback(): event=" + event);
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionOnRemoveStreamCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnRemoveStreamCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnRemoveStreamCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnRemoveStreamCallback: this.peerConnectionState=" + this.peerConnectionState);

        this.remoteAudioVideoMediaStream = null;
        this.remoteVideo.pause();
        this.remoteVideo.src = null;
        this.remoteVideo.style.visibility = "hidden";
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionOnRemoveStreamCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionOnOpenCallback = function (event) {
    console.debug("WebRtcMediaManager:onPeerConnectionOnOpenCallback(): event=" + event);

    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionOnOpenCallback():this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnOpenCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnOpenCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionOnOpenCallback: this.peerConnectionState=" + this.peerConnectionState);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionOnOpenCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionStateChangeCallback = function (event) {
    console.debug("WebRtcMediaManager:onPeerConnectionStateChangeCallback(): event=" + event);
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionStateChangeCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionStateChangeCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionStateChangeCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionStateChangeCallback: this.peerConnectionState=" + this.peerConnectionState);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionStateChangeCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionIceCandidateCallback = function (rtcIceCandidateEvent) {
    console.debug("WebRtcMediaManager:onPeerConnectionIceCandidateCallback(): rtcIceCandidateEvent=" + rtcIceCandidateEvent);
    console.debug("WebRtcMediaManager:onPeerConnectionIceCandidateCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
    console.debug("WebRtcMediaManager:onPeerConnectionIceCandidateCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
    console.debug("WebRtcMediaManager:onPeerConnectionIceCandidateCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
    console.debug("WebRtcMediaManager:onPeerConnectionIceCandidateCallback: this.peerConnectionState=" + this.peerConnectionState);

    if (this.peerConnection != null) {
        if (rtcIceCandidateEvent.candidate != null) {
            console.debug("WebRtcMediaManager:onPeerConnectionIceCandidateCallback: RTCIceCandidateEvent.candidate.candidate=" + rtcIceCandidateEvent.candidate.candidate);
            this.candidates += rtcIceCandidateEvent.candidate.candidate + "\r\n";
        }
        else {
            console.debug("WebRtcMediaManager:onPeerConnectionIceCandidateCallback: no anymore ICE candidate");
            if (this.peerConnectionState == 'preparing-offer') {
                this.peerConnectionState = 'offer-sent';
                this.createCallFn(this.peerConnection.localDescription.sdp);// + this.candidates);
            }
            else if (this.peerConnectionState == 'preparing-answer') {
                this.peerConnectionState = 'established';
                this.answerCallFn(this.peerConnection.localDescription.sdp);// + this.candidates);
            }
            else if (this.peerConnectionState == 'established') {
                // Why this last ice candidate event
            }
            else {
                console.log("WebRtcMediaManager:onPeerConnectionIceCandidateCallback(): RTCPeerConnection bad state!");
            }
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionIceCandidateCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionIceNegotationNeededCallback = function (event) {
    console.debug("WebRtcMediaManager:onPeerConnectionIceNegotationNeededCallback():event=" + event);
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionIceNegotationNeededCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionIceNegotationNeededCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionIceNegotationNeededCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionIceNegotationNeededCallback: this.peerConnectionState=" + this.peerConnectionState);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionIceNegotationNeededCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionGatheringChangeCallback = function (event) {
    console.debug("WebRtcMediaManager:onPeerConnectionGatheringChangeCallback():event=" + event);
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionGatheringChangeCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionGatheringChangeCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionGatheringChangeCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionGatheringChangeCallback: this.peerConnectionState=" + this.peerConnectionState);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionGatheringChangeCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionIceChangeCallback = function (event) {
    console.debug("WebRtcMediaManager:onPeerConnectionIceChangeCallback():event=" + event);
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionIceChangeCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionIceChangeCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionIceChangeCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionIceChangeCallback: this.peerConnectionState=" + this.peerConnectionState);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionIceChangeCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionIdentityResultCallback = function (event) {
    console.debug("WebRtcMediaManager:onPeerConnectionIdentityResultCallback():event=" + event);
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionIdentityResultCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionIdentityResultCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionIdentityResultCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionIdentityResultCallback: this.peerConnectionState=" + this.peerConnectionState);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionIdentityResultCallback(): this.peerConnection is null, bug in state machine!");
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
            application.onPeerConnectionCreateOfferSuccessCallback(offer);
        }, function (error) {
            application.onPeerConnectionCreateOfferErrorCallback(error);
        },{"optional":[],"mandatory":{"OfferToReceiveAudio":true,"OfferToReceiveVideo":true}});
    }
    catch (exception) {
        console.error("WebRtcMediaManager:createOffer(): catched exception:" + exception);

    }
};

WebRtcMediaManager.prototype.createAnswer = function (answerCallFn) {
    console.debug("WebRtcMediaManager:createAnswer()");
    try
    {
        this.createPeerConnection();
        this.peerConnection.addStream(this.localAudioVideoMediaStream);
        this.answerCallFn = answerCallFn;
        var application=this;
        var sdpOffer = new RTCSessionDescription({
            type: 'offer',
            sdp: application.lastReceivedSdp
        });
        console.debug("WebRtcMediaManager:setRemoteSDP: offer=" + JSON.stringify(sdpOffer));
        this.peerConnectionState = 'offer-received';
        this.peerConnection.setRemoteDescription(sdpOffer, function() {
            application.onPeerConnectionSetRemoteDescriptionSuccessCallback();
        }, function(error) {
            application.onPeerConnectionSetRemoteDescriptionErrorCallback(error);
        });
    }
    catch(exception)
    {
        console.error("MobicentsWebRTCPhone:createAnswer(): catched exception:"+exception);
    }};

WebRtcMediaManager.prototype.onPeerConnectionCreateOfferSuccessCallback = function (offer) {
    console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferSuccessCallback(): newOffer=" + offer);
    console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferSuccessCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
    console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferSuccessCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
    console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferSuccessCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
    console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferSuccessCallback: this.peerConnectionState=" + this.peerConnectionState);
    console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferSuccessCallback: offer=" + JSON.stringify(offer));

    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'new') {
            // Preparing offer.
            var application = this;
            this.peerConnectionState = 'preparing-offer';

            this.peerConnection.setLocalDescription(offer, function () {
                application.onPeerConnectionSetLocalDescriptionSuccessCallback();
            }, function (error) {
                application.onPeerConnectionSetLocalDescriptionErrorCallback(error);
            });
        }
        else {
            console.error("WebRtcMediaManager:onPeerConnectionCreateOfferSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionCreateOfferSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaManager.prototype.onPeerConnectionCreateOfferErrorCallback = function (error) {
    console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferErrorCallback():error=" + error);
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferErrorCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferErrorCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferErrorCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionCreateOfferErrorCallback: this.peerConnectionState=" + this.peerConnectionState);
        // TODO Notify Error to INVITE state machine
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionCreateOfferErrorCallback(): this.peerConnection is null, bug in state machine!");
    }
    alert("error:" + error);

};

WebRtcMediaManager.prototype.onPeerConnectionSetLocalDescriptionSuccessCallback = function () {
    console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionSuccessCallback()");
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionSuccessCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionSuccessCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionSuccessCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionSuccessCallback: this.peerConnectionState=" + this.peerConnectionState);
        // Nothing to do, just waiting end ICE resolution
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionCreateOfferErrorCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onPeerConnectionSetLocalDescriptionErrorCallback = function (error) {
    console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionErrorCallback():error=" + error);
    if (this.peerConnection != null) {
        console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionErrorCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionErrorCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionErrorCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("WebRtcMediaManager:onPeerConnectionSetLocalDescriptionErrorCallback: this.peerConnectionState=" + this.peerConnectionState);
        // TODO Notify Error to INVITE state machine
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionSetLocalDescriptionErrorCallback(): this.peerConnection is null, bug in state machine!");
    }
    alert("error:" + error);

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
            application.onPeerConnectionSetRemoteDescriptionSuccessCallback();
        }, function (error) {
            application.onPeerConnectionSetRemoteDescriptionErrorCallback(error);
        });
    } else {
        this.lastReceivedSdp = sdp;
    }
};

WebRtcMediaManager.prototype.onPeerConnectionSetRemoteDescriptionSuccessCallback = function () {
    console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionSuccessCallback()");

    if (this.peerConnection != null) {
        console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionSuccessCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionSuccessCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionSuccessCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionSuccessCallback: this.peerConnectionState=" + this.peerConnectionState);

        if (this.peerConnectionState == 'answer-received') {
            this.peerConnectionState = 'established';
        }
        else if (this.peerConnectionState == 'offer-received') {
            var application = this;
            this.peerConnection.createAnswer(function (answer) {
                application.onPeerConnectionCreateAnswerSuccessCallback(answer);
            }, function (error) {
                application.onPeerConnectionCreateAnswerErrorCallback(error);
            },{'mandatory': {
                'OfferToReceiveAudio':true,
                'OfferToReceiveVideo':true }});
        }
        else {
            console.log("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionSetRemoteDescriptionSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaManager.prototype.onPeerConnectionSetRemoteDescriptionErrorCallback = function (error) {
    console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionErrorCallback():error=" + error);
    if (this.peerConnection != null) {
        console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionErrorCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionErrorCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionErrorCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionSetRemoteDescriptionErrorCallback: this.peerConnectionState=" + this.peerConnectionState);
        // TODO Notify Error to INVITE state machine
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionSetRemoteDescriptionErrorCallback(): this.peerConnection is null, bug in state machine!");
    }
    alert("error:" + error);

};

WebRtcMediaManager.prototype.onPeerConnectionCreateAnswerSuccessCallback = function (answer) {
    console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerSuccessCallback():answer=" + answer);

    if (this.peerConnection != null) {
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerSuccessCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerSuccessCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerSuccessCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerSuccessCallback: this.peerConnectionState=" + this.peerConnectionState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerSuccessCallback: answer=" + JSON.stringify(answer));

        if (this.peerConnectionState == 'offer-received') {
            // Prepare answer.
            var application = this;
            this.peerConnectionState = 'preparing-answer';
            this.peerConnection.setLocalDescription(answer, function () {
                application.onPeerConnectionSetLocalDescriptionSuccessCallback();
            }, function (error) {
                application.onPeerConnectionSetLocalDescriptionErrorCallback(error);
            });
        }
        else {
            console.log("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionCreateAnswerSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaManager.prototype.onPeerConnectionCreateAnswerErrorCallback = function (error) {
    console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerErrorCallback():error=" + error);

    if (this.peerConnection != null) {
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerErrorCallback(): this.peerConnection.readyState=" + this.peerConnection.readyState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerErrorCallback(): this.peerConnection.iceGatheringState=" + this.peerConnection.iceGatheringState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerErrorCallback(): this.peerConnection.iceConnectionState=" + this.peerConnection.iceConnectionState);
        console.debug("MobicentsWebRTCPhone:onPeerConnectionCreateAnswerErrorCallback: this.peerConnectionState=" + this.peerConnectionState);
        // TODO Notify Error to INVITE state machin
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onPeerConnectionCreateAnswerErrorCallback(): this.peerConnection is null, bug in state machine!");
    }
    alert("error:" + error);
};
