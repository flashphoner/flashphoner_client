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

//New connection
function connect() {
    f.connect({urlServer: field("urlServer"), appKey: 'defaultApp', sipLogin: field("sipLogin"), sipPassword: field("sipPassword"), sipDomain: field("sipDomain")});
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

//New call
function call() {
    var call = new Call();
    call.callee = field("callee");
    currentCall = f.call(call);
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

//Get field
function field(name){
    var field = document.getElementById(name).value;
    return field;
}