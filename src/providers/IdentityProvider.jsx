/* eslint-disable import/no-extraneous-dependencies */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React, { useContext, useState, createContext, useEffect } from 'react';

import appConfig from '../Config';
import { IdentityService } from '../services/IdentityService';
import { useAuthContext } from './AuthProvider';

const IdentityServiceContext = createContext(null);

export const IdentityProvider = ({ children }) => {
  const { isAuthenticated } = useAuthContext();
  const [identityService] = useState(
      new IdentityService(appConfig.region, appConfig.cognitoUserPoolId)
  );

  useEffect(() => {
    if (!identityService || !isAuthenticated) return;
    identityService.setupClient();
  }, [identityService, isAuthenticated]);

  return (
    <IdentityServiceContext.Provider value={identityService}>
      {children}
    </IdentityServiceContext.Provider>
  );
};

export function useIdentityService() {
  const context = useContext(IdentityServiceContext);

  if (context === undefined) {
    throw new Error(
      'useIdentityService must be used within a IdentityServiceContext'
    );
  }

  return context;
}

export default IdentityProvider;
