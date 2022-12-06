function init_page() {

    $('[data-toggle="tooltip"]').tooltip();

    $("#sortable").sortable({
        handle: ".ui-icon",
        cancel: ".check-label",
        stop: function () {
            constructCode();
        }
    });
    $("#sortable").disableSelection();
    $("#url").val(setURL());

    var getMediaProviders = function () {
        var mediaProviders = "";
        var inputs = $("#sortable").find("input:checked");
        inputs.each(function (i, e) {
            mediaProviders += e.id;
            if (i !== inputs.length - 1) {
                mediaProviders += ',';
            }
        });
        return mediaProviders;
    };

    $("#testBtn").click(function () {
        $("#fp_embed_player").attr('src', "player.html?" +
            "urlServer=" + $("#url").val() + "&" +
            "streamName=" + encodeURIComponent($("#streamName").val()) + "&" +
             "mediaProviders=" + getMediaProviders() + "&" +
            "autoplay=false");
    });
    $("#clipboardBtn").click(function () {
        window.copyToClipboard($("#codeTextArea").text());
    });

    var constructCode = function () {
        var url = getAdminUrl() + "/embed_player?" +
        "urlServer=" + $("#url").val() + "&" +
            "streamName=" + encodeURIComponent($("#streamName").val()) + "&" +
        "mediaProviders=" + getMediaProviders();
        $("#codeTextArea").text("<iframe id='fp_embed_player' src='" + url + "' " +
            "marginwidth='0' marginheight='0' frameborder='0' width='100%' height='100%' scrolling='no' allowfullscreen='allowfullscreen'></iframe>")
    };
    $('#url,#streamName').on('input',function () {
        constructCode();
    });
    $('#WebRTC,#MSE,#WSPlayer').change(function() {
        constructCode();
    });
    constructCode();

    // Add dark style to player frame
    $('#fp_embed_player').contents().find('html').addClass('dark-style');
    $('.fp-remoteVideo').addClass('dark-style-bg');

};