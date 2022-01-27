var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var remoteVideo;
var conferenceStream;
var publishStream;
var currentVolumeValue = 50;
var localDisplay;

function init_page() {
    //init api
    try {
        Flashphoner.init();
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    //video display
    remoteVideo = document.getElementById("remoteVideo");
    localDisplay = document.getElementById("localVideo");

    $("#url").val(setURL());
    $("#volumeControl").slider({
        range: "min",
        min: 0,
        max: 100,
        value: currentVolumeValue,
        step: 10,
        animate: true,
        slide: function (event, ui) {
            currentVolumeValue = ui.value;
            conferenceStream.setVolume(currentVolumeValue);
        }
    }).slider("disable");
    onStopped();
}

function onStarted() {
    $("#joinBtn").text("Leave").off('click').click(function () {
        $(this).prop('disabled', true);
        stopStreams();
    }).prop('disabled', false);
    $("#fullScreenBtn").off('click').click(function () {
        conferenceStream.fullScreen();
    }).prop('disabled', false);
    $("#hasAudio").prop('disabled', true);
    $("#volumeControl").slider("enable");
    conferenceStream.setVolume(currentVolumeValue);
}

function onStopped() {
    $("#joinBtn").text("Join").off('click').click(joinBtnClick).prop('disabled', false);
    $('#url').prop('disabled', false);
    $("#room").prop('disabled', false);
    $("#login").prop('disabled', false);
    $("#volumeControl").slider("disable");
    $("#fullScreenBtn").prop('disabled', true);
    $("#hasAudio").prop('disabled', false);
    $("#preloader").hide();
    stopStreams();
}

function stopStreams() {
    if(conferenceStream) {
        conferenceStream.stop();
    }
    if(publishStream) {
        publishStream.stop();
    }
}

function joinBtnClick() {
    if (validateForm()) {
        $(this).prop('disabled', true);
        $('#url').prop('disabled', true);
        $("#room").prop('disabled', true);
        $("#login").prop('disabled', true);
        start();
    }
}

function start() {
    var url = $('#url').val();
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        var session = Flashphoner.getSessions()[0];
        if (session.getServerUrl() == url) {
            startStreaming(session);
            return;
        } else {
            //remove session DISCONNECTED and FAILED callbacks
            session.on(SESSION_STATUS.DISCONNECTED, function () {
            });
            session.on(SESSION_STATUS.FAILED, function () {
            });
            session.disconnect();
        }
    }
    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        setStatus(session.status());
        //session connected, start playback
        startStreaming(session);
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus(SESSION_STATUS.DISCONNECTED);
        onStopped();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus(SESSION_STATUS.FAILED);
        onStopped();
    });

}

function startStreaming(session) {
    var roomName = $('#room').val();
    var login = $('#login').val();
    var streamName = login + "#" + roomName;
    publishStream = session.createStream({
        name: streamName,
        display: localDisplay,
        receiveVideo: false,
        receiveAudio: false,
        constraints: getConstraints()
    }).on(STREAM_STATUS.PUBLISHING, function (publishStream) {
        //play preview
        playStream(session);
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        onStopped();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus(STREAM_STATUS.FAILED, "This login is already in use. Please change login");
        onStopped();
    });
    publishStream.publish();
}


function playStream(session) {
    var roomName = $('#room').val();
    var login = $('#login').val();
    var streamName = roomName + "-" + login + roomName;

    conferenceStream = session.createStream({
        name: streamName,
        display: remoteVideo,
        constraints: getConstraints(),
        flashShowFullScreenButton: true
    }).on(STREAM_STATUS.PENDING, function (stream) {
        $("#preloader").show();
        var video = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            //don't resize html5 video
            if (video.nodeName.toLowerCase() !== "video") {
                video.addEventListener('resize', function (event) {
                    resizeVideo(event.target);
                });
            }
        }
    }).on(STREAM_STATUS.PLAYING, function (stream) {
        $("#preloader").hide();
        setStatus(stream.status());
        onStarted();
    }).on(STREAM_STATUS.STOPPED, function () {
        $("#preloader").hide();
        setStatus(STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        $("#preloader").hide();
        setStatus(STREAM_STATUS.FAILED, stream.getInfo());
        onStopped();
    }).on(STREAM_STATUS.NOT_ENOUGH_BANDWIDTH, function (stream) {
        console.log("Not enough bandwidth, consider using lower video resolution or bitrate. Bandwidth " + (Math.round(stream.getNetworkBandwidth() / 1000)) + " bitrate " + (Math.round(stream.getRemoteBitrate() / 1000)));
    });
    conferenceStream.play();
}

function getConstraints() {
    var constraints = {
        audio: $("#hasAudio").is(':checked'),
        video: true
    };
    return constraints;
}

//show connection or remote stream status
function setStatus(status, info) {
    var statusField = $("#status");
    var infoField = $("#info");
    statusField.text(status).removeClass();
    if (status == "PLAYING") {
        statusField.attr("class", "text-success");
        infoField.text("");
    } else if (status == "DISCONNECTED" || status == "ESTABLISHED" || status == "STOPPED") {
        statusField.attr("class", "text-muted");
        infoField.text("");
    } else if (status == "FAILED") {
        statusField.attr("class", "text-danger");
        if (info) {
            infoField.text(info).attr("class", "text-muted");
        }
    }
}

function validateForm() {
    var valid = true;
    $('#form :text').each(function () {
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            removeHighlight($(this));
        }
    });
    return valid;

    function highlightInput(input) {
        input.closest('.form-group').addClass("has-error");
    }

    function removeHighlight(input) {
        input.closest('.form-group').removeClass("has-error");
    }
}