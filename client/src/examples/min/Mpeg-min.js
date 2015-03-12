/**
 * Created by nazar on 04.02.2015.
 */
//Init WCS JavaScript API
var f = Flashphoner.getInstance();
var stream;
var player;
var audioPlayer;
var avReceiver;

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnBinaryEvent, binaryListener);
    ConfigurationLoader.getInstance(function (configuration) {
        f.init(configuration);
        avReceiver = new AVReceiver(player, audioPlayer);
        avReceiver.initPlayers();
        connect();
    });
}

function playFirstSound() {
    var audioBuffer = avReceiver.audioPlayer.context.createBuffer(1, 441, 44100);
    var output = audioBuffer.getChannelData(0);
    for (var i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    var src = avReceiver.audioPlayer.context.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(avReceiver.audioPlayer.context.destination);
    src.start(0);
}

function connect() {
    f.connect({appKey: "defaultApp", useRTCSessions: false, useWsTunnel: true, useBase64BinaryEncoding: false});
}

//Connection Status
function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established. Retrieve stream');
        playStream();
    } else if (event.status == ConnectionStatus.Disconnected) {
        avReceiver.stop();
        console.log("Disconnected");
    } else if (event.status == ConnectionStatus.Failed) {
        avReceiver.stop();
        f.disconnect();
    }
}

function binaryListener(event) {
    avReceiver.onDataReceived(event);
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
    if (event.status == StreamStatus.Failed) {
        avReceiver.stop();
    } else if (event.status == StreamStatus.Stoped) {
        avReceiver.stop();
    }
}

//Error
function errorEvent(event) {
    console.log(event.info);
    player.stop();
    audioPlayer.stop();
}

function playStream() {
    var stream = new Stream();
    stream.name = parseUrlId();
    stream.hasVideo = true;
    stream.sdp = "v=0\r\n" +
        "o=- 1988962254 1988962254 IN IP4 192.168.56.1\r\n" +
        "c=IN IP4 192.168.56.1\r\n" +
        "t=0 0\r\n" +
    "a=sdplang:en\r\n"+
    "a=range:npt=now-\r\n" +
    "a=control:*\r\n" +

    "m=video 6000 RTP/AVP 32\r\n" +
        "a=rtpmap:32 MPV/90000\r\n" +
        "a=recvonly\r\n" +
    "m=audio 6002 RTP/AVP 0\r\n" +
    "a=rtpmap:0 PCMU/8000\r\n" +
    "a=recvonly\r\n";
    this.stream = stream;
    f.playStream(stream);
}

function parseUrlId() {
    var idTrans = [];
    var address = window.location.toString();
    var pattern = /https?:\/\/.*\?id\=(.*)/;
    idTrans = address.match(pattern);
    return idTrans[1];
}

$(document).ready(function () {
    $("#enableAudio").click(function () {
        playFirstSound();
    });
});
