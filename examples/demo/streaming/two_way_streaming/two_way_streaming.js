var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var STREAM_EVENT = Flashphoner.constants.STREAM_EVENT;
var STREAM_EVENT_TYPE = Flashphoner.constants.STREAM_EVENT_TYPE;
var STREAM_STATUS_INFO = Flashphoner.constants.STREAM_STATUS_INFO;
var ERROR_INFO = Flashphoner.constants.ERROR_INFO;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var localVideo;
var remoteVideo;


//////////////////////////////////
/////////////// Init /////////////

function init_page() {
    //init api
    try {
        Flashphoner.init();
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    //local and remote displays
    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    $("#urlServer").val(setURL());
    var streamName = createUUID(4);
    $("#publishStream").val(streamName);
    $("#playStream").val(streamName);
    onDisconnected();
    onUnpublished();
    onStopped();
}

function connect() {
    var url = $('#urlServer').val();

    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        setStatus("#connectStatus", session.status());
        onConnected(session);
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus("#connectStatus", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus("#connectStatus", SESSION_STATUS.FAILED);
        onDisconnected();
    });
}

function onConnected(session) {
    $("#connectBtn").text("Disconnect").off('click').click(function () {
        $(this).prop('disabled', true);
        session.disconnect();
    }).prop('disabled', false);
    onUnpublished();
    onStopped();
}

function onDisconnected() {
    $("#connectBtn").text("Connect").off('click').click(function () {
        if (validateForm("connectionForm")) {
            $('#urlServer').prop('disabled', true);
            $(this).prop('disabled', true);
            connect();
        }
    }).prop('disabled', false);
    $('#urlServer').prop('disabled', false);
    onUnpublished();
    onStopped();
}

function onPublishing(stream) {
    $("#publishBtn").text("Stop").off('click').click(function () {
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);
    $("#publishInfo").text("");

    $('#sendDataBtn').off('click').click(function(){
        var streamData = field('streamData');
        stream.sendData(JSON.parse(streamData));
    }).prop('disabled',false);
}

function onUnpublished() {
    $("#publishBtn").text("Publish").off('click').click(publishBtnClick);
    if (Flashphoner.getSessions()[0] && Flashphoner.getSessions()[0].status() == SESSION_STATUS.ESTABLISHED) {
        $("#publishBtn").prop('disabled', false);
        $('#publishStream').prop('disabled', false);
    } else {
        $("#publishBtn").prop('disabled', true);
        $('#publishStream').prop('disabled', true);
    }
    $('#sendDataBtn').prop('disabled',true);
}

function publishBtnClick() {
    if (validateForm("streamerForm")) {
        $('#publishStream').prop('disabled', true);
        $(this).prop('disabled', true);
        publishStream();
    }
}

function onPlaying(stream) {
    $("#playBtn").text("Stop").off('click').click(function () {
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);
    $("#playInfo").text("");
}

function onStopped() {
    $("#playBtn").text("Play").off('click').click(playBtnClick);
    $("#availableBtn").off('click').click(function () {
        if (validateForm("playerForm")) {
            availableStream();
        }
    });
    if (Flashphoner.getSessions()[0] && Flashphoner.getSessions()[0].status() == SESSION_STATUS.ESTABLISHED) {
        $("#playBtn").prop('disabled', false);
        $('#playStream').prop('disabled', false);
        $('#availableBtn').prop('disabled', false);
    } else {
        $("#playBtn").prop('disabled', true);
        $('#playStream').prop('disabled', true);
        $('#availableBtn').prop('disabled', true);
    }
}

function playBtnClick() {
    if (validateForm("playerForm")) {
        $('#playStream').prop('disabled', true);
        $(this).prop('disabled', true);
        if (Flashphoner.getMediaProviders()[0] === "WSPlayer") {
            Flashphoner.playFirstSound();
        }
        playStream();
    }
}

function publishStream() {
    var session = Flashphoner.getSessions()[0];
    var streamName = $('#publishStream').val();

    session.createStream({
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        receiveVideo: false,
        receiveAudio: false
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        setStatus("#publishStatus", STREAM_STATUS.PUBLISHING);
        onPublishing(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        setStatus("#publishStatus", STREAM_STATUS.UNPUBLISHED);
        onUnpublished();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus("#publishStatus", STREAM_STATUS.FAILED, stream);
        onUnpublished();
    }).publish();
}

function playStream() {
    var session = Flashphoner.getSessions()[0];
    var streamName = $('#playStream').val();

    session.createStream({
        name: streamName,
        display: remoteVideo
    }).on(STREAM_STATUS.PENDING, function (stream) {
        var video = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            video.addEventListener('resize', function (event) {
                resizeVideo(event.target);
            });
        }
    }).on(STREAM_STATUS.PLAYING, function (stream) {
        setStatus("#playStatus", stream.status());
        onPlaying(stream);
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus("#playStatus", STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus("#playStatus", STREAM_STATUS.FAILED, stream);
        onStopped();
    }).on(STREAM_EVENT, function(streamEvent) {
        switch (streamEvent.type) {
            case STREAM_EVENT_TYPE.DATA:
                addPayload(streamEvent.payload);
                break;
        }
        console.log("Received streamEvent ", streamEvent.type);
    }).play();
}

function addPayload(payload) {
    var date = new Date();
    var time = date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes();
    var newMessage = time + " - "+JSON.stringify(payload) + '<br/>';
    var receivedData = $("#receivedData");
    receivedData.html(receivedData.html() + newMessage);
    receivedData.scrollTop(receivedData.prop('scrollHeight'));
}

function availableStream(){
    var session = Flashphoner.getSessions()[0];
    var streamName = $('#playStream').val();
    session.createStream({
        name: streamName,
        display: remoteVideo
    }).available().then(function(stream){
        $("#availableStatus").text("AVAILABLE").attr("class", "text-success");
        $("#availableInfo").text("").attr("class", "text-muted");
    }, function(stream){
        console.log(stream);
        $("#availableStatus").text("UNAVAILABLE").attr("class", "text-danger");
        $("#availableInfo").text(stream.getInfo()).attr("class", "text-muted");
    });
}

//show connection, or local, or remote stream status
function setStatus(selector, status, stream) {
    var statusField = $(selector);
    statusField.text(status).removeClass();
    if (status == "PLAYING" || status == "ESTABLISHED" || status == "PUBLISHING") {
        statusField.attr("class", "text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED" || status == "STOPPED") {
        statusField.attr("class", "text-muted");
    } else if (status == "FAILED") {
        if (stream) {
            if (stream.published()) {
                switch(stream.getInfo()){
                    case STREAM_STATUS_INFO.STREAM_NAME_ALREADY_IN_USE:
                        $("#publishInfo").text("Server already has a publish stream with the same name, try using different one").attr("class", "text-muted");
                        break;
                    case ERROR_INFO.LOCAL_ERROR:
                        $("#publishInfo").text("Browser error detected: " + stream.getErrorInfo()).attr("class", "text-muted");
                        break;
                    default:
                        $("#publishInfo").text("Other: "+stream.getInfo()).attr("class", "text-muted");
                        break;
                }
            } else {
                switch(stream.getInfo()){
                    case STREAM_STATUS_INFO.SESSION_DOES_NOT_EXIST:
                        $("#playInfo").text("Actual session does not exist").attr("class", "text-muted");
                        break;
                    case STREAM_STATUS_INFO.STOPPED_BY_PUBLISHER_STOP:
                        $("#playInfo").text("Related publisher stopped its stream or lost connection").attr("class", "text-muted");
                        break;
                    case STREAM_STATUS_INFO.SESSION_NOT_READY:
                        $("#playInfo").text("Session is not initialized or terminated on play ordinary stream").attr("class", "text-muted");
                        break;
                    case STREAM_STATUS_INFO.RTSP_STREAM_NOT_FOUND:
                        $("#playInfo").text("Rtsp stream not found where agent received '404-Not Found'").attr("class", "text-muted");
                        break;
                    case STREAM_STATUS_INFO.FAILED_TO_CONNECT_TO_RTSP_STREAM:
                        $("#playInfo").text("Failed to connect to rtsp stream").attr("class", "text-muted");
                        break;
                    case STREAM_STATUS_INFO.FILE_NOT_FOUND:
                        $("#playInfo").text("File does not exist, check filename").attr("class", "text-muted");
                        break;
                    case STREAM_STATUS_INFO.FILE_HAS_WRONG_FORMAT:
                        $("#playInfo").text("File has wrong format on play vod, this format is not supported").attr("class", "text-muted");
                        break;
                    case STREAM_STATUS_INFO.TRANSCODING_REQUIRED_BUT_DISABLED:
                        $("#playInfo").text("Transcoding required, but disabled in settings").attr("class", "text-muted");
                        break;
                    case STREAM_STATUS_INFO.NO_AVAILABLE_TRANSCODERS:
                        $("#playInfo").text("No available transcoders for stream").attr("class", "text-muted");
                        break;
                    default:
                        $("#playInfo").text("Other: "+stream.getInfo()).attr("class", "text-muted");
                        break;
                }
            }
        }
        statusField.attr("class", "text-danger");
    }
}

function validateForm(formId) {
    var valid = true;
    $('#' + formId + ' :text').each(function () {
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            removeHighlight($(this));
        }
    });
    return valid;

    function highlightInput(input) {
        input.closest('.input-group').addClass("has-error");
    }

    function removeHighlight(input) {
        input.closest('.input-group').removeClass("has-error");
    }
}
