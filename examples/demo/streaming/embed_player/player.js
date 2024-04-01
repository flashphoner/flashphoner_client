const SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
const STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
const STREAM_EVENT = Flashphoner.constants.STREAM_EVENT;
const STREAM_EVENT_TYPE = Flashphoner.constants.STREAM_EVENT_TYPE;
const PRELOADER_URL = "../../dependencies/media/preloader.mp4";
const Browser = Flashphoner.Browser;
let remoteVideo;
let playingStream;
let isStopped = true;

let autoplay = eval(getUrlParam("autoplay")) || false;
let resolution = getUrlParam("resolution");
let mediaProviders = getUrlParam("mediaProviders") || "";
let streamName = getUrlParam("streamName") || "streamName";
let urlServer = getUrlParam("urlServer") || setURL();

// Will always use a standard video controls
let useVideoControls = true;

function init_page() {
    //init api
    try {
        Flashphoner.init({ preferredMediaProviders: mediaProviders && mediaProviders !== "" ? mediaProviders.split(','): [] });
        if (Flashphoner.getMediaProviders()[0] == "WSPlayer") {
            throw new Error("The WSPlayer mediaProvider is deprecated");
        }
    } catch(e) {
        document.getElementById("status").innerHTML = e.message;
        hideItem('preloader');
        centralButton.hide();
        return;
    }

    // Save video display element
    remoteVideo = document.getElementById("remoteVideo");

    // Init page elements
    onStopped();

    // Start playback if autoplay required
    if (autoplay) {
        centralButton.click();
    }
}

function onStarted() {
    isStopped = false;
    centralButton.prepareToStop();
}

function onStopped() {
    isStopped = true;
    hideItem('preloader');
    centralButton.prepareToStart(playBtnClick);
}

function playBtnClick() {
    if (isStopped) {
        centralButton.hide();
        start();
    } else {
        if (playingStream) {
            playingStream.stop();
        }
    }
}

function start() {
    if (!Browser.isChrome()) {
        // Display the custom preloader in non-Chromium browser
        showItem('preloader');
    }
    if (Browser.isSafari()) {
        Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL, useVideoControls).then(function() {
            createSession();
        }).catch(function() {
            onStopped();
        });
        return;
    }
    createSession();
}

function createSession() {
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        let session = Flashphoner.getSessions()[0];
        playStream(session);
        return;
    }
    // In Chromium browsers we need a custom preloader for a new session only
    showItem('preloader');
    //create session
    console.log("Create new session with url " + urlServer);
    let mediaOptions = {"iceServers": [{'url': 'turn:turn.flashphoner.com:443?transport=tcp', 'username': 'flashphoner', 'credential': 'coM77EMrV7Cwhyan'}]};
    Flashphoner.createSession({urlServer: urlServer, mediaOptions: mediaOptions}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        setStatus(session.status());
        //session connected, start playback
        playStream(session);
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus(SESSION_STATUS.DISCONNECTED);
        onStopped();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus(SESSION_STATUS.FAILED);
        onStopped();
    });
}

function playStream(session) {
    let playWidth = 0;
    let platHeight = 0;
    let options = {
        name: streamName,
        display: remoteVideo,
        useControls: useVideoControls
    };
    if (resolution) {
        playWidth = resolution.split("x")[0];
        playHeight = resolution.split("x")[1];
        options.constraints = {
            video: {
                width: playWidth,
                height: playHeight
            },
            audio: true
        };
    }
    if (autoplay) {
        options.unmutePlayOnStart = false;
    }
    playingStream = session.createStream(options).on(STREAM_STATUS.PENDING, function (stream) {
        if (Browser.isChrome()) {
            // Hide a custom preloader in Chrome because there is a standard one with standard controls
            hideItem('preloader');
        }
        let video = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            setResizeHandler(video, stream, playWidth);
            if (Browser.isSafariWebRTC()) {
                setWebkitEventHandlers(video);
            } else {
                setEventHandlers(video);
            }
        }
    }).on(STREAM_STATUS.PLAYING, function (stream) {
        // Android Firefox may pause stream playback via MSE even if video element is muted
        if (Flashphoner.getMediaProviders()[0] == "MSE" && autoplay && Browser.isAndroidFirefox()) {
            let video = document.getElementById(stream.id());
            if (video && video.paused) {
                video.play();
            }
        }
        setStatus(STREAM_STATUS.PLAYING);
        onStarted();
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus(STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function(stream) {
        setStatus(STREAM_STATUS.FAILED, stream);
        onStopped();
    }).on(STREAM_EVENT, function(streamEvent){
        if (STREAM_EVENT_TYPE.NOT_ENOUGH_BANDWIDTH === streamEvent.type) {
            let info = streamEvent.payload.info.split("/");
            let remoteBitrate = info[0];
            let networkBandwidth = info[1];
            console.log("Not enough bandwidth, consider using lower video resolution or bitrate. Bandwidth " + (Math.round(networkBandwidth / 1000)) + " bitrate " + (Math.round(remoteBitrate / 1000)));
        } else if (STREAM_EVENT_TYPE.RESIZE === streamEvent.type) {
            console.log("New video size: " + streamEvent.payload.streamerVideoWidth + "x" + streamEvent.payload.streamerVideoHeight);
        } else if (STREAM_EVENT_TYPE.UNMUTE_REQUIRED === streamEvent.type) {
            console.log("Stream is muted by autoplay policy, user action required to unmute");
        }
    });
    playingStream.play();
}

//show connection or remote stream status
function setStatus(status, stream) {
    let statusField = document.getElementById("status");
    if (status == "PLAYING" || status == "ESTABLISHED" || status == "STOPPED") {
        //don't display status word because we have this indication on UI
        statusField.innerHTML = "";
    } else if (status == "DISCONNECTED") {
        statusField.innerHTML = status;
    } else if (status == "FAILED") {
        statusField.innerHTML = status;
        if (stream && stream.getInfo() !== "") {
            statusField.innerHTML = status + ": " + stream.getInfo();
        }
    }
}

// Resize event handler
function setResizeHandler(video, stream, playWidth) {
    video.addEventListener('resize', function (event) {
        let streamResolution = stream.videoResolution();
        if (Object.keys(streamResolution).length === 0) {
            resizeVideo(event.target);
        } else {
            // Change aspect ratio to prevent video stretching
            let ratio = streamResolution.width / streamResolution.height;
            let newHeight = Math.floor(playWidth / ratio);
            resizeVideo(event.target, playWidth, newHeight);
        }
    });
}

// iOS/MacOS handlers for fullscreen issues
function setWebkitEventHandlers(video) {
    let needRestart = false;
    let isFullscreen = false;
    // Hide custom preloader
    video.addEventListener('playing', function () {
        hideItem('preloader');
    });
    // Use webkitbeginfullscreen event to detect full screen mode in iOS Safari
    video.addEventListener("webkitbeginfullscreen", function () {
        isFullscreen = true;
    });                
    video.addEventListener("pause", function () {
        if (needRestart) {
            console.log("Video paused after fullscreen, continue...");
            video.play();
            needRestart = false;
        } else if (!(isFullscreen || document.webkitFullscreenElement)) {
            // Stop stream by standard play/pause control
            playingStream.stop();
        }
    });
    video.addEventListener("webkitendfullscreen", function () {
        video.play();
        needRestart = true;
        isFullscreen = false;
    });                
}

function setEventHandlers(video) {
    // Hide custom preloader
    video.addEventListener('playing', function () {
        hideItem('preloader');
    });
    // Use standard pause control to stop playback
    video.addEventListener("pause", function () {
        if (!(document.fullscreenElement || document.mozFullscreenElement)) {
            // Stop stream by standard play/pause control if we're not in fullscreen
            playingStream.stop();
        }
    });
}

// Object to manage central Play/Stop button
const centralButton = {
    timer: null,
    displayed: false,
    display: function(timeout = 0) {
        showItem('play');
        centralButton.displayed = true;
        if (timeout > 0 && !centralButton.timer) {
            centralButton.timer = setTimeout(function() {
                centralButton.hide();
            }, timeout);
        }
    },
    displayToggle: function(timeout) {
        if(!centralButton.displayed) {
            centralButton.display(timeout);
        } else {
            centralButton.hide();
        }
    },
    setAction: function(action) {
        document.getElementById('play').onclick = action;
    },
    setView: function(view) {
        let button = document.getElementById('play');
        let image = button.querySelector('img');
        if (view === "play") {
            button.classList.remove('stop');
            button.classList.add('play');
            image.src = 'images/play.png';
        } else if (view === "stop") {
            button.classList.remove('play');
            button.classList.add('stop');
            image.src = 'images/stop.png';
        }
    },
    hide: function() {
        hideItem('play');
        centralButton.displayed = false;
        centralButton.stopTimer();
    },
    stopTimer: function() {
        if (centralButton.timer) {
            clearTimeout(centralButton.timer);
            centralButton.timer = null;
        }
    },
    click: function() {
        document.getElementById('play').click();
    },
    prepareToStart: function(action) {
        centralButton.stopTimer();
        centralButton.setView("play");
        centralButton.display();
        centralButton.setAction(action);   
    },
    prepareToStop: function() {
        centralButton.setView("stop");
        centralButton.hide();
    }
};

// Helper functions to display/hide an element
function showItem(id) {
    let item = document.getElementById(id);
    if (item) {
        item.style.display = "block";
    }
}

function hideItem(id) {
    let item = document.getElementById(id);
    if (item) {
        item.style.display = "none";
    }
}
