$(document).ready(function() {
    $("#pauseButton").prop("disabled", true);
    $("#playButton").prop("disabled", false);
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
        } else if (str == "Resume") {
            $("#pauseButton").prop("disabled", true);
            wsPlayer.resume();
        }
    });
    $("#connectBtn").click(function () {
            var state = $("#connectBtn").text();
            if (state == "Connect") {
                connect();
            } else {
                disconnect();
            }
        }
    );
});

//Prepare config
var config = new Configuration();

//Video width resolution
config.videoWidth = 320;

//Video height resolution
config.videoHeight = 240;

//Web Call Server Websocket URL
//var url = setURL();

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

function initOnLoad() {
    setURL();
    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnBinaryEvent, binaryListener);
    f.init();

    //create player
    var canvas = document.getElementById('videoCanvas');
    wsPlayer = new WebsocketPlayer(canvas, function(e){
            if (e.unmute != undefined) {
                if (this.stream.status == StreamStatus.Paused) {
                    f.playStream(this.stream);
                    console.log("Request stream back");
                }
            } else if (e.mute != undefined) {
                if (this.stream.status == StreamStatus.Playing) {
                    f.pauseStream(this.stream);
                    console.log("pauseStream")
                }
            }
        }.bind(this),
        function (str) {
            this.writeInfo(str);
        }.bind(this)
    );
    wsPlayer.init(config);

}

//Connect
function connect() {
    f.connect({
        urlServer: field("urlServer"),
        appKey: "defaultApp",
        useWsTunnel: true,
        useBase64BinaryEncoding: false,
        width: config.videoWidth,
        height: config.videoHeight
    });
}

//Disconnect
function disconnect() {
    f.disconnect();
}

///////////////////////////////////////////
//////////////Listeners////////////////////
function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established. Press Play to get stream.');
        $("#connectBtn").removeClass("btn-success").addClass("btn-danger");
        $("#connectBtn").text("Disconnect");
        $("#connectionStatus").text(event.status);
    } else if (event.status == ConnectionStatus.Disconnected) {
        wsPlayer.stop();
        console.log("Disconnected");
        $("#connectionStatus").text(event.status);
        $("#connectBtn").removeClass("btn-danger").addClass("btn-success");
        $("#connectBtn").text("Connect");
    } else if (event.status == ConnectionStatus.Failed) {
        $("#connectBtn").removeClass("btn-danger").addClass("btn-success");
        $("#connectBtn").text("Connect");
        wsPlayer.stop();
        $("#connectionStatus").text("CONNECTION FAILED");
        f.disconnect();
    }
}

function binaryListener(event) {
    wsPlayer.onDataReceived(event);
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
    var playStatus = document.getElementById("playStatus");
    switch (event.status) {
        case StreamStatus.Failed:
        case StreamStatus.Stoped:
            wsPlayer.stop();
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
            break;
        case StreamStatus.Paused:
            $("#pauseButton").text("Resume");
            $("#pauseButton").prop("disabled", false);
            break;
    }
    playStatus.innerHTML = "Stream " + event.status;
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

function pauseStream() {
    f.pauseStream(stream);
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
    this.stream = f.playStream(stream);
}

function writeInfo(str) {
    var div = document.getElementById('infoDiv');
    div.innerHTML = div.innerHTML + str + "<BR>";
}

//set WCS URL
function setURL() {
    var proto;
    var url;
    var port;
    if (window.location.protocol == "http:") {
        proto = "ws://"
        port = "8080"
    } else {
        proto = "wss://"
        port = "8443"
    }

    url = proto + window.location.hostname + ":" + port;
    document.getElementById("urlServer").value = url;
    //return url;
}

//Get field
function field(name){
    var field = document.getElementById(name).value;
    return field;
}