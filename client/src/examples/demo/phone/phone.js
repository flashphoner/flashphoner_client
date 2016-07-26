$(document).ready(function () {
    loadCallFieldSet();
});

// Include Filed Set HTML
function loadCallFieldSet(){
    $("#callFieldSet").load("call-fieldset.html",loadCallControls);
}

// Include Call Controls HTML
function loadCallControls(){
    $("#callControls").load("call-controls.html", page_init);
}

// Init connection and call button and bind functions
function page_init(){
    $("#connectBtn").click(function () {
            var state = getConnectionButtonText();
            if (state == "Connect") {
                var emptyField;
                $("form#formConnection :input").not(':input[type=button]').each(function() {
                   if (!checkForEmptyField('#'+$(this).attr('id'),'#'+$(this).attr('id')+'Form')) {
                       emptyField = true;
                   }
                });
                if (!emptyField) {
                    connect();
                    $(this).prop('disabled', true);
                }
            } else {
                disconnect();
                $(this).prop('disabled', true);
            }
        }
    );

    $("#callBtn").prop('disabled', true).click(function () {
            var state = getCallButtonText();
            if (state == "Call") {
                call();
            } else {
                hangup();
            }
            $(this).prop('disabled', true);
        }
    );

    // Set websocket URL
    setURL();

    // Set fields using cookies
    $("#sipLogin").val(f.getCookie("sipLogin"));
    $("#sipPassword").val(f.getCookie("sipPassword"));
    $("#sipDomain").val(f.getCookie("sipDomain"));
    $("#sipPort").val(f.getCookie("sipPort"));

    // Display outgoing call controls
    showOutgoing();
}

//Init WCS JavaScript API
var f = Flashphoner.getInstance();

//Current call
var currentCall;

//New connection
function connect() {

    var connection = {
        urlServer: field("urlServer"),
        appKey: 'defaultApp',
        sipLogin: field("sipLogin"),
        sipPassword: field("sipPassword"),
        sipDomain: field("sipDomain"),
        sipPort: field("sipPort"),
        sipRegisterRequired: field("sipRegisterRequired")
    };

    f.connect(connection);

    for (var key in connection) {
        f.setCookie(key, connection[key]);
    }
}

// Set connection status and display corresponding view
function setStatus(status) {
    if (status == "REGISTERED" || status == "ESTABLISHED") {
        $("#regStatus").text(status).removeClass().attr("class","text-success");
    }

    if (status == "DISCONNECTED") {
        $("#regStatus").text(status).removeClass().attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#regStatus").text(status).removeClass().attr("class","text-danger");
    }
}

// Display view for incoming call
function showIncoming(caller){
    $("#outgoingCall").hide();
    $("#incomingCall").show();
    $("#incomingCallAlert").show().text("You have a new call from "+caller);
    $("#answerBtn").show();
}

// Display view for outgoing call
function showOutgoing(){
    $("#incomingCall").hide();
    $("#incomingCallAlert").hide();
    $("#outgoingCall").show();
    if (currentCall && currentCall.hasVideo) {
        $muteAudioToggle.attr("disabled", "").removeAttr("checked");
        $muteAudioToggle.trigger('change');
        $muteVideoToggle.attr("disabled", "").removeAttr("checked");
        $muteVideoToggle.trigger('change');
    }
}

// Display view of answered call
function showAnswered(){
    $("#answerBtn").hide();
    $("#incomingCallAlert").hide().text("");
}

// Set call status and display corresponding view
function setCallStatus(status) {

    if (status == "TRYING") {
        $("#callStatus").text(status).removeClass().attr("class","text-primary");
    }

    if (status == "RING") {
        $("#callStatus").text(status).removeClass().attr("class","text-primary");
    }

    if (status == "ESTABLISHED") {
        $("#callStatus").text(status).removeClass().attr("class","text-success");
    }

    if (status == "FAILED") {
        $("#callStatus").text(status).removeClass().attr("class","text-danger");
    }

    if (status == "FINISH") {
        $("#callStatus").text(status).removeClass().attr("class","text-muted");
    }

}

// Getters and setters for call and connection button text
function setCallButtonText(text) {
    $("#callBtn").text(text).prop('disabled', false);
}

function getCallButtonText() {
    return $("#callBtn").text();
}

function getConnectionButtonText(text) {
    return $("#connectBtn").text();
}

function setConnectionButtonText(text) {
    $("#connectBtn").text(text).prop('disabled', false);
}

// Disconnect
function disconnect() {
    //if(currentCall) {
        $("#remoteVideo").removeAttr('src');
        $("#localVideo").removeAttr('src');
    //}
    f.disconnect();
    setConnectionButtonText("Connect")
    setStatus("NOT REGISTERED");
}

// New call
function call() {
    var call = new Call();
    call.callee = field("callee");
    currentCall = f.call(call);
}

// Hangup current call
function hangup() {
    f.hangup(currentCall);
}

// Mute audio in the call
function mute() {
    if (currentCall) {
        f.mute(currentCall.mediaProvider);
    }
}

// Unmute audio in the call
function unmute() {
    if (currentCall) {
        f.unmute(currentCall.mediaProvider);
    }
}

// Mute video in the call
function muteVideo() {
    if (currentCall) {
        f.muteVideo(currentCall.mediaProvider);
    }
}

// Unmute video in the call
function unmuteVideo() {
    if (currentCall) {
        f.unmuteVideo(currentCall.mediaProvider);
    }
}

//Connection Status
function connectionStatusListener(event) {
    $("#callBtn").prop('disabled', false);
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
        setConnectionButtonText("Disconnect");
    } else {
        resetStates();
    }
    setStatus(event.status);
}

//Registration Status
function registrationStatusListener(event) {
    $("#callBtn").prop('disabled', false);
    if (event.status == ConnectionStatus.Registered) {
        setConnectionButtonText("Disconnect");
    } else {
        resetStates();
    }
    setStatus(event.status);
    trace(event.status);
}

//Incoming call handler
function callListener(event) {
    var call = event;
    trace("Phone - callListener " + call.callId + " call.mediaProvider: " + call.mediaProvider + " call.status: " + call.status);
    currentCall = call;
    showIncoming(call.caller);

}

//Call Status handler
function callStatusListener(event) {
    trace(event.status);

    setCallStatus(event.status);

    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
        if (currentCall.incoming) {
            showAnswered();
        }
        var $muteAudioToggle = $("#muteAudioToggle");
        var $muteVideoToggle = $("#muteVideoToggle");
        $muteAudioToggle.removeAttr("disabled");
        $muteAudioToggle.trigger('change');
        $muteVideoToggle.removeAttr("disabled");
        $muteVideoToggle.trigger('change');
    }

    if (event.status == CallStatus.FINISH || event.status == CallStatus.FAILED || event.status == CallStatus.BUSY) {
        showOutgoing();
        setCallButtonText("Call");
    } else {
        setCallButtonText("Hangup");
    }

}

//Error
function errorEvent(event) {
    trace(event.info);
}

//Trace
function trace(str) {
    console.log(str);
}

//Get field
function field(name) {
    var field = document.getElementById(name).value;
    return field;
}

//Set WCS URL based on browser URL location string
function setURL() {
    var proto;
    var url;
    var port;
    if (window.location.protocol == "http:") {
        proto = "ws://"
        port = "8080"
    } else {
        proto = "wss://"
        port = "8443"
    }

    url = proto + window.location.hostname + ":" + port;
    $("#urlServer").val(url);
}

// Detect IE
function detectIE() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
        return true;
    }
    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
        return true;
    }
    return false;
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
        $("#notifyFlash").text("Your browser doesn't support the Flash technology necessary for work of an example");
    }
}

// Reset button's and field's state
function resetStates() {
    $("#connectBtn").text("Connect").prop('disabled',false);
    $("#callBtn").text("Call").prop('disabled',true);
    $("#callStatus").text("").removeClass();
    $("#outgoingCall").show();
    $("#incomingCall").hide();
    $("#incomingCallAlert").hide().text("");
    $("#answerBtn").hide();
    $("#muteAudioToggle").prop('checked',false).attr('disabled','disabled').trigger('change');
    $("#muteVideoToggle").prop('checked',false).attr('disabled','disabled').trigger('change');
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

function setValue(name) {
    var id = "#"+name.id;
    if ($(id).is(':checked')) {
        $(id).val('true');
    } else {
        $(id).val('false');
    }
}