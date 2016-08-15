//Init WCS JavaScript API
var f = Flashphoner.getInstance();

//Filename of recorded file
var recordFileName;

//////////////////////////////////
/////////////// Init /////////////


// Save connection and callee info in cookies
function setCookies() {

    if (notEmpty($("#urlServer").val())) {
        f.setCookie("urlServer", $("#urlServer").val());
    }

    if (notEmpty($("#publishStream").val())) {
        f.setCookie("publishStream", $("#publishStream").val());
    }

    if (notEmpty($("#playStream").val())) {
        f.setCookie("playStream", $("#playStream").val());
    }
}

function getCookies() {
    if (notEmpty(f.getCookie("urlServer"))) {
        $("#urlServer").val(decodeURIComponent(f.getCookie("urlServer")));
    } else {
        $("#urlServer").val(setURL());
    }

    if (notEmpty(f.getCookie("publishStream"))) {
        $("#publishStream").val(decodeURIComponent(f.getCookie("publishStream")));
    }

    if (notEmpty(f.getCookie("playStream"))) {
        $("#playStream").val(decodeURIComponent(f.getCookie("playStream")));
    }
}

function init_page() {

    $("#downloadDiv").hide();
    $("#connectBtn").click(function () {
            var state = $("#connectBtn").text();
            if (state == "Connect") {
                connect();
            } else {
                disconnect();
            }
            $(this).prop('disabled',true);
        }
    );

    $("#publishBtn").prop('disabled', true).click(function () {
            var state = $("#publishBtn").text();
            if (state == "Start") {
                if (!checkForEmptyField('#publishStream', '#publishForm')) { return false };
                publishStream();
            } else {
                unPublishStream();
            }
            $(this).prop('disabled',true);
        }
    );

    $("#playBtn").prop('disabled', true).click(function () {
            var state = $("#playBtn").text();
            var streamName = $("#publishStream").val();
            if (state == "Start") {
                if (!checkForEmptyField('#playStream', '#playForm')) { return false };
                playStream();
            } else {
                stopStream();
            }
            $(this).prop('disabled',true);
        }
    );
    if (detectBrowser() == "Android" && navigator.userAgent.indexOf("OPR") == -1) {
        var gotStream = function(stream) {
            stream.stop();
            return navigator.mediaDevices.enumerateDevices();
        };

        var gotDevices = function(devices) {
            devices.forEach(function(device) {
                console.log(device);
                if (device.kind === 'videoinput') {
                    if (device.label != "") {
                        var select = document.getElementById("videoSources");
                        if (select.length <= 2) {
                            var option = document.createElement("option");
                            option.text = device.label;
                            option.value = device.deviceId;
                            select.appendChild(option);
                        }
                    }
                }
            });
        };

        navigator.mediaDevices.getUserMedia({video: true, audio: true})
            .then(gotStream)
            .then(gotDevices)
            .catch(function(err) {
                console.log(err.name + ": " + error.message);
            });

        document.getElementById("cameraSelect").style.display = '';
    }
    getCookies();

};

function initAPI() {

    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    if (detectIE()) {
        detectFlash();
    }
    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.localMediaElementId = 'localVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";
    f.init(configuration);

    if (webrtcDetectedBrowser) {
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
    } else {
        document.getElementById('localVideo').style.visibility = "hidden";
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "visible";
    }

    init_page();
}

///////////////////////////////////
///////////// Controls ////////////
///////////////////////////////////

//New connection
function connect() {
    f.connect({urlServer: field("urlServer"), appKey: 'defaultApp', width: 0, height:0});
    setCookies();
}

//Disconnect
function disconnect() {
    f.disconnect();
    $("#connectBtn").text("Connect");
}

//Publish stream
function publishStream() {
    $("#downloadDiv").hide();
    var streamName = field("publishStream");
    if (detectBrowser() == "Android" && navigator.userAgent.indexOf("OPR") == -1) {
        var source = document.getElementById("videoSources");
        var camera = source.options[source.selectedIndex].value;
        Flashphoner.getInstance().configuration.videoSourceId = camera;
    }
    f.publishStream({name: streamName, record: record});
    setCookies();
}

//Stop stream publishing
function unPublishStream() {
    var streamName = field("publishStream");
    f.unPublishStream({name: streamName});
}

//Play stream
function playStream() {
    var streamName = field("playStream");
    f.playStream({name: streamName});
    setCookies();
}

//Stop stream playback
function stopStream() {
    var streamName = field("playStream");
    f.stopStream({name: streamName});
}

///////////////////////////////////
///////////// Listeners ///////////
///////////////////////////////////

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
        $("#connectBtn").text("Disconnect").prop('disabled',false);
        $("#publishBtn").prop('disabled', false);
        $("#playBtn").prop('disabled', false);
    } else {
        if (event.status == ConnectionStatus.Disconnected) {
            if (recordFileName) {
                showDownloadLink(recordFileName);
            }
        }
        resetStates();
    }
    setConnectionStatus(event.status);
}

//Connection Status
function streamStatusListener(event) {
    trace("streamStatusListener >> " + event.status);
    switch (event.status) {
        case StreamStatus.Publishing:
            setPublishStatus(event.status);
            $("#publishBtn").text("Stop").prop('disabled',false);
            $("#publishStream").prop('disabled',true);
            if ($("#cameraSelect").is(':visible')) {
                $("#videoSources").prop('disabled',true);
            }
            if (record) {
                recordFileName = event.recordName;
            }
            break;
        case StreamStatus.Unpublished:
            setPublishStatus(event.status);
            $("#publishBtn").text("Start").prop('disabled',false);
            $("#publishStream").prop('disabled',false);
            if ($("#cameraSelect").is(':visible')) {
                $("#videoSources").prop('disabled',false);
            }
            if (record) {
                showDownloadLink(recordFileName);
            }
            break;
        case StreamStatus.Playing:
            setPlaybackStatus(event.status);
            $("#playBtn").text("Stop").prop('disabled',false);
            $("#playStream").prop('disabled',true);
            break;
        case StreamStatus.Stoped:
        case StreamStatus.Paused:
            setPlaybackStatus(event.status);
            $("#playBtn").text("Start").prop('disabled',false);
            $("#playStream").prop('disabled',false);
            break;
        case StreamStatus.Failed:
            if (event.published) {
                setPublishStatus(event.status);
                $("#publishBtn").text("Start").prop('disabled',false);
                $("#publishStream").prop('disabled',false);
                if ($("#cameraSelect").is(':visible')) {
                    $("#videoSources").prop('disabled',false);
                }
            } else {
                setPlaybackStatus(event.status);
                $("#playBtn").text("Start").prop('disabled',false);
                $("#playStream").prop('disabled',false);
            }
            break;
        default:
            break;
    }
}

//Error
function errorEvent(event) {
    trace(event.info);
}

/////////////////////////////////////
///////////// Display UI ////////////
/////////////////////////////////////

// Show link to download recorded stream

function showDownloadLink(name) {
    // Set correct path for records. Stream records are saved to WCS_HOME/records directory.
    // http://flashphoner.com/docs/wcs4/wcs_docs/html/en/wcs-developer-guide/quick_start_recording_streams.htm
    var link = window.location.protocol + "//" + window.location.host + '/client/records/' + name;
    $("#link").attr("href", link);
    $("#downloadDiv").show();
    recordFileName = null;
}

// Set Connection Status
function setConnectionStatus(status) {
    if (status == "ESTABLISHED") {
        $("#connectionStatus").text(status).removeClass().attr("class","text-success");
    }

    if (status == "DISCONNECTED") {
        $("#connectionStatus").text(status).removeClass().attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#connectionStatus").text(status).removeClass().attr("class","text-danger");
    }
}

// Set Stream Status
function setPublishStatus(status) {

    $("#publishStatus").className = '';

    if (status == "PUBLISHING") {
        $("#publishStatus").attr("class", "text-success");
        if (record) {
            $("#publishStatus").text("Recording...");
            return;
        }
    }

    if (status == "UNPUBLISHED") {
        $("#publishStatus").attr("class", "text-muted");
        if (record) {
            $("#publishStatus").text("Recording complete");
            return;
        }
    }

    if (status == "FAILED") {
        $("#publishStatus").attr("class", "text-danger");
        if (record) {
            $("#publishStatus").text("Recording failed");
            return;
        }
    }

    $("#publishStatus").text(status);
}

// Set Stream Status
function setPlaybackStatus(status) {
    if (status == "PLAYING") {
        $("#playStatus").text(status).removeClass().attr("class","text-success");
    }

    if (status == "STOPPED") {
        $("#playStatus").text(status).removeClass().attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#playStatus").text(status).removeClass().attr("class","text-danger");
    }
}

// Check field for empty string
function checkForEmptyField(checkField, alertDiv) {
    if (!$(checkField).val()) {
        $(alertDiv).addClass("has-error");
        return false;
    } else {
        $(alertDiv).removeClass("has-error");
        return true;
    }
}

// Reset button's and field's state
function resetStates() {
    $("#connectBtn").text("Connect").prop('disabled',false);
    $("#publishBtn").text("Start").prop('disabled',true);
    $("#playBtn").text("Start").prop('disabled',true);
    $("#publishStatus").text("");
    $("#playStatus").text("");
    $("#publishStream").prop('disabled',false);
    $("#playStream").prop('disabled',false);
}