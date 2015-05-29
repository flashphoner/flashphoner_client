//Prepare config
var config = new Configuration();

//Video width resolution
config.videoWidth = 320;

//Video height resolution
config.videoHeight = 240;

//Web Call Server Websocket URL
var url = "ws://192.168.1.5:8080";

//The stream name can be an RTSP URL for playback
var streamName = "rtsp://192.168.1.5:1935/live/stream1";

//The streamName can be also WebRTC stream ID. Example:
//var streamName = "XP34dq6aqJK0V09o5RbU";

//Get API instance
var f = Flashphoner.getInstance();

//get player instance
var wsPlayer;

//Current stream
var stream = {};

//todo it is a workaround
var enableSyncDelay = true;

var waitForSync = true;

function initOnLoad() {
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

    //connect to server
    f.connect({
        urlServer: url,
        appKey: "defaultApp",
        useRTCSessions: false,
        useWsTunnel: true,
        useBase64BinaryEncoding: false
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
        wsPlayer.stop();
        console.log("Disconnected");
        writeInfo("DISCONNECTED");
    } else if (event.status == ConnectionStatus.Failed) {
        wsPlayer.stop();
        writeInfo("CONNECTION FAILED");
        f.disconnect();
    }
}

function binaryListener(event) {
    wsPlayer.onDataReceived(event);
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
    if (event.status == StreamStatus.Failed) {
        wsPlayer.stop();
    } else if (event.status == StreamStatus.Stoped) {
        wsPlayer.stop();
    }
    writeInfo("Stream " + event.status);
    this.stream.status = event.status;
    syncDelay();
}

//Pause and play stream at the beginning to wait audio video sync
//todo replace this workaround
function syncDelay(){
    if (enableSyncDelay){
        if (this.stream.status == "PLAYING"){
            if (waitForSync == true){
                document.getElementById("videoCanvas").style.visibility = "hidden";
                setTimeout(beginWaitForSync,5000);
            }
        } else if (this.stream.status == "PAUSED"){
            if (waitForSync == true){
                waitForSync = false;
                setTimeout(endWaitForSync,5000);
            }
        }
    }
}

function beginWaitForSync(){
    writeInfo("beginWaitForSync");
    wsPlayer.pause();
}

function endWaitForSync(){
    writeInfo("endWaitForSync");
    document.getElementById("videoCanvas").style.visibility = "visible";
    wsPlayer.resume();
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

function playStream() {
    //play a sound to enable mobile loudspeakers
    playFirstSound();
    var stream = new Stream();
    stream.name = streamName;
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

$(document).ready(function () {
    $("#playButton").click(function () {
        if (stream.status != undefined && stream.status != StreamStatus.Stoped) {
            return;
        }
        playStream();
    });

    $("#pauseButton").click(function () {
        var str = $("#pauseButton").text();
        console.log("stream status " + stream.status);
        if (str == "Pause") {
            if (stream.status != StreamStatus.Stoped) {
                wsPlayer.pause();
                $("#pauseButton").text("Resume");
            }
        } else if (str == "Resume") {
            wsPlayer.resume();
            $("#pauseButton").text("Pause");
        }
    });
});