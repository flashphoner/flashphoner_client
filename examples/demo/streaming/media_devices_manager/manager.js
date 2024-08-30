var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var STREAM_EVENT = Flashphoner.constants.STREAM_EVENT;
var STREAM_EVENT_TYPE = Flashphoner.constants.STREAM_EVENT_TYPE;
var CONNECTION_QUALITY = Flashphoner.constants.CONNECTION_QUALITY;
var MEDIA_DEVICE_KIND = Flashphoner.constants.MEDIA_DEVICE_KIND;
var TRANSPORT_TYPE = Flashphoner.constants.TRANSPORT_TYPE;
var CONTENT_HINT_TYPE = Flashphoner.constants.CONTENT_HINT_TYPE;
var CONNECTION_QUALITY_UPDATE_TIMEOUT_MS = 10000;
var preloaderUrl = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var STAT_INTERVAL = 1000;
var localVideo;
var remoteVideo;
var constraints;
var previewStream;
var publishStream;
var currentVolumeValue = 50;
var currentGainValue = 50;
var publishStatsIntervalID;
var playStatsIntervalID;
var speechIntervalID;
var extensionId = "nlbaajplpmleofphigmgaifhoikjmbkg";
var videoBytesSent = 0;
var audioBytesSent = 0;
var videoBytesReceived = 0;
var audioBytesReceived = 0;
var playConnectionQualityStat = {};
var publishConnectionQualityStat = {};
// Speech detection parameters using incoming audio stats in Chrome #WCS-3290
var statSpeechDetector = {
    clipping: false,
    lastClip: 0,
    threshold: 0.010,
    latency: 750
};

try {
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    console.warn("Failed to create audio context");
}

function init_page() {
    $("#publishBitrateChart").hide();
    $("#playBitrateChart").hide();
    //init api
    try {
        Flashphoner.init({
            screenSharingExtensionId: extensionId,
            mediaProvidersReadyCallback: function (mediaProviders) {
                if (Flashphoner.isUsingTemasys()) {
                    $("#audioInputForm").hide();
                    $("#videoInputForm").hide();
                }
            }
        })
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }
    //local and remote displays
    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    if(Browser.isAndroid() || Browser.isiOS()) {
        $('#screenShareForm').hide();
    }

    Flashphoner.getMediaDevices(null, true, MEDIA_DEVICE_KIND.OUTPUT).then(function (list) {
        list.audio.forEach(function (device) {
            var audio = document.getElementById("audioOutput");
            var deviceInList = false;
            for (var i = 0; i < audio.options.length; i++) {
                if (audio.options[i].value === device.id) {
                    deviceInList = true;
                    break;
                }
            }
            if (!deviceInList) {
                var option = document.createElement("option");
                option.text = device.label || device.id;
                option.value = device.id;
                audio.appendChild(option);
            }
        });
    }).catch(function (error) {
        console.error(error);
        $('#audioOutputForm').remove();
    });

    Flashphoner.getMediaDevices(null, true).then(function (list) {
        list.audio.forEach(function (device) {
            var audio = document.getElementById("audioInput");
            var deviceInList = false;
            for (var i = 0; i < audio.options.length; i++) {
                if (audio.options[i].value === device.id) {
                    deviceInList = true;
                    break;
                }
            }
            if (!deviceInList) {
                var option = document.createElement("option");
                option.text = device.label || device.id;
                option.value = device.id;
                audio.appendChild(option);
            }
        });
        list.video.forEach(function (device) {
            console.log(device);
            var video = document.getElementById("videoInput");
            var deviceInList = false;
            for (var i = 0; i < video.options.length; i++) {
                if (video.options[i].value === device.id) {
                    deviceInList = true;
                    break;
                }
            }
            if (!deviceInList) {
                var option = document.createElement("option");
                option.text = device.label || device.id;
                option.value = device.id;
                if (option.text.toLowerCase().indexOf("back") >= 0 && video.children.length > 0) {
                    video.insertBefore(option, video.children[0]);
                } else {
                    video.appendChild(option);
                }
            }
        });
        $("#url").val(setURL() + "/" + createUUID(8));
        //set initial button callback
        onDisconnected();
        if (list.audio.length === 0) {
            $("#sendAudio").prop('checked', false).prop('disabled', true);
        }
        if (list.video.length === 0) {
            $("#sendVideo").prop('checked', false).prop('disabled', true);
        }
    }).catch(function (error) {
        $("#notifyFlash").text("Failed to get media devices");
    });

    if (Browser.isiOS() && Browser.isSafariWebRTC()) {
        document.addEventListener('visibilitychange', () => {
            onVisibilityChanged();
        });
    }

    $("#urlServer").val(setURL());
    var streamName = createUUID(4);
    $("#publishStream").val(streamName);
    $("#playStream").val(streamName);

    readyControls();
}

function onStopped() {
    previewStream = null;
    $("#playBtn").text("Play").off('click').click(playBtnClick).prop('disabled', false);
    unmuteInputs("play");
    $("#playResolution").text("");
    $("#volumeControl").slider("enable");
    var disable = !(Flashphoner.getSessions()[0] && Flashphoner.getSessions()[0].status() == SESSION_STATUS.ESTABLISHED);
    $("#playBtn").prop('disabled', disable);
    $("#playStream").prop('disabled', disable);
    clearStatInfo("in");
    if (playStatsIntervalID) {
        clearInterval(playStatsIntervalID);
        playStatsIntervalID = null;
    }
    if (speechIntervalID) {
        clearInterval(speechIntervalID);
        speechIntervalID = null;
        $("#talking").css('background-color', 'red');
    }
    enablePlayToggles(false);
}

function playBtnClick() {
    if (validateForm("play")) {
        muteInputs("play");
        $(this).prop('disabled', true);
        play();
    }
}

function onUnpublished() {
    publishStream = null;
    $('input:radio').attr("disabled", false);
    $("#publishBtn").text("Publish").off('click').click(publishBtnClick).prop('disabled', false);
    $("#switchBtn").text("Switch").off('click').prop('disabled',true);
    $("#switchMicBtn").text("Switch").off('click').prop('disabled',true);
    unmuteInputs("send");
    $("#publishResolution").text("");
    $("#testBtn").prop('disabled', false);
    var disable = !(Flashphoner.getSessions()[0] && Flashphoner.getSessions()[0].status() == SESSION_STATUS.ESTABLISHED);
    $("#publishBtn").prop('disabled', disable);
    $("#publishStream").prop('disabled', disable);
    clearStatInfo("out");
    if (publishStatsIntervalID) {
        clearInterval(publishStatsIntervalID);
        publishStatsIntervalID = null;
    }
    enablePublishToggles(false);
}

function publishBtnClick() {
    if (validateForm("send")) {
        muteInputs("send");
        $(this).prop('disabled', true);
        publish();
    }
}

function onPublishing(stream) {
    if (!publishStatsIntervalID) {
        publishStatsIntervalID = setInterval(loadPublishStats, STAT_INTERVAL);
    }
    $('input:radio').attr("disabled", true);
    $("#publishBtn").text("Stop").off('click').click(function () {
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);
    $("#switchBtn").text("Switch").off('click').click(function () {
        stream.switchCam().then(function(id) {
            console.log("Switched by button to camera " + id);
            $('#videoInput option:selected').prop('selected', false);
            $("#videoInput option[value='"+ id +"']").prop('selected', true);
        }).catch(function(e) {
            console.log("Error " + e);
        });
    })
    $("#switchMicBtn").click(function (){
        stream.switchMic().then(function(id) {
            $('#audioInput option:selected').prop('selected', false);
            $("#audioInput option[value='"+ id +"']").prop('selected', true);
        }).catch(function(e) {
            console.log("Error " + e);
        });
    }).prop('disabled', !($('#sendAudio').is(':checked')));
    stream.setVolume(currentVolumeValue);
}

function onPlaying(stream) {
    if (!playStatsIntervalID) {
        playStatsIntervalID = setInterval(loadPlayStats, STAT_INTERVAL);
    }
    $("#playBtn").text("Stop").off('click').click(function () {
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);
    $("#volumeControl").slider("enable");
    enablePlayToggles(true);
    if (stream.getAudioState()) {
        $("#audioMuted").text(stream.getAudioState().muted);
    }
    if (stream.getVideoState()) {
        $("#videoMuted").text(stream.getVideoState().muted);
    }
}

function onConnected(session) {
    $("#connectBtn").text("Disconnect").off('click').click(function () {
        $(this).prop('disabled', true);
        session.disconnect();
    }).prop('disabled', false);
    onUnpublished();
    onStopped();
}

function onDisconnected() {
    $("#connectBtn").text("Connect").off('click').click(function () {
        $('#urlServer').prop('disabled', true);
        $(this).prop('disabled', true);
        connect();
    }).prop('disabled', false);
    $('#urlServer').prop('disabled', false);
    onUnpublished();
    onStopped();
}

function onVisibilityChanged() {
    if (Browser.isiOS() && Browser.isSafariWebRTC() && document.hidden !== undefined) {
        // iOS Safari may change camera when rising from the background, use chosen one explicitly
        if (publishStream && !document.hidden) {
            publishStream.switchCam($('#videoInput').val()).then(function(id) {
                console.log("Switched explicitly to camera " + id);
                $('#videoInput option:selected').prop('selected', false);
                $("#videoInput option[value='"+ id +"']").prop('selected', true);
            }).catch(function(e) {
                console.log("Error " + e);
            });
        }
    }
}

function connect() {
    var url = $('#urlServer').val();
    var tm = parseInt($('#timeout').val());

    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url, timeout: tm}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        setStatus("#connectStatus", session.status());
        onConnected(session);
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus("#connectStatus", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus("#connectStatus", SESSION_STATUS.FAILED);
        onDisconnected();
    });
}

function play() {
    var streamName = $('#playStream').val();
    var session = Flashphoner.getSessions()[0];
    var transportOutput = $('#transportOutput').val();
    var mutedName="";
    var constraints = {
        audio: $("#playAudio").is(':checked'),
        video: $("#playVideo").is(':checked')
    };
    if (constraints.audio) {
        constraints.audio = {
            outputId: $('#audioOutput').val()
        }
        if ($("#playStereoAudio").is(':checked'))
        {
            constraints.audio.stereo = $("#playStereoAudio").is(':checked');
        }
    }
    if (constraints.video) {
        constraints.video = {
            width: (!$("#receiveDefaultSize").is(":checked")) ? parseInt($('#receiveWidth').val()) : 0,
            height: (!$("#receiveDefaultSize").is(":checked")) ? parseInt($('#receiveHeight').val()) : 0,
            bitrate: (!$("#receiveDefaultBitrate").is(":checked")) ? $("#receiveBitrate").val() : 0,
            quality: (!$("#receiveDefaultQuality").is(":checked")) ? $('#quality').val() : 0
        };
    }
    var strippedCodecs = $("#stripPlayCodecs").val();

    playConnectionQualityStat.chart = createOrClearChart('playBitrateChart', playConnectionQualityStat.chart);

    previewStream = session.createStream({
        name: streamName,
        display: remoteVideo,
        constraints: constraints,
        transport: transportOutput,
        stripCodecs: strippedCodecs
    }).on(STREAM_STATUS.PLAYING, function (stream) {
        playConnectionQualityStat.connectionQualityUpdateTimestamp = new Date().valueOf();
        setStatus("#playStatus", stream.status());
        onPlaying(stream);
        document.getElementById(stream.id()).addEventListener('resize', function (event) {
            $("#playResolution").text(event.target.videoWidth + "x" + event.target.videoHeight);
            resizeVideo(event.target);
        });
        //wait for incoming stream
        if (Flashphoner.getMediaProviders()[0] == "WebRTC") {
            setTimeout(function () {
                if(Browser.isChrome()) {
                    detectSpeechChrome(stream);
                } else {
                    detectSpeech(stream);
                }
            }, 3000);
        }
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus("#playStatus", STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus("#playStatus", STREAM_STATUS.FAILED, stream);
        onStopped();
    }).on(CONNECTION_QUALITY.UPDATE, function (quality, clientFiltered, serverFiltered) {
        updateChart(quality, clientFiltered, serverFiltered, playConnectionQualityStat);
    }).on(STREAM_EVENT, function(streamEvent) {
        if(streamEvent.payload !== undefined) {
            mutedName=streamEvent.payload.streamName;
        }
        switch (streamEvent.type) {
            case STREAM_EVENT_TYPE.AUDIO_MUTED:
                $("#audioMuted").text(true);
                $("#audioMutedStream").text(mutedName);
                break;
            case STREAM_EVENT_TYPE.AUDIO_UNMUTED:
                $("#audioMuted").text(false);
                $("#audioMutedStream").text(mutedName);
                break;
            case STREAM_EVENT_TYPE.VIDEO_MUTED:
                $("#videoMuted").text(true);
                $("#videoMutedStream").text(mutedName);
                break;
            case STREAM_EVENT_TYPE.VIDEO_UNMUTED:
                $("#videoMuted").text(false);
                $("#videoMutedStream").text(mutedName);
                break;

        }
        console.log("Received streamEvent ", streamEvent.type);
    });
    previewStream.play();
}

function createOrClearChart(chartId, bitrateComparisonChart) {
    if (!bitrateComparisonChart) {
        var canvas = document.getElementById(chartId);
        var ctx = canvas.getContext('2d');
        bitrateComparisonChart = new ComparisonChart(ctx);
    } else {
        bitrateComparisonChart.clearBitrateChart();
    }
    return bitrateComparisonChart;
}

function updateChart(calculatedQuality, clientFiltered, serverFiltered, connectionQualityStat) {
    var timestamp = new Date().valueOf();
    connectionQualityStat.connectionQualityUpdateTimestamp = timestamp;
    connectionQualityStat.chart.updateChart(clientFiltered, serverFiltered);
    connectionQualityStat.quality = calculatedQuality;
}

function publish() {
    if (testStarted)
        stopTest();

    var streamName = $('#publishStream').val();
    var constraints = getConstraints();
    var mediaConnectionConstraints;
    var session = Flashphoner.getSessions()[0];
    var transportInput = $('#transportInput').val();
    var contentHint = $('#contentHintInput').val();
    var cvo = $("#cvo").is(':checked');
    var strippedCodecs = $("#stripPublishCodecs").val();

    if (!$("#cpuOveruseDetection").is(':checked')) {
        mediaConnectionConstraints = {
            "mandatory": {
                googCpuOveruseDetection: false
            }
        }
    }

    publishConnectionQualityStat.chart = createOrClearChart('publishBitrateChart', publishConnectionQualityStat.chart);

    publishStream = session.createStream({
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        constraints: constraints,
        mediaConnectionConstraints: mediaConnectionConstraints,
        sdpHook: rewriteSdp,
        transport: transportInput,
        cvoExtension: cvo,
        stripCodecs: strippedCodecs,
        videoContentHint: contentHint
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        publishConnectionQualityStat.connectionQualityUpdateTimestamp = new Date().valueOf();
        $("#testBtn").prop('disabled', true);
        var video = document.getElementById(stream.id());
        //resize local if resolution is available
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            resizeLocalVideo({target: video});
        }
        enablePublishToggles(true);
        if ($("#muteVideoToggle").is(":checked")) {
            muteVideo();
        }
        if ($("#muteAudioToggle").is(":checked")) {
            muteAudio();
        }
        //remove resize listener in case this video was cached earlier
        video.removeEventListener('resize', resizeLocalVideo);
        video.addEventListener('resize', resizeLocalVideo);
        publishStream.setMicrophoneGain(currentGainValue);
        setStatus("#publishStatus", STREAM_STATUS.PUBLISHING);
        onPublishing(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        setStatus("#publishStatus", STREAM_STATUS.UNPUBLISHED);
        onUnpublished();
    }).on(STREAM_STATUS.FAILED, function () {
        setStatus("#publishStatus", STREAM_STATUS.FAILED);
        onUnpublished();
    }).on(CONNECTION_QUALITY.UPDATE, function (quality, clientFiltered, serverFiltered) {
        updateChart(quality, clientFiltered, serverFiltered, publishConnectionQualityStat);
    });
    publishStream.publish();
}

function getConstraints() {
    constraints = {
        audio: $("#sendAudio").is(':checked'),
        video: $("#sendVideo").is(':checked'),
    };

    if (constraints.audio) {
        constraints.audio = {
            deviceId: $('#audioInput').val()
        };
        if ($("#fec").is(':checked'))
            constraints.audio.fec = $("#fec").is(':checked');
        if ($("#sendStereoAudio").is(':checked'))
            constraints.audio.stereo = $("#sendStereoAudio").is(':checked');
        if (parseInt($('#sendAudioBitrate').val()) > 0)
            constraints.audio.bitrate = parseInt($('#sendAudioBitrate').val());
    }

    if (constraints.video) {
        constraints.video = {
            deviceId: $('#videoInput').val(),
            width: parseInt($('#sendWidth').val()),
            height: parseInt($('#sendHeight').val())
        };
        if (Browser.isSafariWebRTC() && Browser.isiOS() && Flashphoner.getMediaProviders()[0] === "WebRTC") {
            constraints.video.deviceId = {exact: $('#videoInput').val()};
        }
        if (parseInt($('#sendVideoMinBitrate').val()) > 0)
            constraints.video.minBitrate = parseInt($('#sendVideoMinBitrate').val());
        if (parseInt($('#sendVideoMaxBitrate').val()) > 0)
            constraints.video.maxBitrate = parseInt($('#sendVideoMaxBitrate').val());
        if (parseInt($('#fps').val()) > 0)
            constraints.video.frameRate = parseInt($('#fps').val());
    }

    return constraints;
}

function rewriteSdp(sdp) {
    var sdpStringFind = $("#sdpStringFind").val().replace('\\r\\n','\r\n');
    var sdpStringReplace = $("#sdpStringReplace").val().replace('\\r\\n','\r\n');
    if (sdpStringFind != 0 && sdpStringReplace != 0) {
        var newSDP = sdp.sdpString.toString();
        newSDP = newSDP.replace(new RegExp(sdpStringFind,"g"), sdpStringReplace);
        return newSDP;
    }
    return sdp.sdpString;
}

// UI helpers
// show connection, or local, or remote stream status
function setStatus(selector, status, stream) {
    var statusField = $(selector);
    statusField.text(status).removeClass();
    if (status == "PLAYING" || status == "ESTABLISHED" || status == "PUBLISHING") {
        statusField.attr("class", "text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED" || status == "STOPPED") {
        statusField.attr("class", "text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class", "text-danger");
    }
}

function muteInputs(selector) {
    $('[class*=group][id^=' + selector + ']').find('input').each(function () {
        if ($(this).attr('id') !== 'audioOutput') {
            $(this).prop('disabled', true);
        }
    });
}

function unmuteInputs(selector) {
    $('[class*=group][id^=' + selector + ']').find('input').each(function() {
        if ($(this).attr('id') == 'sendAudio' && $("#audioInput option").length === 0) {
            return;
        } else if ($(this).attr('id') == 'sendVideo' && $("#videoInput option").length === 0) {
            return;
        } else if (($(this).attr('id') == 'receiveWidth' || $(this).attr('id') == 'receiveHeight')) {
            if (!$("#receiveDefaultSize").is(":checked")) $(this).removeAttr("disabled");
        } else if ($(this).attr('id') == 'receiveBitrate') {
            if (!$("#receiveDefaultBitrate").is(":checked")) $(this).removeAttr("disabled");
        } else if ($(this).attr('id') == 'quality') {
            if (!$("#receiveDefaultQuality").is(":checked")) $(this).removeAttr("disabled");
        } else {
            $(this).removeAttr("disabled");
        }
    });
}



function resizeLocalVideo(event) {
    var requested = constraints.video;
    if (requested.width != event.target.videoWidth || requested.height != event.target.videoHeight) {
        console.warn("Camera does not support requested resolution, actual resolution is " + event.target.videoWidth + "x" + event.target.videoHeight);
    }
    $("#publishResolution").text(event.target.videoWidth + "x" + event.target.videoHeight);
    resizeVideo(event.target);
}



function validateForm(s) {
    var valid = true;
    if (!$("#" + s + "Video").is(':checked') && !$("#" + s + "Audio").is(':checked')) {
        highlightInput($("#" + s + "Video"));
        highlightInput($("#" + s + "Audio"));
        valid = false;
    } else {
        removeHighlight($("#" + s + "Video"));
        removeHighlight($("#" + s + "Audio"));
    }
    var validateInputs = function (selector) {
        $('#form ' + selector + ' :text, ' + selector + ' select').each(function () {
            if (!$(this).val() && ($(this).get(0).id && !$(this).get(0).id.startsWith("strip"))) {
                highlightInput($(this));
                valid = false;
            } else {
                var numericFields = ['fps', 'sendWidth', 'sendHeight', 'sendVideoMinBitrate', 'sendVideoMaxBitrate', 'receiveBitrate', 'quality'];
                if (numericFields.indexOf(this.id) != -1 && !(parseInt($(this).val()) >= 0)) {
                    highlightInput($(this));
                    valid = false;
                } else {
                    removeHighlight($(this));
                }
            }
        });
    };
    if (s == "send") {
        if ($("#sendAudio").is(':checked')) {
            validateInputs("#sendAudioGroup");
        }
        if ($("#sendVideo").is(':checked')) {
            validateInputs("#sendVideoGroup");
        }
    } else {
        validateInputs("#playGroup");
    }
    return valid;

    function highlightInput(input) {
        input.closest('.form-group').addClass("has-error");
    }

    function removeHighlight(input) {
        input.closest('.form-group').removeClass("has-error");
    }
}

function muteAudio() {
    if (publishStream) {
        publishStream.muteAudio();
    }
}

function unmuteAudio() {
    if (publishStream) {
        publishStream.unmuteAudio();
    }
}

function muteVideo() {
    if (publishStream) {
        publishStream.muteVideo();
    }
}

function unmuteVideo() {
    if (publishStream) {
        publishStream.unmuteVideo();
    }
}

function switchToScreen() {
    if (publishStream) {
        $('#switchBtn').prop('disabled', true);
        $('#videoInput').prop('disabled', true);
        publishStream.switchToScreen($('#mediaSource').val(), true).catch(function () {
            $("#screenShareToggle").removeAttr("checked");
            $('#switchBtn').prop('disabled', false);
            $('#videoInput').prop('disabled', false);
        });
    }
}

function switchToCam() {
    if (publishStream) {
        publishStream.switchToCam();
        $('#switchBtn').prop('disabled', false);
        $('#videoInput').prop('disabled', false);
    }
}

function enablePublishToggles(enable) {
    var $muteAudioToggle = $("#muteAudioToggle");
    var $muteVideoToggle = $("#muteVideoToggle");
    var $screenShareToggle = $("#screenShareToggle");
    var $publishChartToggle = $('#publishChartToggle');

    if (enable) {
        $muteAudioToggle.removeAttr("disabled");
        $muteAudioToggle.trigger('change');
        $muteVideoToggle.removeAttr("disabled");
        $muteVideoToggle.trigger('change');
        $screenShareToggle.removeAttr("disabled");
        $screenShareToggle.trigger('change');
        $publishChartToggle.removeAttr("disabled");
        $publishChartToggle.trigger('change');
    } else {
        $muteAudioToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
        $muteVideoToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
        $screenShareToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
        $publishChartToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
    }
}

function enablePlayToggles(enable) {
    var $playChartToggle = $('#playChartToggle');
    if (enable) {
        $playChartToggle.removeAttr("disabled");
        $playChartToggle.trigger('change');
    } else {
        $playChartToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
    }
}

// This code is just show how to detect speech activity
// Get player stream and connect it to script processor
// All magic is done by handleAudio function

function detectSpeech(stream, level, latency) {
    var mediaStream = document.getElementById(stream.id()).srcObject;
    var source = audioContext.createMediaStreamSource(mediaStream);
    var processor = audioContext.createScriptProcessor(512);
    processor.onaudioprocess = handleAudio;
    processor.connect(audioContext.destination);
    processor.clipping = false;
    processor.lastClip = 0;
    // threshold
    processor.threshold = level || 0.10;
    processor.latency = latency || 750;

    processor.isSpeech =
        function () {
            if (!this.clipping) return false;
            if ((this.lastClip + this.latency) < window.performance.now()) this.clipping = false;
            return this.clipping;
        };

    source.connect(processor);

    // Check speech every 500 ms
    speechIntervalID = setInterval(function () {
        if (processor.isSpeech()) {
            $("#talking").css('background-color', 'green');
        } else {
            $("#talking").css('background-color', 'red');
        }
    }, 500);
}

function handleAudio(event) {
    var buf = event.inputBuffer.getChannelData(0);
    var bufLength = buf.length;
    var x;
    for (var i = 0; i < bufLength; i++) {
        x = buf[i];
        if (Math.abs(x) >= this.threshold) {
            this.clipping = true;
            this.lastClip = window.performance.now();
        }
    }
}

// Detect speech using timer in Chrome because both ScriptProcessor and AudioWorklet don't work for incoming streams #WCS-3290
function detectSpeechChrome(stream, level, latency) {
    statSpeechDetector.threshold = level || 0.010;
    statSpeechDetector.latency = latency || 750;
    statSpeechDetector.clipping = false;
    statSpeechDetector.lastClip = 0;
    speechIntervalID = setInterval(function() {
        stream.getStats(function(stat) {
            let audioStats = stat.inboundStream.audio;
            if(!audioStats) {
                return;
            }
            // Using audioLevel WebRTC stats parameter
            if (audioStats.audioLevel >= statSpeechDetector.threshold) {
                statSpeechDetector.clipping = true;
                statSpeechDetector.lastClip = window.performance.now();
            }
            if ((statSpeechDetector.lastClip + statSpeechDetector.latency) < window.performance.now()) {
                statSpeechDetector.clipping = false;
            }
            if (statSpeechDetector.clipping) {
                $("#talking").css('background-color', 'green');
            } else {
                $("#talking").css('background-color', 'red');
            }
        });
    },500);
}

//Ready controls
function readyControls() {
    $("#receiveDefaultSize").click(function () {
        $("#receiveWidth").prop('disabled', $(this).is(':checked'));
        $("#receiveHeight").prop('disabled', $(this).is(':checked'));
    });
    $("#receiveDefaultBitrate").click(function () {
        $("#receiveBitrate").prop('disabled', $(this).is(':checked'));
    });
    $("#receiveDefaultQuality").click(function () {
        if ($(this).is(':checked')) {
            $("#quality").prop('disabled', true);

        } else {
            $("#quality").prop('disabled', false);
        }
    });

    $("#micGainControl").slider({
        range: "min",
        min: 0,
        max: 100,
        value: currentGainValue,
        step: 10,
        animate: true,
        slide: function (event, ui) {
            currentGainValue = ui.value;
            if(publishStream) {
                publishStream.setMicrophoneGain(currentGainValue);
            }
        }
    });

    $("#volumeControl").slider({
        range: "min",
        min: 0,
        max: 100,
        value: currentVolumeValue,
        step: 10,
        animate: true,
        slide: function (event, ui) {
            currentVolumeValue = ui.value;
            previewStream.setVolume(currentVolumeValue);
        }
    }).slider("disable");

    $("#testBtn").text("Test").off('click').click(function () {
        $(this).prop('disabled', true);
        if (Browser.isSafariWebRTC()) {
            Flashphoner.playFirstVideo(localVideo, true, preloaderUrl).then(function() {
                Flashphoner.playFirstVideo(remoteVideo, false, preloaderUrl).then(function() {
                    startTest();
                });
            });
            return;
        }
        startTest();
    }).prop('disabled', false);

    $("#audioOutput").change(function() {
        if (previewStream) {
            previewStream.setAudioOutputId($(this).val());
        }
    });

    $("#videoInput").change(function() {
        if (publishStream) {
            publishStream.switchCam($(this).val());
        }
    });

    $("#audioInput").change(function() {
        if (publishStream) {
            publishStream.switchMic($(this).val());
        }
    });

    //init transport forms
    var transportType;
    var option;
    var transportInput = document.getElementById("transportInput");
    for (transportType in TRANSPORT_TYPE) {
        option = document.createElement("option");
        option.text = transportType;
        option.value = transportType;
        transportInput.appendChild(option);
    }

    var transportOutput = document.getElementById("transportOutput");
    for (transportType in TRANSPORT_TYPE) {
        option = document.createElement("option");
        option.text = transportType;
        option.value = transportType;
        transportOutput.appendChild(option);
    }

    //init content hint form
    var contentType;
    var contentTypeValue;
    var option;
    var contentHintInput = document.getElementById("contentHintInput");
    for (contentType in CONTENT_HINT_TYPE) {
        option = document.createElement("option");
        switch(contentType) {
            case 'MOTION':
                contentTypeValue = CONTENT_HINT_TYPE.MOTION;
            break;
            case 'DETAIL':
                contentTypeValue = CONTENT_HINT_TYPE.DETAIL;
            break;
            case 'TEXT':
                contentTypeValue = CONTENT_HINT_TYPE.TEXT;
            break;
        }
        option.text = contentTypeValue;
        option.value = contentTypeValue;
        contentHintInput.appendChild(option);
    }
}

// Get WebRTC publishing stats
function loadPublishStats() {
    if (publishStream) {
        publishStream.getStats(function (stats) {
            if (stats) {
                if (stats.outboundStream) {
                    if (stats.outboundStream.video) {
                        showStat(stats.outboundStream.video, "outVideoStat");
                        let vBitrate = (stats.outboundStream.video.bytesSent - videoBytesSent) * 8;
                        if ($('#outVideoStatBitrate').length == 0) {
                            let html = "<div>Bitrate: " + "<span id='outVideoStatBitrate' style='font-weight: normal'>" + vBitrate + "</span>" + "</div>";
                            $("#outVideoStat").append(html);
                        } else {
                            $('#outVideoStatBitrate').text(vBitrate);
                        }
                        videoBytesSent = stats.outboundStream.video.bytesSent;

                        if(new Date().valueOf() - CONNECTION_QUALITY_UPDATE_TIMEOUT_MS > publishConnectionQualityStat.connectionQualityUpdateTimestamp) {
                            publishConnectionQualityStat.quality = CONNECTION_QUALITY.UNKNOWN;
                        }
                    }

                    if (stats.outboundStream.audio) {
                        showStat(stats.outboundStream.audio, "outAudioStat");
                        let aBitrate = (stats.outboundStream.audio.bytesSent - audioBytesSent) * 8;
                        if ($('#outAudioStatBitrate').length == 0) {
                            let html = "<div>Bitrate: " + "<span id='outAudioStatBitrate' style='font-weight: normal'>" + aBitrate + "</span>" + "</div>";
                            $("#outAudioStat").append(html);
                        } else {
                            $('#outAudioStatBitrate').text(aBitrate);
                        }
                        audioBytesSent = stats.outboundStream.audio.bytesSent;
                    }

                }
                if (stats.otherStats) {
                    showStat(stats.otherStats, "outConnectionStat");
                }
            }
            if (publishConnectionQualityStat.quality !== undefined) {
                showStat({"quality": publishConnectionQualityStat.quality}, "outConnectionStat");
            }
        });
    }
}

// Get WebRTC playback stats
function loadPlayStats() {
    if (previewStream) {
        previewStream.getStats(function (stats) {
            if (stats) {
                if (stats.inboundStream) {
                    if (stats.inboundStream.video) {
                        showStat(stats.inboundStream.video, "inVideoStat");
                        let vBitrate = (stats.inboundStream.video.bytesReceived - videoBytesReceived) * 8;
                        if ($('#inVideoStatBitrate').length == 0) {
                            let html = "<div>Bitrate: " + "<span id='inVideoStatBitrate' style='font-weight: normal'>" + vBitrate + "</span>" + "</div>";
                            $("#inVideoStat").append(html);
                        } else {
                            $('#inVideoStatBitrate').text(vBitrate);
                        }
                        videoBytesReceived = stats.inboundStream.video.bytesReceived;

                        if (new Date().valueOf() - CONNECTION_QUALITY_UPDATE_TIMEOUT_MS > playConnectionQualityStat.connectionQualityUpdateTimestamp) {
                            playConnectionQualityStat.quality = CONNECTION_QUALITY.UNKNOWN;
                        }
                    }

                    if (stats.inboundStream.audio) {
                        if (stats.inboundStream.audio.audioLevel) {
                            // Round audio level to 6 decimal places
                            stats.inboundStream.audio.audioLevel = stats.inboundStream.audio.audioLevel.toFixed(6);
                        }
                        showStat(stats.inboundStream.audio, "inAudioStat");
                        let aBitrate = (stats.inboundStream.audio.bytesReceived - audioBytesReceived) * 8;
                        if ($('#inAudioStatBitrate').length == 0) {
                            let html = "<div style='font-weight: bold'>Bitrate: " + "<span id='inAudioStatBitrate' style='font-weight: normal'>" + aBitrate + "</span>" + "</div>";
                            $("#inAudioStat").append(html);
                        } else {
                            $('#inAudioStatBitrate').text(aBitrate);
                        }
                        audioBytesReceived = stats.inboundStream.audio.bytesReceived;
                    }
                }
                if (stats.otherStats) {
                    showStat(stats.otherStats, "inConnectionStat");
                }
            }
            if (playConnectionQualityStat.quality !== undefined) {
                showStat({"quality": playConnectionQualityStat.quality}, "inConnectionStat");
            }
        });
    }
}

// Helper function to display stats
function showStat(stat, type) {
    Object.keys(stat).forEach(function(key) {
        if (typeof stat[key] !== 'object') {
            let k = key.split(/(?=[A-Z])/);
            let metric = "";
            for (let i = 0; i < k.length; i++) {
                metric += k[i][0].toUpperCase() + k[i].substring(1) + " ";
            }
            if ($("#" + key + "-" + type).length == 0) {
                let html = "<div style='font-weight: bold'>" + metric.trim() + ": <span id='" + key  + "-" + type + "' style='font-weight: normal'></span>" + "</div>";
                // $(html).insertAfter("#" + type);
                $("#" + type).append(html);
            } else {
                $("#" + key + "-" + type).text(stat[key]);
            }
        }
    });
}


//Test
var micLevelInterval;
var testStarted;
var audioContextForTest;

function startTest() {
    Flashphoner.getMediaAccess(getConstraints(), localVideo).then(function (disp) {
        $("#testBtn").text("Release").off('click').click(function () {
            $(this).prop('disabled', true);
            stopTest();
        }).prop('disabled', false);

        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        if (Flashphoner.getMediaProviders()[0] == "WebRTC" && window.AudioContext) {
            for (i = 0; i < localVideo.children.length; i++) {
                if (localVideo.children[i] && localVideo.children[i].id.indexOf("-LOCAL_CACHED_VIDEO") != -1) {
                    var stream = localVideo.children[i].srcObject;
                    audioContextForTest = new AudioContext();
                    var microphone = audioContextForTest.createMediaStreamSource(stream);
                    var javascriptNode = audioContextForTest.createScriptProcessor(1024, 1, 1);
                    microphone.connect(javascriptNode);
                    javascriptNode.connect(audioContextForTest.destination);
                    javascriptNode.onaudioprocess = function (event) {
                        var inpt_L = event.inputBuffer.getChannelData(0);
                        var sum_L = 0.0;
                        for (var i = 0; i < inpt_L.length; ++i) {
                            sum_L += inpt_L[i] * inpt_L[i];
                        }
                        $("#micLevel").text(Math.floor(Math.sqrt(sum_L / inpt_L.length) * 100));
                    }
                }
            }
        }
        testStarted = true;
    }).catch(function (error) {
        $("#testBtn").prop('disabled', false);
        testStarted = false;
    });
}


function stopTest() {
    releaseResourcesForTesting();
    if (Flashphoner.releaseLocalMedia(localVideo)) {
        $("#testBtn").text("Test").off('click').click(function () {
            $(this).prop('disabled', true);
            startTest();
        }).prop('disabled', false);
    } else {
        $("#testBtn").prop('disabled', false);
    }
}

function releaseResourcesForTesting() {
    testStarted = false;
    clearInterval(micLevelInterval);
    if (audioContextForTest) {
        audioContextForTest.close();
        audioContextForTest = null;
    }
}

function clearStatInfo(selector) {
    if (selector == 'in') {
        audioBytesReceived = 0;
        videoBytesReceived = 0;
    } else {
        audioBytesSent = 0;
        videoBytesSent = 0;
    }
    $("#" + selector + "VideoStat").children().each(function() {$(this).remove()});
    $("#" + selector + "AudioStat").children().each(function() {$(this).remove()});
    $("#" + selector + "ConnectionStat").children().each(function() {$(this).remove()});
}
