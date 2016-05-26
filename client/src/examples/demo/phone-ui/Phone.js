var Phone = function () {
    this.flashphonerListener = null;
    this.currentCall = null;
    this.holdedCall = null;
    this.logs = "";
    this.intervalId = -1;
};

Phone.prototype.init = function () {
    this.flashphonerListener = new DefaultListener();

    Flashphoner.getInstance().addListener(WCSEvent.ErrorStatusEvent, this.errorStatusEvent, this);
    Flashphoner.getInstance().addListener(WCSEvent.ConnectionStatusEvent, this.connectionStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.RegistrationStatusEvent, this.registrationStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnCallEvent, this.onCallListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.CallStatusEvent, this.callStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnTransferEvent, this.onTransferEventListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.TransferStatusEvent, this.onTransferStatusListener, this);

    Flashphoner.getInstance().addListener(WCSEvent.OnMessageEvent, this.onMessageListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.MessageStatusEvent, this.messageStatusListener, this);

    Flashphoner.getInstance().addListener(WCSEvent.RecordingStatusEvent, this.recordingStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.SubscriptionStatusEvent, this.subscriptionStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.XcapStatusEvent, this.xcapStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.BugReportStatusEvent, this.bugReportStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnDataEvent, this.onDataEventListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.DataStatusEvent, this.dataStatusEventListener, this);
};

Phone.prototype.getMediaProvider = function () {
    var mediaProviders = Flashphoner.getInstance().mediaProviders;
    var mediaProvider;

    var forceMediaProvider = ConfigurationLoader.getInstance().forceMediaProvider;
    if (forceMediaProvider) {
        if (mediaProviders.get(forceMediaProvider)) {
            mediaProvider = forceMediaProvider;
        }
    }
    if (!mediaProvider) {
        mediaProvider = MediaProvider.Flash;
        if (mediaProviders.get(MediaProvider.WebRTC)) {
            mediaProvider = MediaProvider.WebRTC;
        }
    }
    return mediaProvider;
};

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
    //This parameter will be defined from flashphoner.xml config
    connection.sipRegisterRequired = null;

    for (var key in connection) {
        Flashphoner.getInstance().setCookie(key, connection[key]);
    }

    var result = Flashphoner.getInstance().connect(connection);
    if (result == 0) {
        trace("Phone - connecting");
    }
};

Phone.prototype.disconnect = function () {
    trace("Phone - disconnect");
    Flashphoner.getInstance().disconnect();
};

Phone.prototype.cancel = function () {
    if (this.currentCall) {
        this.hangup(this.currentCall);
    }
};

Phone.prototype.msrpCall = function (callee) {
    var me = this;
    callee = me.applyCalleeLetterCase(callee);
    trace("Phone - msrpCall " + callee);

    me.currentCall = Flashphoner.getInstance().msrpCall({
        callee: callee,
        visibleName: 'Caller',
        hasVideo: false,
        inviteParameters: {param1: "value1", param2: "value2"},
        isMsrp: true
    });
};

Phone.prototype.call = function (callee, hasVideo, mediaProvider) {
    var me = this;
    callee = me.applyCalleeLetterCase(callee);
    trace("Phone - call " + callee);
    if (!me.hasAccess(mediaProvider, hasVideo)) {
        if (me.intervalId == -1) {
            var checkAccessFunc = function () {
                if (me.hasAccess(mediaProvider, hasVideo)) {
                    clearInterval(me.intervalId);
                    me.intervalId = -1;
                    me.call(callee, hasVideo, mediaProvider);
                }
            };
            me.intervalId = setInterval(checkAccessFunc, 500);
        }
        me.getAccess(mediaProvider, hasVideo);
    } else if (me.hasAccess(mediaProvider, hasVideo)) {
        var call = new Call();
        call.callee = callee;
        call.visibleName = "Caller";
        call.hasVideo = hasVideo;
        //uncomment for receive video in audio call
        //call.receiveVideo = true;
        call.inviteParameters = {param1: "value1", param2: "value2"};
        call.mediaProvider = mediaProvider;
        this.currentCall = Flashphoner.getInstance().call(call);
        this.flashphonerListener.onCall();
    } else {
        trace("Microphone is not plugged in");
    }
};

Phone.prototype.changeVideoState = function (call, enable) {
    trace("Phone - changeVideoState");
    Flashphoner.getInstance().changeVideoState(call, enable);
};

Phone.prototype.sendMessage = function (message) {
    trace("Phone - sendMessage " + message.to + " body: " + message.body);
    Flashphoner.getInstance().sendMessage(message);
};

Phone.prototype.answer = function (call, hasVideo) {
    trace("Phone - answer " + call.callId);
    var me = this;
    if (!me.hasAccess(call.mediaProvider, hasVideo)) {
        if (me.intervalId == -1) {
            var checkAccessFunc = function () {
                if (me.hasAccess(call.mediaProvider, hasVideo)) {
                    clearInterval(me.intervalId);
                    me.intervalId = -1;
                    me.answer(call, hasVideo);
                }
            };
            me.intervalId = setInterval(checkAccessFunc, 500);
        }
        me.getAccess(call.mediaProvider, hasVideo);
    } else if (me.hasAccess(call.mediaProvider, hasVideo)) {
        call.hasVideo = hasVideo;
        Flashphoner.getInstance().answer(call);
        this.flashphonerListener.onAnswer(call.callId);
    } else {
        trace("Microphone is not plugged in");
    }
};

Phone.prototype.hangup = function (call) {
    trace("Phone - hangup " + call.callId);
    Flashphoner.getInstance().hangup(call);
    this.flashphonerListener.onHangup();
};

Phone.prototype.sendDTMF = function (callId, dtmf) {
    trace("Phone - sendDTMF callId: " + callId + " dtmf: " + dtmf);
    Flashphoner.getInstance().sendDTMF({callId: callId, dtmf: dtmf});
};

Phone.prototype.hold = function (call) {
    trace("Phone - hold callId: " + call.callId);
    Flashphoner.getInstance().hold(call);
};

Phone.prototype.holdForTransfer = function (call) {
    trace("Phone - hold callId: " + call.callId);
    Flashphoner.getInstance().holdForTransfer(call);
};

Phone.prototype.unhold = function (call) {
    trace("Phone - hold callId: " + call.callId);
    Flashphoner.getInstance().unhold(call);
};

Phone.prototype.transfer = function (callId, target) {
    trace("Phone - transfer callId: " + callId + " target: " + target);
    Flashphoner.getInstance().transfer({callId: callId, target: target});
};

Phone.prototype.getStatistics = function() {
    Flashphoner.getInstance().getCallStatistics(this.currentCall, function(statistics){
        trace("Statistics: " +  JSON.stringify(statistics), null, ' ');
    });
};

Phone.prototype.sendXcapRequest = function () {
    var url = ConfigurationLoader.getInstance().xcapUrl;
    if (url) {
        Flashphoner.getInstance().sendXcapRequest({url: url});
    }
};

Phone.prototype.subscribe = function () {
    var subscribeObj = {};
    subscribeObj.event = ConfigurationLoader.getInstance().subscribeEvent;
    subscribeObj.expires = 3600;
    Flashphoner.getInstance().subscribe(subscribeObj);
};

Phone.prototype.changeRelationMyVideo = function (relation) {
    trace("Phone - changeRelationMyVideo " + relation);
    Flashphoner.getInstance().changeRelationMyVideo(relation);
};

Phone.prototype.submitBugReport = function () {
    var bugReportText = getElement('bugReportText').value;
    trace("submitBugReport " + bugReportText);
    Flashphoner.getInstance().submitBugReport({text: bugReportText, type: "no_media"});
};

Phone.prototype.sendData = function (data) {
    trace("sendData " + data);
    Flashphoner.getInstance().sendData(data);
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
    } else if (status == WCSError.AUTHENTICATION_FAIL) {
        this.viewMessage("Authentication failed, please check your SIP account details.");
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
    if (event.status==CallStatus.FAILED){
        trace("Call failed: callId: "+event.id+" info: "+event.info);
        return;
    }
    var call = event;
    trace("Phone - callStatusListener call id: " + call.callId + " status: " + call.status + " mediaProvider: " + call.mediaProvider);
    if (this.currentCall.callId == call.callId) {
        this.currentCall.status = call.status;
        if (call.status == CallStatus.FINISH) {
            trace("Phone - ... Call is finished...");
            SoundControl.getInstance().stopSound("RING");
            if (this.holdedCall != null) {
                this.currentCall = this.holdedCall;
                this.holdedCall = null;
            } else if (this.isCurrentCall(call)) {
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
        } else if (call.status == CallStatus.HOLD) {
            trace('Phone - ...Call on hold...');
            if (call.incoming) {
                $(".voice_call__call__pause").text(call.caller);
            } else {
                $(".voice_call__call__pause").text(call.callee);
            }
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

            if (MediaProvider.Flash == call.mediaProvider && ConfigurationLoader.getInstance().reoffersEnabled) {
                $(".b-send_video").addClass("open");
            }

            if (call.hasVideo) {
                $(".b-send_video").text("Stop video");
            } else {
                $(".b-send_video").text("Send video");
            }

            this.startTimer();

            $(".voice_call__transfer").removeClass("close");
            $(".voice_call__stop").addClass("open");		// do visible hold button
            $(".voice_call__play").removeClass("open");					// hide unhold button
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

        this.hideFlashAccess();
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
    $('<div class="b-chat__message"><div class="b-chat__message__head"><span class="b-chat__message__time">' + new Date().toLocaleString() + '</span><span class="b-chat__message__author">' + message.from + '</span></div><div class="b-chat__message__text">' + message.body.replace(/\n/g, "<br />") + '</div></div>').appendTo($(".b-chat_tab.open .mCSB_container"));
    this.chatScrollDown();
};

Phone.prototype.convertMessageBody = function (messageBody, contentType) {
    trace("Phone - convertMessageBody " + contentType);
    if (contentType == "application/fsservice+xml") {
        var xml = $.parseXML(messageBody);
        var missedCallNotification;
        var fsService = $(xml).find("fs-services").find("fs-service");
        var action = fsService.attr("action");
        if (action == "servicenoti-indicate") {
            var caw = this.parseMsn(fsService, "caw");
            if (!!caw) {
                missedCallNotification = caw;
            } else {
                missedCallNotification = parseMsn(fsService, "mcn");
            }
        } else if (action == "serviceinfo-confirm") {
            //service status confirmation
            missedCallNotification = "Service status: " + $(fsService.find("mcn").find("mcn-data")).attr("status");
        }
        if (missedCallNotification !== undefined) return missedCallNotification;

    } else if (contentType == "application/vnd.oma.push") {
        var xml = $.parseXML(messageBody);
        /**
         * application/vnd.oma.push will contain xml with app information
         * Try to handle this information or discard xml
         */
        var content;
        if ($(xml).find("ums-service")) {
            //voice mail service message
            content = $(xml).find("ni-data").attr("content");
        }
        return content;
    }

    return messageBody;

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

Phone.prototype.subscriptionStatusListener = function (event) {
    var subscriptionObject = event;
    var sipObject = event.sipMessageRaw;
    trace("Phone - subscriptionStatusListener event: " + subscriptionObject.event + " expires: " + subscriptionObject.expires + " status: " + subscriptionObject.status + " terminate: " + subscriptionObject.terminate);
    trace("Phone - subscriptionStatusListener body: " + subscriptionObject.requestBody);
    if (subscriptionObject.event == "reg") {
        if (subscriptionObject.terminate) {
            this.disconnect();
        }
    }
};

Phone.prototype.xcapStatusListener = function (xcapResponse) {
    trace("Phone - xcapStatusListener " + xcapResponse);
    var xml = $.parseXML(xcapResponse.responseBody);
    var history = $(xml).find("history-list").find("history");
    if (history != null && history.length != 0) {
        if (ConfigurationLoader.getInstance().msrpCallee != null && ConfigurationLoader.getInstance().msrpCallee.length != 0) {
            this.msrpCall(ConfigurationLoader.getInstance().msrpCallee);
        }
    }
};

Phone.prototype.bugReportStatusListener = function (event) {
    trace("Phone - bugReportStatusListener; filename - " + event.filename);
};

Phone.prototype.onDataEventListener = function (event) {
    trace("Phone - onDataEventListener; received data " + event.data);
};

Phone.prototype.dataStatusEventListener = function (event) {
    trace("Phone - DataStatusEventListener; received status " + event.status);
};

Phone.prototype.errorStatusEvent = function (event) {
    var code = event.status;
    trace("Phone - errorStatusEvent " + code);
    if (code == WCSError.MIC_ACCESS_PROBLEM || code == WCSError.MIC_CAM_ACCESS_PROBLEM) {
        this.cancel();
        this.viewMessage("ERROR - " + event.info);
    } else {
        this.cancel();
        if (code == WCSError.CONNECTION_ERROR) {
            this.viewMessage("ERROR - Can`t connect to server.");
        } else if (code == WCSError.AUTHENTICATION_FAIL) {
            this.viewMessage("ERROR - Register fail, please check your SIP account details.");
            window.setTimeout("disconnect();", 3000);
        } else if (code == WCSError.USER_NOT_AVAILABLE) {
            this.viewMessage("ERROR - User not available.");
        } else if (code == WCSError.LICENSE_RESTRICTION) {
            this.viewMessage("ERROR - You trying to connect too many users, or license is expired");
        } else if (code == WCSError.LICENSE_NOT_FOUND) {
            this.viewMessage("ERROR - Please get a valid license or contact Flashphoner support");
        } else if (code == WCSError.INTERNAL_SIP_ERROR) {
            this.viewMessage("ERROR - Unknown error. Please contact support.");
        } else if (code == WCSError.REGISTER_EXPIRE) {
            this.viewMessage("ERROR - No response from VOIP server during 15 seconds.");
        } else if (code == WCSError.SIP_PORTS_BUSY) {
            this.viewMessage("ERROR - SIP ports are busy. Please open SIP ports range (30000-31000 by default).");
            window.setTimeout("disconnect();", 3000);
        } else if (code == WCSError.MEDIA_PORTS_BUSY) {
            this.viewMessage("ERROR - Media ports are busy. Please open media ports range (31001-32000 by default).");
        } else if (code == WCSError.WRONG_SIPPROVIDER_ADDRESS) {
            this.viewMessage("ERROR - Wrong domain.");
            window.setTimeout("disconnect();", 3000);
        } else if (code == WCSError.CALLEE_NAME_IS_NULL) {
            this.viewMessage("ERROR - Callee name is empty.");
        } else if (code == WCSError.WRONG_FLASHPHONER_XML) {
            this.viewMessage("ERROR - Flashphoner.xml has errors. Please check it.");
        } else if (code == WCSError.PAYMENT_REQUIRED) {
            this.viewMessage("ERROR - Payment required, please check your balance.");
        } else if (code == WCSError.REST_AUTHORIZATION_FAIL) {
            this.viewMessage("ERROR - Rest authorization fail.");
            window.setTimeout("disconnect();", 3000);
        } else if (code == WCSError.REST_FAIL) {
            this.viewMessage("ERROR - Rest fail.");
        }
    }

    this.flashphonerListener.onError();
};

Phone.prototype.viewMessage = function (message) {
    trace(message);
};



Phone.prototype.hideFlashAccess = function () {
    if ($(".b-video").hasClass("flash_access")) {
        $(".b-video").removeClass("flash_access").resizable("enable");
        $(".b-video__flash").removeClass("access");
        $(".b-video__flash_footer").removeClass("open");
    }
};

Phone.prototype.hasAccess = function (mediaProvider, hasVideo) {
    var hasAccess = Flashphoner.getInstance().hasAccess(mediaProvider, hasVideo);

    if (hasAccess) {
        if (MediaProvider.Flash == mediaProvider) {
            this.hideFlashAccess();
        } else {
            $(".b-video").draggable();
            $(".b-video").draggable("enable");
            $("body").removeClass("mike");
        }
    }
    return hasAccess;
};


Phone.prototype.getAccess = function (mediaProvider, hasVideo) {
    if (MediaProvider.Flash == mediaProvider) {
        $(".b-video").addClass("flash_access");
        $(".b-video").draggable();
        $(".b-video").draggable("disable");
        $(".b-video").resizable("disable");
        $(".b-video__flash").addClass("access");
        $(".b-video__flash").zIndex(1000);
        $(".b-video__flash_footer").addClass("open");
        $(".b-video__flash_footer").html("Please <span>allow</span> access to your web camera and microphone.");
        //check flash div dimensions
        if ($("#flashVideoDiv").width() < 215 || $("#flashVideoDiv").height() < 138) {
            console.log("Size of flashVideoDiv is to small, most likely there will be no Privacy dialog");
        }

    } else {
        //hide flash div
        $(".b-video").draggable();
        $(".b-video").draggable("enable");
        $(".b-video__flash").zIndex(0);
        hasVideo ? $(".b-alert").html("Please <span>allow</span> access to your web camera and microphone.") : $(".b-alert").html("please <span>allow</span> access to audio device");
        $("body").addClass("mike");
    }

    Flashphoner.getInstance().getAccess(mediaProvider, hasVideo);

};

Phone.prototype.openVideoView = function () {
    var me = this;
    var mediaProvider = me.getMediaProvider();

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

    if (!me.hasAccess(mediaProvider, true)) {
        if (me.intervalId == -1) {
            var checkAccessFunc = function () {
                if (me.hasAccess(mediaProvider, true)) {
                    clearInterval(me.intervalId);
                    me.intervalId = -1;
                    $(".b-alert").removeClass("open");
                }
            };
            me.intervalId = setInterval(checkAccessFunc, 500);
        }
        me.getAccess(mediaProvider, true);
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

Phone.prototype.viewMessage = function (message) {
    $(".b-alert__error__message").html("<p>" + message + "</p>");
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

/* ------------- Additional interface functions --------- */
Phone.prototype.isCurrentCall = function (call) {
    return this.currentCall != null && this.currentCall.callId == call.callId;
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

    var phone = new Phone();

    phone.chatNames = unescape(Flashphoner.getInstance().getCookie("chatNames"));

    ConfigurationLoader.getInstance(function (configuration) {
        trace("Configuration loaded");
        configuration.localMediaElementId = 'localMediaElement';
        configuration.remoteMediaElementId = 'remoteMediaElement';
        configuration.elementIdForSWF = "flashVideoDiv";
        configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";

        Flashphoner.getInstance().init(configuration);
        phone.init();
    });

    $(".b-send_video").live("click", function () {
        if ($(this).text() == "Send video") {
            phone.changeVideoState(phone.currentCall, true);
            $(this).text("Stop video");
        } else {
            phone.changeVideoState(phone.currentCall, false);
            $(this).text("Send video");
        }
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
        phone.openVideoView();
    });
    // close video upon (Х) click
    $(".b-video__close").live("click", function (e) {
        $(".b-video").removeClass("open").removeAttr("id");
        $(".b-video").removeAttr('style');
        if ($(".b-video").hasClass("flash_access")) {
            phone.cancel();
        }
    });
    // change video view dimensions
    //$(".b-video, .b-login, .b-alert__error, .b-chat, .b-transfer").draggable();	// set video view draggable
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

            var mediaProvider = phone.getMediaProvider();

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
            $(".voice_call__transfer").addClass("close");
            $(this).removeClass("open");					// hide the hold button
            $(".voice_call__play").addClass("open");	// do visible button of returning to the call and hold view
        }
    });

    $(".voice_call__play").live("click", function () {	// return to talk
        if (phone.currentCall) {
            phone.unhold(phone.currentCall);
            $(".voice_call__transfer").removeClass("close");
            $(this).removeClass("open");					// hide unhold button
            $(".voice_call__stop").addClass("open");						// do visible hold button
        }
    });

    $(".voice_call__transfer").live("click", function () {							// if the transfer button is pressed
        if (phone.currentCall) {
            phone.holdForTransfer(phone.currentCall);
            $(".voice_call__transfer").addClass("close");		// hide transfer button
            $(".b-transfer").addClass("open");				// open transfer view and hold view
            $(".b-transfer").attr("id", "active");
            $("#transfer").focus();														// set focus on the phone number field
        }
    });

    $(".b-transfer__cancel").live("click", function () {
        if (phone.currentCall) {
            phone.unhold(phone.currentCall);
            $(".voice_call__play").removeClass("open");					// hide unhold button
            $(".voice_call__stop").addClass("open");						// do visible hold button
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
        var body = $(this).prev().val();
        var message = new Message();
        message.to = $(".b-chat__nav__tab.open span.tab_text").html();
        message.body = body;
        phone.sendMessage(message);

        $('<div id="message_' + message.id + '" class="b-chat__message my_message"><div class="b-chat__message__head"><span class="b-chat__message__time">' + new Date().toLocaleString() + '</span><span class="b-chat__message__author">' + $("input[id='sipLogin']").val() + '</span></div><div class="b-chat__message__text">' + body.replace(/\n/g, "<br />") + '</div></div>').appendTo($(".mCSB_container", $(this).parent().prev()));
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
        phone.cancel();
    });
});