$(document).ready(function() {
    $("#callBtn").click(function () {
            var state = $("#callBtn").text();
            if (state == "Call") {
                startCall();
            } else {
                hangup();
            }
        }
    );
});

var intervalID;

function sendREST(url, data) {
        console.info("url: " + url);
        console.info("data: " + data);
        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            data: data,
            success: handleAjaxSuccess,
            error: handleAjaxError
        });
}

function handleAjaxError(jqXHR, textStatus, errorThrown) {
    $("#callStatus").text("FINISHED");
    $("#callBtn").text("Call");
    $("#callBtn").removeClass("btn-danger").addClass("btn-success");
    //if (jqXHR.responseText) {
    //    //if (isJSON(jqXHR.responseText)) {
    //    //    var response = JSON.parse(jqXHR.responseText);
    //    //} else {
    //    //
    //    //}
    //    $("#callStatus").text("FINISHED");
    //    $("#callBtn").text("Call");
    //    $("#callBtn").removeClass("btn-danger").addClass("btn-success");
    //}
    stopCheckStatus();
}


function handleAjaxSuccess(data, textStatus, jqXHR) {
    if (jqXHR.responseText) {
        if (isJSON(jqXHR.responseText)) {
            var response = JSON.parse(jqXHR.responseText);
        } else {
            $("#callStatus").text(jqXHR.responseText);
            $("#callBtn").text("Hangup");
            $("#callBtn").removeClass("btn-success").addClass("btn-danger");
        }
        sendDataToPlayer();
    }
}

function isJSON(str) {
    try {
        JSON.parse(str);
    } catch(e) {
        return false;
    };
    return true;
}

//Start a new call based on call details and connection details in the RESTCallForm and ConnectionDetailsForm
function startCall() {
    $('[name="callId"]').val(generateCallID());
    var url = document.getElementById("restUrl").value + "/call";
    var connectionDetailsFormObject = $('#ConnectionDetailsForm').serializeObject();
    var RESTCallFormObject = $('#RESTCallForm').serializeObject();
    RESTCallFormObject.connection = connectionDetailsFormObject;
    RESTCallFormObject.hasAudio = $("#hasAudio").val();
    RESTCallFormObject.hasVideo = $("#hasVideo").val();
    RESTCallFormObject.connection.sipRegisterRequired = $("#sipRegisterRequired").val();
    var data = JSON.stringify(RESTCallFormObject);
    sendREST(url, data);
    startCheckStatus();
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
    var url = $('[name=\"rtmpUrl\"]').val() + "/" + $('[name=\"rtmpStream\"]').val();
    player.setURLtoFlash(url);
}


//Get call status by callId in GetCallStatusOrHangupForm
function getStatus() {
    var url = document.getElementById("restUrl").value + "/getStatus";
    var callId = { callId: $("[name=callId]").val() };
    $("#callTrace").text($('[name="callId"]').val() + " ---> " + $('[name="rtmpUrl"]').val());
    var data = JSON.stringify(callId);
    sendREST(url, data);
}


//Send DTMF based on SendDTMFForm
function sendDTMF() {
    var url = document.getElementById("restUrl").value + "/sendDTMF";
    var SendDTMFFormObject = $('#SendDTMFForm').serializeObject();
    var data = JSON.stringify(SendDTMFFormObject);
    sendREST(url, data);
}

//Get list of established calls
function getCalls() {
    var url = document.getElementById("restUrl").value + "/getCalls";
    var data = JSON.stringify({});
    sendREST(url, data);
}

//Terminate established call with given callId from GetCallStatusOrHangupForm
function hangup() {
    var url = document.getElementById("restUrl").value + "/hangup";
    var callId = { callId: $("[name=callId]").val() };
    var data = JSON.stringify(callId);
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

function init() {
    $("#restUrl").val("http://" + window.location.hostname +":9091/RESTCall");
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