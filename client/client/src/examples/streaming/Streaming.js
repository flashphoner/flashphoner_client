var Streaming = function () {
    this.intervalId = -1;
};

Streaming.prototype.connectionStatusListener = function (event) {
    var me = this;
    trace("Streaming - connectionStatusListener status " + event.connection.status);
    if (event.connection.status == ConnectionStatus.Established) {
        $("#publishButton").click(function () {
            me.publishButtonListener()
        });
        $("#subscribeButton").click(function(){
            me.playStreamButtonListener();
        });
        $('.preload-intro').css({'display': 'none'});
        if ($('.player-communication-2').css('display') === 'none') {
            $('.connect-translation').css({'display': 'block'});
            $('.text-previu>span').text('You have connected to Flashphoner WebRTC server. Would you like to start your stream?');
        } else {
            setTimeout(function () {
                me.playStreamButtonListener()
            }, 1000);
            $('.preload-visit').css('display', 'block');
            me.textId();
            //$('.visit-translation').css('display','block');
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
    } else if (event.connection.status == ConnectionStatus.Disconnected ||
        event.connection.status == ConnectionStatus.Error) {
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
        this.publish();
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
    Flashphoner.getInstance().connect({appKey: "defaultApp"});
    $('.preload-intro').css({'display': 'block'});
};

Streaming.prototype.disconnect = function () {
    this.info("");
    Flashphoner.getInstance().disconnect();
};

Streaming.prototype.publish = function () {
    var me = this;
    $('.connect-translation').css({'display': 'none'});
    $('.connect-img').removeAttr('id');
    if ($('.flash-img').attr("connect-x") === "ok") {
        $('.black-window').css({'display': 'none'});
        $('.access-video').css({'display': 'none'});
        $('.flash-img').attr("connect-x") === "no"
    } else {
        $('.access-video').css({'display': 'block'});
        $('.text-previu>span').text('You are trying to push a stream to Flashphoner WebRTC Server');
    }
    $('.access-img').attr('id', 'publishButton');
    $("#subscribeButton").unbind("click");
    $("#publishButton").click(function () {
        me.publishButtonListener()
    });
    this.info("");
    if (!me.hasAccess()) {
        var checkAccessFunc = function () {
            if (me.hasAccess()) {
                clearInterval(me.intervalId);
                me.intervalId = -1;
                me.publish();
            }
        };
        me.intervalId = setInterval(checkAccessFunc, 500);
        Flashphoner.getInstance().getAccessToAudioAndVideo();
    } else {
        me.streamName = me.generateId();
        Flashphoner.getInstance().publishStream(me.streamName);
    }
};

Streaming.prototype.playStream = function () {
    this.info("");
    var codeText = this.parseUrlId();
    console.log("Streamname " + codeText);
    Flashphoner.getInstance().playStream(codeText);
};

Streaming.prototype.unpublish = function () {
    Flashphoner.getInstance().unPublishStream(this.streamName);
    this.setPublishStreamName("");
};

Streaming.prototype.stopStream = function () {
    Flashphoner.getInstance().stopStream($("#streamName").text());
    this.setPublishStreamName("");
};

Streaming.prototype.hasAccess = function () {
    return (Flashphoner.getInstance().hasAccessToAudio() && Flashphoner.getInstance().hasAccessToVideo());
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
    if (StreamStatus.Error == stream.status) {
        this.info(stream.message);
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
            $('.flash-img').attr("connect-x", "ok");
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

    var client2 = new ZeroClipboard($(".copy-code"), {
        moviePath: "ZeroClipboard.swf"
    });
    client2.on("mouseover", function (client2) {
        $('.copy-code').css('background', 'url("images/copy2.png") no-repeat scroll 0 0 rgba(0, 0, 0, 0)');
        $('.copy-code>span').css('background', '#ff5454');
    });
    client2.on("mouseout", function (client2) {
        $('.copy-code').css('background', 'url("images/copy1.png") no-repeat scroll 0 0 rgba(0, 0, 0, 0)');
        $('.copy-code>span').css('background', '#ffffff');
    });
    client2.on("mousedown", function (client2) {
        $('.copy-code').css('background', 'url("images/copy2.png") no-repeat scroll 0 0 rgba(0, 0, 0, 0)');
        $('.copy-code>span').css('background', '#ffffff');
    });
    client2.on("mouseup", function (client2) {
        $('.copy-code').css('background', 'url("images/copy1.png") no-repeat scroll 0 0 rgba(0, 0, 0, 0)');
        $('.copy-code>span').css('background', '#ffffff');
    });
    client2.on("load", function (client2) {
        $('.copy-code').css('background', 'url("images/copy1.png") no-repeat scroll 0 0 rgba(0, 0, 0, 0)');
        $('.copy-code').css('display', 'inline-block');
        $('.copy-code').css('height', '100%');
        $('.copy-code').css('width', '596px');
        $('.copy-code>span').css('background', '#ffffff');
        client2.on("complete", function (client2, args) {
            $('.copy-code').css('background', 'url("images/copy2.png") no-repeat scroll 0 0 rgba(0, 0, 0, 0)');
            $('.copy-code').css('display', 'inline-block');
            $('.copy-code').css('height', '100%');
            $('.copy-code').css('width', '596px');
            $('.copy-code>span').css('background', '#ffffff');
        });
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
