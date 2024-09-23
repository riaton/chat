// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React from 'react';
import ReactDOM from 'react-dom';
import Chat from './Chat';
import configureAmplify from './services/servicesConfig';

// Call services configuration
configureAmplify();

document.addEventListener('DOMContentLoaded', _event => {
  ReactDOM.render(<Chat />, document.getElementById('root'));
});
