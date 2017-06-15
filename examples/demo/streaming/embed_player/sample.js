function init_page() {
    $("#url").val(setURL());
    $("#testBtn").click(function(){
        $("#fp_embed_player").attr('src', "player.html?urlServer="+$("#url").val()+"&streamName="+$("#streamName").val() +"&autoplay=true")
    });
    $("#clipboardBtn").click(function(){
        window.copyToClipboard($("#codeTextArea").text());
    });

    var constructCode = function () {
        var url = getAdminUrl()+ "/embed_player?urlServer="+$("#url").val()+"&streamName="+$("#streamName").val();
        $("#codeTextArea").text("<iframe id='fp_embed_player' src='"+url+"' " +
            "marginwidth='0' marginheight='0' frameborder='0' width='100%' height='100%' scrolling='no' allowfullscreen='allowfullscreen'></iframe>")
    };

    $('#url').keyup(function() {
        constructCode();
    });
    $('#streamName').keyup(function() {
        constructCode();
    });
    constructCode();
}