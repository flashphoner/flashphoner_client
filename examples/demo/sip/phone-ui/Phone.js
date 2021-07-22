var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var CALL_STATUS = Flashphoner.constants.CALL_STATUS;
var Browser = Flashphoner.Browser;

var Phone = function () {
    this.flashphonerListener = null;
    this.currentCall = null;
    this.session = null;
    this.holdedCall = null;
    this.incomingCall = false;
    this.localVideo = document.getElementById("localVideo");
    this.remoteVideo = document.getElementById("remoteVideo");
    this.logs = "";
    this.intervalId = -1;
};

Phone.prototype.init = function () {
    this.flashphonerListener = new DefaultListener();
};

Phone.prototype.connect = function () {
    if (Browser.isSafariWebRTC() && Flashphoner.getMediaProviders()[0] === "WebRTC") {
        Flashphoner.playFirstVideo(localVideo, true);
        Flashphoner.playFirstVideo(remoteVideo, false);
    }
    var me = this;
    if ($("#outbound_proxy").val() == "") {
        $("#outbound_proxy").val($("#domain").val());
    }

    var url = setURL();

    this.sipOptions = {};
    this.sipOptions.login = $('#sipLogin').val();
    this.sipOptions.password = $('#sipPassword').val();
    this.sipOptions.authenticationName = $('#sipAuthenticationName').val();
    this.sipOptions.domain = $('#sipDomain').val();
    this.sipOptions.outboundProxy = $('#sipOutboundProxy').val();
    this.sipOptions.port = $('#sipPort').val();
    this.sipOptions.useProxy = true;
    this.sipOptions.registerRequired = true;

    var connectionOptions = {
        urlServer: url,
        sipOptions: this.sipOptions
    };


    initSounds();
    Flashphoner.createSession(connectionOptions).on(SESSION_STATUS.ESTABLISHED, function(session){
        me.session = session;
        me.connectionStatusListener(SESSION_STATUS.ESTABLISHED);
    }).on(SESSION_STATUS.REGISTERED, function(session){
        me.registrationStatusListener(SESSION_STATUS.REGISTERED);
    }).on(SESSION_STATUS.DISCONNECTED, function(){
        me.connectionStatusListener(SESSION_STATUS.DISCONNECTED);
    }).on(SESSION_STATUS.FAILED, function(){
        me.connectionStatusListener(SESSION_STATUS.FAILED);
    }).on(SESSION_STATUS.INCOMING_CALL, function(call){
        call.on(CALL_STATUS.RING, function(){
            me.callStatusListener(call);
        }).on(CALL_STATUS.ESTABLISHED, function(){
            me.callStatusListener(call);
        }).on(CALL_STATUS.HOLD, function() {
            me.callStatusListener(call);
        }).on(CALL_STATUS.FINISH, function(){
            me.callStatusListener(call);
            me.incomingCall = false;
        }).on(CALL_STATUS.FAILED, function(){
            me.callStatusListener(call);
            me.incomingCall = false;
        });
        me.onCallListener(call);
    });

        trace("Phone - connecting");
};

Phone.prototype.disconnect = function () {
    trace("Phone - disconnect");
    this.session.disconnect();
};

Phone.prototype.cancel = function () {
    if (this.currentCall) {
        this.hangup(this.currentCall);
    }
};

Phone.prototype.call = function (callee, hasVideo) {
    var me = this;
    trace("Phone - call " + callee);

    var constraints = {
        audio: true,
        video: hasVideo
    };

    var outCall = this.session.createCall({
        callee: callee,
        visibleName: this.sipOptions.login,
        localVideoDisplay: this.localVideo,
        remoteVideoDisplay: this.remoteVideo,
        constraints: constraints
    }).on(CALL_STATUS.RING, function(call){
        me.callStatusListener(call);
    }).on(CALL_STATUS.ESTABLISHED, function(call){
        me.callStatusListener(call);
    }).on(CALL_STATUS.HOLD, function(call){
        me.callStatusListener(call);
    }).on(CALL_STATUS.FINISH, function(call){
        me.callStatusListener(call);
    }).on(CALL_STATUS.FAILED, function(call){
        me.callStatusListener(call);
    });

    outCall.call();

    this.currentCall = outCall;

};

Phone.prototype.changeVideoState = function (call, enable) {
    trace("Phone - changeVideoState");
    console.warn("It's not implemented yet");
};

Phone.prototype.sendMessage = function (message) {
    trace("Phone - sendMessage " + message.to + " body: " + message.body);
    console.warn("It's not implemented yet");
};

Phone.prototype.answer = function () {
    trace("Phone - answer " + this.currentCall.id());
    this.flashphonerListener.onAnswer(this.currentCall.id());
    this.currentCall.answer({
        localVideoDisplay: this.localVideo,
        remoteVideoDisplay: this.remoteVideo
    });
};

Phone.prototype.hangup = function () {
    trace("Phone - hangup " + this.currentCall.id() + " status " + this.currentCall.status());
    this.hideFlashAccess();
    if (this.currentCall.status() == CALL_STATUS.PENDING) {
        this.callStatusListener(this.currentCall);
    } else {
        this.currentCall.hangup();
    }
    this.flashphonerListener.onHangup();
};

Phone.prototype.sendDTMF = function (dtmf) {
    trace("Phone - sendDTMF callId: " + this.currentCall.id() + " dtmf: " + dtmf);
    this.currentCall.sendDTMF(dtmf);
};

Phone.prototype.hold = function () {
    trace("Phone - hold callId: " + this.currentCall.id());
    this.currentCall.hold();
};

Phone.prototype.holdForTransfer = function () {
    trace("Phone - hold callId: " + this.currentCall.id());
    this.currentCall.holdForTransfer();
};

Phone.prototype.unhold = function () {
    trace("Phone - hold callId: " + this.currentCall.id());
    this.currentCall.unhold();
};

Phone.prototype.transfer = function (target) {
    trace("Phone - transfer callId: " + this.currentCall.id() + " target: " + target);
    this.currentCall.transfer(target);
};

Phone.prototype.getStatistics = function() {
    this.currentCall.getStats(function(statistics){
        trace("Statistics: " +  JSON.stringify(statistics), null, ' ');
    });
};

Phone.prototype.hideFlashAccess = function () {
    if ($(".b-video").hasClass("flash_access")) {
        $(".b-video").removeClass("flash_access").resizable("enable");
        $(".b-video__flash").removeClass("access");
        $(".b-video__flash_footer").removeClass("open");
    }
};

/* ------------------ LISTENERS ----------------- */

Phone.prototype.connectionStatusListener = function (status) {
    trace("Phone - Connection status " + status);
    this.connectionStatus = status;
    if (status == SESSION_STATUS.DISCONNECTED ||
        status == SESSION_STATUS.FAILED) {
        if (this.currentCall) {
            this.callStatusListener(CALL_STATUS.FINISH);
        }
        this.currentCall = null;
        this.holdedCall = null;
        this.session = null;
        $(".b-display__header__sip_login").html("");
        $(".b-display__header__login").html("Log in");
        $(".b-volume").removeClass("open");
    } else if (status == SESSION_STATUS.ESTABLISHED) {
        $(".b-display__header__sip_login").html(this.sipOptions.login);
        $(".b-display__header__login").html("Log out");
    }
};

Phone.prototype.registrationStatusListener = function (status) {
    this.connectionStatus = status;
    trace("Phone - registrationStatusListener " + status);
    if (status == SESSION_STATUS.FAILED) {
        this.viewMessage("Register fail, please check your SIP account details.");
        this.disconnect();
    } else if (status == SESSION_STATUS.UNREGISTERED) {
        this.viewMessage("Unregistered from sip server");
        this.disconnect();
    } else if (status == SESSION_STATUS.AUTHENTICATION_FAIL) {
        this.viewMessage("Authentication failed, please check your SIP account details.");
        this.disconnect();
    } else {
        SoundControl.getInstance().playSound("REGISTER");
        this.flashphonerListener.onRegistered();
    }
};

Phone.prototype.onCallListener = function (call_) {
    var call = call_;
    trace("Phone - onCallListener " + call.id() + " call.status: " + call.status());
    if (this.currentCall != null) {
        this.holdedCall = this.currentCall;
        this.currentCall = call;
        trace("Phone - It seems like a hold: holdedCall: " + this.holdedCall.id() + " currentCall: " + this.currentCall.id());
    } else {
        this.incomingCall = true;
        this.currentCall = call;
        if (this.incomingCall == true) {
            this.flashphonerListener.onIncomingCall(call.id());
        }
        trace("Phone - It seems like a new call currentCall: " + this.currentCall.id() + " status: " + this.currentCall.status());

        $("body").addClass("voice_call__inc");								// add incoming call class
        $(".b-nav").addClass("close");										// hide black buttons and do 'answer call' buttons visible
        $(".b-nav__inc, .call__inc__dial").addClass("open");
        $(".call__inc__dial").addClass("open").text(call.caller());
    }
};

Phone.prototype.callStatusListener = function (call_) {
    var call = call_;
    var status = call.status();
    trace("Phone - callStatusListener call id: " + call.id() + " status: " + status);
    if (this.currentCall.id() == call.id()) {
        if (status == CALL_STATUS.FAILED) {
            trace("Phone - ... Call is failed...");
            $(".call__out__dial").text("calling to");					// return to initial view of outgoing call (view without number or login name)
            $("body").removeAttr("class");								// remove all classes from the body
            $(".b-mike, .call__out__dial, .call__inc__dial, .voice_call__call, .voice_call__play, .voice_call__call__pause, .b-transfer, .b-video, .b-video__video, .b-nav__inc, .b-alert").removeClass("open"); // close set of blocks which are hidden by default
            $(".b-display__bottom__number>span, .voice_call__call__play, .voice_call__transfer, .b-nav").removeClass("close");	// open a set of blocks which might be hidden, but the blocks are visible by default
            $(".b-alert").text("").removeClass("video_alert");	// initial view of video alert
            this.currentCall = null;

        } else if (status == CALL_STATUS.FINISH || status == CALL_STATUS.PENDING) {
            trace("Phone - ... Call is finished...");
            SoundControl.getInstance().stopSound("RING");
            if (this.holdedCall != null) {
                trace("Phone - ... Finish holded call...");
                this.currentCall = this.holdedCall;
                this.holdedCall = null;
            } else if (this.isCurrentCall(call)) {
                trace("Phone - ... Finish current call...");
                this.currentCall = null;
                this.flashphonerListener.onRemoveCall();
                SoundControl.getInstance().playSound("FINISH");

                $(".voice_call__transfer").removeClass("tr_call__pause");	// remove additional style of the transfer button
                $("#transfer").val("");										// remove value in the transfer field if the value is present
                $(".b-nav__cancel_call span").text("Cancel");				// return to initial state of button
                $(".interlocutor2").text("");						// clear login name of callee in the call window
                $(".voice_call__stop").addClass("open");		// do visible hold button

                this.cancel();
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                $(".b-time").html("<span class='b-min'>00</span>:<span class='b-sec'>00</span>");	// return timer to initial state

                $(".b-volume").removeClass("open");
                $(".b-send_video").removeClass("open");
            }
        } else if (status == CALL_STATUS.HOLD) {
            trace('Phone - ...Call on hold...');
            if (this.incomingCall) {
                $(".voice_call__call__pause").text(call.caller());
            } else {
                $(".voice_call__call__pause").text(call.callee());
            }
            $(".voice_call__call__pause").addClass("open");	// do visible button of unhold and call window with hold button
            $(".voice_call__call__play").addClass("close");		// hide call view
            $(".b-video").removeClass("open");					// hide video view (if exists)
            $(".voice_call__transfer").addClass("tr_call__pause");	// add class for transfer button to know point of return
        } else if (status == CALL_STATUS.ESTABLISHED) {
            trace('Phone - ...Talking...');
            $(".b-alert, .b-nav__inc, .call__inc__dial").removeClass("open"); // hide a set of buttons and buttons allow/deny
            $(".b-nav").removeClass("close");	// re-open default navigation buttons (i.e. if the buttons was hidden while an incoming call)
            if ($("body").hasClass("video")) {
                $(".b-video__video").addClass("open");
                $(".b-video, .hook").addClass("open");
            } else {
                $(".hook").addClass("open");
            }

            $(".b-nav__cancel_call span").text("Hangup");	// change text of "Cancel" button
            if ($("body").hasClass("voice_call__inc")) {	// if the call is incoming
                $(".voice_call__call").addClass("open");	// open talk view
                if (this.incomingCall) {
                    $(".interlocutor2").text(call.caller());
                } else {
                    $(".interlocutor2").text(call.callee());
                }
            } else {
                $(".call__out__dial").removeClass("open");	// hide call view
                $(".voice_call__call").addClass("open");	// open talk view
                $(".b-nav__cancel_call span").text("Hangup");	// change text for Hangup button
                $(".interlocutor2").text($(".b-numbers").val());	// set number of callee in the talk view
                $(this).removeClass("open");														// hide 'Answer' button
            }

            this.startTimer();

            $(".voice_call__transfer").removeClass("close");
            $(".voice_call__stop").addClass("open");		// do visible hold button
            $(".voice_call__play").removeClass("open");					// hide unhold button
            $(".voice_call__call__pause").removeClass("open");	// hide hold view and transfer view (if the views was opened)
            $(".voice_call__call__play").removeClass("close");				// open talk view
            $(".voice_call__transfer").removeClass("tr_call__pause");		// remove class from the transfer button (if the class exists, then after transfer cancellation)

            SoundControl.getInstance().stopSound("RING");
        } else if (status == CALL_STATUS.RING) {
            trace('Phone - ...Ringing...');
            if (this.isRingSoundAllowed()) {
                SoundControl.getInstance().playSound("RING");
            }
        } else if (status == CALL_STATUS.RING_MEDIA) {
            trace('Phone - ...Ringing...');
            SoundControl.getInstance().stopSound("RING");
        } else if (status == CALL_STATUS.BUSY) {
            SoundControl.getInstance().playSound("BUSY");
        } else if (status == CALL_STATUS.SESSION_PROGRESS) {
            trace('Phone - ...Call in Progress...');
            SoundControl.getInstance().stopSound("RING");
        }
    } else {
        if (this.holdedCall.id() == call.id()) {
            if (call.status() == CALL_STATUS.FINISH) {
                trace("It seems we received FINISH status on holdedCall. Just do null the holdedCall.");
                this.holdedCall = null;
            }
        }
    }
};

Phone.prototype.onTransferStatusListener = function (event) {
    trace("Phone - onTransferStatusListener status:" + event.status + " incoming:" + event.incoming);
};

Phone.prototype.onTransferEventListener = function (event) {
    trace("Phone - onTransferEventListener status:" + event.status + " incoming:" + event.incoming);
};

Phone.prototype.cancel = function () {
    if (this.currentCall) {
        this.hangup(this.currentCall);
    } else {
        $(".call__out__dial").text("calling to");					// return to initial view of outgoing call (view without number or login name)
        $("body").removeAttr("class");								// remove all classes from the body
        $(".b-mike, .call__out__dial, .call__inc__dial, .voice_call__call, .voice_call__play, .voice_call__call__pause, .b-transfer, .b-video, .b-video__video, .b-nav__inc, .b-alert").removeClass("open"); // close set of blocks which are hidden by default
        $(".b-display__bottom__number>span, .voice_call__call__play, .voice_call__transfer, .b-nav").removeClass("close");	// open a set of blocks which might be hidden, but the blocks are visible by default
        $(".b-alert").text("").removeClass("video_alert");	// initial view of video alert
    }
};


Phone.prototype.parseMsn = function (fsService, mcn) {
    trace("Phone - parseMcn: " + mcn);
    var caw = fsService.find(mcn);
    var ret = null;
    if (!!caw) {
        var cawData = caw.find(mcn + "-data");
        if (!!cawData) {
            var sender = $(cawData).attr("sender");
            if (!!sender) {
                trace("Phone - Missed call: " + sender);
                ret = "Missed call from " + sender;
            }
        }
    }
    return ret;
};

Phone.prototype.recordingStatusListener = function (recordReport) {
    trace("Phone - recordingStatusListener: " + recordReport.report.mixedFilename);
};

Phone.prototype.onDataEventListener = function (event) {
    trace("Phone - onDataEventListener; received data " + event.data);
};

Phone.prototype.dataStatusEventListener = function (event) {
    trace("Phone - DataStatusEventListener; received status " + event.status);
};

Phone.prototype.viewMessage = function (message) {
    trace(message);
};


Phone.prototype.openVideoView = function () {
    var me = this;
    //var mediaProvider = me.getMediaProvider();

    if ($(".b-video").hasClass("open")) {			// open/close main video view and change class video for body
        $(".b-video").removeClass("open").removeAttr("id");
        $(".b-video").removeAttr('style');
        $("body").removeClass("video");
    } else {
        $("#active").removeAttr("id");
        $(".b-video").addClass("open").attr("id", "active");
        $("body").addClass("video");
    }
    if ($(".voice_call__call").hasClass("open")) {
        $(".b-video__video").addClass("open");
    }

};

// talk timer
Phone.prototype.startTimer = function () {
    var me = this;
    if (!me.timerInterval) {
        me.start = 0;
        me.min = 0;
        me.timerInterval = setInterval(function () {
            me.start++;
            if (me.start > 59) {
                me.start = 0;
                me.min++;
                if (me.min < 10) {
                    $(".b-min").html("0" + me.min);
                } else $(".b-min").html(me.min);
            }
            if (me.start < 10) {
                $(".b-sec").html("0" + me.start);
            } else $(".b-sec").html(me.start);
        }, 1000);
    }
};

Phone.prototype.viewMessage = function (message) {
    $(".b-alert__error__message").html("<p>" + message + "</p>");
    $(".b-alert__error").addClass("open");
};


/* ------------- Additional interface functions --------- */
Phone.prototype.isCurrentCall = function (call) {
    return this.currentCall != null && this.currentCall.id() == call.id();
};

Phone.prototype.isRingSoundAllowed = function () {
    try {
        if (ConfigurationLoader.getInstance().suppressRingOnActiveAudioStream) {
            trace("Phone - isRingSoundAllowed false");
            return false;
        }
    } catch (error) {
    }
    trace("Phone - isRingSoundAllowed true");
    return true;
};

Phone.prototype.applyCalleeLetterCase = function (callee) {
    if (callee) {
        if ("uppercase" == ConfigurationLoader.getInstance().calleeLetterCase) {
            return callee.toUpperCase();
        }
        if ("lowercase" == ConfigurationLoader.getInstance().calleeLetterCase) {
            return callee.toLowerCase();
        }
    }
    return callee;
};


$(document).ready(function () {

    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    var phone = new Phone();

    phone.init();

    $(".b-send_video").on("click", function () {
        if ($(this).text() == "Send video") {
            phone.changeVideoState(phone.currentCall, true);
            $(this).text("Stop video");
        } else {
            phone.changeVideoState(phone.currentCall, false);
            $(this).text("Send video");
        }
    });

    // open/close authentication view
    $(".b-display__header__login, .b-login__cancel").on("click", function () {
        if (phone.connectionStatus == SESSION_STATUS.ESTABLISHED || phone.connectionStatus == SESSION_STATUS.REGISTERED) {
            phone.disconnect();
        } else {
            $(".b-login").toggleClass("open");
            $("#active").removeAttr("id");
            $(".b-login").hasClass("open") ? $(".b-login").attr("id", "active") : $(".b-login").removeAttr("id");
        }
    });

    // authentication
    $(".b-login input[type='button']").on("click", function () {
        var emptyField;
        $(".b-login :input").not(':input[type=button]').each(function(){
            $("#"+$(this).attr('id')+'Label').css('color','');
            if(!$(this).val()) {
                emptyField = true;
                $("#"+$(this).attr('id')+'Label').css('color','red');
            }
        });
        if (emptyField) {return false};
        $(".b-display__header__login").html("Connecting");
        $(".b-login").removeClass("open").removeAttr("id");
        phone.connect();
    });

    // open/close microphone gain control
    $(".b-display__header__volume").on("click", function () {
        if (phone.currentCall) {
            $(".b-volume").hasClass("open") ? $(".b-volume").removeClass("open") : $(".b-volume").addClass("open");
        }
    });
    // open/close loudspeaker control
    $("#volume").slider({
        value: 60,
        orientation: "horizontal",
        range: "min",
        animate: true,
        slide: function (event, ui) {
            $(".volume-percent").html(ui.value + "%");
            phone.currentCall.setVolume(ui.value);
        }
    });
    // digital value of loudspeaker volume
    $(".volume-percent").html($("#volume").slider("value") + "%");

    // digital value of microphone gain
    $(".b-display__header__mike").on("click", function () {
        $(".b-mike").hasClass("open") ? $(".b-mike").removeClass("open") : $(".b-mike").addClass("open");
    });
    $("#mike").slider({
        value: 60,
        orientation: "horizontal",
        range: "min",
        animate: true,
        slide: function (event, ui) {
            $(".mike-percent").html(ui.value + "%");
        }
    });
    $(".mike-percent").html($("#volume").slider("value") + "%");

    // on click "Video" icon in the top menu
    $(".b-display__header__video").on("click", function () {
        phone.openVideoView();
    });
    // close video upon (Х) click
    $(".b-video__close").on("click", function (e) {
        $(".b-video").removeClass("open").removeAttr("id");
        $(".b-video").removeAttr('style');
        if ($(".b-video").hasClass("flash_access")) {
            phone.cancel();
        }
    });
    // change video view dimensions
    //$(".b-video, .b-login, .b-alert__error, .b-transfer").draggable();	// set video view draggable
    $(".b-video").resizable({
        minHeight: 240,
        minWidth: 320,
        aspectRatio: 4 / 3
    });

    // enter phone number
    $(".b-display__bottom__number>span").on("click", function () { // on click by 'Enter your number here'
        if (phone.connectionStatus == SESSION_STATUS.ESTABLISHED || phone.connectionStatus == SESSION_STATUS.REGISTERED) {
            $(this).addClass("close");
            $(".b-numbers__clear").addClass("open");
            $(".b-numbers").addClass("write").focus();
        }
    });
    $(document).keyup(function (event) {								// listening keyboard input
        if (($(".b-numbers").is(":focus")) && (event.keyCode == 8)) {	// if the focus on the number field and Backspace is pressed
            num = $(".b-numbers").val().length;						// check number of symbols in the field which remain after the symbol removing
            if (num == 0) {											// if the latest digit was removed then return to initial position
                $(".b-numbers__clear").removeClass("open");
                $(".b-numbers").removeClass("write");
                $(".b-display__bottom__number>span").removeClass("close");
            }
        }
    });
    $(".b-num td").on("click", function () {
        if (phone.connectionStatus == SESSION_STATUS.ESTABLISHED || phone.connectionStatus == SESSION_STATUS.REGISTERED) {
            if (!$(".b-numbers").hasClass("write")) {	// if the symbols are entered then remove the text block
                $(".b-display__bottom__number>span").addClass("close");
                $(".b-numbers").addClass("write").next().addClass("open");
            }
            if (phone.currentCall &&
                (CALL_STATUS.ESTABLISHED == phone.currentCall.status() || CALL_STATUS.HOLD == phone.currentCall.status())) {
                phone.sendDTMF($(this).text());
            } else {
                if ($(".b-transfer").hasClass("open")) {
                    $("#transfer").val($("#transfer").val() + $(this).text());
                } else if (!phone.currentCall) {
                    $(".b-numbers").val($(".b-numbers").val() + $(this).text());
                }
            }
        }
    });
    // removing of symbols
    $(".b-numbers__clear").on("click", function () {
        $(".b-numbers").val($(".b-numbers").val().substring(0, $(".b-numbers").val().length - 1));
        num = $(".b-numbers").val().length;
        if (num == 0) {	// if the latest digit was removed then return to initial position
            $(this).removeClass("open");
            $(".b-numbers").removeClass("write");
            $(".b-display__bottom__number>span").removeClass("close");
        }
    });

    // do video and audio call
    $(".b-nav__voice, .b-nav__video").on("click", function () {
        if ($(".b-numbers").hasClass("write")) {  // check if phone number was entered
            $("body").addClass("voice_call__out");
            $(".call__out__dial").addClass("open").html($(".call__out__dial").html() + " " + $(".b-numbers").val());	// open outgoing call block and writ here callee number
            if ($(this).hasClass("b-nav__video")) {
                $("body").addClass("video")
            } // if it is a video call then add the body class (for alert view)

            if ($("body").hasClass("video")) {
                phone.call($(".b-numbers").val(), true);
            } else {
                phone.call($(".b-numbers").val(), false);
            }

        }
    });

    // answer the incoming call
    $(".b-nav__answer, .b-nav__answer_video").on("click", function () {
        if ($(this).hasClass("b-nav__answer_video")) {	// if it is a video call then open view with video
            $("body").addClass("video");
        }
        if (phone.currentCall) {
            phone.answer(phone.currentCall, $(this).hasClass("b-nav__answer_video"));
        }
    });

    $(".voice_call__stop").on("click", function () {	// if the call is on hold
        if (phone.currentCall) {
            phone.hold(phone.currentCall);
            $(".voice_call__transfer").addClass("close");
            $(this).removeClass("open");					// hide the hold button
            $(".voice_call__play").addClass("open");	// do visible button of returning to the call and hold view
        }
    });

    $(".voice_call__play").on("click", function () {	// return to talk
        if (phone.currentCall) {
            phone.unhold(phone.currentCall);
            $(".voice_call__transfer").removeClass("close");
            $(this).removeClass("open");					// hide unhold button
            $(".voice_call__stop").addClass("open");						// do visible hold button
        }
    });

    $(".voice_call__transfer").on("click", function () {							// if the transfer button is pressed
        if (phone.currentCall) {
            phone.holdForTransfer(phone.currentCall);
            $(".voice_call__transfer").addClass("close");		// hide transfer button
            $(".b-transfer").addClass("open");				// open transfer view and hold view
            $(".b-transfer").attr("id", "active");
            $("#transfer").focus();														// set focus on the phone number field
        }
    });

    $(".b-transfer__cancel").on("click", function () {
        if (phone.currentCall) {
            phone.unhold(phone.currentCall);
            $(".voice_call__play").removeClass("open");					// hide unhold button
            $(".voice_call__stop").addClass("open");						// do visible hold button
        }
        $(".voice_call__transfer").removeClass("close");
        $(".b-transfer").removeClass("open").removeAttr("id");
    });

    $(".b-transfer__ok").on("click", function () {
        if (phone.currentCall) {
            phone.transfer($("#transfer").val());
        }
        $(".voice_call__transfer").removeClass("close");
        $(".b-transfer").removeClass("open").removeAttr("id");

    });

    $(".b-alert__close").on("click", function () {
        $(".b-alert__error").removeAttr("id");
        $(".b-alert__error").removeClass("open");
    });
    $(".b-video, .b-login, .b-alert__error").mousedown(function () { // if we pressed on a popup block then the block is bringing to forward
        $("#active").removeAttr("id");
        $(this).attr("id", "active");
    });

    $(".b-nav__cancel_call, .close, .b-nav__hangup").on("click", function () {	// return to initial view
        phone.cancel();
    });
});