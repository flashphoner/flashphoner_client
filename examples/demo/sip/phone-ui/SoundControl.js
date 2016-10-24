var SoundControl = function () {
    if (arguments.callee.instance) {
        return arguments.callee.instance;
    }
    arguments.callee.instance = this;

    me = this;
    //Init sounds
    me.registerSound = me.initSound("sounds/REGISTER.mp3", false, "auto");
    me.messageSound = me.initSound("sounds/MESSAGE.mp3", false, "auto");
    me.ringSound = me.initSound("sounds/CALL_OUT.mp3", true, "none");
    me.busySound = me.initSound("sounds/BUSY.mp3", false, "none");
    me.finishSound = me.initSound("sounds/HANGUP.mp3", false, "none");
};

SoundControl.getInstance = function () {
    return new SoundControl();
};

SoundControl.prototype = {

    //Creates HTML5 audio tag
    initSound: function (src, loop, preload) {
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
    },

    //plays audio
    playSound: function (soundName) {
        try {
            switch (soundName) {
                case "RING":
                    me.ringSound.play();
                    break;
                case "BUSY":
                    me.busySound.play();
                    break;
                case "REGISTER":
                    me.registerSound.play();
                    break;
                case "FINISH":
                    me.finishSound.play();
                    break;
                case "MESSAGE":
                    me.messageSound.play();
                    break;
                default:
                    console.error("Do not know what to play on " + soundName);

            }
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
                    if (me.ringSound && !me.ringSound.paused) {
                        me.ringSound.pause();
                        me.ringSound.currentTime = 0;
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
