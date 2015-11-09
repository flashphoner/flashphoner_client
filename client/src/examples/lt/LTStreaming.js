//Init WCS JavaScript API
var f = Flashphoner.getInstance();
var pStream;
var sStream;

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnDataEvent, dataEventListener);
    ConfigurationLoader.getInstance(function (configuration) {
        configuration.remoteMediaElementId = 'remoteVideo';
        configuration.localMediaElementId = 'localVideo';
        configuration.elementIdForSWF = "flashVideoDiv";
        configuration.pathToSWF = "../../dependencies/flash/MediaManager.swf";
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

//New connection
function connect(){
    f.connect({appKey:'loadToolStreamingApp'});
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
    var streamName = createUUID();
    f.playStream({name:streamName});
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
}

function streamStatusListener(event) {
    trace(event.status);
    if (event.status == StreamStatus.Playing) {
        sStream = event;
    } else if (event.status == StreamStatus.Publishing) {
        pStream = event;
    }
}

//Error
function errorEvent(event) {
    trace(event.info);
}

//Trace
function trace(str){
    console.log(str);
}

