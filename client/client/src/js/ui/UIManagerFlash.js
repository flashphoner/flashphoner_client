/**
 Copyright (c) 2013 Flashphoner
 All rights reserved. This Code and the accompanying materials
 are made available under the terms of the GNU Public License v2.0
 which accompanies this distribution, and is available at
 http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

 Contributors:
 Flashphoner - initial API and implementation

 This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. Other license versions by negatiation. Write us support@flashphoner.com with any questions.
 */
var UIManagerFlash = function () {
    this.requestUnmute = function() {
        trace("UIManagerFlash - requestUnmute");

        $('#video_requestUnmuteDiv').removeClass().addClass('securityDiv');
        $('#closeButton_video_requestUnmuteDiv').css('visibility', 'hidden');
        $('#sendVideo').css('visibility', 'hidden');
        $('#requestUnmuteText').show();

        $('#video').width(214);
        $('#video').height(138);
        getElement('video').style.top = "35px";

        flashphoner.getAccessToAudioAndVideo();
    };
}

UIManagerFlash.prototype = {
    requestUnmuteC2C: function() {
        trace("UIManagerFlash - requestUnmuteC2C");
        $('.back').show();
        $('.request').show();
        $('#flash').removeClass('init').addClass('security');
        flashphoner.getAccessToAudioAndVideo();
    },

    getAccessToAudioAndVideo: function() {
        this.requestUnmute();
    },

    getAccessToAudio: function() {
        this.requestUnmute();
    },

    getAccessToVideo: function() {
        this.requestUnmute();
    },


    openVideoView: function() {
        if (flashphoner.hasAccessToVideo()) {
            flashphoner.viewVideo();
            $('#video_requestUnmuteDiv').removeClass().addClass('videoDiv');
            $('#closeButton_video_requestUnmuteDiv').css('visibility', 'visible');

            $('#sendVideo').css('visibility', 'visible');
            $('#requestUnmuteText').hide();
            $('#video_requestUnmuteDiv .bar').html('&nbsp;&nbsp;Video');

            if (proportion != 0) {
                var newHeight = $('.videoDiv').width() * proportion + 40;
                $('.videoDiv').height(newHeight); //we resize video window for new proportion
            }
            $('#video_requestUnmuteDiv').resize();
        } else {
            this.requestUnmute();
            if (intervalId == -1) {
                intervalId = setInterval('if (flashphoner.hasAccessToVideo()){flashphoner_UI.closeRequestUnmute(); clearInterval(intervalId); intervalId = -1; flashphoner_UI.openVideoView();}', 500);
            }
        }
    },

    closeRequestUnmute: function() {
        trace("UIManagerFlash - closeRequestUnmute");
        $('#video_requestUnmuteDiv').removeClass().addClass('closed');
        getElement('video').style.top = "20px";
    },

    closeRequestUnmuteC2C: function() {
        trace("UIManagerFlash - closeRequestUnmuteC2C");
        $('.back').hide();
        $('.request').hide();
        $('#flash').addClass('init').removeClass('security');
    }
 };