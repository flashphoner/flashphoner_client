var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var localVideo;

$(document).ready(function () {
    init_page();
});

function init_page() {
    $("#url").val(setURL());
    //init api
    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }
    localVideo = document.getElementById("localVideo");
    $("#streamName").val(createUUID(4));
    onStopped();
}

function onStarted(previewStream) {
    $("#publishBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        previewStream.stop();
        $('#url').prop('disabled', false);
    }).prop('disabled', false);
    $('#url').prop('disabled', true);
    $("#rtmpUrl").prop('disabled', true);
    $("#streamName").prop('disabled', true);
}

function onStopped() {
    $("#publishBtn").text("Start").off('click').click(publishBtnClick).prop('disabled', false);
    $("#rtmpUrl").prop('disabled', false);
    $("#streamName").prop('disabled', false);
    $('#url').prop('disabled', false);
}

function publishBtnClick() {
    if (validateForm()) {
        $(this).prop('disabled', true);
        start();
    }
}

function start() {
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        startStreaming(Flashphoner.getSessions()[0]);
    } else {
        //create session
        var url = field('url');
        console.log("Create new session with url " + url);
        Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function(session){
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
        });
    }
}

function startStreaming(session) {
    var streamName = field("streamName");
    var rtmpUrl = field("rtmpUrl");
    session.createStream({
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        receiveVideo: false,
        receiveAudio: false,
        rtmpUrl: rtmpUrl
    }).on(STREAM_STATUS.PUBLISHING, function(publishStream){
        setStatus(STREAM_STATUS.PUBLISHING);
        onStarted(publishStream);
        sendDataToPlayer();
    }).on(STREAM_STATUS.UNPUBLISHED, function(){
        setStatus(STREAM_STATUS.UNPUBLISHED);
        //enable start button
        onStopped();
    }).on(STREAM_STATUS.FAILED, function(){
        setStatus(STREAM_STATUS.FAILED);
        //enable start button
        onStopped();
    }).publish();
}

//show connection or local stream status
function setStatus(status) {
    var statusField = $("#status");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING") {
        statusField.attr("class","text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
    }
}

// Show RTMP URL to play in a third party player (VLC, ffplay etc)
function sendDataToPlayer() {
    var player = $("#player");
    var host = field("rtmpUrl")
        .replace("localhost", window.location.hostname)
        .replace("127.0.0.1", window.location.hostname);

    var rtmpStreamPrefix = "rtmp_";
    var url = host + "/" + rtmpStreamPrefix + field("streamName");
    player.text(url);
}

function validateForm() {
    var valid = true;
    $(':text').each(function(){
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            removeHighlight($(this));
        }
    });
    return valid;

    function highlightInput(input) {
        input.closest('.form-group, .input-group').addClass("has-error");
    }
    function removeHighlight(input) {
        input.closest('.form-group, .input-group').removeClass("has-error");
    }
}