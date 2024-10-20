/* eslint-disable no-console */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import { Badge } from 'amazon-chime-sdk-component-library-react';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';

import appConfig from '../../Config';
import { useAuthContext } from '../AuthProvider';
import {
  Persistence,
  createMemberArn,
  describeChannel,
  listChannelMessages,
} from '../../api/ChimeAPI';
import MessagingService from '../../services/MessagingService';
import mergeArrayOfObjects from '../../utilities/mergeArrays';

const ChatMessagingServiceContext = createContext(MessagingService);
const ChatMessagingState = createContext();
const ChatChannelState = createContext();

const MessagingProvider = ({ children }) => {
  const { member, isAuthenticated } = useAuthContext();
  const [messagingService] = useState(() => new MessagingService());
  // Channel related
  const [activeChannel, setActiveChannel] = useState({});
  const [activeChannelMemberships, setActiveChannelMemberships] = useState([]);
  const activeChannelRef = useRef(activeChannel.ChannelArn);
  const [channelList, setChannelList] = useState([]);
  const [unreadChannels, setUnreadChannels] = useState([]);
  const unreadChannelsListRef = useRef(unreadChannels);
  const hasMembership =
    activeChannelMemberships
      .map((m) => m.Member.Arn)
      .indexOf(createMemberArn(member.userId)) > -1;
  // Messages
  const [messages, setMessages] = useState([]);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const messagesRef = useRef(messages);
  const channelListRef = useRef(channelList);
  const activeChannelMembershipsRef = useRef(activeChannelMemberships);
  const [channelMessageToken, setChannelMessageToken] = useState('');
  const channelMessageTokenRef = useRef(channelMessageToken);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
    messagesRef.current = messages;
    activeChannelRef.current = activeChannel;
    channelListRef.current = channelList;
    unreadChannelsListRef.current = unreadChannels;
    activeChannelMembershipsRef.current = activeChannelMemberships;
    channelMessageTokenRef.current = channelMessageToken;
  });

  // Messaging service initiator
  useEffect(() => {
    if (!isAuthenticated) return;

    // Start messaging service
    messagingService.connect(member);

    return () => {
      messagingService.close();
    };
  }, [isAuthenticated]);

  const processChannelMessage = async (message) => {
    const promise = Promise.resolve(message);
    const newMessage = await promise.then((m) => m);

    let isDuplicate = false;

    messagesRef.current.forEach((m, i, self) => {
      if ((m.response?.MessageId || m.MessageId) === newMessage.MessageId) {
        console.log('Duplicate message found', newMessage);
        isDuplicate = true;
        self[i] = newMessage;
      }
    });

    let newMessages = [...messagesRef.current];

    if (!isDuplicate && newMessage.Persistence === Persistence.PERSISTENT) {
      newMessages = [...newMessages, newMessage];
    }

    setMessages(newMessages);
  };

  const addUpdateDisabledMessage = async (recordChannelArn) => {
    let newMessages = [...messagesRef.current];
    const newMessage = {
      OldMessageUpdateDisabled: true,
    };
    newMessages = [...newMessages, newMessage];
    setMessages(newMessages);
  }

  const messagesProcessor = async (message) => {
    const messageType = message?.headers['x-amz-chime-event-type'];
    const record = JSON.parse(message?.payload);
    console.log('Incoming Message', message);
    switch (messageType) {
      // Channel Messages
      case 'CREATE_CHANNEL_MESSAGE':
      case 'REDACT_CHANNEL_MESSAGE':
      case 'UPDATE_CHANNEL_MESSAGE':
      case 'DELETE_CHANNEL_MESSAGE':
      case 'DENIED_CREATE_CHANNEL_MESSAGE':
      case 'FAILED_CREATE_CHANNEL_MESSAGE':
      case 'DENIED_UPDATE_CHANNEL_MESSAGE':
      case 'FAILED_UPDATE_CHANNEL_MESSAGE':
      case 'PENDING_CREATE_CHANNEL_MESSAGE':
      case 'PENDING_UPDATE_CHANNEL_MESSAGE':
        // Process channel message
        if (activeChannelRef.current.ChannelArn === record?.ChannelArn) {
          processChannelMessage(record);
        } else {
          const findMatch = unreadChannelsListRef.current.find(
            (chArn) => (chArn === record.ChannelArn)
          );
          if (findMatch) return;
          const newUnreads = [
            ...unreadChannelsListRef.current,
            record.ChannelArn,
          ];
          setUnreadChannels(newUnreads);
        }
        break;
      // Channels actions
      case 'CREATE_CHANNEL':
      case 'UPDATE_CHANNEL':
        {
          const newChannelArn = record.ChannelArn;
          const updatedChannelList = channelListRef.current.map((c) => {
            if (c.ChannelArn !== newChannelArn) {
              return c;
            }
            return record;
          });
          setChannelList(updatedChannelList);
          setActiveChannel(record);
        }
        break;
      case 'DELETE_CHANNEL': {
        setChannelList(
          channelListRef.current.filter(
            (chRef) => chRef.ChannelArn !== record.ChannelArn
          )
        );
        if (activeChannelRef.current.ChannelArn === record.ChannelArn) {
          setActiveChannel({});
        }
        break;
      }
      // Channel Memberships
      case 'CREATE_CHANNEL_MEMBERSHIP':
        {
          var newChannel = await describeChannel(
            record.ChannelArn,
            member.userId
          );

          if (newChannel.Metadata) {
            let metadata = JSON.parse(newChannel.Metadata);
            if (metadata.isHidden) return;
          }
          var newChannelList = [];
          const channelType = JSON.parse(activeChannelRef.current.Metadata || '{}').ChannelType;
          newChannelList = mergeArrayOfObjects(
            channelListRef.current,
            [newChannel],
            'ChannelArn'
          );
          if (record.ChannelArn == activeChannelRef.current.ChannelArn) {
            const newMessages = await listChannelMessages(
              newChannel.ChannelArn,
              member.userId
            );
            setMessages(newMessages.Messages);
            setChannelMessageToken(newMessages.NextToken);
            setActiveChannel(newChannel);
          }
          
          setChannelList(newChannelList);
        }
        break;
      case 'UPDATE_CHANNEL_MEMBERSHIP':
        if (
          `${appConfig.appInstanceArn}/user/${member.userId}` !==
          record?.InvitedBy.Arn
        ) {
          const channel = await describeChannel(
            record?.ChannelArn,
            member.userId
          );
          var newChannelList;
          newChannelList = mergeArrayOfObjects(
            channelListRef.current,
            [channel],
            'ChannelArn'
          );
          setChannelList(newChannelList);
        }
        break;
      case 'DELETE_CHANNEL_MEMBERSHIP':
        // You are removed
        if (record.Member.Arn.includes(member.userId)) {
          setChannelList(
            channelListRef.current.filter(
              (chRef) => chRef.ChannelArn !== record.ChannelArn
            )
          );
          if (activeChannelRef.current.ChannelArn === record.ChannelArn) {
            setActiveChannel({});
          }
        } else {
          // Someone else is removed
          const updatedMemberships = activeChannelMembershipsRef.current.filter(
            (m) => m.Member.Arn !== record.Member.Arn
          );
          setActiveChannelMemberships(updatedMemberships);
        }
        break;
      default:
        console.log(`Unexpected message type! ${messageType}`);
    }
  };

  // Subscribe to MessagingService for updates
  useEffect(() => {
    if (!isAuthenticated) return;

    messagingService.subscribeToMessageUpdate(messagesProcessor);
    return () => {
      messagingService.unsubscribeFromMessageUpdate(messagesProcessor);
    };
  }, [messagingService, isAuthenticated]);

  // Providers values
  const messageStateValue = {
    messages,
    messagesRef,
    setMessages,
  };
  const channelStateValue = {
    channelList,
    activeChannel,
    activeChannelRef,
    channelListRef,
    unreadChannels,
    activeChannelMemberships,
    hasMembership,
    channelMessageToken,
    channelMessageTokenRef,
    setActiveChannel,
    setActiveChannelMemberships,
    setChannelMessageToken,
    setChannelList,
    setUnreadChannels
  };
  return (
    <ChatMessagingServiceContext.Provider value={messagingService}>
      <ChatChannelState.Provider value={channelStateValue}>
        <ChatMessagingState.Provider value={messageStateValue}>
          {children}
        </ChatMessagingState.Provider>
      </ChatChannelState.Provider>
    </ChatMessagingServiceContext.Provider>
  );
};

const useChatMessagingService = () => {
  const context = useContext(ChatMessagingServiceContext);

  if (!context) {
    throw new Error(
      'useChatMessagingService must be used within ChatMessagingServiceContext'
    );
  }

  return context;
};

const useChatMessagingState = () => {
  const context = useContext(ChatMessagingState);

  if (!context) {
    throw new Error(
      'useChatMessagingState must be used within ChatMessagingState'
    );
  }

  return context;
};

const useChatChannelState = () => {
  const context = useContext(ChatChannelState);

  if (!context) {
    throw new Error('useChatChannelState must be used within ChatChannelState');
  }

  return context;
};

export {
  MessagingProvider,
  useChatChannelState,
  useChatMessagingService,
  useChatMessagingState,
};
