///////////////////////////////////////////
//////////////Fields////////////////////

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
//////////////Initializing////////////////////

// Setup button actions
$(document).ready(function () {

    disablePlayBtn();
    disablePauseBtn();
    disableSoundBtn();

    var url = setURL();
    $("#urlServer").val(url);

    $("#connectBtn").click(function () {
        var str = $("#connectBtn").text();
        if (str == "Connect") {
            disableConnBtn();
            connect();
        } else if (str == "Disconnect") {
            disableConnBtn();
            disconnect();
        }
    });

    $("#playBtn").click(function () {
        var str = $("#playBtn").text();
        if (str == "Play") {
            if (!checkForEmptyField('#streamId', '#playForm')) { return false };
            disablePlayBtn();
            //play a sound to enable mobile loudspeakers
            playFirstSound();
            playStream();
        } else if (str == "Stop") {
            disablePlayBtn();
            stopStream();
        }
    });

    $("#pauseBtn").click(function () {
        var str = $("#pauseBtn").text();
        if (str == "Pause") {
            pause();
        } else if (str == "Resume") {
            resume();
        }
    });

    $("#soundBtn").click(function () {
        playFirstSound();
    });

    $("#infoDiv").hide();
    $("#videoCanvas").click(function(){
            if ($("#infoDiv").is(':visible')){
                $("#infoDiv").hide();
            }else{
                $("#infoDiv").show();
            }
        }
    );

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

// Init player
function initOnLoad() {

    if (detectIE()) {
        $("#notify").modal('show');
        return false;
    }

    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.MediaProviderStatusEvent, mediaProviderStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    var configuration = new Configuration();
    configuration.wsPlayerCanvas = document.getElementById('videoCanvas');
    configuration.wsPlayerReceiverPath = "../../../dependencies/websocket-player/WSReceiver2.js";
    configuration.wsPlayerDecoderPath = "../../../dependencies/websocket-player/video-worker2.js";
    f.init(configuration);
    initVisibility();

    if (urlParams.streamName) {
        connect();
    }
}

/////////////////////////////////////////////////////
///////////////Controls///////////////////////
/////////////////////////////////////////////////////

// Connect signaling part
function connect(url) {
    var urlServer = url || $("#urlServer").val();
    //connect to server
    f.connect({
        urlServer: urlServer,
        appKey: "defaultApp",
        useWsTunnel: true,
        useWsTunnelPacketization2: true,
        useBase64BinaryEncoding: false,
        width: config.videoWidth,
        height: config.videoHeight
    });
}

// Disconnect
function disconnect() {
    f.disconnect();
}

function playFirstSound() {
    f.playFirstSound();
    $("#soundBtn").remove();
}

function playStream(streamName) {
    var stream = new Stream();
    stream.name = streamName || document.getElementById("streamId").value;
    stream.hasVideo = true;
    stream.mediaProvider = MediaProvider.WSPlayer;
    this.stream = f.playStream(stream);
}

function stopStream() {
    f.stopStream(stream);
}

function pause(){
    disablePauseBtn();
    f.pauseStream(stream);
}

function resume(){
    disablePauseBtn();
    f.playStream(stream);
}

function writeInfo(str) {
    var div = document.getElementById('infoDiv');
    div.innerHTML = div.innerHTML + str + "<BR>";
}

///////////////////////////////////////////
//////////////Listeners////////////////////

//Connection Status
function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established. Press Play to get stream.');
        writeInfo("CONNECTED, press play");
        displayConnectionEstablished();
        if (urlParams.streamName) {
            playStream(urlParams.streamName);
        }
    } else if (event.status == ConnectionStatus.Disconnected) {
        console.log("Disconnected");
        writeInfo("DISCONNECTED");
        displayConnectionDisconnected();
    } else if (event.status == ConnectionStatus.Failed) {
        writeInfo("CONNECTION FAILED");
        f.disconnect();
        displayConnectionFailed();
    }

    setStatus(event.status);
}

function mediaProviderStatusListener(e) {
    console.log("mediaProvider " + e.mediaProvider + " status " + e.status);
}

//Stream Status
function streamStatusListener(event) {
    console.log(event.status);
    switch (event.status) {
        case StreamStatus.Failed:
        case StreamStatus.Stoped:
            displayStreamStopped();
            break;
        case StreamStatus.Playing:
            if (event.info == "FIRST_FRAME_RENDERED") {
                console.log(event.info);
            }
            displayStreamPlaying();
            break;
        case StreamStatus.Paused:
            displayStreamPaused();
            break;
    }
    writeInfo("Stream " + event.status);
    this.stream.status = event.status;
    setStreamStatus(event.status);
}

//Error listener
function errorEvent(event) {
    console.log(event.info);
}

///////////////////////////////////////////
//////////////Display UI////////////////////

// Set Connection Status
function setStatus(status) {

    $("#connStatus").text(status);
    $("#connStatus").className='';

    if (status == "ESTABLISHED") {
        $("#connStatus").attr("class","text-success");
    }

    if (status == "DISCONNECTED") {
        $("#connStatus").attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#connStatus").attr("class","text-danger");
    }
}

// Set Stream Status
function setStreamStatus(status) {

    if (status == StreamStatus.PlaybackProblem) {
        $("#playbackStatus").text(status);
        $("#playbackStatus").className = '';
        $("#playbackStatus").attr("class", "text-danger");
        $("#playbackStatus").show();
        setTimeout(function() {
            $("#playbackStatus").hide();
        },3000);
    } else {
        $("#streamStatus").text(status);
        $("#streamStatus").className = '';
    }

    if (status == "FAILED") {
        $("#streamStatus").attr("class","text-danger");
    }

    if (status == "STOPPED") {
        $("#streamStatus").attr("class","text-muted");
    }

    if (status == "PLAYING") {
        $("#streamStatus").attr("class","text-success");
    }

    if (status == "PAUSED") {
        $("#streamStatus").attr("class","text-primary");
    }
}

// Display connection state
function displayConnectionDisconnected(){
    //Display DISCONNECTED state
    enableConnBtn();
    disablePauseBtn();
    disablePlayBtn();
    setStreamStatus("");
    $("#pauseBtn").text("Pause");
    $("#playBtn").text("Play");
    $("#connectBtn").text("Connect");
}

function displayConnectionFailed(){
    //Display FAILED state
    enableConnBtn();
    $("#connectBtn").text("Connect");
}

// Display stream state
function displayConnectionEstablished(){
    // Display ESTABLISHED state
    enablePlayBtn();
    enableConnBtn();
    $("#connectBtn").text("Disconnect");
}

function displayStreamStopped(){
    // Display stream stopped state
    $("#playBtn").text("Play");
    enablePlayBtn();
    disablePauseBtn();
    $("#pauseBtn").text("Pause");
}

function displayStreamPlaying(){
    // Display stream playing state
    $("#playBtn").text("Stop");
    enablePlayBtn();
    enablePauseBtn();
    $("#pauseBtn").text("Pause");
    if (urlParams.streamName){
        enableSoundBtn();
    }

}

function displayStreamPaused(){
    // Display stream paused State
    enablePauseBtn();
    $("#pauseBtn").text("Resume");
}

// Enable disable buttons: connectionBtn, playBtn, pauseBtn
function enableConnBtn(){
    $("#connectionBtn").prop("disabled", false);
}

function disableConnBtn(){
    $("#connectionBtn").prop("disabled", true);
}

function enablePauseBtn(){
    $("#pauseBtn").prop("disabled", false);
}

function disablePauseBtn(){
    $("#pauseBtn").prop("disabled", true);
}

function disableSoundBtn(){
    $("#soundBtn").prop("disabled", true);
}

function enableSoundBtn(){
    $("#soundBtn").prop("disabled", false);
}

function enablePlayBtn(){
    $("#playBtn").prop("disabled", false);
}

function disablePlayBtn(){
    $("#playBtn").prop("disabled", true);
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

var urlParams;
(window.onpopstate = function () {
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    urlParams = {};
    while (match = search.exec(query))
        urlParams[decode(match[1])] = decode(match[2]);
})();

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