// Instance WCS JavaScript API
var f = Flashphoner.getInstance();

// Current call
var currentCall;

// Init API
function initAPI() {

    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.CallStatusEvent, callStatusListener);
    f.addListener(WCSEvent.OnCallEvent, callListener, this);
    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.localMediaElementId = 'localVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";
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

// New connection
function connect() {
    f.connect({urlServer: field("urlServer"), appKey: 'defaultApp', sipLogin: field("sipLogin"), sipPassword: field("sipPassword"), sipDomain: field("sipDomain"), sipPort: parseInt(field("sipPort"))});
}

// Hangup
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

// Mute video during the call
function muteVideo() {
    f.muteVideo(currentCall.mediaProvider);
}

// Unmute video during the call
function unmuteVideo() {
    f.unmuteVideo(currentCall.mediaProvider);
}

// Check if video is muted
function isVideoMuted() {
    trace("isVideoMuted - " + f.isVideoMuted(currentCall.mediaProvider));
}

// Release camera and microphone
function releaseCameraAndMicrophone(){
    trace("releaseCameraAndMicrophone");
    f.releaseCameraAndMicrophone(MediaProvider.WebRTC);
}


// New call
function call() {
    var call = new Call();
    call.callee = field("callee");
    call.hasVideo = true;
    currentCall = f.call(call);
}

// Answer with video
function answer() {
    currentCall.hasVideo = true;
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

// Get field
function field(name){
    var field = document.getElementById(name).value;
    return field;
}