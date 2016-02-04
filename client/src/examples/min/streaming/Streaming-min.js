//Init WCS JavaScript API
var f = Flashphoner.getInstance();
var mediaProvider;
var record = false;
var target;

//////////////////////////////////
/////////////// Init /////////////

$(document).ready(function () {
    loadFieldSet();
});

function loadFieldSet() {
    $("#fieldset").load("Streaming-fieldset.html", init_page);
}

// Save connection and callee info in cookies
function setCookies() {
    f.setCookie("urlServer", $("#urlServer").val());
    f.setCookie("publishStream", $("#publishStream").val());
    f.setCookie("playStream", $("#playStream").val());
}

function getCookies(){
    if (f.getCookie("urlServer")) {
        $("#urlServer").val(decodeURIComponent(f.getCookie("urlServer")));
    } else {
        $("#urlServer").val(setURL());
    }

    if (f.getCookie("publishStream")) {
        $("#publishStream").val(decodeURIComponent(f.getCookie("publishStream")));
    }

    if (f.getCookie("playStream")) {
        $("#playStream").val(decodeURIComponent(f.getCookie("playStream")));
    }
}

function init_page() {

    $("#downloadDiv").hide();
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
    if (target == "Stream-record-min.html") {
        $("#publishLabel").text("Record");
        $("#playDiv").hide();
        record = true;
    }

    getCookies();

};

function initAPI() {
    target = location.pathname.substring(location.pathname.lastIndexOf("/") + 1);

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
        if (target == "Stream-record-min.html") {
            document.getElementById('remoteVideo').style.visibility = "hidden";
            $("#localVideo").attr('width','320').attr('height','240').removeClass('fp-localVideo').addClass('fp-remoteVideo');
        } else {
            document.getElementById('remoteVideo').style.visibility = "visible";
        }
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
    } else {
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "visible";
    }
}

///////////////////////////////////
///////////// Controls ////////////
///////////////////////////////////

//New connection
function connect(){
    f.connect({urlServer:field("urlServer"), appKey:'defaultApp'});
    setCookies();
}

//Disconnect
function disconnect() {
    f.disconnect();
    $("#connectBtn").text("Connect");
}

//Publish stream
function publishStream(){
    $("#downloadDiv").hide();
    var streamName = field("publishStream");
    f.publishStream({name:streamName, record: record});
    setCookies();
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
    setCookies();
}

//Stop stream playback
function stopStream(){
    var streamName = field("playStream");
    f.stopStream({name:streamName});
}

///////////////////////////////////
///////////// Listeners ////////////
///////////////////////////////////

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established){
        trace('Connection has been established. You can start a new call.');
        $("#connectBtn").text("Disconnect");
        mediaProvider = event.mediaProviders;
    } else {
        $("#publishBtn").text("Start");
        $("#playBtn").text("Start");
        $("#publishStatus").text("");
        $("#playStatus").text("");
    }
    setConnectionStatus(event.status);
}

//Connection Status
function streamStatusListener(event) {
    trace("streamStatusListener >> "+event.status);
    switch (event.status) {
        case StreamStatus.Publishing:
            setPublishStatus(event.status);
            $("#publishBtn").text("Stop");
            break;
        case StreamStatus.Unpublished:
            setPublishStatus(event.status);
            $("#publishBtn").text("Start");
            if (record) {
                showDownloadLink(event.mediaSessionId);
            }
            break;
        case StreamStatus.Playing:
            setPlaybackStatus(event.status);
            $("#playBtn").text("Stop");
            break;
        case StreamStatus.Stoped:
        case StreamStatus.Paused:
            setPlaybackStatus(event.status);
            $("#playBtn").text("Start");
            break;
        case StreamStatus.Failed:
            if (event.published) {
                setPublishStatus(event.status);
                $("#publishBtn").text("Start");
            } else {
                setPlaybackStatus(event.status);
                $("#playBtn").text("Start");
            }
            break;
        default:
            break;
    }
}

//Error
function errorEvent(event) {
    trace(event.info);
}

/////////////////////////////////////
///////////// Display UI ////////////
/////////////////////////////////////

// Show link to download recorded stream

function showDownloadLink(mediaSessionId) {
    var extension = (mediaProvider == "WebRTC") ? 'webm' : 'mp4';
    // Set correct path for records. Stream records are saved to WCS_HOME/records directory.
    // http://flashphoner.com/docs/wcs4/wcs_docs/html/en/wcs-developer-guide/quick_start_recording_streams.htm
    var link = window.location.protocol + "//" + window.location.host + '/client/records/' + mediaSessionId + '.' + extension;
    $("#link").attr("href",link);
    $("#downloadDiv").show();
}

// Set Connection Status
function setConnectionStatus(status) {

    $("#connectionStatus").text(status);
    $("#connectionStatus").className='';

    if (status == "ESTABLISHED") {
        $("#connectionStatus").attr("class","text-success");
    }

    if (status == "DISCONNECTED") {
        $("#connectionStatus").attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#connectionStatus").attr("class","text-danger");
    }
}

// Set Stream Status
function setPublishStatus(status) {

    $("#publishStatus").text(status);
    $("#publishStatus").className='';

    if (status == "PUBLISHING") {
        $("#publishStatus").attr("class","text-success");
    }

    if (status == "UNPUBLISHED") {
        $("#publishStatus").attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#publishStatus").attr("class","text-danger");
    }

}

// Set Stream Status
function setPlaybackStatus(status) {

    $("#playStatus").text(status);
    $("#playStatus").className='';

    if (status == "PLAYING") {
        $("#playStatus").attr("class","text-success");
    }

    if (status == "STOPPED") {
        $("#playStatus").attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#playStatus").attr("class","text-danger");
    }
}


///////////////////////////////////
///////////// Utils ////////////
///////////////////////////////////


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
    return url;
}
