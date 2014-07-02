(function ($) {
    $.extend({
        websocketSettings: {
            open: function () {
            },
            close: function () {
            },
            error: function () {
            },
            message: function () {
            },
            options: {},
            events: {},
            context: this
        },
        websocket: function (url, s) {
            var ws = WebSocket ? new WebSocket(url) : {
                send: function (m) {
                    return false
                },
                close: function () {
                }
            };
            $.extend($.websocketSettings, s);
            $(ws).bind('open', $.websocketSettings.open)
                .bind('close', $.websocketSettings.close)
                .bind('error', $.websocketSettings.error)
                .bind('message', $.websocketSettings.message)
                .bind('message', function (e) {
                    var m = $.evalJSON(e.originalEvent.data);
                    var h = $.websocketSettings.events[m.message];
                    if (h) h.apply($.websocketSettings.context, m.data);
                });

            ws._send = ws.send;
            ws.send = function (message) {
                if (ws.readyState == 1) {
                    var index, arg;
                    var m = {message: message};
                    m = $.extend(true, m, $.extend(true, {}, $.websocketSettings.options, m));
                    m['data'] = [];

                    for (index = 1; index < arguments.length; index++){
                        arg = arguments[index];
                        if (!(arg == null || typeof arg === "undefined")) m['data'].push(arg);
                    }

                    return this._send($.toJSON(m));
                }
                {
                    return false;
                }
            };
            $(window).unload(function () {
                ws.close();
                ws = null
            });
            return ws;
        }
    });
})(jQuery);
