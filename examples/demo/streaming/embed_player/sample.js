function init_page() {
    $("#url").val(setURL());
    $("#testBtn").click(function(){
        $("#fp_embed_player").attr('src', "player.html?urlServer="+$("#url").val()+"&streamName="+$("#streamName").val() +"&autoplay=true")
    });
}