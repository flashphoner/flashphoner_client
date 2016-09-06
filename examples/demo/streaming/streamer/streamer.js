//Init API
Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});

var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var currentSession;
var _stream;
var _streamName;
var localVideo;
var remoteVideo;


//////////////////////////////////
/////////////// Init /////////////

function init_page() {
    $("#url").val(setURL() + "/" + createUUID(8));
    $("#publishBtn").click(function () {
            $(this).prop('disabled',true);
            var state = $("#publishBtn").text();
            if (state == "Start") {
                connectAndPublish();
            } else {
                unPublishStream();
            }
        }
    );
};

function initAPI() {

    localVideo = document.getElementById("localVideo");
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
function connectAndPublish() {
    if (currentSession && currentSession.status() == SESSION_STATUS.ESTABLISHED) {
        console.warn("Already connected, session id " + currentSession.id());
        publishStream();
        return;
    }
    var url = field('url');
    console.log("Create new session with url " + url);

    var handleSession = function (session) {
        var status = session.status();
        switch (status) {
            case "FAILED":
                console.warn("Session failed, id " + session.id());
                removeSession(session);
                setStatus(status);
                break;
            case "DISCONNECTED":
                console.log("Session diconnected, id " + session.id());
                removeSession(session);
                setStatus(status);
                break;
            case "ESTABLISHED":
                console.log("Session established, id " + session.id());
                publishStream();
                break;
        }
    };

    currentSession = Flashphoner.createSession({urlServer: url})
        .on(SESSION_STATUS.FAILED,handleSession)
        .on(SESSION_STATUS.DISCONNECTED, handleSession)
        .on(SESSION_STATUS.ESTABLISHED, handleSession);
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

//Publish stream
function publishStream() {
    _streamName = field("url").split('/')[3];

    if (!currentSession || currentSession.status() != SESSION_STATUS.ESTABLISHED) {
        console.warn("Session is not ready or null");
        return;
    }

    var handleStream = function(stream) {
        var status = stream.status();
        console.log("Stream status: " + status);
        switch (status) {
            case "PUBLISHING":
                _stream = stream;
                playStream();
            case "FAILED":
            case "UNPUBLISHED":
                setStatus(status);
                break;

        }
    };

    currentSession.createStream({name: _streamName, mediaProvider: Flashphoner.getMediaProviders()[0], display: localVideo, cacheLocalResources: true})
        .on(STREAM_STATUS.PUBLISHING, handleStream)
        .on(STREAM_STATUS.FAILED, handleStream)
        .on(STREAM_STATUS.UNPUBLISHED, handleStream).publish();

}

//Stop stream publishing
function unPublishStream() {
    _stream.stop();
}

function playStream() {
    currentSession.createStream({name: _streamName, display: remoteVideo, cacheLocalResources: true})
        .on(STREAM_STATUS.PLAYING, function(playingStream) {
            console.log("Playing");
        }).play();
}

function stopStream() {

}

/////////////////////////////////////
///////////// Display UI ////////////
/////////////////////////////////////

// Set Connection Status
function setStatus(status) {
    if (status == "PUBLISHING") {
        $("#status").text(status).removeClass().attr("class","text-success");
        $("#publishBtn").text("Stop").removeProp('disabled');
    }

    if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        $("#status").text(status).removeClass().attr("class","text-muted");
        $("#publishBtn").text("Start").removeProp('disabled');
    }

    if (status == "FAILED") {
        $("#status").text(status).removeClass().attr("class","text-danger");
        $("#publishBtn").text("Start").removeProp('disabled');
    }
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
