var Streaming = function () {
    this.intervalId = -1;
};

function init() {
    if (detectIE()) {
        $("#notify").modal('show');
        return false;
    }
}

Streaming.prototype.connectionStatusListener = function (event) {
    var me = this;
    trace("Streaming - connectionStatusListener status " + event.status);
    if (event.status == ConnectionStatus.Established) {
        $("#publishButton").click(function () {
            me.publishButtonListener()
        });
        $("#subscribeButton").click(function(){
            me.playStreamButtonListener();
        });
        $('.preload-intro').css({'display': 'none'});
        if ($('.player-communication-2').css('display') === 'none') {
            $('.connect-translation').css({'display': 'block'});
            $('.text-previu>span').text('Connection established. Press start to begin streaming.');
        } else {
            setTimeout(function () {
                me.playStreamButtonListener();
            }, 1000);
            //$('.preload-visit').css('display', 'block');
            me.textId();
            $('.visit-translation').css('display','block');
            $('.connect-translation').css('display', 'none');
            $('.stop-y').click(function () {
                me.playStreamButtonListener();
                me.connectButtonListener;
                $('.visit-translation').css('display', 'none');
                $('.black-window').css({'display': 'block'});
                $('.play-stop').css({'display': 'block'});
                $('.text-previu>span').text('Video is stopped. Would you like to continue playback?');
                $('.button-play-stop>div').click(function () {
                    me.connectButtonListener;
                    me.playStreamButtonListener();
                    $('.black-window').css({'display': 'none'});
                    $('.play-stop').css({'display': 'none'});
                    $('.text-previu>span').text('Your stream is playing back');
                    $('.visit-translation').css('display', 'block');

                });
            });
        }
    } else if (event.status == ConnectionStatus.Disconnected ||
        event.status == ConnectionStatus.Failed) {
        $("#subscribeButton").unbind("click");
        $("#publishButton").unbind("click");
        $('.preload-intro').css({'display': 'none'});
        $('.connect-img').css({'display': 'none'});

        this.onUnpublish();
        this.onStopStream();
        this.setPublishStreamName("");
    }
};

Streaming.prototype.connectButtonListener = function () {
    console.log("Pressed connectButton");
    if ($('.flash-img').attr("flag") === 'ok') {
        this.connect();
        $('.flash-img').attr("flag", "no");
    } else {
        this.disconnect();
        $('.flash-img').attr("flag", "ok");
    }
};

Streaming.prototype.onUnpublish = function () {
    var me = this;
    $('.access-img').removeAttr('id');
    $('.access-video').css({'display': 'none'});
    $('.connect-translation').css({'display': 'block'});
    $('.text-previu>span').text('The publishing is stopped. Would you like to start stream again?');
    $('.connect-img').attr('id', 'publishButton');

    //if (flashphoner.isOpened) {
    $("#subscribeButton").click(function () {
        me.playStreamButtonListener()
    });
    //$('#subscribeButton').removeClass('buttonDisabled').addClass("button");
    //}
};

Streaming.prototype.publishButtonListener = function () {
    console.log("Pressed publishButton");
    if ($('.connect-translation').css("display") === 'block') {
        this.publish(true);
    } else {
        this.onUnpublish();
        this.unpublish();
    }
};

Streaming.prototype.onPlayStream = function () {
    $("#subscribeButton").text("Stop Stream");

    $("#publishButton").unbind("click");
    $('#publishButton').removeClass("button").addClass('buttonDisabled');
};
Streaming.prototype.onStopStream = function () {
    var me = this;
    $("#subscribeButton").text("Play Stream");
    //if (flashphoner.isOpened) {
    $("#publishButton").click(function () {
        me.publishButtonListener()
    });
    $('#publishButton').removeClass('buttonDisabled').addClass("button");
    //}
};
Streaming.prototype.playStreamButtonListener = function () {
    if ($(".flash-img").attr('scrybe') === "ok") {
        this.playStream();
        this.onPlayStream();
        $(".flash-img").attr('scrybe', 'no');
    } else {
        this.stopStream();
        this.onStopStream();
        $(".flash-img").attr('scrybe', 'ok');
    }
};

Streaming.prototype.parseUrlId = function () {
    var idTrans = [];
    var address = window.location.toString();
    var pattern = /https?:\/\/.*\?id\=(.*)/;
    idTrans = address.match(pattern);
    return idTrans[1];
};

Streaming.prototype.loadWindow = function () {
    var ads = window.location.toString();
    var pattern = /id\=[\w]+/g;
    var idString = pattern.test(ads);
    if (idString) {
        return $('.player-communication').css({'display': 'none'});
    } else {
        return $('.player-communication-2').css({'display': 'none'});
    }
};

Streaming.prototype.kindTrans = function () {
    var ads = window.location.toString();
    var pattern = /id\=[\w]+/g;
    return pattern.test(ads);
};

/* onclick events */

Streaming.prototype.textId = function () {
    var adress = window.location.toString();
    $('.visit-code>span').text(adress);
    $('.info-anchor>span').text(adress);
    $('.info-anchor>span').attr('data-clipboard-text', '' + adress + '');
    $('.visit-code>span').attr('data-clipboard-text', '' + adress + '');
};

Streaming.prototype.connect = function () {
    this.info("");
    Flashphoner.getInstance().connect({appKey: "defaultApp", width: 0, height:0});
    $('.preload-intro').css({'display': 'block'});
};

Streaming.prototype.disconnect = function () {
    this.info("");
    Flashphoner.getInstance().disconnect();
};

Streaming.prototype.publish = function (hasVideo) {
    var me = this;
    $('.connect-translation').css({'display': 'none'});
    $('.connect-img').removeAttr('id');
    $('.access-img').attr('id', 'publishButton');
    $("#subscribeButton").unbind("click");
    $("#publishButton").click(function () {
        me.publishButtonListener();
    });
    this.info("");

    if (!Flashphoner.getInstance().hasAccess(MediaProvider.WebRTC, hasVideo)) {
        $('.access-video').css({'display': 'block'});
        $('.text-previu>span').text('You are trying to push a stream to Flashphoner WebRTC Server');
        var checkAccessFunc = function () {
            if (Flashphoner.getInstance().hasAccess(MediaProvider.WebRTC, hasVideo)) {
                clearInterval(me.intervalId);
                me.intervalId = -1;
                me.publish(hasVideo);
            }
        };
        me.intervalId = setInterval(checkAccessFunc, 500);
        Flashphoner.getInstance().getAccess(MediaProvider.WebRTC, hasVideo);
    } else {
        $('.black-window').css({'display': 'none'});
        $('.access-video').css({'display': 'none'});
        me.currentStream = new Stream();
        me.currentStream.name = me.generateId();
        me.currentStream.hasVideo = hasVideo;
        Flashphoner.getInstance().publishStream(me.currentStream);
    }
};

Streaming.prototype.playStream = function () {
    var me = this;
    me.info("");
    var codeText = this.parseUrlId();
    console.log("Streamname " + codeText);
    me.currentStream = new Stream();
    me.currentStream.name = codeText;
    me.currentStream.hasVideo = true;
    Flashphoner.getInstance().playStream(me.currentStream);
};

Streaming.prototype.unpublish = function () {
    Flashphoner.getInstance().unPublishStream(this.currentStream);
    this.setPublishStreamName("");
};

Streaming.prototype.stopStream = function () {
    Flashphoner.getInstance().stopStream(this.currentStream);
    this.setPublishStreamName("");
};

Streaming.prototype.generateId = function () {
    var id = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 30; i++) {
        id += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return id;
};

Streaming.prototype.setPublishStreamName = function (text) {
    var addressId = window.location.toString() + '?id=' + text;
    $("#publishStreamName").text(addressId);
};

Streaming.prototype.info = function (text) {
    console.log("INFO " + text);
    $('.info-previu>span').text(text);
};

Streaming.prototype.streamStatusListener = function (stream) {

    if (StreamStatus.Failed == stream.status) {
        this.info(stream.info);
        if (stream.published) {
            this.onUnpublish();
        } else {
            this.onStopStream();
        }
    } else if (StreamStatus.Playing == stream.status || StreamStatus.Publishing == stream.status) {
        this.setPublishStreamName(stream.name);
        document.getElementById('preload-connect').style.display = "none";
        if (!this.kindTrans()) {
            $('.publish-translation').css('display', 'block');
            $('.text-previu>span').text("You can share the stream using the link below. Press 'Copy' to copy the link to clipboard.");
        }
    } else if (StreamStatus.Stoped == stream.status || StreamStatus.Unpublished == stream.status) {
        if (stream.published) {
            this.onUnpublish();
        } else {
            this.onStopStream();
        }
    }

};

Streaming.prototype.init = function () {
    var me = this;
    Flashphoner.getInstance().addListener(WCSEvent.ConnectionStatusEvent, this.connectionStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.StreamStatusEvent, this.streamStatusListener, this);
    me.loadWindow();
    setTimeout(function () {
        me.connectButtonListener();
    }, 1000);

    $('.stop-x').click(function () {
        me.publishButtonListener();
        $('.publish-translation').css('display', 'none');
        $('.black-window').css({'display': 'block'});
        $('.connect-translation').css({'display': 'block'});
        $('.text-previu>span').text('You are connected to server. Would you like to start stream?');
    });

    var client2 = new ZeroClipboard($(".copy-code-button"), {
        moviePath: "ZeroClipboard.swf"
    });

    $('.stop-x').hover(
        function () {
            $('.stop-x').css('background', 'url("images/stop2.png") no-repeat scroll 9px 11px rgba(0, 0, 0, 0)');
            $('.stop-text').css('right', '7px');
        }, function () {
            $('.stop-x').css('background', 'url("images/stop1.png") no-repeat scroll 9px 11px rgba(0, 0, 0, 0)');
            $('.stop-text').css('right', '7777px');
        });

    $('.stop-x').mousedown(function () {
        $('.stop-x').css('background', 'url("images/stop3.png") no-repeat scroll 9px 11px rgba(0, 0, 0, 0)');

    });
    $('.stop-x').mouseup(function () {
        $('.stop-x').css('background', 'url("images/stop2.png") no-repeat scroll 9px 11px rgba(0, 0, 0, 0)');
    });

    $('.stop-y').hover(
        function () {
            $('.stop-y').css('background', 'url("images/stop2.png") no-repeat scroll 9px 11px rgba(0, 0, 0, 0)');
            $('.stop-text').css('right', '-2px');
        }, function () {
            $('.stop-y').css('background', 'url("images/stop1.png") no-repeat scroll 9px 11px rgba(0, 0, 0, 0)');
            $('.stop-text').css('right', '7777px');
        });

    $('.stop-y').mousedown(function () {
        $('.stop-y').css('background', 'url("images/stop3.png") no-repeat scroll 9px 11px rgba(0, 0, 0, 0)');

    });
    $('.stop-y').mouseup(function () {
        $('.stop-y').css('background', 'url("images/stop2.png") no-repeat scroll 9px 11px rgba(0, 0, 0, 0)');
    });
};
