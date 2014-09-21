var Connection = function () {
    this.login = "";
    this.password = "";
    this.authenticationName = "";
    this.domain = "";
    this.outboundProxy = "";
    this.port = 5060;
    this.useProxy = true;
    this.registerRequired = true;
    this.useDTLS = true;
    this.useSelfSigned = !isMobile.any();
    this.appKey = "defaultVoIPApp";
    this.status = ConnectionStatus.New;
};

var ConnectionStatus = function(){
};
ConnectionStatus.New = "NEW";
ConnectionStatus.Pending = "PENDING";
ConnectionStatus.Established = "ESTABLISHED";
ConnectionStatus.Disconnected = "DISCONNECTED";
ConnectionStatus.Error = "ERROR";

var Call = function () {
    this.callId = "";
    this.status = "";
    this.caller = "";
    this.callee = "";
    this.incoming = false;
    this.visibleName = "";
    this.inviteParameters = "";
};

var WCSEvent = function(){
};
WCSEvent.OnErrorEvent = "ON_ERROR_EVENT";
WCSEvent.ConnectionStatusEvent = "CONNECTION_STATUS_EVENT";
WCSEvent.OnRegistrationEvent = "ON_REGISTRATION_EVENT";
WCSEvent.OnCallEvent = "ON_CALL_EVENT";
WCSEvent.CallStatusEvent = "CALL_STATUS_EVENT";
WCSEvent.OnMessageEvent = "ON_MESSAGE_EVENT";
WCSEvent.MessageStatusEvent = "MESSAGE_STATUS_EVENT";

var WCSError = function(){
};
WCSError.AUTHENTICATION_FAIL = "AUTHENTICATION_FAIL";
WCSError.USER_NOT_AVAILABLE = "USER_NOT_AVAILABLE";
WCSError.TOO_MANY_REGISTER_ATTEMPTS = "TOO_MANY_REGISTER_ATTEMPTS";
WCSError.LICENSE_RESTRICTION = "LICENSE_RESTRICTION";
WCSError.LICENSE_NOT_FOUND = "LICENSE_NOT_FOUND";
WCSError.INTERNAL_SIP_ERROR = "INTERNAL_SIP_ERROR";
WCSError.CONNECTION_ERROR = "CONNECTION_ERROR";
WCSError.REGISTER_EXPIRE = "REGISTER_EXPIRE";
WCSError.SIP_PORTS_BUSY = "SIP_PORTS_BUSY";
WCSError.MEDIA_PORTS_BUSY = "MEDIA_PORTS_BUSY";
WCSError.WRONG_SIPPROVIDER_ADDRESS = "WRONG_SIPPROVIDER_ADDRESS";
WCSError.CALLEE_NAME_IS_NULL = "CALLEE_NAME_IS_NULL";
WCSError.WRONG_FLASHPHONER_XML = "WRONG_FLASHPHONER_XML";
WCSError.PAYMENT_REQUIRED = "PAYMENT_REQUIRED";

var DataMap = function(){
    this.data = {};
};

DataMap.prototype = {

    add: function (data) {
        this.data[data.id] = data;
    },

    update: function (data) {
        this.data[data.id] = data;
    },

    get: function(id) {
        return this.data[id];
    },

    remove: function(id) {
        this.data[id] = undefined;
    },

    getSize: function(){
        return Object.size(this.data);
    },

    array: function(){
        var callArray = [];
        for(var o in this.data) {
            callArray.push(this.data[o]);
        }
        return callArray;
    }
};
