//status alias
var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;

describe('flashphoner', function() {
    var sOptions;
    before(function(){
        sOptions = {urlServer: "ws://192.168.88.234:8080"};
    });
    it('should throw exception on createSession if not initialized', function() {
        expect(Flashphoner.createSession).to.throw(Error, 'Flashphoner API is not initialized');
    });
    it('should create session after initialization', function() {
        expect(Flashphoner.init).to.not.throw(Error);
        expect(Flashphoner.createSession).to.throw(TypeError, 'options.urlServer must be provided');
        expect(Flashphoner.createSession({urlServer: "ws://192.168.88.234:8080"})).to.have.property('id');
    });
    it('should expose sessions', function(done){
        var session = Flashphoner.createSession({urlServer: "ws://192.168.88.234:8080"});
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
                done();
            });

        });

        describe('streams', function(){
            var session;
            before(function(done){
                session = Flashphoner.createSession(sOptions).on(SESSION_STATUS.ESTABLISHED, function(){
                    done();
                });
            });

            it('should expose methods', function() {
                var stream = session.createStream({name: "test"});
                expect(stream.id).to.be.a('function');
                expect(stream.name).to.be.a('function');
                expect(stream.status).to.be.a('function');
                expect(stream.play).to.be.a('function');
                expect(stream.stop).to.be.a('function');
                expect(stream.publish).to.be.a('function');
            });
            it('should publish and play', function(done) {
                var mediaElement = document.createElement('video');
                mediaElement.width = 640;
                mediaElement.height = 480;
                var stream = session.createStream({name: "test2", display: mediaElement});
                stream.on(STREAM_STATUS.PUBLISHING, function(){
                    var playStream = session.createStream({name: "test2", display: mediaElement});
                    playStream.on(STREAM_STATUS.PLAYING, function(){
                        playStream.stop();
                        stream.stop();
                        done();
                    });
                    playStream.play();
                });
                stream.publish();
            });
        });

    });
});