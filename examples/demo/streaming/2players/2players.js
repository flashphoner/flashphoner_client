//Init API
Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});

var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var currentSession;
var player1 = {};
var player2 = {};

//////////////////////////////////
/////////////// Init /////////////

function initAPI() {

    player2.videoElement = document.getElementById("player2");
    player2.statusElement = $("#status2");
    player2.button = $("#playBtn2");
    player2.formElement = $("#form2");
    player2.urlElement = $("#streamName2");

    player1.videoElement = document.getElementById("player1");
    player1.statusElement = $("#status1");
    player1.button = $("#playBtn1");
    player1.formElement = $("#form1");
    player1.urlElement = $("#streamName1");

    if (detectIE()) {
        detectFlash();
    }

    $("#connectBtn").click(function() {
        $(this).prop('disabled',true);
        var state = $(this).text();
        if (state == "Connect") {
            connect();
        } else {
            disconnect();
        }
    });

    $("#streamName1").val("streamName1");
    $("#streamName2").val("streamName2");

    $("#url").val(setURL());

    player1.button.attr('disabled',true);
    player2.button.attr('disabled',true);

}

///////////////////////////////////
///////////// Controls ////////////
///////////////////////////////////

function connect() {
    if (currentSession && currentSession.status() == SESSION_STATUS.ESTABLISHED) {
        console.warn("Already connected, session id " + currentSession.id());
        return;
    }
    var url = field('url');

    var handleSession = function(session) {
        var status = session.status();
        switch (status) {
            case "FAILED":
                console.warn("Session failed, id " + session.id());
                removeSession(session);
                player1.button.prop('disabled', true);
                player2.button.prop('disabled', true);
                setStatus("",session.status());
                break;
            case "DISCONNECTED":
                console.log("Session diconnected, id " + session.id());
                removeSession(session);
                player1.button.prop('disabled', true);
                player2.button.prop('disabled', true);
                $("#url").prop('disabled', false);
                setStatus("",session.status());
                break;
            case "ESTABLISHED":
                console.log("Session established, id " + session.id());
                player1.button.prop('disabled',false);
                player2.button.prop('disabled',false);
                setStatus("",session.status());
                break;
        }
    };

    currentSession = Flashphoner.createSession({urlServer: url})
        .on(SESSION_STATUS.FAILED, handleSession)
        .on(SESSION_STATUS.DISCONNECTED, handleSession)
        .on(SESSION_STATUS.ESTABLISHED, handleSession);
}

function disconnect() {
    if (!currentSession) {
        console.warn("Nothing to disconnect");
        return;
    }
    currentSession.disconnect();
    $("#connectBtn").text("Connect");
}


function playStream(player, streamName) {
    if (!checkForEmptyField(streamName, player.formElement)) { return false;}

    if ((player == player1 && player2.stream && player2.stream.name() == field(streamName)) ||
        (player == player2 && player1.stream && player1.stream.name() == field(streamName))) {
        console.warn("Stream " + field(streamName) + " already playing");
        setStatus(player, "FAILED");
        return false;
    }

    player.button.prop('disabled', true);
    if (player.button.text() == "Stop") {
        stopStream(player);
        return;
    }
    player.streamName = field(streamName);
    console.log("Play stream name : " + player.streamName);
    var handleStream = function(stream) {
        switch (stream.status()) {
            case "PLAYING" :
                player.stream = stream;
                setStatus(player, stream.status());
                player.button.prop('disabled',false);
                break;
            case "STOPPED" :
            case "FAILED" :
                player.stream = null;
                setStatus(player, stream.status());
                player.button.prop('disabled',false);
                break;
        }
    };
    currentSession.createStream({name: player.streamName, display: player.videoElement, cacheLocalResources: false})
        .on(STREAM_STATUS.PLAYING, handleStream)
        .on(STREAM_STATUS.STOPPED, handleStream)
        .on(STREAM_STATUS.FAILED, handleStream)
        .play();
}

function stopStream(player) {
    player.stream.stop();
}

/////////////////////////////////////
///////////// Display UI ////////////
/////////////////////////////////////

// Set Connection Status
function setStatus(player, status) {
    console.log("Status: " + status);

    if (player) {
        console.log(player);
        player.urlElement.prop('disabled', true);
        if (status == "PUBLISHING" || status == "PLAYING") {
            player.statusElement.text(status).removeClass().attr("class", "text-success");
            player.button.text("Stop");
            player.urlElement.prop('disabled', true);
        } else {
            player.statusElement.text(status).removeClass().attr("class", (status == "FAILED") ? "text-danger" : "text-muted");
            player.button.text("Start");
            player.urlElement.prop('disabled',false);
        }
    } else {
        var textClass;
        if (status == "DISCONNECTED" || status == "FAILED") {
            textClass = (status == "FAILED") ? "text-danger" : "text-muted";
            $("#connectBtn").text("Connect").prop('disabled',false);
            $("#url").prop('disabled',false);
        } else {
            textClass = "text-success";
            $("#connectBtn").text("Disconnect").prop('disabled',false);
            $("#url").attr('disabled',true);
        }
        $("#connectStatus").text(status).removeClass().attr("class", textClass);
    }

    //if (status == "PUBLISHING" || status == "PLAYING") {
    //    if (player) {
    //        player.statusElement.text(status).removeClass().attr("class", "text-success");
    //        player.button.text("Stop");
    //        player.urlElement.prop('disabled', true);
    //    }
    //}
    //
    //if (status == "DISCONNECTED" || status == "UNPUBLISHED" || status == "STOPPED") {
    //    if (player) {
    //        player.statusElement.text(status).removeClass().attr("class", "text-muted");
    //        player.button.text("Start");
    //        player.urlElement.prop('disabled',false);
    //    } else {
    //        $("#connectStatus").text(status);
    //        $("#connectBtn").text("Connect").prop('disabled',false);
    //        $("#url").prop('disabled',false);
    //    }
    //}
    //
    //if (status == "FAILED") {
    //    if (player) {
    //        player.statusElement.text(status).removeClass().attr("class", "text-danger");
    //        player.button.text("Start");
    //        player.urlElement.prop('disabled',false);
    //    } else {
    //        $("#connectStatus").text(status);
    //        $("#connectBtn").text("Connect").prop('disabled',false);
    //        $("#url").prop('disabled',false);
    //    }
    //}
    //
    //if (status == "ESTABLISHED") {
    //    $("#connectStatus").text(status).removeClass().attr("class", "text-success");
    //    $("#connectBtn").text("Disconnect").prop('disabled',false);
    //    $("#url").attr('disabled',true);
    //}
}

// Check field for empty string
function checkForEmptyField(checkField, alertDiv) {
    if (document.getElementById(checkField).value == "") {
        $(alertDiv).addClass("has-error");
        return false;
    } else {
        $(alertDiv).removeClass("has-error");
        return true;
    }
}

function removeSession(session) {
    if (currentSession.id() == session.id()) {
        currentSession = null;
    }
}
