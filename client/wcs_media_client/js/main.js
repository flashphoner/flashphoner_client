/**
 * Created by nazar on 10.04.14.
 */

/* init variables */
config = null;
flashphoner = null;


/* onclick events */
$(window).load(function () {
    console.log("document ready");
    $("#streamName").click(function () {
        if ($("#streamName").text() == "Subscribe stream name") {
            $("#streamName").text("");
        }
    });
    $("#connectButton").click(function () {
        console.log("Pressed connectButton");
        if ($("#connectButton").text() == "Connect") {
            $("#connectButton").text("Disconnect");
            connect();
        } else {
            $("#connectButton").text("Connect");
            disconnect();
        }
    });

    $("#publishButton").click(function () {
        console.log("Pressed publishButton");
        if ($("#publishButton").text() == "Publish") {
            $("#publishButton").text("Unpublish");
            publish();
        } else {
            $("#publishButton").text("Publish");
            unpublish();
        }
    });

    $("#subscribeButton").click(function () {
        console.log("Pressed subscribeButton");
        if ($("#subscribeButton").text() == "Subscribe") {
            $("#subscribeButton").text("Unsubscribe");
            subscribe();
        } else {
            $("#subscribeButton").text("Subscribe");
            unsubscribe();
        }
    });
});

$(document).ready(function () {
    config = new Config();
    flashphoner = new WebSocketManager(document.getElementById("localVideoPreview"), document.getElementById("remoteVideo"));
});


function connect() {
    flashphoner.connect("ws://" + config.wcsIP + ":" + config.wsPort);
}

function disconnect() {
    flashphoner.disconnect();
}

function publish() {
    if (!hasAccess()) {
        intervalId = setInterval('if (hasAccess()){clearInterval(intervalId); intervalId = -1; publish();}', 500);
        flashphoner.getAccessToAudioAndVideo();
    } else {
        flashphoner.publish();
    }
}

function subscribe() {
    console.log("Streamname " + $("#streamName").text());
    flashphoner.subscribe($("#streamName").text());
}

function unpublish() {
    flashphoner.unpublish();
    info("");
}

function unsubscribe() {
    flashphoner.unSubscribe($("#streamName").text());
    info("");
}

function hasAccess() {
    return (flashphoner.hasAccessToAudio() && flashphoner.hasAccessToVideo());
}

function info(text) {
    $("#info").text(text);
}

