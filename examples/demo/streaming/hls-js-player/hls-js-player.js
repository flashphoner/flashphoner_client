var remoteVideo = null;
var hlsPlayer = null

function loadPlayerPage() {
    $("#playerPage").load("../hls-player/player-page.html", initPage );
}

function initPage() {
    $("#header").text("HLS.JS Player Minimal");
    $("#urlServer").val(getHLSUrl());
    $("#applyBtn").prop('disabled', false).text("Play").off('click').click(playBtnClick);
    remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.style ="background-color: lightgrey;";
    $('#llHlsMode').show();
}


function playBtnClick() {
    if (validateForm()) {
        var llHlsEnabled = $('#llHlsEnabled').is(":checked");
        var streamName = $('#playStream').val();
        streamName = encodeURIComponent(streamName);
        var videoSrc = $("#urlServer").val() + '/' + streamName + '/' + streamName + '.m3u8';
        var key = $('#key').val();
        var token = $("#token").val();
        if (key.length > 0 && token.length > 0) {
            videoSrc += "?" + key + "=" + token;
        }
        if (Hls.isSupported()) {
            console.log("Low Latency HLS: "+llHlsEnabled)
            hlsPlayer = new Hls(getHlsConfig(llHlsEnabled));
            hlsPlayer.loadSource(videoSrc);
            hlsPlayer.attachMedia(remoteVideo);
            hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
                console.log("Play with HLS.js");
                remoteVideo.play();
                onStarted();            
            });
        }
        else {
            $("#notifyFlash").text("Your browser doesn't support MSE technology required to play video");
        }
    }
}


function getHlsConfig(llHlsEnabled) {
    var config = {
        lowLatencyMode: false,
        enableWorker: true,
        backBufferLength: 90
    };
    if(llHlsEnabled) {
        // Here we configure HLS.JS for lower latency
        config = {
           lowLatencyMode: llHlsEnabled,
           enableWorker: true,
           backBufferLength: 90,
           liveBackBufferLength: 0,
           liveSyncDuration: 0.5,
           liveMaxLatencyDuration: 5,
           liveDurationInfinity: true,
           highBufferWatchdogPeriod: 1,
        };
    }
    return config;
}


function stopBtnClick() {
    if (hlsPlayer != null) {
        console.log("Stop HLS segments loading");
        hlsPlayer.stopLoad();
        hlsPlayer = null;
    }
    if (remoteVideo != null) {
        console.log("Stop HTML5 player");
        remoteVideo.pause();
        remoteVideo.currentTime = 0;
        remoteVideo.removeAttribute('src');
        remoteVideo.load();
    }
    onStopped();
}


function onStarted() {
    $("#urlServer").prop('disabled', true);
    $("#playStream").prop('disabled', true);
    $("#key").prop('disabled', true);
    $("#token").prop('disabled', true);
    $("#player").prop('disabled', true);
    $('#llHlsEnabled').prop('disabled', true);
    $("#applyBtn").prop('disabled', false).text("Stop").off('click').click(stopBtnClick);
}


function onStopped() {
    $("#urlServer").prop('disabled', false);
    $("#playStream").prop('disabled', false);
    $("#key").prop('disabled', false);
    $("#token").prop('disabled', false);
    $("#player").prop('disabled', false);
    $('#llHlsEnabled').prop('disabled', false);
    $("#applyBtn").prop('disabled', false).text("Play").off('click').click(playBtnClick);
}


function validateForm() {
    var valid = true;
    if (!$("#urlServer").val().length) {
        highlightInput($("#urlServer"));
        valid = false;
    } else {
        removeHighlight($("#urlServer"));
    }
    if (!$("#playStream").val().length) {
        highlightInput($("#playStream"));
        valid = false;
    } else {
        removeHighlight($("#playStream"));
    }

    return valid;
    
}


function highlightInput(input) {
    input.closest('.form-group').addClass("has-error");
}


function removeHighlight(input) {
    input.closest('.form-group').removeClass("has-error");
}
