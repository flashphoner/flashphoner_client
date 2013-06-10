/**
 * Created with JetBrains WebStorm.
 * User: Alex
 * Date: 6/10/13
 * Time: 3:09 PM
 * To change this template use File | Settings | File Templates.
 */
var Messenger = function (webSocketManager) {
    this.webSocketManager = webSocketManager;
    this.sentMessages = new Object();
};

Messenger.prototype = {

    notifyMessage: function (message, notificationResult, sipObject) {
        var sentMessage = this.sentMessages[message.id];
        if (sentMessage != null) {
            sentMessage.state = message.state;
            if (sentMessage.state == "SENT") {
                notifyMessageSent(sentMessage);
            } else if (sentMessage.state == "ACCEPTED") {
                notifyMessageAccepted(sentMessage);
            } else if (sentMessage.state == "FAILED"){
                notifyMessageFailed(sentMessage);
            } else if (sentMessage.state == "DELIVERED"){
                notifyMessageDelivered(sentMessage);
            }
        }else {
            //received message
            notifyMessageReceived(message);
            notificationResult.status="OK";
            this.sendResult(notificationResult);                         3
        }
    },

    sendResult: function(result){
        this.webSocketManager.webSocket.send("notificationResult", result);
    },

    sendMessage: function (message) {
        this.saveSentMessage(message);
        this.webSocketManager.webSocket.send("sendInstantMessage", message);
    },

    saveSentMessage: function (message) {
        var id = this.createUUID();
        message.id = id;
        this.sentMessages[id] = message;
    },

    createUUID: function () {
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4";
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
        s[8] = s[13] = s[18] = s[23] = "-";

        var uuid = s.join("");
        return uuid;
    }
}