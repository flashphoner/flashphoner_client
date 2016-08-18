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
        var state = $(this).text();
        console.log(state);
        if (state == "Connect") {
            connect();
        } else {
            disconnect();
        }
    });

    $("#streamName1").val("streamName1");
    $("#streamName2").val("streamName2");

    $("#url").val(setURL());

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
    console.log("connection to " , url);
    currentSession = Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.FAILED, function(session){
        console.warn("Session failed, id " + session.id());
        //removeSession(session);
        setStatus("",session.status());
    }).on(SESSION_STATUS.DISCONNECTED, function(session) {
        console.log("Session diconnected, id " + session.id());
        removeSession(session);
        $("#url").attr('disabled', true);
        setStatus("",session.status());
    }).on(SESSION_STATUS.ESTABLISHED, function(session) {
        console.log("Session established, id" + session.id());
        setStatus("",session.status());
    });
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

    player.button.attr('disabled', true);
    if (player.button.text() == "Stop") {
        stopStream(player);
        return;
    }
    player.streamName = field(streamName);
    console.log("Play stream name : " + player.streamName);
    var handleStream = function(stream) {
        player.stream = stream;
        setStatus(player, stream.status());
        player.button.removeAttr('disabled');
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
    if (status == "PUBLISHING" || status == "PLAYING") {
        if (player != "") {
            player.statusElement.text(status).removeClass().attr("class", "text-success");
            player.button.text("Stop");
            player.urlElement.attr('disabled',true);
        }
    }

    if (status == "DISCONNECTED" || status == "UNPUBLISHED" || status == "STOPPED") {
        if (player != "") {
            player.statusElement.text(status).removeClass().attr("class", "text-muted");
            player.button.text("Start");
            player.urlElement.removeAttr('disabled',true);
        } else {
            $("#connectStatus").text(status);
            $("#url").removeAttr('disabled');
        }
    }

    if (status == "FAILED") {
        if (player != "") {
            player.statusElement.text(status).removeClass().attr("class", "text-danger");
            player.button.text("Start");
            player.urlElement.removeAttr('disabled',true);
        }
    }

    if (status == "ESTABLISHED") {
        $("#connectStatus").text(status).removeClass().attr("class", "text-success");
        $("#connectBtn").text("Disconnect");
        $("#url").attr('disabled',true);
    }
}

// Check field for empty string
function checkForEmptyField(checkField, alertDiv) {
    if (document.getElementById(checkField).value == "") {
        console.log(checkField + " is empty");
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
