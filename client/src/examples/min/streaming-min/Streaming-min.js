$(document).ready(function () {
    loadConnectFieldSet();
});

// Include Filed Set HTML
function loadConnectFieldSet(){
    $("#connectFieldSet").load("Connect-fieldset.html",loadPublishFieldSet);
}

function loadPublishFieldSet(){
    $("#publishFieldSet").load("Publish-fieldset.html",loadPlaybackFieldSet);
}

// Include Call Controls HTML
function loadPlaybackFieldSet(){
    $("#playbackFieldSet").load("Playback-fieldset.html", init_page);
}



function init_page() {
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

    setURL();
};

//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {

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

//Disconnect
function disconnect() {
    f.disconnect();
    $("#connectBtn").text("Connect").removeClass("btn-danger").addClass("btn-success");
}

//Publish stream
function publishStream(){
    var streamName = field("publishStream");
    f.publishStream({name:streamName, record:true});
}

//Stop stream publishing
function unPublishStream(){
    var streamName = field("publishStream");
    f.unPublishStream({name:streamName});
}

//Play stream
function playStream(){
    var streamName = field("playStream");
    f.playStream({name:streamName});
}

//Stop stream playback
function stopStream(){
    var streamName = field("playStream");
    f.stopStream({name:streamName});
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established){
        trace('Connection has been established. You can start a new call.');
        $("#connectBtn").text("Disconnect").removeClass("btn-success").addClass("btn-danger");
    } else {
        $("#publishBtn").text("Start").removeClass("btn-danger").addClass("btn-success");
        $("#playBtn").text("Start").removeClass("btn-danger").addClass("btn-success");
    }
    setConnectionStatus(event.status);
}

//Connection Status
function streamStatusListener(event) {
    trace("streamStatusListener >> "+event.status);
    switch (event.status) {
        case StreamStatus.Publishing:
            setPublishStatus(event.status);
            $("#publishBtn").text("Stop").removeClass("btn-success").addClass("btn-danger");
            break;
        case StreamStatus.Unpublished:
            setPublishStatus(event.status);
            $("#publishBtn").text("Start").removeClass("btn-danger").addClass("btn-success");
            break;
        case StreamStatus.Playing:
            setPlaybackStatus(event.status);
            $("#playBtn").text("Stop").removeClass("btn-success").addClass("btn-danger");
            break;
        case StreamStatus.Stoped:
        case StreamStatus.Paused:
            setPlaybackStatus(event.status);
            $("#playBtn").text("Start").removeClass("btn-danger").addClass("btn-success");
            break;
        case StreamStatus.Failed:
            setPublishStatus(event.status);
            setPlaybackStatus(event.status);
            $("#playBtn").text("Start").removeClass("btn-danger").addClass("btn-success");
            $("#publishBtn").text("Start").removeClass("btn-danger").addClass("btn-success");
            break;
        default:
            break;
    }
}

function setPublishStatus(status) {
    $("#publishStatus").text(status);
}

function setPlaybackStatus(status) {
    $("#playStatus").text(status);
}

function setConnectionStatus(status) {
    $("#connectionStatus").text(status);
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

