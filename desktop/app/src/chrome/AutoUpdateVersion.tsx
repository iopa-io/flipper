/* eslint-disable header/header */
/**
 * Copyright (c) Synchronous Health, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

 // MODIFIED FOR Sync SONAR to use electron-builder / electron-updater instead of builtin Electron

import {FlexRow, colors, LoadingIndicator, Glyph, styled} from 'flipper';
import {remote} from 'electron';
import isProduction from '../utils/isProduction';
import React, {Component} from 'react';
const {autoUpdater} = remote.require('electron-updater');

const Container = styled(FlexRow)({
  alignItems: 'center',
});

type State = {
  updater:
    | 'error'
    | 'checking-for-update'
    | 'update-available'
    | 'update-not-available'
    | 'update-downloaded';
  error?: string;
};

type Props = {
  version: string;
};

export default class AutoUpdateVersion extends Component<Props, State> {
  state: State = {
    updater: 'update-not-available',
  };

  componentDidMount() {
    if (isProduction()) {
      console.log('---> Checking for updates');
      autoUpdater.on('update-downloaded', () => {
        console.log('update-downloaded');
        this.setState({updater: 'update-downloaded'});

        const notification = new Notification('Update available', {
          body: 'Restart Flipper to update to the latest version.',
          requireInteraction: true,
        });
        notification.onclick = autoUpdater.quitAndInstall;
      });

      autoUpdater.on('error', (error: Error) => {
        console.log('error', error);
        this.setState({updater: 'error', error: error.toString()});
      });

      autoUpdater.on('checking-for-update', () => {
        this.setState({updater: 'checking-for-update'});
      });

      autoUpdater.on('update-available', () => {
        console.log('update available');
        this.setState({updater: 'update-available'});
      });

      autoUpdater.on('update-not-available', () => {
        console.log('No update available');
        this.setState({updater: 'update-not-available'});
      });

      autoUpdater.checkForUpdates();
    }
  }

  render() {
    return (
      <Container>
        {this.state.updater === 'update-available' && (
          <span title="Downloading new version">
            <LoadingIndicator size={16} />
          </span>
        )}
        {this.state.updater === 'error' && (
          <span title={`Error fetching update: ${this.state.error || ''}`}>
            <Glyph color={colors.light30} name="caution-triangle" />
          </span>
        )}
        {this.state.updater === 'update-downloaded' && (
          <span
            tabIndex={-1}
            role="button"
            title="Update available. Restart Flipper."
            onClick={autoUpdater.quitAndInstall}>
            <Glyph color={colors.light30} name="breaking-news" />
          </span>
        )}
      </Container>
    );
  }
}
