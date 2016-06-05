//Init WCS JavaScript API
var f ;//= Flashphoner.getInstance();
var timerTimeout;
var useNativeResolution = true;
var streamStatus;
// This element will be used for playing video (canvas or video)
var videoElement;
var mediaProvider;
var replay = false;
var reinit = false;

////////////////////////////////////
///////////// Initialize ///////////
////////////////////////////////////

$(document).ready(function () {
    loadFooter();
});

function loadFooter() {
    $("#footer").load("footer.html",init_page);
}

// Init elements
function init_page() {
    //setVideoResDiv();

    trace("Detected browser: " + detectBrowser());

    hideProto();

    $("#playStream").keyup(function() {
        $("#playButton").prop('disabled',!$("#playStream").val());
    }).focus();

    // Hide some elements
    //$("#fps").hide();
    $("#footer").hide();
    $("#waiting").hide();

    // Set clickers
    $("#menuButton").click(function() {
       if ($("#proto").is(":visible")) {
           $("#proto").hide();
       } else {
           $("#proto").show();
       }
       if ($("#resolutions").is(":visible")) {
           $("#resolutions").hide();
       } else {
           $("#resolutions").show();
       }
       //if ($("#fps").is(":visible")) {
       //    $("#fps").hide();
       //} else {
       //    $("#fps").show();
       //}
    });
    $("#resolutions").change(function() {
        stopStream();
        playStream(getVideoResParam('width'),getVideoResParam('height'));
        setVideoResDiv();
    });
    $("#proto").change(function() {
        trace("Switch to " + $("#proto").val());
        if (streamStatus == StreamStatus.Playing)
            stopStream();
        reinit = true;
        replay = true;
        disconnect();
    });

    $("#playButton").click(function() {
        playStream();
    });
    $("#stopButton").click(function() {
        stopStream();
    });
    $("#scaleButton").click(function() {
        fullScreenMode();
    });
    $("#volumeControl").slider({
        range: "min",
        min: 0,
        max: 100,
        value: 50,
        step: 10,
        animate: true,
        slide: function(event, ui) {
            setVolume(ui.value);
        }
    });
    initAPI();

}

function initAPI() {
    f = Flashphoner.getInstance();
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnVideoFormatEvent, videoFormatListener);
    console.log("InitAPI "+isFlashphonerAPILoaded);
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
    isFlashphonerAPILoaded = false;
    trace("Init HLS");
    $("#videoCanvas").hide();
    $("#remoteVideo").show();
    videoElement = $("#remoteVideo");
    $(videoElement).attr('src',getHLSUrl());
}

// Init Flash
function initRTMP() {
    trace("Init RTMP");
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
    f.connect({urlServer: setURL(), appKey: 'defaultApp'});
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

    f.connect({urlServer: setURL(), appKey: 'defaultApp'});

    $("#resolutions").find('option').show();
}

// Init WebSocket
function initWSPlayer() {
    isFlashphonerAPILoaded = false;
    trace("Init WSPlayer");
    videoElement = $("#videoCanvas");
    mediaProvider = MediaProvider.WSPlayer;

    $("#remoteVideo").hide();
    $("#videoCanvas").show();

    var configuration = new Configuration();
    configuration.wsPlayerCanvas = document.getElementById('videoCanvas');
    configuration.wsPlayerReceiverPath = "../../../dependencies/websocket-player/WSReceiver.js";
    configuration.videoWidth = getVideoResParam('width');
    configuration.videoHeight = getVideoResParam('height');
    f.init(configuration);

    initVisibility();
    // Hide unsupported resolutions
    $("#resolutions").find('option').not("option[value='640x360'],option[value='320x180']").hide();
    $("#resolutions option[value=320x180]").attr('selected','selected');
    f.connect({
        urlServer: setURL(),
        appKey: 'defaultApp',
        useWsTunnel: true,
        useBase64BinaryEncoding: false,
    });
}

// Disconnect
function disconnect() {
    f.disconnect();
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

//Play stream
function playStream(width,height) {
    if ($("#proto").val() == "HLS") {
        $(videoElement).attr('src',getHLSUrl()+"/"+field("playStream")+"/"+field("playStream")+".m3u8");
        $(videoElement).load();
    } else {
        trace("Play stream " + field("playStream"));
        var stream = new Stream();
        stream.name = field("playStream");
        stream.hasVideo = true;
        stream.mediaProvider = mediaProvider;
        if (width != null && height != null) {
            trace("Request for stream with resolution - " + width + "x" + height);
            useNativeResolution = false;
            stream.width = width;
            stream.height = height;
            f.playStream(stream);
        } else {
            f.playStream(stream);
        }
    }

    $("#playButton").hide();
    $("#waiting").show();
}

//Stop stream playback
function stopStream() {
    replay = false;
    var streamName = field("playStream");
    f.stopStream({name: streamName});
    $("#playButton").show();
    $("#waiting").hide();
}

///////////////////////////////////
///////////// Listeners ///////////
///////////////////////////////////

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
        if (replay) {
            if (mediaProvider == MediaProvider.Flash) {
                replay = false;
                setTimeout(function () {
                    var waitForFlashInit = setInterval(function () {
                        if (isFlashphonerAPILoaded) {
                            clearInterval(waitForFlashInit);
                            setTimeout(playStream, 2000);
                        } else {
                            setInterval(waitForFlashInit, 1000);
                        }
                    }, 1000);
                }, 3000);
            } else {
                playStream();
            }
        }
    } else if (event.status == ConnectionStatus.Failed) {
        $("#playStatus").show().text("Connection failed!");
        $("#playButton").show();
        $("#waiting").hide();
    }
    else if (event.status == ConnectionStatus.Disconnected && reinit) {
        initAPI();
    }
}

//Connection Status
function streamStatusListener(event) {
    trace("streamStatusListener >> " + event.status);
    streamStatus = event.status;
    switch (event.status) {
        case StreamStatus.Playing:
            onPlayActions();
            break;
        case StreamStatus.Stoped:
        case StreamStatus.Paused:
            onStopActions();
            break;
        case StreamStatus.Failed:
            onFailedActions();
            break;
        default:
            break;
    }
}

function videoFormatListener(event) {
    if (useNativeResolution) {
        console.log($(videoElement).attr('id'));
        trace("Set native resolution from publisher " + event.playerVideoWidth + "x" + event.playerVideoHeight);
        var marginLeft;
        var marginTop;

        if (event.playerVideoHeight > $("#player").height()) {
            $(videoElement).removeAttr('class').addClass('fp-remoteVideo');
            if (event.playerVideoWidth > $("#player").width()) {
                $(videoElement).prop('width', event.playerVideoWidth).prop('height', $("#player").height());
            } else if (event.playerVideoWidth == 800) {
                $(videoElement).prop('width', 640).prop('height', 480);
            }
        } else {
            $(videoElement).removeAttr('class').addClass('fp-remoteVideo-320x240');
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
            $(videoElement).removeAttr('class').addClass('fp-remoteVideo');
            marginLeft = ($("#player").width() - event.playerVideoWidth) / 2 + 'px';
            $(videoElement).css('margin-left', marginLeft);
        } else {
            marginTop = ($("#player").height() - event.playerVideoHeight) / 2 + 'px';
            $(videoElement).removeAttr('class').addClass('fp-remoteVideo-320x240');
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
///////////// Actions /////////////
///////////////////////////////////

function onPlayActions() {
    $("#playButton").hide();
    $("#waiting").hide();

    $("#playStream").css('background','#EEEEEE').hide();
    $("#player").css('background','dimgray');

    $("#player").click(function(e) {
        var target = $(e.target);
        if (target.is($(videoElement)) || target.is("#player")) {
            if ($("#footer").is(':visible')) {
                setTimeout(function () {
                    $("#footer").hide('blind', {direction: "down"}, 1500);
                }, 5000);
            } else {
                $("#footer").show();
            }
            if ($("#playStream").is(':visible')) {
                setTimeout(function () {
                    $("#playStream").hide('blind', {direction: "down"}, 1500);
                }, 5000);
            } else {
                $("#playStream").show();
            }
        }
    });
    $("#timer").text("00:00:00");
    startCallTimer();
}

function onFailedActions() {
    $("#playStatus").show().text("Playback failed!");
    $("#playButton").show();
    $("#waiting").hide();
}

function onStopActions() {
    $("#playButton").show();
    $("#waiting").hide();
    clearTimeout(timerTimeout);
}

///////////////////////////////////
///////////// Other ///////////////
///////////////////////////////////

function setVideoResDiv() {
    var res = $("#resolutions").val().split('x');
    var marginLeft, marginTop;
    var width = res[0];
    var height = res[1];
    trace("Set video div, width - " + res[0] + " , height - " + res[1]);

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

}

function getVideoResParam(param) {
    var res = $("#resolutions").val().split('x');
    if (param == 'width') {
        return res[0];
    } else {
        return res[1];
    }
}

function startCallTimer(clear) {
    var arr = $("#timer").text().split(":");
    var h = arr[0];
    var m = arr[1];
    var s = arr[2];

    if (s == '00') s = 0;

    if (s == 59) {
        if (m == 59) {
            h++;
            m = 0;
            if (h < 10) h = "0" + h;
        }
        m++;
        if (m < 10) m = "0" + m;
        s = 0;
    }
    else s++;
    if (s < 10) s = "0" + s;

    $("#timer").text(h + ":" + m + ":" + s);
    timerTimeout = setTimeout(startCallTimer, 1000);
}

function setVolume(value) {
    f.setVolumeOnStreaming(mediaProvider, value);
}

function fullScreenMode() {
    var video = document.getElementById("remoteVideo");
    if (video.requestFullscreen) {
        video.requestFullscreen();
    } else if (video.mozRequestFullScreen) {
        video.mozRequestFullScreen();
    } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
    }
}
// Hide unsupported technologies
function hideProto() {
    switch (detectBrowser()) {
        case "IE":
            $("#proto").find('option').not("option[value='RTMP']").hide();
            $("#proto option[value='RTMP']").attr('selected','selected');
            break;
        case "Firefox":
            $("#proto").find('option').not("option[value='WebRTC'],option[value='RTMP']").hide();
            $("#proto option[value='WebRTC']").attr('selected','selected');
            break;
        case "Chrome":
            break;
    }
}