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
    connection.useSelfSigned = !isMobile.any();
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
    var connection = event.connection;
    var sipObject = event.sipObject;
    trace("Phone - registrationStatusListener " + connection.login);

    $(".b-login").removeClass("open").removeAttr("id");
    $(".b-display__header__login").html($("input[id='sipLogin']").val() == "" ? "Log in" : $("input[id='sipLogin']").val()); // передаём введённый логин в интерфейс
    SoundControl.getInstance().playSound("REGISTER");
    this.flashphonerListener.onRegistered();

    if (ConfigurationLoader.getInstance().subscribeEvent != null && ConfigurationLoader.getInstance().subscribeEvent.length != 0) {
        this.subscribe();
    }

    this.sendXcapRequest();
};

Phone.prototype.isVideoCall = function () {
    return $("body").hasClass("video");
};

Phone.prototype.isUseWebRTC = function () {
    return true;
};

$(document).ready(function () {

    var phone = new Phone();

    ConfigurationLoader.getInstance(function () {
        trace("Configuration loaded");
        Flashphoner.getInstance().init($(".b-video__small"), $(".b-video__video"), "../../dependencies/flash/MediaManager.swf");
        phone.init();
    });

    // проверяем на ИЕ и добавляем изменение кнопки на видеозвонке
    if ((navigator.appName == "Microsoft Internet Explorer") || (document.body.style.msTextCombineHorizontal != undefined)) {
        $("html").addClass("ie")
    }
    ;
    $(".b-ie_video").live("click", function () {
        $(this).text() == "send video" ? $(this).text("stop video") : $(this).text("send video");
    });

    $(".ie body").attr("onselectstart", "return false");

    // функция отсчёта времени
    var time = function () {
        var timer = setInterval(function () {
            start++;
            if (start > 59) {
                start = 0;
                min++;
                if (min < 10) {
                    $(".b-min").html("0" + min);
                } else $(".b-min").html(min);
            }
            ;
            if (start < 10) {
                $(".b-sec").html("0" + start);
            } else $(".b-sec").html(start);
        }, 1000);
        $(".b-nav__chancel_call, .close, .voice_call__stop, .voice_call__transfer, .chat").live("click", function () {
            clearInterval(timer); // останавливаем таймер
        });
    };

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
            $(".volume-percent").html(ui.value + "%");
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
        if ($(".b-display__header__login").text() != "Log in") {	// действия возможны только если введён логин (сюда любую проверку)
            if ($(".b-numbers").hasClass("write")) {			// и если введён номер телефона (т.е. идёт вызов или звонок)
                if ($(".b-video").hasClass("open")) {			// открываем/закрываем главное окно видео и меняем класс video у body
                    $(".b-video").removeClass("open").removeAttr("id");
                    $("body").removeClass("video");
                } else {
                    $("#active").removeAttr("id");
                    $(".b-video").addClass("open").attr("id", "active");
                    $("body").addClass("video");
                }
                ;
                if ($(".voice_call__call").hasClass("open")) {
                    $(".b-video__video").addClass("open")
                }
                ; // если идёт разговор, выводим картинку собеседника
            }
            ;
        }
        ;
    });
    // закрытие видео по клику на (Х)
    $(".b-video__close").live("click", function (e) {
        $(".b-video").removeClass("open").removeAttr("id");
        return false;
    });
    // изменение размеров окна видео
    $(".b-video, .b-login, .b-alert__ban, .b-chat, .b-transfer").draggable();	// а ещё его можно таскать!
    $(".b-video__video").resizable({
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
        ;
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
            if ($(".b-transfer").hasClass("open")) {		// ввод номера телефона при переадресации звонка
                $("#transfer").val($("#transfer").val() + $(this).text());
            } else {
                $(".b-numbers").val($(".b-numbers").val() + $(this).text());
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
            $("body").addClass("voice_call__out").addClass("mike"); // добавляем body клaсс mike для отображения микрофона в шапке
            $(".take").removeClass("open");	// скрываем кнопку входяшего вызова (справа) - удалить при программировании
            $(".call__out__dial").addClass("open").html($(".call__out__dial").html() + " " + $(".b-numbers").val());	// открываем блок дозвона и прописываем туда номер телефона, на который звоним
            if ($(this).hasClass("b-nav__video")) {
                $("body").addClass("video")
            } // если это видеозвонок, добавляем класс body (нужно для отображение алерта)
            if ($("body").hasClass("video")) {	// если это видеозвонок, делаем запрос на камеру+микрофон, нет - на микрофон
                // + проверяем на ИЕ и в зависимости от этого меняем текст сообщения
                $("html").hasClass("ie") ? $(".b-alert").html("Please <span>allow</span> access to your web camera and microphone.") : $(".b-alert").text("please let me use the camera and microphone").addClass("video_alert");
            } else {
                $("html").hasClass("ie") ? $(".b-alert").html("please <span>allow</span> access to audio device") : $(".b-alert").text("please allow access to audio device");
            }
            phone.call($(".b-numbers").val());
            // делаем видимыми кнопки "разрешить" и "запретить" справа - удалить при программировании
            //$(".b-buttons .allow, .b-buttons .ban").addClass("open");
        }
    });

    // отвечаем на входящий звонок
    $(".b-nav__answer, .b-nav__answer_video").live("click", function () {
        if ($(this).hasClass("b-nav__answer_video")) {	// если видеозвонок, открываем окно с видео
            $("body").addClass("video");
            $("html").hasClass("ie") ? $(".b-alert").html("Please <span>allow</span> access to your web camera and microphone.").addClass("video_alert") :
                $(".b-alert").text("please let me use the camera and microphone").addClass("video_alert"); // и выводим запрос на камеру с микрофоном
        } else {
            $("html").hasClass("ie") ? $(".b-alert").html("please <span>allow</span> access to audio device") : $(".b-alert").text("please allow access to audio device");	// иначе просто выводим запрос на микрофон
        }
        $(".b-buttons .allow, .b-buttons .ban, .b-alert").addClass("open"); // открываем окно алерта и кнопки "разрешить"/"запретить" (последние удалить при программировании)
    });

    // если всё-таки разрешили микрофон/микрофон+камеру
    $(".allow").live("click", function () {	// условие при программировании подставить своё
        $(".mike").removeClass("mike");	// удаляем класс с микрофоном и его регулятором
        $(".b-alert, .b-nav__inc, .b-alert__ban, .b-buttons .allow, .b-buttons .ban, .call__inc__dial").removeClass("open"); // скрываем кучу ненужных кнопок, окон, а также кнопки "разрешить"/"запретить"
        $(".b-nav").removeClass("close");	// открываем обратно стандартные кнопки навигации (если были скрыты при входящем звонке, к примеру)
        $("body").hasClass("video") ? $(".b-video, .hook").addClass("open") : $(".hook").addClass("open");	// если это видео, открываем его и делаем видимой кнопку, моделирующую ответ собеседника (hook при программировании убрать)
        $(".b-nav__chancel_call span").text("Hangup");	// меняем текст кнопки отмены
        if ($("body").hasClass("voice_call__inc")) {	// если это входящий звонок
            if ($("body").hasClass("video")) {
                $(".b-video__video").addClass("open")
            }
            ; // и если это видеозвонок, открываем большое видео собеседника сразу
            $(".voice_call__call").addClass("open");	//открываем окно с разговором
            start = min = 0;							// обнуляем и запускаем счётчик времени
            time();
            $(".interlocutor2").text("User5");			// указываем в окне разговора ник собеседника (подставить своё при программировании)
        }
        ;
    });

    $(".b-buttons .ban").live("click", function () {	// если запретили микрофон или микрофон и камеру
        $(".mike").removeClass("mike");				// закрываем значок микрофона в шапке
        $(".b-alert__ban").addClass("open");		// выводим предупреждение на экран (уверены ли вы)
        $(".b-buttons .allow, .b-buttons .ban").removeClass("open");	// скрываем кнопки "разрешить" и "запретить"
    });

    $(".hook").live("click", function () {			// если сняли трубку
        $(".call__out__dial").removeClass("open");	// скрываем окно вызова
        $(".voice_call__call").addClass("open");	// открываем окно разговора
        $(".b-nav__chancel_call span").text("Hangup");	// меняем текст красной кнопки
        $(".interlocutor2").text($(".b-numbers").val());	//указываем номер собеседника в окне разговора (или что угодно, что нужно вставить)
        $(".b-time").html("<span class='b-min'>00</span>:<span class='b-sec'>00</span>");	// обнуляем старый счётчик
        start = min = 0;																	//
        time();																				// и запускаем заново
        $(this).removeClass("open");														// скрываем кнопку приёма вызова (удалить при программировании)
        if ($("body").hasClass("video")) $(".b-video__video").addClass("open");	// если видеозвонок, открыть видео собеседника (он ответил и тепеть его видно)
    });

    $(".voice_call__stop").live("click", function () {	// если разговор на паузе
        $(this).removeClass("open");					// скрываем кнопку паузы
        $(".voice_call__play, .voice_call__call__pause").addClass("open");	// делаем видимой кнопку возврата к разговору и окно паузы
        $(".voice_call__call__play").addClass("close");		// скрываем окно разгоора
        $(".b-video").removeClass("open");					// скрываем видео (если есть)
        $(".voice_call__transfer").addClass("tr_call__pause");	// добавляем класс кнопке трансфера, чтобы знать, куда потом, если что, возвращаться
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
        time();															// продолжаем отсчёт времени
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
            time();
        }
        ;
        $("#transfer").val("");													// обнуляем значение окна с переадресацией
        $(".voice_call__transfer").removeClass("close");						// делаем видимой кнопку переадресации на панели
        $(".b-transfer").removeClass("open").removeAttr("id");					// окно переадресации скрываем
    });

    $(".take").live("click", function () {										// входящий звонок
        if ($(".b-display__header__login").text() != "Log in") {					// если мы авторизированы
            $("body").addClass("voice_call__inc");								// добавляем класс входящего вызова body
            $(".b-nav").addClass("close");										// скрываем обычные чёрные кнопки и делаем видимы кнопки ответа на звонок
            $(".b-nav__inc, .call__inc__dial").addClass("open");
            $(".take").removeClass("open");										// скрываем кнопку входящего звонка
        }
        ;
    });

    $(".b-nav__chat").live("click", function () {									// при клике на кнопку чата
        if ($(".b-display__header__login").text() != "Log in") {					// снова проверка логина
            if (!$(this).hasClass("chat")) {										// если у кнопки нет класса chat, значит, окно чата закрыто
                $(this).addClass("chat");										// добавляем класс chat
                $(".b-chat, .message").addClass("open");						// открываем окно чата и добавляем кнопку входящего сообщения
                $(".b-chat").attr("id", "active");
                $(".b-chat_tab.open .b-chat__window").mCustomScrollbar();		// активируем стилизацию скроллбара открытого окна
                $(".b-chat_tab.open .b-chat__window .mCSB_container").css("top", $(".b-chat_tab.open .b-chat__window .mCSB_container").height() - $(".b-chat_tab.open .b-chat__window .mCSB_container").parent().height() + 20 + "px"); // прокручиваем скроллбар вконец
                for (i = 0; i < $(".my_message .b-chat__message__author").length; i++) {				// задаём свой логин в истории сообщений
                    $($(".my_message .b-chat__message__author")[i]).text($("input[id='login']").val());
                }
                ;
            } else {															// если чат открыт, закрываем его и удаляем класс чата у кнопки
                $(this).removeClass("chat");
                $(".b-chat").removeAttr("id");
                $(".b-chat, .message").removeClass("open");
            }
            ;
        }
        ;
    });
    $(".b-chat__close").live("click", function () {	// клик на (Х) окна чата
        $(".b-nav__chat").removeClass("chat");
        $(".b-chat").removeAttr("id");
        $(".b-chat, .message").removeClass("open");
    });
    $(".message").live("click", function () { // входящее сообщение в чате
        $('<div class="b-chat__message"><div class="b-chat__message__head"><span class="b-chat__message__time">15:16</span><span class="b-chat__message__author">Author message</span></div><div class="b-chat__message__text">В следующую минуту выяснилось, что председатель биржевого комитета не имеет возможности принять участие в завтрашней битве.</div></div>').appendTo($(".b-chat_tab.open .mCSB_container"));
        $(".b-chat_tab.open .b-chat__window .mCSB_container").css("top", $(".b-chat_tab.open .mCSB_container").height() - $(".b-chat_tab.open .mCustomScrollBox").height() + 20 + "px"); // прокручиваем скроллбар в конец

    });

    $(".b-chat__nav__tab .tab_close").live("click", function () {	// нажали на крестик таба
        elem = $(this).parent();
        if (elem.attr("id") == "new") {										// если это таб нового окна, его закрывать фу
            $("#" + elem_prev + ", .b-chat_tab." + elem_prev).addClass("open");	// делаем активным предыдущий
            elem.removeClass("open");										// а этот просто скрываем вместе с содержимым
            $(".b-chat_tab." + elem.attr("id")).removeClass("open");
            $(".b-chat_tab.open .b-chat__window .mCSB_container").css("top", $(".b-chat_tab.open .b-chat__window .mCSB_container").height() - $(".b-chat_tab.open .b-chat__window .mCSB_container").parent().height() + 20 + "px"); // прокручиваем скроллбар в конец
        } else {
            if (elem.hasClass("open")) {						// если таб открыт
                if (elem.index() > 0) {									// и если это не первый элемент
                    elem.prev().addClass("open");					// делаем активным предыдущий таб и его содержимое
                    $("." + elem.prev().attr("id")).addClass("open");
                } else {											// если таб первый, то активным становится следующий
                    elem.next().addClass("open");
                    $("." + elem.next().attr("id")).addClass("open");
                }
                ;
            }
            ;
            elem.remove();											// закрываем таб и его содержимое
            $(".b-chat_tab." + elem.attr("id")).remove();
        }
        ;
    });
    $(".b-chat").resizable({	// изменение размера окна чата
        minHeight: 395,
        minWidth: 500
    });

    $(".b-chat__text input").live("click", function () {	// при клике на "Отправить" в чате
        $('<div class="b-chat__message my_message"><div class="b-chat__message__head"><span class="b-chat__message__time">15:16</span><span class="b-chat__message__author">' + $("input[id='login']").val() + '</span></div><div class="b-chat__message__text">' + $(this).prev().val().replace(/\n/g, "<br />") + '</div></div>').appendTo($(".mCSB_container", $(this).parent().prev()));
        $(".b-chat_tab.open .b-chat__window .mCSB_container").css("top", $(".b-chat_tab.open .b-chat__window .mCSB_container").height() - $(".b-chat_tab.open .b-chat__window .mCSB_container").parent().height() + 20 + "px"); // прокручиваем скроллбар в конец
        $(this).prev().val(""); // очищаем textarea
    });

    $(".b-chat__nav__tab .tab_text").live("click", function () {						// при клике на таб
        elem = $(this).parent();
        if (!elem.hasClass("open")) {												// если таб не активен
            elem_prev = $(".b-chat__nav__tab.open").attr("id");						// сохраняем id предыдущего таба
            $(".b-chat__nav__tab.open, .b-chat_tab.open").removeClass("open");		// активный таб и его содержимое скрываем
            elem.addClass("open");													// делаем таб и его содержимое видимым
            $(".b-chat_tab." + elem.attr("id")).addClass("open");
            $(".b-chat_tab.open .b-chat__window").mCustomScrollbar({				// инициализируем скроллбар
                scrollInertia: 50,
                scrollButtons: {
                    enable: false
                }
            });
            $(".b-chat_tab.open .b-chat__window .mCSB_container").css("top", $(".b-chat_tab.open .b-chat__window .mCSB_container").height() - $(".b-chat_tab.open .b-chat__window .mCSB_container").parent().height() + 20 + "px"); // прокручиваем скроллбар в конец
        }
        ;
    });
    $("#new__chat").keyup(function () {			// вводим ники
        $(".b-chat__new__list").addClass("open").mCustomScrollbar({	// инициализируем список
            scrollInertia: 50,
            scrollButtons: {
                enable: false
            }
        });
        $(".b-chat__new__nav").addClass("open");	// делаем активными кнопки под списком
    });
    $(".b-chat__new__list p").live("click", function () {			// при клике на ник, выбираем его (я тебя запомнил)
        $(".b-chat__new__list p.active").removeClass("active");
        $(this).addClass("active");
    });
    $(".b-chat__new__chancel").live("click", function () {		// при клике на отмену во время поиска собеседник
        $(".b-chat__new__list p.active").removeClass("active");	// снимаем активый класс с выбранного ранее ника (если таковой был)
        $("#new__chat").val("");								// очищаем поле поиска
        $(".b-chat__new__nav, .b-chat__new__list, .b-chat__nav__tab#new, .b-chat_tab.new").removeClass("open");	// скрываем всё (список, кнопки, вкладку)
        $("#" + elem_prev + ", .b-chat_tab." + elem_prev).addClass("open");	// делаем активным сохранённый ранее таб
        $(".b-chat_tab.open .b-chat__window .mCSB_container").css("top", $(".b-chat_tab.open .b-chat__window .mCSB_container").height() - $(".b-chat_tab.open .b-chat__window .mCSB_container").parent().height() + 20 + "px"); // прокручиваем скроллбар в конец
    });
    $(".b-chat__new__ok").live("click", function () {				// выбрали ник для нового диалогового окна
        $("#new__chat").val("");								// очищаем окно поиска
        $(".b-chat__new__nav, .b-chat__new__list, .b-chat__nav__tab#new, .b-chat_tab.new").removeClass("open"); // опять всё закрываем
        $(".b-chat__nav__tab#new").before('<div class="b-chat__nav__tab open" id="tab' + $(".b-chat__nav__tab").length + '"><span class="tab_text">' + $(".b-chat__new__list p.active").text() + '</span><span class="tab_close"></span></div>'); // id табам задаётся якобы автоматически, но лучше id как-то генерировать независимо от числа табов, иначе может получиться 2 таба с одним id. Проще это пресечь сразу, чем делать 100 проверок при создании таба ИМХО
        $(".b-chat__new__list p.active").removeClass("active");
        $(".b-chat_tab.new").before('<div class="b-chat_tab open ' + $(".b-chat__nav__tab.open").attr("id") + '"><div class="b-chat__window mCustomScrollbar"></div><div class="b-chat__text"><textarea></textarea><input type="button" value="send" /></div></div>');
        $(".b-chat_tab.open .b-chat__window").mCustomScrollbar({ // если вдруг будет загрузка истории, инициализируем скроллбар
            scrollInertia: 50,
            scrollButtons: {
                enable: false
            }
        });
        $(".b-chat_tab.open .b-chat__window .mCSB_container").css("top", $(".b-chat_tab.open .b-chat__window .mCSB_container").height() - $(".b-chat_tab.open .b-chat__window .mCSB_container").parent().height() + 20 + "px");  // и прокручиваем скроллбар в конец

        // 328 и 334 строчки удалить, если новое окно всегда будет изначально пустым
    });
    $(".b-video, .b-login, .b-chat, .b-alert__ban").mousedown(function () { // если нажали на какой-то всплывающий блок, он выходит на первое место
        $("#active").removeAttr("id");
        $(this).attr("id", "active");
    });

    $(".b-nav__chancel_call, .close, .b-transfer__ok, .b-nav__hangup").live("click", function () {	// возвращаемся на исходный экран из разных позиций
        $("body").removeAttr("class");								// стираем все классы у body
        $(".voice_call__transfer").removeClass("tr_call__pause");	// обнуляем доп.стиль кнопки переадресации
        $("#transfer").val("");										// стираем значение в окне переадресации, если есть
        $(".call__out__dial").text("calling to");					// возвращаем исходный вид блока исходящего вызова (без номера/ника)
        $(".b-nav__chancel_call span").text("Chancel");				// возвращаем исходное состояние кнопки
        $(".b-numbers").val("");									// стираем набранный номер телефона
        $(".b-numbers").removeClass("write");						// и скрываем блок набора телефона
        $(".b-numbers__clear, .b-mike, .b-alert__ban, .call__out__dial, .call__inc__dial, .voice_call__call, .b-buttons input, .voice_call__play, .voice_call__call__pause, .b-transfer, .b-video, .b-video__video, .b-nav__inc, .b-alert").removeClass("open"); // закрываем кучу блоков, которые по умолчанию скрыты .b-buttons input - можно удалить, это правые кнопки
        $(".b-display__bottom__number>span, .voice_call__call__play, .voice_call__transfer, .b-nav").removeClass("close");	// открываем блоки, которые могли быть скрыты, но по умолчанию видимые
        num = 0;
        $(".b-alert").text("").removeClass("video_alert");	// исходный вид окна с алертом
        $(".interlocutor2").text("");						// очищаем ник собеседника в окне вызова
        $(".b-time").html("<span class='b-min'>00</span>:<span class='b-sec'>00</span>");	// возвращаем вёрстку таймера на исходную
        $(".voice_call__stop, .take").addClass("open");		// делаем видимыми кнопку паузы разговора и кнопку моделирования входящего звонка
    });
})