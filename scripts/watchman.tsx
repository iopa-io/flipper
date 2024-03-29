/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {Client} from 'fb-watchman';
import {v4 as uuid} from 'uuid';

const watchmanTimeout = 60 * 1000;

export default class Watchman {
  constructor(private rootDir: string) {}

  private client?: Client;
  private watch?: any;
 
  close(): void {
    this.client!.removeAllListeners();
    this.client!.end();
    delete this.client;
  }

  async initialize(): Promise<void> {
    if (this.client) {
      return;
    }
    this.client = new Client();
    this.client.setMaxListeners(250);
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        this.client!.removeAllListeners('error');
        reject(err);
        this.client!.end();
        delete this.client;
      };

      const timeouthandle = setTimeout(() => {
        onError(new Error('Timeout when trying to start Watchman'));
      }, watchmanTimeout);

      this.client!.once('error', onError);
      this.client!.capabilityCheck(
        {optional: [], required: ['relative_root']},
        (error) => {
          if (error) {
            onError(error);
            return;
          }
          this.client!.command(
            ['watch-project', this.rootDir],
            (error, resp) => {
              if (error) {
                onError(error);
                return;
              }
              if ('warning' in resp) {
                console.warn(resp.warning);
              }
              this.watch = resp.watch;
              clearTimeout(timeouthandle);
              resolve();
            },
          );
        },
      );
    });
  }

  async startWatchFiles(
    handler: (resp: any) => void,
    options: {excludes: string[]},
  ): Promise<void> {
    if (!this.watch) {
      throw new Error(
        'Watchman is not initialized, please call "initialize" function and wait for the returned promise completion before calling "startWatchFiles".',
      );
    }
    options = Object.assign({excludes: []}, options);
    return new Promise((resolve, reject) => {
      this.client!.command(['clock', this.watch], (error, resp) => {
        if (error) {
          return reject(error);
        }

        try {
          const {clock} = resp;

          const sub = {
            expression: [
              'allof',
              ['not', ['type', 'd']],
              ...options!.excludes.map((e) => [
                'not',
                ['match', e, 'wholename'],
              ]),
            ],
            fields: ['name', 'exists'],
            since: clock
          };

          const id = uuid();

          this.client!.command(['subscribe', this.watch, id, sub], (error) => {
            if (error) {
              return reject(error);
            }
            this.client!.on('subscription', (resp) => {
              if (resp.subscription !== id || !resp.files) {
                return;
              }
              handler(resp);
            });
            resolve();
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}
