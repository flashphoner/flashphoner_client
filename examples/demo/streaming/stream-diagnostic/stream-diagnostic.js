var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var localVideo;
var remoteVideo;
var session;


//////////////////////////////////
/////////////// Init /////////////

function init_page() {
    //init api
    try {
        Flashphoner.init({createMicGainNode: false});
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    //local and remote displays
    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    $("#url").val(setURL() + "/" + createUUID(8));
    //set initial button callback
    $("#downloadDiv").hide();
    onStopped();
}

function onStarted(publishStream, previewStream) {
    $("#publishBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        previewStream.stop();
    }).prop('disabled', false);
    $("#downloadDiv").hide();
}

function onStopped() {
    $("#publishBtn").text("Start").off('click').click(publishBtnClick).prop('disabled', false);
    if (session)
        session.stopDebug();
}

function publishBtnClick() {
    $(this).prop('disabled', true);
    start();
}

function start() {
    document.getElementById("debug").innerHTML = '';
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        startStreaming(Flashphoner.getSessions()[0]);
    } else {
        //create session
        var url = field('url');
        log("Create new session with url " + url);
        $('#url').prop('disabled', true);
        session = Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function(session){
            //session connected, start streaming
            startStreaming(session);
        }).on(SESSION_STATUS.DISCONNECTED, function(){
            setStatus(SESSION_STATUS.DISCONNECTED);
            $('#url').prop('disabled', false);
            onStopped();
        }).on(SESSION_STATUS.FAILED, function(){
            setStatus(SESSION_STATUS.FAILED);
            $('#url').prop('disabled', false);
            onStopped();
        }).on(SESSION_STATUS.DEBUG, function(event){
            log("Debug session " + event.status);
            if (event.file) {
                var link = window.location.protocol + "//" + window.location.host + "/" + event.file;
                $("#link").attr("href", link);
                $("#downloadDiv").show();
            }
        });
    }
}

function startStreaming(session) {
    var streamName = field("url").split('/')[3];
    session.startDebug();
    session.createStream({
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        receiveVideo: false,
        receiveAudio: false
    }).on(STREAM_STATUS.PUBLISHING, function(publishStream){
        log("Stream " + streamName + " " + STREAM_STATUS.PUBLISHING);
        setStatus(STREAM_STATUS.PUBLISHING);
        //play preview
        session.createStream({
            name: streamName,
            display: remoteVideo
        }).on(STREAM_STATUS.PLAYING, function(previewStream){
            //enable stop button
            log("Stream " + streamName + " " + STREAM_STATUS.PLAYING);
            onStarted(publishStream, previewStream);
        }).on(STREAM_STATUS.STOPPED, function(){
            log("Stream " + streamName + " " + STREAM_STATUS.STOPPED);
            publishStream.stop();
        }).on(STREAM_STATUS.FAILED, function(stream){
            log("Stream " + streamName + " " + STREAM_STATUS.FAILED);
            //preview failed, stop publishStream
            if (publishStream.status() == STREAM_STATUS.PUBLISHING) {
                log("Stream " + streamName + " " + STREAM_STATUS.FAILED);
                setStatus(STREAM_STATUS.FAILED, stream);
                publishStream.stop();
            }
        }).play();
    }).on(STREAM_STATUS.UNPUBLISHED, function(){
        setStatus(STREAM_STATUS.UNPUBLISHED);
        log("Stream " + streamName + " " + STREAM_STATUS.UNPUBLISHED);
        //enable start button
        onStopped();
    }).on(STREAM_STATUS.FAILED, function(stream){
        log("Stream " + streamName + " " + STREAM_STATUS.FAILED);
        setStatus(STREAM_STATUS.FAILED, stream);
        //enable start button
        onStopped();
    }).publish();
}

//show connection or local stream status
function setStatus(status, stream) {
    var statusField = $("#status");
    var infoField = $("#info");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING") {
        statusField.attr("class","text-success");
        infoField.text("");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
        if (stream){
            infoField.text(stream.getInfo()).attr("class","text-muted");
        }
    }
}

function log(string) {
    document.getElementById("debug").innerHTML += string + '</br>';
}