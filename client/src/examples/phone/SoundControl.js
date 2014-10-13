var SoundControl = function () {
    if ( arguments.callee.instance ) {
        return arguments.callee.instance;
    }
    arguments.callee.instance = this;

    var configuration = ConfigurationLoader.getInstance();
    me = this;
    //Init sounds
    me.registerSound = me.initSound(configuration.registerSound, false, "auto");
    me.messageSound = me.initSound(configuration.messageSound, false, "auto");
    me.ringSound = me.initSound(configuration.ringSound, true, "none");
    me.busySound = me.initSound(configuration.busySound, false, "none");
    me.finishSound = me.initSound(configuration.finishSound, false, "none");
};

SoundControl.getInstance = function() {
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
        switch (soundName) {
            case "RING":
                if (!ConfigurationLoader.getInstance().disableLocalRing){
                    me.ringSound.play();
                }
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
    },

    //stops audio
    stopSound: function (soundName) {
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
    }
};
