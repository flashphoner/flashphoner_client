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
            say: function(e) {
                alert(e.data.name); // 'foo'
                alert(e.data.text); // 'baa'
            }
        }
    });
};

WebSocketManager.prototype = {

    login: function (loginObject) {
        this.webSocket.send("login", loginObject);
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
