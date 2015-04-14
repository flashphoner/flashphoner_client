/**
 * Created by nazar on 04.02.2015.
 */
//Init WCS JavaScript API
var f = Flashphoner.getInstance();
var stream;
var wsPlayer;

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnBinaryEvent, binaryListener);

    ConfigurationLoader.getInstance(function (configuration) {
        f.init(configuration);
        var canvas = document.getElementById('videoCanvas');
        wsPlayer = new WebsocketPlayer(canvas, function(e){
            if (e.unmute != undefined) {
                console.log("Request stream back");
                f.playStream(stream);
            } else if (e.mute != undefined) {
                f.pauseStream(stream);
                console.log("pauseStream")
            }
            }.bind(this)
        );

        wsPlayer.init(configuration);
        f.connect({appKey: "defaultApp", useRTCSessions: false, useWsTunnel: true, useBase64BinaryEncoding: false});
    });
}

function playFirstSound() {
    wsPlayer.playFirstSound();
}

//Connection Status
function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established. Press Play to get stream.');
    } else if (event.status == ConnectionStatus.Disconnected) {
        wsPlayer.stop();
        console.log("Disconnected");
    } else if (event.status == ConnectionStatus.Failed) {
        wsPlayer.stop();
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
}

//Error
function errorEvent(event) {
    console.log(event.info);
    wsPlayer.stop();
}

function playStream() {

    //play a sound to enable mobile loudspeakers
    playFirstSound();

    var stream = new Stream();
    stream.name = parseUrlId();
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

function parseUrlId() {
    var idTrans = [];
    var address = window.location.toString();
    var pattern = /https?:\/\/.*\?id\=(.*)/;
    idTrans = address.match(pattern);
    return idTrans[1];
}

$(document).ready(function () {
    $("#playButton").click(function () {
        playStream();
    });
});
