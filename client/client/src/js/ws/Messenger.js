/**
 * Created with JetBrains WebStorm.
 * User: Alex
 * Date: 6/10/13
 * Time: 3:09 PM
 * To change this template use File | Settings | File Templates.
 */
var Messenger = function (flashphoner) {
    this.sentMessages = new Object();
};

Messenger.prototype = {

    notifyMessage: function (message, notificationResult, sipObject) {
        trace("Messenger - notifyMessage message: "+ message+" notificationResult: "+ notificationResult+" sipObject: "+ sipObject);
        var sentMessage = this.sentMessages[message.id];
        if (sentMessage != null) {
            sentMessage.state = message.state;
        }
        if (message.state == "SENT") {
            this.notifySent(sentMessage);
        } else if (message.state == "ACCEPTED") {
            this.notifyAccepted(sentMessage);
        } else if (message.state == "FAILED") {
            this.notifyFailed(sentMessage);
        } else if (message.state == "IMDN_DELIVERED") {
            this.notifyDelivered(message, notificationResult);
        } else if (message.state == "IMDN_FAILED" || message.state == "IMDN_FORBIDDEN" || message.state == "IMDN_ERROR") {
            this.notifyDeliveryFailed(message, notificationResult);
        } else if (message.state == "RECEIVED") {
            //here we will choose what to display on multiple contacts in "from".
            if (message.from.indexOf(",") != -1) {
                var fromList = message.from.split(",");
                message.from = fromList[0];
            }
            this.notifyReceived(message, notificationResult);
        }
    },

    notifyReceived: function (message, notificationResult) {
        //received message
        //send OK result on MESSAGE request
        notifyMessageReceived(message);
        this.sendOkResult(notificationResult);
    },

    notifyDeliveryFailed: function (sentMessage, notificationResult) {
        if (sentMessage != null) {
            //send OK result on IMDN request
            notifyMessageDeliveryFailed(sentMessage);
            this.removeSentMessage(sentMessage);
            this.sendOkResult(notificationResult);
        }
    },

    notifyDelivered: function (sentMessage, notificationResult) {
        if (sentMessage != null) {
            //send OK result on IMDN request
            notifyMessageDelivered(sentMessage);
            this.removeSentMessage(sentMessage);
            this.sendOkResult(notificationResult);
        }
    },

    notifyFailed: function (sentMessage) {
        if (sentMessage != null) {
            notifyMessageFailed(sentMessage);
            this.removeSentMessage(sentMessage);
        }
    },

    notifySent: function (sentMessage) {
        if (sentMessage != null) {
            notifyMessageSent(sentMessage);
        }
    },

    notifyAccepted: function (sentMessage) {
        if (sentMessage != null) {
            notifyMessageAccepted(sentMessage);
            if (!sentMessage.deliveryNotification) {
                this.removeSentMessage(sentMessage);
            }
        }
    },

    removeSentMessage: function (sentMessage) {
        setTimeout(function () {
            messenger.sentMessages[sentMessage.id] = null;
        }, 5000);
    },

    sendOkResult: function (notificationResult) {
        notificationResult.status = "OK";
        this.sendResult(notificationResult);
    },

    sendResult: function (result) {
        flashphoner.notificationResult(result);
    },

    sendMessage: function (message) {
        this.saveSentMessage(message);
        try {
            flashphoner.sendMessage(message);
        } catch (error) {
            trace("Messenger - sending message error: "+error);
        }
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

        return uuid.substring(0, 18);
    }
}