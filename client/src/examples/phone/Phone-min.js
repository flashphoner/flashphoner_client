//Init WCS JavaScript API
var f = Flashphoner.getInstance();
f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
f.addListener(WCSEvent.CallStatusEvent, callStatusListener);
f.init({});

var currentCall;

//New connection
function connect(){
    f.connect({urlServer:'ws://188.226.144.63:8080',appKey:'defaultApp', sipLogin:'WCS1', sipPassword:'12345', sipDomain:'mysipdomain.org'});
}

function hangup(){
    f.hangup(currentCall);
}

//New call
function call(to){
    var call = new Call();
    call.callee = to;
    currentCall = f.call(call);
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.info);
    if (event.status == ConnectionStatus.Established){
        trace('Connection has been established. You can start a new call.');
    }
}

//Registration Status
function registrationStatusListener(event) {
    trace(event.info);
}

//Call Status
function callStatusListener(event) {
    trace(event.info);
    if (event.status == CallStatus.ESTABLISHED){
        trace('Call '+event.callId+' is established');
    }
}

//Error
function errorEvent(event) {
    trace(event.info);
}

//Trace
function trace(str){
    console.log(str);
}