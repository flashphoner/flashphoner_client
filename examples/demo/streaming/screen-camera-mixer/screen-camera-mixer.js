const SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
const STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
const Browser = Flashphoner.Browser;
let localVideoScreen;
let localVideoCamera;

const init_page =  function() {
    //init api
    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    if (Browser.isAndroid() && Browser.isiOS()) {
        $("#notify").modal('show');
        return false;
    }

    localVideoScreen = document.getElementById("localVideoScreen");
    localVideoCamera = document.getElementById("localVideoCamera");
    $("#url").val(setURL() + "/" + createUUID(8));
    $("#mixerName").val("mixer");
    onDisconnected();

}

const isSafariMacOS = function() {
    return Browser.isSafari() && !Browser.isAndroid() && !Browser.isiOS();
}

const setConnectButton = function(action, session) {
    $("#connectBtn").text(action).off('click').click(function(){
        if (validateForm()) {
            muteInputs();
            $(this).prop('disabled', true);
            if (action === "Connect") {
                connect();
            } else if (action === "Disconnect") {
                session.disconnect();
            }
        }
    }).prop('disabled', false);
}

const setPublishButton = function(action, session, cameraStream) {
    $("#publishBtn").text(action).off('click').click(function(){
        if (action == "Start") {
            startStreaming(session);
        } else if (action === "Stop") {
            $(this).prop('disabled', true);
            cameraStream.stop();
        }
    }).prop('disabled', false);
}

const onStarted = function(cameraStream) {
    setPublishButton("Stop", null, cameraStream);
    $("#connectBtn").prop('disabled', false);
}

const onStopped = function(session) {
    setPublishButton("Start", session, null);
    $("#connectBtn").prop('disabled', false);
}

const onConnected = function(session) {
    setPublishButton("Start", session, null);
    setConnectButton("Disconnect", session);
}

const onDisconnected = function() {
    unmuteInputs();
    $("#publishBtn").prop('disabled', true);
    setConnectButton("Connect", null);
}

const connect = function() {
    //check if we already have session
    let url = field("url");
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        let session = Flashphoner.getSessions()[0];
        if (session.getServerUrl() == url) {
            return;
        } else {
            //remove session DISCONNECTED and FAILED callbacks
            session.on(SESSION_STATUS.DISCONNECTED, function(){});
            session.on(SESSION_STATUS.FAILED, function(){});
            session.disconnect();
        }
    }

    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function(session){
        //session connected, start streaming
        setStatus("screen", SESSION_STATUS.ESTABLISHED);
        setStatus("camera", SESSION_STATUS.ESTABLISHED);
        onConnected(session);
    }).on(SESSION_STATUS.DISCONNECTED, function(){
        setStatus("screen", SESSION_STATUS.DISCONNECTED);
        setStatus("camera", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    }).on(SESSION_STATUS.FAILED, function(){
        setStatus("screen", SESSION_STATUS.FAILED);
        setStatus("camera", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    });

}

const startStreaming = function(session) {
    if (validateForm()) {
        muteInputs();
        $("publishBtn").prop('disabled', true);
        startStreamingScreen(session);
    }
}

const startStreamingScreen = function(session) {
    let streamName = getStreamName("screen", field("url"));
    let constraints = {
        video: {
            width: parseInt($('#width').val()),
            height: parseInt($('#height').val()),
            frameRate: parseInt($('#fps').val()),
            type: "screen",
            withoutExtension: true
        }
    };
    if (Browser.isFirefox()) {
        constraints.video.mediaSource = "screen";
    }
    let options = {
        name: streamName,
        display: localVideoScreen,
        constraints: constraints
    }
    if (isSafariMacOS()) {
        options.disableConstraintsNormalization = true;
    }
    session.createStream(options).on(STREAM_STATUS.PUBLISHING, function(screenStream) {
        /*
         * User can stop sharing screen capture using Chrome "stop" button.
         * Catch onended video track event and stop publishing.
         */
        document.getElementById(screenStream.id()).srcObject.getVideoTracks()[0].onended = function (e) {
            screenStream.stop();
        };
        document.getElementById(screenStream.id()).addEventListener('resize', function(event){
            resizeVideo(event.target);
        });
        setStatus("screen", STREAM_STATUS.PUBLISHING, screenStream);
        startStreamingCamera(session, screenStream);
    }).on(STREAM_STATUS.UNPUBLISHED, function() {
        setStatus("screen", STREAM_STATUS.UNPUBLISHED);
        //enable start button
        onStopped(session);
    }).on(STREAM_STATUS.FAILED, function(stream) {
        setStatus("screen", STREAM_STATUS.FAILED, stream);
        //enable start button
        onStopped(session);
    }).publish();
}

const startStreamingCamera = function(session, screenStream) {
    let streamName = getStreamName("camera", field("url"));
    let options = {
        name: streamName,
        display: localVideoCamera
    }
    session.createStream(options).on(STREAM_STATUS.PUBLISHING, function(cameraStream) {
        document.getElementById(cameraStream.id()).addEventListener('resize', function(event){
            resizeVideo(event.target);
        });
        setStatus("camera", STREAM_STATUS.PUBLISHING, cameraStream);
        onStarted(cameraStream);
    }).on(STREAM_STATUS.UNPUBLISHED, function() {
        setStatus("camera", STREAM_STATUS.UNPUBLISHED);
        screenStream.stop();
    }).on(STREAM_STATUS.FAILED, function(stream) {
        setStatus("camera", STREAM_STATUS.FAILED, stream);
        if (screenStream.status() == STREAM_STATUS.PUBLISHING) {
            setStatus(STREAM_STATUS.FAILED, stream);
            screenStream.stop();
        }
    }).publish();
}

//show connection or local stream status
const setStatus = function(type, status, stream) {
    let nameField = $("#"+type+"Name");
    let statusField = $("#"+type+"Status");
    let infoField = $("#"+type+"Info");
    if (stream) {
        nameField.text(stream.name);
    } else {
        nameField.text("");
    }
    statusField.text(status).removeClass();
    if (status == "PUBLISHING" || status == "ESTABLISHED") {
        statusField.attr("class","text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
        if (stream) {
            infoField.text(stream.getInfo()).attr("class","text-muted");
        }
    }
}

const muteInputs = function() {
    $(":input").each(function() {
       $(this).prop('disabled',true);
    });
}

const unmuteInputs =  function() {
    $(":input").each(function() {
        $(this).prop('disabled',false);
    });
}

const validateForm = function() {
    let valid = true;
    $(':text').each(function(){
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            let numericFields = ['fps', 'width', 'height'];
            if (numericFields.indexOf(this.id) != -1 && !(parseInt($(this).val()) > 0)) {
                highlightInput($(this));
                valid = false;
            } else {
                removeHighlight($(this));
            }
        }
    });
    return valid;
}


const highlightInput = function(input) {
    input.closest('.form-group').addClass("has-error");
}
const removeHighlight = function(input) {
    input.closest('.form-group').removeClass("has-error");
}

function getStreamName(type, url) {
    let streamName = url.endsWith('/') === false ? url.split('/')[3] : "";
    if (streamName) {
        streamName += "-" + type;
        if ($("#useMixer").prop('checked')) {
            let mixerName = field("mixerName");
            if (mixerName) {
                streamName += "#" + mixerName;
            }
        }
    }
    return streamName;
}