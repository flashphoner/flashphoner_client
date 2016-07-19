//Init WCS JavaScript API
var f;
var timer;
var useNativeResolution = true;
var streamStatus;
// This element will be used for playing video (canvas or video)
var $videoElement;
//
var isIE = false;
var isMobile = false;
var mediaProvider;
var replay = false;
var reinit = false;
var resolutionsArray = [256,320,512,640,800,1024,1280];
var $resolutions;
var playerHeight = 480;
var playerWidth = 864;
var nativeResolution;
var lastResolution;
var lastStream;
var lastVolumeValue = 50;
var conf = ConfigurationLoader.getInstance().configuration;
// swfobject params
var params = {};
params.bgcolor = "696969";
params.wmode = "opaque";

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
    $resolutions = $("#resolutions");
    $resolutions.data("originalRes",$resolutions.html());
    trace("Detected browser: " + detectBrowser());

    hideProto();

    $("#playStream").keyup(function() {
        $("#playButton").prop('disabled',!$("#playStream").val());
    }).focus().prop('disabled');

    // Hide some elements
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
    });

    $("#resolutions").change(function() {
        changeResolution();
    });
    $("#proto").change(function() {
        changeProto($(this).val());
    });
    $("#playButton").click(function() {
        playStream();
    });
    $("#stopButton").click(function() {
        replay = false;
        $("#timer").text("00:00:00");
        stopStream();
    });
    $("#scaleButton").click(function() {
        fullScreenMode();
    });
    $("#volumeControl").slider({
        range: "min",
        min: 0,
        max: 100,
        value: lastVolumeValue,
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

    if (detectIE()) {
        detectFlash();
    }

    cleanInstance();
    resetResolutions();
    if (nativeResolution != null)
        stripResolutions();
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
        case "RTMFP":
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
    trace("Init " + $("#proto").val());
    $("#videoCanvas").hide();
    $("#remoteVideo").show();
    $videoElement = $("#remoteVideo");
    $videoElement.attr('src',getHLSUrl());
}

// Init Flash
function initRTMP() {
    trace("Init " + $("#proto").val());
    $("#videoCanvas").hide();
    $videoElement = $("#flashVideoWrapper");
    $videoElement.show();

    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";
    configuration.forceFlashForWebRTCBrowser = true;
    configuration.swfParams = params;

    if ($("#proto").val() == "RTMP")
        configuration.urlFlashServer = conf.urlFlashServer.replace('rtmfp','rtmp');

    f.init(configuration);

    document.getElementById('remoteVideo').style.visibility = "hidden";
    document.getElementById('flashVideoWrapper').style.visibility = "visible";
    document.getElementById('flashVideoDiv').style.visibility = "visible";
    f.connect({urlServer: setURL(), appKey: 'defaultApp'});
}

// Init WebRTC
function initRTC() {
    trace("Init " + $("#proto").val());
    $("#videoCanvas").hide();
    $("#remoteVideo").show();

    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";
    configuration.swfParams = params;

    f.init(configuration);

    if (webrtcDetectedBrowser) {
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
        document.getElementById('remoteVideo').style.visibility = "visible";
        $videoElement = $("#remoteVideo");
    } else {
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "visible";
        mediaProvider = MediaProvider.Flash;
        $videoElement = $("#flashVideoWrapper");
    }

    f.connect({urlServer: setURL(), appKey: 'defaultApp', width: 0, height: 0});
}

// Init WebSocket
function initWSPlayer() {
    trace("Init " + $("#proto").val());
    $videoElement.hide().attr('src','');
    $videoElement = $("#videoCanvas");
    mediaProvider = MediaProvider.WSPlayer;

    $videoElement.show();

    var configuration = new Configuration();
    configuration.wsPlayerCanvas = document.getElementById('videoCanvas');
    configuration.wsPlayerReceiverPath = "../../../dependencies/websocket-player/WSReceiver.js";
    f.init(configuration);

    initVisibility();
    // Hide unsupported resolutions
    $("#resolutions").find('option').not("option[value='640x360'],option[value='320x180']").hide();
    $("#resolutions option[value=320x180]").prop('selected',true);
    f.connect({
        urlServer: setURL(),
        appKey: 'defaultApp',
        useWsTunnel: true,
        useBase64BinaryEncoding: false,
        width: getVideoResParam('width'),
        height: getVideoResParam('height')
    });
}

// Disconnect
function disconnect() {
    $("#playButton").hide();
    $("#waiting").show();
    f.disconnect();
}

/////////////////////////////////////////////////////
///////////////Page visibility///////////////////////
/////////////////////////////////////////////////////

var hidden = undefined;
var visibilityListener;
var visibilityChange;
function initVisibility() {
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
        visibilityListener = true;
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
    trace("Play stream " + field("playStream"));
    if (lastStream != field("playStream")) {
        resetResolutions();
        useNativeResolution = true;
    }
    lastStream = field("playStream");
    if ($("#proto").val() == "HLS") {
        $videoElement.attr('src',getHLSUrl()+"/"+field("playStream")+"/"+field("playStream")+".m3u8");
        $videoElement.load();
    } else {
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
            stream.width = 0;
            stream.height = 0;
            f.playStream(stream);
        }
    }

    $("#playButton").hide();
    $("#waiting").show();
}

//Stop stream playback
function stopStream(reinit) {
    var streamName = field("playStream");
    f.stopStream({name: streamName});
    if (reinit) {
        $("#playButton").hide();
        $("#waiting").show();
    } else {
        $("#playButton").show();
        $("#waiting").hide();
    }

    clearInterval(timer);
    timer = null;
}

///////////////////////////////////
///////////// Listeners ///////////
///////////////////////////////////

//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        $("#playStream").removeProp('disabled');
        trace('Connection has been established. You can start a new call.');
        // replay stream on connect
        if (replay) {
            if (mediaProvider == MediaProvider.Flash) {
                replay = false;
                // Wait for FlashAPI loading
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
        unmuteFooterElements();
    } else if (event.status == ConnectionStatus.Disconnected && reinit) {
        setTimeout(initAPI,2000);
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
    nativeResolution = event.playerVideoWidth + "x" + event.playerVideoHeight;
    trace("Got native resolution from publisher " + nativeResolution + " ; useNativeResolution: " + useNativeResolution);
    if (useNativeResolution && mediaProvider != MediaProvider.WSPlayer) {
        var marginLeft, marginTop;
        // Correct height
        if (event.playerVideoHeight > playerHeight) {
            trace("Native height [" + event.playerVideoHeight + "] greater than player's [" + playerHeight + "]");
            $videoElement.removeAttr('class').addClass('fp-remoteVideo');
            if (mediaProvider == MediaProvider.Flash) {
                $videoElement.css('height', playerHeight);
            } else {
                $videoElement.prop('height', playerHeight);
            }
        } else {
            trace("Set native height [" + event.playerVideoHeight + "]");
            $videoElement.removeAttr('class').addClass('fp-remoteVideo-sm');
            marginLeft = (playerWidth - event.playerVideoWidth) / 2 + 'px';
            marginTop = (playerHeight - event.playerVideoHeight) / 2 + 'px';
            $videoElement.css({'margin-left' : marginLeft, 'margin-top' : marginTop});
            if (mediaProvider == MediaProvider.Flash) {
                $videoElement.css('height', event.playerVideoHeight);
            } else {
                $videoElement.prop('height', event.playerVideoHeight);
            }
        }

        // Correct width
        if (event.playerVideoWidth > playerWidth) {
            trace("Native width [" + event.playerVideoWidth + "] greater than player's [" + playerWidth + "]");
            if (mediaProvider == MediaProvider.Flash) {
                $videoElement.css('width', playerWidth)
            } else {
                $videoElement.prop('width', playerWidth);
            }
        } else {
            trace("Set native width [" + event.playerVideoWidth + "]");
            $videoElement.removeAttr('class').addClass('fp-remoteVideo-sm');
            marginLeft = (playerWidth - event.playerVideoWidth) / 2 + 'px';
            marginTop = (playerHeight - event.playerVideoHeight) / 2 + 'px';
            $videoElement.css({'margin-left' : marginLeft, 'margin-top' : marginTop});
            if (mediaProvider == MediaProvider.Flash) {
                $videoElement.css('width', event.playerVideoWidth);
            } else {
                $videoElement.prop('width', event.playerVideoWidth);
            }
        }

        trace("Set video element size to " + $videoElement.width() + "x" + $videoElement.height());

        stripResolutions();

    } else {
        trace("Set resolution: "+getVideoResParam('width') + "x" + getVideoResParam('height'));
        setVideoResDiv(lastResolution);
    }
}

function filterResolutions(res) {
    return function (element) {
        return (res >= element);
    }
}

function stripResolutions() {
    var res = nativeResolution.split("x");
    // Hide resolutions greater then native
    var a = resolutionsArray.filter(filterResolutions(res[0]));
    var i = a.length;
    if (i > 0) {
        var s = "\(";
        while (i--) {
            s += (i > 0) ? (a[i] + "|") : ((a[i]) + "\)");
        }
        $("#resolutions option").each(function () {
            if (!$(this).val().match(s)) {
                if (isIE) {
                    $(this).remove();
                } else {
                    $(this).hide();
                }
            }
        });
    } else {
        $("#resolutions option").each(function () {
            if (isIE) {
                $(this).remove();
            } else {
                $(this).hide();
            }
        });
    }

    var set = false;
    // Check whether resolution list contains native res or not
    $("#resolutions option").each(function() {
        if ($(this).val() == nativeResolution) {
            $(this).prop('selected', true);
            set = true;
        }
    });
    // Append native resolution to list
    if (!set) {
        $("#resolutions").prepend($('<option>', {
            value: nativeResolution,
            text: nativeResolution,
            id: "nativeRes"
        }));
        $("#resolutions option[value=" + nativeResolution + "]").prop('selected', true);
    }
}

//Error
function errorEvent(event) {
    trace(event.info);
}

///////////////////////////////////

function cleanInstance() {
    isFlashphonerAPILoaded = false;
    f.wsPlayerMediaManager = undefined;
    f.flashMediaManager = undefined;
    f.userData = undefined;
}

function changeProto(proto) {
    trace("Switching to " + $("#proto").val());
    $("#playStatus").text("Switching to " + proto).removeClass().addClass('fp-playStatus text-primary').show();
    reinit = true;
    replay = true;
    lastResolution = $resolutions.val();
    muteFooterElements();
    if (visibilityListener)
        document.removeEventListener(visibilityChange, visibilityHandler, false);
    if (streamStatus == StreamStatus.Playing) {
        stopStream(replay);
    } else {
        disconnect();
    }
}

function changeResolution() {
    $("#playStatus").text("Switching to " + getVideoResParam('width') + "x" + getVideoResParam('height')).removeClass().addClass('fp-playStatus text-info').show();
    replay = false;
    lastResolution = null;
    stopStream(true);
    muteFooterElements();
    playStream(getVideoResParam('width'),getVideoResParam('height'));
}

///////////////////////////////////
///////////// Actions /////////////
///////////////////////////////////

function onPlayActions() {
    unmuteFooterElements();
    $("#playStatus").hide();
    $("#playButton").hide();
    $("#waiting").hide();

    $("#playStream").css('background','#EEEEEE').hide().prop('disabled',true);
    $("#footer").css('background','#EEEEEE').hide();
    $("#player").
        css('background','dimgray').
        mouseenter(function(e) {
            $("#footer").show();
            $("#playStream").show();
        }).
        mouseleave(function(e) {
            if ($(e.target).attr('id') == 'resolutions' || $(e.target).attr('id') == 'proto')
                return;
            $("#footer").hide();
            $("#playStream").hide();
        });
    if (isMobile) {
        $("#player").click(function(e) {
            var target = $(e.target);
            if ((target.is($videoElement) || target.is("#player")) && typeof target != 'undefined') {
                if ($("#footer").is(':visible') && $("#playStream").is(':visible')) {
                    $("#footer").hide();
                    $("#playStream").hide();
                } else {
                    $("#footer").show();
                    $("#playStream").show();
                }
            }
        });
    }
    $("#timer").text("00:00:00");
    if (!timer)
        timer = setInterval(startCallTimer, 1000);
    if ($("#playStream").val().indexOf("rtsp://") != -1) {
        if (detectBrowser() == "Safari" || detectBrowser() == "iOS") {
            $("#proto option[value='HLS']").prop('disabled', true);
        } else {
            $("#proto option[value='HLS']").hide();
        }
    } else {
        if (detectBrowser() == "Safari" || detectBrowser() == "iOS") {
            $("#proto option[value='HLS']").removeProp('disabled');
        } else {
            $("#proto option[value='RTMP']").show();
        }
    }
}

function onStopActions() {
    $("#playStream").removeProp('disabled');
    if (replay) {
        disconnect();
    }
}

function onFailedActions() {
    unmuteFooterElements();
    $("#playStream").removeProp('disabled');
    $("#playStatus").show().text("Playback failed!").removeClass().attr("class","text-danger");
    $("#playButton").show();
    $("#waiting").hide();
}

///////////////////////////////////
///////////// Other ///////////////
///////////////////////////////////

function setVideoResDiv(resolution) {
    var res;
    if (mediaProvider != MediaProvider.WSPlayer) {
        res = (resolution) ? resolution.split('x') : $("#resolutions").val().split('x');
        $("#resolutions option[value=" + resolution + "]").prop('selected', true);
    } else {
        res = $("#resolutions").val().split('x');
    }
    trace("setvideoresdiv: " + res);
    var marginLeft, marginTop;
    var width = res[0];
    var height = res[1];

    // 256x144, 320x180, 512x288, 640x360, 800x450
    if (width < playerWidth && height < playerHeight) {
        if (mediaProvider == MediaProvider.Flash) {
            $videoElement.css('width', width).css('height', height);
        } else {
            $videoElement.prop('width', width).prop('height', height);
        }
        marginLeft = (playerWidth - width) / 2 + 'px';
        marginTop = (playerHeight - height) / 2 + 'px';
        $videoElement.css({'margin-left' : marginLeft, 'margin-top' : marginTop});

    // 1024x576, 1280x720
    } else if (height > playerHeight) {
        $videoElement.css({'margin-left' : 0, 'margin-top' : 0});
        if (width > playerWidth) {
            if (mediaProvider == MediaProvider.Flash) {
                $videoElement.css('width', playerWidth).css('height', playerHeight);
            } else {
                $videoElement.prop('width', playerWidth).prop('height', playerHeight);
            }
        } else {
            marginLeft = (playerWidth - width) / 2 + 'px';
            if (mediaProvider == MediaProvider.Flash) {
                $videoElement.css('width', width).css('height', playerHeight);
            } else {
                $videoElement.prop('width', width).prop('height', playerHeight);
            }
            $videoElement.css('margin-left', marginLeft);
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

function startCallTimer() {
    var $t = $("#timer");
    var arr = $t.text().split(":");
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

    $t.text(h + ":" + m + ":" + s);
}

function setVolume(value) {
    lastVolumeValue = value;
    f.setVolumeOnStreaming(mediaProvider, value);
}

function fullScreenMode() {
    var video;
    if (mediaProvider == MediaProvider.WebRTC) {
        video = document.getElementById("remoteVideo");
    } else if (mediaProvider == MediaProvider.WSPlayer) {
        video = document.getElementById("videoCanvas");
    } else {
        video = document.getElementById("flashVideoWrapper");
    }

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
            isIE = true;
            $("#proto").find('option').not("option[value='RTMP'],option[value='RTMFP']").remove();
            $("#proto option[value='RTMP']").attr('selected','selected');
            break;
        case "Firefox":
            $("#proto").find('option').not("option[value='WebRTC'],option[value='RTMP'],option[value='RTMFP']").hide();
            $("#proto option[value='WebRTC']").attr('selected','selected');
            break;
        case "Chrome":
            break;
        case "Android":
            isMobile = true;
            $("#proto").find('option').not("option[value='WebRTC'],option[value='HLS']").hide();
            $("#proto option[value='WebRTC']").attr('selected','selected');
            break;
        case "iOS":
            isMobile = true;
        case "Safari":
            $("#proto").find('option').not("option[value='WebSocket'],option[value='HLS']").remove();
            $("#flashVideoWrapper").remove();
            $("#flashVideoDiv").remove();
            $("#proto option[value='WebSocket']").attr('selected','selected');
            swfobject = undefined;
            break;
    }
}

function resetResolutions() {
    trace("Reset resolutions");
    $resolutions.html($resolutions.data("originalRes"));
}

function muteFooterElements() {
    $("#proto").prop('disabled','disabled');
    $("#resolutions").prop('disabled','disabled');
    $("#stopButton").prop('disabled','disabled');
}

function unmuteFooterElements() {
    $("#proto").removeProp('disabled');
    $("#resolutions").removeProp('disabled');
    $("#stopButton").removeProp('disabled');
}

function trace(message) {
    console.log("> " + message);
}