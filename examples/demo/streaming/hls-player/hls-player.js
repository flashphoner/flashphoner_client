var player = null;

function loadPlayerPage() {
    $("#playerPage").load("player-page.html", initPage );
}

function initPage() {
    $("#header").text("HLS VideoJS Player Minimal");
    $("#urlServer").val(getHLSUrl());
    $("#applyBtn").prop('disabled', false).text("Play").off('click').click(playBtnClick);
    var remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.className = "video-js vjs-default-skin";
    player = videojs(remoteVideo);
}

function playBtnClick() {
    if (validateForm()) {
        var streamName = $('#playStream').val();
        streamName = encodeURIComponent(streamName);
        var videoSrc = $("#urlServer").val() + '/' + streamName + '/' + streamName + '.m3u8';
        var key = $('#key').val();
        var token = $("#token").val();
        if (key.length > 0 && token.length > 0) {
            videoSrc += "?" + key + "=" + token;
        }
        player.src({
            src: videoSrc,
            type: "application/vnd.apple.mpegurl"
        });
        console.log("Play with VideoJs");
        player.play();
        onStarted();
    }
}


function stopBtnClick() {
    if (player != null) {
        console.log("Stop VideoJS player");
        //player.pause();
        player.dispose();
    }
    onStopped();
}


function onStarted() {
    $("#urlServer").prop('disabled', true);
    $("#playStream").prop('disabled', true);
    $("#key").prop('disabled', true);
    $("#token").prop('disabled', true);
    $("#player").prop('disabled', true);
    $("#applyBtn").prop('disabled', false).text("Stop").off('click').click(stopBtnClick);
}


function onStopped() {
    $("#urlServer").prop('disabled', false);
    $("#playStream").prop('disabled', false);
    $("#key").prop('disabled', false);
    $("#token").prop('disabled', false);
    $("#player").prop('disabled', false);
    $("#applyBtn").prop('disabled', false).text("Play").off('click').click(playBtnClick);
    if(!document.getElementById('remoteVideo')) {
        createRemoteVideo(document.getElementById('videoContainer'));
    }
}


function createRemoteVideo(parent) {
    remoteVideo = document.createElement("video");
    remoteVideo.id = "remoteVideo";
    remoteVideo.width=852;
    remoteVideo.height=480;
    remoteVideo.controls="controls";
    remoteVideo.autoplay="autoplay";
    remoteVideo.type="application/vnd.apple.mpegurl";
    remoteVideo.className = "video-js vjs-default-skin";
    parent.appendChild(remoteVideo);
    player = videojs(remoteVideo);
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
