var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var STREAM_STATUS_INFO = Flashphoner.constants.STREAM_STATUS_INFO;
var ERROR_INFO = Flashphoner.constants.ERROR_INFO;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var localVideo;
var remoteVideo;
var filters = [empty, sepia, threshold, invert];
var currentFilter = empty;
var intervalId;
//////////////////////////////////
/////////////// Init /////////////

function init_page() {
    //init api
    try {
        Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology needed for this example");
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
}

function onUnpublished() {
    $("#publishBtn").text("Publish").off('click').click(publishBtnClick);
    clearInterval(intervalId);
    if (Flashphoner.getSessions()[0] && Flashphoner.getSessions()[0].status() == SESSION_STATUS.ESTABLISHED) {
        $("#publishBtn").prop('disabled', false);
        $('#publishStream').prop('disabled', false);
    } else {
        $("#publishBtn").prop('disabled', true);
        $('#publishStream').prop('disabled', true);
    }
}

function publishBtnClick() {
    if (validateForm("streamerForm")) {
        $('#publishStream').prop('disabled', true);
        $(this).prop('disabled', true);
        if (Browser.isSafariWebRTC()) {
            Flashphoner.playFirstVideo(localVideo, true, PRELOADER_URL).then(function() {
                publishStream();
            });
            return;
        }
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
        } else if (Browser.isSafariWebRTC() || Flashphoner.getMediaProviders()[0] === "MSE") {
            Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL).then(function () {
                playStream();
            });
            return;
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
        receiveAudio: false,
        useCanvasMediaStream: true
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        setStatus("#publishStatus", STREAM_STATUS.PUBLISHING);
        onPublishing(stream);
	    intervalId = setInterval(draw, 1000.0 / 30);
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        setStatus("#publishStatus", STREAM_STATUS.UNPUBLISHED);
        onUnpublished();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus("#publishStatus", STREAM_STATUS.FAILED, stream);
        onUnpublished();
    }).publish();
}

function applyFilter() {
    let filter = $('#filter').val();
    currentFilter = filters[filter];
}

function empty(imageData) {
    return imageData;
}
// Warning! Image processing doesn't work properly in iOS 12 and lower
// Known issues are:
// * low FPS after applying filter
// * source media stream doesn't contains audio track (video-only)
function draw() {
    let localVideo = document.getElementById('localVideo');
    let canvas = localVideo.children[0];
    if (canvas) {
        let ctx = canvas.getContext('2d');
        // First need to draw video on the canvas
        ctx.drawImage(canvas.children[0], 0, 0);
        // next get image data
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // next need to apply filter to the image
        let filtered = currentFilter(imageData);
        // and finally draw filtered image on the canvas
        ctx.putImageData(filtered, 0, 0);
    }
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
    }).play();
}

function availableStream(){
    var session = Flashphoner.getSessions()[0];
    var streamName = $('#playStream').val();
    session.createStream({
        name: streamName,
        display: remoteVideo
    }).available().then(function(stream){
        $("#availableStatus").text("AVAILABLE").attr("class", "text-success");
    }, function(stream){
        $("#availableStatus").text("UNAVAILABLE").attr("class", "text-danger");
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

// Image filters

function sepia(imageData) {
    var pixels = imageData.data;
    for (var i = 0; i < pixels.length; i += 4) {
        var r = pixels[i];
        var g = pixels[i + 1];
        var b = pixels[i + 2];
        pixels[i]     = (r * 0.393)+(g * 0.769)+(b * 0.189); // red
        pixels[i + 1] = (r * 0.349)+(g * 0.686)+(b * 0.168); // green
        pixels[i + 2] = (r * 0.272)+(g * 0.534)+(b * 0.131); // blue
    }
    return imageData;
};

function threshold(imageData) {
    let d = imageData.data;
    for (let i=0; i<d.length; i+=4) {
        let r = d[i];
        let g = d[i+1];
        let b = d[i+2];
        let v = (0.2126*r + 0.7152*g + 0.0722*b >= 110) ? 255 : 0;
        d[i] = d[i+1] = d[i+2] = v
    }
    return imageData;
}


function invert(imageData) {
    let pixels = imageData.data;
    for (let i = 0; i < pixels.length; i+=4) {
        pixels[i] = 255 - pixels[i];
        pixels[i+1] = 255 - pixels[i+1];
        pixels[i+2] = 255 - pixels[i+2];
    }
    return imageData;
}