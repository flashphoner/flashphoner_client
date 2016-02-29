var self = require("sdk/self");

var prefService = require('sdk/preferences/service');
var configToReferListOfAllowedDomains = 'media.getusermedia.screensharing.allowed_domains';

// replace your own domains with below array
var arrayOfMyOwnDomains = ['*.flashphoner.com', 'flashphoner.com', 'localhost', '127.0.0.1'];
var listOfSimilarAlreadyAllowedDomains = [];

function addMyOwnDomains() {
  var existingDomains = prefService.get(configToReferListOfAllowedDomains).split(',');
  arrayOfMyOwnDomains.forEach(function(domain) {
    if (existingDomains.indexOf(domain) === -1) {
      existingDomains.push(domain);
    } else {
      // Seems domain is already in the list.
      // Keep it when this addon is uninstalled.
      listOfSimilarAlreadyAllowedDomains.push(domain);
    }
  });
  prefService.set(configToReferListOfAllowedDomains, existingDomains.join(','));
}
addMyOwnDomains();

function removeMyDomainOnUnInstall() {
  var externalDomains = [];
  prefService.get(configToReferListOfAllowedDomains).split(',').forEach(function(domain) {
    // Skip Others Domains
    if (arrayOfMyOwnDomains.indexOf(domain) === -1) {
      // if its NOT mine, keep it.
      externalDomains.push(domain);
    } else if (listOfSimilarAlreadyAllowedDomains.indexOf(domain) !== -1) {
      // seems that localhost/127.0.0.1 are already added by external users
      externalDomains.push(domain);
    }
  });
  prefService.set(configToReferListOfAllowedDomains, externalDomains.join(','));
}

var urls = require("sdk/url");
function isDomainEnabled(tabUrl) {
  var url = urls.URL(tabUrl);
  var host = url.host;
  if (url.port) {
    host = host.replace(":"+url.port, "");
  }
  var ret = false;
  prefService.get(configToReferListOfAllowedDomains).split(',').forEach(function(domain) {
    var base = new RegExp("^"+domain.replace(/\*/g, "[^ ]*").replace(/\./g, "\\."));
    if (base.test(host)) {
      ret = true;
    }
  });
  return ret;
}

var {when: unload} = require("sdk/system/unload");

// By AMO policy global preferences must be changed back to their original value
unload(function() {
  // remove only my own domains
  removeMyDomainOnUnInstall();
});

var data = require("sdk/self").data;
var pageMod = require("sdk/page-mod");

pageMod.PageMod({
  include: "*",
  contentScriptFile: data.url("content-script.js"),
  contentScriptWhen: "end",
  attachTo: ["existing", "top", "frame"],
  onAttach: function(worker) {
    worker.port.on("isDomainEnabled", function(url) {
      var ret = isDomainEnabled(url);
      worker.port.emit("domainCheckResult", ret);
    });
  }
});
