var WebSocketManager = function (url) {
    var me = this;

    me.isOpened = false;
    me.configLoaded = false;

    this.webSocket = $.websocket(url, {
        open: function() {
            me.isOpened = true;
        },
        close: function() {
            me.isOpened = false;
        },
        context:me,
        events: {
            getUserData: function(user) {
                alert(user);
            },

            getVersion: function(version) {
                alert(version);
            },

            registered: function(sipHeader) {
            },

            ring: function(call, sipHeader) {
            },

            sessionProgress: function(call, sipHeader) {
            },

            talk: function(call, sipHeader) {
            },

            hold: function(call, sipHeader) {
            },

            callbackHold: function(call, isHold) {
            },

            finish: function(call, sipHeader) {
            },

            busy: function(call, sipHeader) {
            },

            fail: function(errorCode, sipHeader) {
            },

            notifyVideoFormat: function(call) {
            },

            notifyMessage: function(message) {
            },

            notifyAudioCodec: function(call) {
            }
        }
    });
};

WebSocketManager.prototype = {

    login: function (loginObject) {
        this.webSocket.send("connect", loginObject);
        return 0;
    },

    call: function (loginObject) {
        this.webSocket.send("connect", loginObject);
        return 0;
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

    setCookie: function (c_name, value, exdays) {
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + exdays);
        var c_value = escape(value) + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
        document.cookie = c_name + "=" + c_value;
    }

};
