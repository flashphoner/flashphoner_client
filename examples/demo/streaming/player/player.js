//Init API
Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});

var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var currentSession;
var _stream;
var _streamName;
var _url;
var remoteVideo;


//////////////////////////////////
/////////////// Init /////////////

function init_page() {
    $("#url").val(setURL());
    $("#streamName").val("stream-"+createUUID(6));
    $("#playBtn").click(function () {
            $(this).prop('disabled', true);
            var state = $("#playBtn").text();
            if (state == "Start") {
                if (!checkForEmptyField('#url', '#connForm')) return;
                if (!checkForEmptyField('#streamName', '#playForm')) return;
                connectAndPlay();
            } else {
                stopStream();
            }
        }
    );
};

function initAPI() {

    remoteVideo = document.getElementById("remoteVideo");

    if (detectIE()) {
        detectFlash();
    }

    init_page();
}

///////////////////////////////////
///////////// Controls ////////////
///////////////////////////////////

//New connection
function connectAndPlay() {
    var url = field('url');

    if (currentSession && currentSession.status() == SESSION_STATUS.ESTABLISHED) {
        if (_url == url) {
            console.warn("Already connected, session id " + currentSession.id());
            playStream();
            return;
        } else {
            removeSession(currentSession);
        }
    }

    _url = url;

    console.log("Create new session with url " + url);
    currentSession = Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.FAILED, function(session){
        console.warn("Session failed, id " + session.id());
        setStatus(session.status());
    }).on(SESSION_STATUS.DISCONNECTED, function(session) {
        console.log("Session diconnected, id " + session.id());
        removeSession(session);
    }).on(SESSION_STATUS.ESTABLISHED, function(session) {
        console.log("Session established " + session.id());
        playStream();
    });
}

//Disconnect
function disconnect() {
    if (!currentSession) {
        console.warn("Nothing to disconnect");
        return;
    }
    currentSession.disconnect();
    $("#connectBtn").text("Connect");
}

function playStream() {
    _streamName = field("streamName");

    var displayEl = document.createElement('div');
    displayEl.setAttribute('id','displayDiv');
    remoteVideo.appendChild(displayEl);
    var d = document.getElementById('displayDiv');

    currentSession.createStream({name: _streamName, display: d, cacheLocalResources: false})
        .on(STREAM_STATUS.PLAYING, function(playingStream) {
            document.getElementById(playingStream.id()).addEventListener("resize", function(event){
                resizeVideo(event.target);
            });
            _stream = playingStream;
            console.log("Stream id " + _stream.id());
            setStatus(playingStream.status());
        })
        .on(STREAM_STATUS.STOPPED, function(playingStream) {
            remoteVideo.removeChild(displayEl);
            setStatus(playingStream.status());
        })
        .on(STREAM_STATUS.FAILED, function(playingStream) {
            remoteVideo.removeChild(displayEl);
            setStatus(playingStream.status());
        })
        .play();
}

function stopStream() {
    _stream.stop();
}

/////////////////////////////////////
///////////// Display UI ////////////
/////////////////////////////////////

// Set Connection Status
function setStatus(status) {
    var statusTextClass;
    var playBtnText = "Start";
    var muteStreamName = false;
    var muteUrl = false;

    if (status == "PLAYING") {
        statusTextClass = "text-success";
        playBtnText = "Stop";
        muteStreamName = true;
        muteUrl = true;
    }
    if (status == "DISCONNECTED" || status == "STOPPED") {
        statusTextClass = "text-muted";
    }
    if (status == "FAILED") {
        statusTextClass = "text-danger";
    }

    $("#url").prop("disabled",muteUrl);
    $("#streamName").prop("disabled",muteStreamName);
    $("#status").text(status).removeClass().attr("class",statusTextClass);
    $("#playBtn").text(playBtnText).prop("disabled",false);
}

// Check field for empty string
function checkForEmptyField(checkField, alertDiv) {
    if (!$(checkField).val()) {
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
