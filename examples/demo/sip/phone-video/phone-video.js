var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var CALL_STATUS = Flashphoner.constants.CALL_STATUS;
var MEDIA_DEVICE_KIND = Flashphoner.constants.MEDIA_DEVICE_KIND;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var localVideo;
var remoteVideo;
var currentCall;
var statIntervalId;
var screenSharing;

$(document).ready(function () {
    loadCallFieldSet();
});

function loadStats() {
    if (currentCall) {
        // Stats shoukld be collected for active calls only #WCS-3260
        let status = currentCall.status();
        if (status != CALL_STATUS.ESTABLISHED && status != CALL_STATUS.HOLD) {
            return;
        }
        currentCall.getStats(function (stats) {
            if (stats && stats.outboundStream) {
                if (stats.outboundStream.video) {
                    $('#videoStatBytesSent').text(stats.outboundStream.video.bytesSent);
                    $('#videoStatPacketsSent').text(stats.outboundStream.video.packetsSent);
                } else {
                    $('#videoStatBytesSent').text(0);
                    $('#videoStatPacketsSent').text(0);
                }

                if (stats.outboundStream.audio) {
                    $('#audioStatBytesSent').text(stats.outboundStream.audio.bytesSent);
                    $('#audioStatPacketsSent').text(stats.outboundStream.audio.packetsSent);
                } else {
                    $('#audioStatBytesSent').text(0);
                    $('#audioStatPacketsSent').text(0);
                }
            }
        });
    }
}

// Include Field Set HTML
function loadCallFieldSet() {
    $("#callFieldSet").load("call-fieldset.html", loadCallControls);
}

// Include Call Controls HTML
function loadCallControls() {
    $("#callControls").load("call-controls.html", loadVideoCallStatistics);
}

function loadVideoCallStatistics() {
    $("#callVideoStatistics").load("call-video-statistics.html", loadAudioCallStatistics)
}

function loadAudioCallStatistics() {
    $("#callAudioStatistics").load("call-audio-statistics.html", init_page)
}

function init_page() {
    //init api
    try {
        Flashphoner.init();
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    if (!Browser.isChrome()) {
        $('#speakerForm').remove();
    }

    Flashphoner.getMediaDevices(null, true, MEDIA_DEVICE_KIND.ALL).then(function (list) {
        for (var type in list) {
            if (list.hasOwnProperty(type)) {
                list[type].forEach(function (device) {
                    if (device.type == "mic") {
                        var list = document.getElementById("micList");
                        if ($("#micList option[value='" + device.id + "']").length == 0) {
                            var option = document.createElement("option");
                            option.text = device.label || device.id;
                            option.value = device.id;
                            list.appendChild(option);
                        }
                    } else if (device.type == "speaker") {
                        var list = document.getElementById("speakerList");
                        if (list && $("#speakerList option[value='" + device.id + "']").length == 0) {
                            var option = document.createElement("option");
                            option.text = device.label || device.id;
                            option.value = device.id;
                            list.appendChild(option);
                        }
                    } else if (device.type == "camera") {
                        var list = document.getElementById("cameraList");
                        if ($("#cameraList option[value='" + device.id + "']").length == 0) {
                            var option = document.createElement("option");
                            option.text = device.label || device.id;
                            option.value = device.id;
                            list.appendChild(option);
                        }
                    }
                });
            }

        }
        $("#speakerList").change(function () {
            if (currentCall) {
                currentCall.setAudioOutputId($(this).val());
            }
        });
    }).catch(function (error) {

        $("#notifyFlash").text("Failed to get media devices " + error);
    });

    //local and remote displays
    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    // Set websocket URL
    $("#urlServer").val(setURL());

    // Display outgoing call controls
    showOutgoing();

    onHangupOutgoing();
    onDisconnected();
    $("#holdBtn").click(function () {
        var state = $(this).text();
        if (state == "Hold") {
            $(this).text("Unhold");
            currentCall.hold();
        } else {
            $(this).text("Hold");
            currentCall.unhold();
        }
        $(this).prop('disabled', true);
    });

    $("#cameraList").change(function () {
        if (currentCall) {
            currentCall.switchCam($(this).val());
        }
    });
    $("#micList").change(function () {
        if (currentCall) {
            currentCall.switchMic($(this).val());
        }
    });

    $("#switchCamBtn").click(function () {
        if (currentCall) {
            currentCall.switchCam().then(function (id) {
                $('#cameraList option:selected').prop('selected', false);
                $("#cameraList option[value='" + id + "']").prop('selected', true);
            }).catch(function (e) {
                console.log("Error " + e);
            });
        }
    }).prop('disabled', true);
    $("#switchMicBtn").click(function () {
        if (currentCall) {
            currentCall.switchMic().then(function (id) {
                $('#micList option:selected').prop('selected', false);
                $("#micList option[value='" + id + "']").prop('selected', true);
            }).catch(function (e) {
                console.log("Error " + e);
            });
        }
    }).prop('disabled', true);
    $("#switchSpkBtn").click(function () {
        if (currentCall) {
            var id = $('#speakerList').find(":selected").val();
            currentCall.setAudioOutputId(id);
        }
    }).prop('disabled', true);

    var $screenShareToggle = $("#screenSharingToggle");
    $screenShareToggle.bootstrapSwitch({
        on: 'on',
        off: 'off',
        size: 'md'
    });

    $screenShareToggle.change(function () {
        if (this.checked) {
            switchToScreen();
        } else {
            switchToCam();
        }
    });


    if (Browser.isAndroid() || Browser.isiOS()) {
        $('#screenSharingForm').remove();
    }
}

function connect() {
    var url = $('#urlServer').val();
    var registerRequired = $("#sipRegisterRequired").is(':checked');

    var sipOptions = {
        login: $("#sipLogin").val(),
        authenticationName: $("#sipAuthenticationName").val(),
        password: $("#sipPassword").val(),
        domain: $("#sipDomain").val(),
        outboundProxy: $("#sipOutboundProxy").val(),
        port: $("#sipPort").val(),
        registerRequired: registerRequired
    };

    var connectionOptions = {
        urlServer: url,
        sipOptions: sipOptions
    };

    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession(connectionOptions).on(SESSION_STATUS.ESTABLISHED, function (session) {
        setStatus("#regStatus", SESSION_STATUS.ESTABLISHED);
        onConnected(session);
        if (!registerRequired) {
            disableOutgoing(false);
        }
    }).on(SESSION_STATUS.REGISTERED, function (session) {
        setStatus("#regStatus", SESSION_STATUS.REGISTERED);
        onConnected(session);
        if (registerRequired) {
            disableOutgoing(false);
        }
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus("#regStatus", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus("#regStatus", SESSION_STATUS.FAILED);
        onDisconnected();
    }).on(SESSION_STATUS.INCOMING_CALL, function (call) {
        call.on(CALL_STATUS.RING, function () {
            setStatus("#callStatus", CALL_STATUS.RING);
        }).on(CALL_STATUS.HOLD, function () {
            $("#holdBtn").prop('disabled', false);
        }).on(CALL_STATUS.ESTABLISHED, function () {
            setStatus("#callStatus", CALL_STATUS.ESTABLISHED);
            enableMuteToggles(true);
            $("#holdBtn").prop('disabled', false);
            $('[id^=switch]').prop('disabled', false);
            if (screenSharing) {
                $('[id=switchCamBtn]').prop('disabled', true);
            }
            statIntervalId = setInterval(loadStats, 2000);
        }).on(CALL_STATUS.FINISH, function () {
            setStatus("#callStatus", CALL_STATUS.FINISH);
            currentCall = null;
            onHangupIncoming();
        }).on(CALL_STATUS.FAILED, function () {
            setStatus("#callStatus", CALL_STATUS.FAILED);
            currentCall = null;
            onHangupIncoming();
        });
        onIncomingCall(call);
    });
}

function call() {
    var session = Flashphoner.getSessions()[0];
    var constraints = getConstraints();
    var outCall = session.createCall({
        callee: $("#callee").val(),
        visibleName: $("#sipLogin").val(),
        remoteVideoDisplay: remoteVideo,
        localVideoDisplay: localVideo,
        constraints: constraints,
        sdpHook: rewriteSdp,
        stripCodecs: "SILK"
    }).on(CALL_STATUS.RING, function () {
        setStatus("#callStatus", CALL_STATUS.RING);
    }).on(CALL_STATUS.ESTABLISHED, function () {
        setStatus("#callStatus", CALL_STATUS.ESTABLISHED);
        onAnswerOutgoing();
        $("#holdBtn").prop('disabled', false);
        statIntervalId = setInterval(loadStats, 2000);
    }).on(CALL_STATUS.HOLD, function () {
        $("#holdBtn").prop('disabled', false);
    }).on(CALL_STATUS.FINISH, function () {
        setStatus("#callStatus", CALL_STATUS.FINISH);
        currentCall = null;
        onHangupOutgoing();
    }).on(CALL_STATUS.FAILED, function () {
        setStatus("#callStatus", CALL_STATUS.FAILED);
        currentCall = null;
        onHangupIncoming();
    });
    outCall.setAudioOutputId($('#speakerList').find(":selected").val());
    outCall.call();
    currentCall = outCall;

    $("#callBtn").text("Hangup").off('click').click(function () {
        $(this).prop('disabled', true);
        outCall.hangup();
    }).prop('disabled', false);
}

function onConnected(session) {
    $("#connectBtn").text("Disconnect").off('click').click(function () {
        $(this).prop('disabled', true);
        if (currentCall) {
            showOutgoing();
            disableOutgoing(true);
            setStatus("#callStatus", "");
            currentCall.hangup();
        }
        session.disconnect();
    }).prop('disabled', false);
}

function onDisconnected() {
    $("#connectBtn").text("Connect").off('click').click(connectBtnClick).prop('disabled', false);
    disableConnectionFields("formConnection", false);
    disableOutgoing(true);
    showOutgoing();
    setStatus("#callStatus", "");
}

function connectBtnClick() {
    if (validateForm("formConnection")) {
        disableConnectionFields("formConnection", true);
        $(this).prop('disabled', true);
        if (Browser.isSafariWebRTC() && Flashphoner.getMediaProviders()[0] === "WebRTC") {
            Flashphoner.playFirstVideo(localVideo, true, PRELOADER_URL).then(function () {
                Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL).then(function () {
                    connect();
                });
            });
            return;
        }
        connect();
    }
}

function onHangupOutgoing() {
    if(statIntervalId) {
        clearInterval(statIntervalId);
        statIntervalId = null;
    }
    $("#callBtn").text("Call").off('click').click(function () {
        if (filledInput($("#callee"))) {
            disableOutgoing(true);
            call();
        }
    }).prop('disabled', false);
    $('#callee').prop('disabled', false);
    $("#callFeatures").hide();
    $("#holdBtn").text("Hold");
    $('[id^=switch]').prop('disabled', true);
    $('#cameraList').prop('disabled', false);
    disableOutgoing(false);
    enableMuteToggles(false);
}

function onIncomingCall(inCall) {
    currentCall = inCall;
    var constraints = getConstraints();
    showIncoming(inCall.visibleName());

    $("#answerBtn").off('click').click(function () {
        $(this).prop('disabled', true);
        inCall.setAudioOutputId($('#speakerList').find(":selected").val());
        inCall.answer({
            localVideoDisplay: localVideo,
            remoteVideoDisplay: remoteVideo,
            constraints: constraints,
            sdpHook: rewriteSdp,
            stripCodecs: "SILK"
        });
        showAnswered();
    }).prop('disabled', false);

    $("#hangupBtn").off('click').click(function () {
        $(this).prop('disabled', true);
        $("#answerBtn").prop('disabled', true);
        inCall.hangup();
    }).prop('disabled', false);
}

function onHangupIncoming() {
    if(statIntervalId) {
        clearInterval(statIntervalId);
        statIntervalId = null;
    }
    $('[id^=switch]').prop('disabled', true);
    $('#cameraList').prop('disabled', false);
    showOutgoing();
    enableMuteToggles(false);
}

function onAnswerOutgoing() {
    enableMuteToggles(true);
    $("#callFeatures").show();
    $('[id^=switch]').prop('disabled', false);
    if (screenSharing) {
        $('[id=switchCamBtn]').prop('disabled', true);
    }
}

// Set connection and call status
function setStatus(selector, status) {
    var statusField = $(selector);
    statusField.text(status).removeClass();
    if (status == "REGISTERED" || status == "ESTABLISHED") {
        statusField.attr("class", "text-success");
    } else if (status == "DISCONNECTED" || status == "FINISH") {
        statusField.attr("class", "text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class", "text-danger");
    } else if (status == "TRYING" || status == "RING") {
        statusField.attr("class", "text-primary");
    }
}

// Display view for incoming call
function showIncoming(callerName) {
    $("#outgoingCall").hide();
    $("#incomingCall").show();
    $("#incomingCallAlert").show().text("You have a new call from " + callerName);
    $("#answerBtn").show();
}

// Display view for outgoing call
function showOutgoing() {
    $("#incomingCall").hide();
    $("#incomingCallAlert").hide();
    $("#outgoingCall").show();
    $("#callFeatures").hide();
    onHangupOutgoing();
}

function disableOutgoing(disable) {
    $('#callee').prop('disabled', disable);
    $("#callBtn").prop('disabled', disable);
}

// Display view for answered call
function showAnswered() {
    $("#answerBtn").hide();
    $("#callFeatures").show();
    $("#incomingCallAlert").hide().text("");
}

function disableConnectionFields(formId, disable) {
    $('#' + formId + ' :text').each(function () {
        $(this).prop('disabled', disable);
    });
    $('#' + formId + ' :password').prop('disabled', disable);
    $('#' + formId + ' :checkbox').prop('disabled', disable);
}

function validateForm(formId) {
    var valid = true;

    $('#' + formId + ' :text').each(function () {
        if (!filledInput($(this)) && valid) {
            valid = false;
        }
    });

    if (!filledInput($('#' + formId + ' :password')) && valid) {
        valid = false;
    }

    return valid;
}

function filledInput(input) {
    var valid = true;
    if (!input.val()) {
        valid = false;
        input.closest('.input-group').addClass("has-error");
    } else {
        input.closest('.input-group').removeClass("has-error");
    }

    return valid;
}

// Mute audio in the call
function mute() {
    if (currentCall) {
        currentCall.muteAudio();
    }
}

// Unmute audio in the call
function unmute() {
    if (currentCall) {
        currentCall.unmuteAudio();
    }
}

// Mute video in the call
function muteVideo() {
    if (currentCall) {
        currentCall.muteVideo();
    }
}

// Unmute video in the call
function unmuteVideo() {
    if (currentCall) {
        currentCall.unmuteVideo();
    }
}

function getConstraints() {
    var constraints = {
        audio: {deviceId: {exact: $('#micList').find(":selected").val()}},
        video: {
            deviceId: {exact: $('#cameraList').find(":selected").val()},
            width: parseInt($('#sendWidth').val()),
            height: parseInt($('#sendHeight').val()),
            frameRate: parseInt($('#sendFramerate').val())
        }
    };
    return constraints;
}

function enableMuteToggles(enable) {
    var $muteAudioToggle = $("#muteAudioToggle");
    var $muteVideoToggle = $("#muteVideoToggle");
    var $screenShareToogle = $('#screenSharingToggle');

    if (enable) {
        $muteAudioToggle.removeAttr("disabled");
        $muteAudioToggle.trigger('change');
        $muteVideoToggle.removeAttr("disabled");
        $muteVideoToggle.trigger('change');
        $screenShareToogle.removeAttr("disabled");
        $screenShareToogle.trigger('change');
    } else {
        $muteAudioToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
        $muteVideoToggle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
        $screenShareToogle.prop('checked', false).attr('disabled', 'disabled').trigger('change');
    }
}

function switchToScreen() {
    if (currentCall) {
        $('#cameraList').prop('disabled', true);
        $('#switchCamBtn').prop('disabled', true);
        screenSharing = true;
        currentCall.switchToScreen("screen", true).catch(function () {
            screenSharing = false;
            $("#screenSharingToggle").removeAttr("checked");
            $('#cameraList').prop('disabled', false);
            $('#switchCamBtn').prop('disabled', false);
        });
    }
}

function switchToCam() {
    if (currentCall) {
        currentCall.switchToCam();
        $('#cameraList').prop('disabled', false);
        $('#switchCamBtn').prop('disabled', false);
        screenSharing = false;
    }
}

function rewriteSdp(sdp) {
    var sdpStringFind = $("#sdpStringFind").val();
    var sdpStringReplace = $("#sdpStringReplace").val();
    if (sdpStringFind != 0 && sdpStringReplace != 0) {
        var newSDP = sdp.sdpString.toString();
        newSDP = newSDP.replace(sdpStringFind, sdpStringReplace);
        return newSDP;
    }
    return sdp.sdpString;
}