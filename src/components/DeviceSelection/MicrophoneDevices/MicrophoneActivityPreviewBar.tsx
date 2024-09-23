// Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React, { useRef } from 'react';
import { useLocalAudioInputActivityPreview } from 'amazon-chime-sdk-component-library-react';

import ActivityBar from '../../ActivityBar';

const MicrophoneActivityPreviewBar = () => {
  const activityBarRef = useRef<HTMLDivElement>();
  useLocalAudioInputActivityPreview(activityBarRef);

  return <ActivityBar ref={activityBarRef} />;
};

export default MicrophoneActivityPreviewBar;
