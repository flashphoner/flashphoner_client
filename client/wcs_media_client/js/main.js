/**
 * Created by nazar on 10.04.14.
 */

/* init variables */
config = null;
flashphoner = null;

function onDisconnect() {
    $("#connectButton").text("Connect");

    $("#subscribeButton").unbind("click");
    $('#subscribeButton').removeClass("button").addClass('buttonDisabled');

    $("#publishButton").unbind("click");
    $('#publishButton').removeClass("button").addClass('buttonDisabled');
}
function onConnect() {
    $("#connectButton").text("Disconnect");
    $("#publishButton").click(publishButtonListener);
    $('#publishButton').removeClass('buttonDisabled').addClass("button");
    $("#subscribeButton").click(subscribeButtonListener);
    $('#subscribeButton').removeClass('buttonDisabled').addClass("button");
}
connectButtonListener = function () {
    console.log("Pressed connectButton");
    if ($("#connectButton").text() == "Connect") {
        connect();
    } else {
        disconnect();
    }
};

function onPublish() {
    $("#publishButton").text("Unpublish");

    $("#subscribeButton").unbind("click");
    $('#subscribeButton').removeClass("button").addClass('buttonDisabled');
}
function onUnpublish() {
    $("#publishButton").text("Publish");

    if (flashphoner.isOpened){
        $("#subscribeButton").click(subscribeButtonListener);
        $('#subscribeButton').removeClass('buttonDisabled').addClass("button");
    }
}
publishButtonListener = function () {
    console.log("Pressed publishButton");
    if ($("#publishButton").text() == "Publish") {
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
    if (flashphoner.isOpened){
        $("#publishButton").click(publishButtonListener);
        $('#publishButton').removeClass('buttonDisabled').addClass("button");
    }
}
subscribeButtonListener = function () {
    console.log("Pressed subscribeButton");
    if ($("#subscribeButton").text() == "Subscribe") {
        if ($("#streamName").text().indexOf("rtsp") != -1) {
            prepareRtspSession($("#streamName").text());
            return;
        }
        subscribe($("#streamName").text());
        onSubscribe();
    } else {
        unsubscribe();
        onUnsubscribe();
    }
};

/* onclick events */
$(window).load(function () {
    console.log("document ready");
    $("#connectButton").click(connectButtonListener);
});

$(document).ready(function () {
    config = new Config();
    flashphoner = new WebSocketManager(document.getElementById("localVideoPreview"), document.getElementById("remoteVideo"));
});


function connect() {
    info("");
    flashphoner.connect("ws://" + config.wcsIP + ":" + config.wsPort);
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

function subscribe(streamName) {
    info("");
    console.log("Streamname " + streamName);
    flashphoner.subscribe(streamName);
}

function unpublish() {
    flashphoner.unpublish();
    setPublishStreamName("");
}

function unsubscribe() {
    flashphoner.unSubscribe($("#streamName").text());
    setPublishStreamName("");
}

function prepareRtspSession(uri) {
    info("Waiting for RTSP stream");
    flashphoner.prepareRtspSession(uri);
}

function hasAccess() {
    return (flashphoner.hasAccessToAudio() && flashphoner.hasAccessToVideo());
}

function setPublishStreamName(text) {
    $("#publishStreamName").text(text);
}

function info(text) {
    $("#info").text(text);
}


function notifySubscribeError() {
    info("Subscribe media session problem; Closing media session...");
    flashphoner.closeMediaSession();
    onUnsubscribe();
}

function notifyPublishError() {
    $info("Publish media session problem; Closing media session...");
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

function notifyRtspError(uri) {
    info("Failed to get streams from uri " + uri);
}

function notifyRtspReady(streamName) {
    subscribe(streamName);
}

