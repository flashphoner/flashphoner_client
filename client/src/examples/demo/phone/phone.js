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
                connect();
            } else {
                disconnect();
            }
        }
    );

    $("#callBtn").click(function () {
            var state = getCallButtonText();
            if (state == "Call") {
                call();
            } else {
                hangup();
            }
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
        sipPort: field("sipPort")
    };

    f.connect(connection);

    for (var key in connection) {
        f.setCookie(key, connection[key]);
    }
}

// Set connection status and display corresponding view
function setStatus(status) {

    $("#regStatus").text(status);
    $("#regStatus").className='';

    if (status == "REGISTERED") {
        $("#regStatus").attr("class","text-success");
    }

    if (status == "DISCONNECTED") {
        $("#regStatus").attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#regStatus").attr("class","text-danger");
    }
}

// Display view for incoming call
function showIncoming(caller){
    $("#outgoingCall").hide();
    $("#incomingCall").show();
    $("#incomingCallAlert").show();
    $("#incomingCallAlert").text("You have a new call from "+caller);
    $("#answerBtn").show();
}

// Display view for outgoing call
function showOutgoing(){
    $("#incomingCall").hide();
    $("#incomingCallAlert").hide();
    $("#outgoingCall").show();
}

// Display view of answered call
function showAnswered(){
    $("#answerBtn").hide();
    $("#incomingCallAlert").hide();
    $("#incomingCallAlert").text("");
}

// Set call status and display corresponding view
function setCallStatus(status) {

    $("#callStatus").text(status);
    $("#callStatus").className='';

    if (status == "TRYING") {
        $("#callStatus").attr("class","text-primary");
    }

    if (status == "RING") {
        $("#callStatus").attr("class","text-primary");
    }

    if (status == "ESTABLISHED") {
        $("#callStatus").attr("class","text-success");
    }

    if (status == "FAILED") {
        $("#callStatus").attr("class","text-danger");
    }

    if (status == "FINISH") {
        $("#callStatus").attr("class","text-muted");
    }

}

// Getters and setters for call and connection button text
function setCallButtonText(text) {
    return $("#callBtn").text(text);
}

function getCallButtonText() {
    return $("#callBtn").text();
}

function getConnectionButtonText(text) {
    return $("#connectBtn").text();
}

function setConnectionButtonText(text) {
    $("#connectBtn").text(text);
}

// Disconnect
function disconnect() {
    f.disconnect();
    setConnectionButtonText("Connect")
    setStatus("NOT REGISTERED");
}

// Hangup current call
function hangup() {
    f.hangup(currentCall);
}

// Mute audio in the call
function mute() {
    f.mute();
}

// Unmute audio in the call
function unmute() {
    f.unmute();
}

// Mute video in the call
function muteVideo() {
    f.muteVideo(currentCall.mediaProvider);
}

// Unmute video in the call
function unmuteVideo() {
    f.unmuteVideo(currentCall.mediaProvider);
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
        setConnectionButtonText("Disconnect");
    }
    setStatus(event.status);
}

//Registration Status
function registrationStatusListener(event) {
    if (event.status == ConnectionStatus.Registered) {
        setConnectionButtonText("Disconnect");
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
    }

    if (event.status == CallStatus.FINISH || event.status == CallStatus.FAILED || event.status == CallStatus.BUSY) {

        showOutgoing();
        setCallButtonText("Call")

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