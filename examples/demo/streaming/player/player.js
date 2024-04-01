var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var STREAM_EVENT = Flashphoner.constants.STREAM_EVENT;
var STREAM_EVENT_TYPE = Flashphoner.constants.STREAM_EVENT_TYPE;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var remoteVideo;
var resolution_for_wsplayer;
var stream;
var currentVolumeValue = 50;

var autoplay = getUrlParam("autoplay") || false;
var resolution = getUrlParam("resolution");
var mediaProvider = getUrlParam("mediaProvider") || null;
var mseCutByIFrameOnly = getUrlParam("mseCutByIFrameOnly");

var useVideoControls = false;

function init_page() {

    //init api
    try {
        Flashphoner.init({
            receiverLocation: '../../dependencies/websocket-player/WSReceiver2.js',
            decoderLocation: '../../dependencies/websocket-player/video-worker2.js',
            preferredMediaProvider: mediaProvider
        });
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    $("#streamName").val(getUrlParam("streamName"));

    //video display
    remoteVideo = document.getElementById("remoteVideo");

    $("#url").val(setURL());
    $("#volumeControl").slider({
        range: "min",
        min: 0,
        max: 100,
        value: currentVolumeValue,
        step: 10,
        animate: true,
        slide: function(event, ui) {
            currentVolumeValue = ui.value;
            setStreamVolume(stream, currentVolumeValue);
        }
    }).slider("disable");
    onStopped();
    if (Browser.isSafari()) {
        // Enable video controls for fullscreen mode to work in Safari 16
        useVideoControls = true;
        $("#fullScreen").hide();
        if (Browser.isiOS()) {
            $("#volume").hide();
        }
    }
    if (autoplay) {
        // We can start autoplay with muted audio only, so set volume slider to 0 #WCS-2425
        $("#volumeControl").slider('value', 0);
        $("#playBtn").click();
    }
}

function onStarted(stream) {
    $("#playBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);
    $("#fullScreenBtn").off('click').click(function(){
        stream.fullScreen();
    }).prop('disabled', false);
    $("#volumeControl").slider("enable");
    stream.setVolume(currentVolumeValue);
}

function onStopped() {
    $("#playBtn").text("Start").off('click').click(playBtnClick).prop('disabled', false);
    $('#url').prop('disabled', false);
    $("#streamName").prop('disabled', false);
    $("#volumeControl").slider("disable");
    $("#fullScreenBtn").prop('disabled', true);
    $("#preloader").hide();
    $("#unmuteBtn").off('click').click(unmuteBtnClick);
    $("#unmute").hide();
}

function playBtnClick() {
    if (validateForm()) {
        $(this).prop('disabled', true);
        $('#url').prop('disabled', true);
        $("#streamName").prop('disabled', true);
        if (Flashphoner.getMediaProviders()[0] === "WSPlayer") {
            Flashphoner.playFirstSound();
        } else if (Browser.isSafari()) {
            Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL, useVideoControls).then(function() {
                start();
            }).catch(function () {
                onStopped();
            });
            return;
        }
        start();
    }
}

function unmuteBtnClick() {
    setStreamVolume(stream, currentVolumeValue)
    $("#volumeControl").slider('value', currentVolumeValue);
}

function start() {
    var url = $('#url').val();
    //check if we already have session
    $("#preloader").show();
    if (Flashphoner.getSessions().length > 0) {
        var session = Flashphoner.getSessions()[0];
        if (session.getServerUrl() == url) {
            playStream(session);
            return;
        } else {
            //remove session DISCONNECTED and FAILED callbacks
            session.on(SESSION_STATUS.DISCONNECTED, function(){});
            session.on(SESSION_STATUS.FAILED, function(){});
            session.disconnect();
        }
    }
    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function(session){
        setStatus(session.status());
        //session connected, start playback
        playStream(session);
    }).on(SESSION_STATUS.DISCONNECTED, function(){
        setStatus(SESSION_STATUS.DISCONNECTED);
        onStopped();
    }).on(SESSION_STATUS.FAILED, function(){
        setStatus(SESSION_STATUS.FAILED);
        onStopped();
    });

}

function playStream(session) {
    var streamName = $('#streamName').val();
    var options = {
        name: streamName,
        display: remoteVideo,
        useControls: useVideoControls
    };
    if (Flashphoner.getMediaProviders()[0] === "MSE" && mseCutByIFrameOnly) {
        options.mediaConnectionConstraints = {
            cutByIFrameOnly: mseCutByIFrameOnly
        }
    }
    if (resolution_for_wsplayer) {
        options.playWidth = resolution_for_wsplayer.playWidth;
        options.playHeight = resolution_for_wsplayer.playHeight;
    } else if (resolution) {
        options.playWidth = resolution.split("x")[0];
        options.playHeight = resolution.split("x")[1];
    }
    if (autoplay) {
        options.unmutePlayOnStart = false;
    }
    stream = session.createStream(options).on(STREAM_STATUS.PENDING, function (stream) {
        var video = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            //don't resize html5 video
            if (video.nodeName.toLowerCase() !== "video") {
                video.addEventListener('resize', function (event) {
                    var streamResolution = stream.videoResolution();
                    console.log("Stream resolution " + streamResolution);
                    if (Object.keys(streamResolution).length === 0) {
                        resizeVideo(event.target);
                    } else {
                        // Change aspect ratio to prevent video stretching
                        var ratio = streamResolution.width / streamResolution.height;
                        var newHeight = Math.floor(options.playWidth / ratio);
                        resizeVideo(event.target, options.playWidth, newHeight);
                    }
                });
            }
            if (useVideoControls && Browser.isSafariWebRTC()) {
                // iOS hack when using standard controls to leave fullscreen mode
                var needRestart = false;
                video.addEventListener("pause", function () {
                    if(needRestart) {
                        console.log("Video paused after fullscreen, continue...");
                        video.play();
                        needRestart = false;
                    }
                });
                video.addEventListener("webkitendfullscreen", function () {
                    video.play();
                    needRestart = true;
                });                
            }
            // Hide preloader when playing video
            video.addEventListener("playing", function () {
                $("#preloader").hide();
            });
            // Hide unmute button
            video.addEventListener("volumechange", function () {
                if (video.muted) {
                    $("#unmute").show();
                } else {
                    $("#unmute").hide();
                }
            });
        }
    }).on(STREAM_STATUS.PLAYING, function (stream) {
        // Android Firefox may pause stream playback via MSE even if video element is muted
        if (Flashphoner.getMediaProviders()[0] == "MSE" && autoplay && Browser.isAndroidFirefox()) {
            let video = document.getElementById(stream.id());
            if (video && video.paused) {
                video.play();
            }
        }
        setStatus(stream.status());
        onStarted(stream);
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus(STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function(stream) {
        setStatus(STREAM_STATUS.FAILED, stream);
        onStopped();
    }).on(STREAM_EVENT, function(streamEvent){
        if (STREAM_EVENT_TYPE.NOT_ENOUGH_BANDWIDTH === streamEvent.type) {
            var info = streamEvent.payload.info.split("/");
            var remoteBitrate = info[0];
            var networkBandwidth = info[1];
            console.log("Not enough bandwidth, consider using lower video resolution or bitrate. Bandwidth " + (Math.round(networkBandwidth / 1000)) + " bitrate " + (Math.round(remoteBitrate / 1000)));
        } else if (STREAM_EVENT_TYPE.RESIZE === streamEvent.type) {
            console.log("New video size: " + streamEvent.payload.streamerVideoWidth + "x" + streamEvent.payload.streamerVideoHeight);
        } else if (STREAM_EVENT_TYPE.UNMUTE_REQUIRED === streamEvent.type) {
            console.log("Stream is muted by autoplay policy, user action required to unmute");
            $("#unmute").show();
        }
    });
    stream.play();
}

//show connection or remote stream status
function setStatus(status, stream) {
    var statusField = $("#status");
    var infoField = $("#info");
    statusField.text(status).removeClass();
    if (status == "PLAYING") {
        statusField.attr("class","text-success");
        infoField.text("");
    } else if (status == "DISCONNECTED" || status == "ESTABLISHED" || status == "STOPPED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
        if (stream) {
            infoField.text(stream.getInfo()).attr("class","text-muted");
        }
    }
}

function setStreamVolume(stream, currentVolumeValue) {
    if (stream) {
        if (stream.isRemoteAudioMuted()) {
            stream.unmuteRemoteAudio();
        }
        stream.setVolume(currentVolumeValue);
    }
}

function validateForm() {
    var valid = true;
    $('#form :text').each(function(){
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