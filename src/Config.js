// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import data from './backend/serverless/appconfig.json'
const appConfigJson = Object.assign({}, ...data.map((x) => ({[x.OutputKey]: x.OutputValue})));

const appConfig = {
    apiGatewayInvokeUrl: '' || appConfigJson.apiGatewayInvokeUrl,
    cognitoUserPoolId: '' || appConfigJson.cognitoUserPoolId,
    cognitoAppClientId: '' || appConfigJson.cognitoAppClientId,
    cognitoIdentityPoolId: '' || appConfigJson.cognitoIdentityPoolId,
    appInstanceArn: '' || appConfigJson.appInstanceArn,
    region: '',  // Only supported region for Amazon Chime SDK Messaging as of this writing
};
export default appConfig;
