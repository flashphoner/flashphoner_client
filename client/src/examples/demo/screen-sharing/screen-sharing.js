//Init WCS JavaScript API
var f = Flashphoner.getInstance();
var chromeScreenSharingExtensionId = "nlbaajplpmleofphigmgaifhoikjmbkg";

function init_page() {

    if(inIframe() && f.isChrome()) {
        $("#installExtensionButton").hide();
        $("#installFromMarket").show();

    } else {
        $("#installExtensionButton").show();
        $("#installFromMarket").hide();
    }

    $("#connectBtn").click(function () {
            var state = $("#connectBtn").text();
            if (state == "Connect") {
                connect();
            } else {
                disconnect();
            }
            $(this).prop('disabled',true);
        }
    );

    $("#publishBtn").prop('disabled', true).click(function () {
            var state = $("#publishBtn").text();
            if (state == "Start") {
                if (!checkForEmptyField('#screenSharingStream', '#publishForm')) { return false };
                shareScreen();
            } else {
                stopSharing();
            }
            $(this).prop('disabled',true);
        }
    );

    $("#playBtn").prop('disabled', true).click(function () {
            var state = $("#playBtn").text();
            var streamName = $("#screenSharingStream").val();
            if (state == "Start") {
                if (!checkForEmptyField('#playStream', '#playForm')) { return false };
                playStream();
            } else {
                stopStream();
            }
            $(this).prop('disabled',true);
        }
    );
}

function initAPI() {
    if (detectIE()) {
        $("#notify").modal('show');
        return false;
    }
    setURL();
    init_page();
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.localMediaElementId = 'localVideo';
    configuration.localMediaElementId2 = 'localScreen';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../dependencies/flash/MediaManager.swf";
    configuration.screenSharingVideoFps = field("fps");
    configuration.screenSharingVideoWidth = field("width");
    configuration.screenSharingVideoHeight = field("height");
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
    var installButton = (inIframe() && f.isChrome()) ? document.getElementById("installFromMarket") : document.getElementById("installExtensionButton");
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
    f.connect({urlServer:field("urlServer"), appKey:'defaultApp', width: 0, height:0});
    setCookies();
}

//Disconnect
function disconnect() {
    f.disconnect();
    $("#connectBtn").text("Connect");
}

//Play stream
function playStream() {
    var streamName = field("playStream");
    f.playStream({name: streamName});
    setCookies();
}

//Stop stream playback
function stopStream() {
    var streamName = field("playStream");
    f.stopStream({name: streamName});
}

//Publish stream
function shareScreen(){
    var streamName = field("screenSharingStream");
    f.shareScreen({name: streamName}, chromeScreenSharingExtensionId);
}

//Stop stream publishing
function stopSharing(){
    var streamName = field("screenSharingStream");
    f.unPublishStream({name:streamName});
}

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
        $("#connectBtn").text("Disconnect").prop('disabled',false);
        $("#publishBtn").prop('disabled', false);
        $("#playBtn").prop('disabled', false);
    } else {
        resetStates();
    }
    setConnectionStatus(event.status);
}

function streamStatusListener(event) {
    trace("streamStatusListener >> " + event.status);
    switch (event.status) {
        case StreamStatus.Publishing:
            setPublishStatus(event.status);
            $("#publishBtn").text("Stop").prop('disabled',false);
            $("#screenSharingStream").prop('disabled',true);
            break;
        case StreamStatus.Unpublished:
            setPublishStatus(event.status);
            $("#publishBtn").text("Start").prop('disabled',false);
            $("#screenSharingStream").prop('disabled',false);
            break;
        case StreamStatus.Playing:
            setPlaybackStatus(event.status);
            $("#playBtn").text("Stop").prop('disabled',false);
            $("#playStream").prop('disabled',true);
            break;
        case StreamStatus.Stoped:
        case StreamStatus.Paused:
            setPlaybackStatus(event.status);
            $("#playBtn").text("Start").prop('disabled',false);
            $("#playStream").prop('disabled',false);
            break;
        case StreamStatus.Failed:
            if (event.published) {
                setPublishStatus(event.status);
                $("#publishBtn").text("Start").prop('disabled',false);
                $("#screenSharingStream").prop('disabled',false);
            } else {
                setPlaybackStatus(event.status);
                $("#playBtn").text("Start").prop('disabled',false);
                $("#playStream").prop('disabled',false);
            }
            break;
        case StreamStatus.LocalStreamStopped:
            console.log("Stream " + event.name + " will be unpublished due to local media stream stop");
            setPublishStatus(event.status);
            $("#publishBtn").text("Start").prop('disabled',false);
            break;
        default:
            break;
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
        proto = "ws://";
        port = "8080";
    } else {
        proto = "wss://";
        port = "8443";
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

function installFromMarket() {
    if (f.isChrome()) {
        var url = "https://chrome.google.com/webstore/detail/flashphoner-screen-sharin/nlbaajplpmleofphigmgaifhoikjmbkg";
        window.open(url, '_blank');
        //window.focus();
    }
}

// Set Connection Status
function setConnectionStatus(status) {
    if (status == "ESTABLISHED") {
        $("#connectionStatus").text(status).removeClass().attr("class","text-success");
    }

    if (status == "DISCONNECTED") {
        $("#connectionStatus").text(status).removeClass().attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#connectionStatus").text(status).removeClass().attr("class","text-danger");
    }
}

// Set Stream Status
function setPublishStatus(status) {

    $("#publishStatus").className = '';

    if (status == "PUBLISHING") {
        $("#publishStatus").attr("class", "text-success");
    }

    if (status == "UNPUBLISHED") {
        $("#publishStatus").attr("class", "text-muted");
    }

    if (status == "FAILED") {
        $("#publishStatus").attr("class", "text-danger");
    }

    $("#publishStatus").text(status);
}

// Set Stream Status
function setPlaybackStatus(status) {
    if (status == "PLAYING") {
        $("#playStatus").text(status).removeClass().attr("class","text-success");
    }

    if (status == "STOPPED") {
        $("#playStatus").text(status).removeClass().attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#playStatus").text(status).removeClass().attr("class","text-danger");
    }
}

// Check field for empty string
function checkForEmptyField(checkField, alertDiv) {
    if (!$(checkField).val()) {
        $(alertDiv).addClass("has-error");
        return false;
    } else {
        $(alertDiv).removeClass("has-error");
        return true;
    }
}

function setCookies() {

    if (notEmpty($("#urlServer").val())) {
        f.setCookie("urlServer", $("#urlServer").val());
    }

    if (notEmpty($("#screenSharingStream").val())) {
        f.setCookie("publishStream", $("#screenSharingStream").val());
    }

    if (notEmpty($("#playStream").val())) {
        f.setCookie("playStream", $("#playStream").val());
    }
}

function getCookies() {
    if (notEmpty(f.getCookie("urlServer"))) {
        $("#urlServer").val(decodeURIComponent(f.getCookie("urlServer")));
    } else {
        $("#urlServer").val(setURL());
    }

    if (notEmpty(f.getCookie("publishStream"))) {
        $("#screenSharingStream").val(decodeURIComponent(f.getCookie("publishStream")));
    }

    if (notEmpty(f.getCookie("playStream"))) {
        $("#playStream").val(decodeURIComponent(f.getCookie("playStream")));
    }
}

function notEmpty(obj) {
    if (obj != null && obj != 'undefined' && obj != '') {
        return true;
    }
    return false;
}

// Reset button's and field's state
function resetStates() {
    $("#connectBtn").text("Connect").prop('disabled',false);
    $("#publishBtn").text("Start").prop('disabled',true);
    $("#playBtn").text("Start").prop('disabled',true);
    $("#publishStatus").text("");
    $("#playStatus").text("");
    $("#screenSharingStream").prop('disabled',false);
    $("#playStream").prop('disabled',false);
}

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}