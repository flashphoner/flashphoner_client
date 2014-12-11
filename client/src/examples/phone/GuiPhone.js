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


Phone.prototype.registrationStatusListener = function (event) {
    var status = event.status;
    var sipObject = event.sipMessageRaw;
    trace("Phone - registrationStatusListener " + status);
    if (status == WCSError.AUTHENTICATION_FAIL) {
        trace("Phone - ERROR - Register fail, please check your SIP account details.");
        window.setTimeout(this.disconnect(), 3000);
    } else if (status == RegistrationStatus.Failed) {
        trace("Phone - ERROR - Register fail.");
        window.setTimeout(this.disconnect(), 3000);
    } else {
        $(".b-login").removeClass("open").removeAttr("id");
        $(".b-display__header__login").html($("input[id='sipLogin']").val() == "" ? "Log in" : $("input[id='sipLogin']").val()); // передаём введённый логин в интерфейс

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

        $("body").addClass("voice_call__inc");								// добавляем класс входящего вызова body
        $(".b-nav").addClass("close");										// скрываем обычные чёрные кнопки и делаем видимы кнопки ответа на звонок
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

                $("body").removeAttr("class");								// стираем все классы у body
                $(".voice_call__transfer").removeClass("tr_call__pause");	// обнуляем доп.стиль кнопки переадресации
                $("#transfer").val("");										// стираем значение в окне переадресации, если есть
                $(".call__out__dial").text("calling to");					// возвращаем исходный вид блока исходящего вызова (без номера/ника)
                $(".b-nav__chancel_call span").text("Cancel");				// возвращаем исходное состояние кнопки
                $(".b-mike, .b-alert__ban, .call__out__dial, .call__inc__dial, .voice_call__call, .voice_call__play, .voice_call__call__pause, .b-transfer, .b-video, .b-video__video, .b-nav__inc, .b-alert").removeClass("open"); // закрываем кучу блоков, которые по умолчанию скрыты
                $(".b-display__bottom__number>span, .voice_call__call__play, .voice_call__transfer, .b-nav").removeClass("close");	// открываем блоки, которые могли быть скрыты, но по умолчанию видимые
                num = 0;
                $(".b-alert").text("").removeClass("video_alert");	// исходный вид окна с алертом
                $(".interlocutor2").text("");						// очищаем ник собеседника в окне вызова
                $(".b-time").html("<span class='b-min'>00</span>:<span class='b-sec'>00</span>");	// возвращаем вёрстку таймера на исходную
                $(".voice_call__stop").addClass("open");		// делаем видимыми кнопку паузы разговора и кнопку моделирования входящего звонка

            }
        } else if (call.status == CallStatus.HOLD) {
            trace('Phone - ...Call on hold...');
            $(this).removeClass("open");					// скрываем кнопку паузы
            $(".voice_call__play, .voice_call__call__pause").addClass("open");	// делаем видимой кнопку возврата к разговору и окно паузы
            $(".voice_call__call__play").addClass("close");		// скрываем окно разгоора
            $(".b-video").removeClass("open");					// скрываем видео (если есть)
            $(".voice_call__transfer").addClass("tr_call__pause");	// добавляем класс кнопке трансфера, чтобы знать, куда потом, если что, возвращаться
        } else if (call.status == CallStatus.ESTABLISHED) {
            trace('Phone - ...Talking...');
            $(".b-alert, .b-nav__inc, .b-alert__ban, .call__inc__dial").removeClass("open"); // скрываем кучу ненужных кнопок, окон, а также кнопки "разрешить"/"запретить"
            $(".b-nav").removeClass("close");	// открываем обратно стандартные кнопки навигации (если были скрыты при входящем звонке, к примеру)
            $("body").hasClass("video") ? $(".b-video, .hook").addClass("open") : $(".hook").addClass("open");	// если это видео, открываем его и делаем видимой кнопку, моделирующую ответ собеседника (hook при программировании убрать)
            $(".b-nav__chancel_call span").text("Hangup");	// меняем текст кнопки отмены
            if ($("body").hasClass("voice_call__inc")) {	// если это входящий звонок
                if ($("body").hasClass("video")) {
                    $(".b-video__video").addClass("open")
                } // и если это видеозвонок, открываем большое видео собеседника сразу
                $(".voice_call__call").addClass("open");	//открываем окно с разговором
                start = min = 0;							// обнуляем и запускаем счётчик времени
                this.time();
                if (call.incoming) {
                    $(".interlocutor2").text(call.caller);
                } else {
                    $(".interlocutor2").text(call.callee);
                }

            } else {
                $(".call__out__dial").removeClass("open");	// скрываем окно вызова
                $(".voice_call__call").addClass("open");	// открываем окно разговора
                $(".b-nav__chancel_call span").text("Hangup");	// меняем текст красной кнопки
                $(".interlocutor2").text($(".b-numbers").val());	//указываем номер собеседника в окне разговора (или что угодно, что нужно вставить)
                $(".b-time").html("<span class='b-min'>00</span>:<span class='b-sec'>00</span>");	// обнуляем старый счётчик
                start = min = 0;																	//
                this.time();																				// и запускаем заново
                $(this).removeClass("open");														// скрываем кнопку приёма вызова (удалить при программировании)
                if ($("body").hasClass("video")) $(".b-video__video").addClass("open");	// если видеозвонок, открыть видео собеседника (он ответил и тепеть его видно)
            }
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
            $(".b-video").removeClass("open").removeAttr("id");
            $(".b-video").draggable();
        } else {
            $("body").removeClass("mike");
        }
    }
    return hasAccess;
};


Phone.prototype.getAccess = function (mediaProvider, hasVideo) {
    if (MediaProvider.Flash == mediaProvider) {
        $(".b-video").addClass("open").attr("id", "active");
        $(".b-video").draggable("disable");
        $("#flashVideoDiv").css("position", "absolute");
        //check flash div dimensions
        if ($("#flashVideoDiv").width() < 320 || $("#flashVideoDiv").height() < 240) {
            console.log("Size of flashVideoDiv is to small, most likely there will be no Privacy dialog");
        }
    } else {
        hasVideo ? $(".b-alert").html("Please <span>allow</span> access to your web camera and microphone.") : $(".b-alert").html("please <span>allow</span> access to audio device");
        $("body").addClass("mike");
    }
    return Flashphoner.getInstance().getAccess(mediaProvider, hasVideo);
};


// функция отсчёта времени
Phone.prototype.time = function () {
    var timer = setInterval(function () {
        start++;
        if (start > 59) {
            start = 0;
            min++;
            if (min < 10) {
                $(".b-min").html("0" + min);
            } else $(".b-min").html(min);
        }
        if (start < 10) {
            $(".b-sec").html("0" + start);
        } else $(".b-sec").html(start);
    }, 1000);
    $(".b-nav__chancel_call, .close, .voice_call__stop, .voice_call__transfer, .chat").live("click", function () {
        clearInterval(timer); // останавливаем таймер
    });
};

Phone.prototype.chatSelectTab = function (elem) {
    if (!elem.hasClass("open")) {												// если таб не активен
        this.elem_prev = $(".b-chat__nav__tab.open").attr("id");						// сохраняем id предыдущего таба
        $(".b-chat__nav__tab.open, .b-chat_tab.open, .b-chat__new__nav, .b-chat__new__list, .b-chat__nav__tab#new, .b-chat_tab.new").removeClass("open");
        elem.addClass("open");													// делаем таб и его содержимое видимым
        $(".b-chat_tab." + elem.attr("id")).addClass("open");
        $(".b-chat_tab.open .b-chat__window").mCustomScrollbar({				// инициализируем скроллбар
            scrollInertia: 50,
            scrollButtons: {
                enable: false
            }
        });
        this.chatScrollDown();
    }
};

Phone.prototype.chatCreateTab = function (chatUsername) {
    this.chatNames += '<p>' + chatUsername + '</p>';
    Flashphoner.getInstance().setCookie("chatNames", this.chatNames);
    $('.b-chat__new__list .mCSB_container').html(this.chatNames);

    $(".b-chat__nav__tab.open, .b-chat_tab.open, .b-chat__new__nav, .b-chat__new__list, .b-chat__nav__tab#new, .b-chat_tab.new").removeClass("open");
    $("#new__chat").val("");								// очищаем окно поиска
    $(".b-chat__nav__tab#new").before('<div class="b-chat__nav__tab open" id="tab_' + chatUsername + '"><span class="tab_text">' + chatUsername + '</span><span class="tab_close"></span></div>'); // id табам задаётся якобы автоматически, но лучше id как-то генерировать независимо от числа табов, иначе может получиться 2 таба с одним id. Проще это пресечь сразу, чем делать 100 проверок при создании таба ИМХО
    $(".b-chat__new__list p.active").removeClass("active");
    $(".b-chat_tab.new").before('<div class="b-chat_tab open ' + $(".b-chat__nav__tab.open").attr("id") + '"><div class="b-chat__window mCustomScrollbar"></div><div class="b-chat__text"><textarea></textarea><input type="button" value="send" /></div></div>');
    $(".b-chat_tab.open .b-chat__window").mCustomScrollbar({ // если вдруг будет загрузка истории, инициализируем скроллбар
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

    // открываем/закрываем окно авторизации
    $(".b-display__header__login, .b-login__chancel").live("click", function () {
        $('#sipLogin').val(Flashphoner.getInstance().getCookie('sipLogin'));
        $('#sipPassword').val(Flashphoner.getInstance().getCookie('sipPassword'));
        $('#sipAuthenticationName').val(Flashphoner.getInstance().getCookie('sipAuthenticationName'));
        $('#sipDomain').val(Flashphoner.getInstance().getCookie('sipDomain'));
        $('#sipOutboundProxy').val(Flashphoner.getInstance().getCookie('sipOutboundProxy'));
        $('#sipPort').val(Flashphoner.getInstance().getCookie('sipPort'));

        $(".b-login").toggleClass("open");
        $("#active").removeAttr("id");
        $(".b-login").hasClass("open") ? $(".b-login").attr("id", "active") : $(".b-login").removeAttr("id");
    });

    // авторизация
    $(".b-login input[type='button']").live("click", function () {
        phone.connect();
    });

    // открываем/закрываем громкость
    $(".b-display__header__volume").live("click", function () {
        if ($(".b-display__header__login").text() != "Log in")    $(".b-volume").hasClass("open") ? $(".b-volume").removeClass("open") : $(".b-volume").addClass("open");
    });
    // регулятор громкости
    $("#volume").slider({
        value: 60,
        orientation: "horizontal",
        range: "min",
        animate: true,
        slide: function (event, ui) {
            Flashphoner.getInstance().setVolume(ui.value);
        }
    });
    // вывод уровня громкости около регулятора
    $(".volume-percent").html($("#volume").slider("value") + "%");

    // всё то же самое с микрофоном
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

    // клик на значок видео в "шапке"
    $(".b-display__header__video").live("click", function () {
        if ($(".b-video").hasClass("open")) {			// открываем/закрываем главное окно видео и меняем класс video у body
            $(".b-video").removeClass("open").removeAttr("id");
            $("body").removeClass("video");
        } else {
            $("#active").removeAttr("id");
            $(".b-video").addClass("open").attr("id", "active");
            $("body").addClass("video");
        }
        if ($(".voice_call__call").hasClass("open")) {
            $(".b-video__video").addClass("open");
        }// если идёт разговор, выводим картинку собеседника
    });
    // закрытие видео по клику на (Х)
    $(".b-video__close").live("click", function (e) {
        $(".b-video").removeClass("open").removeAttr("id");
        return false;
    });
    // изменение размеров окна видео
    $(".b-video, .b-login, .b-alert__ban, .b-chat, .b-transfer").draggable();	// а ещё его можно таскать!
    $(".b-video").resizable({
        minHeight: 240,
        minWidth: 320,
        aspectRatio: 4 / 3
    });

    // ввод номера телефона
    $(".b-display__bottom__number>span").live("click", function () { // кликнули на надпись "Enter your number here"
        if ($(".b-display__header__login").text() != "Log in") {
            $(this).addClass("close");
            $(".b-numbers__clear").addClass("open");
            $(".b-numbers").addClass("write").focus();
        }
    });
    $(document).keyup(function (event) {								//отслеживаем ввод с клавиатуры
        if (($(".b-numbers").is(":focus")) && (event.keyCode == 8)) {	// если фокус на вводе номера и нажат Backspace
            num = $(".b-numbers").val().length;						// смотрим количество символов в поле, оставшееся после удаления символа
            if (num == 0) {											// если удалили последнюю цифру, возвращаемся в исходную позицию
                $(".b-numbers__clear").removeClass("open");
                $(".b-numbers").removeClass("write");
                $(".b-display__bottom__number>span").removeClass("close");
            }
        }
    });
    $(".b-num td").live("click", function () {
        if ($(".b-display__header__login").text() != "Log in") {
            if (!$(".b-numbers").hasClass("write")) {	// если введены символы, убирием блок с надписью
                $(".b-display__bottom__number>span").addClass("close");
                $(".b-numbers").addClass("write").next().addClass("open");
            }
            if (phone.currentCall &&
                (CallStatus.ESTABLISHED == phone.currentCall.status || CallStatus.HOLD == phone.currentCall.status)) {
                phone.sendDTMF(phone.currentCall.callId, $(this).text());
            } else {
                if ($(".b-transfer").hasClass("open")) {
                    $("#transfer").val($("#transfer").val() + $(this).text());
                } else if (!phone.currentCall){
                    $(".b-numbers").val($(".b-numbers").val() + $(this).text());
                }
            }
        }
    });
    // удаление символов
    $(".b-numbers__clear").live("click", function () {
        $(".b-numbers").val($(".b-numbers").val().substring(0, $(".b-numbers").val().length - 1));
        num = $(".b-numbers").val().length;
        if (num == 0) {	// если удалили последнюю цифру, возвращаемся в исходную позицию
            $(this).removeClass("open");
            $(".b-numbers").removeClass("write");
            $(".b-display__bottom__number>span").removeClass("close");
        }
    });

    // делаем видео или аудиовызов
    $(".b-nav__voice, .b-nav__video").live("click", function () {
        if ($(".b-numbers").hasClass("write")) {  // проверяем, введёт ли номер телефона
            $("body").addClass("voice_call__out");
            $(".call__out__dial").addClass("open").html($(".call__out__dial").html() + " " + $(".b-numbers").val());	// открываем блок дозвона и прописываем туда номер телефона, на который звоним
            if ($(this).hasClass("b-nav__video")) {
                $("body").addClass("video")
            } // если это видеозвонок, добавляем класс body (нужно для отображение алерта)

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

    // отвечаем на входящий звонок
    $(".b-nav__answer, .b-nav__answer_video").live("click", function () {
        if ($(this).hasClass("b-nav__answer_video")) {	// если видеозвонок, открываем окно с видео
            $("body").addClass("video");
        }
        if (phone.currentCall) {
            phone.answer(phone.currentCall, $(this).hasClass("b-nav__answer_video"));
        }
    });

    $(".voice_call__stop").live("click", function () {	// если разговор на паузе
        if (phone.currentCall) {
            phone.hold(phone.currentCall);
        }
    });

    $(".voice_call__play").live("click", function () {	// вернулись к разговору
        $(this).removeClass("open");					// скрыли кнопку Play
        if ($("body").hasClass("video")) $(".b-video").addClass("open");	// если было видео, то открываем его обратно
        $("#transfer").val("");											// обнуляем значение в окне переадресации
        $(".voice_call__call__pause, .b-transfer").removeClass("open");	// скрываем окно паузы и окно переадресации (если было открыто)
        $(".voice_call__stop").addClass("open");						// делаем видимой кнопку паузы звонка
        $(".voice_call__call__play").removeClass("close");				// открываем окно разговора
        $(".voice_call__transfer").removeClass("tr_call__pause");		// удаляем класс у кнопки трансфера (если этот класс есть, то после отмены переадресции
        // мы возвращаемся к окну удержания звонка, если  класса нет - идёт возврат к разговору)
        phone.time();															// продолжаем отсчёт времени
    });

    $(".voice_call__transfer").live("click", function () {							// если нажали кнопку переадресации
        $(".voice_call__stop, .voice_call__play, .b-video").removeClass("open");	// скрывает все кнопки и видео (если есть)
        $(".voice_call__call__play, .voice_call__transfer").addClass("close");		// скрываем окно разговора и кнопку переадресции
        $(".b-transfer, .voice_call__call__pause").addClass("open");				// открываем окно переадресации и окно паузы
        $(".b-transfer").attr("id", "active");
        $("#transfer").focus();														// ставим фокус на поле с вводом номера
    });

    $(".b-transfer__chancel").live("click", function () {							// если нажали "отмена"
        if ($(".voice_call__transfer").hasClass("tr_call__pause")) {				// если исходное положение было "на удержании"
            $(".voice_call__play").addClass("open");							// делем видимой кнопку возврата к разговору (play)
        } else {																// иначе открываем окно видео, если был видеовызов, скрываем окно паузы,
            if ($("body").hasClass("video")) $(".b-video").addClass("open");		// открываем окно разговора, запускаем таймер обратно и т.д.
            $(".voice_call__call__play").removeClass("close");
            $(".voice_call__call__pause").removeClass("open");
            $(".voice_call__stop").addClass("open");
            phone.time();
        }
        $("#transfer").val("");													// обнуляем значение окна с переадресацией
        $(".voice_call__transfer").removeClass("close");						// делаем видимой кнопку переадресации на панели
        $(".b-transfer").removeClass("open").removeAttr("id");					// окно переадресации скрываем
    });

    $(".b-nav__chat").live("click", function () {									// при клике на кнопку чата
        if ($(".b-display__header__login").text() != "Log in") {					// снова проверка логина
            $('.b-chat__new__list .mCSB_container').html(phone.chatNames);
            if (!$(this).hasClass("chat")) {										// если у кнопки нет класса chat, значит, окно чата закрыто
                $(this).addClass("chat");										// добавляем класс chat
                $(".b-chat").addClass("open");						// открываем окно чата и добавляем кнопку входящего сообщения
                $(".b-chat").attr("id", "active");
                $(".b-chat_tab.open .b-chat__window").mCustomScrollbar();		// активируем стилизацию скроллбара открытого окна
                phone.chatScrollDown();
            } else {															// если чат открыт, закрываем его и удаляем класс чата у кнопки
                $(this).removeClass("chat");
                $(".b-chat").removeAttr("id");
                $(".b-chat").removeClass("open");
            }
        }
    });
    $(".b-chat__close").live("click", function () {	// клик на (Х) окна чата
        $(".b-nav__chat").removeClass("chat");
        $(".b-chat").removeAttr("id");
        $(".b-chat").removeClass("open");
    });

    $(".b-chat__nav__tab .tab_close").live("click", function () {	// нажали на крестик таба
        var elem = $(this).parent();
        if (elem.attr("id") == "new") {										// если это таб нового окна, его закрывать фу
            $("#" + phone.elem_prev + ", .b-chat_tab." + phone.elem_prev).addClass("open");	// делаем активным предыдущий
            elem.removeClass("open");										// а этот просто скрываем вместе с содержимым
            $(".b-chat_tab." + elem.attr("id")).removeClass("open");
            phone.chatScrollDown();
        } else {
            if (elem.hasClass("open")) {						// если таб открыт
                if (elem.index() > 0) {									// и если это не первый элемент
                    elem.prev().addClass("open");					// делаем активным предыдущий таб и его содержимое
                    $("." + elem.prev().attr("id")).addClass("open");
                } else {											// если таб первый, то активным становится следующий
                    elem.next().addClass("open");
                    $("." + elem.next().attr("id")).addClass("open");
                }
            }
            elem.remove();											// закрываем таб и его содержимое
            $(".b-chat_tab." + elem.attr("id")).remove();
        }
    });
    $(".b-chat").resizable({	// изменение размера окна чата
        minHeight: 395,
        minWidth: 500
    });

    $(".b-chat__text input").live("click", function () {	// при клике на "Отправить" в чате
        var body = $(this).prev().val().replace(/\n/g, "<br />");
        var message = new Message();
        message.to = $(".b-chat__nav__tab.open span.tab_text").html();
        message.body = body;
        phone.sendMessage(message);

        $('<div id="message_' + message.id + '" class="b-chat__message my_message"><div class="b-chat__message__head"><span class="b-chat__message__time">' + new Date().toLocaleString() + '</span><span class="b-chat__message__author">' + $("input[id='sipLogin']").val() + '</span></div><div class="b-chat__message__text">' + body + '</div></div>').appendTo($(".mCSB_container", $(this).parent().prev()));
        phone.chatScrollDown();
        $(this).prev().val(""); // очищаем textarea
    });

    $(".b-chat__nav__tab .tab_text").live("click", function () {						// при клике на таб
        var elem = $(this).parent();
        phone.chatSelectTab(elem);
    });

    $("#new__chat").keyup(function () {			// вводим ники
        $(".b-chat__new__list").addClass("open");
        $(".b-chat__new__nav").addClass("open");	// делаем активными кнопки под списком
    });
    $(".b-chat__new__list p").live("click", function () {			// при клике на ник, выбираем его (я тебя запомнил)
        $(".b-chat__new__list p.active").removeClass("active");
        $(this).addClass("active");
        $("#new__chat").val($(this).html());
    });
    $(".b-chat__new__chancel").live("click", function () {		// при клике на отмену во время поиска собеседник
        $(".b-chat__new__list p.active").removeClass("active");	// снимаем активый класс с выбранного ранее ника (если таковой был)
        $("#new__chat").val("");								// очищаем поле поиска
        $(".b-chat__new__nav, .b-chat__new__list, .b-chat__nav__tab#new, .b-chat_tab.new").removeClass("open");	// скрываем всё (список, кнопки, вкладку)
        $("#" + phone.elem_prev + ", .b-chat_tab." + phone.elem_prev).addClass("open");	// делаем активным сохранённый ранее таб
        phone.chatScrollDown();
    });
    $(".b-chat__new__ok").live("click", function () {				// выбрали ник для нового диалогового окна
        var chatUsername = $("#new__chat").val();
        phone.chatCreateTab(chatUsername);
    });
    $(".b-video, .b-login, .b-chat, .b-alert__ban").mousedown(function () { // если нажали на какой-то всплывающий блок, он выходит на первое место
        $("#active").removeAttr("id");
        $(this).attr("id", "active");
    });

    $(".b-nav__chancel_call, .close, .b-transfer__ok, .b-nav__hangup").live("click", function () {	// возвращаемся на исходный экран из разных позиций
        if (phone.currentCall) {
            phone.hangup(phone.currentCall);
        }
    });
});