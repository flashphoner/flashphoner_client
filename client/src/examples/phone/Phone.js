Phone.prototype.connect = function () {
    if ($("#outbound_proxy").val() == "") {
        $("#outbound_proxy").val($("#domain").val());
    }

    var connection = new Connection();
    connection.sipLogin = $('#sipLogin').val();
    connection.sipPassword = $('#sipPassword').val();
    connection.sipAuthenticationName = $('#sipAuthenticationName').val();
    connection.sipDomain = $('#sipDomain').val();
    connection.sipOutboundProxy = $('#sipOutboundProxy').val();
    connection.sipPort = $('#sipPort').val();
    connection.useProxy = true;
    connection.appKey = "defaultApp";

    for (var key in connection) {
        Flashphoner.getInstance().setCookie(key, connection[key]);
    }

    var result = Flashphoner.getInstance().connect(connection);
    if (result == 0) {
        trace("Phone - connecting");
    }
};

/* ------------------ LISTENERS ----------------- */

Phone.prototype.connectionStatusListener = function (event) {
    trace("Phone - Connection status " + event.status);
    this.connectionStatus = event.status;
    if (event.status == ConnectionStatus.Disconnected ||
        event.status == ConnectionStatus.Failed) {
        this.currentCall = null;
        this.holdedCall = null;
        $(".b-display__header__sip_login").html("");
        $(".b-display__header__login").html("Log in");
        $(".b-volume").removeClass("open");
    } else if (event.status == ConnectionStatus.Established) {
        $(".b-display__header__sip_login").html(event.sipLogin);
        $(".b-display__header__login").html("Log out");
    }
};

Phone.prototype.registrationStatusListener = function (event) {
    var status = event.status;
    var sipObject = event.sipMessageRaw;
    trace("Phone - registrationStatusListener " + status);
    if (status == RegistrationStatus.Failed) {
        this.viewMessage("Register fail, please check your SIP account details.");
        this.disconnect();
    } else if (status == RegistrationStatus.Unregistered) {
        this.viewMessage("Unregistered from sip server");
        this.disconnect();
    } else {
        SoundControl.getInstance().playSound("REGISTER");
        this.flashphonerListener.onRegistered();

        if (ConfigurationLoader.getInstance().subscribeEvent != null && ConfigurationLoader.getInstance().subscribeEvent.length != 0) {
            this.subscribe();
        }
        this.sendXcapRequest();
    }
};

Phone.prototype.onCallListener = function (event) {
    var call = event;
    trace("Phone - onCallListener " + call.callId + " call.mediaProvider: " + call.mediaProvider + " call.status: " + call.status);
    if (this.currentCall != null && !call.incoming) {
        this.holdedCall = this.currentCall;
        this.currentCall = call;
        trace("Phone - It seems like a hold: holdedCall: " + this.holdedCall.callId + " currentCall: " + this.currentCall.callId);
    } else {
        this.currentCall = call;
        if (call.incoming == true) {
            this.flashphonerListener.onIncomingCall(call.callId);
        }
        trace("Phone - It seems like a new call currentCall: " + this.currentCall.callId + " status: " + this.currentCall.status);

        $("body").addClass("voice_call__inc");								// add incoming call class
        $(".b-nav").addClass("close");										// hide black buttons and do 'answer call' buttons visible
        $(".b-nav__inc, .call__inc__dial").addClass("open");
        $(".call__inc__dial").addClass("open");
        if (call.incoming) {
            $(".call__inc__dial").text(call.caller);
        }
    }
};

Phone.prototype.callStatusListener = function (event) {
    var sipObject = event.sipMessageRaw;
    var call = event;
    trace("Phone - callStatusListener call id: " + call.callId + " status: " + call.status + " mediaProvider: " + call.mediaProvider);
    if (this.currentCall.callId == call.callId) {
        this.currentCall.status = call.status;
        if (call.status == CallStatus.FINISH) {
            trace("Phone - ... Call is finished...");
            if (this.holdedCall != null) {
                this.currentCall = this.holdedCall;
                this.holdedCall = null;
            } else if (this.isCurrentCall(call)) {
                this.currentCall = null;
                this.flashphonerListener.onRemoveCall();
                SoundControl.getInstance().stopSound("RING");
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
            }
        } else if (call.status == CallStatus.HOLD) {
            trace('Phone - ...Call on hold...');
            $(".voice_call__call__pause").addClass("open");	// do visible button of unhold and call window with hold button
            $(".voice_call__call__play").addClass("close");		// hide call view
            $(".b-video").removeClass("open");					// hide video view (if exists)
            $(".voice_call__transfer").addClass("tr_call__pause");	// add class for transfer button to know point of return
        } else if (call.status == CallStatus.ESTABLISHED) {
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
                if (call.incoming) {
                    $(".interlocutor2").text(call.caller);
                } else {
                    $(".interlocutor2").text(call.callee);
                }
            } else {
                $(".call__out__dial").removeClass("open");	// hide call view
                $(".voice_call__call").addClass("open");	// open talk view
                $(".b-nav__cancel_call span").text("Hangup");	// change text for Hangup button
                $(".interlocutor2").text($(".b-numbers").val());	// set number of callee in the talk view
                $(this).removeClass("open");														// hide 'Answer' button
            }
            this.startTimer();

            $(".voice_call__call__pause").removeClass("open");	// hide hold view and transfer view (if the views was opened)
            $(".voice_call__call__play").removeClass("close");				// open talk view
            $(".voice_call__transfer").removeClass("tr_call__pause");		// remove class from the transfer button (if the class exists, then after transfer cancellation)

            SoundControl.getInstance().stopSound("RING");
        } else if (call.status == CallStatus.RING) {
            trace('Phone - ...Ringing...');
            if (this.isRingSoundAllowed()) {
                SoundControl.getInstance().playSound("RING");
            }
        } else if (call.status == CallStatus.RING_MEDIA) {
            trace('Phone - ...Ringing...');
            SoundControl.getInstance().stopSound("RING");
        } else if (call.status == CallStatus.BUSY) {
            SoundControl.getInstance().playSound("BUSY");
        } else if (call.status == CallStatus.SESSION_PROGRESS) {
            trace('Phone - ...Call in Progress...');
            SoundControl.getInstance().stopSound("RING");
        }
    } else {
        if (this.holdedCall.callId == call.callId) {
            if (call.status == CallStatus.FINISH) {
                trace("It seems we received FINISH status on holdedCall. Just do null the holdedCall.");
                this.holdedCall = null;
            }
        }
    }
};

Phone.prototype.cancel = function(){
    $(".call__out__dial").text("calling to");					// return to initial view of outgoing call (view without number or login name)
    $("body").removeAttr("class");								// remove all classes from the body
    $(".b-mike, .call__out__dial, .call__inc__dial, .voice_call__call, .voice_call__play, .voice_call__call__pause, .b-transfer, .b-video, .b-video__video, .b-nav__inc, .b-alert").removeClass("open"); // close set of blocks which are hidden by default
    $(".b-display__bottom__number>span, .voice_call__call__play, .voice_call__transfer, .b-nav").removeClass("close");	// open a set of blocks which might be hidden, but the blocks are visible by default
    $(".b-alert").text("").removeClass("video_alert");	// initial view of video alert

    if ($(".b-video").hasClass("flash_access")) {
        $(".b-video").removeClass("flash_access").draggable("enable").resizable("enable");
        $(".b-video__flash").removeClass("access");
        $(".b-video__flash_footer").removeClass("open");
    }
};

Phone.prototype.messageStatusListener = function (event) {
    var message = event;
    trace("Phone - messageStatusListener id = " + message.id + " status = " + message.status);
    if (message.status == MessageStatus.ACCEPTED) {
        $('#message_' + message.id + ' .b-chat__message__text').css("color", "#000000");
    } else if (message.status == MessageStatus.FAILED ||
        message.status == MessageStatus.IMDN_ERROR ||
        message.status == MessageStatus.FAILED ||
        message.status == MessageStatus.IMDN_FORBIDDEN) {
        $('#message_' + message.id + ' .b-chat__message__text').css("color", "#d90000");
    } else if (message.status == MessageStatus.IMDN_DELIVERED) {
        $('#message_' + message.id + ' .b-chat__message__text').css("color", "#226900");
    }
};

Phone.prototype.onMessageListener = function (event) {
    var message = event;
    if (message.contentType == "application/im-iscomposing+xml" || message.contentType == "message/fsservice+xml") {
        trace("ignore message: " + message.body);
        if (ConfigurationLoader.getInstance().disableUnknownMsgFiltering) {
            message.body = escapeXmlTags(message.body);
            SoundControl.getInstance().playSound("MESSAGE");
        }
        return;
    }

    //convert body
    var body = this.convertMessageBody(message.body, message.contentType);
    if (body) {
        message.body = body;
        SoundControl.getInstance().playSound("MESSAGE");
    } else {
        trace("Not displaying message " + message.body + ", body is null after convert");
        if (ConfigurationLoader.getInstance().disableUnknownMsgFiltering) {
            message.body = escapeXmlTags(message.body);
            SoundControl.getInstance().playSound("MESSAGE");
        }
    }

    trace("Phone - onMessageListener id = " + message.id + " body = " + message.body);
    var tab = $('#tab_' + message.from);
    if (tab.length == 0) {
        this.chatCreateTab(message.from);
    } else {
        this.chatSelectTab(tab);
    }
    $('<div class="b-chat__message"><div class="b-chat__message__head"><span class="b-chat__message__time">' + new Date().toLocaleString() + '</span><span class="b-chat__message__author">' + message.from + '</span></div><div class="b-chat__message__text">' + message.body + '</div></div>').appendTo($(".b-chat_tab.open .mCSB_container"));
    this.chatScrollDown();
};

Phone.prototype.hasAccess = function (mediaProvider, hasVideo) {
    var hasAccess = Flashphoner.getInstance().hasAccess(mediaProvider, hasVideo);

    if (hasAccess) {
        if (MediaProvider.Flash == mediaProvider) {
            if ($(".b-video").hasClass("flash_access")) {
                $(".b-video").removeClass("flash_access").draggable("enable").resizable("enable");
                $(".b-video__flash").removeClass("access");
                $(".b-video__flash_footer").removeClass("open");
            }
        } else {
            $("body").removeClass("mike");
        }
    }
    return hasAccess;
};


Phone.prototype.getAccess = function (mediaProvider, hasVideo) {
    if (MediaProvider.Flash == mediaProvider) {
        $(".b-video").addClass("flash_access");
        $(".b-video").draggable("disable");
        $(".b-video").resizable("disable");
        $(".b-video__flash").addClass("access");
        $(".b-video__flash_footer").addClass("open");
        $(".b-video__flash_footer").html("Please <span>allow</span> access to your web camera and microphone.");
        //check flash div dimensions
        if ($("#flashVideoDiv").width() < 215 || $("#flashVideoDiv").height() < 138) {
            console.log("Size of flashVideoDiv is to small, most likely there will be no Privacy dialog");
        }
    } else {
        //hide flash div
        $(".b-video__flash").zIndex(0);
        hasVideo ? $(".b-alert").html("Please <span>allow</span> access to your web camera and microphone.") : $(".b-alert").html("please <span>allow</span> access to audio device");
        $("body").addClass("mike");
    }
    return Flashphoner.getInstance().getAccess(mediaProvider, hasVideo);
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

Phone.prototype.chatSelectTab = function (elem) {
    if (!elem.hasClass("open")) {												// if the tab is inactive
        this.elem_prev = $(".b-chat__nav__tab.open").attr("id");						// save id of previous tab
        $(".b-chat__nav__tab.open, .b-chat_tab.open, .b-chat__new__nav, .b-chat__new__list, .b-chat__nav__tab#new, .b-chat_tab.new").removeClass("open");
        elem.addClass("open");													// do tab and its content visible
        $(".b-chat_tab." + elem.attr("id")).addClass("open");
        $(".b-chat_tab.open .b-chat__window").mCustomScrollbar({				// init scroll-bar
            scrollInertia: 50,
            scrollButtons: {
                enable: false
            }
        });
        this.chatScrollDown();
    }
};

Phone.prototype.viewMessage = function(message){
    $(".b-alert__error__message").html("<p>"+message + "</p>");
    $(".b-alert__error").addClass("open");
};

Phone.prototype.chatCreateTab = function (chatUsername) {
    this.chatNames += '<p>' + chatUsername + '</p>';
    Flashphoner.getInstance().setCookie("chatNames", this.chatNames);
    $('.b-chat__new__list .mCSB_container').html(this.chatNames);

    $(".b-chat__nav__tab.open, .b-chat_tab.open, .b-chat__new__nav, .b-chat__new__list, .b-chat__nav__tab#new, .b-chat_tab.new").removeClass("open");
    $("#new__chat").val("");								// clear search view
    $(".b-chat__nav__tab#new").before('<div class="b-chat__nav__tab open" id="tab_' + chatUsername + '"><span class="tab_text">' + chatUsername + '</span><span class="tab_close"></span></div>'); //tab id is username
    $(".b-chat__new__list p.active").removeClass("active");
    $(".b-chat_tab.new").before('<div class="b-chat_tab open ' + $(".b-chat__nav__tab.open").attr("id") + '"><div class="b-chat__window mCustomScrollbar"></div><div class="b-chat__text"><textarea></textarea><input type="button" value="send" /></div></div>');
    $(".b-chat_tab.open .b-chat__window").mCustomScrollbar({ // init scroll-bar if we load a history
        scrollInertia: 50,
        scrollButtons: {
            enable: false
        }
    });
    this.chatScrollDown();
};

Phone.prototype.chatScrollDown = function () {
    $(".b-chat_tab.open .b-chat__window .mCSB_container").css("top", $(".b-chat_tab.open .b-chat__window .mCSB_container").height() - $(".b-chat_tab.open .b-chat__window .mCSB_container").parent().height() + 20 + "px");
};


$(document).ready(function () {

    var phone = new Phone();

    phone.chatNames = unescape(Flashphoner.getInstance().getCookie("chatNames"));

    ConfigurationLoader.getInstance(function (configuration) {
        trace("Configuration loaded");
        configuration.localMediaElementId = 'localMediaElement';
        configuration.remoteMediaElementId = 'remoteMediaElement';
        configuration.elementIdForSWF = "flashVideoDiv";
        configuration.pathToSWF = "../../dependencies/flash/MediaManager.swf";

        Flashphoner.getInstance().init(configuration);
        phone.init();
    });

    $(".b-ie_video").live("click", function () {
        $(this).text() == "send video" ? $(this).text("stop video") : $(this).text("send video");
    });

    // open/close authentication view
    $(".b-display__header__login, .b-login__cancel").live("click", function () {
        if (phone.connectionStatus == ConnectionStatus.Established || phone.connectionStatus == ConnectionStatus.Registered) {
            phone.disconnect();
        } else {
            $('#sipLogin').val(Flashphoner.getInstance().getCookie('sipLogin'));
            $('#sipPassword').val(Flashphoner.getInstance().getCookie('sipPassword'));
            $('#sipAuthenticationName').val(Flashphoner.getInstance().getCookie('sipAuthenticationName'));
            $('#sipDomain').val(Flashphoner.getInstance().getCookie('sipDomain'));
            $('#sipOutboundProxy').val(Flashphoner.getInstance().getCookie('sipOutboundProxy'));
            $('#sipPort').val(Flashphoner.getInstance().getCookie('sipPort'));

            $(".b-login").toggleClass("open");
            $("#active").removeAttr("id");
            $(".b-login").hasClass("open") ? $(".b-login").attr("id", "active") : $(".b-login").removeAttr("id");
        }
    });

    // authentication
    $(".b-login input[type='button']").live("click", function () {
        $(".b-display__header__login").html("Connecting");
        $(".b-login").removeClass("open").removeAttr("id");
        phone.connect();
    });

    // open/close microphone gain control
    $(".b-display__header__volume").live("click", function () {
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
            Flashphoner.getInstance().setVolume(phone.currentCall, ui.value);
        }
    });
    // digital value of loudspeaker volume
    $(".volume-percent").html($("#volume").slider("value") + "%");

    // digital value of microphone gain
    $(".b-display__header__mike").live("click", function () {
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
    $(".b-display__header__video").live("click", function () {
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
        }// if the call in talking state - do callee video visible
    });
    // close video upon (Х) click
    $(".b-video__close").live("click", function (e) {
        $(".b-video").removeClass("open").removeAttr("id");
        $(".b-video").removeAttr('style');
    });
    // change video view dimensions
    $(".b-video, .b-login, .b-alert__error, .b-chat, .b-transfer").draggable();	// set video view draggable
    $(".b-video").resizable({
        minHeight: 240,
        minWidth: 320,
        aspectRatio: 4 / 3
    });

    // enter phone number
    $(".b-display__bottom__number>span").live("click", function () { // on click by 'Enter your number here'
        if (phone.connectionStatus == ConnectionStatus.Established || phone.connectionStatus == ConnectionStatus.Registered) {
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
    $(".b-num td").live("click", function () {
        if (phone.connectionStatus == ConnectionStatus.Established || phone.connectionStatus == ConnectionStatus.Registered) {
            if (!$(".b-numbers").hasClass("write")) {	// if the symbols are entered then remove the text block
                $(".b-display__bottom__number>span").addClass("close");
                $(".b-numbers").addClass("write").next().addClass("open");
            }
            if (phone.currentCall &&
                (CallStatus.ESTABLISHED == phone.currentCall.status || CallStatus.HOLD == phone.currentCall.status)) {
                phone.sendDTMF(phone.currentCall.callId, $(this).text());
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
    $(".b-numbers__clear").live("click", function () {
        $(".b-numbers").val($(".b-numbers").val().substring(0, $(".b-numbers").val().length - 1));
        num = $(".b-numbers").val().length;
        if (num == 0) {	// if the latest digit was removed then return to initial position
            $(this).removeClass("open");
            $(".b-numbers").removeClass("write");
            $(".b-display__bottom__number>span").removeClass("close");
        }
    });

    // do video and audio call
    $(".b-nav__voice, .b-nav__video").live("click", function () {
        if ($(".b-numbers").hasClass("write")) {  // check if phone number was entered
            $("body").addClass("voice_call__out");
            $(".call__out__dial").addClass("open").html($(".call__out__dial").html() + " " + $(".b-numbers").val());	// open outgoing call block and writ here callee number
            if ($(this).hasClass("b-nav__video")) {
                $("body").addClass("video")
            } // if it is a video call then add the body class (for alert view)

            var mediaProvider = MediaProvider.Flash;
            if (Flashphoner.getInstance().mediaProviders.get(MediaProvider.WebRTC)) {
                mediaProvider = MediaProvider.WebRTC;
            }

            if ($("body").hasClass("video")) {
                phone.call($(".b-numbers").val(), true, mediaProvider);
            } else {
                phone.call($(".b-numbers").val(), false, mediaProvider);
            }

        }
    });

    // answer the incoming call
    $(".b-nav__answer, .b-nav__answer_video").live("click", function () {
        if ($(this).hasClass("b-nav__answer_video")) {	// if it is a video call then open view with video
            $("body").addClass("video");
        }
        if (phone.currentCall) {
            phone.answer(phone.currentCall, $(this).hasClass("b-nav__answer_video"));
        }
    });

    $(".voice_call__stop").live("click", function () {	// if the call is on hold
        if (phone.currentCall) {
            phone.hold(phone.currentCall);
            $(this).removeClass("open");					// hide the hold button
            $(".voice_call__play").addClass("open");	// do visible button of returning to the call and hold view
        }
    });

    $(".voice_call__play").live("click", function () {	// return to talk
        if (phone.currentCall) {
            phone.unhold(phone.currentCall);
            $(this).removeClass("open");					// hide unhold button
            $(".voice_call__stop").addClass("open");						// do visible hold button
        }
    });

    $(".voice_call__transfer").live("click", function () {							// if the transfer button is pressed
        if (phone.currentCall) {
            phone.hold(phone.currentCall);
            $(".voice_call__transfer").addClass("close");		// hide transfer button
            $(".b-transfer").addClass("open");				// open transfer view and hold view
            $(".b-transfer").attr("id", "active");
            $("#transfer").focus();														// set focus on the phone number field
        }
    });

    $(".b-transfer__cancel").live("click", function () {
        if (phone.currentCall) {
            phone.unhold(phone.currentCall);
        }
        $(".voice_call__transfer").removeClass("close");
        $(".b-transfer").removeClass("open").removeAttr("id");
    });

    $(".b-transfer__ok").live("click", function () {
        if (phone.currentCall) {
            phone.transfer(phone.currentCall.callId, $("#transfer").val());
        }
        $(".voice_call__transfer").removeClass("close");
        $(".b-transfer").removeClass("open").removeAttr("id");

    });

    $(".b-nav__chat").live("click", function () {									// on "Chat" button click
        if (phone.connectionStatus == ConnectionStatus.Established || phone.connectionStatus == ConnectionStatus.Registered) {
            $('.b-chat__new__list .mCSB_container').html(phone.chatNames);
            if (!$(this).hasClass("chat")) {										// if the button does not have the chat class then the chat view is closed
                $(this).addClass("chat");										// add chat class
                $(".b-chat").addClass("open");						// open the chat window and add button of incoming call
                $(".b-chat").attr("id", "active");
                $(".b-chat_tab.open .b-chat__window").mCustomScrollbar();		// activate styles of scroll-bar of the open chat window
                phone.chatScrollDown();
            } else {															// if the chat is open then close it and remove the chat class from button
                $(this).removeClass("chat");
                $(".b-chat").removeAttr("id");
                $(".b-chat").removeClass("open");
            }
        }
    });

    $(".b-alert__close").live("click", function () {
        $(".b-alert__error").removeAttr("id");
        $(".b-alert__error").removeClass("open");
    });
    $(".b-chat__close").live("click", function () {	// on close click (Х) on the chat view
        $(".b-nav__chat").removeClass("chat");
        $(".b-chat").removeAttr("id");
        $(".b-chat").removeClass("open");
    });

    $(".b-chat__nav__tab .tab_close").live("click", function () {	// on close click (X) on the chat tab
        var elem = $(this).parent();
        if (elem.attr("id") == "new") {										// do not close the tab if the tab belongs to a new chat window
            $("#" + phone.elem_prev + ", .b-chat_tab." + phone.elem_prev).addClass("open");	// do previous tab active
            elem.removeClass("open");										// hide this tab with its content
            $(".b-chat_tab." + elem.attr("id")).removeClass("open");
            phone.chatScrollDown();
        } else {
            if (elem.hasClass("open")) {						// if the tab is open
                if (elem.index() > 0) {									// and if the element is not first element
                    elem.prev().addClass("open");					// do active previous tab and its content
                    $("." + elem.prev().attr("id")).addClass("open");
                } else {											// if the tab is first then do active next tab
                    elem.next().addClass("open");
                    $("." + elem.next().attr("id")).addClass("open");
                }
            }
            elem.remove();											// close the tab and its content
            $(".b-chat_tab." + elem.attr("id")).remove();
        }
    });
    $(".b-chat").resizable({	// change chat window dimensions
        minHeight: 395,
        minWidth: 500
    });

    $(".b-chat__text input").live("click", function () {	// on click "Send" in the chat
        var body = $(this).prev().val().replace(/\n/g, "<br />");
        var message = new Message();
        message.to = $(".b-chat__nav__tab.open span.tab_text").html();
        message.body = body;
        phone.sendMessage(message);

        $('<div id="message_' + message.id + '" class="b-chat__message my_message"><div class="b-chat__message__head"><span class="b-chat__message__time">' + new Date().toLocaleString() + '</span><span class="b-chat__message__author">' + $("input[id='sipLogin']").val() + '</span></div><div class="b-chat__message__text">' + body + '</div></div>').appendTo($(".mCSB_container", $(this).parent().prev()));
        phone.chatScrollDown();
        $(this).prev().val(""); // clear the textarea
    });

    $(".b-chat__nav__tab .tab_text").live("click", function () {						// on tab click
        var elem = $(this).parent();
        phone.chatSelectTab(elem);
    });

    $("#new__chat").keyup(function () {			// enter username from keyboard
        $(".b-chat__new__list").addClass("open");
        $(".b-chat__new__nav").addClass("open");	// do active buttons under the list
    });
    $(".b-chat__new__list p").live("click", function () {			// on click by username select its name
        $(".b-chat__new__list p.active").removeClass("active");
        $(this).addClass("active");
        $("#new__chat").val($(this).html());
    });
    $(".b-chat__new__cancel").live("click", function () {		// on click "Cancel" while search of callee name
        $(".b-chat__new__list p.active").removeClass("active");	// remove active class from the selected username (if the username exists)
        $("#new__chat").val("");								// clear the search field
        $(".b-chat__new__nav, .b-chat__new__list, .b-chat__nav__tab#new, .b-chat_tab.new").removeClass("open");	// hide all(list, buttons, the tab)
        $("#" + phone.elem_prev + ", .b-chat_tab." + phone.elem_prev).addClass("open");	// do active the tab previously saved
        phone.chatScrollDown();
    });
    $(".b-chat__new__ok").live("click", function () {				// selected username for the new chat tab
        var chatUsername = $("#new__chat").val();
        phone.chatCreateTab(chatUsername);
    });
    $(".b-video, .b-login, .b-chat, .b-alert__error").mousedown(function () { // if we pressed on a popup block then the block is bringing to forward
        $("#active").removeAttr("id");
        $(this).attr("id", "active");
    });

    $(".b-nav__cancel_call, .close, .b-nav__hangup").live("click", function () {	// return to initial view
        if (phone.currentCall) {
            phone.hangup(phone.currentCall);
        } else {
            phone.cancel();
        }
    });
});