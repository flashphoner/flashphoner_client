# @flashphoner/websdk

# Flashphoner WebCallServer JavaScript API (Web SDK)

Flashphoner [WebCallServer](https://flashphoner.com) JavaScript API (Web SDK) implementation.

## Install
npm install @flashphoner/websdk

## Using prebuild Javascript bundle in browser
two-way-streaming.html:
```HTML
<!DOCTYPE html>
<html lang="en">
<head> 
    <script type="text/javascript" src="node_modules/@flashphoner/websdk/flashphoner.js"></script> 
    <script type="text/javascript" src="two-way-streaming.js"></script> 
</head>
<body onload="init_api()">
    <div id="publish" style="width:320px;height:240px;border: solid 1px"></div>
    <br/><button id="publishBtn">Publish</button><br/>
    <br/>
    <div id="play" style="width:320px;height:240px;border: solid 1px"></div>
    <br/><button id="playBtn">Play</button><br/>
    <br/>
    <br/><button id="stopBtn">Stop</button><br/>
</body>
</html>
```

two-way-streaming.js:
```Javascript
//Constants
var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var session;
var stream;
  
//Init Flashphoner API on page load
function init_api() {
    Flashphoner.init({});
    publishBtn.onclick = connect;
    playBtn.onclick = playStream;
    stopBtn.onclick = stopPublish;
}
  
//Connect to WCS server over websockets
function connect() {
    session = Flashphoner.createSession({
        urlServer: "wss://demo.flashphoner.com"
    }).on(SESSION_STATUS.ESTABLISHED, function(session) {
        publishStream(session);
    });
}
  
//Publish stream
function publishStream(session) {
    stream = session.createStream({
        name: "stream",
        display: document.getElementById("publish"),
    });
    stream.publish();
}
  
//Playing stream
function playStream() {
    session.createStream({
        name: "stream",
        display: document.getElementById("play"),
    }).play();
}
 
//Stopping stream
function stopPublish() {
    stream.stop();
}
```

## More examples

Please look for more examples on [GitHub](https://github.com/flashphoner/flashphoner_client/tree/wcs_api-2.0/examples) and on [this page](https://flashphoner.com/)

## Documentation

Please read the details [here](https://docs.flashphoner.com/display/WEBSDK2EN/Web+SDK+2.0+-+EN) and API docs [here](http://flashphoner.com/docs/api/WCS5/client/web-sdk/latest)

## Known issues

WebSDK is build with [webrtc/adapter](https://github.com/webrtc/adapter/) library version not lower than 7.2.6. In this regard, direct use of this library together with WebSDK should be avoided.