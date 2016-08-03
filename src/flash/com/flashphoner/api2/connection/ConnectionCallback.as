package com.flashphoner.api2.connection
{

import com.flashphoner.api2.connection.Connection;

public class ConnectionCallback
	{
		private var connection:Connection;
		public function ConnectionCallback(connection:Connection)
		{
			this.connection = connection;
		}
		
		public function ping():void{
			this.connection.pong();
		}
	}
}