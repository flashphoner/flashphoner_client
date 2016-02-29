
self.port.emit("isDomainEnabled", unsafeWindow.location + "");

self.port.on("domainCheckResult", function(result) {
    if (unsafeWindow.Flashphoner) {
        unsafeWindow.Flashphoner.getInstance().firefoxScreenSharingExtensionInstalled = result;
    }
});