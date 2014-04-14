/**
 * Created by nazar on 10.04.14.
 */
var WebSocketManager = function (localVideoPreview, remoteVideo) {
    var me = this;

    me.isOpened = false;
    me.webSocket = null;
    me.webRtcMediaManager = new WebRtcMediaManager(localVideoPreview, remoteVideo);
    me.streams = [];

    this.callbacks = {
        ping: function () {
            me.webSocket.send("pong");
        },

        setRemoteSDP: function (sdp, isInitiator) {
            console.log("setRemoteSDP: " + sdp);
            me.webRtcMediaManager.setRemoteSDP(sdp, isInitiator);
        },

        notifyVideoFormat: function (videoFormat) {
            //notifyVideoFormat(videoFormat);
        },

        notifyAudioCodec: function (codec) {
        }

    };

};

WebSocketManager.prototype = {
    connect: function(WCSUrl) {
        var me = this;
        me.webSocket = $.websocket(WCSUrl, {
            open: function () {
                me.isOpened = true;
                //fake login object
                var loginObject = {};
                me.webSocket.send("connect", loginObject);
            },
            close: function (event) {
                me.isOpened = false;
                if (!event.originalEvent.wasClean) {
                    console.dir(CONNECTION_ERROR);
                }
                me.webRtcMediaManager.close();
            },
            error: function () {
                console.log("Error occured!");
            },
            context: me,
            events: me.callbacks
        });
        return 0;
    },

    disconnect: function() {
        console.log("WebSocketManager - disconnect!");
        this.webSocket.close();
    },

    publish: function() {
        var me = this;
        this.webRtcMediaManager.createOffer(function (sdp) {
            var object = {};
            object.sdp = me.removeCandidatesFromSDP(sdp);
            object.streamName = me.generateId();
            object.hasVideo = true;
            me.streams.push(object.streamName);
            console.log("Publish streamName " + object.streamName);
            me.webSocket.send("publish", object);
        }, true);
    },

    unpublish: function(streamName) {
        var me = this;
        var object = {};
        if (streamName == "" || streamName == null) {
            streamName = me.streams[0];
        }
        object.streamName = streamName;
        console.log("Unpublish stream " + streamName);
        me.webSocket.send("unPublish", object);
    },

    subscribe: function(streamName) {
        var me = this;
        this.webRtcMediaManager.createOffer(function (sdp) {
            var object = {};
            object.sdp = me.removeCandidatesFromSDP(sdp);
            object.streamName = streamName;
            object.hasVideo = true;
            me.streams.push(object.streamName);
            console.log("subscribe streamName " + object.streamName);
            me.webSocket.send("subscribe", object);
        }, true);
    },

    unSubscribe: function(streamName) {
        var me = this;
        var object = {};
        if (streamName == "" || streamName == null) {
            streamName = me.streams[0];
        }
        object.streamName = streamName;
        console.log("unSubscribe stream " + streamName);
        me.webSocket.send("unSubscribe", object);
    },

    getAccessToAudioAndVideo: function() {
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

    generateId: function() {
        var id = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for( var i=0; i < 30; i++ ) {
            id += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return id;
    }
};

