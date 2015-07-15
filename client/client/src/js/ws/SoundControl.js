/*
 Copyright (c) 2011 Flashphoner
 All rights reserved. This Code and the accompanying materials
 are made available under the terms of the GNU Public License v2.0
 which accompanies this distribution, and is available at
 http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

 Contributors:
 Flashphoner - initial API and implementation

 This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. Other license versions by negatiation. Write us support@flashphoner.com with any questions.
 */
var SoundControl = function () {
    me = this;
    //Init sounds
    me.registerSound = me.initSound(flashphonerLoader.registerSound, false, "auto");
    me.messageSound = me.initSound(flashphonerLoader.messageSound, false, "auto");
    me.ringSound = me.initSound(flashphonerLoader.ringSound, true, "none");
    me.busySound = me.initSound(flashphonerLoader.busySound, false, "none");
    me.finishSound = me.initSound(flashphonerLoader.finishSound, false, "none");
    me.notifications = "busy finish ring register message";
};

SoundControl.prototype = {

    setSoundNotifications: function(notifications){
        me.notifications = notifications;
    },

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
                if (!flashphonerLoader.disableLocalRing && me.notifications.indexOf("ring")!=-1){
                    me.ringSound.play();
                }
                break
            case "BUSY":
                if (me.notifications.indexOf("busy")!=-1) {
                    me.busySound.play();
                }
                break
            case "REGISTER":
                if (me.notifications.indexOf("register")!=-1) {
                    me.registerSound.play();
                }
                break
            case "FINISH":
                if (me.notifications.indexOf("finish")!=-1) {
                    me.finishSound.play();
                }
                break
            case "MESSAGE":
                if (me.notifications.indexOf("message")!=-1) {
                    me.messageSound.play();
                }
                break
            default:
                console.error("Do not know what to play on " + soundName);

        }
    },

    //stops audio
    stopSound: function (soundName) {
        trace("stopSound soundName: "+soundName+" me: "+me+" me.ringSound: "+me.ringSound);
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