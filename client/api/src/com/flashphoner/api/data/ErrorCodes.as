/*
Copyright (c) 2011 Flashphoner
All rights reserved. This Code and the accompanying materials
are made available under the terms of the GNU Public License v2.0
which accompanies this distribution, and is available at
http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Contributors:
    Flashphoner - initial API and implementation

This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. Other license versions by negatiation. Write us support@flashphoner.com with any questions.
*/
package com.flashphoner.api.data
{	
	
	/**
	 * Error codes from server and client side
	 * **/			
	public class ErrorCodes
	{
		/**
		 * Authentication on sip server is fail
		 **/
		public static const AUTHENTICATION_FAIL:String = "AUTHENTICATION_FAIL";
		/**
		 * User not available on sip server
		 **/
		public static const USER_NOT_AVAILABLE:String = "USER_NOT_AVAILABLE";
		/**
		 * Many registration attempts
		 **/
		public static const TOO_MANY_REGISTER_ATTEMPTS:String = "TOO_MANY_REGISTER_ATTEMPTS";
		/**
		 * Your license of Flashphoner is trial
		 **/
		public static const LICENSE_RESTRICTION:String = "LICENSE_RESTRICTION";
		/**
		 * Your license of Flashphoner not found
		 **/
		public static const LICENSE_NOT_FOUND:String = "LICENSE_NOT_FOUND";
		/**
		 * Unknown error on server by sip protocol
		 **/
		public static const INTERNAL_SIP_ERROR:String = "INTERNAL_SIP_ERROR";
		/**
		 * Connection with flashphoner-server is not available
		 **/
		public static const CONNECTION_ERROR:String = "CONNECTION_ERROR";
		/**
		 * It is client error, throw if answer on registration do not receive from server within 15 seconds
		 **/ 
		public static const REGISTER_EXPIRE:String = "REGISTER_EXPIRE";	
		/**
		 * Parameters from file 'flashphoner.xml' is not readed.
		 * throw when excecute Flash_API.getParameters()
		 **/
		public static const PARAMETERS_IS_NOT_INITIALIZED:String = "PARAMETERS_IS_NOT_INITIALIZED";
		/**
		 * All sip ports on flashphoner-server is busy
		 **/
		public static const SIP_PORTS_BUSY:String = "SIP_PORTS_BUSY";
		/**
		 * All sip ports on flashphoner-server is busy
		 **/
		public static const MEDIA_PORTS_BUSY:String = "MEDIA_PORTS_BUSY";
		/**
		 * flashphoner server can not connect with sip provider server.
		 **/ 
		public static const WRONG_SIPPROVIDER_ADDRESS:String = "WRONG_SIPPROVIDER_ADDRESS";
		/**
		 * Application can`t load flashphoner.xml properly
		 **/ 
		public static const WRONG_FLASHPHONER_XML:String = "WRONG_FLASHPHONER_XML";
		/**
		 * Callee name is null.
		 **/ 
		public static const CALLEE_NAME_IS_NULL:String = "CALLEE_NAME_IS_NULL";
		/**
		 * Payments required from user. SIP 402 Payment Required
		 **/ 
		public static const PAYMENT_REQUIRED:String = "PAYMENT_REQUIRED";
	}
}
