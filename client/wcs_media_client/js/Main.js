/**
 * Created by nazar on 10.04.14.
 */

/* init variables */
config = null;
flashphoner = null;

function onDisconnect() {
    $("#subscribeButton").unbind("click");
    $("#publishButton").unbind("click");
    $('.preload-intro').css({'display': 'none'});
    $('.connect-img').css({'display': 'none'});
}
function onConnect() {
    $("#publishButton").click(publishButtonListener);
    $("#subscribeButton").click(subscribeButtonListener);
    $('.preload-intro').css({'display': 'none'});
    if ($('.player-communication-2').css('display') === 'none') {
        $('.connect-translation').css({'display': 'block'});
        $('.text-previu>span').text('You have connected to Flashphoner WebRTC server. Would you like to start your stream?');
    } else {
        setTimeout(subscribeButtonListener, 1000);
        $('.preload-visit').css('display', 'block');
        textId();
        //$('.visit-translation').css('display','block');
        $('.connect-translation').css('display', 'none');
        $('.stop-y').click(function () {

            subscribeButtonListener();
            connectButtonListener;
            $('.visit-translation').css('display', 'none');
            $('.black-window').css({'display': 'block'});
            $('.play-stop').css({'display': 'block'});
            $('.text-previu>span').text('Video is stopped. Would you like to continue playback?');
            $('.button-play-stop>div').click(function () {
                connectButtonListener;
                subscribeButtonListener();
                $('.black-window').css({'display': 'none'});
                $('.play-stop').css({'display': 'none'});
                $('.text-previu>span').text('Your stream is playing back');
                $('.visit-translation').css('display', 'block');

            });
        });
    }

}
connectButtonListener = function () {
    console.log("Pressed connectButton");
    if ($('.flash-img').attr("flag") === 'ok') {
        connect();
        $('.flash-img').attr("flag", "no");
    } else {
        disconnect();
        $('.flash-img').attr("flag", "ok");
    }
};

function onPublish() {
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
    $("#publishButton").click(publishButtonListener);
}
function onUnpublish() {
    $('.access-img').removeAttr('id');
    $('.access-video').css({'display': 'none'});
    $('.connect-translation').css({'display': 'block'});
    $('.text-previu>span').text('The publishing is stopped. Would you like to start stream again?');
    $('.connect-img').attr('id', 'publishButton');

    if (flashphoner.isOpened) {
        $("#subscribeButton").click(subscribeButtonListener);
        //$('#subscribeButton').removeClass('buttonDisabled').addClass("button");
    }
}
publishButtonListener = function () {
    console.log("Pressed publishButton");
    if ($('.connect-translation').css("display") === 'block') {
        onPublish();
        publish();

    } else {
        onUnpublish();
        unpublish();
    }
};

function onSubscribe() {
    $("#subscribeButton").text("Unsubscribe");

    $("#publishButton").unbind("click");
    $('#publishButton').removeClass("button").addClass('buttonDisabled');
}
function onUnsubscribe() {
    $("#subscribeButton").text("Subscribe");
    if (flashphoner.isOpened) {
        $("#publishButton").click(publishButtonListener);
        $('#publishButton').removeClass('buttonDisabled').addClass("button");
    }
}
subscribeButtonListener = function () {
    console.log("Pressed subscribeButton");
    if ($(".flash-img").attr('scrybe') === "ok") {
        subscribe();
        onSubscribe();
        $(".flash-img").attr('scrybe', 'no');
    } else {
        unsubscribe();
        onUnsubscribe();
        $(".flash-img").attr('scrybe', 'ok');
    }
};
function parseUrlId() {
    var idTrans = [];
    var address = window.location.toString();
    var pattern = /https?:\/\/.*\?id\=(.*)/;
    idTrans = address.match(pattern);
    return idTrans[1];
}
function loadWindow() {
    var ads = window.location.toString();
    var pattern = /id\=[\w]+/g;
    var idString = pattern.test(ads);
    if (idString) {
        return $('.player-communication').css({'display': 'none'});
    } else {
        return $('.player-communication-2').css({'display': 'none'});
    }
}
function kindTrans() {
    var ads = window.location.toString();
    var pattern = /id\=[\w]+/g;
    var idString = pattern.test(ads);
    return idString;
}

/* onclick events */
$(window).load(function () {
    console.log("document ready");

    loadWindow();
    var startConnect = setTimeout(connectButtonListener, 1000);

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
});
function textId() {
    var adress = window.location.toString();
    $('.visit-code>span').text(adress);
    $('.info-anchor>span').text(adress);
    $('.info-anchor>span').attr('data-clipboard-text', '' + adress + '');
    $('.visit-code>span').attr('data-clipboard-text', '' + adress + '');
}
$(document).ready(function () {
    var client3 = new ZeroClipboard($("#tarop"), {
        moviePath: "js/ZeroClipboard.swf"
    });
    var client4 = new ZeroClipboard($("#tarvisit"), {
        moviePath: "js/ZeroClipboard.swf"
    });


    config = new Config();
    flashphoner = new WebSocketManager(document.getElementById("localVideoPreview"), document.getElementById("remoteVideo"));

    $('.stop-x').click(function () {
        //unpublish();
        publishButtonListener();
        // connectButtonListener;
        $('.publish-translation').css('display', 'none');
        $('.black-window').css({'display': 'block'});
        $('.connect-translation').css({'display': 'block'});
        $('.text-previu>span').text('You are connected to server. Would you like to start stream?');
    });
});


function connect() {
    info("");
    flashphoner.connect("ws://" + config.wcsIP + ":" + config.wsPort);
    $('.preload-intro').css({'display': 'block'});
}

function disconnect() {
    info("");
    flashphoner.disconnect();
}

function publish() {
    info("");
    if (!hasAccess()) {
        intervalId = setInterval('if (hasAccess()){clearInterval(intervalId); intervalId = -1; publish();}', 500);
        flashphoner.getAccessToAudioAndVideo();
    } else {
        flashphoner.publish();
    }
}

function subscribe() {
    info("");
    var codeText = parseUrlId();
    console.log("Streamname " + codeText);
    if (codeText.indexOf("rtsp://") != -1) {
        var url = codeText.split("&");
        flashphoner.prepareRtspSession(url[0]);
    } else {
        flashphoner.subscribe(codeText);
    }

}

function unpublish() {
    flashphoner.unpublish();
    setPublishStreamName("");
}

function unsubscribe() {
    flashphoner.unSubscribe($("#streamName").text());
    setPublishStreamName("");
}

function hasAccess() {
    return (flashphoner.hasAccessToAudio() && flashphoner.hasAccessToVideo());
}
function siteName() {
//    var name = [];
//    var pattern = /(https?:\/\/[\w\.]+)/;
//    var string = window.location.toString();
//    name = string.match(pattern);
    return window.location.toString();
}
function setPublishStreamName(text) {

    var addressId = window.location.toString() + '?id=' + text;
    $("#publishStreamName").text(addressId);
}

function info(text) {
    console.log("INFO " + text);
    $('.info-previu>span').text(text);
}


function notifySubscribeError(message) {
    info(message);
    flashphoner.closeMediaSession();
    onUnsubscribe();
}

function notifyPublishError(message) {
    console.log("notifyPublishError");
    info(message);
    flashphoner.closeMediaSession();
    onUnpublish();
}

function notifyOpenConnection() {
    console.log("notifyOpenConnection");
    onConnect();
}

function notifyCloseConnection() {
    console.log("notifyCloseConnection");
    onDisconnect();
    onUnpublish();
    onUnsubscribe();
    setPublishStreamName("");
}

function notifyConnectionError(message) {
    info(message);
    onDisconnect();
}

function notifyRtspError(message) {
    info(message);
    flashphoner.closeMediaSession();
    onUnsubscribe();
}

function notifyRtspReady(streamName) {
    flashphoner.subscribe(streamName);
}


$(document).ready(function () {

    var client2 = new ZeroClipboard($(".copy-code"), {
        moviePath: "js/ZeroClipboard.swf"
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
});

