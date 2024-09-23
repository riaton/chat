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
  PopOverSeparator,
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
import {
  Persistence,
  MessageType,
  createMemberArn,
  createChannelMembership,
  createChannel,
  updateChannel,
  listChannelMessages,
  sendChannelMessage,
  listChannels,
  listChannelMembershipsForAppInstanceUser,
  listChannelsModeratedByAppInstanceUser,
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
  toPresenceMap,
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
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [elasticChannelArnList, setElastiChannelArnList] = useState([]);
  const [standardChannelArnList, setStandardChannelArnList] = useState([]);
  const maximumMembershipsAllowed = '1000000';

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const {
    activeChannelRef,
    channelList,
    channelListRef,
    channelListModerator,
    setChannelListModerator,
    setChannelList,
    setActiveChannel,
    activeChannel,
    activeChannelMemberships,
    setActiveChannelMemberships,
    setChannelMessageToken,
    unreadChannels,
    setUnreadChannels,
    hasMembership,
    meetingInfo,
    setMeetingInfo,
    activeView,
    setActiveView,
    moderatedChannel,
    setModeratedChannel,
  } = useChatChannelState();
  const { setMessages } = useChatMessagingState();
  const { setAppMeetingInfo } = useAppState();

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  });

  const handleSwichViewClick = (e) => {
    if (activeView === 'Moderator') {
      setActiveView('User');
      setActiveChannel('');
    } else {
      setActiveView('Moderator');
    }
  };

  // get all channels
  useEffect(() => {
    if (!userId) return;
    const fetchChannels = async () => {
      if (activeView === 'User') {
        const userChannelMemberships = await listChannelMembershipsForAppInstanceUser(
          userId
        );
        const userChannelList = userChannelMemberships.map(
          (channelMembership) => {
            const channelSummary = channelMembership.ChannelSummary;
            channelSummary.SubChannelId =
              channelMembership.AppInstanceUserMembershipSummary.SubChannelId;

            return channelSummary;
          }
        );

        const publicChannels = await listChannels(
          appConfig.appInstanceArn,
          userId
        );

        const moderatorChannels = await listChannelsModeratedByAppInstanceUser(
          userId
        );
        const moderatorChannelList = moderatorChannels.map(
          (channelMembership) => channelMembership.ChannelSummary
        );

        const tempModeratorChannelList = [...moderatorChannelList];

        setChannelList(
          mergeArrayOfObjects(
            mergeArrayOfObjects(publicChannels, userChannelList, 'ChannelArn'),
            moderatorChannelList,
            'ChannelArn'
          )
        );
      } else {
        setModeratedChannel(activeChannel);
      }
    await publishStatusToAllChannels();
    };
    fetchChannels();
  }, [userId, activeView]);

  useEffect(() => {
    if (!isAuthenticated) {
      resetAWSClients();
      console.clear();
      setActiveView('User');
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
  }, [activeChannel.ChannelArn, activeChannel.SubChannelId]);

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

  function startPublishStatusWithInterval() {
    let publishTimeout;
    (async function publishStatusWithInterval() {
      if (!isAuthenticatedRef.current) {
        clearTimeout(publishTimeout);
        return;
      }
      await updateChannelArnLists();
      await publishStatusToAllChannels();
      publishTimeout = setTimeout(publishStatusWithInterval, PUBLISH_INTERVAL);
    })();
  }

  function computeAutoStatusForAChannel(channel) {
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

  const updateChannelArnLists = async () => {
    for (const channel of channelList) {
      if (!standardChannelArnList.includes(channel.ChannelArn)) {
        let newChannel;
        newChannel = await describeChannel(channel.ChannelArn, userId);
        if (newChannel) {
          standardChannelArnList.push(channel.ChannelArn);
          setStandardChannelArnList(standardChannelArnList);
        }
      }
    }
  }

  async function publishStatusToAllChannels() {
    const servicePromises = [];
    for (const channel of channelListRef.current) {
      const channelType = JSON.parse(channel.Metadata || '{}').ChannelType;
      if (!channel.SubChannelId && !elasticChannelArnList.includes(channel.ChannelArn) && channelType != 'PUBLIC_ELASTIC') { //Elastic channels doesnt support presence
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
    }
    return await Promise.all(servicePromises);
  }

  const getChannels = (channel) => {
    {
      return (
        <React.Fragment key={channel.ChannelArn}>
          <ChannelItem
            key={channel.ChannelArn}
            name={(channel.SubChannelId || elasticChannelArnList.includes(channel.ChannelArn)
              || JSON.parse(channel.Metadata || '{}').ChannelType == 'PUBLIC_ELASTIC') ? '(Elastic) ' + channel.Name : channel.Name}
            actions={loadUserActions(userPermission.role, channel)}
            isSelected={
              channel.ChannelArn === activeChannel.ChannelArn &&
              (activeChannel.SubChannelId == null || activeView === 'User')
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
          message: 'Error, channel name cannot be blank.',
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
        null,
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
              message: 'Successfully created channel.',
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
              message: 'Error, could not retrieve channel information.',
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

    let meetingName = `${activeChannel.Name} Instant Meeting`;

    // Create Meeting Channel and Memberships from existing Channel
    const meetingChannelArn = await createChannel(
      appConfig.appInstanceArn,
      null,
      meetingName,
      'RESTRICTED',
      'PRIVATE',
      null,
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
          message: `Successfully joined ${activeChannel.Name}`,
          severity: 'success',
          autoClose: true,
        },
      });
    } else {
      dispatch({
        type: 0,
        payload: {
          message: 'Error occurred. Unable to join channel.',
          severity: 'error',
          autoClose: true,
        },
      });
    }
  };

  const onAddMember = async () => {
    if (!selectedMember) {
      dispatch({
        type: 0,
        payload: {
          message: 'Error, user name cannot be blank.',
          severity: 'error',
        },
      });
      return;
    }

    try {
      const membership = await createChannelMembership(
        activeChannel.ChannelArn,
        `${appConfig.appInstanceArn}/user/${selectedMember.value}`,
        userId
      );
      const memberships = activeChannelMemberships;
      memberships.push({ Member: membership });
      setActiveChannelMemberships(memberships);
      channelIdChangeHandler(activeChannel);
      dispatch({
        type: 0,
        payload: {
          message: `New ${selectedMember.label} successfully added to ${activeChannel.Name}`,
          severity: 'success',
          autoClose: true,
        },
      });
      setModal('');
    } catch (err) {
      dispatch({
        type: 0,
        payload: {
          message: 'Error occurred. Member not added to channel.',
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
    // Moderator is for channel only, not subChannel
    if (!channel.SubChannelId) {
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
    }
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
    setActiveView('User');
    dispatch({
      type: 0,
      payload: {
        message: 'Channel successfully deleted.',
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
          message: 'Successfully removed members from the channel.',
          severity: 'success',
          autoClose: true,
        },
      });
      setSelectedMember({});
    } catch (err) {
      dispatch({
        type: 0,
        payload: {
          message: 'Error, unable to remove members.',
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
          message: `Successfully left ${activeChannel.Name}.`,
          severity: 'success',
          autoClose: true,
        },
      });
      setSelectedMember({});
    } catch (err) {
      dispatch({
        type: 0,
        payload: {
          message: 'Error, unable to leave the channel.',
          severity: 'error',
        },
      });
    }
  };

  const [isRestricted, setIsRestricted] = useState(
    activeChannel.Mode === 'RESTRICTED'
  );

  useEffect(() => {
    setIsRestricted(activeChannel.Mode === 'RESTRICTED');
  }, [activeChannel]);

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
        <span>Join Channel</span>
      </PopOverItem>
    );
    const viewDetailsOption = (
      <PopOverItem
        key="view_channel_details"
        as="button"
        onClick={() => setModal('ViewDetails')}
      >
        <span>View channel details</span>
      </PopOverItem>
    );
    const editChannelOption = (
      <PopOverItem
        key="edit_channel"
        as="button"
        onClick={() => setModal('EditChannel')}
      >
        <span>Edit channel</span>
      </PopOverItem>
    );
    const viewMembersOption = (
      <PopOverItem
        key="view_members"
        as="button"
        onClick={() => setModal('ViewMembers')}
      >
        <span>View members</span>
      </PopOverItem>
    );
    const addMembersOption = (
      <PopOverItem
        key="add_member"
        as="button"
        onClick={() => setModal('AddMembers')}
      >
        <span>Add members</span>
      </PopOverItem>
    );
    const manageMembersOption = (
      <PopOverItem
        key="manage_members"
        as="button"
        onClick={() => setModal('ManageMembers')}
      >
        <span>Manage members</span>
      </PopOverItem>
    );
    const startMeetingOption = (
      <PopOverItem key="start_meeting" as="button" onClick={startMeeting}>
        <span>Start meeting</span>
      </PopOverItem>
    );
    const joinMeetingOption = (
      <PopOverItem key="join_meeting" as="button" onClick={joinMeeting}>
        <span>Join meeting</span>
      </PopOverItem>
    );
    const leaveChannelOption = (
      <PopOverItem
        key="leave_channel"
        as="button"
        onClick={() => setModal('LeaveChannel')}
      >
      <span>Leave channel</span>
      </PopOverItem>
    );
    const deleteChannelOption = (
      <PopOverItem
        key="delete_channel"
        as="button"
        onClick={() => setModal('DeleteChannel')}
      >
        <span>Delete channel</span>
      </PopOverItem>
    );
    const meetingModeratorActions = [
      viewDetailsOption,
      <PopOverSeparator key="separator1" className="separator" />,
      addMembersOption,
      manageMembersOption,
      <PopOverSeparator key="separator2" className="separator" />,
      joinMeetingOption,
      <PopOverSeparator key="separator3" className="separator" />,
      leaveChannelOption,
      deleteChannelOption,
    ];
    const meetingMemberActions = [
      viewDetailsOption,
      <PopOverSeparator key="separator1" className="separator" />,
      viewMembersOption,
      <PopOverSeparator key="separator2" className="separator" />,
      joinMeetingOption,
      <PopOverSeparator key="separator3" className="separator" />,
      leaveChannelOption,
    ];
    const moderatorActions = [
      viewDetailsOption,
      editChannelOption,
      <PopOverSeparator key="separator2" className="separator" />,
      addMembersOption,
      manageMembersOption,
      <PopOverSeparator key="separator3" className="separator" />,
      startMeetingOption,
      <PopOverSeparator key="separator5" className="separator" />,
      leaveChannelOption,
      deleteChannelOption,
    ];
    const restrictedMemberActions = [
      viewDetailsOption,
      <PopOverSeparator key="separator2" className="separator" />,
      viewMembersOption,
      <PopOverSeparator key="separator3" className="separator" />,
      startMeetingOption,
      <PopOverSeparator key="separator4" className="separator" />,
      leaveChannelOption,
    ];
    const unrestrictedMemberActions = [
      viewDetailsOption,
      <PopOverSeparator key="separator2" className="separator" />,
      viewMembersOption,
      addMembersOption,
      <PopOverSeparator key="separator3" className="separator" />,
      leaveChannelOption,
    ];
    const noMeetingModeratorActions = [
      viewDetailsOption,
      editChannelOption,
      <PopOverSeparator key="separator1" className="separator" />,
      addMembersOption,
      manageMembersOption,
      <PopOverSeparator key="separator2" className="separator" />,
      leaveChannelOption,
      deleteChannelOption,
    ];
    const noMeetingRestrictedMemberActions = [
      viewDetailsOption,
      <PopOverSeparator key="separator1" className="separator" />,
      viewMembersOption,
      <PopOverSeparator key="separator2" className="separator" />,
      leaveChannelOption,
    ];
    const noMeetingUnrestrictedMemberActions = [
      viewDetailsOption,
      <PopOverSeparator key="separator1" className="separator" />,
      viewMembersOption,
      addMembersOption,
      <PopOverSeparator key="separator2" className="separator" />,
      startMeetingOption,
      <PopOverSeparator key="separator3" className="separator" />,
      leaveChannelOption,
    ];
    const nonMemberActions = [
      joinChannelOption,
      viewDetailsOption,
      viewMembersOption,
    ];

    if (!hasMembership) {
      return nonMemberActions;
    }

    if (appConfig.apiGatewayInvokeUrl) {
      if (channel.Metadata) {
        let metadata = JSON.parse(channel.Metadata);
        if (metadata.isMeeting) {
          return role === 'moderator' ? meetingModeratorActions : meetingMemberActions;
        }
      }

      if (role === 'moderator') {
        return moderatorActions;
      }
      return isRestricted ? restrictedMemberActions : unrestrictedMemberActions;
    }

    if (role === 'moderator') {
      return noMeetingModeratorActions;
    }
    return isRestricted ? noMeetingRestrictedMemberActions : noMeetingUnrestrictedMemberActions;
  };

  return (
    <>
      <ModalManager
        modal={modal}
        setModal={setModal}
        activeChannel={activeChannel}
        meetingInfo={meetingInfo}
        userId={userId}
        onAddMember={onAddMember}
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
        {activeView != 'Moderator' ? (
          <div className="channel-list-header">
            <div className="channel-list-header-title">Channels</div>
            <IconButton
              className="create-channel-button channel-options"
              onClick={() => setModal('NewChannel')}
              icon={<Dots width="1.5rem" height="1.5rem" />}
            />
          </div>
        ) : (
          <div className="channel-list-header">
            <SecondaryButton
              label="Back"
              onClick={handleSwichViewClick}
              className={"create-back-button"}
            />
          </div>
        )}
        <ChannelList
          style={{
            padding: '8px',
          }}
        >
          {activeView == 'User'
            ? channelList.map((channel) => getChannels(channel))
            : getChannels(moderatedChannel)}
        </ChannelList>
      </div>
    </>
  );
};

export default ChannelsWrapper;
