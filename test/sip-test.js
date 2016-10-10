var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var CALL_STATUS = Flashphoner.constants.CALL_STATUS;
describe('SIP', function() {
    before(function () {
        Flashphoner.init(initOptions);
        var domain = sOptions.urlServer.split('/')[2].split(':')[0];
        sOptions.sipOptions = {
            login: '3000',
            password: '1234',
            domain: domain
        };
    });
    it('should register', function(done){
        this.timeout(10000);
        Flashphoner.createSession(sOptions).on(SESSION_STATUS.FAILED, function(){
            done(new Error("Failed"));
        }).on(SESSION_STATUS.REGISTERED, function(session){
            session.disconnect();
            done();
        });
    });
    it('outgoing and incoming call', function(done){
        this.timeout(60000);
        Flashphoner.createSession(sOptions).on(SESSION_STATUS.FAILED, function(){
            done(new Error("Failed"));
        }).on(SESSION_STATUS.REGISTERED, function(session){
            var localDisplay1 = addDisplay();
            var localDisplay2 = addDisplay();
            var remoteDisplay1 = addDisplay();
            var remoteDisplay2 = addDisplay();
            //prepare outgoing call
            var outCall = session.createCall({
                callee: "3001",
                localVideoDisplay: localDisplay1,
                remoteVideoDisplay: remoteDisplay1
            }).on(CALL_STATUS.ESTABLISHED, function(call){
                setTimeout(function(){
                    call.hangup();
                }, 10000);
            }).on(CALL_STATUS.FINISH, function(call){
                removeDisplay(localDisplay1);
                removeDisplay(remoteDisplay1);
                session.disconnect();
                done();
            });

            //setup new session for incoming call
            sOptions.sipOptions.login = "3001";
            var session2 = Flashphoner.createSession(sOptions).on(SESSION_STATUS.FAILED, function(){
                done(new Error("Failed"));
            }).on(SESSION_STATUS.REGISTERED, function(session){
                outCall.call();
            }).on(SESSION_STATUS.INCOMING_CALL, function(call){
                console.log("Incoming call");
                call.on(CALL_STATUS.FINISH, function(){
                    removeDisplay(localDisplay2);
                    removeDisplay(remoteDisplay2);
                    session2.disconnect();
                });
                setTimeout(function(){
                    call.answer(localDisplay2, remoteDisplay2);
                }, 1000);
            });
        });
    });
});