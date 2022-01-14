var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var STREAM_EVENT = Flashphoner.constants.STREAM_EVENT;
var STREAM_EVENT_TYPE = Flashphoner.constants.STREAM_EVENT_TYPE;
var STREAM_STATUS_INFO = Flashphoner.constants.STREAM_STATUS_INFO;
var ERROR_INFO = Flashphoner.constants.ERROR_INFO;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var PUBLISH_FAILURE_DETECTOR_MAX_TRIES = 3;
var PUBLISH_FAILURE_DETECTOR_INTERVAL = 500;
var RESTART_MAX_TRIES = 100;
var RESTART_TIMEOUT = 3000;
var MAX_PINGS_MISSING = 10;
var PING_CHECK_TIMEOUT = 5000;
var Browser = Flashphoner.Browser;
var localVideo;
var remoteVideo;
var h264PublishFailureDetector;
var currentSession;
var streamPublishing;
var streamPlaying;
var streamingRestarter;
var connection;
var connectionType;

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

    // session and streams state objects
    currentSession = sessionState();
    streamPublishing = streamState();
    streamPlaying = streamState();
    // Publish failure detector object #WCS-3382
    h264PublishFailureDetector = codecPublishingFailureDetector();
    // Publishing/playback restarter object #WCS-3410
    streamingRestarter = streamRestarter(function() {
        if (streamPublishing.wasActive) {
            onPublishRestart();
        }
        if (streamPlaying.wasActive && streamPlaying.name != streamPublishing.name) {
            onPlayRestart();
        }
    });
    // Start network change detection #WCS-3410
    networkChangeDetector();

    $("#urlServer").val(setURL());
    var streamName = createUUID(4);
    $("#publishStream").val(streamName);
    $("#playStream").val(streamName);
    $("#bitrateInteval").val(PUBLISH_FAILURE_DETECTOR_INTERVAL);
    $("#bitrateMaxTries").val(PUBLISH_FAILURE_DETECTOR_MAX_TRIES);
    $("#restoreTimeout").val(RESTART_TIMEOUT);
    $("#restoreMaxTries").val(RESTART_MAX_TRIES);
    $("#maxPingsMissing").val(MAX_PINGS_MISSING);
    $("#pingsPeriod").val(PING_CHECK_TIMEOUT);
    onDisconnected();
    onUnpublished();
    onStopped();
}

function connect() {
    var restoreConnection = $("#restoreConnection").is(':checked');
    var url = $('#urlServer').val();
    var receiveProbes = restoreConnection ? $("#maxPingsMissing").val() : 0;
    var probesInterval = restoreConnection ? $("#pingsPeriod").val() : 0;

    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession({
        urlServer: url,
        receiveProbes: receiveProbes,
        probesInterval: probesInterval
    }).on(SESSION_STATUS.ESTABLISHED, function (session) {
        setStatus("#connectStatus", session.status());
        currentSession.set(url, session);
        onConnected(session);
        if(restoreConnection) {
            if(streamPublishing.wasActive) {
                console.log("A stream was published before disconnection, restart publishing");
                onPublishRestart();
                return;
            }
            if(streamPlaying.wasActive) {
                console.log("A stream was played before disconnection, restart playback");
                onPlayRestart();
            }
        }
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus("#connectStatus", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
        // Prevent streaming restart if session is manually disconnected
        if (currentSession.isManuallyDisconnected) {
            streamPublishing.clear();
            streamPlaying.clear();
            streamingRestarter.reset();
            currentSession.clear();
        }
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus("#connectStatus", SESSION_STATUS.FAILED);
        onDisconnected();
        if(restoreConnection
           && (streamPublishing.wasActive || streamPlaying.wasActive)) {
            streamingRestarter.restart($("#restoreTimeout").val(), $("#restoreMaxTries").val());
        }
    });
}

function onConnected(session) {
    $("#connectBtn").text("Disconnect").off('click').click(function () {
        $(this).prop('disabled', true);
        currentSession.isManuallyDisconnected = true;
        session.disconnect();
    }).prop('disabled', false);
    onUnpublished();
    onStopped();
}

function onDisconnected() {
    $("#connectBtn").text("Connect").off('click').click(function () {
        if (validateForm()) {
            $('#urlServer').prop('disabled', true);
            $(this).prop('disabled', true);
            disableForm('reconnectForm', true);
            connect();
        }
    }).prop('disabled', false);
    $('#urlServer').prop('disabled', false);
    onUnpublished();
    onStopped();
    disableForm('bitrateForm', false);
    disableForm('reconnectForm', false);
}

function onPublishing(stream) {
    $("#publishBtn").text("Stop").off('click').click(function () {
        $(this).prop('disabled', true);
        streamPublishing.isManuallyStopped = true;
        stream.stop();
    }).prop('disabled', false);
    $("#publishInfo").text("");    
    // Start publish failure detector by bitrate #WCS-3382
    if($("#checkBitrate").is(':checked')) {
        h264PublishFailureDetector.startDetection(stream, $("#bitrateInteval").val(), $("#bitrateMaxTries").val());
    }
}

function onUnpublished() {
    $("#publishBtn").text("Publish").off('click').click(publishBtnClick);
    if (currentSession.getStatus() == SESSION_STATUS.ESTABLISHED) {
        $("#publishBtn").prop('disabled', false);
        $('#publishStream').prop('disabled', false);
    } else {
        $("#publishBtn").prop('disabled', true);
        $('#publishStream').prop('disabled', true);
    }
    h264PublishFailureDetector.stopDetection(streamPublishing.isManuallyStopped || currentSession.isManuallyDisconnected);
    disableForm('bitrateForm', false);
}

function publishBtnClick(stripCodecs) {
    if (currentSession.getStatus() != SESSION_STATUS.ESTABLISHED) {
        // Prevent stream publishing if session is in wrong state 
        console.error("Can't publish, session is not established");
        return;
    }
    if (validateForm()) {
        $('#publishStream').prop('disabled', true);
        $(this).prop('disabled', true);
        disableForm('bitrateForm', true);
        if (Browser.isSafariWebRTC()) {
            Flashphoner.playFirstVideo(localVideo, true, PRELOADER_URL).then(function() {
                publishStream(stripCodecs);
            });
            return;
        }
        publishStream(stripCodecs);
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
    if (Flashphoner.getSessions()[0] && Flashphoner.getSessions()[0].status() == SESSION_STATUS.ESTABLISHED) {
        $("#playBtn").prop('disabled', false);
        $('#playStream').prop('disabled', false);
    } else {
        $("#playBtn").prop('disabled', true);
        $('#playStream').prop('disabled', true);
    }
}

function playBtnClick() {
    if (currentSession.getStatus() != SESSION_STATUS.ESTABLISHED) {
        // Prevent stream publishing if session is in wrong state 
        console.error("Can't play, session is not established");
        return;
    }
    if (validateForm()) {
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

function publishStream(stripCodecs) {
    var session = Flashphoner.getSessions()[0];
    var streamName = $('#publishStream').val();

    session.createStream({
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        receiveVideo: false,
        receiveAudio: false,
        stripCodecs: stripCodecs
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        setStatus("#publishStatus", STREAM_STATUS.PUBLISHING);
        onPublishing(stream);
        streamPublishing.set(streamName, stream);
        streamingRestarter.reset();
        if ($("#restoreConnection").is(':checked')
           && streamPlaying.wasActive) {
            console.log("A stream was played before, restart playback");
            onPlayRestart();
        }
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        setStatus("#publishStatus", STREAM_STATUS.UNPUBLISHED);
        onUnpublished();
        if (!streamPlaying.wasActive) {
            // No stream playback< we don't need restart any more
            streamingRestarter.reset();
        } else if (streamPlaying.wasActive && streamPlaying.name == streamPublishing.name) {
            // Prevent playback restart for the same stream
            streamingRestarter.reset();
        }
        streamPublishing.clear();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus("#publishStatus", STREAM_STATUS.FAILED, stream);
        onUnpublished();
        if ($("#restoreConnection").is(':checked') && stream.getInfo() != ERROR_INFO.LOCAL_ERROR) {
            streamingRestarter.restart($("#restoreTimeout").val(), $("#restoreMaxTries").val());
        }
    }).publish();
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
        streamingRestarter.reset();
        streamPlaying.set(streamName, stream);
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus("#playStatus", STREAM_STATUS.STOPPED);
        onStopped();
        streamingRestarter.reset();
        streamPlaying.clear();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus("#playStatus", STREAM_STATUS.FAILED, stream);
        onStopped();
        if ($("#restoreConnection").is(':checked')) {
            streamingRestarter.restart($("#restoreTimeout").val(), $("#restoreMaxTries").val());
        }
    }).play();
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

function disableForm(formId, disable) {
    $('#' + formId + ' :input').each(function () {
        $(this).prop('disabled', disable);
    });
}

// H264 publishing failure detector using outgoing video stats in Chrome #WCS-3382
function codecPublishingFailureDetector() {
    var detector = {
        failed: false,
        codec: "",
        lastBytesSent: 0,
        counter: null,
        publishFailureIntervalID: null,
        startDetection: function(stream, failureCheckInterval, maxBitrateDropsCount) {
            detector.failed = false;
            detector.lastBytesSent = 0;
            detector.counter = counterWithThreshold(maxBitrateDropsCount);
            detector.publishFailureIntervalID = setInterval(function() {
                // Detect publishing failure in Chrome using outgoing streaming stats #WCS-3382
                stream.getStats(function(stat) {
                    let videoStats = stat.outboundStream.video;
                    if(!videoStats) {
                        return;
                    }
                    let stats_codec = videoStats.codec;
                    let bytesSent = videoStats.bytesSent;
                    let bitrate = (bytesSent - detector.lastBytesSent) * 8;
                    if (bitrate == 0) {
                        detector.counter.inc();
                        console.log("Bitrate is 0 (" + detector.counter.getCurrent() + ")");
                        if (detector.counter.exceeded()) {
                            detector.failed = true;
                            console.log("Publishing seems to be failed, stop the stream");
                            stream.stop();
                        }
                    } else {
                        detector.counter.reset();
                    }
                    detector.lastBytesSent = bytesSent;
                    detector.codec = stats_codec;
                    $("#publishInfo").text(detector.codec);
                });
            }, failureCheckInterval);
        },
        stopDetection: function(isManuallyStopped) {
            if (detector.publishFailureIntervalID) {
                clearInterval(detector.publishFailureIntervalID);
                detector.publishFailureIntervalID = null;
            }
            // Clear failed state if streaming is stopped manually
            if (isManuallyStopped) {
                detector.failed = false;
            }
            // Check if bitrate is constantly 0 #WCS-3382
            if (detector.failed) {
                $("#publishInfo").text("Failed to publish " + detector.codec);
                if($("#changeCodec").is(':checked')) {
                    // Try to change codec from H264 to VP8 #WCS-3382
                    if (detector.codec == "H264") {
                        console.log("H264 publishing seems to be failed, trying VP8 by stripping H264");
                        let stripCodecs = "H264";
                        publishBtnClick(stripCodecs);
                    } else if (detector.codec == "VP8") {
                        console.log("VP8 publishing seems to be failed, giving up");
                    }
                } else {
                    // Try to republish with the same codec #WCS-3410
                    publishBtnClick();
                }
            }                
        }
    };
    
    return(detector);
}

// Restart publishing or playback automatically #WCS-3410
function streamRestarter(onRestart) {
    let logger = Flashphoner.getLogger();
    var restarter = {
        counter: null,
        restartTimerId: null,
        init: function() {
            restarter.counter = counterWithThreshold(RESTART_MAX_TRIES);
        },
        restart: function(restartTimeout, restartMaxTimes) {
            if (restarter.restartTimerId) {
                return;
            }
            if (restartMaxTimes < 1) {
                console.log("Streaming will not be restarted");
                return;
            }
            restarter.counter.set(restartMaxTimes);
            restarter.restartTimerId = setInterval(function(){
                if (restarter.counter.exceeded()) {
                    logger.info("Tried to restart for " + restartMaxTimes + " times with " +restartTimeout + " ms interval, cancelled");
                    restarter.reset();
                    return;
                }
                onRestart();
                restarter.counter.inc();
            }, restartTimeout);
            logger.info("Timer " + restarter.restartTimerId + " started to restart streaming after " + restartTimeout + " ms interval");
        },
        reset: function() {
            if (restarter.restartTimerId) {
                clearInterval(restarter.restartTimerId);
                logger.info("Timer " + restarter.restartTimerId + " stopped");
                restarter.restartTimerId = null;
            }
            restarter.counter.reset();
        }
    };
    restarter.init();

    return(restarter);
}

// Function to invoke when publishing restart timeout is fired
function onPublishRestart() {
    let logger = Flashphoner.getLogger();
    let sessions = Flashphoner.getSessions();
    if (!sessions.length || sessions[0].status() == SESSION_STATUS.FAILED) {
        logger.info("Restart session to publish");
        click("connectBtn");
    } else {
        let streams = sessions[0].getStreams();
        let stream = null;
        let clickButton = false;
        if (streams.length == 0) {
            // No streams in session, try to restart publishing
            logger.info("No streams in session, restart publishing");
            clickButton = true;
        } else {
            // If there is already a stream, check its state and restart publishing if needed
            for (let i = 0; i < streams.length; i++) {
                if (streams[i].name() === $('#publishStream').val()) {
                    stream = streams[i];
                    if (!isStreamPublishing(stream)) {
                        logger.info("Restart stream " + stream.name() + " publishing");
                        clickButton = true;
                    }
                    break;
                }
            }
            if (!stream) {
                logger.info("Restart stream publishing");
                clickButton = true;
            }
        }
        if (clickButton) {
            click("publishBtn");
        }
    }
}

// Function to invoke when playing restart timeout is fired
function onPlayRestart() {
    let logger = Flashphoner.getLogger();
    let sessions = Flashphoner.getSessions();
    if (!sessions.length || sessions[0].status() == SESSION_STATUS.FAILED) {
        logger.info("Restart session to play");
        click("connectBtn");
    } else {
        let streams = sessions[0].getStreams();
        let stream = null;
        let clickButton = false;
        if (streams.length == 0) {
            // No streams in session, try to restart playing
            logger.info("No streams in session, restart playback");
            clickButton = true;
        } else {
            // If there is already a stream, check its state and restart playing if needed
            for (let i = 0; i < streams.length; i++) {
                if (streams[i].name() === $('#playStream').val()) {
                    stream = streams[i];
                    if (!isStreamPlaying(stream)) {
                        logger.info("Restart stream " + stream.name() + " playback");
                        clickButton = true;
                    }
                    break;
                }
            }
            if (!stream) {
                logger.info("Restart stream playback");
                clickButton = true;
            }
        }
        if (clickButton) {
            click("playBtn");
        }
    }
}

// Helper function to click a button
function click(buttonId) {
    let selector = "#" + buttonId;
    if (!$(selector).prop('disabled')) {
        $(selector).click();
    }
}

// Stream publishing status helper function
function isStreamPublishing(stream) {
    switch(stream.status()) {
        case STREAM_STATUS.PENDING:
        case STREAM_STATUS.PUBLISHING:
            return true;
        default:
            return false;
    }
}

// Stream status helper function
function isStreamPlaying(stream) {
    switch(stream.status()) {
        case STREAM_STATUS.PENDING:
        case STREAM_STATUS.PLAYING:
        case STREAM_STATUS.RESIZE:
        case STREAM_STATUS.SNAPSHOT_COMPLETE:
        case STREAM_STATUS.NOT_ENOUGH_BANDWIDTH:
            return true;
        default:
            return false;
    }
}

// Helper counter with threshold
function counterWithThreshold(threshold) {
    var counter = {
        value: 0,
        threshold: threshold,
        set: function(newThreshold) {
            counter.threshold = newThreshold;
        },
        inc: function() {
            counter.value++;
        },
        reset: function() {
            counter.value = 0;
        },
        exceeded: function() {
            return(counter.value >= counter.threshold);
        },
        getCurrent: function() {
            return(counter.value);
        }
    };

    return(counter);
}

// Session state object
function sessionState() {
    var session = {
        url: "",
        isManuallyDisconnected: false,
        sdkSession: null,
        set: function(url, sdkSession) {
            session.url = url;
            session.sdkSession = sdkSession;
            session.isManuallyDisconnected = false;
        },
        clear: function() {
            session.url = "";
            session.sdkSession = null;
            session.isManuallyDisconnected = false;
        },
        getStatus: function() {
            if (session.sdkSession) {
                return(session.sdkSession.status());
            }
            return(SESSION_STATUS.DISCONNECTED);
        }
    };

    return(session);
}

// Stream state object
function streamState() {
    var stream = {
        name: "",
        wasActive: false,
        isManuallyStopped: false,
        sdkStream: null,
        set: function(name, sdkStream) {
            stream.name = name;
            stream.sdkStream = sdkStream;
            stream.isManuallyStopped = false;
            stream.wasActive = true;
        },
        clear: function() {
            stream.name = "";
            stream.sdkStream = null;
            stream.isManuallyStopped = false;
            stream.wasActive = false;
        }
    };

    return(stream);
}

// Network change detection using Network Information API #WCS-3410
function networkChangeDetector() {
    // The API is supported in Chromium browsers and Firefox for Android
    if (Browser.isSafariWebRTC()) {
        return;
    }
    if (Browser.isChrome() || (Browser.isFirefox() && Browser.isAndroid())) {
        connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            connectionType = connection.type;
            if (Browser.isFirefox()) {
                connection.ontypechange = onNetworkChange;
            } else {
                connection.onchange = onNetworkChange;
            }
        }
    }
}

function onNetworkChange() {
    if (connection) {
        if (connection.type === undefined) {
            return;
        }
        // If network type is changed, close the session
        console.log("connectionType = " + connectionType + ", connection.type = " + connection.type);
        if (isNetworkConnected() && connection.type != connectionType) {
            if (currentSession.getStatus() == SESSION_STATUS.ESTABLISHED) {
                let logger = Flashphoner.getLogger();
                logger.info("Close session due to network change from " + connectionType + " to " + connection.type);
                currentSession.sdkSession.disconnect();
            }
        }
    connectionType = connection.type;
    }
}

function isNetworkConnected() {
    if (connection) {
        switch (connection.type) {
            case "cellular":
            case "ethernet":
            case "wifi":
            case "wimax":
                return(true);
        }
    }
    return(false);
}
