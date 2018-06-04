// this background script is used to invoke desktopCapture API
// to capture screen-MediaStream.

var session = ['screen', 'window', 'audio', 'tab'];

function getSourceID(sender, callback) {
    // as related in https://code.google.com/p/chromium/issues/detail?id=413602 and https://code.google.com/p/chromium/issues/detail?id=425344 :
    // a frame/iframe requesting screen sharing from a different origin than the parent window
    // will receive the InvalidStateError when using the getUserMedia function.
    // the solution its to change the tab.url property to the same as of the requesting iframe. Its works without iframe as well.
    // requires Chrome 40+
    var tab = sender.tab;
    tab.url = sender.url;
    chrome.desktopCapture.chooseDesktopMedia(session, tab, function (sourceId, opts) {
        // "sourceId" will be empty if permission is denied
        if (!sourceId || !sourceId.length) {
            callback({error: 'permissionDenied'});
            return;
        }
        console.log(opts.canRequestAudioTrack);
        callback({sourceId: sourceId, systemSoundAccess: opts.canRequestAudioTrack});
    });
}

chrome.runtime.onMessageExternal.addListener(function (message, sender, callback) {
    if (message.type === 'getSourceId') {
        getSourceID(sender, callback);
        return true;
    } else if (message.type === 'isInstalled') {
        callback(true);
    }
});
