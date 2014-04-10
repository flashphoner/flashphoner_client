/**
 * Created by nazar on 10.04.14.
 */
var WebSocketManager = function (localVideoPreview, remoteVideo) {
    var me = this;

    me.isOpened = false;
    me.webSocket = null;
    me.webRtcMediaManager = new WebRtcMediaManager(localVideoPreview, remoteVideo);

    this.callbacks = {
        ping: function () {
            me.webSocket.send("pong");
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

        finish: function (call, sipHeader) {
            proccessCall(call);
            notify(call);
            notifyRemoveCall(call);
            removeCall(call.id);
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

    disconnect: function () {
        console.log("WebSocketManager - disconnect!");
        this.webSocket.close();
    }
};

