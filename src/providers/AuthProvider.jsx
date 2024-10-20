/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Auth } from '@aws-amplify/auth';
import { Credentials } from '@aws-amplify/core'
import { useNotificationDispatch } from 'amazon-chime-sdk-component-library-react';
import appConfig from '../Config';
import AWS from 'aws-sdk';

const AuthContext = createContext();
const AuthProvider = ({ children }) => {
  const notificationDispatch = useNotificationDispatch();
  // Member
  const [member, setMember] = useState({
    username: '',
    userId: '',
  });
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const userSignOut = async () => {
    try {
      await Auth.signOut().then(() => {
        AWS.config.credentials = null;
        setIsAuthenticated(false);
        setMember({ username: '', userId: '' });
      });
    } catch (error) {
      console.log(`error signing out ${error}`);
    }
  };

  const userSignUp = async (username, password) => {
    try {
      await Auth.signUp({
        username,
        password,
        attributes: {
          // TODO: Utilize input field for email that way we can then have users self confirm after reg.
          email: 'email@me.com',
          profile: 'none',
        },
      });
      notificationDispatch({
        type: 0,
        payload: {
          message:
            'Your registration information has been set to your administrator. Contact them for additional instructions.',
          severity: 'success',
        },
      });
    } catch (error) {
      console.log('error signing up:', error);
      notificationDispatch({
        type: 0,
        payload: {
          message: 'Registration failed.',
          severity: 'error',
        },
      });
    }
  };

  const updateUserAttributes = async (userId) => {
    try {
      const user = await Auth.currentAuthenticatedUser();

      await Auth.updateUserAttributes(user, {
        profile: userId,
      });
    } catch (err) {
      console.log(err);
    }
  };

  const getAwsCredentialsFromCognito = async () => {
    AWS.config.region = appConfig.region;
    const creds = await Credentials.get();
    AWS.config.credentials = new AWS.Credentials(
        creds.accessKeyId,
        creds.secretAccessKey,
        creds.sessionToken);

    AWS.config.credentials.needsRefresh = function() {
      return Date.now() > creds.expiration;
    }

    AWS.config.credentials.refresh = function(cb) {
      console.log("Refresh Cognito IAM Creds");
      Auth.currentUserCredentials().then(getAwsCredentialsFromCognito().then(cb()));
    }
    return creds;
  };

  const setAuthenticatedUserFromCognito = () => {
    Auth.currentUserInfo()
        .then(curUser => {
          setMember({ username: curUser.username, userId: curUser.id });
          if (curUser.attributes?.profile === 'none') {
            updateUserAttributes(curUser.id);
            // Once we set attribute let's have user relogin to refresh SigninHookFn trigger.
            setIsAuthenticated(false);

            notificationDispatch({
              type: 0,
              payload: {
                message:
                    'Your account is activated! Please sign in again to confirm.',
                severity: 'success',
              },
            });
          } else {
            setIsAuthenticated(true);
          }
        })
        .catch((err) => {
          console.log(`Failed to set authenticated user! ${err}`);
        });
    getAwsCredentialsFromCognito();
  };

  const userSignIn = (username, password) => {
    Auth.signIn({ username, password })
        .then(setAuthenticatedUserFromCognito)
        .catch((err) => {
          console.log(err);
          notificationDispatch({
            type: 0,
            payload: {
              message: 'Your username and/or password is invalid!',
              severity: 'error',
            },
          });
        });
  };

  useEffect(() => {
    Auth.currentAuthenticatedUser()
        .then(setAuthenticatedUserFromCognito)
        .catch((err) => {
          console.log(err);
          setIsAuthenticated(false);
        });
  }, [Auth]);

  const authFulfiller = {
    member,
    isAuthenticated,
    userSignOut,
    userSignUp,
    userSignIn
  };

  return (
      <AuthContext.Provider value={authFulfiller}>
        {children}
      </AuthContext.Provider>
  );
};

const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return context;
};

export { AuthProvider, useAuthContext };
