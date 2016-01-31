//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.CallStatusEvent, callStatusListener);
    f.init();
    connection();
}

var currentCall;
var connected;

function connection() {
    $("#connection").text("f.connect({urlServer: \"" + setURL() + "\", appKey: \"click2call\"});");

    $("#callee").text("call.callee = \"override_by_rest\";");
}

//New connection
function connect() {
    if (!connected){
        status("Connecting");
        if ($("#connection").val() == null) {
            console.log("Connection body is null, trying to call default connect");
            f.connect({urlServer: setURL(), appKey: "click2call"});
        } else {
            console.log("Execute code from textarea");
            eval($("#connection").val());
        }
    }else{
	    call();
    }
}

function cancel() {
    if (currentCall !== null) {
        f.hangup(currentCall);
    }

    $("#hangupBtn").hide();
    $("#callBtn").show();

    status("Cancelled, try to call again.");
}

//New call
function call() {
    var call = new Call();
    if ($("#callee").val() == null) {
        console.log("Callee body is null, set default callee");
        call.callee = "override_by_rest";
    } else {
        console.log("Set callee from textarea");
        //call.callee = $("#callee").val();
        eval($("#callee").val());
    }

    currentCall = f.call(call);
}

//Connection Status
function connectionStatusListener(event) {
    trace("connection status: "+event.status);
    if (event.status == ConnectionStatus.Established) {
	    connected = true;
        trace('Connection has been established. Calling');
        status("Calling");
        call();
    } else {
        status(event.status);
    }
}

//Registration Status
function registrationStatusListener(event) {
    trace("registrationStatusListener "+event.status);
}

//Call Status
function callStatusListener(event) {
    trace("callStatusListener >> "+event.status);

    if (event.status == CallStatus.BUSY || event.status == CallStatus.FINISH || event.status == CallStatus.FAILED) {
        $("#hangupBtn").hide();
        $("#callBtn").show();
    } else {
        $("#hangupBtn").show();
        $("#callBtn").hide();
    }
    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
    }
    status(event.status);
}

//Error
function errorEvent(event) {
    trace("error: " + event.info);

    $("#error").removeClass();
    $("#error").addClass("alert center-block text-center alert-danger");
    $("#error").text(event.info);
    setTimeout(function() {
        $("#error").removeClass();
        $("#error").addClass("hidden");
    },3000);
}
//Trace
function trace(str) {
    console.log(str);
}

//interface info
function status(str){
    document.getElementById("info").innerHTML = str;
}

//set WCS URL
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
    return url;
}
