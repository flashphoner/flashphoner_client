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
package com.flashphoner.phone_app;

import com.flashphoner.sdk.sip.ISipMessageListener;
import com.flashphoner.sdk.softphone.Logger;
import gov.nist.javax.sip.message.SIPMessage;

/**
 * Simple example of usage {@link ISipMessageListener} interface.<br/>
 * Just logs intercepted sip message.
 */
public class MySipMessageListener implements ISipMessageListener {

    public void processMessage(SIPMessage sipMessage) {
        Logger.logger.info(4, "Message:\n" + sipMessage.toString());
    }
}
