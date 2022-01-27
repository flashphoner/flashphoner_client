var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;

function init_page() {
    //init api
    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    $("#url").val(setURL());
    onDisconnected();
    onStopped(1);
    onStopped(2);
}

function connect() {
    var url = $('#url').val();
    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function(session){
        setStatus("#connectStatus", session.status());
        onConnected(session)
    }).on(SESSION_STATUS.DISCONNECTED, function(){
        setStatus("#connectStatus", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    }).on(SESSION_STATUS.FAILED, function(){
        setStatus("#connectStatus", SESSION_STATUS.FAILED);
        onDisconnected();
    });
}

function onConnected(session) {
    $("#connectBtn").text("Disconnect").off('click').click(function(){
        $(this).prop('disabled', true);
        session.disconnect();
    }).prop('disabled', false);
    onStopped(1);
    onStopped(2);
}

function onDisconnected() {
    $("#connectBtn").text("Connect").off('click').click(function(){
        if (validateForm("connectionForm")) {
            $('#url').prop('disabled', true);
            $(this).prop('disabled', true);
            connect();
        }
    }).prop('disabled', false);
    $('#url').prop('disabled', false);
    onStopped(1);
    onStopped(2);
}

function playStream(index, display) {
    var session = Flashphoner.getSessions()[0];
    var streamName = $('#streamName' + index).val();

    session.createStream({
        name: streamName,
        display: display
    }).on(STREAM_STATUS.PENDING, function(stream) {
        var video = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            video.addEventListener('resize', function (event) {
                resizeVideo(event.target);
            });
        }
    }).on(STREAM_STATUS.PLAYING, function(stream) {
        setStatus("#status" + index, stream.status());
        onPlaying(index, stream);
    }).on(STREAM_STATUS.STOPPED, function() {
        setStatus("#status" + index, STREAM_STATUS.STOPPED);
        onStopped(index);
    }).on(STREAM_STATUS.FAILED, function() {
        setStatus("#status" + index, STREAM_STATUS.FAILED);
        onStopped(index);
    }).play();
}

function onPlaying(index, stream) {
    $("#playBtn" + index).text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);
}

function onStopped(index) {
    $("#playBtn" + index).text("Play").off('click').click(function () {
        playBtnClick(index);
    });
    if (Flashphoner.getSessions()[0] && Flashphoner.getSessions()[0].status() == SESSION_STATUS.ESTABLISHED) {
        $("#playBtn" + index).prop('disabled', false);
        $('#streamName' + index).prop('disabled', false);
    } else {
        $("#playBtn" + index).prop('disabled', true);
        $('#streamName' + index).prop('disabled', true);
    }
}

function playBtnClick(index) {
    if (validateForm("form" + index)) {
        $('#streamName' + index).prop('disabled', true);
        $(this).prop('disabled', true);

        var display = document.getElementById("player" + index);

        if (Flashphoner.getMediaProviders()[0] === "WSPlayer") {
            Flashphoner.playFirstSound();
        }
        playStream(index, display);
    }
}

//show connection or remote stream status
function setStatus(selector, status) {
    var statusField = $(selector);
    statusField.text(status).removeClass();
    if (status == "PLAYING" || status == "ESTABLISHED") {
        statusField.attr("class","text-success");
    } else if (status == "DISCONNECTED" || status == "STOPPED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
    }
}

function validateForm(formId) {
    var valid = true;
    $('#' + formId + ' :text').each(function(){
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
