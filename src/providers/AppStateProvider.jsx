// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React, { useContext, useState } from 'react';
const AppStateContext = React.createContext();

export const AppStateProvider = ({ children }) => {

  const setAppMeetingInfo = (meetingId, name) => {
    setMeeting(meetingId);
    setLocalName(name);
  };

  // Meeting ID
  const [meetingId, setMeeting] = useState(() => {
    const storedMeetingId = localStorage.getItem('meetingId');
    return storedMeetingId || '';
  });

  // UserName
  const [localUserName, setLocalName] = useState(() => {
    const storedUserName = localStorage.getItem('localUserName');
    return storedUserName || '';
  });

  const providerValue = {
    meetingId,
    localUserName,
    setAppMeetingInfo
  };

  return (
    <AppStateContext.Provider value={providerValue}>
      {children}
    </AppStateContext.Provider>
  );
};

export function useAppState() {
  const state = useContext(AppStateContext);

  if (!state) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return state;
}
