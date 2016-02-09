ConfigurationLoader = function (configLoadedListener) {
    if (arguments.callee.instance) {
        var instance = arguments.callee.instance;
        if (configLoadedListener) {
            instance.configLoadedListener = configLoadedListener;
        }
        return instance;
    }
    arguments.callee.instance = this;
    if (configLoadedListener) {
        this.configLoadedListener = configLoadedListener;
    }

    this.configuration = new Configuration();
    this.forceMediaProvider = null;
    this.calleeLetterCase = null;
    this.msrpCallee = null;
    this.subscribeEvent = null;
    this.loadBalancerUrl = null;
    this.jsonpSuccess = false;
    this.ringSound = "sounds/CALL_OUT.mp3";
    this.busySound = "sounds/BUSY.mp3";
    this.registerSound = "sounds/REGISTER.mp3";
    this.finishSound = "sounds/HANGUP.mp3";
    this.messageSound = "sounds/MESSAGE.mp3";
    this.hangupLT = 1;
    this.answerLT = 1;
    this.callLT = 2;
    this.disableUnknownMsgFiltering = false;
    this.disableLocalRing = false;
    this.suppressRingOnActiveAudioStream = false;
    this.reoffersEnabled = false;

    $.ajax({
        type: "GET",
        url: "../../flashphoner.xml",
        dataType: "xml",
        success: this.parseFlashphonerXml,
        context: this
    });
};

ConfigurationLoader.getInstance = function(configLoadedListener) {
    return new ConfigurationLoader(configLoadedListener);
};

ConfigurationLoader.prototype = {

    getText: function (el){
        return el.textContent || el.text || "";
    },

    parseFlashphonerXml: function (xml) {
        var me = this;
        var urlWSServer= $(xml).find("url_ws_server");
        if (urlWSServer.length <= 0) {
            trace("Can not find 'url_ws_server' in flashphoner.xml", 0);
            return;
        } else {
            var _urlWSServer = this.getText(urlWSServer[0]);

            if (_urlWSServer.substring(_urlWSServer.lastIndexOf("/")+1,_urlWSServer.lastIndexOf(":")) == "") {
                var wsProto = _urlWSServer.substring(0,_urlWSServer.lastIndexOf(":"));
                var wsPort = _urlWSServer.substring(_urlWSServer.lastIndexOf("/")+1);
                _urlWSServer = wsProto + window.location.hostname + wsPort;
                console.log("Empty addr urlWsServer, set to current location.hostname : " +_urlWSServer);
            }

            if (window.location.protocol == "https:") {
                _urlWSServer = _urlWSServer.replace("ws://","wss://").replace(":8080",":8443");
                console.log("Secure connection, url was changed to: "+_urlWSServer);
            }

            this.configuration.urlWsServer = _urlWSServer;
        }

        var urlFlashServer = $(xml).find("url_flash_server");
        if (urlFlashServer.length <= 0) {
            trace("Can not find 'url_flash_server' in flashphoner.xml", 0);
            return;
        } else {
           var _urlFlashServer = this.getText(urlFlashServer[0]);
            if (_urlFlashServer.substring(_urlFlashServer.lastIndexOf("/")+1,_urlFlashServer.lastIndexOf(":")) == "") {
                var flashProto = _urlFlashServer.substring(0,_urlFlashServer.lastIndexOf(":"));
                var flashPort = _urlFlashServer.substring(_urlFlashServer.lastIndexOf("/")+1);
                _urlFlashServer = flashProto + window.location.hostname + flashPort;
                console.log("Empty addr urlFlashServer, set to current location.hostname : " +_urlFlashServer);
            }
            this.configuration.urlFlashServer = _urlFlashServer;
        }

        var sipRegisterRequired = $(xml).find("register_required");
        if (sipRegisterRequired.length > 0) {
            this.configuration.sipRegisterRequired = (this.getText(sipRegisterRequired[0]) === "true");
        }

        var useDTLS = $(xml).find("use_dtls");
        if (useDTLS.length > 0) {
            this.configuration.useDTLS = (this.getText(useDTLS[0]) === "true");
        }

        var xcapUrl = $(xml).find("xcap_url");
        if (xcapUrl.length > 0) {
            if (this.getText(xcapUrl[0]).length) {
                this.xcapUrl = this.getText(xcapUrl[0]);
            }
        }

        var contactParams = $(xml).find("contact_params");
        if (contactParams.length > 0) {
            if (this.getText(contactParams[0]).length) {
                this.configuration.sipContactParams = this.getText(contactParams[0]);
            }
        }

        //stun server address
        var stunServer = $(xml).find("stun_server");
        if (stunServer.length > 0) {
            this.configuration.stunServer = stunServer.text();
            console.log("Stun server: " + this.stunServer);
        }

        var stripCodecs = $(xml).find("strip_codecs");
        if (stripCodecs.length > 0) {
            var tempCodecs = this.getText(stripCodecs[0]).split(",");
            for (i = 0; i < tempCodecs.length; i++) {
                if (tempCodecs[i].length) this.configuration.stripCodecs[i] = tempCodecs[i];
                console.log("Codec " + tempCodecs[i] + " will be removed from SDP!");
            }
        }

        var imdnEnabled = $(xml).find("imdn_enabled");
        if (imdnEnabled.length > 0) {
            if (this.getText(imdnEnabled[0]).length) {
                this.configuration.imdnEnabled = Boolean(this.getText(imdnEnabled[0]));
            }
        }

        //Message content type by default "text/plain", can be "message/cpim"
        var msgContentType = $(xml).find("msg_content_type");
        if (msgContentType.length > 0) {
            this.configuration.msgContentType = msgContentType.text();
            console.log("Message content type: " + this.configuration.msgContentType);
        }

        var pushLogEnabled = $(xml).find("push_log");
        if (pushLogEnabled.length) {
            this.configuration.pushLogEnabled = pushLogEnabled.text();
        }

        //EXAMPLE CONFIGURATION
        var forceMediaProvider = $(xml).find("force_media_provider");
        if (forceMediaProvider.length) {
            this.forceMediaProvider = forceMediaProvider.text();
        }

        var msrpCallee = $(xml).find("msrp_callee");
        if (msrpCallee.length > 0) {
            if (this.getText(msrpCallee[0]).length) {
                this.msrpCallee = this.getText(msrpCallee[0]);
            }
        }

        var subscribeEvent = $(xml).find("subscribe_event");
        if (subscribeEvent.length > 0) {
            if (this.getText(subscribeEvent[0]).length) {
                this.subscribeEvent = this.getText(subscribeEvent[0]);
            }
        }

        var disableLocalRing = $(xml).find("disable_local_ring");
        if (disableLocalRing.length > 0) {
            if (this.getText(disableLocalRing[0]).length) {
                this.disableLocalRing = Boolean(this.getText(disableLocalRing[0]));
            }
        }
        console.log("disableLocalRing: "+this.disableLocalRing);

        var loadBalancerUrl = $(xml).find("load_balancer_url");
        if (loadBalancerUrl.length > 0) {
            this.loadBalancerUrl = this.getText(loadBalancerUrl[0]);
        }

        var videoWidth = $(xml).find("video_width");
        if (videoWidth.length > 0) {
            this.configuration.videoWidth = this.getText(videoWidth[0]);
        }
        var videoHeight = $(xml).find("video_height");
        if (videoHeight.length > 0) {
            this.configuration.videoHeight = this.getText(videoHeight[0]);
        }

        var forceResolution = $(xml).find("force_resolution");
        if (forceResolution.length > 0) {
            if (this.getText(forceResolution[0]).length) {
                this.configuration.forceResolution = Boolean(this.getText(forceResolution[0]));
            }
        }

        var audioReliable = $(xml).find("audio_reliable");
        if (audioReliable.length > 0) {
            this.configuration.audioReliable = this.getText(audioReliable[0]);
        }
        var videoReliable = $(xml).find("video_reliable");
        if (videoReliable.length > 0) {
            this.configuration.videoReliable = this.getText(videoReliable[0]);
        }

        var flashBufferTime = $(xml).find("flash_buffer_time");
        if (flashBufferTime.length > 0) {
            this.configuration.flashBufferTime = this.getText(flashBufferTime[0]);
        }

        var calleeLetterCase = $(xml).find("callee_letter_case");
        if (calleeLetterCase.length > 0) {
            if (this.getText(calleeLetterCase[0]).length) {
                this.calleeLetterCase = this.getText(calleeLetterCase[0]);
            }
        }


        //Sounds for WebRTC implementation
        var ringSound = $(xml).find("ring_sound");
        if (ringSound.length > 0) {
            if (this.getText(ringSound[0]).length) {
                this.ringSound = this.getText(ringSound[0]);
            }
        }
        var busySound = $(xml).find("busy_sound");
        if (busySound.length > 0) {
            if (this.getText(busySound[0]).length) {
                this.busySound = this.getText(busySound[0]);
            }
        }
        var registerSound = $(xml).find("register_sound");
        if (registerSound.length > 0) {
            if (this.getText(registerSound[0]).length) {
                this.registerSound = this.getText(registerSound[0]);
            }
        }
        var messageSound = $(xml).find("message_sound");
        if (messageSound.length > 0) {
            if (this.getText(messageSound[0]).length) {
                this.messageSound = this.getText(messageSound[0]);
            }
        }
        var finishSound = $(xml).find("finish_sound");
        if (finishSound.length > 0) {
            if (this.getText(finishSound[0]).length) {
                this.finishSound = this.getText(finishSound[0]);
            }
        }

        //call duration in seconds when Load Tool is enabled, callee will hangup after this timeout.
        // Hangup will not occur in case of 0 timeout.
        var hangupLT = $(xml).find("hangupLT");
        if (hangupLT.length > 0) {
            this.hangupLT = this.getText(hangupLT[0]);
        }

        //Answer timeout when Load Tool is enabled, if greater than 0 callee answer the call after specified amount of seconds
        var answerLT = $(xml).find("answerLT");
        if (answerLT.length > 0) {
            this.answerLT = this.getText(answerLT[0]);
        }

        //Recall timeout when Load Tool is enabled, specifies how long caller must wait after hangup to place another call.
        var callLT = $(xml).find("callLT");
        if (callLT.length > 0) {
            this.callLT = this.getText(callLT[0]);
        }

        /**
         * AudioPlayer incoming buffer, in samples. This is size of data js audio node will request.
         * Valid values are:
         * 256, 512, 1024, 2048, 4096, 8192, or 16384.
         */
        var incomingAudioBufferLength = $(xml).find("incoming_audio_buffer_length");
        if (incomingAudioBufferLength.length > 0) {
            this.configuration.incomingAudioBufferLength = this.getText(incomingAudioBufferLength[0]);
        }


        /**
         * AudioPlayer decoded buffer size in bytes. All decoded data will be stored in this buffer before playing
         * It is a good idea to keep this above 4 seconds
         * 1 second buffer = 44100 * 4 = 176400
         */
        var decodedBufferSize = $(xml).find("decoded_audio_buffer_size");
        if (decodedBufferSize.length > 0) {
            this.configuration.decodedBufferSize = this.getText(decodedBufferSize[0]);
        }

        /**
         * Indicates amount of audio data in milliseconds that we should buffer before playing.
         * This must be larger than decoded_audio_buffer_size, otherwise flushing buffered data into decodedBuffer
         * will result in decodedBuffer overflow.
         * Example:
         * decoded_audio_buffer_size = 176400 (1000ms)
         * audio_buffer_wait_for = 500ms
         */
        var audioBufferWaitFor = $(xml).find("audio_buffer_wait_for");
        if (audioBufferWaitFor.length > 0) {
            this.configuration.audioBufferWaitFor = this.getText(audioBufferWaitFor[0]);
        }

        var disableUnknownMsgFiltering = $(xml).find("disable_unknown_msg_filtering");
        if (disableUnknownMsgFiltering.length > 0) {
            this.disableUnknownMsgFiltering = (this.getText(disableUnknownMsgFiltering[0]) === "true");
        }

        var suppressRingOnActiveAudioStream = $(xml).find("suppress_ring_on_active_audio_stream");
        if (suppressRingOnActiveAudioStream.length > 0) {
            this.suppressRingOnActiveAudioStream = (this.getText(suppressRingOnActiveAudioStream[0]) === "true");
        }

        var reoffersEnabled = $(xml).find("reoffers_enabled");
        if (reoffersEnabled.length > 0) {
            this.reoffersEnabled = (this.getText(reoffersEnabled[0]) === "true");
        }

        /**
         * Flash Camera Settings
         */
        var flashCameraFPS = $(xml).find("flash_camera_fps");
        if (flashCameraFPS.length > 0) {
            this.configuration.flashCameraFPS = this.getText(flashCameraFPS[0]);
        }

        var flashCameraKeepRatio = $(xml).find("flash_camera_keep_ratio");
        if (flashCameraKeepRatio.length > 0) {
            this.configuration.flashCameraKeepRatio = (this.getText(flashCameraKeepRatio[0]) === "true");
        }

        var flashCameraKeyFrameInterval = $(xml).find("flash_camera_keyframe_interval");
        if (flashCameraKeyFrameInterval.length > 0) {
            this.configuration.flashCameraKeyFrameInterval = this.getText(flashCameraKeyFrameInterval[0]);
        }

        var flashCameraQuality = $(xml).find("flash_camera_quality");
        if (flashCameraQuality.length > 0) {
            this.configuration.flashCameraQuality = this.getText(flashCameraQuality[0]);
        }

        var flashCameraMotionLevel = $(xml).find("flash_camera_motion_level");
        if (flashCameraMotionLevel.length > 0) {
            this.configuration.flashCameraMotionLevel = this.getText(flashCameraMotionLevel[0]);
        }

        var flashCameraBandwidth = $(xml).find("flash_camera_bandwidth");
        if (flashCameraBandwidth.length > 0) {
            this.configuration.flashCameraBandwidth = this.getText(flashCameraBandwidth[0]);
        }

        //get load balancer url if load balancing enabled
        if (me.loadBalancerUrl != null) {
            trace("Configuration - Retrieve server url from load balancer");

            /*
             * this timeout is a workaround to catch errors from ajax request
             * Unfortunately jQuery do not support error callback in case of JSONP
             */
            setTimeout(function () {
                //check status of ajax request
                if (!me.jsonpSuccess) {
                    trace("Configuration - Error occurred while retrieving load balancer data, please check your load balancer url " +
                        me.loadBalancerUrl);
                    me.configLoadedListener.apply(this, [me.configuration]);
                }
            }, 10000);
            var loadBalancerData = null;
            $.ajax({
                type: "GET",
                url: me.loadBalancerUrl,
                dataType: "jsonp",
                data: loadBalancerData,
                success: function (loadBalancerData) {
                    me.configuration.urlWsServer = "ws://"+loadBalancerData.server + ":" + loadBalancerData.ws;
                    //use for wss
                    //me.configuration.urlWsServer = "wss://"+loadBalancerData.server + ":" + loadBalancerData.wss;
                    me.configuration.urlFlashServer = "rtmfp://"+ loadBalancerData.server + ":" + loadBalancerData.flash;
                    me.jsonpSuccess = true;
                    trace("Configuration - Connection data from load balancer: "
                        + "urlWsServer " + loadBalancerData.urlWsServer
                        + ", urlFlashServer " + loadBalancerData.urlFlashServer);
                    me.configLoadedListener.apply(this, [me.configuration]);
                }
            });
        } else {
            me.configLoadedListener.apply(this, [me.configuration]);
        }
    }

};
