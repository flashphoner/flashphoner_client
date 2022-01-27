var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var STREAM_STATUS_INFO = Flashphoner.constants.STREAM_STATUS_INFO;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var localVideo;
var remoteVideo;
var canvas;
var previewStream;
var publishStream;
var canvStream;

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
    localVideo = document.createElement("localVideo");
    remoteVideo = document.getElementById("remoteVideo");
    canvas = document.getElementById("canvas");

    $("#urlServer").val(setURL() + "/" + createUUID(4));
    onDisconnected();
}

function connect() {
    canvStream = createCanvasStream();
    var url = $('#urlServer').val();

    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        setStatus("#connectStatus", session.status());
        startStreaming();
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus("#connectStatus", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus("#connectStatus", SESSION_STATUS.FAILED);
        onDisconnected();
    });
}

function disconnect() {
    Flashphoner.getSessions()[0].disconnect();
}

function onConnected() {
    $("#startBtn").text("Stop").off('click').click(function () {
        $(this).prop('disabled', true);
        stopStreaming();
    }).prop('disabled', false);
}

function onDisconnected() {
    $("#startBtn").text("Start").off('click').click(function () {
        if (validateForm("connectionForm")) {
            $('#urlServer').prop('disabled', true);
            $(this).prop('disabled', true);
            $('#usedAnimFrame').prop('disabled', true);
            $('#sendAudio').prop('disabled', true);
            $('#sendVideo').prop('disabled', true);
            connect();
        }
    }).prop('disabled', false);
    $('#urlServer').prop('disabled', false);
    $('#usedAnimFrame').prop('disabled', false);
    $('#sendAudio').prop('disabled', false);
    $('#sendVideo').prop('disabled', false);
}

function onPublishing(stream) {
    $("#publishInfo").text("");
    publishStream = stream;
}

function onPlaying(stream) {
    $("#playInfo").text("");
    previewStream = stream;
    onConnected();
}

function startStreaming() {
    var session = Flashphoner.getSessions()[0];
    var streamName = field("urlServer").split('/')[3];
    var constraints = getConstraints();

    session.createStream({
        name: streamName,
        display: localVideo,
        constraints: constraints
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        setStatus("#publishStatus", STREAM_STATUS.PUBLISHING);
        if (Flashphoner.getMediaProviders()[0] === "WSPlayer") {
            Flashphoner.playFirstSound();
        }
        playStream();
        onPublishing(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        setStatus("#publishStatus", STREAM_STATUS.UNPUBLISHED);
        disconnect();
    }).on(STREAM_STATUS.FAILED, function () {
        setStatus("#publishStatus", STREAM_STATUS.FAILED);
        disconnect();
    }).publish();
}

function stopStreaming() {
    if (previewStream != null) {
        previewStream.stop();
    }
    if (publishStream != null && publishStream.published()) {
        publishStream.stop();
    }
    stopCanvasStream();
}

function playStream() {
    var session = Flashphoner.getSessions()[0];
    var streamName = field("urlServer").split('/')[3];
    var constraints = {audio: !Browser.isiOS()};

    session.createStream({
        name: streamName,
        display: remoteVideo,
        constraints: constraints
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
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus("#playStatus", STREAM_STATUS.FAILED, stream);
        disconnect();
    }).play();
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
    if (!$("#sendVideo").is(':checked') && !$("#sendAudio").is(':checked')) {
        highlightInput($("#sendVideo"));
        highlightInput($("#sendAudio"));
        valid = false;
        return valid;
    } else {
        removeHighlight($("#sendVideo"));
        removeHighlight($("#sendAudio"));
    }
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

function getConstraints() {
    var constraints;
    var stream = canvStream;
    constraints = {
        audio: false,
        video: false,
        customStream: stream
    };
    return constraints;
}

function createCanvasStream() {
    var canvasContext = canvas.getContext("2d");
    var canvasStream = canvas.captureStream(30);
    mockVideoElement = document.createElement("video");
    mockVideoElement.setAttribute("playsinline", "");
    mockVideoElement.setAttribute("webkit-playsinline", "");
    mockVideoElement.src = '../../dependencies/media/test_movie.mp4';
    mockVideoElement.loop = true;
    mockVideoElement.muted = true;
    var useRequestAnimationFrame = $("#usedAnimFrame").is(':checked');
    mockVideoElement.addEventListener("play", function () {
        var $this = this;
        (function loop() {
            if (!$this.paused && !$this.ended) {
                canvasContext.drawImage($this, 0, 0);
                if (useRequestAnimationFrame) {
                    requestAnimationFrame(loop);
                } else {
                    setTimeout(loop, 1000 / 30); // drawing at 30fps
                }
            }
        })();
    }, 0);
    if (!$("#sendVideo").is(':checked')) {
        canvasStream.removeTrack(canvasStream.getVideoTracks()[0]);
    }
    mockVideoElement.play();
    if ($("#sendAudio").is(':checked')) {
        mockVideoElement.muted = false;
        try {
            var audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Failed to create audio context");
        }
        var source = audioContext.createMediaElementSource(mockVideoElement);
        var destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        canvasStream.addTrack(destination.stream.getAudioTracks()[0]);
    }
    return canvasStream;
}

function stopCanvasStream() {
    if(mockVideoElement) {
        mockVideoElement.pause();
        mockVideoElement.removeEventListener('play', null);
        mockVideoElement = null;
    }
}