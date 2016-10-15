package com.flashphoner.room_api
{
	import flash.net.NetConnection;
	import flash.net.NetStream;

	public class Participant
	{
		
		private var name:String;
		
		private var streamName:String;
		
		private var room:Room;
		
		private var stream:NetStream;
		
		public function Participant(state:Object, room:Room)
		{
			if (state.hasOwnProperty("login")) {
				this.name = state.login;
				this.streamName = state.name;
			} else{
				this.name = state + "";
			}
			this.room = room;
		}
		
		internal function setStreamName(name:String):void
		{
			this.streamName = name;
		}
		
		public function play():NetStream
		{
			if (this.streamName != null) {
				var nc:NetConnection = this.room.getSession().getNetConnection();
				var stream:NetStream = new NetStream(nc);
				stream.videoReliable=true;
				stream.audioReliable=false;
				stream.useHardwareDecoder=true;				
				stream.bufferTime=0;
				stream.play(this.streamName);
				this.stream = stream;
				return stream;
			}
			return null;
		}
		
		public function sendMessage(text:String, error:Function):void
		{
			var message:Object = {
				roomConfig: {
					name: this.room.getName()
				},
				to: this.name,
				text: text
			};
			this.room.getSession().sendAppCommand("sendMessage", message, function():void{}, function():void{
				if (error != null) {
					error();
				}
			});
		}
		
		public function getName():String
		{
			return this.name;
		}
		
		internal function release():void
		{
			if (this.stream != null) {
				this.stream.close();
			}
		}
	}
}