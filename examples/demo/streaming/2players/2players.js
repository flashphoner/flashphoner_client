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

    player1.videoElement = document.getElementById("player1");
    player1.statusElement = $("#status1");
    player1.button = $("#playBtn1");
    player1.formElement = $("#form1");

    if (detectIE()) {
        detectFlash();
    }

    $("#url1").val(setURL() + "/streamName1" );
    $("#url2").val(setURL() + "/streamName2" );

}

///////////////////////////////////
///////////// Controls ////////////
///////////////////////////////////

//New connection
function connectAndPlay(player, url) {
    if (!checkForEmptyField(url, player.formElement)) {
        return false;
    }
    if (player.button.text() == "Stop") {
        stopStream(player);
        return;
    }

    if (player.session && player.session.status() == SESSION_STATUS.ESTABLISHED) {
        console.warn("Already connected, session id " + player.session.id());
        playStream(player, url);
        return;
    }
    player.url = field(url);
    player.session = Flashphoner.createSession({urlServer: player.url}).on(SESSION_STATUS.FAILED, function(session){
        console.warn("Session failed, id " + session.id());
        removeSession(session);
        setStatus(session.status());

    }).on(SESSION_STATUS.DISCONNECTED, function(session) {
        console.log("Session diconnected, id " + session.id());
        removeSession(session);
    }).on(SESSION_STATUS.ESTABLISHED, function(session) {
        console.log("Session established " + session.id());
        playStream(player, url);
    });
}

function playStream(player, url) {
    player.streamName = field(url).split('/')[3];
    console.log("Play stream name : "+player.streamName);
    var handleStream = function(stream) {
        player.stream = stream;
        setStatus(player, stream.status());
    };
    player.session.createStream({name: player.streamName, display: player.videoElement, cacheLocalResources: false})
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
        player.statusElement.text(status).removeClass().attr("class","text-success");
        player.button.text("Stop");
    }

    if (status == "DISCONNECTED" || status == "UNPUBLISHED" || status == "STOPPED") {
        player.statusElement.text(status).removeClass().attr("class","text-muted");
        player.button.text("Start");
    }

    if (status == "FAILED") {
        player.statusElement.text(status).removeClass().attr("class","text-danger");
        player.button.text("Start");
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
