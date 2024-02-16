const Browser = Flashphoner.Browser;
const VIDEOJS_VERSION_TYPE = {
    VIDEOJS7: "videojs7",
    VIDEOJS8: "videojs8"
};
const LIVE_THRESHOLD = 5;
const LIVE_TOLERANCE = 5;
const LIVE_UI_INTERVAL = 1000;
let player = null;
let liveUITimer = null;
let videojsVersion = getUrlParam("version");

const loadPlayerPage = function() {
    if (videojsVersion) {
        hideItem("videojsInputForm");
        loadVideoJS("videojs" + videojsVersion);
    } else {
        let videojsInput = document.getElementById("videojsInput");
        for (videojsType in VIDEOJS_VERSION_TYPE) {
            let option = document.createElement("option");
            let videojsFolder = "";
            switch (videojsType) {
                case 'VIDEOJS7':
                    videojsFolder = VIDEOJS_VERSION_TYPE.VIDEOJS7;
                    break;
                case 'VIDEOJS8':
                    videojsFolder = VIDEOJS_VERSION_TYPE.VIDEOJS8;
                    break;
            }
            option.text = videojsFolder;
            option.value = videojsFolder;
            videojsInput.appendChild(option);
        }

        setHandler("videojsBtn", "click", onVideojsBtnClick);
    }
}

const onVideojsBtnClick = function () {
    loadVideoJS(getValue("videojsInput"));
}

const loadVideoJS = function (version) {
    if (version) {
        let playerPage = document.getElementById("playerPage");
        loadFile(version + "/video.js", "text/javascript").then( data  => {
            console.log("HLS library loaded successfully", data);
            loadFile(version + "/video-js.css", "stylesheet").then ( data => {
                console.log("HLS library stylesheet loaded successfully", data);
                hideItem("videojsInputForm");
                loadPage("player-page.html", "playerPage", initPage );
            }).catch( err => {
                playerPage.innerHTML = "Can't load VideoJS library stylesheet";
                playerPage.setAttribute("class", "text-danger");
                console.error(err);
            })
        }).catch( err => {
            setText("videojsError", "Can't load VideoJS library");
            console.error(err);
        });
    }
}

const loadFile = function(url, type) {
    return new Promise((resolve, reject) => {
        try {
            let tag = null;
            if (type === "text/javascript") {
                tag = document.createElement("script");
                tag.type = type;
                tag.async = true;
                tag.src = url;
            } else if (type === "stylesheet") {
                tag = document.createElement("link");
                tag.rel = type;
                tag.href = url;
            }

            if (tag) {
                tag.addEventListener("load", (ev) => {
                    resolve({status: true});
                });

                tag.addEventListener("error", (ev) => {
                    reject({
                        status: false,
                        message: `Failed to load the file ${url}`
                    });
                });

                document.head.appendChild(tag);
            } else {
                reject({
                    status: false,
                    message: `Undefined file type ${type}`
                });
            }
        } catch (error) {
            reject(error);
        }
    });
}

const loadPage = function(page, containerId, onLoad) {
    fetch(page).then(function (response) {
        if (response.ok) {
            return response.text();
        }
        throw response;
    }).then(function (text) {
        let container = document.getElementById(containerId);
        container.innerHTML = text;
        onLoad();
    });
}

const initPage = function() {
    setText("header", "HLS VideoJS Player Minimal");
    setValue("urlServer", getHLSUrl());
    enableItem("applyBtn");
    setText("applyBtn", "Play");
    setHandler("applyBtn", "click", playBtnClick);
    setHandler("backBtn10", "click", backBtnClick);
    setHandler("backBtn30", "click", backBtnClick);
    setHandler("backBtnMax", "click", backBtnClick);
    setHandler("liveBtn", "click", liveBtnClick);
    let remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.className = "video-js vjs-default-skin";
    player = initVideoJsPlayer(remoteVideo);
}

const playBtnClick = function() {
    if (validateForm()) {
        let streamName = getValue('playStream');
        streamName = encodeURIComponent(streamName);
        let videoSrc = getValue("urlServer") + '/' + streamName + '/' + streamName + '.m3u8';
        let key = getValue('key');
        let token = getValue("token");
        if (key.length > 0 && token.length > 0) {
            videoSrc += "?" + key + "=" + token;
        }
        player.on('loadedmetadata', function() {
            console.log("Play with VideoJs");
            player.play();
        });
        player.on('error', function() {
            let error = player.error();
            // Stop on error
            stopBtnClick();
            if (error && error.code == error.MEDIA_ERR_DECODE) {
                // Restart playback in case of decode error
                playBtnClick();
            }
        });
        player.on('playing', function() {
            console.log("playing event fired");
            if (player.liveTracker) {
                if (!player.liveTracker.isLive()) {
                    // A cratch to display live UI for the first subscriber
                    liveUIDisplay();
                }
                if (player.liveTracker.atLiveEdge()) {
                    // Unlock backward buttons when seeked to live edge
                    toggleBackButtons(true);
                    // Stop live UI startup timer
                    stopLiveUITimer();
                }
            }
        });
        player.src({
            src: videoSrc,
            type: "application/vnd.apple.mpegurl"
        });
        onStarted();
    }
}

const liveUIDisplay = function() {
    stopLiveUITimer()
    if (player && player.liveTracker) {
        liveUITimer = setInterval(function() {
            if (!player.liveTracker.isLive() && player.liveTracker.liveWindow() > LIVE_THRESHOLD) {
                // Live UI is not displayed yet, seek to live edge to display
                player.liveTracker.seekToLiveEdge();
            }
        }, LIVE_UI_INTERVAL)
    }
}

const stopLiveUITimer = function () {
    if (liveUITimer) {
        clearInterval(liveUITimer);
        liveUITimer = null;
    }
}

const stopBtnClick = function() {
    if (player != null) {
        console.log("Stop VideoJS player");
        stopLiveUITimer();
        player.dispose();
    }
    onStopped();
}

const backBtnClick = function(event) {
    if (player != null && player.liveTracker) {
        toggleBackButtons(false);
        let seekable = player.seekable();
        let backTime = -1;
        if (event.target.id.indexOf("10") !== -1) {
            backTime = player.currentTime() - 10;
        } else if (event.target.id.indexOf("30") !== -1) {
            backTime = player.currentTime() - 30;
        }
        if (backTime < 0) {
            backTime = seekable ? seekable.start(0) : player.currentTime();
        }
        player.currentTime(backTime);
    }
}

const liveBtnClick = function() {
    if (player != null && player.liveTracker) {
        player.liveTracker.seekToLiveEdge();
        toggleBackButtons(true);
    }
}

const onStarted = function() {
    toggleInputs(false);
    enableItem("applyBtn");
    showItem("backward");
    toggleBackButtons(true);
    setText("applyBtn", "Stop");
    setHandler("applyBtn", "click", stopBtnClick, playBtnClick);
}


const onStopped = function() {
    toggleInputs(true);
    enableItem("applyBtn");
    hideItem("backward");
    setText("applyBtn", "Play");
    setHandler("applyBtn", "click", playBtnClick, stopBtnClick);
    if(!document.getElementById('remoteVideo')) {
        createRemoteVideo(document.getElementById('videoContainer'));
    }
}


const createRemoteVideo = function(parent) {
    remoteVideo = document.createElement("video");
    remoteVideo.id = "remoteVideo";
    remoteVideo.width=852;
    remoteVideo.height=480;
    remoteVideo.controls="controls";
    remoteVideo.autoplay="autoplay";
    remoteVideo.type="application/vnd.apple.mpegurl";
    remoteVideo.className = "video-js vjs-default-skin";
    remoteVideo.setAttribute("playsinline","");
    remoteVideo.setAttribute("webkit-playsinline","");
    parent.appendChild(remoteVideo);
    player = initVideoJsPlayer(remoteVideo);
}


const validateForm = function() {
    let valid = validateInput("urlServer");
    if (valid) {
        valid = validateInput("playStream");
    }
    return valid;
}

const validateInput = function(id) {
    let value = getValue(id);
    let valid = true;
    if (!value || !value.length) {
        highlightInput(id);
        valid = false;
    } else {
        removeHighlight(id);
    }
    return valid;
}

const highlightInput = function(input) {
    let item = document.getElementById(input);
    if (item) {
        let parent = closest(input,'.form-group');
        if (parent) {
            parent.classList.add("has-error");
        }
    }
}


const removeHighlight = function(input) {
    let item = document.getElementById(input);
    if (item) {
        let parent = closest(input,'.form-group');
        if (parent) {
            parent.classList.remove("has-error");
        }
    }
}

const initVideoJsPlayer = function(video) {
    let videoJsPlayer = videojs(video, {
        playsinline: true,
        playbackRates: [0.1, 0.25, 0.5, 1, 1.5, 2],
        liveui: true,
        liveTracker: {
            trackingThreshold: LIVE_THRESHOLD,
            liveTolerance: LIVE_TOLERANCE
        }
    });
    console.log("Using VideoJs " + videojs.VERSION);
    if (Browser.isSafariWebRTC() && Browser.isiOS()) {
        // iOS hack when using standard controls to leave fullscreen mode
        let videoTag = getActualVideoTag();
        if(videoTag) {
            setWebkitFullscreenHandlers(videoTag, false);
        }
    }
    return videoJsPlayer;
}

const getActualVideoTag = function() {
    let videos = document.querySelectorAll("video");
    if (videos && videos.length > 0) {
        return videos[0];
    }
    return null;
}

const toggleBackButtons = function(enable) {
    if (enable) {
        enableItem("backBtn10");
        enableItem("backBtn30");
        enableItem("backBtnMax");
    } else {
        disableItem("backBtn10");
        disableItem("backBtn30");
        disableItem("backBtnMax");
    }
}

const toggleInputs = function(enable) {
    if (enable) {
        enableItem("urlServer");
        enableItem("playStream");
        enableItem("key");
        enableItem("token");
        enableItem("player");
    } else {
        disableItem("urlServer");
        disableItem("playStream");
        disableItem("key");
        disableItem("token");
        disableItem("player");
    }
}