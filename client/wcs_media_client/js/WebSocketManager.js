/**
 * Created by nazar on 10.04.14.
 */
var WebSocketManager = function (localVideoPreview, remoteVideo) {
    var me = this;

    me.isOpened = false;
    me.webSocket = null;
    me.webRtcMediaManager = new WebRtcMediaManager(localVideoPreview, remoteVideo);
    me.streamName = "";

    this.callbacks = {
        ping: function () {
            me.webSocket.send("pong");
        },

        setRemoteSDP: function (sdp, isInitiator) {
            me.webRtcMediaManager.setRemoteSDP(sdp, isInitiator);
            setPublishStreamName(me.streamName);
            document.getElementById('preload-connect').style.display = "none";
            if(!kindTrans()){
            $('.publish-translation').css('display','block');
            $('.text-previu>span').text("You can share the stream using the link below. Press 'Copy' to copy the link to clipboard.");
            $('.flash-img').attr("connect-x","ok");
            }
        },

        notifyVideoFormat: function (videoFormat) {
            //notifyVideoFormat(videoFormat);
        },

        notifyAudioCodec: function (codec) {
        },

        notifySubscribeError: function (message) {
            notifySubscribeError(message);
        },

        notifyPublishError: function (message) {
            notifyPublishError(message);
        },

        notifyRtspError: function (message) {
            notifyRtspError(message);
        },

        onReadyToPlay: function (streamName) {
            notifyRtspReady(streamName);
        },

        notifyRtspSwitchingProtocols: function (streamName) {
            console.log("notifyRtspSwitchingProtocols");
            me.unSubscribe(streamName);
        }

    };

};

WebSocketManager.prototype = {
    connect: function (WCSUrl) {
        var me = this;
        me.webSocket = $.websocket(WCSUrl, {
            open: function () {
                me.isOpened = true;
                //fake login object
                var loginObject = {};
                me.webSocket.send("connect", loginObject, "media");
                notifyOpenConnection();
            },
            close: function (event) {
                me.isOpened = false;
                if (!event.originalEvent.wasClean) {
                    console.dir("CONNECTION_ERROR");
                    notifyConnectionError("CONNECTION_ERROR");
                } else {
                    notifyCloseConnection();
                    me.webRtcMediaManager.close();
                }
            },
            error: function () {
                console.log("Error occured!");
            },
            context: me,
            events: me.callbacks
        });
        return 0;
    },

    disconnect: function () {
        console.log("WebSocketManager - disconnect!");
        this.webSocket.close();
    },

    publish: function () {
        var me = this;
        this.webRtcMediaManager.createOffer(function (sdp) {
            var object = {};
            object.sdp = me.removeCandidatesFromSDP(sdp);
            object.streamName = me.generateId();
            object.hasVideo = true;
            me.streamName = object.streamName;
            console.log("Publish streamName " + object.streamName);
            me.webSocket.send("publish", object);
        }, true, true);
    },

    unpublish: function (streamName) {
        var me = this;
        var object = {};
        if (streamName == "" || streamName == null) {
            streamName = me.streamName;
        }
        object.streamName = streamName;
        console.log("Unpublish stream " + streamName);
        me.webSocket.send("unPublish", object);
        me.streamName = "";
        me.webRtcMediaManager.close();
    },

    subscribe: function (streamName) {
        var me = this;
        this.webRtcMediaManager.createOffer(function (sdp) {
            var object = {};
            object.sdp = me.removeCandidatesFromSDP(sdp);
            object.streamName = streamName;
            object.hasVideo = true;
            me.streamName = object.streamName;
            console.log("subscribe streamName " + object.streamName);
            me.webSocket.send("subscribe", object);
        }, false, false);
    },

    unSubscribe: function (streamName) {
        var me = this;
        var object = {};
        if (streamName == "" || streamName == null) {
            streamName = me.streamName;
        }
        object.streamName = streamName;
        console.log("unSubscribe stream " + streamName);
        me.webSocket.send("unSubscribe", object);
        me.streamName = "";
        me.webRtcMediaManager.close();
    },

    prepareRtspSession: function (rtspUri) {
        var me = this;
        var object = {};
        object.rtspUri = rtspUri;
        console.log("prepareRtspSession " + rtspUri)
        me.webSocket.send("prepareRtspSession", object);
    },

    closeMediaSession:function() {
        var me = this;
        me.streamName = "";
        me.webRtcMediaManager.close();
    },

    getActiveStream: function () {
        return this.streams[0];
    },

    getAccessToAudioAndVideo: function () {
        this.webRtcMediaManager.getAccessToAudioAndVideo();
    },

    hasAccessToAudio: function () {
        return this.webRtcMediaManager.isAudioMuted == -1;
    },

    hasAccessToVideo: function () {
        return this.webRtcMediaManager.isVideoMuted == -1;
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

    modifyRTCP: function (sdp) {
        var sdpArray = sdp.split("\n");
        var pt = "*";

        //get pt of VP8
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search("VP8/90000") != -1) {
                pt = sdpArray[i].match(/[0-9]+/)[0];
                console.log("pt is " + pt);
            }
        }

        //modify rtcp advert
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search("a=rtcp-fb:") != -1) {
                sdpArray[i] = "a=rtcp-fb:" + pt + " ccm fir\na=rtcp-fb:" + pt + " nack\na=rtcp-fb:" + pt + " nack pli";
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

    generateId: function () {
        var id = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < 30; i++) {
            id += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return id;
    }
};

