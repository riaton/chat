// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React, { useContext, useState } from 'react';
const UserPermissionContext = React.createContext();

const UserPermissionProvider = ({ children }) => {
  const [role, setRole] = useState('user');
  const providerValue = {
    role,
    setRole,
  };

  return (
    <UserPermissionContext.Provider value={providerValue}>
      {children}
    </UserPermissionContext.Provider>
  );
};

const useUserPermission = () => {
  const context = useContext(UserPermissionContext);

  if (!context) {
    throw new Error(
      'useUserPermission must be used within UserPermissionProvider'
    );
  }

  return context;
};

export { UserPermissionProvider, useUserPermission };
