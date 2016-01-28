$(document).ready(function() {
    $("#connectBtn").click(function () {
            var state = $("#connectBtn").text();
            if (state == "Connect") {
                connect();
            } else {
                disconnect();
            }
        }
    );
    $("#publishBtn").click(function () {
            var state = $("#publishBtn").text();
            if (state == "Start") {
                publishStream();
            } else {
                unPublishStream();
            }
        }
    );
    $("#playBtn").click(function () {
            var state = $("#playBtn").text();
            if (state == "Start") {
                playStream();
            } else {
                stopStream();
            }
        }
    );

});

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
    configuration.pathToSWF = "../../dependencies/flash/MediaManager.swf";
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

//Disconnect
function disconnect() {
    f.disconnect();
    $("#connectBtn").removeClass("btn-danger").addClass("btn-success");
    $("#connectBtn").text("Connect");
}

//Publish stream
function publishStream(){
    var streamName = field("publishStreamName");
    f.publishStream({name:streamName, record:true});
}

//Stop stream publishing
function unPublishStream(){
    var streamName = field("publishStreamName");
    f.unPublishStream({name:streamName});

    //var publishButton = document.getElementById("publishBtn");
    //var unpublishButton = document.getElementById("unpublishBtn");
}

//Play stream
function playStream(){
    var streamName = field("playStreamName");
    f.playStream({name:streamName});
}

//Stop stream playback
function stopStream(){
    var streamName = field("playStreamName");
    f.stopStream({name:streamName});
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    $("#connectionStatusBar").show();

    if (event.status == ConnectionStatus.Established){
        trace('Connection has been established. You can start a new call.');
        $("#connectBtn").removeClass("btn-success").addClass("btn-danger");
        $("#connectBtn").text("Disconnect");
    } else {
        setTimeout(function() {
            $("#connectionStatusBar").hide();
        },3000);
    }
    $("#connectionStatus").text(event.status);
}

//Connection Status
function streamStatusListener(event) {
    trace("streamStatusListener >> "+event.status);

    switch (event.status) {
        case StreamStatus.Publishing:
            $("#publishStatusBar").show();
            $("#publishStatus").text(event.status);
            $("#publishBtn").text("Stop");
            $("#publishBtn").removeClass("btn-success").addClass("btn-danger");
            break;
        case StreamStatus.Unpublished:
            $("#publishStatusBar").show();
            $("#publishStatus").text(event.status);
            $("#publishBtn").text("Start");
            $("#publishBtn").removeClass("btn-danger").addClass("btn-success");
            break;
        case StreamStatus.Playing:
            $("#playStatusBar").show();
            $("#playStatus").text(event.status);
            $("#playBtn").text("Stop");
            $("#playBtn").removeClass("btn-success").addClass("btn-danger");
            break;
        case StreamStatus.Stoped:
        case StreamStatus.Paused:
            $("#playStatusBar").show();
            $("#playStatus").text(event.status);
            $("#playBtn").text("Start");
            $("#playBtn").removeClass("btn-danger").addClass("btn-success");
            break;
        case StreamStatus.Failed:
            $("#playStatusBar").show();
            $("#publishStatusBar").show();
            $("#playStatus").text(event.status);
            $("#publishStatus").text(event.status);
            $("#playBtn").text("Start");
            $("#publishBtn").text("Start");
            $("#playBtn").removeClass("btn-danger").addClass("btn-success");
            $("#publishBtn").removeClass("btn-danger").addClass("btn-success");
            break;
        default:
            break;
    }

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

