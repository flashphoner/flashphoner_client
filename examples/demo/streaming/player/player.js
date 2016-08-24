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
        .on(STREAM_STATUS.RESIZE, function(playingStream){
            var dimension = playingStream.getStreamDimension();
            var W = dimension.width;
            var H = dimension.height;
            console.log("Got native resolution " + W + "x" + H);

            if (Flashphoner.getMediaProviders()[0] == "Flash") {
                document.getElementById(playingStream.id()).resize(W,H);
            }
            if (W > remoteVideo.offsetWidth && H > remoteVideo.offsetHeight) {
                var scale = Math.max(W / 800, H / 400);
                var rescale = Math.floor(W / scale) + "px";
                if (Flashphoner.getMediaProviders()[0] == "WebRTC") {
                    document.getElementsByTagName("video")[0].setAttribute('width', rescale);
                    document.getElementsByTagName("video")[0].setAttribute('height', 400);
                }
                d.style.width = rescale;
                d.style.height = 400 + "px";
                d.style.margin = "0 auto";
            } else {
                var marginTop = (400 - H) / 2 + "px";
                d.style.width = W + "px";
                d.style.height = H + "px";
                d.style.margin = marginTop + " auto";
            }
        }).play();
}

function stopStream() {
    _stream.stop();
}

/////////////////////////////////////
///////////// Display UI ////////////
/////////////////////////////////////

// Set Connection Status
function setStatus(status) {
    if (status == "PLAYING") {
        $("#status").text(status).removeClass().attr("class","text-success");
        $("#playBtn").text("Stop");
        $("#streamName").prop("disabled",true);
        $("#url").prop("disabled",true);
    }

    if (status == "DISCONNECTED" || status == "STOPPED") {
        $("#status").text(status).removeClass().attr("class","text-muted");
        $("#playBtn").text("Start");
        $("#streamName").removeProp("disabled");
        $("#url").removeProp("disabled");
    }

    if (status == "FAILED") {
        $("#status").text(status).removeClass().attr("class","text-danger");
        $("#playBtn").text("Start");
        $("#streamName").removeProp("disabled");
        $("#url").removeProp("disabled");
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
