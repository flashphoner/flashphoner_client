//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.CallStatusEvent, callStatusListener);
    f.init();    
}

var currentCall;
var connected;

//New connection
function connect() {
    if (!connected){
	f.connect({urlServer: "ws://192.168.1.5:8080", appKey: "click2call"});
	status("Connecting");
    }else{
	    call();
    }
}

function cancel() {
    if (currentCall !== null) {
        f.hangup(currentCall);
    }
    status("Cancelled, try to call again.");
}

//New call
function call() {
    var call = new Call();
    call.callee = "override_by_rest";
    currentCall = f.call(call);
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
	connected = true;
        trace('Connection has been established. Calling');
        status("Calling");
        call();
    } else if (event.status == ConnectionStatus.Disconnected) {
        status("Disconnected");
    }
}

//Registration Status
function registrationStatusListener(event) {
    trace(event.status);
}

//Call Status
function callStatusListener(event) {
    trace(event.status);
    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
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

//interface info
function status(str){
    document.getElementById("info").innerHTML = str;
}

