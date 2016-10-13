package com.flashphoner.room_api
{
	import com.flashphoner.room_api.RestAppCommunicator;
	import com.flashphoner.room_api.Room;
	import com.flashphoner.room_api.SessionStatus;
	
	import flash.events.*;
	import flash.net.*;
	
	import mx.utils.UIDUtil;
	
	public class Session
	{
		
		private var urlServer:String;
		
		private var username:String;
		
		private var state:String = SessionStatus.NEW;
		
		private var nc:NetConnection;
		
		private const appKey:String = "flashRoomApp";
		
		private var restAppCommunicator:RestAppCommunicator;
		
		private var callbacks:Object = new Object();
		
		internal var rooms:Object = new Object();
		
		public function Session(urlServer:String, username:String)
		{
			this.urlServer = urlServer;
			this.username = username;
		}
		
		public function connect():void
		{
			nc = new NetConnection();
			nc.client = this;
			nc.addEventListener(NetStatusEvent.NET_STATUS, handleConnectionStatus);				
			var obj:Object = new Object(); 
			obj.appKey = this.appKey;
			obj.login = this.username;
			nc.connect(this.urlServer,obj);	
			state = SessionStatus.PENDING;
		}
		
		public function disconnect():void 
		{
			nc.close();
		}
		
		private function handleConnectionStatus(event:NetStatusEvent):void{
			Logger.info("handleConnectionStatus: "+event.info.code);				
			if (event.info.code=="NetConnection.Connect.Success"){
				this.state = SessionStatus.ESTABLISHED;
				this.restAppCommunicator = new RestAppCommunicator(this.nc);
			} else if (event.info.code=="NetConnection.Connect.Closed"){					
				nc.removeEventListener(NetStatusEvent.NET_STATUS,handleConnectionStatus);
				Logger.info("Connection closed");
				this.state = SessionStatus.DISCONNECTED;
			} else if (event.info.code=="NetConnection.Connect.Failed"){
				Logger.info("Connection failed");
				this.state = SessionStatus.FAILED;
			}
			this.invokeCallback();
		}
		
		public function ping():void{
			nc.call("pong", null);
		}
		
		public function fail(obj:Object):void
		{
			this.state = SessionStatus.FAILED;
			this.invokeCallback();
		}
		
		public function getRooms():Array
		{
			var ret:Array = [];
			for (var rName:String in rooms) {
				ret.push(rooms[rName]);
			}
			return ret;
		}
		
		public function join(name:String):Room
		{
			var room:Room = new Room(name, this);
			this.rooms[name] = room;
			room.join();
			return room;
		}
		
		public function on(event:String, callback:Function):Session
		{
			this.callbacks[event] = callback;
			return this;
		}
		
		private function invokeCallback():void
		{
			if (this.callbacks.hasOwnProperty(this.state)) {
				this.callbacks[this.state](this);
			}
		}
		
		public function getUsername():String
		{
			return this.username;
		}
		
		public function getStatus():String
		{
			return this.state;
		}
		
		public function getServerUrl():String
		{
			return this.urlServer;
		}
		
		internal function sendAppCommand(commandName:String, data:Object, success:Function, error:Function):void
		{
			var command:Object = {
				command: commandName,
				options: data
			};
			restAppCommunicator.sendData(success, error, command);
		}
		
		internal function getNetConnection():NetConnection
		{
			return this.nc;
		}
		
		public function DataStatusEvent(data:Object):void
		{
			this.restAppCommunicator.resolveData(data);
		}
		
		public function OnDataEvent(data:Object):void
		{
			if (this.rooms.hasOwnProperty(data.payload.roomName)) {
				this.rooms[data.payload.roomName].handleEvent(data.payload);
			}
		}
		
	}
}