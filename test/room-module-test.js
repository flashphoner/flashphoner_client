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
                urlServer: "ws://192.168.88.234:8080",
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
                        urlServer: "ws://192.168.88.234:8080",
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
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                var display = document.createElement("div");
                display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
                document.body.appendChild(display);
                api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                    setTimeout(function(){
                        stream.stop();
                        api.disconnect();
                        document.body.removeChild(display);
                        done();
                    }, 3000);
                });
            });
        });
    });

    it("subscribe to already published stream", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            var display = document.createElement("div");
            display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
            document.body.appendChild(display);
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                    //create second connection and subscribe
                    roomApi.connect(
                        {
                            urlServer: "ws://192.168.88.234:8080",
                            username: "test2"
                        }
                    ).on("ESTABLISHED", function(api){
                        //join room
                        api.join({name: "my_test_room"}).on("STATE", function(room){
                            console.log("Joined room with state " + room);
                            var display = document.createElement("div");
                            display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
                            document.body.appendChild(display);
                            room.getParticipants()[0].play(display).on("PLAYING", function(stream){
                                setTimeout(function(){
                                    stream.stop();
                                    document.body.removeChild(display);
                                    api.disconnect();
                                }, 3000);
                            });
                        });
                    });
                });
            }).on("LEFT", function(){
                api.disconnect();
                document.body.removeChild(display);
                done();
            });
        });
    });

    it("subscribe to newly published stream", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            var display = document.createElement("div");
            display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
            document.body.appendChild(display);
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                //create second connection and publish
                roomApi.connect(
                    {
                        urlServer: "ws://192.168.88.234:8080",
                        username: "test2"
                    }
                ).on("ESTABLISHED", function(api){
                    //join room
                    api.join({name: "my_test_room"}).on("STATE", function(room){
                        var display = document.createElement("div");
                        display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
                        document.body.appendChild(display);
                        api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                            setTimeout(function(){
                                stream.stop();
                                document.body.removeChild(display);
                                api.disconnect();
                            }, 3000);
                        });
                    });
                });
            }).on("PUBLISHED", function(participant){
                console.log("Stream published, subscribe");
                participant.play(display).on("FAILED", function(stream){
                    document.body.removeChild(display);
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
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                //create second connection
                roomApi.connect(
                    {
                        urlServer: "ws://192.168.88.234:8080",
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
                urlServer: "ws://192.168.88.234:8080",
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
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("ESTABLISHED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(room){
                roomApi.connect(
                    {
                        urlServer: "ws://192.168.88.234:8080",
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
});