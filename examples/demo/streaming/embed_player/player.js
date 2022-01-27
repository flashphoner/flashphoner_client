var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var remoteVideo;
var resolution_for_wsplayer;
var stream;
var currentVolumeValue = 50, storedVolume;
var stopped = true;
var autoplay = eval(getUrlParam("autoplay")) || false;
var resolution = getUrlParam("resolution");
var mediaProviders = getUrlParam("mediaProviders") || "";
var streamName = getUrlParam("streamName") || "streamName";
var urlServer = getUrlParam("urlServer") || setURL();
const HTML_VOLUME_MUTE='<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><defs><clipPath><path d="m 14.35,-0.14 -5.86,5.86 20.73,20.78 5.86,-5.91 z"></path><path d="M 7.07,6.87 -1.11,15.33 19.61,36.11 27.80,27.60 z"></path><path d="M 9.09,5.20 6.47,7.88 26.82,28.77 29.66,25.99 z" transform="translate(0, 0)"></path></clipPath><clipPath><path d="m -11.45,-15.55 -4.44,4.51 20.45,20.94 4.55,-4.66 z" transform="translate(0, 0)"></path></clipPath></defs><path style="fill: #fff;" clip-path="url(#ytp-svg-volume-animation-mask)" d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z" fill="#fff" id="ytp-svg-12"></path><path clip-path="url(#ytp-svg-volume-animation-slash-mask)" d="M 9.25,9 7.98,10.27 24.71,27 l 1.27,-1.27 Z" fill="#fff" style="fill:#fff;"></path></svg>';
const HTML_VOLUME_ZERO='<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><defs><clipPath><path d="m 14.35,-0.14 -5.86,5.86 20.73,20.78 5.86,-5.91 z"></path><path d="M 7.07,6.87 -1.11,15.33 19.61,36.11 27.80,27.60 z"></path><path d="M 9.09,5.20 6.47,7.88 26.82,28.77 29.66,25.99 z" transform="translate(0, 0)"></path></clipPath><clipPath><path d="m -11.45,-15.55 -4.44,4.51 20.45,20.94 4.55,-4.66 z" transform="translate(0, 0)"></path></clipPath></defs><path style="fill: #fff;" clip-path="url(#ytp-svg-volume-animation-mask)" d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z" fill="#fff" id="ytp-svg-12"></path><path clip-path="url(#ytp-svg-volume-animation-slash-mask)" d="M 9.25,9 7.98,10.27 24.71,27 l 1.27,-1.27 Z" fill="#fff" style="fill:#fff;"></path></svg>';
const HTML_VOLUME_LOW='<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><defs><clipPath><path d="m 14.35,-0.14 -5.86,5.86 20.73,20.78 5.86,-5.91 z"></path><path d="M 7.07,6.87 -1.11,15.33 19.61,36.11 27.80,27.60 z"></path><path d="M 9.09,5.20 6.47,7.88 26.82,28.77 29.66,25.99 z" transform="translate(0, 0)"></path></clipPath><clipPath><path d="m -11.45,-15.55 -4.44,4.51 20.45,20.94 4.55,-4.66 z" transform="translate(0, 0)"></path></clipPath></defs><path style="fill: #fff;" clip-path="url(#ytp-svg-volume-animation-mask)" d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 Z" fill="#fff" id="ytp-svg-12"></path></svg>';
const HTML_VOLUME_HIGH='<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"<defs><clipPath><path d="m 14.35,-0.14 -5.86,5.86 20.73,20.78 5.86,-5.91 z"></path><path d="M 7.07,6.87 -1.11,15.33 19.61,36.11 27.80,27.60 z"></path><path d="M 9.09,5.20 6.47,7.88 26.82,28.77 29.66,25.99 z" transform="translate(0, 0)"></path></clipPath><clipPath><path d="m -11.45,-15.55 -4.44,4.51 20.45,20.94 4.55,-4.66 z" transform="translate(0, 0)"></path></clipPath></defs><path style="fill: #fff;" clip-path="url(#ytp-svg-volume-animation-mask)" d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z" fill="#fff" id="ytp-svg-12"></path></svg>';
const HTML_FULLSCREEN_EXIT='<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><g class="ytp-fullscreen-button-corner-2"><path style="fill: #fff;" d="m 14,14 -4,0 0,2 6,0 0,-6 -2,0 0,4 0,0 z"></path></g><g><path style="fill: #fff;" d="m 22,14 0,-4 -2,0 0,6 6,0 0,-2 -4,0 0,0 z"></path></g><g><path style="fill: #fff;" d="m 20,26 2,0 0,-4 4,0 0,-2 -6,0 0,6 0,0 z"></path></g><g><path style="fill: #fff;" d="m 10,22 4,0 0,4 2,0 0,-6 -6,0 0,2 0,0 z"></path></g></svg>';
let firstUnmuted = true;

function init_page() {
    //video display
    remoteVideo = document.getElementById("remoteVideo");
    $('#remoteVideo').videoPlayer({
        'playerWidth': 1,
        'videoClass': 'video'
    });

    onStopped();

    //init api
    try {
        Flashphoner.init({
            receiverLocation: '../../dependencies/websocket-player/WSReceiver2.js',
            decoderLocation: '../../dependencies/websocket-player/video-worker2.js',
            preferredMediaProviders: mediaProviders && mediaProviders !== "" ? mediaProviders.split(','): []
        });
    } catch (e) {
        $("#error_output").text(e.message);
        return;
    }
    if (Flashphoner.getMediaProviders()[0] === "WSPlayer") {
        if (Browser.isiOS()) {
            $(".fullscreen").hide();
        }
    }
    if ((Browser.isSafariWebRTC() && Browser.isiOS() && Flashphoner.getMediaProviders()[0] == "WebRTC")) {
        $('.volume').hide();
        $('.volume-range-block').hide();
    }
    if (autoplay ) {
        // Autoplay will start for muted video tag only, adjust mute button and slider view
        firstUnmuted = false;
        $('.volume').addClass('volume-none');
        $('.volume').html(HTML_VOLUME_MUTE);
        $('#slider').slider( "value", 1 );
        $(".play-pause").click();
    }
}

function onStarted(stream) {
    stopped = false;
    $('#play').css('display', 'none');
    $(".play-pause").prop('disabled', false);
    $(".fullscreen").prop('disabled', false);
    stream.setVolume(currentVolumeValue);
}

function onStopped() {
    stopped = true;
    $('#play').css('display', 'block');
    $('#play').on('click', function() {
        if (!$('.play-pause').prop('disabled')) {
            if (stopped) {
                start();
                $('.play-pause').addClass('pause').removeClass('play').prop('disabled', true);
                $('#play').css('display', 'none');
            } else {
                if (stream) {
                    stream.stop();
                }
                $('.play-pause').addClass('play').removeClass('pause').prop('disabled', true);
                $("#preloader").hide();
            };
        };
    });
    $(".play-pause").addClass('play').removeClass('pause').prop('disabled', false);
    $(".fullscreen").prop('disabled', true);
    $("#preloader").hide();
}

function start() {
    $("#preloader").show();

    if (Flashphoner.getMediaProviders()[0] == "WSPlayer") {
        Flashphoner.playFirstSound();
    } else if (Browser.isSafariWebRTC() || Flashphoner.getMediaProviders()[0] == "MSE") {
        Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL).then(function() {
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
        var session = Flashphoner.getSessions()[0];
        playStream(session);
        return;
    }
    //create session
    console.log("Create new session with url " + urlServer);
    var mediaOptions = {"iceServers": [{'url': 'turn:turn.flashphoner.com:443?transport=tcp', 'username': 'flashphoner', 'credential': 'coM77EMrV7Cwhyan'}]};
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
    if (autoplay) {
        options.unmutePlayOnStart = false;
    }
    stream = session.createStream(options).on(STREAM_STATUS.PENDING, function(stream) {
        var video = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            video.addEventListener('playing', function () {
                $("#preloader").hide();
            });
            video.addEventListener('resize', function (event) {
                var streamResolution = stream.videoResolution();
                if (Object.keys(streamResolution).length === 0) {
                    resizeVideo(event.target);
                } else {
                    // Change aspect ratio to prevent video stretching
                    var ratio = streamResolution.width / streamResolution.height;
                    var newHeight = Math.floor(options.playWidth / ratio);
                    resizeVideo(event.target, options.playWidth, newHeight);
                }
            });
        }
    }).on(STREAM_STATUS.PLAYING, function (stream) {
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
    var statusField = $(".status");
    statusField.removeClass("text-success").removeClass("text-muted").removeClass("text-danger");
    if (status == "PLAYING" || status == "ESTABLISHED" || status == "STOPPED") {
        //don't display status word because we have this indication on UI
        statusField.text("");
    } else if (status == "DISCONNECTED") {
        statusField.text(status);
        statusField.addClass("text-muted");
    } else if (status == "FAILED") {
        statusField.text(status);
        statusField.addClass("text-muted");
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

function setVolume(volume, slider) {
    if (volume < 0) {
        console.error("Bad volume: " + volume);
        return(false);
    }
    if (stream) {
        if (volume > 0) {
            if (!firstUnmuted && slider && Browser.isAndroid()) {
                console.error("User should click volume unmute button to enable audio");
                return(false);
            } else if (stream.isRemoteAudioMuted()) {
                stream.unmuteRemoteAudio();
                firstUnmuted = true;
            }
        }
        stream.setVolume(volume);
    }
    // Save current volume in page element to restore it when mute/unmute
    $('#volume-range').val(volume);

    //chnage volume control icon
    if ( currentVolumeValue > 0) {
        //volume in range 0-50
        if ( currentVolumeValue <= 50 ) {
            $('.volume').html(HTML_VOLUME_LOW);
        }

        //volume greater than 50
        if ( currentVolumeValue > 50 ) {
            $('.volume').html(HTML_VOLUME_HIGH);
        }

        if ($('.volume').hasClass('volume-none')) {
            $('.volume').removeClass('volume-none');
        }

    } else if ( currentVolumeValue == 0 ) {
        // Zero volume is equal to audio mute
        $('.volume').html(HTML_VOLUME_ZERO);
        if (!$('.volume').hasClass('volume-none')) {
            $('.volume').addClass('volume-none');
        }
    }

    return(true);
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
            $that.find('.player').css({
                'width': ($settings.playerWidth * 100) + '%',
                'left': ((100 - $settings.playerWidth * 100) / 2) + '%'
            });

            var $mclicking = false,
            $vclicking = false,
            $volhover = false,
            $clearTimeout;
            y = 0;

            $that.bind('selectstart', function () {
                return false;
            });

            $that.find('.play-pause').bind('click', function () {
                // If playing, etc, change classes to show pause or play button
                if (!$(this).prop('disabled')) {
                    if (stopped) {
                        start();
                        $(this).addClass('pause').removeClass('play').prop('disabled', true);
                        $('#play').css('display', 'none');
                    } else {
                        if (stream) {
                            stream.stop();
                        }
                        $(this).addClass('play').removeClass('pause').prop('disabled', true);
                        $("#preloader").hide();
                    }
                }
            });

            $that.bind('click', function () {
                if ( !stopped ) {
                if ($clearTimeout) {
                    clearTimeout($clearTimeout);
                }
                $that.find('.player').stop(true, false).animate({'opacity': '1'}, 0.5);
                $clearTimeout = setTimeout(function() {
                    $that.find('.player').stop(true, false).animate({'opacity': '0'}, 0.5);
                }, 5000);
                };
            });

            $that.find('.volume').hover(function () {
                $volhover = true;
            }, function () {
                $volhover = false;
            });

            $('body, html').bind('mousemove', function (e) {
   				if ( !stopped ) {
       				$that.hover(function () {
           				$that.find('.player').stop(true, false).animate({'opacity': '1'}, 0.5);
       				}, function () {
           				$that.find('.player').stop(true, false).animate({'opacity': '0'}, 0.5);
       				});
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
 
            // Requests fullscreen based on browser.
            $('.fullscreenBtn').click(function () {
                if ( stream ) {
                    stream.fullScreen();
                };
            });
            var init = $( "#slider" ).slider({
              value: 50,
              orientation: "horizontal",
              range: "min",
              slide: function( event, ui ) {
                valueRange()
              },
              stop: function( event, ui ) {
                valueRange()
              }
            });
            valueRange();
            
            var prevVol=1;
            function valueRange() {
               currentVolumeValue = $( "#slider" ).slider( "value" );
               if (setVolume(currentVolumeValue, true)) {
                   // Save previous volume state to set when stream is unmuted by button
                   prevVol = currentVolumeValue ? currentVolumeValue : 1;
                   
               }
            }

            //mute unmute volume on click
            $('.volume').on('click', function () {
                if ($('.volume').hasClass('volume-none')) {
                    // Restore previous volume state
                    $('#slider').slider( "value", prevVol );
                    currentVolumeValue = prevVol;
                    setVolume(currentVolumeValue, false);
                    $('.volume').removeClass('volume-none');
                } else {
                    // Save previous volume state and mute audio
                    prevVol = $('#volume-range').val();
                    $('#slider').slider( "value", 0);
                    currentVolumeValue = 0;
                    setVolume(currentVolumeValue, false);
                    $('.volume').addClass('volume-none');
                };
            });


            //show slider wile changing volume
            $('.volume-range-block').focusin( function () {
                $(this).addClass('open-width').addClass('open');
            });
            $('.volume-range-block').focusout( function () {
                $(this).removeClass('open-width').removeClass('open');
            });


            isMobile = {
                Android: function() {
                    return navigator.userAgent.match(/Android/i);
                },
                BlackBerry: function() {
                    return navigator.userAgent.match(/BlackBerry/i);
                },
                iOS: function() {
                    return navigator.userAgent.match(/iPhone|iPad|iPod/i);
                },
                Opera: function() {
                    return navigator.userAgent.match(/Opera Mini/i);
                },
                Windows: function() {
                    return navigator.userAgent.match(/IEMobile/i);
                },
                any: function() {
                    return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
                }
            };
            if (isMobile.any()) {
              $('.volume-range-block').addClass('open-width-full')
            }
            var prevFull;

            $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange', function(e) {
                if (stream) {

                    $('.player').toggleClass('fullscreenon');  //Add class for all controls in full screen mode
                    $('.volume-range-block').toggleClass('fullscreen-vol'); //Add class to volume control for full screen mode

                    if ( $('.player').hasClass('fullscreenon') ) {
                        prevFull = $('.fullscreenBtn').html();

                        //change full screen button to full screen exit button
                        $('.fullscreenBtn').html(HTML_FULLSCREEN_EXIT);

                        //activate controls on mouse moving
                        $that.bind('mousemove touchmove', function () {
                            if ($clearTimeout) {
                                clearTimeout($clearTimeout);
                            }
                            $that.find('.player').stop(true, false).animate({'opacity': '1'}, 0.1);
                            $clearTimeout = setTimeout(function() {
                                $that.find('.player').stop(true, false).animate({'opacity': '0'}, 0.5);
                            }, 15000);
                        });
                    } else {

                        $('.fullscreenBtn').html(prevFull);
                        $('.fullscreenBtn').click(function () {
                            if ( stream ) {
                                stream.fullScreen();
                            };
                        });
                    };
                };
            });
        });
}
})(jQuery);
