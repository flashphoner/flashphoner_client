function startUnitTests() {
    testConvertMessageBody();
}

function testConvertMessageBody(){
    //var messageBody="<?xml version=\"1.0\" encoding=\"UTF-8\"?><fs-services xmlns=\"urn:vas:params:xml:ns:fs-services\"><fs-service action=\"servicenoti-indicate\"><mcn><mcn-data sender_sip=\"user@domain\" sender=\"0154100509\" time=\"2013-10-30T12:57:04+08:00\"/></mcn></fs-service></fs-services>";
    var messageBody="<fs-services xmlns=\"urn:vas:params:xml:ns:fs-services\"><fs-service action=\"serviceinfo-confirm\"><mcn><mcn-data status=\"subscriber_reg\"/></mcn></fs-service></fs-services>"
    var contentType="application/fsservice+xml";
    var res = convertMessageBody(messageBody,contentType);
    trace("testConvertMessageBody "+res);
}