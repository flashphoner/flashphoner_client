$(document).ready(function() {
    $("#connectBtn").click(function () {
            var state = $("#connectBtn").text();
            if (state == "Connect") {
                connect();
            } else {
                disconnect();
            }
        }
    );
    $("#callBtn").click(function () {
            var state = $("#callBtn").text();
            if (state == "Call") {
                call();
            } else {
                hangup();
            }
        }
    );

});

//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {

    setURL();
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.CallStatusEvent, callStatusListener);
    f.addListener(WCSEvent.OnCallEvent, callListener, this);
    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.localMediaElementId = 'localVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../dependencies/flash/MediaManager.swf";
    f.init(configuration);

    if (webrtcDetectedBrowser) {
        document.getElementById('remoteVideo').style.visibility = "visible";
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
    } else {
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "visible";
    }

}

var currentCall;

//New connection
function connect() {
    f.connect({urlServer: field("urlServer"), appKey: 'defaultApp', sipLogin: field("sipLogin"), sipPassword: field("sipPassword"), sipDomain: field("sipDomain"), sipPort: field("sipPort")});
}

function disconnect() {
    f.disconnect();
    $("#connectBtn").removeClass("btn-danger").addClass("btn-success");
    $("#connectBtn").text("Connect");
    document.getElementById("regStatus").value = "NOT REGISTERED";
}

function hangup() {
    f.hangup(currentCall);
}

function mute() {
    f.mute();
}

function unmute() {
    f.unmute();
}

function muteVideo() {
    f.muteVideo(currentCall.mediaProvider);
}

function unmuteVideo() {
    f.unmuteVideo(currentCall.mediaProvider);
}

function isVideoMuted() {
    trace("isVideoMuted - " + f.isVideoMuted(currentCall.mediaProvider));
}


//New call
function call() {
    var call = new Call();
    call.callee = field("callee");
    call.hasVideo = true;
    currentCall = f.call(call);
}

function answer() {
    currentCall.hasVideo = true;
    f.answer(currentCall);
}


//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
    }
}

//Registration Status
function registrationStatusListener(event) {
    if (event.status == ConnectionStatus.Registered) {
        $("#connectBtn").removeClass("btn-success").addClass("btn-danger");
        $("#connectBtn").text("Disconnect");
    }
    document.getElementById("regStatus").value = event.status;
    trace(event.status);
}

function callListener(event) {
    var call = event;
    trace("Phone - callListener " + call.callId + " call.mediaProvider: " + call.mediaProvider + " call.status: " + call.status);
    currentCall = call;
    if (call.incoming) {
        $("#incomingCall").show();
        document.getElementById("caller").value = call.caller;
        $("#outgoingCall").hide();
    }
}

//Call Status
function callStatusListener(event) {
    trace(event.status);

    var callStatus = document.getElementById("callStatus");
    callStatus.classList.remove("hidden");
    callStatus.classList.add("text-center");
    callStatus.innerHTML = event.status;

    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
        if (currentCall.incoming) {
            $("#answerBtn").hide();
        }
    }

    if (event.status == CallStatus.FINISH || event.status == CallStatus.FAILED || event.status == CallStatus.BUSY) {
        $("#incomingCall").hide();
        $("#outgoingCall").show();

        $("#callBtn").text("Call");
        $("#callBtn").removeClass("btn-danger").addClass("btn-success");

        setTimeout(function() {
            var callStatus = document.getElementById("callStatus");
            callStatus.className = "hidden";
        },3000);

    } else {
        $("#callBtn").text("Hangup");
        $("#callBtn").removeClass("btn-success").addClass("btn-danger");
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
function field(name){
    var field = document.getElementById(name).value;
    return field;
}

//Set WCS URL
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
    document.getElementById("urlServer").value = url;
}
