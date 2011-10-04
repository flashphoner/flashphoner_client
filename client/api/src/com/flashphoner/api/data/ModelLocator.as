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
	[Bindable]
	/**
	 * Class used to store information about connected user
	 **/
	public class ModelLocator
	{
		/**
		 * Login of user
		 */
		public var login:String = '';
		/**
		 * Password of user
		 **/
		public var pwd:String = null;
		/**
		 * Host of sip provider (example: sipnet.ru)
		 */
		public var sipProviderAddress:String;
		/**
		 * Port of sip provider (default - 5060)
		 **/
		public var sipProviderPort:String;
		/**
		 * Visible name of user
		 **/ 
		public var visibleName:String = "";
		/**
		 * Logged user on sip provider or no
		 */
		public var logged:Boolean = false;
		/**
		 * Mode of connection ("phone"/"click2call")
		 **/
		public var mode:String = "phone";
	}
}
