// Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React from 'react';

import {
  Flex,
  Heading,
} from 'amazon-chime-sdk-component-library-react';

import { useAppState } from '../../providers/AppStateProvider';
import { StyledList } from './Styled';

const MeetingDetails = () => {
  const { meetingId } = useAppState();

  return (
    <Flex container layout="fill-space-centered">
      <Flex>
        <Heading level={4} tag="h1">
          Meeting information
        </Heading>
        <StyledList>
          <div>
            <dt>Meeting ID</dt>
            <dd>{meetingId}</dd>
          </div>
        </StyledList>
      </Flex>
    </Flex>
  );
};

export default MeetingDetails;
