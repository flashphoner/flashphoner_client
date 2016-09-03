//status alias
var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;

describe('flashphoner', function() {
    before(function() {
        Flashphoner.init(initOptions);
    });

    it('should create session after initialization', function() {
        expect(Flashphoner.createSession).to.throw(TypeError, 'options.urlServer must be provided');
        expect(Flashphoner.createSession(sOptions)).to.have.property('id');
    });
    it('should expose sessions', function(done){
        var session = Flashphoner.createSession(sOptions);
        expect(Flashphoner.getSession(session.id())).to.be.equal(session);
        expect(Flashphoner.getSessions()).to.contain(session);
        session.on(SESSION_STATUS.ESTABLISHED, function(){
            session.disconnect();
        }).on(SESSION_STATUS.DISCONNECTED, function(){
            expect(Flashphoner.getSession(session.id())).to.be.undefined;
            expect(Flashphoner.getSessions()).to.not.contain(session);
            done();
        });
    });

    describe('session', function() {
        it('should expose methods', function() {
            var session = Flashphoner.createSession(sOptions);
            expect(session.id).to.be.a('function');
            expect(session.status).to.be.a('function');
            expect(session.disconnect).to.be.a('function');
            session.disconnect();
        });
        it('should connect', function(done){
            var session = Flashphoner.createSession(sOptions);
            session.on(SESSION_STATUS.ESTABLISHED, function(){
                session.disconnect();
                done();
            });
        });
        it('should disconnect', function(done) {
            var session = Flashphoner.createSession(sOptions);
            session.on(SESSION_STATUS.ESTABLISHED, function(){
                session.disconnect();
            }).on(SESSION_STATUS.DISCONNECTED, function(){
                done();
            }).on(SESSION_STATUS.FAILED, function() {
                throw Error('Session failed');
            });
        });

        it('should create stream', function(done) {
            var session = Flashphoner.createSession(sOptions);
            expect(session.createStream).to.throw(Error, 'Invalid session state');
            session.on(SESSION_STATUS.ESTABLISHED, function() {
                expect(session.createStream).to.throw(TypeError, 'options must be provided');
                expect(session.createStream.bind(this, {})).to.throw(TypeError, 'options.name must be provided');
                expect(session.createStream({name: "test"})).to.be.an('object');
                session.on(SESSION_STATUS.DISCONNECTED, function(){
                   done();
                });
                session.disconnect();
            });

        });

        describe('streams', function(){
            var session;
            before(function(done){
                Flashphoner.init(initOptions);
                session = Flashphoner.createSession(sOptions).on(SESSION_STATUS.ESTABLISHED, function(){
                    done();
                });
            });

            it('should expose methods', function() {
                var display = document.createElement("div");
                var stream = session.createStream({name: "test", display: display});
                expect(stream.id).to.be.a('function');
                expect(stream.name).to.be.a('function');
                expect(stream.status).to.be.a('function');
                expect(stream.play).to.be.a('function');
                expect(stream.stop).to.be.a('function');
                expect(stream.publish).to.be.a('function');
                //dispose
                stream.stop();
            });
            it('should publish and play', function(done) {
                this.timeout(20000);
                var display = addDisplay(640, 480);
                var stream = session.createStream({name: "test2", display: display});
                stream.on(STREAM_STATUS.PUBLISHING, function(){
                    var playStream = session.createStream({name: "test2", display: display});
                    playStream.on(STREAM_STATUS.PLAYING, function(){
                        setTimeout(function(){
                            playStream.stop();
                        }, 2000);

                    }).on(STREAM_STATUS.STOPPED, function(){
                        stream.stop();
                    });
                    playStream.play();
                }).on(STREAM_STATUS.UNPUBLISHED, function(){
                    removeDisplay(display);
                    done();
                });
                stream.publish();
            });

            it('should clean up video', function(done) {
                this.timeout(15000);
                var publishDisplay = addDisplay();
                session.createStream({name: "publishStream", display: publishDisplay}).on(STREAM_STATUS.PUBLISHING, function(publisher){
                    var playerDisplay = addDisplay(640,480);
                    session.createStream({name: "publishStream", display: playerDisplay}).on(STREAM_STATUS.PLAYING, function(stream1){
                        session.createStream({name: "publishStream", display: playerDisplay}).on(STREAM_STATUS.PLAYING, function(stream2){
                            setTimeout(function(){
                                stream2.stop();
                                stream1.stop();
                                var interval = setInterval(function(){
                                    if (stream1.status() == STREAM_STATUS.STOPPED && stream2.status() == STREAM_STATUS.STOPPED) {
                                        clearInterval(interval);
                                        expect(playerDisplay.children).to.be.empty;
                                        removeDisplay(playerDisplay);
                                        publisher.stop();
                                    }
                                }, 1000);
                            }, 2000);
                        }).play();
                    }).play();
                }).on(STREAM_STATUS.UNPUBLISHED, function(){
                    removeDisplay(publishDisplay);
                    done();
                }).publish();
            });
            after(function(){
                session.disconnect();
            })
        });

    });
});