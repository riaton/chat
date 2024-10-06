// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React, { useState } from 'react';
import {
  FormField,
  Input,
  Button,
  Heading,
} from 'amazon-chime-sdk-component-library-react';

import './LoginWithCognito.css';

const LoginWithCognito = (props) => {
  const [userName, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, register } = props;

  const onRegister = (e) => {
    e.preventDefault();
    register(userName, password, '');
  };

  const onLogin = (e) => {
    e.preventDefault();
    login(userName, password);
  };

  const onUserName = (e) => {
    setUsername(e.target.value);
  };

  const onPassword = (e) => {
    setPassword(e.target.value);
  };

  return (
    <div>
      <Heading
        css="font-size: 0.875rem !important; line-height: 3rem !important;"
        level="2"
      >
        ユーザーIDとパスワードを入力してください
      </Heading>
      <form onSubmit={onLogin} className="signin-form">
        <div className="input-container">
          <FormField
            field={Input}
            label="ユーザーID"
            className="input username-input"
            onChange={(e) => onUserName(e)}
            value={userName}
            type="text"
            showClear
            layout="horizontal"
          />
          <FormField
            field={Input}
            label="パスワード"
            fieldProps={{ type: 'password' }}
            className="input password-input"
            onChange={(e) => onPassword(e)}
            value={password}
            showClear
            layout="horizontal"
            infoText="最低8文字(1文字以上の大文字, 1文字以上の数字, 1文字以上の特殊文字を含む)"
          />
        </div>
        <div className="signin-buttons">
          <Button onClick={onLogin} label="ログイン" variant="primary" />
          <span className="or-span">or</span>
          <Button onClick={onRegister} label="新規登録" variant="secondary" />
        </div>
      </form>
    </div>
  );
};

export default LoginWithCognito;
