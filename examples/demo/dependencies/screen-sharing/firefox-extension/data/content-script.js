
self.port.emit("isDomainEnabled", unsafeWindow.location + "");

self.port.on("domainCheckResult", function(result) {
    if (unsafeWindow.Flashphoner) {
        if (typeof unsafeWindow.Flashphoner.getInstance !== "undefined") {
            unsafeWindow.Flashphoner.getInstance().firefoxScreenSharingExtensionInstalled = result;
        } else {
            unsafeWindow.Flashphoner.firefoxScreenSharingExtensionInstalled = result;
        }
    }
});