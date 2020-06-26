var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var localVideo;
var streams = [];
var testSession;

function init_page() {
    //init api
    try {
        Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology needed for this example");
        return;
    }

    $("#url").val(setURL() + "/" + createUUID(8));
    $("#downloadDiv").hide();

    toInitialState();
}

function toRecordedState() {
    $("#publishBtn").text("Stop").off('click').click(function () {
        for (var i in streams) {
            streams[i].stop();
        }
        streams = [];
        toInitialState();
    }).prop('disabled', false);
}

function toInitialState() {
    $("#publishBtn").text("Start").off('click').click(function () {
        if (validateForm()) {
        	$(this).prop('disabled', true);
        	$("#countStreams").prop('disabled', true);
        	$("#url").prop('disabled', true);
        	startRecordingSeveralStreams();
        }
    }).prop('disabled', false);
    $("#countStreams").prop('disabled', false);
    $("#url").prop('disabled', false);
}

function startRecordingSeveralStreams() {
	$("#statusLog").text("");
    var url = $('#url').val();
    console.log("Create new session with url " + url);
    if (testSession) {
        testSession.on(SESSION_STATUS.DISCONNECTED, function () {
        });
        testSession.on(SESSION_STATUS.FAILED, function () {
        });
        testSession.disconnect();
        testSession = undefined;
    }
    testSession = Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        addSessionStatusLog(session);
        //session connected, start playback
        publishStreams(session);
    }).on(SESSION_STATUS.DISCONNECTED, function (session) {
        addSessionStatusLog(session);
        toInitialState();
    }).on(SESSION_STATUS.FAILED, function (session) {
        addSessionStatusLog(session);
        toInitialState();
    });
}

function publishStreams(session) {
    var streamName = createUUID(8);

    function checkCountStreams() {
        var $publishBtn = $("#publishBtn");
        if ($publishBtn.text() === "Start" && $publishBtn.prop('disabled') ) {
            if (streams.length < $("#countStreams").val()) {
                publishStreams(session);
            } else {
                toRecordedState();
            }
        }
    }

    if (streams.length == 0) {
    	localVideo = document.getElementById("localVideo");
    } else {
    	localVideo = document.getElementById("localTestVideo");
    }

    var stream = session.createStream({
        name: streamName,
        display: localVideo,
        record: true,
        receiveVideo: false,
        receiveAudio: false
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        checkCountStreams();
        addStatusLog(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function (stream) {
        checkCountStreams();
        addStatusLog(stream);
    }).on(STREAM_STATUS.FAILED, function (stream) {
        checkCountStreams();
        addStatusLog(stream);

    });
    addStatusLog(stream);
    stream.publish();
    streams.push(stream);
}

//show connection or local stream status
function addStatusLog(stream) {
    var statusField = $("#statusLog");
    statusField.text(statusField.text() + "Stream: " + stream.name() + " - " + stream.status() + (stream.getInfo() ? " - " + stream.getInfo() : "") + "\n");
    statusField.scrollTop(statusField[0].scrollHeight - statusField.height());
}

function addSessionStatusLog(session) {
    var statusField = $("#statusLog");
    statusField.text(statusField.text() + "Session: " + session.getServerUrl() + " - " + session.status() + "\n");
    statusField.scrollTop(statusField[0].scrollHeight - statusField.height());
}

function validateForm() {
    var valid = true;
    $(':text').each(function () {
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