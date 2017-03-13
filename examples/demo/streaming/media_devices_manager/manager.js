var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var localVideo;
var remoteVideo;
var constraints;
var previewStream;
var publishStream;
var currentVolumeValue = 50;
var intervalID;

try {
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch(e) {
    console.warn("Failed to create audio context");
}

function init_page() {
    //init api
    try {
        Flashphoner.init({
            flashMediaProviderSwfLocation: '../../../../media-provider.swf',
            mediaProvidersReadyCallback: function (mediaProviders) {
                //hide remote video if current media provider is Flash
                if (mediaProviders[0] == "Flash") {
                    $("#fecForm").hide();
                    $("#stereoForm").hide();
                    $("#sendAudioBitrateForm").hide();
                    $("#cpuOveruseDetectionForm").hide();
                }
                if (Flashphoner.isUsingTemasys()) {
                    $("#audioInputForm").hide();
                    $("#videoInputForm").hide();
                }
            }
        })
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology necessary for work of an example");
        return;
    }
    Flashphoner.getMediaDevices(null, true).then(function (list) {
        list.audio.forEach(function (device) {
            var audio = document.getElementById("audioInput");
            var i;
            var deviceInList = false;
            for (i = 0; i < audio.options.length; i++) {
                if (audio.options[i].value == device.id) {
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
            var i;
            var deviceInList = false;
            for (i = 0; i < video.options.length; i++) {
                if (video.options[i].value == device.id) {
                    deviceInList = true;
                    break;
                }
            }
            if (!deviceInList) {
                var option = document.createElement("option");
                option.text = device.label || device.id;
                option.value = device.id;
                video.appendChild(option);
            }
        });
        //local and remote displays
        localVideo = document.getElementById("localVideo");
        remoteVideo = document.getElementById("remoteVideo");

        $("#url").val(setURL() + "/" + createUUID(8));

        //set initial button callback
        onStopped();
    }).catch(function (error) {
        $("#notifyFlash").text("Failed to get media devices");
    });
    $("#receiveDefaultSize").click(function () {
        if ($(this).is(':checked')) {
            $("#receiveWidth").prop('disabled', true);
            $("#receiveHeight").prop('disabled', true);

        } else {
            $("#receiveWidth").prop('disabled', false);
            $("#receiveHeight").prop('disabled', false);
        }
    });
    $("#receiveDefaultBitrate").click(function () {
        if ($(this).is(':checked')) {
            $("#receiveBitrate").prop('disabled', true);

        } else {
            $("#receiveBitrate").prop('disabled', false);
        }
    });
    $("#receiveDefaultQuality").click(function () {
        if ($(this).is(':checked')) {
            $("#quality").prop('disabled', true);

        } else {
            $("#quality").prop('disabled', false);
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
}

function onStarted(publishStream, previewStream) {
    $("#publishBtn").text("Stop").off('click').click(function () {
        $(this).prop('disabled', true);
        previewStream.stop();
    }).prop('disabled', false);
    //enableMuteToggles(false);
    $("#volumeControl").slider("enable");
    previewStream.setVolume(currentVolumeValue);
    //intervalID = setInterval(function() {
    //    previewStream.getStats(function(stat) {
    //        if (stat.incomingStreams.audio && stat.incomingStreams.audio.audioOutputLevel > 100) {
    //            $("#talking").css('background-color', 'green');
    //        } else {
    //            $("#talking").css('background-color', 'red');
    //        }
    //    });
    //},250);

}

function onStopped() {
    $("#publishBtn").text("Start").off('click').click(function () {
        if (validateForm()) {
            muteInputs();
            $(this).prop('disabled', true);
            start();
        }
    }).prop('disabled', false);
    unmuteInputs();
    $("#publishResolution").text("");
    $("#playResolution").text("");
    $("#volumeControl").slider("disable");
    clearInterval(intervalID);
    //enableMuteToggles(false);
}

function start() {
    //check if we already have session
    var url = $('#url').val();
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        var session = Flashphoner.getSessions()[0];
        if (session.getServerUrl() == url) {
            startStreaming(session);
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

    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        //session connected, start streaming
        startStreaming(session);
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus(SESSION_STATUS.DISCONNECTED);
        onStopped();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus(SESSION_STATUS.FAILED);
        onStopped();
    });
}

function startStreaming(session) {
    var streamName = field("url").split('/')[3];
    constraints = {
        audio: $("#sendAudio").is(':checked'),
        video: $("#sendVideo").is(':checked')
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
        if (parseInt($('#sendVideoBitrate').val()) > 0)
            constraints.video.bitrate = parseInt($('#sendVideoBitrate').val());
        if (parseInt($('#fps').val()) > 0)
            constraints.video.frameRate = parseInt($('#fps').val());
    }
    var mediaConnectionConstraints;
    if (!$("#cpuOveruseDetection").is(':checked')) {
        mediaConnectionConstraints = {
            "mandatory": {
                googCpuOveruseDetection: false
            }
        }
    }
    publishStream = session.createStream({
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        constraints: constraints,
        mediaConnectionConstraints: mediaConnectionConstraints
    }).on(STREAM_STATUS.PUBLISHING, function (publishStream) {
        var video = document.getElementById(publishStream.id());
        //resize local if resolution is available
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            resizeLocalVideo({target: video});
        }
        enableMuteToggles(true);
        if ($("#muteVideoToggle").is(":checked")) {
            muteVideo();
        }
        if ($("#muteAudioToggle").is(":checked")) {
            muteAudio();
        }
        //remove resize listener in case this video was cached earlier
        video.removeEventListener('resize', resizeLocalVideo);
        video.addEventListener('resize', resizeLocalVideo);
        setStatus(STREAM_STATUS.PUBLISHING);

        //play preview
        var constraints = {
            audio: $("#playAudio").is(':checked'),
            video: $("#playVideo").is(':checked')
        };
        if (constraints.video) {
            constraints.video = {
                width: (!$("#receiveDefaultSize").is(":checked")) ? parseInt($('#receiveWidth').val()) : 0,
                height: (!$("#receiveDefaultSize").is(":checked")) ? parseInt($('#receiveHeight').val()) : 0,
                bitrate: (!$("#receiveDefaultBitrate").is(":checked")) ? $("#receiveBitrate").val() : 0,
                quality: (!$("#receiveDefaultQuality").is(":checked")) ? $('#quality').val() : 0
            };
        }
        previewStream = session.createStream({
            name: streamName,
            display: remoteVideo,
            constraints: constraints
        }).on(STREAM_STATUS.PLAYING, function (previewStream) {
            document.getElementById(previewStream.id()).addEventListener('resize', function (event) {
                $("#playResolution").text(event.target.videoWidth + "x" + event.target.videoHeight);
                resizeVideo(event.target);
            });
            //enable stop button
            onStarted(publishStream, previewStream);
            //wait for incoming stream
            setTimeout(function(){
                detectSpeech(previewStream);
            },3000);
        }).on(STREAM_STATUS.STOPPED, function () {
            publishStream.stop();
        }).on(STREAM_STATUS.FAILED, function () {
            //preview failed, stop publishStream
            if (publishStream.status() == STREAM_STATUS.PUBLISHING) {
                setStatus(STREAM_STATUS.FAILED);
                publishStream.stop();
            }
        });
        previewStream.play();
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        setStatus(STREAM_STATUS.UNPUBLISHED);
        //enable start button
        onStopped();
    }).on(STREAM_STATUS.FAILED, function () {
        setStatus(STREAM_STATUS.FAILED);
        //enable start button
        onStopped();
    });
    publishStream.publish();
}

//show connection or local stream status
function setStatus(status) {
    var statusField = $("#streamStatus");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING") {
        statusField.attr("class", "text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class", "text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class", "text-danger");
    }
}

function muteInputs() {
    $(":text, select, :checkbox").each(function () {
        $(this).attr('disabled', 'disabled');
    });
}

function unmuteInputs() {
    $(":text, select, :checkbox").each(function () {
        if (($(this).attr('id') == 'receiveWidth' || $(this).attr('id') == 'receiveHeight')) {
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

function validateForm() {
    var valid = true;
    if (!$("#sendVideo").is(':checked') && !$("#sendAudio").is(':checked')) {
        highlightInput($("#sendVideo"));
        highlightInput($("#sendAudio"));
        valid = false;
    } else {
        removeHighlight($("#sendVideo"));
        removeHighlight($("#sendAudio"));
    }
    if (!$("#playVideo").is(':checked') && !$("#playAudio").is(':checked')) {
        highlightInput($("#playVideo"));
        highlightInput($("#playAudio"));
        valid = false;
    } else {
        removeHighlight($("#playVideo"));
        removeHighlight($("#playAudio"));
    }
    $('#form :text, select').each(function () {
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            var numericFields = ['fps', 'sendWidth', 'sendHeight', 'sendVideoBitrate', 'receiveBitrate', 'quality'];
            if (numericFields.indexOf(this.id) != -1 && !(parseInt($(this).val()) >= 0)) {
                highlightInput($(this));
                valid = false;
            } else {
                removeHighlight($(this));
            }
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

function enableMuteToggles(enable) {
    var $muteAudioToggle = $("#muteAudioToggle");
    var $muteVideoToggle = $("#muteVideoToggle");

    if (enable) {
        $muteAudioToggle.removeAttr("disabled");
        $muteAudioToggle.trigger('change');
        $muteVideoToggle.removeAttr("disabled");
        $muteVideoToggle.trigger('change');
    }
    else {
        $muteAudioToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
        $muteVideoToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
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
        function() {
            if (!this.clipping) return false;
            if ((this.lastClip + this.latency) < window.performance.now()) this.clipping = false;
            return this.clipping;
        };

    source.connect(processor);

    // Check speech every 500 ms
    intervalID = setInterval(function() {
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
    for (var i=0; i<bufLength; i++) {
        x = buf[i];
        if (Math.abs(x)>=this.threshold) {
            this.clipping = true;
            this.lastClip = window.performance.now();
        }
    }
}