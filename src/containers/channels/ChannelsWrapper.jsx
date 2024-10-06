/* eslint-disable no-console */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

/* eslint-disable no-use-before-define */
/* eslint-disable import/no-unresolved */
/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef } from 'react';
import {
  PopOverItem,
  PopOverSubMenu,
  IconButton,
  Dots,
  useNotificationDispatch,
  useMeetingManager,
  ChannelList,
  ChannelItem,
  SecondaryButton,
} from 'amazon-chime-sdk-component-library-react';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';
import { useHistory } from 'react-router-dom';
import { useTheme } from 'styled-components';
import {
  Persistence,
  MessageType,
  createMemberArn,
  createChannelMembership,
  createChannel,
  updateChannel,
  sendChannelMessage,
  listChannels,
  listChannelMembershipsForAppInstanceUser,
  deleteChannel,
  describeChannel,
  listChannelMemberships,
  deleteChannelMembership,
  listChannelModerators,
  createMeeting,
  createAttendee,
  getMeeting,
  endMeeting,
  createGetAttendeeCallback,
  resetAWSClients,
} from '../../api/ChimeAPI';
import appConfig from '../../Config';

import { useUserPermission } from '../../providers/UserPermissionProvider';
import mergeArrayOfObjects from '../../utilities/mergeArrays';
import {
  useChatChannelState,
  useChatMessagingState,
} from '../../providers/ChatMessagesProvider';
import { useAppState } from '../../providers/AppStateProvider';
import { useAuthContext } from '../../providers/AuthProvider';
import ModalManager from './ModalManager';
import routes from '../../constants/routes';

import {
  PresenceAutoStatus,
  PresenceMode,
  PUBLISH_INTERVAL,
  toPresenceMessage,
} from '../../utilities/presence';

import './ChannelsWrapper.css';

const ChannelsWrapper = () => {
  const history = useHistory();
  const meetingManager = useMeetingManager();
  const dispatch = useNotificationDispatch();
  const [modal, setModal] = useState('');
  const [selectedMember, setSelectedMember] = useState({}); // TODO change to an empty array when using batch api
  const [activeChannelModerators, setActiveChannelModerators] = useState([]);
  const { userId } = useAuthContext().member;
  const { member, isAuthenticated } = useAuthContext();
  const userPermission = useUserPermission();
  const isAuthenticatedRef = useRef(isAuthenticated);
  const messagingUserArn = `${appConfig.appInstanceArn}/user/${userId}`;
  const {
    activeChannelRef, // 選択されているチャネルを参照
    channelList, // チャネルリスト
    channelListRef, // チャネルリストを参照
    setChannelList, // チャネルリストを設定
    setActiveChannel, // 選択されているチャネルを設定
    activeChannel, // 選択されているチャネル
    activeChannelMemberships, // 選択されているチャネルのメンバー一覧
    setActiveChannelMemberships, // 選択されているチャネルのメンバー一覧を設定
    unreadChannels, // 選択されていないチャネル一覧
    setUnreadChannels, // 選択されていないチャネル一覧を設定
    hasMembership, //そのチャネルにメンバーとして参加しているかどうか
    meetingInfo, 
    setMeetingInfo,
  } = useChatChannelState();
  const { setMessages } = useChatMessagingState(); // そのChannelのメッセージ一覧を設定
  const { setAppMeetingInfo } = useAppState();
  const currentTheme = useTheme();

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  });

  // get all channels
  useEffect(() => {
    if (!userId) return;
    const fetchChannels = async () => {
      const userChannelMemberships = await listChannelMembershipsForAppInstanceUser(
        userId
      );
      const userChannelList = userChannelMemberships.map(
        (channelMembership) => {
          const channelSummary = channelMembership.ChannelSummary;
          return channelSummary;
        }
      );
      const publicChannels = await listChannels(
        appConfig.appInstanceArn,
        userId
      );

      setChannelList(
        mergeArrayOfObjects(publicChannels, userChannelList, 'ChannelArn')
      );
      await publishStatusToAllChannels();
    };
    fetchChannels();
  }, [userId]);

  useEffect(() => {
    if (!isAuthenticated) {
      resetAWSClients();
      console.clear();
      setActiveChannel('');
      setChannelList([]);
    };
  }, [isAuthenticated]);

  // get channel memberships
  useEffect(() => {
    if (
      activeChannel.ChannelArn
    ) {
      activeChannelRef.current = activeChannel;
      fetchMemberships();
      publishStatusToAllChannels();
    }
  }, [activeChannel.ChannelArn]);

  // track channel presence
  useEffect(() => {
    if (channelList.length > 0) {
      channelListRef.current = channelList;
      startPublishStatusWithInterval();
    }
  }, [channelList]);

  // get meeting id
  useEffect(() => {
    if (meetingInfo) {
      setModal('JoinMeeting');
    }
  }, [meetingInfo]);

  function startPublishStatusWithInterval() { // ステータスを定期的に送信？
    let publishTimeout;
    (async function publishStatusWithInterval() {
      if (!isAuthenticatedRef.current) {
        clearTimeout(publishTimeout);
        return;
      }
      await publishStatusToAllChannels();
      publishTimeout = setTimeout(publishStatusWithInterval, PUBLISH_INTERVAL);
    })();
  }

  function computeAutoStatusForAChannel(channel) { // チャネルのステータスを計算?
    const persistedPresence = JSON.parse(channel.Metadata || '{}').Presence;
    const isCustomStatus =
      persistedPresence && persistedPresence.filter((p) => p.u === userId)[0];
    if (isCustomStatus) {
      return null;
    }

    if (location.pathname.includes(routes.MEETING)) {
      return PresenceAutoStatus.Busy;
    } else if (channel.ChannelArn === activeChannelRef.current.ChannelArn) {
      return PresenceAutoStatus.Online;
    } else {
      return PresenceAutoStatus.Idle;
    }
  }

  async function publishStatusToAllChannels() { // チャネルにステータスを送信？
    const servicePromises = [];
    for (const channel of channelListRef.current) {
      const channelType = JSON.parse(channel.Metadata || '{}').ChannelType;
      const status = computeAutoStatusForAChannel(channel);
      if (status) {
        servicePromises.push(sendChannelMessage(
          channel.ChannelArn,
          toPresenceMessage(PresenceMode.Auto, status, true),
          Persistence.NON_PERSISTENT,
          MessageType.CONTROL,
          member,
        ));
      }
    }
    return await Promise.all(servicePromises);
  }

  const getChannels = (channel) => {
    {
      return (
        <React.Fragment key={channel.ChannelArn}>
          <ChannelItem
            key={channel.ChannelArn}
            name={channel.Name}
            actions={loadUserActions(userPermission.role, channel)}
            isSelected={
              channel.ChannelArn === activeChannel.ChannelArn
            }
            onClick={(e) => {
              e.stopPropagation();
              console.log('Calling channel change handler');
              channelIdChangeHandler(channel);
            }}
            unread={unreadChannels.includes(channel.ChannelArn)}
            unreadBadgeLabel="New"
          />
        </React.Fragment>
      );
    }
  };

  const onCreateChannel = async (e, newName, mode, privacy) => {
    e.preventDefault();
    if (!newName) {
      dispatch({
        type: 0,
        payload: {
          message: 'エラー。チャネル名は0文字にはできません',
          severity: 'error',
        },
      });
    } else {
      const channelArn = await createChannel(
        appConfig.appInstanceArn,
        null,
        newName,
        mode,
        privacy,
        userId
      );
      if (channelArn) {
        const channel = await describeChannel(channelArn, userId);
        setModal('');
        if (channel) {
          setChannelList([...channelList, channel]);

          dispatch({
            type: 0,
            payload: {
              message: 'チャネルの作成に成功しました',
              severity: 'success',
              autoClose: true,
            },
          });
          setActiveChannel(channel);
          channelIdChangeHandler(channel);
        } else {
          dispatch({
            type: 0,
            payload: {
              message: 'エラー。チャネル情報の取得に失敗しました',
              severity: 'error',
              autoClose: false,
            },
          });
        }
      } else {
        dispatch({
          type: 0,
          payload: {
            message: 'Error, could not create new channel.',
            severity: 'error',
            autoClose: false,
          },
        });
      }
    }
  };

  const joinMeeting = async (e) => {
    e.preventDefault();

    if (activeChannel.Metadata) {
      let metadata = JSON.parse(activeChannel.Metadata);
      let meetingId = metadata.meetingId;

      // Getting meeting details
      let meetingResponse = await getMeeting(meetingId);

      // Create own attendee and join meeting
      meetingManager.getAttendee = createGetAttendeeCallback();
      const { JoinInfo } = await createAttendee(member.username, member.userId, activeChannel.ChannelArn, JSON.stringify(meetingResponse.Meeting));
      const meetingSessionConfiguration = new MeetingSessionConfiguration(
        JoinInfo.Meeting,
        JoinInfo.Attendee
      );
      await meetingManager.join(meetingSessionConfiguration);

      setAppMeetingInfo(JoinInfo.Meeting.MeetingId, member.username);
      history.push(routes.DEVICE);
    }
  };

  const startMeeting = async (e) => {
    e.preventDefault();

    let meetingName = `${activeChannel.Name} 会議`;

    // Create Meeting Channel and Memberships from existing Channel
    const meetingChannelArn = await createChannel(
      appConfig.appInstanceArn,
      null,
      meetingName,
      'RESTRICTED',
      'PRIVATE',
      userId
    );
    const meetingChannel = await describeChannel(meetingChannelArn, userId);
    channelIdChangeHandler(meetingChannel);

    const memberships = activeChannelMemberships;
    memberships.forEach((membership) => createChannelMembership(
      meetingChannelArn,
      membership.Member.Arn,
      userId
    ));

    // Create meeting and attendee for self
    meetingManager.getAttendee = createGetAttendeeCallback();
    const { JoinInfo } = await createMeeting(member.username, member.userId, meetingChannelArn);
    const meetingSessionConfiguration = new MeetingSessionConfiguration(
      JoinInfo.Meeting,
      JoinInfo.Attendee
    );
    await meetingManager.join(meetingSessionConfiguration);

    const meetingId = JoinInfo.Meeting.MeetingId;
    const meeting = JSON.stringify(JoinInfo.Meeting);

    // Update meeting channel metadata with meeting info
    let meetingChannelmetadata = {
      isMeeting: true,
      meetingId: meetingId
    };

    await updateChannel(
      meetingChannelArn,
      meetingName,
      'RESTRICTED',
      JSON.stringify(meetingChannelmetadata),
      userId
    );

    // Send the meeting info as a chat message in the existing channel
    const options = {};
    options.Metadata = `{"isMeetingInfo":true}`;
    let meetingInfoMessage = {
      meeting: meeting,
      channelArn: meetingChannelArn,
      channelName: meetingName,
      inviter: member.username,
    };
    await sendChannelMessage(
      activeChannel.ChannelArn,
      JSON.stringify(meetingInfoMessage),
      Persistence.NON_PERSISTENT,
      MessageType.STANDARD,
      member,
      options
    );

    setAppMeetingInfo(meetingId, member.username);
    history.push(routes.DEVICE);
  };

  const joinChannel = async (e) => {
    e.preventDefault();
    const membership = await createChannelMembership(
      activeChannel.ChannelArn,
      `${appConfig.appInstanceArn}/user/${userId}`,
      userId
    );
    if (membership) {
      const memberships = activeChannelMemberships;
      memberships.push({ Member: membership });
      setActiveChannelMemberships(memberships);
      channelIdChangeHandler(activeChannel);
      dispatch({
        type: 0,
        payload: {
          message: `チャネル「${activeChannel.Name}」に参加しました`,
          severity: 'success',
          autoClose: true,
        },
      });
    } else {
      dispatch({
        type: 0,
        payload: {
          message: 'エラー。チャネルに参加できませんでした',
          severity: 'error',
          autoClose: true,
        },
      });
    }
  };

  const channelIdChangeHandler = async (channel) => {
    if (activeChannel.ChannelArn === channel.ChannelArn)
      return;
    let mods = [];
    setActiveChannelModerators([]);

    var isModerator = false;
    const channelType = JSON.parse(channel.Metadata || '{}').ChannelType;
    try {
      mods = await listChannelModerators(channel.ChannelArn, userId);
      setActiveChannelModerators(mods);
    } catch (err) {
      if (channel.Privacy != 'PUBLIC')
        console.error('ERROR', err);
    }

    isModerator =
      mods?.find(
        (moderator) => moderator.Moderator.Arn === messagingUserArn
      ) || false;
    // Assessing user role for given channel
    userPermission.setRole(isModerator ? 'moderator' : 'user');

    const newChannel = await describeChannel(channel.ChannelArn, userId);
    channel = newChannel;
    setActiveChannel(channel);
    setUnreadChannels(unreadChannels.filter((c) => c !== channel.ChannelArn));
  };

  const handleChannelDeletion = async (e, channelArn, channelMetadata) => {
    e.preventDefault();

    await deleteChannel(channelArn, userId);
    const newChannelList = channelList.filter(
      (channel) => channel.ChannelArn !== channelArn
    );
    setChannelList(newChannelList);
    setActiveChannel('');
    setMessages([]);
    setModal('');
    dispatch({
      type: 0,
      payload: {
        message: 'チャネルを削除しました',
        severity: 'success',
        autoClose: true,
      },
    });

    // If the channel was a meeting channel, end the associated meeting
    if (channelMetadata) {
      const metadata = JSON.parse(channelMetadata);
      if (metadata.isMeeting) {
        await endMeeting(metadata.meetingId);
      }
    }
  };

  const formatMemberships = (memArr) =>
    memArr.flatMap((m) =>
      m.Member.Arn !== messagingUserArn
        ? [{ value: m.Member.Arn, label: m.Member.Name }]
        : []
    );

  const fetchMemberships = async () => {
    const channelType = JSON.parse(activeChannel.Metadata || '{}').ChannelType;
    const memberships = await listChannelMemberships(
      activeChannel.ChannelArn,
      userId
    );
    setActiveChannelMemberships(memberships);
  };

  const handlePickerChange = (changes) => {
    setSelectedMember(changes);
  };

  const handleJoinMeeting = async (e, meeting, meetingChannelArn) => {
    e.preventDefault();
    const meetingChannel = {
      ChannelArn: meetingChannelArn
    };

    await channelIdChangeHandler(meetingChannel);

    meetingManager.getAttendee = createGetAttendeeCallback();
    const { JoinInfo } = await createAttendee(member.username, member.userId, meetingChannelArn, meeting);
    const meetingSessionConfiguration = new MeetingSessionConfiguration(
      JoinInfo.Meeting,
      JoinInfo.Attendee
    );
    await meetingManager.join(meetingSessionConfiguration);

    setAppMeetingInfo(JoinInfo.Meeting.MeetingId, member.username);
    setModal('');
    setMeetingInfo(null);

    history.push(routes.DEVICE);
  };

  const handleMessageAll = async (e, meetingChannelArn) => {
    e.preventDefault();
    setModal('');
    setMeetingInfo(null);
    
    const meetingChannel = {
      ChannelArn: meetingChannelArn
    };

    await channelIdChangeHandler(meetingChannel);
  };

  const handleDeleteMemberships = () => {
    try {
      deleteChannelMembership(
        activeChannel.ChannelArn,
        selectedMember.value,
        userId
      );
      dispatch({
        type: 0,
        payload: {
          message: 'メンバーを削除しました',
          severity: 'success',
          autoClose: true,
        },
      });
      setSelectedMember({});
    } catch (err) {
      dispatch({
        type: 0,
        payload: {
          message: 'エラー。メンバーの削除に失敗しました',
          severity: 'error',
        },
      });
    }
  };

  const handleLeaveChannel = async () => {
    try {
      await deleteChannelMembership(
        activeChannel.ChannelArn,
        createMemberArn(userId),
        userId
      );
      dispatch({
        type: 0,
        payload: {
          message: `チャネル「${activeChannel.Name}」から退出しました`,
          severity: 'success',
          autoClose: true,
        },
      });
      setSelectedMember({});
    } catch (err) {
      dispatch({
        type: 0,
        payload: {
          message: 'エラー。チャネルからの退出に失敗しました',
          severity: 'error',
        },
      });
    }
  };

  const loadUserActions = (role, channel) => {
    const map =
      channel.Metadata &&
      JSON.parse(channel.Metadata).Presence &&
      Object.fromEntries(
        JSON.parse(channel.Metadata).Presence?.map((entry) => [
          entry.u,
          entry.s,
        ])
      );

    const joinChannelOption = (
      <PopOverItem key="join_channel" as="button" onClick={joinChannel}>
        <span>チャネルに参加</span>
      </PopOverItem>
    );
    const viewMembersOption = (
      <PopOverItem
        key="view_members"
        as="button"
        onClick={() => setModal('ViewMembers')}
      >
        <span>メンバー一覧</span>
      </PopOverItem>
    );
    const manageMembersOption = (
      <PopOverItem
        key="manage_members"
        as="button"
        onClick={() => setModal('ManageMembers')}
      >
        <span>メンバーを編集</span>
      </PopOverItem>
    );
    const startMeetingOption = (
      <PopOverItem key="start_meeting" as="button" onClick={startMeeting}>
        <span>会議を開始</span>
      </PopOverItem>
    );
    const joinMeetingOption = (
      <PopOverItem key="join_meeting" as="button" onClick={joinMeeting}>
        <span>会議に参加</span>
      </PopOverItem>
    );
    const leaveChannelOption = (
      <PopOverItem
        key="leave_channel"
        as="button"
        onClick={() => setModal('LeaveChannel')}
      >
      <span>チャネルから退出</span>
      </PopOverItem>
    );
    const deleteChannelOption = (
      <PopOverItem
        key="delete_channel"
        as="button"
        onClick={() => setModal('DeleteChannel')}
      >
        <span>チャネルを削除</span>
      </PopOverItem>
    );
    const meetingModeratorActions = [
      manageMembersOption,
      joinMeetingOption,
      leaveChannelOption,
      deleteChannelOption,
    ];
    const meetingMemberActions = [
      viewMembersOption,
      joinMeetingOption,
      leaveChannelOption,
    ];
    const moderatorActions = [
      manageMembersOption,
      startMeetingOption,
      leaveChannelOption,
      deleteChannelOption,
    ];
    const restrictedMemberActions = [
      viewMembersOption,
      startMeetingOption,
      leaveChannelOption,
    ];
    const nonMemberActions = [
      joinChannelOption,
      viewMembersOption,
    ];

    if (!hasMembership) {
      return nonMemberActions;
    }

    if (channel.Metadata) {
      let metadata = JSON.parse(channel.Metadata);
      if (metadata.isMeeting) {
        return role === 'moderator' ? meetingModeratorActions : meetingMemberActions;
      }
    }

    if (role === 'moderator') {
      return moderatorActions;
    }
    return restrictedMemberActions;
  };

  return (
    <>
      <ModalManager
        modal={modal}
        setModal={setModal}
        activeChannel={activeChannel}
        meetingInfo={meetingInfo}
        userId={userId}
        handleChannelDeletion={handleChannelDeletion}
        handleDeleteMemberships={handleDeleteMemberships}
        handleJoinMeeting={handleJoinMeeting}
        handleMessageAll={handleMessageAll}
        handlePickerChange={handlePickerChange}
        formatMemberships={formatMemberships}
        activeChannelMemberships={activeChannelMemberships}
        selectedMember={selectedMember}
        onCreateChannel={onCreateChannel}
        activeChannelModerators={activeChannelModerators}
        handleLeaveChannel={handleLeaveChannel}
      />
      <div className="channel-list-wrapper">
        <div className="channel-list-header">
          <div className="channel-list-header-title">チャネル一覧</div>
          <IconButton
            className="create-channel-button channel-options"
            onClick={() => setModal('NewChannel')}
            icon={<Dots width="1.5rem" height="1.5rem" />}
          />
        </div>
        <ChannelList
          style={{
            padding: '8px',
            width: '100%'
          }}
        >
          {channelList.map((channel) => getChannels(channel))}
        </ChannelList>
      </div>
    </>
  );
};

export default ChannelsWrapper;
