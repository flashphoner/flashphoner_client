//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.CallStatusEvent, callStatusListener);
    ConfigurationLoader.getInstance(function (configuration) {
        trace("Configuration loaded");
        configuration.localMediaElementId = 'localMediaElement';
        configuration.remoteMediaElementId = 'remoteMediaElement';
        configuration.elementIdForSWF = "flashVideoDiv";
        configuration.pathToSWF = "../../dependencies/flash/MediaManager.swf";

        f.init(configuration);
        connect();
    });
}

var currentCall;

//New connection
function connect() {
    f.connect({appKey: 'loadtool', sipLogin: "CALLER"});
    status("Connecting");
}

function cancel() {
    if (currentCall !== null) {
        f.hangup(currentCall);
    }
    status("Cancelled, reload page for another try.");
}

//New call
function call() {
    var call = new Call();
    call.callee = "callee";
    call.hasVideo = true;
    currentCall = f.call(call);
    status("Calling");
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        status("Connected");
        if (event.sipRegisterRequired == false){
            status("Calling");
            call();
        }
    } else if (event.status == ConnectionStatus.Disconnected) {
        status("Disconnected");
    }
}

//Registration Status
function registrationStatusListener(event) {
    trace(event.status);
    status("Calling");
    call();
}

//Call Status
function callStatusListener(event) {
    trace(event.status);
    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
        status("Active call");
    } else if (event.status == CallStatus.FINISH) {
        status("Call terminated");
        setTimeout(function(){call()}, ConfigurationLoader.getInstance().callLT*1000);
    }
}

//Error
function errorEvent(event) {
    trace(event.info);
    status("Error");
}

//Trace
function trace(str) {
    console.log(str);
}

//interface info
function status(str){
    var field = document.getElementById("info");
    field.innerHTML = str;
}

