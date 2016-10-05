describe('Room api', function() {
    var roomApi;
    before(function () {
        Flashphoner.init({
            flashMediaProviderSwfLocation: "../media-provider.swf",
            screenSharingExtensionId: "nlbaajplpmleofphigmgaifhoikjmbkg"
        });
        roomApi = Flashphoner.roomApi;
    });

    it('join room', function(done) {
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: sOptions.urlServer,
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            console.log("Connected");
            api.join({name: "my_test_room"}).on("JOINED", function(participant){
                console.log("Participant joined with name " + participant.name());
                api.getRooms()[0].leave();
                api.disconnect();
            }).on("STATE", function(room){
                //create second connection
                roomApi.connect(
                    {
                        urlServer: sOptions.urlServer,
                        username: "test2"
                    }
                ).on("ESTABLISHED", function(api){
                    //join room
                    api.join({name: "my_test_room"}).on("LEFT", function(participant){
                        console.log("Participant left with name " + participant.name());
                        api.disconnect();
                        done();
                    });
                });
            });
        });
    });

    it("join and publish", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: sOptions.urlServer,
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                var display = addDisplay();
                api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                    setTimeout(function(){
                        stream.stop();
                    }, 3000);
                }).on("UNPUBLISHED", function(){
                    removeDisplay(display);
                    api.disconnect();
                    done();
                });
            });
        });
    });

    it("subscribe to already published stream", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: sOptions.urlServer,
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            var display = addDisplay();
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                    //create second connection and subscribe
                    roomApi.connect(
                        {
                            urlServer: sOptions.urlServer,
                            username: "test2"
                        }
                    ).on("ESTABLISHED", function(api){
                        //join room
                        api.join({name: "my_test_room"}).on("STATE", function(room){
                            console.log("Joined room with state " + room);
                            var display = addDisplay();
                            room.getParticipants()[0].play(display).on("PLAYING", function(stream){
                                setTimeout(function(){
                                    stream.stop();
                                }, 3000);
                            }).on("STOPPED", function(){
                                removeDisplay(display);
                                api.disconnect();
                                stream.stop();
                            });
                        });
                    });
                }).on("UNPUBLISHED", function(){
                    removeDisplay(display);
                    api.disconnect();
                    done();
                });
            });
        });
    });

    it("subscribe to newly published stream", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: sOptions.urlServer,
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            var display = addDisplay();
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                //create second connection and publish
                roomApi.connect(
                    {
                        urlServer: sOptions.urlServer,
                        username: "test2"
                    }
                ).on("ESTABLISHED", function(api){
                    //join room
                    api.join({name: "my_test_room"}).on("STATE", function(room){
                        var display = addDisplay();
                        api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                            setTimeout(function(){
                                stream.stop();
                            }, 3000);
                        }).on("UNPUBLISHED",function(){
                            removeDisplay(display);
                            api.disconnect();
                        });
                    });
                });
            }).on("PUBLISHED", function(participant){
                console.log("Stream published, subscribe");
                participant.play(display).on("FAILED", function(stream){
                    removeDisplay(display);
                    api.disconnect();
                    done();
                });
            });
        });
    });

    it("send message", function(done){
        this.timeout(20000);
        var MESSAGE_TEXT = "MY MESSAGE TEXT";
        roomApi.connect(
            {
                urlServer: sOptions.urlServer,
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                //create second connection
                roomApi.connect(
                    {
                        urlServer: sOptions.urlServer,
                        username: "test2"
                    }
                ).on("ESTABLISHED", function(api){
                    //join room
                    api.join({name: "my_test_room"}).on("STATE", function(room){
                        console.log("Joined room with state " + room);
                        room.getParticipants()[0].sendMessage(MESSAGE_TEXT);
                    }).on("LEFT", function(){
                        api.disconnect();
                        done();
                    })
                });
            }).on("MESSAGE", function(message){
                expect(message.text).to.equal(MESSAGE_TEXT);
                api.disconnect();
            });
        });
    });

    it("join with error", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: sOptions.urlServer,
                username: "throw_join_exception"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                done(new Error("Joined"));
            }).on("FAILED", function(){
                api.disconnect();
                done();
            });
        });
    });

    it("sendMessage with error", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: sOptions.urlServer,
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                roomApi.connect(
                    {
                        urlServer: sOptions.urlServer,
                        username: "throw_message_exception"
                    }
                ).on("ESTABLISHED", function(api){
                    //join room
                    api.join({name: "my_test_room"}).on("STATE", function(room){
                        room.getParticipants()[0].sendMessage("my message", function(){
                            //message failed
                            api.disconnect();
                        })
                    });
                });
            }).on("LEFT", function(){
                api.disconnect();
                done();
            });
        });
    });
    it("join, publish, leave", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: sOptions.urlServer,
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                var display = addDisplay();
                room.publish(display).on("FAILED", function(){
                    removeDisplay(display);
                    api.disconnect();
                    done();
                });
                room.leave();
            });
        });
    });
});