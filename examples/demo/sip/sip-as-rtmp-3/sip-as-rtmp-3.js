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
    // Set fields using cookies
    $("#sipLogin").val(getCookie("sipLogin"));
    $("#sipAuthenticationName").val(getCookie("sipAuthenticationName"));
    $("#sipPassword").val(getCookie("sipPassword"));
    $("#sipDomain").val(getCookie("sipDomain"));
    $("#sipOutboundProxy").val(getCookie("sipOutboundProxy"));
    $("#sipPort").val(getCookie("sipPort"));
    $("#rtmpUrl").val(getCookie("rtmpUrl"));
    $("#rtmpStream").val(getCookie("rtmpStream"));

    $("#dtmfBtn").prop('disabled',true);
}

var intervalID;
var callId;

function sendREST(url, data) {
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
        success: handleAjaxSuccess,
        error: handleAjaxError
    });
}

function handleAjaxError(jqXHR, textStatus, errorThrown) {
    console.log("Error: ", jqXHR);
    $("#callStatus").text("FINISHED");
    $("#callBtn").text("Call").removeClass("btn-danger").addClass("btn-success").prop('disabled',false);
    $("#dtmfBtn").prop('disabled',true);
    setCallStatus("FINISHED");
    stopCheckStatus();
}


function handleAjaxSuccess(data, textStatus, jqXHR) {
    if (jqXHR.responseText) {
        if (isJSON(jqXHR.responseText)) {
            var response = JSON.parse(jqXHR.responseText);
            if (response[0].status) {
                $("#callStatus").text(response[0].status);
                $("#callBtn").text("Hangup").removeClass("btn-success").addClass("btn-danger").prop('disabled', false);
                //resetButtonsState(false);
                setCallStatus(response[0].status);
            }
        } else {
            $("#callStatus").text(jqXHR.responseText);
            $("#callBtn").text("Hangup").removeClass("btn-success").addClass("btn-danger").prop('disabled',false);
            //resetButtonsState(false);
            setCallStatus(jqXHR.responseText);
        }
    }
}

function isJSON(str) {
    try {
        JSON.parse(str);
    } catch(e) {
        return false;
    }
    return true;
}

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

    var RESTCall = {};
    RESTCall.rtmpStream = field("rtmpStream");
    RESTCall.rtmpUrl = field("rtmpUrl");
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
    RESTCall.callee = field("callee");

    for (var key in RESTCall) {
        setCookie(key, RESTCall[key]);
    }

    var data = JSON.stringify(RESTCall);

    sendREST(url, data);
    startCheckStatus();
    sendDataToPlayer();
}

function startCheckStatus() {
    intervalID = setInterval(getStatus,3000);
}

function stopCheckStatus() {
    if (intervalID != null)
        clearInterval(intervalID);
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

//Terminate established call with given callId from GetCallStatusOrHangupForm
function hangup() {
    var url = field("restUrl") + "/call/terminate";
    var currentCallId = { callId: callId };
    var data = JSON.stringify(currentCallId);
    sendREST(url, data);
}

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
    //console.log(document.cookie);
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
        $("#callStatus").removeClass().attr("class", "text-success");
        $("#dtmfBtn").prop('disabled', false);
    }

    if (status == "FINISHED") {
        $("#callStatus").removeClass().attr("class", "text-muted");
        $("#dtmfBtn").prop('disabled', true);
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