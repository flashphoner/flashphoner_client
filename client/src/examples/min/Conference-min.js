//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnDataEvent, onDataEventListener);
    f.init({localMediaElement:document.getElementById("localVideo")});
}

//New connection
function connect(){
    f.connect({urlServer:field("urlServer"), appKey:'defaultApp'});
}

//Publish stream
function publishStream(){
    var streamName = field("streamName");
    f.publishStream({name:streamName});
}

//Stop stream publishing
function unPublishStream(){
    var streamName = field("streamName");
    f.unPublishStream({name:streamName});
}

//Play stream
function playStream(streamName, elementId){
    f.playStream({name:streamName, remoteMediaElement:document.getElementById(elementId)});
}

function playStream2(){
    playStream(field("streamName"), field("remoteVideoElementId"));
}

//Stop stream playback
function stopStream(){
    var streamName = field("streamName");
    f.stopStream({name:streamName});
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established){
        trace('Connection has been established. You can start a new call.');
    }
}

//Connection Status
function streamStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established){
        trace('Connection has been established. You can start a new call.');
    }
}

/**
 * We receive data from server. If the server say that stream being published and ready, we start playback this stream
 * @param event
 */
function onDataEventListener(event){
    var operationId = event.operationId;
    var payload = event.payload;
    //stream name
    var stream = payload.stream;
    //stream creator
    var publisher = payload.publisher;
    trace("operationId: "+operationId+" stream: "+stream+" publisher: "+publisher);
    if (operationId=="streamPublishedByUser"){
        //Here we use elementId as second parameter. I.e. user1_elementId.
        playStream(stream, publisher);
    } else if (operationId == "streamUnpublishedByUser"){
        stopStream(stream);
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

//Get field
function field(name){
    var field = document.getElementById(name).value;
    return field;
}

//Set WCS URL
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
}
