//Init WCS JavaScript API
var f = Flashphoner.getInstance();

function initAPI() {
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.OnCallEvent, onCallListener);
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
    status("Connecting");
    f.connect({appKey: 'loadtool', sipLogin: 'CALLEE'});
}

function hangup() {
    f.hangup(currentCall);
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        status("Connected");
    } else if (event.status == ConnectionStatus.Disconnected) {
        status("Disconnected");
    }
}

//Registration Status
function registrationStatusListener(event) {
    trace(event.status);
    status("Registered");
}

//Call Status
function callStatusListener(event) {
    trace(event.status);
    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
        status("Active call");
        setTimeout(function(){hangup()}, ConfigurationLoader.getInstance().hangupLT*1000);
    } else if (event.status == CallStatus.FINISH) {
        trace('Call ' + event.callId + ' is terminated');
        currentCall = null;
    }
}

function onCallListener(event) {
    currentCall = event;
    var mediaProvider = MediaProvider.Flash;
    if (f.mediaProviders.get(MediaProvider.WebRTC)) {
        mediaProvider = MediaProvider.WebRTC;
    }
    currentCall.mediaProvider = mediaProvider;
    currentCall.hasVideo = true;
    status("Answering");
    setTimeout(function(){f.answer(currentCall);}, ConfigurationLoader.getInstance().answerLT*1000);

}
//Error
function errorEvent(event) {
    trace(event.info);
    status("Error");
    currentCall = null;
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