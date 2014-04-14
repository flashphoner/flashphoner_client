/**
 * Created by nazar on 10.04.14.
 */

/* init variables */
config = null;
flashphoner = null;


/* onclick events */
$(window).load(function(){
    console.log("document ready");
    $("#connectButton").click(function() {
        console.log( "Pressed connectButton" );
        if ($("#connectButton").text() == "Connect") {
            $("#connectButton").text("Disconnect");
            connect();
        } else {
            $("#connectButton").text("Connect");
            disconnect();
        }
    });

    $("#publishButton").click(function() {
        console.log( "Pressed publishButton" );
        if ($("#publishButton").text() == "Publish") {
            $("#publishButton").text("Unpublish");
            publish();
        } else {
            $("#publishButton").text("Publish");
            unpublish();
        }
    });

    $("#subscribeButton").click(function() {
        console.log( "Pressed subscribeButton" );
        if ($("#subscribeButton").text() == "Subscribe") {
            $("#subscribeButton").text("Unsubscribe");
            subscribe();
        } else {
            $("#subscribeButton").text("Subscribe");
            unsubscribe();
        }
    });
});

$(document).ready(function() {
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
    if (!hasAccess()) {
        intervalId = setInterval('if (hasAccess()){clearInterval(intervalId); intervalId = -1; subscribe();}', 500);
        flashphoner.getAccessToAudioAndVideo();
    } else {
        console.log("Streamname " + $("#streamName").text());
        flashphoner.subscribe($("#streamName").text());
    }
}

function unpublish() {
    flashphoner.unpublish();
}

function unsubscribe() {
    flashphoner.unSubscribe($("#streamName").text());
}

function hasAccess() {
    return (flashphoner.hasAccessToAudio() && flashphoner.hasAccessToVideo());
}

