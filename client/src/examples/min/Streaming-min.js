//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.init();
}

//New connection
function connect(){
    f.connect({urlServer:field("urlServer"), appKey:'defaultApp'});
}

//Publish stream
function publishStream(){
    var streamName = field("streamName");
    f.publishStream({name:streamName, hasVideo:false});
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
