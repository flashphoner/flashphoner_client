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

    localVideo = document.getElementById("localVideo");

    $("#url").val(setURL() + "/" + createUUID(8));
    $("#downloadDiv").hide();
    $("#testUrl").val(setURL());

    onStopped();
    toInitialState();
}

function onStarted(stream) {
    $("#publishBtn").text("Stop").off('click').click(function () {
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);
}

function onStopped() {
    $("#publishBtn").text("Start").off('click').click(publishBtnClick).prop('disabled', false);
    $('#url').prop('disabled', false);
}

function publishBtnClick() {
    if (validateForm()) {
        $(this).prop('disabled', true);
        $('#url').prop('disabled', true);
        $("#downloadDiv").hide();
        if (Browser.isSafariWebRTC()) {
            Flashphoner.playFirstVideo(localVideo, true, PRELOADER_URL).then(function() {
                startRecording();
            });
            return;
        }
        startRecording();
    }
}
function startRecording() {
    var url = $('#url').val();
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        var session = Flashphoner.getSessions()[0];
        if (session.getServerUrl() == url) {
            publishStream(session);
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
        publishStream(session);
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus(SESSION_STATUS.DISCONNECTED);
        onStopped();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus(SESSION_STATUS.FAILED);
        onStopped();
    });
}

function publishStream(session) {
    var streamName = $('#url').val().split('/')[3];
    session.createStream({
        name: streamName,
        display: localVideo,
        record: true,
        receiveVideo: false,
        receiveAudio: false
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        setStatus(stream.status());
        onStarted(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function (stream) {
        setStatus(stream.status());
        showDownloadLink(stream.getRecordInfo());
        onStopped();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus(stream.status(), stream.getInfo());
        showDownloadLink(stream.getRecordInfo());
        onStopped();
    }).publish();
}

//show connection or local stream status
function setStatus(status, info) {
    var statusField = $("#status");
    var infoField = $("#info");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING") {
        statusField.attr("class", "text-success");
        infoField.text("");
    } else if (status == "DISCONNECTED" || status == "ESTABLISHED" || status == "UNPUBLISHED") {
        statusField.attr("class", "text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class", "text-danger");
        if (info) {
            infoField.text(info).attr("class", "text-muted");
        }
    }
}


// Show link to download recorded stream
function showDownloadLink(name) {
    if (name) {
        // Set correct path for records. Stream records are saved to WCS_HOME/records directory.
        // http://flashphoner.com/docs/wcs4/wcs_docs/html/en/wcs-developer-guide/quick_start_recording_streams.htm
        var link = window.location.protocol + "//" + window.location.host + '/client/records/' + name;
        $("#link").attr("href", link);
        $("#recVideo").attr("src", link).attr("controls", true);
        $("#downloadDiv").show();
    }
}


function toRecordedState() {
    $("#startTestBtn").text("Stop").off('click').click(function () {
        for (var i in streams) {
            streams[i].stop();
        }
        streams = [];
        toInitialState();
    }).prop('disabled', false);
}

function toInitialState() {
    $("#startTestBtn").text("Start").off('click').click(function () {
        $(this).prop('disabled', true);
        startRecordingSeveralStreams();
    }).prop('disabled', false);
    $('#testUrl').prop('disabled', false);
}

function startRecordingSeveralStreams() {
    var url = $('#testUrl').val();
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
        var $startTestBtn = $("#startTestBtn");
        if ($startTestBtn.text() === "Start" && $startTestBtn.prop('disabled') ) {
            if (streams.length < $("#countStreams").val()) {
                publishStreams(session);
            } else {
                toRecordedState();
            }
        }
    }

    var stream = session.createStream({
        name: streamName,
        display: document.getElementById("localTestVideo"),
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
