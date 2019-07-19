var registerSound;
var ringSound;
var busySound;
var finishSound;
var messageSound;
var initialized = false;

var initSounds = function () {
    if (!initialized) {
        registerSound = initSound("sounds/REGISTER.mp3", false, "auto");
        messageSound = initSound("sounds/MESSAGE.mp3", false, "auto");
        ringSound = initSound("sounds/CALL_OUT.mp3", true, "none");
        busySound = initSound("sounds/BUSY.mp3", false, "none");
        finishSound = initSound("sounds/HANGUP.mp3", false, "none");
        initialized = true;
    }
};

var initSound = function (src, loop, preload) {
    if (typeof loop == 'undefined') {
        loop = false;
    }
    var audioTag = document.createElement("audio");
    audioTag.autoplay = false;
    audioTag.preload = preload;
    if (loop) {
        audioTag.loop = true;
    }
    //add src tag to audio tag
    audioTag.src = src;
    document.body.appendChild(audioTag);
    return audioTag;
} ;

var SoundControl = function () {
    if (arguments.callee.instance) {
        return arguments.callee.instance;
    }
    arguments.callee.instance = this;
};

SoundControl.getInstance = function () {
    return new SoundControl();
};

SoundControl.prototype = {

    //plays audio
    playSound: function (soundName) {
        try {
            var sound;
            switch (soundName) {
                case "RING":
                    sound = ringSound;
                    break;
                case "BUSY":
                    sound = busySound;
                    break;
                case "REGISTER":
                    sound = registerSound;
                    break;
                case "FINISH":
                    sound = finishSound;
                    break;
                case "MESSAGE":
                    sound = messageSound;
                    break;
                default:
                    console.error("Do not know what to play on " + soundName);

            }
            sound.load();
            sound.play();
        }
        catch (err) {
            console.info("This browser may not support sound.play() method: " + err)
        }
    },

    //stops audio
    stopSound: function (soundName) {
        try {
            switch (soundName) {
                case "RING":
                    if (ringSound && !ringSound.paused) {
                        ringSound.pause();
                        ringSound.currentTime = 0;
                    }
                    break;
                default:
                    console.error("Do not know what to stop on " + soundName);

            }
        } catch (err) {
            console.info("This browser may not support sound.pause() method or sound.currentTime property: " + err)
        }
    }
};
