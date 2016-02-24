Example of screen sharing using wcs api.
For Chrome install extension https://chrome.google.com/webstore/detail/flashphoner-screen-sharin/nlbaajplpmleofphigmgaifhoikjmbkg?hl=en

For Firefox:
with plugin:
- install https://addons.mozilla.org/en-US/firefox/addon/flashphoner-screen-sharing/
- open example from localhost
without plugin:
- open about:config
- add your domain to media.getusermedia.screensharing.allowed_domains
- add "f.firefoxScreenSharingExtensionInstalled = true" to the end of the initAPI() method


