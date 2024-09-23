/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React from 'react';
import { Cell, Grid, Heading } from 'amazon-chime-sdk-component-library-react';
import { useTheme } from 'styled-components';

import ChannelsWrapper from '../../containers/channels/ChannelsWrapper';
import { useChatChannelState } from '../../providers/ChatMessagesProvider';
import { useAuthContext } from '../../providers/AuthProvider';

import './style.css';

const Channels = () => {
  const currentTheme = useTheme();
  const { member, userSignOut } = useAuthContext();
  const { activeView, activeChannel, moderatedChannel } 
  = useChatChannelState();

  function handleLogout() {
    return async () => {
      userSignOut();
    };
  }

  return (
    <Grid
      gridTemplateColumns="1fr 10fr"
      gridTemplateRows="3rem 101%"
      style={{ width: '100vw', height: '100vh' }}
      gridTemplateAreas='
      "heading heading"
      "side main"
      '
    >
      <Cell gridArea="heading">
        {/* HEADING */}
        <Heading
          level={5}
          style={{
            backgroundColor: currentTheme.colors.greys.grey60,
            height: '3rem',
            paddingLeft: '1rem',
            color: 'white',
          }}
          className="app-heading"
        >
          {activeView === 'Moderator' && moderatedChannel.Name} Chat App
          <div className="user-block">
            <a className="user-info">
              {member.username || 'Unknown'}
            </a>
            <a href="#" onClick={handleLogout()}>
              Log out
            </a>
          </div>
        </Heading>
      </Cell>
      <Cell gridArea="side" style={{ height: 'calc(100vh - 3rem)' }}>
        <div
          style={{
            backgroundColor: currentTheme.colors.greys.grey10,
            height: '100%',
            borderRight: `solid 1px ${currentTheme.colors.greys.grey30}`,
          }}
        >
          {/* SIDEPANEL CHANNELS LIST */}
          <ChannelsWrapper />
        </div>
      </Cell>
    </Grid>
  );
};

export default Channels;