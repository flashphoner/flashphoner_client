$(document).ready(function () {
    init_page();
});

function init_page() {
    setURL();
    $("#callBtn").click(function () {
            var state = $("#callBtn").text();
            $(this).prop('disabled',true);
            if (state == "Call") {
                startCall();
            } else {
                hangup();
            }
        }
    );
    $("#mute").click(function() {
        if (!rtmpStreamStarted) {
            $("#music").prop('checked', false);
        }
        if ($(this).is(':checked')) {
            mute();
        } else {
            unmute();
        }
    });
    $("#music").click(function() {
        if (!rtmpStreamStarted) {
            $("#mute").prop('checked', false);
        }
        if ($(this).is(':checked')) {
            soundOn();
        } else {
            soundOff();
        }
    });
    $("#startRtmp").click(function() {
        $(this).prop('disabled', true);
        var state = $(this).text();
        if (state == "Start") {
            startRtmpStream();
        } else {
            stopRtmpStream();
        }
    }).prop('disabled', true);
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

var callStatusIntervalID;
var transponderStatusIntervalID;
var callId;
var rtmpStreamStarted = false;
var rtmpMediaSessionId;

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
//////////////////////// Handlers ////////////////////////
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
//////////////////////////////////////////////////////////

function isJSON(str) {
    try {
        JSON.parse(str);
    } catch(e) {
        return false;
    }
    return true;
}

// REST wrappers

//Start a new call based on call details and connection details in the RESTCallForm and ConnectionDetailsForm
function startCall() {
    $("#callTrace").text("");
    $("#callStatus").text("");

    var emptyField;

    $("form :input").not(':input[type=button]').each(function() {
        if (!checkForEmptyField('#'+$(this).attr('id'),'#'+$(this).attr('id')+'Form')) {
            emptyField = true;
        }
    });
    if(!checkForEmptyField('#callee','#callDiv')) {emptyField = true;}
    if (emptyField) {
        $("#callBtn").prop('disabled',false);
        return false;
    }

    var url = field("restUrl") + "/call/startup";
    callId = generateCallID();

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


//Send DTMF based on SendDTMFForm
function sendDTMF(value) {
    var url = field("restUrl") + "/call/send_dtmf";
    var data = {};
    data.callId = callId;
    data.dtmf = value;
    data.type = "RFC2833";
    data = JSON.stringify(data);
    sendREST(url, data);
}

//Get list of established calls
function getCalls() {
    var url = field("restUrl") + "/getCalls";
    var data = JSON.stringify({});
    sendREST(url, data);
}

//Terminate established call with given callId from GetCallStatusOrHangupForm
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
    callStatusIntervalID = setInterval(getStatus,3000);
}

function stopCheckCallStatus() {
    if (callStatusIntervalID != null)
        clearInterval(callStatusIntervalID);
}

function startCheckTransponderStatus() {
    transponderStatusIntervalID = setInterval(getTransponderStatus, 3000);
}

function stopCheckTransponderStatus() {
    if (transponderStatusIntervalID != null)
        clearInterval(transponderStatusIntervalID);
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