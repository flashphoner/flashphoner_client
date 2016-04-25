//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {
    setURL();
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.localMediaElementId = 'localVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";
    f.init(configuration);

    if (webrtcDetectedBrowser) {
        document.getElementById('remoteVideo').style.visibility = "visible";
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
    } else {
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "visible";
    }
}

//New connection
function connect(){
    f.connect({urlServer:field("urlServer"), appKey:'defaultApp'});
}

//Publish stream
function publishStream(){
    var streamName = field("streamName");
    f.publishStream({name:streamName, record:true});
}

//Stop stream publishing
function unPublishStream(){
    var streamName = field("streamName");
    f.unPublishStream({name:streamName});
}

//Play stream
function playStream(){
    var streamName = field("streamName");
    f.playStream({name:streamName});
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
