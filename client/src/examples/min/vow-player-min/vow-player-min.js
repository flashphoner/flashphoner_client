//Prepare config
var config = new Configuration();

//Video width resolution
config.videoWidth = 320;

//Video height resolution
config.videoHeight = 240;

//The stream name can be an RTSP URL for playback
//Example: rtsp://192.168.1.5:1935/live/stream1
var streamName;

//The streamName can be also WebRTC stream ID. Example:
//var streamName = "XP34dq6aqJK0V09o5RbU";

//Get API instance
var f = Flashphoner.getInstance();

//Current stream
var stream = {};

///////////////////////////////////////////
//////////////Init////////////////////
///////////////////////////////////////////

$(document).ready(function () {
    $("#pauseButton").prop("disabled", true);
    $("#playButton").prop("disabled", true);
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
            pause();
        } else if (str == "Resume") {
            $("#pauseButton").prop("disabled", true);
            resume();
        }
    });

    $("#connectButton").click(function () {
        var str = $("#connectButton").text();
        if (str == "Connect") {
            connect();
        } else if (str == "Disconnect") {
            disconnect();
        }
    });
});

// Init player
function initOnLoad() {

    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    var configuration = new Configuration();
    configuration.wsPlayerCanvas = document.getElementById('videoCanvas');
    configuration.wsPlayerReceiverPath = "../../../dependencies/websocket-player/WSReceiver.js";
    f.init(configuration);
    initVisibility();
}

///////////////////////////////////////////
//////////////Listeners////////////////////
///////////////////////////////////////////

function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established. Press Play to get stream.');
        writeInfo("CONNECTED, press play");
        $("#connectButton").text("Disconnect");
        $("#playButton").prop("disabled", false);
    } else if (event.status == ConnectionStatus.Disconnected) {
        console.log("Disconnected");
        writeInfo("DISCONNECTED");
        $("#connectButton").text("Connect");
        $("#playButton").prop("disabled", true);
        $("#pauseButton").prop("disabled", true);
        $("#pauseButton").text("Pause");
        $("#playButton").text("Play");
    } else if (event.status == ConnectionStatus.Failed) {
        writeInfo("CONNECTION FAILED");
        f.disconnect();
        $("#connectButton").text("Connect");
        $("#playButton").prop("disabled", true);
        $("#playButton").text("Play");
        $("#pauseButton").prop("disabled", true);
        $("#pauseButton").text("Pause");
    }
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
    switch (event.status) {
        case StreamStatus.Failed:
        case StreamStatus.Stoped:
            $("#playButton").text("Play");
            $("#pauseButton").text("Pause");
            $("#pauseButton").prop("disabled", true);
            $("#playButton").prop("disabled", false);
            break;
        case StreamStatus.Playing:
            $("#playButton").text("Stop");
            $("#pauseButton").text("Pause");
            $("#pauseButton").prop("disabled", false);
            $("#playButton").prop("disabled", false);
            if (event.info == "FIRST_FRAME_RENDERED") {
                console.log(event.info);
            }
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
}


/////////////////////////////////////////////////////
///////////////Controls//////////////////////////////
/////////////////////////////////////////////////////

// Connect signaling part
function connect(url) {
    var urlServer = $("#urlServer").val();
    //connect to server
    f.connect({
        urlServer: urlServer,
        appKey: "defaultApp",
        useWsTunnel: true,
        useBase64BinaryEncoding: false,
        width: config.videoWidth,
        height: config.videoHeight
    });
}

function playFirstSound() {
    f.playFirstSound();
}

function stopStream() {
    f.stopStream(stream);
}

function pause(){
    f.pauseStream(stream);
}

function resume(){
    f.playStream(stream);
}

// Disconnect
function disconnect() {
    f.disconnect();
}

function playStream(streamName) {
    playFirstSound();
    var stream = new Stream();
    stream.name = document.getElementById("streamId").value;
    stream.hasVideo = true;
    stream.mediaProvider = MediaProvider.WSPlayer;
    this.stream = f.playStream(stream);
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
        f.mute(MediaProvider.WSPlayer);
    } else {
        console.log("Document active, unmute player");
        f.unmute(MediaProvider.WSPlayer);
    }
}