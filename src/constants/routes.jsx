// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

const awsPath = '/Prod';
export const rootPath = window.location.href.includes(awsPath)
  ? `${awsPath}/`
  : '/';

const routes = {
  SIGNIN: `${rootPath}`,
  CHAT: `${rootPath}rooms`,
  DEVICE: `${rootPath}devices`,
  MEETING: `${rootPath}meeting`,
};

export default routes;
