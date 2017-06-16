var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var remoteVideo;
var resolution_for_wsplayer;
var stream;
var currentVolumeValue = 50, storedVolume;
var stopped = true;
var autoplay = getUrlParam("autoplay") || false;
var resolution = getUrlParam("resolution");
var mediaProvider = getUrlParam("mediaProvider") || null;
var streamName = getUrlParam("streamName") || "streamName";
var urlServer = getUrlParam("urlServer") || setURL();

function init_page() {
    //init api
    try {
        Flashphoner.init({
            flashMediaProviderSwfLocation: '../../../../media-provider.swf',
            receiverLocation: '../../dependencies/websocket-player/WSReceiver2.js',
            decoderLocation: '../../dependencies/websocket-player/video-worker2.js',
            preferredMediaProvider: mediaProvider
        });
    } catch (e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology necessary for work of an example");
        return;
    }
    if (Flashphoner.getMediaProviders()[0] === "WSPlayer") {
        resolution_for_wsplayer = {playWidth: 640, playHeight: 480};
    }
    if (Flashphoner.getMediaProviders()[0] === "Flash") {
        $(".fullscreen").hide();
    }

    //video display
    remoteVideo = document.getElementById("remoteVideo");

    $('#remoteVideo').videoPlayer({
        'playerWidth': 0.95,
        'videoClass': 'video'
    });

    onStopped();
    if (autoplay) {
        $(".play-pause").click();
    }
}

function onStarted(stream) {
    stopped = false;
    $(".play-pause").prop('disabled', false);
    $(".fullscreen").prop('disabled', false);
    stream.setVolume(currentVolumeValue);
}

function onStopped() {
    stopped = true;
    $(".play-pause").addClass('play').removeClass('pause').prop('disabled', false);
    $(".fullscreen").prop('disabled', true);
    $("#preloader").hide();
}

function start() {
    $("#preloader").show();

    if (Flashphoner.getMediaProviders()[0] == "WSPlayer") {
        Flashphoner.playFirstSound();
    }
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        var session = Flashphoner.getSessions()[0];
        playStream(session);
        return;
    }
    //create session
    console.log("Create new session with url " + urlServer);
    Flashphoner.createSession({urlServer: urlServer}).on(SESSION_STATUS.ESTABLISHED, function (session) {
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
    var options = {
        name: streamName,
        display: remoteVideo,
        flashShowFullScreenButton: true
    };
    if (resolution_for_wsplayer) {
        options.playWidth = resolution_for_wsplayer.playWidth;
        options.playHeight = resolution_for_wsplayer.playHeight;
    } else if (resolution) {
        options.playWidth = resolution.split("x")[0];
        options.playHeight = resolution.split("x")[1];
    }
    stream = session.createStream(options).on(STREAM_STATUS.PLAYING, function (stream) {
        // For WSPlayer
        if (stream.getInfo() === "FIRST_FRAME_RENDERED") {
            $("#preloader").hide();
        }
        // document.getElementById(stream.id()).addEventListener('resize', function(event){
        //     $("#preloader").hide();
        //     var streamResolution = stream.videoResolution();
        //     if (Object.keys(streamResolution).length === 0) {
        //         resizeVideo(event.target);
        //     } else {
        //         // Change aspect ratio to prevent video stretching
        //         var ratio = streamResolution.width / streamResolution.height;
        //         var newHeight = Math.floor(options.playWidth / ratio);
        //         resizeVideo(event.target, options.playWidth, newHeight);
        //     }
        // });
        setStatus(stream.status());
        onStarted(stream);
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus(STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function () {
        setStatus(STREAM_STATUS.FAILED);
        onStopped();
    }).on(STREAM_STATUS.NOT_ENOUGH_BANDWIDTH, function (stream) {
        console.log("Not enough bandwidth, consider using lower video resolution or bitrate. Bandwidth " + (Math.round(stream.getNetworkBandwidth() / 1000)) + " bitrate " + (Math.round(stream.getRemoteBitrate() / 1000)));
    });
    stream.play();
}

//show connection or remote stream status
function setStatus(status) {
    var statusField = $("#status");
    statusField.text(status).removeClass();
    if (status == "PLAYING") {
        statusField.attr("class", "text-success");
    } else if (status == "DISCONNECTED" || status == "ESTABLISHED" || status == "STOPPED") {
        statusField.attr("class", "text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class", "text-danger");
    }
}

function validateForm() {
    var valid = true;
    $('#form :text').each(function () {
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            removeHighlight($(this));
        }
    });
    return valid;

    function highlightInput(input) {
        input.closest('.form-group').addClass("has-error");
    }

    function removeHighlight(input) {
        input.closest('.form-group').removeClass("has-error");
    }
}

(function ($) {
    $.fn.videoPlayer = function (options) {
        var settings = {
            playerWidth: '0.95', // Default is 95%
            videoClass: 'video'  // Video Class
        };

        if (options) {
            $.extend(settings, options);
        }

        return this.each(function () {
            var $this = $(this);
            var $settings = settings;
            var $that = $this.parent('.' + $settings.videoClass);
            $videoWidth = $this.width();
            $that.width($videoWidth + 'px');
            $that.find('.player').css({
                'width': ($settings.playerWidth * 100) + '%',
                'left': ((100 - $settings.playerWidth * 100) / 2) + '%'
            });

            var $mclicking = false,
                $vclicking = false,
                $volhover = false,
                y = 0;

            $that.bind('selectstart', function () {
                return false;
            });

            $that.find('.play-pause').bind('click', function () {
                // If playing, etc, change classes to show pause or play button
                if (stopped) {
                    start();
                    $(this).addClass('pause').removeClass('play').prop('disabled', true);
                } else {
                    if (stream) {
                        stream.stop();
                    }
                    $(this).addClass('play').removeClass('pause').prop('disabled', true);
                    $("#preloader").hide();
                }
            });


            $that.find('.volume-bar-holder').bind('mousedown', function (e) {
                $vclicking = true;
                y = $that.find('.volume-bar-holder').height() - (e.pageY - $that.find('.volume-bar-holder').offset().top);
                if (y < 0 || y > $(this).height()) {
                    $vclicking = false;
                    return false;
                }
                $that.find('.volume-bar').css({'height': y + 'px'});
                currentVolumeValue = $that.find('.volume-bar').height() * 100 / $(this).height();
                volanim();

            });

            var volanim = function () {
                $that.find('.volume-bar').css({'height': (currentVolumeValue) + '%'});
                if (stream) {
                    stream.setVolume(currentVolumeValue);
                }
                for (var i = 0; i < 1; i += 0.1) {
                    var fi = parseInt(Math.floor(i * 10)) / 10;
                    var volid = (fi * 10) + 1;
                    var $v = currentVolumeValue / 100;
                    if ($v === 1) {
                        if ($volhover) {
                            $that.find('.volume-icon').removeClass().addClass('volume-icon volume-icon-hover v-change-11');
                        } else {
                            $that.find('.volume-icon').removeClass().addClass('volume-icon v-change-11');
                        }
                    }
                    else if ($v === 0) {
                        if ($volhover) {
                            $that.find('.volume-icon').removeClass().addClass('volume-icon volume-icon-hover v-change-1');
                        } else {
                            $that.find('.volume-icon').removeClass().addClass('volume-icon v-change-1');
                        }
                    }
                    else if ($v > (fi - 0.1) && !$that.find('.volume-icon').hasClass('v-change-' + volid)) {
                        if ($volhover) {
                            $that.find('.volume-icon').removeClass().addClass('volume-icon volume-icon-hover v-change-' + volid);
                        } else {
                            $that.find('.volume-icon').removeClass().addClass('volume-icon v-change-' + volid);
                        }
                    }

                }
            };
            volanim();
            $that.find('.volume').hover(function () {
                $volhover = true;
            }, function () {
                $volhover = false;
            });
            $('body, html').bind('mousemove', function (e) {
                $that.hover(function () {
                    $that.find('.player').stop(true, false).animate({'opacity': '1'}, 0.5);
                }, function () {
                    $that.find('.player').stop(true, false).animate({'opacity': '0'}, 0.5);
                });

                if ($vclicking) {
                    y = $that.find('.volume-bar-holder').height() - (e.pageY - $that.find('.volume-bar-holder').offset().top);
                    var volMove = 0;
                    if ($that.find('.volume-holder').css('display') === 'none') {
                        $vclicking = false;
                        return false;
                    }
                    if (!$that.find('.volume-icon').hasClass('volume-icon-hover')) {
                        $that.find('.volume-icon').addClass('volume-icon-hover');
                    }
                    if (y < 0 || y === 0) { // If y is less than 0 or equal to 0 then volMove is 0.
                        currentVolumeValue = 0;
                        volMove = 0;
                        $that.find('.volume-icon').removeClass().addClass('volume-icon volume-icon-hover v-change-11');
                    } else if (y > $(this).find('.volume-bar-holder').height() || (y / $that.find('.volume-bar-holder').height()) === 1) { // If y is more than the height then volMove is equal to the height
                        currentVolumeValue = 100;
                        volMove = $that.find('.volume-bar-holder').height();
                        $that.find('.volume-icon').removeClass().addClass('volume-icon volume-icon-hover v-change-1');
                    } else { // Otherwise volMove is just y
                        currentVolumeValue = $that.find('.volume-bar').height() * 100 / $that.find('.volume-bar-holder').height();
                        volMove = y;
                    }
                    volanim();
                }
                if (!$volhover) {
                    $that.find('.volume-holder').stop(true, false).fadeOut(100);
                    $that.find('.volume-icon').removeClass('volume-icon-hover');
                }
                else {
                    $that.find('.volume-icon').addClass('volume-icon-hover');
                    $that.find('.volume-holder').fadeIn(100);
                }
            });

            $that.find('.volume-icon').bind('mousedown', function () {
                if (storedVolume) {
                    currentVolumeValue = storedVolume;
                    storedVolume = undefined;
                } else {
                    storedVolume = currentVolumeValue;
                    currentVolumeValue = 0;
                }
                volanim();
            });

            $('body, html').bind('mouseup', function (e) {
                $mclicking = false;
                $vclicking = false;
            });

            // Requests fullscreen based on browser.
            $('.fullscreenBtn').click(function () {
                if (stream) {
                    stream.fullScreen();
                }
            });

            $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange', function(e) {
                if (stream) {
                    currentVolumeValue = stream.getVolume();
                    volanim();
                }
            });
        });
    }
})(jQuery);
