var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
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
            flashMediaProviderSwfLocation: '../../../../media-provider.swf',
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
    if (Flashphoner.getMediaProviders()[0] === "Flash") {
        $(".fullscreen").hide();
        $(".player").css('width','75%');
    }
    if ((Browser.isSafariWebRTC() && Browser.isiOS() && Flashphoner.getMediaProviders()[0] == "WebRTC")) {
        $('.volume').hide();
        $('.volume-range-block').hide();
    }
    if (autoplay ) {
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

function volumeEvent(event) {
    stream.unmuteRemoteAudio();
    $('.volume').unbind('click',volumeEvent);
    $('.volume-range-block').unbind('mousedown',volumeEvent);
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
    stream = session.createStream(options).on(STREAM_STATUS.PENDING, function(stream) {
        var video = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            video.addEventListener('playing', function () {
                $("#preloader").hide();
                if (autoplay && stream.isRemoteAudioMuted()) {
                    //WCS-1698. if autoplay = true, then set the volume slider to 0. When you first click on the slider or icon, sound turn on. https://goo.gl/7K7WLu
                    //WCS-2870. The code below was commented out because it break autoplay in latest iOS and macOS Safari
                    //$('.volume').click();
                    $('.volume').bind('click', volumeEvent);
                    $('.volume-range-block').bind('mousedown', volumeEvent);
                }
                if ($('.volume').hasClass('volume-none') && !stream.isRemoteAudioMuted()) {
                	$('.volume').click();
                }
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
                        autoplay = false;
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
            				if ( !stopped ) {
                				$that.hover(function () {
                    				$that.find('.player').stop(true, false).animate({'opacity': '1'}, 0.5);
                				}, function () {
                    				$that.find('.player').stop(true, false).animate({'opacity': '0'}, 0.5);
                				});
																};
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
                if ( stream ) {
                    stream.fullScreen();
                };
            });
            var elem = document.querySelector('#volume-range');
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
            function valueRange() {
               if (stream) {
                   currentVolumeValue = $( "#slider" ).slider( "value" );
                   stream.setVolume(currentVolumeValue);
               }

              //chnage volume control icon
              currentVolumeValue = $( "#slider" ).slider( "value" );
              //volume in range 0-50
               if ( currentVolumeValue > 0 && currentVolumeValue <= 50 ) {
                   $('.volume').html('<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><defs><clipPath><path d="m 14.35,-0.14 -5.86,5.86 20.73,20.78 5.86,-5.91 z"></path><path d="M 7.07,6.87 -1.11,15.33 19.61,36.11 27.80,27.60 z"></path><path d="M 9.09,5.20 6.47,7.88 26.82,28.77 29.66,25.99 z" transform="translate(0, 0)"></path></clipPath><clipPath><path d="m -11.45,-15.55 -4.44,4.51 20.45,20.94 4.55,-4.66 z" transform="translate(0, 0)"></path></clipPath></defs><path style="fill: #fff;" clip-path="url(#ytp-svg-volume-animation-mask)" d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 Z" fill="#fff" id="ytp-svg-12"></path></svg>');
               };

               //volume greater than 50
               if ( currentVolumeValue > 50 ) {
                   $('.volume').html('<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"<defs><clipPath><path d="m 14.35,-0.14 -5.86,5.86 20.73,20.78 5.86,-5.91 z"></path><path d="M 7.07,6.87 -1.11,15.33 19.61,36.11 27.80,27.60 z"></path><path d="M 9.09,5.20 6.47,7.88 26.82,28.77 29.66,25.99 z" transform="translate(0, 0)"></path></clipPath><clipPath><path d="m -11.45,-15.55 -4.44,4.51 20.45,20.94 4.55,-4.66 z" transform="translate(0, 0)"></path></clipPath></defs><path style="fill: #fff;" clip-path="url(#ytp-svg-volume-animation-mask)" d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z" fill="#fff" id="ytp-svg-12"></path></svg>');
               };

               //volume zero
               if ( currentVolumeValue == 0 ) {
                   $('.volume').html('<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><defs><clipPath><path d="m 14.35,-0.14 -5.86,5.86 20.73,20.78 5.86,-5.91 z"></path><path d="M 7.07,6.87 -1.11,15.33 19.61,36.11 27.80,27.60 z"></path><path d="M 9.09,5.20 6.47,7.88 26.82,28.77 29.66,25.99 z" transform="translate(0, 0)"></path></clipPath><clipPath><path d="m -11.45,-15.55 -4.44,4.51 20.45,20.94 4.55,-4.66 z" transform="translate(0, 0)"></path></clipPath></defs><path style="fill: #fff;" clip-path="url(#ytp-svg-volume-animation-mask)" d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z" fill="#fff" id="ytp-svg-12"></path><path clip-path="url(#ytp-svg-volume-animation-slash-mask)" d="M 9.25,9 7.98,10.27 24.71,27 l 1.27,-1.27 Z" fill="#fff" style="fill:#fff;"></path></svg>');
               };
            }


            //mute unmute volume on click
            var prevVol, prevLeft, prevHtml;
            $('.volume').on('click', function () {
                if ($('.volume').hasClass('volume-none')) {
                    $('#slider').slider( "value", prevVol );
                    $('#volume-range').val(prevVol);
                    $('.volume').html(prevHtml);
                    currentVolumeValue = prevVol;
                    if (stream) {
                        stream.setVolume(currentVolumeValue);
                    }
                    $('.volume').removeClass('volume-none');
                } else {
                    prevVol = $('#volume-range').val();
                    prevHtml = $('.volume').html();
                    $('.volume').html('<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><defs><clipPath><path d="m 14.35,-0.14 -5.86,5.86 20.73,20.78 5.86,-5.91 z"></path><path d="M 7.07,6.87 -1.11,15.33 19.61,36.11 27.80,27.60 z"></path><path d="M 9.09,5.20 6.47,7.88 26.82,28.77 29.66,25.99 z" transform="translate(0, 0)"></path></clipPath><clipPath><path d="m -11.45,-15.55 -4.44,4.51 20.45,20.94 4.55,-4.66 z" transform="translate(0, 0)"></path></clipPath></defs><path style="fill: #fff;" clip-path="url(#ytp-svg-volume-animation-mask)" d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z" fill="#fff" id="ytp-svg-12"></path><path clip-path="url(https://www.youtube.com/watch?v=FA044r-szpM#ytp-svg-volume-animation-slash-mask)" d="M 9.25,9 7.98,10.27 24.71,27 l 1.27,-1.27 Z" fill="#fff" style="fill:#fff;"></path></svg>');
                    $('#volume-range').val(0);
                    $('#slider').slider( "value", 0);
                    if (stream) {
                        stream.setVolume(0);
                    };
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
                    if ($("#"+stream.id()).prop("muted")) {
                        currentVolumeValue = 0;
                    } else {
                        currentVolumeValue = stream.getVolume();
                    }
                    volanim();

                    $('.player').toggleClass('fullscreenon');  //Add class for all controls in full screen mode
                    $('.volume-range-block').toggleClass('fullscreen-vol'); //Add class to volume control for full screen mode

                    if ( $('.player').hasClass('fullscreenon') ) {
                        prevFull = $('.fullscreenBtn').html();

                                    //change full screen button to full screen exit button
                                    $('.fullscreenBtn').html('<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><g class="ytp-fullscreen-button-corner-2"><path style="fill: #fff;" d="m 14,14 -4,0 0,2 6,0 0,-6 -2,0 0,4 0,0 z"></path></g><g><path style="fill: #fff;" d="m 22,14 0,-4 -2,0 0,6 6,0 0,-2 -4,0 0,0 z"></path></g><g><path style="fill: #fff;" d="m 20,26 2,0 0,-4 4,0 0,-2 -6,0 0,6 0,0 z"></path></g><g><path style="fill: #fff;" d="m 10,22 4,0 0,4 2,0 0,-6 -6,0 0,2 0,0 z"></path></g></svg>');

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
