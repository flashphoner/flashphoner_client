if (window.wrappedJSObject.Flashphoner) {
    if (typeof window.wrappedJSObject.Flashphoner.getInstance !== "undefined") {
        window.wrappedJSObject.Flashphoner.getInstance().firefoxScreenSharingExtensionInstalled = true;
    } else {
        window.wrappedJSObject.Flashphoner.firefoxScreenSharingExtensionInstalled = true;
    }
}