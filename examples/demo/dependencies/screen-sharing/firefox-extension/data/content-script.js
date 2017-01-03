
self.port.emit("isDomainEnabled", window.wrappedJSObject.location + "");

self.port.on("domainCheckResult", function(result) {
    if (window.wrappedJSObject.Flashphoner) {
        if (typeof window.wrappedJSObject.Flashphoner.getInstance !== "undefined") {
            window.wrappedJSObject.Flashphoner.getInstance().firefoxScreenSharingExtensionInstalled = result;
        } else {
            window.wrappedJSObject.Flashphoner.firefoxScreenSharingExtensionInstalled = result;
        }
    }
});