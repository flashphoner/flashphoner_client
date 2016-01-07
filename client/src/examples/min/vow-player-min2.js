//Prepare config
var config = new Configuration();

//Video width resolution
config.videoWidth = 320;

//Video height resolution
config.videoHeight = 240;

//Web Call Server Websocket URL
var url = setURL();

//The stream name can be an RTSP URL for playback
//Example: rtsp://192.168.1.5:1935/live/stream1
var streamName;

//The streamName can be also WebRTC stream ID. Example:
//var streamName = "XP34dq6aqJK0V09o5RbU";

//Get API instance
var f = Flashphoner.getInstance();

//get player instance
var wsPlayer;

//Current stream
var stream = {};

var loadInterval;
function loadMainThread() {
    for (var i=0; i<=15000; i++) {
        factorial(10000);
    }
    function factorial(n) {
        return n ? n * factorial(n - 1) : 1;
    }
}

function initOnLoad() {
    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.init();

    //create player
    var canvas = document.getElementById('videoCanvas');
    wsPlayer = new WSPlayer(canvas);
    wsPlayer.initLogger(3);

    //connect to server
    f.connect({
        urlServer: url,
        appKey: "defaultApp",
        useWsTunnel: true,
        useBase64BinaryEncoding: false,
        width: config.videoWidth,
        height: config.videoHeight
    });
    initVisibility();
}

///////////////////////////////////////////
//////////////Listeners////////////////////
function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established. Press Play to get stream.');
        writeInfo("CONNECTED, press play");
        //init wsPlayer
        config.token = f.connection.authToken;
        config.urlWsServer = url;
        wsPlayer.init(config);
    } else if (event.status == ConnectionStatus.Disconnected) {
        wsPlayer.stop();
        console.log("Disconnected");
        writeInfo("DISCONNECTED");
    } else if (event.status == ConnectionStatus.Failed) {
        wsPlayer.stop();
        writeInfo("CONNECTION FAILED");
        f.disconnect();
    }
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
    switch (event.status) {
        case StreamStatus.Failed:
        case StreamStatus.Stoped:
            wsPlayer.stop();
            $("#playButton").text("Play");
            $("#pauseButton").text("Pause");
            $("#pauseButton").prop("disabled", true);
            $("#playButton").prop("disabled", false);
            $("#loadButton").prop("disabled", true);
            break;
        case StreamStatus.Playing:
            $("#playButton").text("Stop");
            $("#pauseButton").text("Pause");
            $("#pauseButton").prop("disabled", false);
            $("#playButton").prop("disabled", false);
            $("#loadButton").prop("disabled", false);
            break;
        case StreamStatus.Paused:
            $("#pauseButton").text("Resume");
            $("#pauseButton").prop("disabled", false);
            break;
    }
    writeInfo("Stream " + event.status);
    this.stream.status = event.status;
}

//Error
function errorEvent(event) {
    console.log(event.info);
    wsPlayer.stop();
}
//////////////////////////////////////////

function playFirstSound() {
    wsPlayer.playFirstSound();
}

function stopStream() {
    f.stopStream(stream);
}

function playStream() {
    //play a sound to enable mobile loudspeakers
    playFirstSound();
    var stream = new Stream();
    stream.name = document.getElementById("streamId").value;
    stream.hasVideo = true;
    stream.sdp = "v=0\r\n" +
    "o=- 1988962254 1988962254 IN IP4 0.0.0.0\r\n" +
    "c=IN IP4 0.0.0.0\r\n" +
    "t=0 0\r\n" +
    "a=sdplang:en\r\n"+
    "m=video 0 RTP/AVP 32\r\n" +
    "a=rtpmap:32 MPV/90000\r\n" +
    "a=recvonly\r\n" +
    "m=audio 0 RTP/AVP 0\r\n" +
    "a=rtpmap:0 PCMU/8000\r\n" +
    "a=recvonly\r\n";
    stream.mediaProvider = "WebRTC";
    this.stream = f.playStream(stream);
    wsPlayer.play();
}

function writeInfo(str) {
    var div = document.getElementById('infoDiv');
    div.innerHTML = div.innerHTML + str + "<BR>";
}

/////////////////////////////////////////////////////
///////////////Page visibility///////////////////////
/////////////////////////////////////////////////////

var hidden = undefined;
function initVisibility() {
    var visibilityChange;
    if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
        this.hidden = "hidden";
        visibilityChange = "visibilitychange";
    } else if (typeof document.mozHidden !== "undefined") {
        this.hidden = "mozHidden";
        visibilityChange = "mozvisibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
        this.hidden = "msHidden";
        visibilityChange = "msvisibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
        this.hidden = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
    }
    if (typeof this.hidden === "undefined") {
        console.error("Visibility API not supported, player will continue to play when in background");
    } else {
        document.addEventListener(visibilityChange, visibilityHandler.bind(this), false);
    }
}

function visibilityHandler() {
    if (document[this.hidden]) {
        console.log("Document hidden, mute player");
        if (wsPlayer && stream && stream.status == StreamStatus.Playing) {
            wsPlayer.mute(true);
        }
    } else {
        console.log("Document active, unmute player");
        if (wsPlayer && stream && stream.status == StreamStatus.Playing) {
            wsPlayer.mute(false);
        }
    }
}


$(document).ready(function () {
    $("#pauseButton").prop("disabled", true);
    $("#playButton").prop("disabled", false);
    $("#loadButton").prop("disabled", true);
    $("#playButton").click(function () {
        var str = $("#playButton").text();
        if (str == "Play") {
            if (document.getElementById("streamId").value) {
                $("#playButton").prop("disabled", true);
                playStream();
            }
        } else if (str == "Stop") {
            stopStream();
        }
    });

    $("#pauseButton").click(function () {
        var str = $("#pauseButton").text();
        console.log("stream status " + stream.status);
        if (str == "Pause") {
            $("#pauseButton").prop("disabled", true);
            wsPlayer.pause();
            f.pauseStream(stream);
        } else if (str == "Resume") {
            $("#pauseButton").prop("disabled", true);
            wsPlayer.resume();
            f.playStream(stream);
        }
    });

    $("#loadButton").click(function () {
        var str = $("#loadButton").text();
        if (str == "Load") {
            loadInterval = setInterval(function(){loadMainThread()}, 30000);
            $("#loadButton").text("Unload");
        } else if (str == "Unload") {
            clearInterval(loadInterval);
            $("#loadButton").text("Load");
        }
    });
});

//set WCS URL
function setURL() {
    var proto;
    var url;
    var port;
    if (window.location.protocol == "http:") {
        proto = "ws://";
        port = "8080";
    } else {
        proto = "wss://";
        port = "8443";
    }

    url = proto + window.location.hostname + ":" + port;
    return url;
}