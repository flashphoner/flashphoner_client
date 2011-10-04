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

import com.flashphoner.sdk.rtmp.IRtmpClient;
import com.flashphoner.sdk.rtmp.IRtmpClientsCollection;
import com.wowza.wms.client.IClient;
import com.wowza.wms.logging.WMSLogger;
import com.wowza.wms.logging.WMSLoggerFactory;

import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Simple implementation of {@link IRtmpClientsCollection}.<br/>
 * Internal {@link HashMap} keeps {@link IRtmpClient} instances by IClient keys and supports add, remove and find methods.
 */
public class RtmpClients implements IRtmpClientsCollection {

    private static WMSLogger log = WMSLoggerFactory.getLogger(RtmpClients.class);

    /**
     * Singleton field
     */
    private static IRtmpClientsCollection rtmpClientsCollection;

    /**
     * Internal map
     */
    private Map<IClient, IRtmpClient> rtmpClients = Collections.synchronizedMap(new HashMap<IClient, IRtmpClient>());

    /**
     * Private singleton constructor
     */
    private RtmpClients() {

    }

    /**
     * Singleton getInstance method
     *
     * @return IRtmpClientsCollection
     */
    public static IRtmpClientsCollection getInstance() {
        if (rtmpClientsCollection == null) {
            rtmpClientsCollection = new RtmpClients();
        }
        return rtmpClientsCollection;
    }

    /**
     * Find IRtmpClient instance by login
     *
     * @param login
     * @return IRtmpClient
     */
    public IRtmpClient findByLogin(String login) {
        Iterator it = rtmpClients.keySet().iterator();
        synchronized (rtmpClients) {
            while (it.hasNext()) {
                IRtmpClient rtmpClient = rtmpClients.get(it.next());
                if (rtmpClient.getLogin().equals(login)) {
                    return rtmpClient;
                }
            }
        }
        return null;
    }

    /**
     * Add IRtmpClient instance into the map
     *
     * @param rtmpClient
     */
    public void add(IRtmpClient rtmpClient) {
        synchronized (rtmpClients) {
            rtmpClients.put(rtmpClient.getClient(), rtmpClient);
        }
    }

    /**
     * Remove IRtmpClient instance from the map
     *
     * @param rtmpClient
     * @return removed IRtmpClient
     */
    public IRtmpClient remove(IRtmpClient rtmpClient) {
        synchronized (rtmpClients) {
            return rtmpClients.remove(rtmpClient.getClient());
        }
    }

    /**
     * Find IRtmpClient instance by IClient object key
     *
     * @param client
     * @return IRtmpClient
     */
    public IRtmpClient findByClient(IClient client) {
        synchronized (rtmpClients) {
            return rtmpClients.get(client);
        }
    }
}
