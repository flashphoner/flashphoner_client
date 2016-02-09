// Init WCS JavaScript API
var f = Flashphoner.getInstance();

// Current call incoming or outgoing
var currentCall;

// Init Flashphoner API
function initAPI() {

    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.CallStatusEvent, callStatusListener);
    f.addListener(WCSEvent.OnCallEvent, callListener, this);
    f.init();

}

// New connection
function connect() {
    f.connect({urlServer: field("urlServer"), appKey: 'defaultApp', sipLogin: field("sipLogin"), sipPassword: field("sipPassword"), sipDomain: field("sipDomain"), sipPort: parseInt(field("sipPort"))});
}

// Hangup the call
function hangup() {
    f.hangup(currentCall);
}

// Mute audio during the call
function mute() {
    f.mute();
}

// Unmute audio during the call
function unmute() {
    f.unmute();
}

// New call
function call() {
    var call = new Call();
    call.callee = field("callee");
    currentCall = f.call(call);
}

// Answer the call
function answer() {
    f.answer(currentCall);
}

// Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
    }
}

// Registration Status
function registrationStatusListener(event) {
    trace(event.status);
}

// Incoming call handler
function callListener(event) {
    var call = event;
    trace("Phone - callListener " + call.callId + " call.mediaProvider: " + call.mediaProvider + " call.status: " + call.status);
    currentCall = call;
}

// Call Status
function callStatusListener(event) {
    trace(event.status);
    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
    }
}

// Error
function errorEvent(event) {
    trace(event.info);
}

// Trace
function trace(str) {
    console.log(str);
}

//Get field
function field(name){
    var field = document.getElementById(name).value;
    return field;
}