/**
 * Created by nazar on 04.02.2015.
 */
//Init WCS JavaScript API
var f = Flashphoner.getInstance();
var stream;
var player;
function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnBinaryEvent, binaryListener);
    f.init();
    connect();
    initMpeg();
}

function initMpeg() {
    // Show loading notice
    var canvas = document.getElementById('videoCanvas');
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#444';
    ctx.fillText('Loading...', canvas.width/2-30, canvas.height/3);

    this.player = new jsmpeg(null, {canvas:canvas});
    player.initSocketClient();
}

function connect() {
    f.connect({urlServer: "ws://192.168.56.2:8080", appKey: "defaultApp", useRTCSessions: false});
}

//Connection Status
function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established. Retrieve stream');
        playStream();
    } else if (event.status == ConnectionStatus.Disconnected) {
        console.log("Disconnected");
    }
}

function binaryListener(event) {
    player.receiveSocketMessage(event);
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
    if (event.status == StreamStatus.Failed) {
        player.stop();
    }
}

//Error
function errorEvent(event) {
    console.log(event.info);
    player.stop();
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
        "a=recvonly\r\n";
    this.stream = stream;
    f.playStream(stream);

    //trigger decodeSocketHeader
    var event = {};
    event.data = 0;
    binaryListener(event);

}

function parseUrlId() {
    var idTrans = [];
    var address = window.location.toString();
    var pattern = /https?:\/\/.*\?id\=(.*)/;
    idTrans = address.match(pattern);
    return idTrans[1];
}