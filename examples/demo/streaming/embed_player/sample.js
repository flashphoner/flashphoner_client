function init_page() {
    $("#sortable").sortable({
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

    var getSkin = function() {
        return $('#skin').prop("checked") ? "light" : "dark";
    };
    $("#testBtn").click(function () {
        $("#fp_embed_player").attr('src', "player.html?" +
            "urlServer=" + $("#url").val() + "&" +
            "streamName=" + $("#streamName").val() + "&" +
            "mediaProviders=" + getMediaProviders() + "&" +
            "skin=" + getSkin() + "&" +
            "autoplay=true")
    });
    $("#clipboardBtn").click(function () {
        window.copyToClipboard($("#codeTextArea").text());
    });

    var constructCode = function () {
        var url = getAdminUrl() + "/embed_player?" +
            "urlServer=" + $("#url").val() + "&" +
            "streamName=" + $("#streamName").val() + "&" +
            "mediaProviders=" + getMediaProviders() + "&" +
            "skin=" + getSkin();
        $("#codeTextArea").text("<iframe id='fp_embed_player' src='" + url + "' " +
            "marginwidth='0' marginheight='0' frameborder='0' width='100%' height='100%' scrolling='no' allowfullscreen='allowfullscreen'></iframe>")
    };
    $('#url,#streamName').keyup(function () {
        constructCode();
    });
    $('#WebRTC,#Flash,#MSE,#WSPlayer,#skin').change(function() {
        constructCode();
    });
    constructCode();
}