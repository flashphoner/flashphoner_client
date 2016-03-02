//Init WCS JavaScript API
var f = Flashphoner.getInstance();
var chromeScreenSharingExtensionId = "nlbaajplpmleofphigmgaifhoikjmbkg";
function initAPI() {
    setURL();
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.localMediaElementId = 'localVideo';
    configuration.localMediaElementId2 = 'localScreen';
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

    //check that screen sharing extension installed
    var installButton = document.getElementById("installExtensionButton");
    var me = this;
    me.checkInterval = -1;
    var checkAccess = function(installed) {
        if (installed) {
            installButton.style.visibility = "hidden";
            clearInterval(me.checkInterval);
            me.checkInterval = -1;
        }
    };
    me.checkInterval = setInterval(function(){f.isScreenSharingExtensionInstalled(chromeScreenSharingExtensionId, checkAccess)}, 500);
}

//New connection
function connect(){
    f.connect({urlServer:field("urlServer"), appKey:'defaultApp'});
}

//Publish stream
function publishStream(){
    var streamName = field("streamName");
    f.publishStream({name:streamName, record:true});
}

//Stop stream publishing
function unPublishStream(){
    var streamName = field("streamName");
    f.unPublishStream({name:streamName});
}

//Play stream
function playStream(){
    var streamName = field("streamName");
    f.playStream({name:streamName});
}

//Stop stream playback
function stopStream(){
    var streamName = field("streamName");
    f.stopStream({name:streamName});
}

//Publish stream
function shareScreen(){
    var streamName = field("screenSharingStreamName");
    f.shareScreen({name: streamName}, chromeScreenSharingExtensionId);
}

//Stop stream publishing
function stopSharing(){
    var streamName = field("screenSharingStreamName");
    f.unPublishStream({name:streamName});
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established){
        trace('Connection has been established. You can start a new call.');
    }
}

//Connection Status
function streamStatusListener(event) {
    switch(event.status) {
        case StreamStatus.LocalStreamStopped:
            console.log("Stream " + event.name + " will be unpublished due to local media stream stop");
            break;
        default:
            console.log("Stream " + event.name + " status changed to " + event.status);
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

//install extension
function installExtension() {
    if (f.isChrome()) {
        chrome.webstore.install();
    } else if (f.isFF()) {
        var params = {
            "Flashphoner Screen Sharing": { URL: "../../../dependencies/screen-sharing/firefox-extension/flashphoner_screen_sharing-0.0.3-fx+an.xpi",
                IconURL: "../../../dependencies/screen-sharing/firefox-extension/icon.png",
                Hash: "sha1:e9f7df0e73ddb61b362eb63a6d7d1be2f3a5c262",
                toString: function () { return this.URL; }
            }
        };
        InstallTrigger.install(params);
    }
}
