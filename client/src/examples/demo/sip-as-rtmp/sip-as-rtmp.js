$(document).ready(function () {
    init_page();
});

function init_page() {
    setURL();
    loadPlayer();
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
    $("#sipPassword").val(getCookie("sipPassword"));
    $("#sipDomain").val(getCookie("sipDomain"));
    $("#sipPort").val(getCookie("sipPort"));
    $("#rtmpUrl").val(getCookie("rtmpUrl"));
    $("#rtmpStream").val(getCookie("rtmpStream"));

    $("#dtmfBtn").prop('disabled',true);
}

function loadPlayer() {
    detectFlash();
    var attributes = {};
    attributes.id = "player";
    attributes.name = "player";
    attributes.styleclass="center-block";
    var flashvars = {};
    var pathToSWF = "../../../dependencies/swf/player.swf";
    var elementId = "player";
    var params = {};
    params.menu = "true";
    params.swliveconnect = "true";
    params.allowfullscreen = "true";
    params.allowscriptaccess = "always";
    params.bgcolor = "#777777";
    swfobject.embedSWF(pathToSWF, elementId, "350", "400", "11.2.202", "expressInstall.swf", flashvars, params, attributes);
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
    $("#callStatus").text("FINISHED");
    $("#callBtn").text("Call").removeClass("btn-danger").addClass("btn-success").prop('disabled',false);
    $("#dtmfBtn").prop('disabled',true);
    setCallStatus("FINISHED");
    stopCheckStatus();
}


function handleAjaxSuccess(data, textStatus, jqXHR) {
    jqXHR.statusCode();
    if (jqXHR.responseText) {
        if (isJSON(jqXHR.responseText)) {
            var response = JSON.parse(jqXHR.responseText);
        } else {
            $("#callStatus").text(jqXHR.responseText);
            $("#callBtn").text("Hangup").removeClass("btn-success").addClass("btn-danger").prop('disabled',false);
            $("#dtmfBtn").prop('disabled',false);
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

    var url = field("restUrl") + "/call";
    callId = generateCallID();

    var connection = {};
    connection.sipLogin = field("sipLogin");
    connection.sipPassword = field("sipPassword");
    connection.sipPort = field("sipPort");
    connection.sipDomain = field("sipDomain");
    connection.appKey = field("appKey");
    connection.sipRegisterRequired = field("sipRegisterRequired");

    for (var key in connection) {
        setCookie(key, connection[key]);
    }

    var RESTCall = {};
    RESTCall.rtmpStream = field("rtmpStream");
    RESTCall.hasAudio = field("hasAudio");
    RESTCall.hasVideo = field("hasVideo");
    RESTCall.callId = callId;
    RESTCall.rtmpUrl = field("rtmpUrl");

    for (var key in RESTCall) {
        setCookie(key, RESTCall[key]);
    }

    RESTCall.connection = connection;
    RESTCall.callee = field("callee");

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

//Call embedded AS3 function (setURLtoFlash)
function sendDataToPlayer() {
    var player = document.getElementById("player");
    var host = field("rtmpUrl")
        .replace("localhost", window.location.hostname)
        .replace("127.0.0.1", window.location.hostname);

    var url = host + "/" + field("rtmpStream");
    player.setURLtoFlash(url);
}


//Get call status by callId in GetCallStatusOrHangupForm
function getStatus() {
    var url = field("restUrl") + "/getStatus";
    var currentCallId = { callId: callId };
    $("#callTrace").text(callId + " >>> " + field("rtmpUrl"));
    var data = JSON.stringify(currentCallId);
    sendREST(url, data);
}


//Send DTMF based on SendDTMFForm
function sendDTMF(value) {
    var url = field("restUrl") + "/sendDTMF";
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
    var url = field("restUrl") + "/hangup";
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
        $("#restUrl").val("http://" + window.location.hostname + ":9091/RESTCall");
    } else {
        $("#restUrl").val("https://" + window.location.hostname + ":8888/RESTCall");
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
        $("#callStatus").removeClass().attr("class","text-success");
    }

    if (status == "FINISHED") {
        $("#callStatus").removeClass().attr("class","text-muted");
    }

}

// Detect Flash
function detectFlash() {
    var hasFlash = false;
    try {
        var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
        if (fo) {
            hasFlash = true;
        }
    } catch (e) {
        if (navigator.mimeTypes
            && navigator.mimeTypes['application/x-shockwave-flash'] != undefined
            && navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin) {
            hasFlash = true;
        }
    }
    if (!hasFlash) {
        $("#player").text("Your browser doesn't support the Flash technology necessary for work of an example").css("font-weight", "bold").css("font-size","200%");
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