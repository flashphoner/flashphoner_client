$(document).ready(function () {
    init_page();
});

var STREAM_STATUS = {
    PENDING: "PENDING",
    CONNECTED: "CONNECTED",
    PROCESSED_REMOTE: "PROCESSED_REMOTE",
    STOPPED: "STOPPED",
    FAILED: "FAILED"
};

var REST_POLLING_INTERVAL = 5000;

var streams = {};
var callStatusIntervalID;
var transponderStatusIntervalID;
var rtmpPullStatusIntervalID;
var mixerStatusIntervalID;
var callId;
var rtmpStreamStarted = false;
var rtmpMediaSessionId;
var mixerStarted = false;

function init_page() {
    setURL();
    bindClickFunctions();

    // Set fields using cookies
    $("#sipLogin").val(getCookie("sipLogin"));
    $("#sipAuthenticationName").val(getCookie("sipAuthenticationName"));
    $("#sipPassword").val(getCookie("sipPassword"));
    $("#sipDomain").val(getCookie("sipDomain"));
    $("#sipOutboundProxy").val(getCookie("sipOutboundProxy"));
    $("#sipPort").val(getCookie("sipPort"));

    resetButtonsState(true);
    $("#restStatus").hide();
}

function bindClickFunctions() {
    $("#callBtn").click(function () {
       callBtn($(this));
    });
    $("#mute").click(function() {
       muteBtn($(this));
    });
    $("#music").click(function() {
       musicBtn($(this));
    });
    $("#startRtmp").click(function() {
        startRtmpBtn($(this));
    }).prop('disabled', true);
    $("#startMixerBtn").click(function() {
        startMixerBtn($(this));
    });
    $("#formRtmpPulling button").each(function(){
        $(this).click(function() {
            pullRtmpBtn($(this));
        });
    });
    $("#formAudioMixing input:checkbox").each(function(){
        $(this).attr('disabled', true);
        $(this).click(function() {
            audioMixSwitch($(this));
        });
    });
    $("#injectStreamBtn").click(function() {
        injectStreamBtn($(this));
    });
}

// Click functions

function pullRtmpBtn(ctx) {
    var $input = $(ctx).parents().closest('.input-group').children('input');
    if(!checkForEmptyField($input,$input.parent())) {return false}

    var url = $input.val();
    var $that = $(ctx);
    $input.parents().closest('.row .row-space').children('.' + $input.attr('id')).first().text('');
    var callback = function(status) {
        if (!streams.hasOwnProperty(url)) {
            streams[url] = {};
            var onStopped = function() {
                $input.parents().closest('.row .row-space').children('.' + $input.attr('id')).first().text(
                    ((streams[url]['status'] != STREAM_STATUS.PROCESSED_REMOTE) && (streams[url]['status'] != STREAM_STATUS.STOPPED)) ? STREAM_STATUS.FAILED : STREAM_STATUS.STOPPED
                );
                $input.attr('disabled', false);
                $that.text('Pull').removeClass('btn-danger').addClass('btn-success');
                $("." + $input.attr('id')).prop('checked', false);
                delete streams[url];
            };
            streams[url]['onStopped'] = onStopped;
        }
        streams[url]['status'] = status;
        streams[url]['el'] = $input;
        $input.parents().closest('.row .row-space').children('.' + $input.attr('id')).first().text(status);
        if (status == STREAM_STATUS.PENDING) {
            $("." + $input.attr('id')).val(url);
            $input.attr('disabled', true);
            $that.text('Terminate').prop('disabled', false).removeClass('btn-success').addClass('btn-danger');
            startCheckRtmpPullStatus();
        } else {
            $input.attr('disabled', false);
            $("." + $input.attr('id')).val('');
            $that.text('Pull').prop('disabled', false).removeClass('btn-danger').addClass('btn-success');
        }
    };

    if (streams.hasOwnProperty(url)) {
        if ($(streams[url]['el']).attr('id') === $input.attr('id')) {
            if (streams[url]['status'] == STREAM_STATUS.PENDING || streams[url]['status'] == STREAM_STATUS.PROCESSED_REMOTE) {
                terminateRtmp(url, callback);
            } else {
                pullRtmp(url, callback);
            }
        } else {
            console.warn("Stream is already pulled");
            $input.parents().closest('.row .row-space').children('.' + $input.attr('id')).first().text('Already pulled!');
            return false;
        }
    } else {
        pullRtmp(url, callback);
    }
}

function callBtn(ctx) {
    var state = $("#callBtn").text();
    $(ctx).prop('disabled',true);
    if (state == "Call") {
        startCall();
    } else {
        hangup();
    }
}

function muteBtn(ctx) {
    if (!rtmpStreamStarted) {
        $("#music").prop('checked', false);
    }
    if ($(ctx).is(':checked')) {
        mute();
    } else {
        unmute();
    }
}

function musicBtn(ctx) {
    if (!rtmpStreamStarted) {
        $("#mute").prop('checked', false);
    }
    if ($(ctx).is(':checked')) {
        soundOn();
    } else {
        soundOff();
    }
}

function startRtmpBtn(ctx) {
    $(ctx).prop('disabled', true);
    var state = $(ctx).text();
    if (state == "Start") {
        startRtmpStream();
    } else {
        stopRtmpStream();
    }
}

function startMixerBtn(ctx) {
    var mixerStream = $("#mixerStream").val();
    if (!mixerStream) {
        $("#mixerStream").parent().addClass('has-error');
        return false;
    } else {
        $("#mixerStream").parent().removeClass('has-error');
    }
    var $that = $(ctx);
    var onStopped = function() {
        mixerStarted = false;
        stopCheckMixerStatus();
        $("#formAudioMixing input:checkbox").each(function(){
            $(this).prop('checked', false).attr('disabled', true);
        });
        $that.text('Start mixer').removeClass('btn-danger').addClass('btn-success');
        $that.parents().closest('.input-group').children('input').attr('disabled', false);
        $(".mixerStatus").text('');
        $("#formSIPStreamInject :input").each(function() {
            $(this).prop('disabled',false);
            if ($(this).is(':button')) {
                $(this).removeClass("btn-danger").addClass("btn-success");
            }
        });
    };
    var onStarted = function() {
        startCheckMixerStatus(onStopped);
        mixerStarted = true;
        $("#formAudioMixing input:checkbox").each(function(){
            $(this).attr('disabled', false);
        });
        $that.text('Stop mixer').removeClass('btn-success').addClass('btn-danger');
        $that.parents().closest('.input-group').children('input').attr('disabled', true);
    };
    if (!mixerStarted) {
        startMixer(mixerStream).then(
            onStarted, onStopped
        );
    } else {
        mixerStarted = false;
        stopMixer(mixerStream).then(
            onStopped, onStopped
        );
    }
}

function audioMixSwitch(ctx) {
    if(!checkForEmptyField('#mixerStream',$("#mixerStream").parent())) {return false}

    var mixerStream = $("#mixerStream").val();
    var stream = $(ctx).val();
    if (stream == 'on') {
        $(ctx).attr('checked', false);
        return false;
    } else if (streams.hasOwnProperty(stream)) {
        if (streams[stream]['status'] != STREAM_STATUS.PROCESSED_REMOTE) {
            $(ctx).attr('checked', false);
            return false;
        }
    }
    console.log("mixer " + mixerStream + " ; stream " + stream);
    if ($(ctx).is(':checked')) {
        // Add stream to mixer
        send(field("restUrl") + "/mixer/add", {
            uri: "mixer://" + mixerStream,
            localStreamName: mixerStream,
            remoteStreamName: stream
        }).then(function(){
            console.log("added");
        });
    } else {
        // Remove stream from mixer
        send(field("restUrl") + "/mixer/remove", {
            uri: "mixer://"  + mixerStream,
            localStreamName: mixerStream,
            remoteStreamName: stream
        }).then(function(){
            console.log("removed");
        });
    }
}

function injectStreamBtn(ctx) {
    var streamName = $("#injectStream").val();
    if (!streamName) {
        $("#injectStream").parent().addClass('has-error');
        return false;
    }
    var $that = $(ctx);
    send(field("restUrl") + "/call/inject_stream", {
        callId: $("#sipCallId").val(),
        streamName: streamName
    }).then(function(){
        $that.removeClass('btn-success').addClass('btn-danger');
        $that.parents().closest('.input-group').children('input').attr('disabled', true);
    }).catch(function() {
        $that.removeClass('btn-danger').addClass('btn-success');
        $that.parents().closest('.input-group').children('input').attr('disabled', false);
    });
}

// API method wrappers

var pullRtmp = function(uri, fn) {
    console.log("Pull rtmp " + uri);
    send(field("restUrl") + "/pull/rtmp/pull", {
        uri: uri
    }).then(
        fn(STREAM_STATUS.PENDING)
    ).catch(function(e){
        console.error(e);
        fn(STREAM_STATUS.FAILED);
    });
};

var terminateRtmp = function(uri, fn) {
    console.log("Terminate rtmp " + uri);
    send(field("restUrl") + "/pull/rtmp/terminate", {
        uri: uri
    }).then(
        fn(STREAM_STATUS.STOPPED)
    ).catch(function(e) {
        fn(STREAM_STATUS.FAILED);
        console.error(e);
    })
};

var startMixer = function(streamName) {
    console.log("Start mixer " + streamName);
    return send(field("restUrl") + "/mixer/startup", {
        uri: "mixer://" + streamName,
        localStreamName: streamName
    });
};

var stopMixer = function(streamName, fn) {
    console.log("Stop mixer " + streamName);
    return send(field("restUrl") + "/mixer/terminate", {
        uri: "mixer://" + streamName,
        localStreamName: streamName
    });
};

function startCall() {
    $("#callTrace").text("");
    $("#callStatus").text("");

    var emptyField;

    $("#sipForm :input").not(':input[type=button]').each(function() {
        if (!checkForEmptyField('#'+$(this).attr('id'),'#'+$(this).attr('id')+'Form')) {
            emptyField = true;
        }
    });
    if(!checkForEmptyField('#callee','#callDiv')) {emptyField = true;}
    if(!checkForEmptyField('#rtmpStream','#rtmpStreamForm')) {emptyField = true;}
    if (emptyField) {
        $("#callBtn").prop('disabled',false);
        return false;
    }

    var url = field("restUrl") + "/call/startup";
    callId = generateCallID();
    $("#sipCallId").val(callId);

    var connection = {};
    connection.sipLogin = field("sipLogin");
    connection.sipAuthenticationName = field("sipAuthenticationName");
    connection.sipPassword = field("sipPassword");
    connection.sipPort = field("sipPort");
    connection.sipDomain = field("sipDomain");
    connection.sipOutboundProxy = field("sipOutboundProxy");
    connection.appKey = field("appKey");
    connection.sipRegisterRequired = field("sipRegisterRequired");

    for (var key in connection) {
        setCookie(key, connection[key]);
    }

    var RESTCall = {};
    RESTCall.toStream = field("rtmpStream");
    RESTCall.hasAudio = field("hasAudio");
    RESTCall.hasVideo = field("hasVideo");
    RESTCall.callId = callId;
    RESTCall.sipLogin = field("sipLogin");
    RESTCall.sipAuthenticationName = field("sipAuthenticationName");
    RESTCall.sipPassword = field("sipPassword");
    RESTCall.sipPort = field("sipPort");
    RESTCall.sipDomain = field("sipDomain");
    RESTCall.sipOutboundProxy = field("sipOutboundProxy");
    RESTCall.appKey = field("appKey");
    RESTCall.sipRegisterRequired = field("sipRegisterRequired");

    for (var key in RESTCall) {
        setCookie(key, RESTCall[key]);
    }

    RESTCall.callee = field("callee");

    var data = JSON.stringify(RESTCall);

    sendREST(url, data);
    startCheckCallStatus();

}

function mute() {
    if (rtmpStreamStarted) {
        $("#mute").prop('disabled', true);
        var RESTObj = {};
        RESTObj.mediaSessionId = rtmpMediaSessionId;
        var url = field("restUrl") + "/push/mute";
        sendREST(url, JSON.stringify(RESTObj), muteSuccessHandler, muteErrorHandler);
    }
}

function unmute() {
    if (rtmpStreamStarted) {
        $("#mute").prop('disabled', true);
        var RESTObj = {};
        RESTObj.mediaSessionId = rtmpMediaSessionId;
        var url = field("restUrl") + "/push/unmute";
        sendREST(url, JSON.stringify(RESTObj), muteSuccessHandler, muteErrorHandler);
    }
}

function soundOn() {
    if (rtmpStreamStarted) {
        $("#music").prop('disabled', true);
        var RESTObj = {};
        RESTObj.mediaSessionId = rtmpMediaSessionId;
        RESTObj.soundFile = "sample.wav";
        RESTObj.loop = false;
        var url = field("restUrl") + "/push/sound_on";
        sendREST(url, JSON.stringify(RESTObj), injectSoundSuccessHandler, injectSoundErrorHandler);
    }
}

function soundOff() {
    if (rtmpStreamStarted) {
        $("#music").prop('disabled', true);
        var RESTObj = {};
        RESTObj.mediaSessionId = rtmpMediaSessionId;
        var url = field("restUrl") + "/push/sound_off";
        sendREST(url, JSON.stringify(RESTObj), injectSoundSuccessHandler, injectSoundErrorHandler);
    }
}

function sendDTMF(value) {
    var url = field("restUrl") + "/call/send_dtmf";
    var data = {};
    data.callId = callId;
    data.dtmf = value;
    data.type = "RFC2833";
    data = JSON.stringify(data);
    sendREST(url, data);
}

function hangup() {
    var url = field("restUrl") + "/call/terminate";
    var currentCallId = { callId: callId };
    var data = JSON.stringify(currentCallId);
    sendREST(url, data);
}

function startRtmpStream() {
    if (!rtmpStreamStarted) {
        rtmpStreamStarted = true;
        var url = field("restUrl") + "/push/startup";
        var RESTObj = {};
        var options = {};
        if ($("#mute").is(':checked')) {
            options.action = "mute";
        } else if ($("#music").is(':checked')) {
            options.action = "sound_on";
            options.soundFile = "sample.wav";
        }
        RESTObj.streamName = field("rtmpStream");
        RESTObj.rtmpUrl = field("rtmpUrl");
        RESTObj.options = options;
        console.log("Start rtmp");
        sendREST(url, JSON.stringify(RESTObj), startupRtmpSuccessHandler, startupRtmpErrorHandler);
        sendDataToPlayer();
        startCheckTransponderStatus();
    }
}

function stopRtmpStream() {
    if (rtmpStreamStarted) {
        rtmpStreamStarted = false;
        var url = field("restUrl") + "/push/terminate";
        var RESTObj = {};
        RESTObj.mediaSessionId = rtmpMediaSessionId;
        sendREST(url, JSON.stringify(RESTObj), stopRtmpSuccessHandler, stopRtmpErrorHandler);
    }
}

////////////// Checkers /////////////////

function startCheckCallStatus() {
    callStatusIntervalID = setInterval(getStatus, REST_POLLING_INTERVAL);
}

function stopCheckCallStatus() {
    if (callStatusIntervalID != null)
        clearInterval(callStatusIntervalID);
    callStatusIntervalID = null;
    $("#formSIPStreamInject :input").each(function() {
        $(this).prop('disabled', false);
        if ($(this).is(':button')) {
            $(this).removeClass("btn-danger").addClass("btn-success");
        }
    });
}

function startCheckTransponderStatus() {
    transponderStatusIntervalID = setInterval(getTransponderStatus, REST_POLLING_INTERVAL);
}

function stopCheckTransponderStatus() {
    if (transponderStatusIntervalID != null)
        clearInterval(transponderStatusIntervalID);
    transponderStatusIntervalID = null;
}

function startCheckRtmpPullStatus() {
    if (!rtmpPullStatusIntervalID) {
        rtmpPullStatusIntervalID = setInterval(getRtmpPullStatus, REST_POLLING_INTERVAL);
    }
}

function stopCheckRtmpPullStatus() {
    if (rtmpPullStatusIntervalID != null) {
        clearInterval(rtmpPullStatusIntervalID);
        rtmpPullStatusIntervalID = null;
        for (var prop in streams) {
            if (streams.hasOwnProperty(prop)) {
                streams[prop]['onStopped']();
                delete streams[prop];
            }
        }
    }
}

function startCheckMixerStatus(callback) {
    if (!mixerStatusIntervalID) {
        console.log("start mixer status");
        mixerStatusIntervalID = setInterval(function(){getMixerStatus(callback)}, REST_POLLING_INTERVAL);
    }
}

function stopCheckMixerStatus() {
    if (mixerStatusIntervalID != null) {
        console.log("stop mixer status");
        clearInterval(mixerStatusIntervalID);
        mixerStatusIntervalID = null;
    }
}

/////////////////////////////////////////

$.fn.serializeObject = function()
{
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

function isJSON(str) {
    try {
        JSON.parse(str);
    } catch(e) {
        return false;
    }
    return true;
}

function setURL() {
    if (window.location.protocol == "http:") {
        $("#restUrl").val("http://" + window.location.hostname + ":8081/rest-api");
    } else {
        $("#restUrl").val("https://" + window.location.hostname + ":8444/rest-api");
    }
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function generateCallID (){
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    var part1 = "";
    var part2 = "";
    var part3 = "";
    var part4 = "";

    for( var i=0; i < getRandomInt(6,10); i++ )
        part1 += possible.charAt(Math.floor(Math.random() * possible.length));

    for( var i=0; i < getRandomInt(6,10); i++ )
        part2 += possible.charAt(Math.floor(Math.random() * possible.length));

    for( var i=0; i < getRandomInt(6,10); i++ )
        part3 += possible.charAt(Math.floor(Math.random() * possible.length));

    for( var i=0; i < getRandomInt(6,10); i++ )
        part4 += possible.charAt(Math.floor(Math.random() * possible.length));

    var callid = part1 + "-" + part2 + "-" + part3 + "-" + part4;
    return callid;
}

function setValue(name) {
    var id = "#"+name.id;
    if ($(id).is(':checked')) {
        $(id).val('true');
    } else {
        $(id).val('false');
    }
}

//Get field
function field(name) {
    var field = document.getElementById(name).value;
    return field;
}

function setCookie(c_name, value) {
    var exdate = new Date();
    exdate.setDate(exdate.getDate() + 100);
    var c_value = encodeURI(value) + "; expires=" + exdate.toUTCString();
    document.cookie = c_name + "=" + c_value;
    return value;
}

function getCookie (c_name) {
    var i, x, y, ARRcookies = document.cookie.split(";");
    for (i = 0; i < ARRcookies.length; i++) {
        x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
        x = x.replace(/^\s+|\s+$/g, "");
        if (x == c_name) {
            return ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
        }
    }
    return "";
}

// Set call status and display corresponding view
function setCallStatus(status) {

    if (status == "ESTABLISHED") {
        $("#callStatus").removeClass().attr("class","text-success");
        resetButtonsState(false);
        $("#rtmpStream").prop('disabled', true);
    }

    if (status == "FINISHED") {
        $("#callStatus").removeClass().attr("class","text-muted");
        resetButtonsState(true);
        resetElementsState();
        rtmpStreamStarted = false;
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

function resetButtonsState(state) {
    $("#startRtmp").prop('disabled', state);
    $("#dtmfBtn").prop('disabled', state);
}

function resetElementsState() {
    $("#mute").prop('checked', false);
    $("#music").prop('checked', false);
    $("#startRtmp").text("Start");
    $("#rtmpStream").prop('disabled', false);
    $("#rtmpUrl").prop('disabled', false);
}

/** XHR WRAPPER **/
var send = function(uri, data, responseIsText) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        if (data) {
            xhr.open('POST', uri, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        } else {
            xhr.open('GET', uri, true);
        }
        xhr.responseType = 'text';
        xhr.onload = function (e) {
            if (this.status == 200) {
                if (this.response) {
                    if (!responseIsText) {
                        resolve(JSON.parse(this.response));
                    } else {
                        resolve(this.response);
                    }
                } else {
                    resolve();
                }
            } else {
                reject(this);
            }
        };
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4){
                if(xhr.status === 200){
                    //success
                } else {
                    reject();
                }
            }
        };
        if (data) {
            xhr.send(JSON.stringify(data));
        } else {
            xhr.send();
        }
    });
};

function sendREST(url, data, successHandler, errorHandler) {
    console.info("url: " + url);
    console.info("data: " + data);
    $.ajax({
        url: url,
        beforeSend: function ( xhr ) {
            xhr.overrideMimeType( "text/plain;" );
        },
        type: 'POST',
        contentType: 'application/json',
        data: data,
        success: (successHandler === undefined) ? handleAjaxSuccess : successHandler,
        error: (errorHandler === undefined) ? handleAjaxError : errorHandler
    });
}

// Handlers

function handleAjaxError(jqXHR, textStatus, errorThrown) {
    console.log("Error: ", jqXHR);
    $("#callStatus").text("FINISHED");
    $("#callBtn").text("Call").removeClass("btn-danger").addClass("btn-success").prop('disabled',false);
    resetButtonsState(true);
    resetElementsState();
    setCallStatus("FINISHED");
    stopCheckCallStatus();
}

function handleAjaxSuccess(data, textStatus, jqXHR) {
    if (jqXHR.responseText) {
        if (isJSON(jqXHR.responseText)) {
            var response = JSON.parse(jqXHR.responseText);
            if (response[0].status) {
                $("#callStatus").text(response[0].status);
                $("#callBtn").text("Hangup").removeClass("btn-success").addClass("btn-danger").prop('disabled', false);
                resetButtonsState(false);
                setCallStatus(response[0].status);
            }
        } else {
            $("#callStatus").text(jqXHR.responseText);
            $("#callBtn").text("Hangup").removeClass("btn-success").addClass("btn-danger").prop('disabled',false);
            resetButtonsState(false);
            setCallStatus(jqXHR.responseText);
        }
    }
}

function startupRtmpSuccessHandler(data, textStatus, jqXHR) {
    if (jqXHR.responseText) {
        if (isJSON(jqXHR.responseText)) {
            var response = JSON.parse(jqXHR.responseText);
            console.log(response);
            if (response.mediaSessionId) {
                rtmpMediaSessionId = response.mediaSessionId;
            }
            $("#startRtmp").text("Stop").prop('disabled', false);
            $("#rtmpUrl").prop('disabled', true);
        }
    }
}

function startupRtmpErrorHandler(jqXHR, textStatus, errorThrown) {
    console.log("Error: ", jqXHR);
    rtmpStreamStarted = false;
    $("#startRtmp").prop('disabled', false);
    $("#rtmpUrl").prop('disabled', false);
    stopCheckTransponderStatus();
}

function stopRtmpSuccessHandler(data, textStatus, jqXHR) {
    $("#startRtmp").text("Start").prop('disabled', false);
    $("#rtmpUrl").prop('disabled', false);
    $("#mute").prop('checked', false);
    $("#music").prop('checked', false);
}

function transponderStatusSuccessHandler(data, textStatus, jqXHR) {

}

function transponderStatusErrorHandler(jqXHR, textStatus, errorThrown) {
    console.log("Error: ", jqXHR);
    rtmpStreamStarted = false;
    $("#startRtmp").text("Start").prop('disabled', false);
    $("#rtmpUrl").prop('disabled', false);
    $("#mute").prop('checked', false);
    $("#music").prop('checked', false);
    stopCheckTransponderStatus();
}

function stopRtmpErrorHandler(jqXHR, textStatus, errorThrown) {
    console.log("Error: ", jqXHR);
    $("#startRtmp").text("Start").prop('disabled', false);
    $("#rtmpUrl").prop('disabled', false);
    $("#mute").prop('checked', false);
    $("#music").prop('checked', false);
}

function injectSoundSuccessHandler(data, textStatus, jqXHR) {
    $("#music").prop('disabled', false);
}

function injectSoundErrorHandler(jqXHR, textStatus, errorThrown) {
    $("#music").prop('disabled', false);
    console.log("Error on inject sound ", jqXHR.responseText);
    $("#restStatus").show().text("Error on inject sound");
}

function muteSuccessHandler(data, textStatus, jqXHR) {
    $("#mute").prop('disabled', false);
}

function muteErrorHandler(jqXHR, textStatus, errorThrown) {
    console.log("Error on mute ", jqXHR.responseText);
    $("#mute").prop('disabled', false);
    $("#restStatus").show().text("Error on mute/unmute");
}

// Show RTMP URL to play in a third party player (VLC, ffplay etc)
function sendDataToPlayer() {
    var host = field("rtmpUrl")
        .replace("localhost", window.location.hostname)
        .replace("127.0.0.1", window.location.hostname);

    var rtmpStreamPrefix = "rtmp_";
    var url = host + "/" + rtmpStreamPrefix + field("rtmpStream");
    $("#player").text(url);
}

//Get transponder status
function getTransponderStatus() {
    var url = field("restUrl") + "/push/find";
    var RESTObj = {};
    // By default transponder's stream name will contain prefix "rtmp_"
    RESTObj.streamName = "rtmp_" + field("rtmpStream");
    RESTObj.rtmpUrl = field("rtmpUrl");
    sendREST(url, JSON.stringify(RESTObj), transponderStatusSuccessHandler, transponderStatusErrorHandler);
}

//Get call status by callId in GetCallStatusOrHangupForm
function getStatus() {
    var url = field("restUrl") + "/call/find";
    currentCallId = { callId: callId };
    $("#callTrace").text(callId + " >>> " + field("rtmpUrl"));
    var data = JSON.stringify(currentCallId);
    sendREST(url, data);
}

function getRtmpPullStatus() {
    send(field("restUrl") + "/pull/rtmp/find_all").then(function(data){
        if (data.length == 0) {
            stopCheckRtmpPullStatus();
            return false;
        }
        var _streams = [];
        for (var i = 0; i < data.length; i++) {
            var stream = data[i];
            _streams.push(data[i]['uri']);
            if (streams.hasOwnProperty(stream['uri'])) {
                streams[stream['uri']]['status'] = stream['status'];
                var $input = streams[stream['uri']]['el'];
                    $input.parents().closest('.row .row-space').children('.' + $input.attr('id')).first().text(stream['status']);
            }
        }
        for (var prop in streams) {
            if (streams.hasOwnProperty(prop)) {
                if (!_streams.includes(prop)) {
                    console.log(prop + " probably failed or stopped");
                    streams[prop]['onStopped']();
                }
            }
        }

    }).catch(function(e) {
        stopCheckRtmpPullStatus();
        console.error(e);
    });
}

function getMixerStatus(callback) {
    send(field("restUrl") + "/mixer/find_all").then(function(data){
        if (data.length == 0) {
            callback();
            return;
        }
        for (var i = 0; i < data.length; i++) {
            var stream = data[i];
            if ($("#mixerStream").val() == stream['localStreamName']) {
                $(".mixerStatus").text(stream['status']);
                return;
            }
        }
        //not found
        callback();
    }).catch(function(e){
        callback();
        console.error(e);
    })
}