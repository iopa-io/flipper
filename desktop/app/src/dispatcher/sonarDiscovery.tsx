/* eslint-disable header/header */
/**
 * Copyright (c) Synchronous Health, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {Store} from '../reducers/index';
import {Logger} from '../fb-interfaces/Logger';

import {
  SsdpSocket,
  createSocket as createSsdp,
  SsdpHeaders,
  SsdpSocketOptions,
  guid,
  SONAR_DESKTOP_TYPE
} from 'flipper-ssdp';

import * as os from 'os';

const ANNOUNCE_INTERVAL = 5000; 

const deviceId = guid();

const defaultMeta: SsdpHeaders = {
  S: deviceId,
  SERVER: `${os.type()},${os.release()} UPnP/1.0 UPnP-Device-Host/1.0`,
  USN: `${deviceId}::${SONAR_DESKTOP_TYPE}`,
};

async function createSsdpServer(options: SsdpSocketOptions): Promise<SsdpSocket> {
  const ssdp = createSsdp(options);

  ssdp.on('search', (headers, address) => {
    if (headers.ST === SONAR_DESKTOP_TYPE) {
      ssdp.reply(
        {
          ...defaultMeta,
          ST: SONAR_DESKTOP_TYPE,
        },
        address,
      );
    }
  });

  const isReady = new Promise<SsdpSocket>((resolve, _) => {
    ssdp.on('ready', () => {
      ssdp.hello({
        ...defaultMeta,
        NT: SONAR_DESKTOP_TYPE,
      });
      resolve(ssdp);
    });
  });

  ssdp.start();

  return isReady;
}

async function announceSonar(ssdp: SsdpSocket): Promise<void> {
  console.debug('Announcing SONAR desktop on the UPnP network');
  await ssdp.hello({
    ...defaultMeta,
    ST: SONAR_DESKTOP_TYPE,
  });
}

async function unannounceSonar(ssdp: SsdpSocket): Promise<void> {
  console.debug('Announcing Bye SONAR desktop on the UPnP network');
  await ssdp.bye({
    ...defaultMeta,
    ST: SONAR_DESKTOP_TYPE,
  });
}

export default async (store: Store, __: Logger) => {
 
  let timeoutHandle: NodeJS.Timeout;

  const {secure, insecure} = store.getState().application.serverPorts
  const alPorts = {insecure, secure}

  let ssdp = await createSsdpServer({ alPorts });
  console.debug(
    `${'Discovery'
    } server started on port 8087`,
    'server',
  );

  async function repeatAnnouncingSonar() {
    await announceSonar(ssdp);
    scheduleNext();
  }

  function scheduleNext() {
    timeoutHandle = setTimeout(repeatAnnouncingSonar, ANNOUNCE_INTERVAL);
  }

  // cleanup method
  return async () => {
    await unannounceSonar(ssdp);
    ssdp.close();
    ssdp = null!;

    if (timeoutHandle) {
      clearInterval(timeoutHandle);
    }
  };
};

