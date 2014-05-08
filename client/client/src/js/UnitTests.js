function startUnitTests() {
    testConvertMessageBody();
    testUnknownMsgFiltering();
}

function testConvertMessageBody() {
    var messageBodies = [
        ["<?xml version=\"1.0\" encoding=\"UTF-8\"?><fs-services xmlns=\"urn:vas:params:xml:ns:fs-services\"><fs-service action=\"servicenoti-indicate\"><mcn><mcn-data sender_sip=\"user@domain\" sender=\"0154100509\" time=\"2013-10-30T12:57:04+08:00\"/></mcn></fs-service></fs-services>", "application/fsservice+xml"],
        ["<fs-services xmlns=\"urn:vas:params:xml:ns:fs-services\"><fs-service action=\"serviceinfo-confirm\"><mcn><mcn-data status=\"subscriber_reg\"/></mcn></fs-service></fs-services>", "application/fsservice+xml"],
        ["<?xml version=\"1.0\" encoding=\"UTF-8\"?><ums-services xmlns=\"urn:vas:params:xml:ns:ums-services\"><ums-service action=\"notification\"><ni><ni-data sender=\"0154100533\" recipient=\"ytl_ott_user59@yes1.my\" time=\"2014-05-07T08:01:12+08:00\" content=\"You have 1 voice message(s) and 1 unread(s). $name\"/></ni></ums-service></ums-services>", "application/vnd.oma.push"],
        ["<?xml version=\"1.0\" encoding=\"UTF-8\"?><ums-services xmlns=\"urn:vas:params:xml:ns:ums-services\"><ums-service action=\"notification\"></ums-service></ums-services>", "application/vnd.oma.push"]
    ];

    for (i = 0; i < messageBodies.length; i++) {
        var res = convertMessageBody(messageBodies[i][0],messageBodies[i][1]);
        if (res) {
            trace("Phone - testConvertMessageBody "+res);
        } else {
            trace("Phone - message discarded");
        }
    }
}

function testUnknownMsgFiltering() {
    var messageObj = new Object();
    messageObj.from = "tel:0123456789";
    messageObj.body = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ums-services xmlns=\"urn:vas:params:xml:ns:ums-services\"><ums-service action=\"notification\"></ums-service></ums-services>";
    messageObj.contentType = "application/vnd.oma.push";
    notifyMessageReceived(messageObj);

    var messageObj = new Object();
    messageObj.from = "tel:0123456789";
    messageObj.body = "text message";
    messageObj.contentType = "text/plain";
    notifyMessageReceived(messageObj);
}