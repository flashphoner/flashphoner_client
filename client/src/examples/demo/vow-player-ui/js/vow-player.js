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

//Current stream
var stream = {};

///////////////////////////////////////////
//////////////Init////////////////////

$(document).ready(function () {
    $("#controlButton").addClass("playButton");
    $(".control").click(function () {
        if (stream.status != undefined
            && stream.status != StreamStatus.Stoped
            && stream.status != StreamStatus.Failed) {
            return;
        }
        playStream();
    });
});

function initOnLoad() {
    if (detectIE()) {
        $("#notify").modal('show');
        return false;
    }
    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    var configuration = new Configuration();
    configuration.wsPlayerCanvas = document.getElementById('videoCanvas');
    configuration.wsPlayerReceiverPath = "../../../dependencies/websocket-player/WSReceiver.js";
    configuration.videoWidth = 320;
    configuration.videoHeight = 240;
    f.init(configuration);
    initVisibility();

    //connect to server
    f.connect({
        urlServer: url,
        appKey: "defaultApp",
        useWsTunnel: true,
        useBase64BinaryEncoding: false,
        width: config.videoWidth,
        height: config.videoHeight
    });
}

///////////////////////////////////////////
//////////////Listeners////////////////////
function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established. Press Play to get stream.');
        writeInfo("CONNECTED, press play");
    } else if (event.status == ConnectionStatus.Disconnected) {
        console.log("Disconnected");
        writeInfo("DISCONNECTED");
    } else if (event.status == ConnectionStatus.Failed) {
        writeInfo("CONNECTION FAILED");
        f.disconnect();
    }
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
    var streamId = document.getElementById("streamId");
    if (event.status == StreamStatus.Failed || event.status == StreamStatus.Stoped) {
        onFailed();
        streamId.disabled = false;
    } else if (event.status == StreamStatus.Playing){
        onPlaying();
        streamId.disabled = true;
    } else if (event.status == StreamStatus.Paused){
        onPaused();
        streamId.disabled = true;
    }
    writeInfo("Stream " + event.status);
    this.stream.status = event.status;
}

//Error
function errorEvent(event) {
    console.log(event.info);
}


///////////////////////////////////////////
//////////////Controls////////////////////


function playFirstSound() {
    f.playFirstSound();
}

function playStream() {
    //play a sound to enable mobile loudspeakers
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

///////////////////////////////////////////
//////////////Display UI////////////////////

function onPlaying(){
    $("#controlButton").removeClass("playButton");
    $("#controlButton").addClass("pauseButton");
    $("#controlButton").unbind();
    $("#controlButton").click(function () {
        f.pauseStream(stream);
    });
}

function onFailed(){
    $("#controlButton").addClass("playButton");
    $("#controlButton").unbind();
}

function onPaused(){
    $("#controlButton").removeClass("pauseButton");
    $("#controlButton").addClass("playButton");
    $("#controlButton").unbind();
    $("#controlButton").click(function () {
        f.playStream(stream);
    });
}

/////////////////////////////////////////////////////
///////////////Page visibility///////////////////////

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


/////////////////////////////////////////////////////
///////////////Utils/////////////////////////////////

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
