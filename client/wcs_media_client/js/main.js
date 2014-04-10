/**
 * Created by nazar on 10.04.14.
 */

/* init variables */
config = null;
flashphoner = null;


/* onclick events */
$(window).load(function(){
    console.log("document ready");
    $( "#connectButton" ).click(function() {
        console.log( "Pressed connectButton" );
        if ($("#connectButton").text() == "Connect") {
            $("#connectButton").text("Disconnect");
            connect();
        } else {
            $("#connectButton").text("Connect");
            disconnect();
        }
    });

    $( "#publishButton" ).click(function() {
        console.log( "Pressed publishButton" );
    });
});

$(document).ready(function() {
    config = new Config();
    flashphoner = new WebSocketManager($("#localVideoPreview"), $("#remoteVideo"));
});


function connect() {
    flashphoner.connect("ws://" + config.wcsIP + ":" + config.wsPort);
}

function disconnect() {
    flashphoner.disconnect();
}


