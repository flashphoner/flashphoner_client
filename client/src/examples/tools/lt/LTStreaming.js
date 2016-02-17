//Init WCS JavaScript API
var f = Flashphoner.getInstance();
var pStream;
var sStream;
var wsPlayer;
var wsPlayerEnabled = false;

function initAPI() {
    wsPlayerEnabled = getURLParameter("wsPlayerEnabled");
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnDataEvent, dataEventListener);
    f.addListener(WCSEvent.OnBinaryEvent, binaryListener);

    ConfigurationLoader.getInstance(function (configuration) {
        configuration.remoteMediaElementId = 'remoteVideo';
        configuration.localMediaElementId = 'localVideo';
        configuration.elementIdForSWF = "flashVideoDiv";
        configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";

        if (wsPlayerEnabled) {
            configuration.wsPlayerCanvas = document.getElementById('videoCanvas');
            configuration.wsPlayerReceiverPath = "../../../dependencies/websocket-player/WSReceiver.js";
            configuration.videoWidth = 320;
            configuration.videoHeight = 240;
        }
        f.init(configuration);
        if (webrtcDetectedBrowser) {
            console.log("WebRTC browser");
            document.getElementById('remoteVideo').style.visibility = "visible";
            document.getElementById('flashVideoWrapper').style.visibility = "hidden";
            document.getElementById('flashVideoDiv').style.visibility = "hidden";
        } else {
            document.getElementById('remoteVideo').style.visibility = "hidden";
            document.getElementById('flashVideoWrapper').style.visibility = "visible";
        }
        connect();
    });

}

function initWsPlayer() {
    if (wsPlayer) {
        wsPlayer.reset();
    } else {
        var canvas = document.getElementById('videoCanvas');
        wsPlayer = new WebsocketPlayer(canvas, function (e) {},
            function (str) {
                this.trace(str);
            }.bind(this)
        );
        var config = new Configuration();
        config.videoWidth = f.configuration.videoWidth;
        config.videoHeight = f.configuration.videoHeight;
        wsPlayer.init(config);
    }
}

function dataEventListener(event) {
    console.dir(event);
    var method = event.payload.method;
    var streamId = event.payload.streamId;
    if (method == "publishStream") {
        publishStream();
    } else if (method == "playStream") {
        playStream();
    } else if (method == "unPublishStream") {
        unPublishStream(streamId);
    } else if (method == "stopStream") {
        stopStream(streamId);
    } else if (method == "reload") {
        window.location.reload(false);
    }

}

function binaryListener(event) {
    if (wsPlayerEnabled) {
        wsPlayer.onDataReceived(event);
    }
}

//New connection
function connect(){
    var config = {};
    config.appKey = "loadToolStreamingApp";
    if (wsPlayerEnabled) {
        config.useWsTunnel = true;
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
        document.getElementById('videoCanvas').style.visibility = "visible";
    }
    f.connect(config);
}

//Publish stream
function publishStream(){
    var streamName = createUUID();
    f.publishStream({name:streamName});
}

//Stop stream publishing
function unPublishStream(name){
    pStream.name = name;
    f.unPublishStream(pStream);
}

//Play stream
function playStream(){
    var stream = {};
    stream.name = createUUID();
    if (wsPlayerEnabled) {
        //initWsPlayer();
        stream.mediaProvider = MediaProvider.WSPlayer;
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
    }
    f.playStream(stream);
}

//Stop stream playback
function stopStream(name){
    sStream.name = name;
    f.stopStream(sStream);
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established){
        trace('Connection has been established. You can start a new call.');
    }
    updateStatus();
}

function streamStatusListener(event) {
    trace(event.status);
    if (event.status == StreamStatus.Playing) {
        sStream = event;
    } else if (event.status == StreamStatus.Publishing) {
        pStream = event;
    }
    updateStatus();
}

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
}

//Error
function errorEvent(event) {
    trace(event.info);
}

//Trace
function trace(str){
    console.log(str);
}

function updateStatus() {
    var publish = document.getElementById("pInfo");
    var subscribe = document.getElementById("sInfo");
    publish.innerHTML = "PUBLISH:";
    publish.innerHTML += pStream != undefined ? pStream.name + ":" + pStream.status : "NO STREAM";
    subscribe.innerHTML = "SUBSCRIBE:";
    subscribe.innerHTML += sStream != undefined ? sStream.name + ":" + sStream.status : "NO STREAM";
}

