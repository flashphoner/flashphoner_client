package com.flashphoner.room_api
{
	import flash.media.Camera;
	import flash.media.H264Level;
	import flash.media.H264Profile;
	import flash.media.H264VideoStreamSettings;
	import flash.media.Microphone;
	import flash.media.MicrophoneEnhancedMode;
	import flash.media.MicrophoneEnhancedOptions;
	import flash.media.SoundCodec;
	import flash.net.NetConnection;
	import flash.net.NetStream;

	public class Room
	{
		
		private var name:String;
		
		private var participants:Object = new Object();
		
		private var callbacks:Object = new Object();
		
		private var session:Session;
		
		private var stream:NetStream;
		
		public function Room(name:String, session:Session)
		{
			this.name = name;
			this.session = session;
		}
		
		public function getName():String
		{
			return this.name;
		}
		
		internal function join():void
		{
			var roomConfig:Object = {
				name: this.name
			};
			var room:Room = this;
			this.session.sendAppCommand("join", roomConfig, function():void{}, function(info:Object):void{
				Logger.info("Joining to room " + name + " failed");
				if (callbacks.hasOwnProperty(RoomStatus.FAILED)) {
					callbacks[RoomStatus.FAILED](room, info);
				}
			});
		}
		
		public function leave():void
		{
			var roomConfig:Object = {
				name: this.name
			};
			this.session.sendAppCommand("leave", roomConfig, function():void{}, function(info:Object):void{});
			delete this.session.rooms[this.name];
			if (this.stream != null) {
				this.stream.close();
			}
			for (var pName:String in this.participants) {
				this.participants[pName].release();
			}
		}
		
		public function publish(mic:Microphone, cam:Camera):NetStream
		{
			var streamName:String = this.name + "-" + this.session.getUsername();
			var nc:NetConnection = this.session.getNetConnection();
			var stream:NetStream = new NetStream(nc);
			if (mic != null) {
				var options:MicrophoneEnhancedOptions = new MicrophoneEnhancedOptions();
				options.mode = MicrophoneEnhancedMode.FULL_DUPLEX;
				options.echoPath = 128;
				options.nonLinearProcessing = true;
				mic.codec = SoundCodec.SPEEX;
				mic.encodeQuality = 5;
				mic.framesPerPacket=1;
				mic.gain=50;
				mic.setSilenceLevel(0,2000);
				mic.enhancedOptions = options;
				stream.attachAudio(mic);
			}
			if (cam != null) {
				cam.setMode(320,240,15,true);
				cam.setQuality(0,80);								
				cam.setKeyFrameInterval(15);
				cam.setMotionLevel(0,2000);
				stream.attachCamera(cam);
				var videoStreamSettings:H264VideoStreamSettings = new H264VideoStreamSettings();
				videoStreamSettings.setProfileLevel(H264Profile.MAIN,H264Level.LEVEL_3_1);						
				stream.videoStreamSettings = videoStreamSettings;
			}
			stream.videoReliable=true;
			stream.audioReliable=false;
			stream.useHardwareDecoder=true;				
			stream.bufferTime=0;				
			stream.publish(streamName);
			this.stream = stream;
			return stream;
		}
		
		internal function getSession():Session
		{
			return this.session;
		}
		
		public function getParticipants():Array
		{
			var ret:Array = [];
			for (var pName:String in participants) {
				ret.push(participants[pName]);
			}
			return ret;
		}
		
		public function on(event:String, callback:Function):Room
		{
			this.callbacks[event] = callback;
			return this;
		}
		
		internal function handleEvent(data:Object):void
		{
			var participant:Participant;
			if (data.name == RoomStatus.STATE) {
				if (data.info) {
					for (var index:String in data.info) {
						participant = new Participant(data.info[index], this);
						this.participants[participant.getName()] = participant;
					}
				}
				if (callbacks.hasOwnProperty(RoomStatus.STATE)) {
					callbacks[RoomStatus.STATE](this);
				}
			} else if (data.name == RoomStatus.JOINED) {
				participant = new Participant(data.info, this);
				this.participants[participant.getName()] = participant;
				if (callbacks.hasOwnProperty(RoomStatus.JOINED)) {
					callbacks[RoomStatus.JOINED](participant);
				}
			} else if (data.name == RoomStatus.LEFT) {
				participant = participants[data.info];
				delete participants[data.info];
				if (callbacks.hasOwnProperty(RoomStatus.LEFT)) {
					callbacks[RoomStatus.LEFT](participant);
				}
			} else if (data.name == RoomStatus.PUBLISHED) {
				participant = participants[data.info.login];
				participant.setStreamName(data.info.name);
				if (callbacks.hasOwnProperty(RoomStatus.PUBLISHED)) {
					callbacks[RoomStatus.PUBLISHED](participant);
				}
			} else if (data.name == RoomStatus.MESSAGE) {
				if (callbacks[RoomStatus.MESSAGE]) {
					callbacks[RoomStatus.MESSAGE]({
						from: participants[data.info.from],
						text: data.info.text
					});
				}
			}
		}
	}
}