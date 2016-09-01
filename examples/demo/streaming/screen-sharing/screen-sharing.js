//Init API

var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var currentSession;
var _stream;
var _streamName;
var localVideo;
var remoteVideo;
var browser = detectBrowser();
var extensionId = "nlbaajplpmleofphigmgaifhoikjmbkg";

Flashphoner.init({screenSharingExtensionId: extensionId});

//////////////////////////////////
/////////////// Init /////////////

function init_page() {

    $("#url").val(setURL() + "/" + createUUID(8));

    var interval;

    if (browser == "Firefox") {
        $("#installExtensionButton").show();
        interval = setInterval(function() {
            if (Flashphoner.firefoxScreenSharingExtensionInstalled) {
                $("#extension").hide();
                $("#installExtensionButton").hide();
                clearInterval(interval);
            }
        }, 500);

    } else if (browser == "Chrome") {
        interval = setInterval(function() {
            chrome.runtime.sendMessage(extensionId, {type: "isInstalled"}, function (response) {
                if (response) {
                    $("#extension").hide();
                } else {
                    (inIframe()) ? $("#installFromMarket").show() : $("#installExtensionButton").show();
                }
            });
        }, 500);

    } else {
        $("#notify").modal('show');
        return false;
    }

    $("#publishBtn").click(function () {
            $(this).prop('disabled',true);
            var state = $("#publishBtn").text();
            if (state == "Start") {
                connectAndShare();
            } else {
                unPublishStream();
            }
        }
    );
}

function initAPI() {

    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    if (detectIE()) {
        detectFlash();
    }

    init_page();
}

///////////////////////////////////
///////////// Controls ////////////
///////////////////////////////////

//New connection
function connectAndShare() {
    muteInputs();
    if (currentSession && currentSession.status() == SESSION_STATUS.ESTABLISHED) {
        console.warn("Already connected, session id " + currentSession.id());
        publishStream();
        return;
    }
    var url = field('url');
    console.log("Create new session with url " + url);

    var handleSession = function(session) {
        var status = session.status();

        switch(status) {
            case "FAILED":
                $("#publishBtn").removeProp('disabled');
                console.warn("Session failed, id " + session.id());
                setStatus(session.status());
                removeSession(session);
                break;
            case "DISCONNECTED":
                console.log("Session diconnected, id " + session.id());
                removeSession(session);
                break;
            case "ESTABLISHED":
                console.log("Session established " + session.id());
                publishStream();
                break;
        }
    };

    currentSession = Flashphoner.createSession({urlServer: url})
        .on(SESSION_STATUS.FAILED, handleSession)
        .on(SESSION_STATUS.DISCONNECTED, handleSession)
        .on(SESSION_STATUS.ESTABLISHED, handleSession);
}

//Disconnect
function disconnect() {
    if (!currentSession) {
        console.warn("Nothing to disconnect");
        return;
    }
    currentSession.disconnect();
    $("#connectBtn").text("Connect");
}

//Publish stream
function publishStream() {
    _streamName = field("url").split('/')[3];
    if (!currentSession || currentSession.status() != SESSION_STATUS.ESTABLISHED) {
        console.warn("Session is not ready or null");
        return;
    }

    var handleStream = function(stream) {

        var status = stream.status();
        console.log("Stream status: " + status);
        switch (status) {
            case "PUBLISHING":
                _stream = stream;
                playStream();
            case "UNPUBLISHED":
                setStatus(status);
                break;
            case "FAILED":
                var cause = stream.getInfo();
                setStatus(status,cause);
                break;

        }
    };

    var constraints = {
        video: {
            width: parseInt(document.getElementById("width").value),
            height: parseInt(document.getElementById("height").value),
            frameRate: parseInt(document.getElementById("fps").value),
            type: "screen"
        }
    };

    currentSession.createStream({name: _streamName, constraints: constraints, display: localVideo, cacheLocalResources: false})
        .on(STREAM_STATUS.PUBLISHING, handleStream)
        .on(STREAM_STATUS.FAILED, handleStream)
        .on(STREAM_STATUS.UNPUBLISHED, handleStream).publish();

}

//Stop stream publishing
function unPublishStream() {
    _stream.stop();
}

function playStream() {
    currentSession.createStream({name: _streamName, display: remoteVideo, cacheLocalResources: false})
        .on(STREAM_STATUS.PLAYING, function(playingStream) {
            console.log("Playing");
        })
        .on(STREAM_STATUS.RESIZE, function(playingStream) {
            var dimension = playingStream.getStreamDimension();
            var W = dimension.width;
            var H = dimension.height;
            console.log("Got native resolution " + W + "x" + H);
        })
        .play();
}


/////////////////////////////////////
///////////// Display UI ////////////
/////////////////////////////////////

// Set Connection Status
function setStatus(status, cause) {
    $("#publishBtn").removeProp('disabled');
    if (status == "PUBLISHING") {
        $("#status").text(status).removeClass().attr("class","text-success");
        $("#publishBtn").text("Stop");
    }

    if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        unmuteInputs();
        $("#status").text(status).removeClass().attr("class","text-muted");
        $("#publishBtn").text("Start");
    }

    if (status == "FAILED") {
        unmuteInputs();
        $("#status").text((cause) ? cause : status).removeClass().attr("class","text-danger");
        $("#publishBtn").text("Start");
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

function removeSession(session) {
    if (currentSession.id() == session.id()) {
        currentSession = null;
    }
}

//install extension
function installExtension() {
    if (browser == "Chrome") {
        chrome.webstore.install();
    } else if (browser == "Firefox") {
        var params = {
            "Flashphoner Screen Sharing": { URL: "../../dependencies/screen-sharing/firefox-extension/flashphoner_screen_sharing-0.0.4-fx+an.xpi",
                IconURL: "../../dependencies/screen-sharing/firefox-extension/icon.png",
                Hash: "sha1:9c2bd6b0a22473cc721d7b3d3ecc72707b507f75",
                toString: function () { return this.URL; }
            }
        };
        InstallTrigger.install(params);
    }
}

function installFromMarket() {
    if (browser == "Chrome") {
        var url = "https://chrome.google.com/webstore/detail/flashphoner-screen-sharin/nlbaajplpmleofphigmgaifhoikjmbkg";
        window.open(url, '_blank');
    }
}

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function muteInputs() {
    $(":input").each(function() {
       $(this).prop('disabled',true);
    });
}

function unmuteInputs() {
    $(":input").each(function() {
        $(this).removeProp('disabled');
    });
}
