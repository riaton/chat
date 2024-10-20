// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import Amplify from '@aws-amplify/core';
import appConfig from '../Config';

const configureAmplify = () => {
  Amplify.configure({
    Auth: {
      // REQUIRED only for Federated Authentication - Amazon Cognito Identity Pool ID
      identityPoolId: appConfig.cognitoIdentityPoolId,
      // REQUIRED - Amazon Cognito Region
      region: appConfig.region,
      // OPTIONAL - Amazon Cognito User Pool ID
      userPoolId: appConfig.cognitoUserPoolId,
      userPoolWebClientId: appConfig.cognitoAppClientId
    },
    Storage: {
      // REQUIRED - Amazon S3 Region
      region: appConfig.region,
      // REQUIRED Amazon Cognito Identity Pool ID
      identityPoolId: appConfig.cognitoIdentityPoolId
    }
  });
};

export default configureAmplify;
