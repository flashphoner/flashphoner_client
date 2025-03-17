var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
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
    $("#urlTurnServer").val("turn:turn.flashphoner.com:443?transport=tcp");
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
    var options = {
        urlServer: url,
        mediaOptions: {
            "iceServers": [
                {
                    'url': $('#urlTurnServer').val(),
                    'username': $('#usernameTurnServer').val(),
                    'credential': $('#credentialTurnServer').val()
                }
            ]
        }
    };
    if ($("#forceRelay").is(':checked')) {
        options.mediaOptions.iceTransportPolicy = "relay";
    }
    Flashphoner.createSession(options).on(SESSION_STATUS.ESTABLISHED, function (session) {
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
}

function onStopped() {
    $("#playBtn").text("Play").off('click').click(playBtnClick);
    if (Flashphoner.getSessions()[0] && Flashphoner.getSessions()[0].status() == SESSION_STATUS.ESTABLISHED) {
        $("#playBtn").prop('disabled', false);
        $('#playStream').prop('disabled', false);
    } else {
        $("#playBtn").prop('disabled', true);
        $('#playStream').prop('disabled', true);
    }
}

function playBtnClick() {
    if (validateForm("playerForm")) {
        $('#playStream').prop('disabled', true);
        $(this).prop('disabled', true);
        playStream();
    }
}

function publishStream() {
    var session = Flashphoner.getSessions()[0];
    var streamName = $('#publishStream').val();

     var options = {
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        receiveVideo: false,
        receiveAudio: false
    };

    if ($("#forceRelay").is(':checked')) {
        options.transport = "UDP";
    }

    session.createStream(options)
    .on(STREAM_STATUS.PUBLISHING, function (stream) {
        setStatus("#publishStatus", STREAM_STATUS.PUBLISHING);
        onPublishing(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        setStatus("#publishStatus", STREAM_STATUS.UNPUBLISHED);
        onUnpublished();
    }).on(STREAM_STATUS.FAILED, function () {
        setStatus("#publishStatus", STREAM_STATUS.FAILED);
        onUnpublished();
    }).publish();
}

function playStream() {
    var session = Flashphoner.getSessions()[0];
    var streamName = $('#playStream').val();

    var options = {
        name: streamName,
        display: remoteVideo,
    };

    if ($("#forceRelay").is(':checked')) {
        options.transport = "UDP";
    }

    session.createStream(options)
    .on(STREAM_STATUS.PLAYING, function (stream) {
        document.getElementById(stream.id()).addEventListener('resize', function (event) {
            resizeVideo(event.target);
        });
        setStatus("#playStatus", stream.status());
        onPlaying(stream);
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus("#playStatus", STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function () {
        setStatus("#playStatus", STREAM_STATUS.FAILED);
        onStopped();
    }).play();
}

//show connection, or local, or remote stream status
function setStatus(selector, status) {
    var statusField = $(selector);
    statusField.text(status).removeClass();
    if (status == "PLAYING" || status == "ESTABLISHED" || status == "PUBLISHING") {
        statusField.attr("class", "text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED" || status == "STOPPED") {
        statusField.attr("class", "text-muted");
    } else if (status == "FAILED") {
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