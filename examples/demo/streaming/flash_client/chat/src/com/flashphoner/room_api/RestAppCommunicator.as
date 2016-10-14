package com.flashphoner.room_api
{
	import flash.net.*;
	
	import mx.utils.UIDUtil;
	
	internal class RestAppCommunicator
	{
		
		private var pending:Object = new Object();
		
		private var nc:NetConnection;
		
		public function RestAppCommunicator(nc:NetConnection)
		{
			this.nc = nc;
		}
		
		public function sendData(resolve:Function, reject:Function, data:Object):void
		{
			var obj:Object = {
				operationId: UIDUtil.createUID(),
					payload: data
			};
			pending[obj.operationId] = {
				FAILED: function(info:Object):void{
					reject(info);
				},
				ACCEPTED: function(info:Object):void{
					resolve(info);
				}
			};
			nc.call("sendData", null, obj);
		}
		
		public function resolveData(data:Object):void
		{
			if (pending.hasOwnProperty(data.operationId)) {
				var handler:Object = pending[data.operationId];
				delete pending[data.operationId];
				delete data.operationId;
				handler[data.status](data);
			}
		}
	}
}