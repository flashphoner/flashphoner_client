const Browser = Flashphoner.Browser;
const VIDEOJS_VERSION_TYPE = {
    VIDEOJS7: "videojs7",
    VIDEOJS8: "videojs8"
};
const LIVE_THRESHOLD = 5;
const LIVE_TOLERANCE = 5;
const LIVE_UI_INTERVAL = 1000;
const STATS_INTERVAL = 1000;
const QUALITY_COLORS = {
    NONE: "",
    AVAILABLE: "black",
    SELECTED: "blue"
};
const QUALITY_AUTO = "Auto";
let player = null;
let liveUITimer = null;
let videojsVersion = getUrlParam("version");
let playSrc = getUrlParam("src");
let autoplay = eval(getUrlParam("autoplay")) || false;
let playbackStats = null;
let qualityLevels = [];

const loadPlayerPage = function() {
    if (videojsVersion) {
        hideItem("videojsInputForm");
        loadVideoJS(videojsVersion);
    } else {
        if (autoplay) {
            console.warn("No VideoJS version set, autoplay disabled");
            autoplay = false;
        }
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

const onVideojsBtnClick = function() {
    loadVideoJS(getValue("videojsInput"));
}

const loadVideoJS = function(version) {
    if (version) {
        videojsVersion = version;
        let playerPage = document.getElementById("playerPage");
        loadFile(version + "/video.js", "text/javascript").then( data  => {
            console.log("HLS library loaded successfully", data);
            loadStyles(version, playerPage);
        }).catch( err => {
            setText("videojsError", "Can't load VideoJS library");
            console.error(err);
        });
    }
}

const loadStyles = function(version, playerPage) {
    if (version) {
        loadFile(version + "/video-js.css", "stylesheet").then ( data => {
            console.log("HLS library stylesheet loaded successfully", data);
            if (version === VIDEOJS_VERSION_TYPE.VIDEOJS7) {
                loadQualityPlugin(version, playerPage);
            } else {
                hideItem("videojsInputForm");
                loadPage("player-page.html", "playerPage", initPage);
            }
        }).catch( err => {
            playerPage.innerHTML = "Can't load VideoJS library stylesheet";
            playerPage.setAttribute("class", "text-danger");
            console.error(err);
        });
    }
}

const loadQualityPlugin = function(version, playerPage) {
    if (version) {
        loadFile(version + "/videojs-contrib-quality-levels.js", "text/javascript").then( data => {
            console.log("HLS quality levels plugin loaded successfully", data);
            hideItem("videojsInputForm");
            loadPage("player-page.html", "playerPage", initPage);
        }).catch( err => {
            setText("videojsError", "Can't load VideoJS quality levels plugin");
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
    if (playSrc) {
        setValue("fullLink", decodeURIComponent(playSrc));
    } else if (autoplay) {
        console.warn("No HLS URL set, autoplay disabled");
        autoplay = false;
    }
    let remoteVideo = document.getElementById('remoteVideo');
    if (autoplay) {
        // There should not be any visible item on the page unless player
        hideAllToAutoplay();
        // The player should use all available page width
        setUpPlayerItem(true);
        // The player should be muted to automatically start playback
        player = initVideoJsPlayer(remoteVideo, true);
        playBtnClick();
    } else {
        // No autoplay, all the forms and buttons should be visible
        setText("header", "HLS VideoJS Player Minimal");
        displayCommonItems();
        setUpButtons();
        enablePlaybackStats();
        // The player should have a maximum fixed size
        setUpPlayerItem(false);
        // The player can be unmuted because user should click Play button
        player = initVideoJsPlayer(remoteVideo, false);
    }
}

const playBtnClick = function() {
    let videoSrc = getVideoSrc(getValue("fullLink"));
    if (videoSrc) {
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
            displayPermalink(videoSrc);
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
            initQualityLevels(player);
            displayQualitySwitch();
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
    if (!autoplay) {
        toggleInputs(false);
        enableItem("applyBtn");
        hideItem("permalink");
        showItem("backward");
        setText("applyBtn", "Stop");
        setHandler("applyBtn", "click", stopBtnClick, playBtnClick);
        startPlaybackStats();
        hideItem("quality");
    }
}


const onStopped = function() {
    if (!autoplay) {
        toggleInputs(true);
        enableItem("applyBtn");
        hideItem("backward");
        setText("applyBtn", "Play");
        setHandler("applyBtn", "click", playBtnClick, stopBtnClick);
        stopPlaybackStats();
        hideItem("quality");
        disposeQualityLevels();
    }
    if(!document.getElementById('remoteVideo')) {
        createRemoteVideo(document.getElementById('videoContainer'));
    }
}


const createRemoteVideo = function(parent) {
    let remoteVideo = document.createElement("video");
    remoteVideo.id = "remoteVideo";
    remoteVideo.controls="controls";
    remoteVideo.autoplay="autoplay";
    remoteVideo.type="application/vnd.apple.mpegurl";
    remoteVideo.className = "video-js vjs-default-skin";
    remoteVideo.setAttribute("playsinline","");
    remoteVideo.setAttribute("webkit-playsinline","");
    parent.appendChild(remoteVideo);
    player = initVideoJsPlayer(remoteVideo, autoplay);
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

const initVideoJsPlayer = function(video, muted) {
    let videoJsPlayer = null;
    if (video) {
        video.className = "video-js vjs-default-skin";
        videoJsPlayer = videojs(video, {
            playsinline: true,
            playbackRates: [0.1, 0.25, 0.5, 1, 1.5, 2],
            liveui: true,
            liveTracker: {
                trackingThreshold: LIVE_THRESHOLD,
                liveTolerance: LIVE_TOLERANCE
            },
            fill: true,
            muted: muted,
            html5: {
                vhs: {
                    limitRenditionByPlayerDimensions: false
                }
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

const setUpButtons = function() {
    setHandler("applyBtn", "click", playBtnClick);
    setHandler("backBtn10", "click", backBtnClick);
    setHandler("backBtn30", "click", backBtnClick);
    setHandler("backBtnMax", "click", backBtnClick);
    setHandler("liveBtn", "click", liveBtnClick);
}

const toggleBackButtons = function(enable) {
    if (!autoplay) {
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

const getVideoSrc = function(src) {
    let videoSrc = src;
    if (validateForm()) {
        let streamName = getValue('playStream');
        streamName = encodeURIComponent(streamName);
        videoSrc = getValue("urlServer") + '/' + streamName + '/' + streamName + '.m3u8';
        let key = getValue('key');
        let token = getValue("token");
        if (key.length > 0 && token.length > 0) {
            videoSrc += "?" + key + "=" + token;
        }
    }
    setValue("fullLink", videoSrc);
    return videoSrc;
}

const displayPermalink = function(src) {
    if (!autoplay) {
        const permalinkId = "permalink";
        let videoSrc = encodeURIComponent(src);
        let linkObject = document.getElementById(permalinkId);
        let href = window.location.href.split("?")[0] + "?version=" + videojsVersion + "&src=" + videoSrc;
        linkObject.href = href;
        showItem(permalinkId);
    }
}

const displayQualitySwitch = function() {
    if (!autoplay && qualityLevels.length) {
        showItem("quality")
    }
}

const hideAllToAutoplay = function() {
    hideItem("header");
    hideItem("notifyFlash");
    hideItem("fieldset");
    hideItem("stats");
}

const displayCommonItems = function() {
    setValue("urlServer", getHLSUrl());
    hideItem("permalink");
    enableItem("applyBtn");
    setText("applyBtn", "Play");
}

const setUpPlayerItem = function(fillPage) {
    let videoContainer = document.getElementById('videoContainer');
    let playerPage = document.getElementById('playerPage');

    if (fillPage) {
        playerPage.classList.remove("container");
        videoContainer.style.marginTop = "0px";
        videoContainer.style.width = "100vw";
        videoContainer.style.height = "100vh";
        videoContainer.style.maxWidth = "available";
        videoContainer.style.maxHeight = "available";
    } else {
        videoContainer.style.maxWidth = "852px";
        videoContainer.style.maxHeight = "480px";
    }
}

const enablePlaybackStats = function() {
    if (!autoplay && !playbackStats) {
        playbackStats = PlaybackStats(STATS_INTERVAL);
    }
}

const startPlaybackStats = function() {
    if (!autoplay && playbackStats) {
        playbackStats.start();
    }
}

const stopPlaybackStats = function() {
    if (!autoplay && playbackStats) {
        playbackStats.stop();
    }
}

const PlaybackStats = function(interval) {
    const playbackStats = {
        interval: interval || STATS_INTERVAL,
        timer: null,
        stats: null,
        start: function() {
            let video = getActualVideoTag();
            playbackStats.stop();
            stats = HTML5Stats(video);
            playbackStats.timer = setInterval(playbackStats.displayStats, playbackStats.interval);
            setText("videoWidth", "N/A");
            setText("videoHeight", "N/A");
            setText("videoRate", "N/A");
            setText("videoFps", "N/A");
            showItem("stats");
        },
        stop: function() {
            if (playbackStats.timer) {
                clearInterval(playbackStats.timer);
                playbackStats.timer = null;
            }
            playbackStats.stats = null;
            hideItem("stats");
        },
        displayStats: function() {
            if (stats.collect()) {
                let width = stats.getWidth();
                let height = stats.getHeight();
                let bitrate = stats.getBitrate();
                let fps = stats.getFps();

                setText("videoWidth", width);
                setText("videoHeight", height);

                if (bitrate !== undefined) {
                    setText("videoRate", Math.round(bitrate));
                }
                if (fps !== undefined) {
                    setText("videoFps", fps.toFixed(1));
                }
            }
        }
    };
    return playbackStats;
}

const initQualityLevels = function(player) {
    if (player && !qualityLevels.length) {
        let playerQualityLevels = player.qualityLevels();
        if (playerQualityLevels) {
            let qualityDiv = document.getElementById("qualityBtns");
            let qualityLevel;
            for (let i = 0; i < playerQualityLevels.length; i++) {
                qualityLevel = QualityLevel(playerQualityLevels, playerQualityLevels[i].height, i, qualityDiv);
                qualityLevels.push(qualityLevel);
            }
            if (qualityLevels.length) {
                qualityLevel = QualityLevel(playerQualityLevels, QUALITY_AUTO, -1, qualityDiv);
                qualityLevels.push(qualityLevel);
            }
        }
    }
}

const disposeQualityLevels = function() {
    qualityLevels.forEach(level => {
        if (level.button) {
            level.button.remove();
        }
    });
    qualityLevels = [];
}

const qualityBtnClick = function(button, playerQualityLevels, index) {
    if (playerQualityLevels && playerQualityLevels.length) {
        let currentIndex = playerQualityLevels.selectedIndex_;
        for (let i = 0; i < playerQualityLevels.length; i++) {
            let qualityLevel = playerQualityLevels[i];
            if (index === -1 || i === index) {
                qualityLevel.enabled = true;
            } else if (i === index) {
                qualityLevel.enabled = true;
                currentIndex = index;
            } else {
                qualityLevel.enabled = false;
            }
        }
        playerQualityLevels.selectedIndex_ = currentIndex;
        playerQualityLevels.trigger({ type: 'change', selectedIndex: currentIndex });
    }
    button.style.color = QUALITY_COLORS.SELECTED;
    qualityLevels.forEach(item => {
        if (item.button.id !== button.id) {
            item.button.style.color = QUALITY_COLORS.AVAILABLE
        }
    });
}

const QualityLevel = function(object, levelId, index, btnParent) {
    const btnId = "qualityBtn";
    let button = document.createElement("button");
    if (levelId === QUALITY_AUTO && index === -1) {
        button.id = btnId + QUALITY_AUTO;
        button.innerHTML = QUALITY_AUTO;
    } else {
        button.id = btnId + index;
        button.innerHTML = levelId;
    }
    button.type = "button";
    button.className = "btn btn-default";
    button.style.color = QUALITY_COLORS.AVAILABLE;
    button.onclick = (event) => {
        qualityBtnClick(button, object, index);
    };
    btnParent.appendChild(button);
    const qualityLevel = {
        level: levelId,
        index: index,
        button: button
    };
    return qualityLevel;
}
