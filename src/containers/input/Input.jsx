/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable import/no-unresolved */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React, { useState, useRef, useEffect } from 'react';
import {
  Input as InputComponent,
  Attachment,
  IconButton,
  useNotificationDispatch,
  Remove,
  Label,
} from 'amazon-chime-sdk-component-library-react';

import debounce from 'lodash/debounce';

import {
  Persistence,
  MessageType,
  sendChannelMessage,
  getChannelMessage,
} from '../../api/ChimeAPI';
import formatBytes from '../../utilities/formatBytes';
import { useChatMessagingState, useChatChannelState, } from '../../providers/ChatMessagesProvider';
import { useAuthContext, } from '../../providers/AuthProvider';

import './Input.css';

const Input = ({ activeChannelArn, member, hasMembership }) => {
  const [text, setText] = useState('');
  const inputRef = useRef();
  const notificationDispatch = useNotificationDispatch();
  const { messages, setMessages } = useChatMessagingState();
  const { activeChannel, } = useChatChannelState();

  const { isAnonymous } = useAuthContext();

  const resetState = () => {
    setText('');
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeChannelArn]);
  const eventHandler = async () => {
    const content = JSON.stringify({Typing: 'Indicator'});
    if(!activeChannel.ElasticChannelConfiguration && !activeChannel.SubChannelId){
      await sendChannelMessage(
        activeChannel.ChannelArn,
        content,
        'NON_PERSISTENT',
        'CONTROL',
        member,
        activeChannel.SubChannelId,
    );
    }
  };
  const eventHandlerWithDebounce = React.useCallback(debounce(eventHandler, 500), []);

  useEffect(() => {
    if (text) {
      eventHandlerWithDebounce();
    }
  }, [text]);

  const onChange = (e) => {
    setText(e.target.value);
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    let sendMessageResponse;
    sendMessageResponse = await sendChannelMessage(activeChannelArn, text, Persistence.PERSISTENT, MessageType.STANDARD, member, activeChannel.SubChannelId);
    resetState();
    if (sendMessageResponse.response.Status == 'PENDING') {
      const sentMessage = await getChannelMessage(activeChannelArn, member, sendMessageResponse.response.MessageId, activeChannel.SubChannelId);
      const newMessages = [...messages, sentMessage];
      setMessages(newMessages);
    }
  };

  if (hasMembership) {
    return (
      <div className="message-input-container">
        <form onSubmit={onSubmit} className="message-input-form">
          <InputComponent
            onChange={onChange}
            value={text}
            type="text"
            placeholder="Type your message"
            autoFocus
            className="text-input"
            ref={inputRef}
          />
        </form>
      </div>
    );
  }
  return (
    <div className="message-input-container join-channel-message">
      Join this channel to send messages.
    </div>
  );
};

export default Input;
