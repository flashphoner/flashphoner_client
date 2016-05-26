//Init WCS JavaScript API
var f; //= Flashphoner.getInstance();
var useNativeResolution = true;
var playOnEstablish = false;
var streamStatus;
// This element will be used for playing video (canvas or video)
var videoElement;
var mediaProvider;

////////////////////////////////////
///////////// Initialize ///////////
////////////////////////////////////

function initAPI() {
    f = Flashphoner.getInstance();
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnVideoFormatEvent, videoFormatListener);

    if (detectIE()) {
        detectFlash();
    }
    switch (($("#proto").val())) {
        case "WebRTC":
            mediaProvider = MediaProvider.WebRTC;
            initRTC();
            break;
        case "WebSocket":
            mediaProvider = MediaProvider.WSPlayer;
            initWSPlayer();
            break;
        case "RTMP":
            mediaProvider = MediaProvider.Flash;
            initRTMP();
            break;
        case "HLS":
            initHLS();
            break;
    }

}

// Init HLS
function initHLS() {
    trace("Init HLS");
    $("#videoCanvas").hide();
    $("#remoteVideo").show();
    videoElement = $("#remoteVideo");
    $(videoElement).attr('src','http://46.101.241.42:8082');
}

// Init Flash
function initRTMP() {

    trace(">>> Init RTMP");
    $("#videoCanvas").hide();
    videoElement = $("#flashVideoWrapper");

    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";
    configuration.forceFlashForWebRTCBrowser = true;
    f.init(configuration);

    document.getElementById('remoteVideo').style.visibility = "hidden";
    document.getElementById('flashVideoWrapper').style.visibility = "visible";
    document.getElementById('flashVideoDiv').style.visibility = "visible";
    f.connect({urlServer: "ws://46.101.241.42:8080", appKey: 'defaultApp'});
}

// Init WebRTC
function initRTC() {
    trace("Init WebRTC");
    $("#videoCanvas").hide();
    $("#remoteVideo").show();

    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";

    f.init(configuration);

    if (webrtcDetectedBrowser) {
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
        document.getElementById('remoteVideo').style.visibility = "visible";
        videoElement = $("#remoteVideo");
    } else {
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "visible";
        mediaProvider = MediaProvider.Flash;
        videoElement = $("#flashVideoWrapper");
    }

    trace("Connect to ws://46.101.241.42:8080");
    f.connect({urlServer: "ws://46.101.241.42:8080", appKey: 'defaultApp'});

    $("#resolutions").find('option').show();

}

// Init WebSocket
function initWSPlayer() {
    trace("Init WSPlayer");
    videoElement = $("#videoCanvas");

    $("#remoteVideo").hide();
    $("#videoCanvas").show();

    var configuration = new Configuration();
    configuration.wsPlayerCanvas = document.getElementById('videoCanvas');
    configuration.wsPlayerReceiverPath = "../../../dependencies/websocket-player/WSReceiver.js";
    f.init(configuration);

    initVisibility();
    // Hide unsupported resolutions
    $("#resolutions").find('option').not("option[value='640x360'],option[value='320x180']").hide();
    $("#resolutions option[value=320x180]").attr('selected','selected');
    f.connect({
        urlServer: "ws://46.101.241.42:8080",
        appKey: 'defaultApp',
        useWsTunnel: true,
        useBase64BinaryEncoding: false,
        width: getVideoResParam('width'),
        height: getVideoResParam('height')
    });
}

function changeTech() {
    playOnEstablish = true;
    if (streamStatus == StreamStatus.Playing)
        stopStream();
    initAPI();
}

/////////////////////////////////////////////////////
///////////////Page visibility///////////////////////
/////////////////////////////////////////////////////

var hidden = undefined;
function initVisibility() {
    var visibilityChange;
    if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
        this.hidden = "hidden";
        visibilityChange = "visibilitychange";
    } else if (typeof document.mozHidden !== "undefined") {
        this.hidden = "mozHidden";
        visibilityChange = "mozvisibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
        this.hidden = "msHidden";
        visibilityChange = "msvisibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
        this.hidden = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
    }
    if (typeof this.hidden === "undefined") {
        console.error("Visibility API not supported, player will continue to play when in background");
    } else {
        document.addEventListener(visibilityChange, visibilityHandler.bind(this), false);
    }
}

function visibilityHandler() {
    if (document[this.hidden]) {
        console.log("Document hidden, mute player");
        f.mute(MediaProvider.WSPlayer);
    } else {
        console.log("Document active, unmute player");
        f.unmute(MediaProvider.WSPlayer);
    }
}

///////////////////////////////////
///////////// Controls ////////////
///////////////////////////////////

function playFirstSound() {
    f.playFirstSound();
}

//Play stream
function playStream(width,height) {
    if ($(videoElement).attr('src')) {
        trace("Play HLS stream");
        $(videoElement).attr('src', 'http://46.101.241.42:8082/' + field("playStream") + "/" + field("playStream") + ".m3u8");
        $(videoElement).load();
    } else {
        trace("Play stream - " + field("streamName") + " , tech - " + mediaProvider);
        if (mediaProvider == MediaProvider.WSPlayer)
            playFirstSound();
        var stream = new Stream();
        stream.name = field("streamName");
        stream.hasVideo = true;
        stream.mediaProvider = mediaProvider;
        if (width != null && height != null) {
            trace("Request stream with resolution - " + width + "x" + height);
            useNativeResolution = false;
            stream.width = width;
            stream.height = height;
            f.playStream(stream);
        } else {
            f.playStream(stream);
        }
    }
}

//Stop stream playback
function stopStream() {
    var streamName = field("streamName");
    f.stopStream({name: streamName});
}

// Disconnect
function disconnect() {
    f.disconnect();
}

///////////////////////////////////
///////////// Listeners ///////////
///////////////////////////////////

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
        console.log(mediaProvider);
        if (playOnEstablish) {
            if (mediaProvider == MediaProvider.Flash) {
                trace("Wait until swf loaded");
                setTimeout(playStream, 6000);
            } else {
                playStream();
            }
        }
    }
}

//Connection Status
function streamStatusListener(event) {
    trace("streamStatusListener >> " + event.status);
    streamStatus = event.status;
}

function videoFormatListener(event) {
    if (useNativeResolution) {
        trace(">>> Set native resolution from publisher " + event.playerVideoWidth + "x" + event.playerVideoHeight);
        trace(">>> MediaProvider - " + mediaProvider);
        var marginLeft;
        var marginTop;

        if (event.playerVideoHeight > $("#player").height()) {
            $(videoElement).removeAttr('class').addClass('mp-remoteVideo');
            if (event.playerVideoWidth > $("#player").width()) {
                $(videoElement).prop('width', event.playerVideoWidth).prop('height', $("#player").height());
            } else if (event.playerVideoWidth == 800) {
                $(videoElement).prop('width', 640).prop('height', 480);
            }
        } else {
            $(videoElement).removeAttr('class').addClass('mp-remoteVideo-320x240');
            marginLeft = ($("#player").width() - event.playerVideoWidth) / 2 + 'px';
            marginTop = ($("#player").height() - event.playerVideoHeight) / 2 + 'px';
            $(videoElement).css({'margin-left' : marginLeft, 'margin-top' : marginTop});
        }


        if (event.playerVideoHeight > $("#player").height()) {
            if (mediaProvider == MediaProvider.Flash) {
                $(videoElement).css('width', event.playerVideoWidth).css('height', $("#player").height());
            } else {
                $(videoElement).prop('width', event.playerVideoWidth).prop('height', $("#player").height());
            }

        } else {
            if (mediaProvider == MediaProvider.Flash) {
                $(videoElement).css('width', event.playerVideoWidth).css('height', event.playerVideoHeight);
            } else {
                $(videoElement).prop('width', event.playerVideoWidth).prop('height', event.playerVideoHeight);
            }
        }

        if (event.playerVideoWidth > 320) {
            $(videoElement).removeAttr('class').addClass('mp-remoteVideo');
            marginLeft = ($("#player").width() - event.playerVideoWidth) / 2 + 'px';
            $(videoElement).css('margin-left', marginLeft);
        } else {
            marginTop = ($("#player").height() - event.playerVideoHeight) / 2 + 'px';
            $(videoElement).removeAttr('class').addClass('mp-remoteVideo-320x240');
            $(videoElement).css('margin-top', marginTop);
            marginLeft = ($("#player").width() - event.playerVideoWidth) / 2 + 'px';
            $(videoElement).css('margin-left', marginLeft);
        }
    }
}

//Error
function errorEvent(event) {
    trace(event.info);
}


///////////////////////////////////
///////////// Other ///////////////
///////////////////////////////////

function setVideoResDiv() {
    if (streamStatus == StreamStatus.Playing)
        stopStream();

    var res = $("#resolutions").val().split('x');
    var marginLeft, marginTop;
    var width = res[0];
    var height = res[1];
    trace("Change video resolution div , width - " + res[0] + " , height - " + res[1]);

    // 256x144, 320x180, 512x288, 640x360, 800x450
    if (width < $("#player").width() && height < $("#player").height()) {
        if (mediaProvider == MediaProvider.Flash) {
            $(videoElement).css('width', width).css('height', height);
        } else {
            $(videoElement).prop('width', width).prop('height', height);
        }
        marginLeft = ($("#player").width() - width) / 2 + 'px';
        marginTop = ($("#player").height() - height) / 2 + 'px';
        $(videoElement).css({'margin-left' : marginLeft, 'margin-top' : marginTop});

    // 1024x576, 1280x720
    } else if (height > $("#player").height()) {
        $(videoElement).css({'margin-left' : 0, 'margin-top' : 0});
        if (width > $("#player").width()) {
            if (mediaProvider == MediaProvider.Flash) {
                $(videoElement).css('width', $("#player").width()).css('height', $("#player").height());
            } else {
                $(videoElement).prop('width', $("#player").width()).prop('height', $("#player").height());
            }
        } else {
            marginLeft = ($("#player").width() - width) / 2 + 'px';
            if (mediaProvider == MediaProvider.Flash) {
                $(videoElement).css('width', width).css('height', $("#player").height());
            } else {
                $(videoElement).prop('width', width).prop('height', $("#player").height());
            }
            $(videoElement).css('margin-left', marginLeft);
        }
    }

    playStream(width,height);
}

function getVideoResParam(param) {
    var res = $("#resolutions").val().split('x');
    if (param == 'width') {
        return res[0];
    } else {
        return res[1];
    }
}

function setVolume(value) {
    console.log(mediaProvider);
    f.setVolumeOnStreaming(mediaProvider, value);
}

function getVolume() {
    var vol = f.getVolumeOnStreaming(mediaProvider);
    $("#volumeValue").text(vol);
}

