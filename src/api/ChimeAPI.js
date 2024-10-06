/* eslint-disable no-plusplus */
/* eslint-disable no-console */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import routes from '../constants/routes';
import appConfig from '../Config';
// eslint-disable-next-line no-unused-vars
const ChimeIdentity = require('aws-sdk/clients/chimesdkidentity');
const ChimeMessaging = require('aws-sdk/clients/chimesdkmessaging');
const ChimeMeetings = require('aws-sdk/clients/chimesdkmeetings');

export const BASE_URL = routes.SIGNIN;
export const createMemberArn = (userId) =>
  `${appConfig.appInstanceArn}/user/${userId}`;

export const Persistence = {
  PERSISTENT: 'PERSISTENT',
  NON_PERSISTENT: 'NON_PERSISTENT',
};

export const MessageType = {
  STANDARD: 'STANDARD',
  CONTROL: 'CONTROL',
};

const appInstanceUserArnHeader = 'x-amz-chime-bearer';

let chimeMessaging = null;
let chimeIdentity = null;
let chimeMeetings = null;

// Setup Chime Messaging Client lazily
async function chimeMessagingClient() {
  if (chimeMessaging == null) {
    chimeMessaging = new ChimeMessaging();
  }
  return chimeMessaging;
}

function resetAWSClients() {
  chimeMessaging = null;
  chimeIdentity = null;
  chimeMeetings = null;
}
// Setup Chime Identity Client lazily
async function chimeIdentityClient() {
  if (chimeIdentity == null) {
    chimeIdentity = new ChimeIdentity();
  }
  return chimeIdentity;
}

async function getMessagingSessionEndpoint() {
  const request = (await chimeMessagingClient()).getMessagingSessionEndpoint();
  const response = await request.promise();
  return response;
}

// Setup Chime Meetings Client lazily
async function chimeMeetingsClient() {
  if (chimeMeetings == null) {
    chimeMeetings = new ChimeMeetings();
  }
  return chimeMeetings;
}

async function sendChannelMessage(
  channelArn,
  messageContent,
  persistence,
  type,
  member,
  options = null
) {
  console.log('sendChannelMessage called');

  const chimeBearerArn = createMemberArn(member.userId);

  const params = {
    ChimeBearer: chimeBearerArn,
    ChannelArn: channelArn,
    Content: messageContent,
    Persistence: persistence, // Allowed types are PERSISTENT and NON_PERSISTENT
    Type: type, // Allowed types are STANDARD and CONTROL
  };
  if (options && options.Metadata) {
    params.Metadata = options.Metadata;
  }

  const request = (await chimeMessagingClient()).sendChannelMessage(params);
  const response = await request.promise();
  const sentMessage = {
    response: response,
    CreatedTimestamp: new Date(),
    Sender: { Arn: createMemberArn(member.userId), Name: member.username },
  };
  return sentMessage;
}

async function getChannelMessage(channelArn, member, messageId) {
  console.log('getChannelMessage called');

  const chimeBearerArn = createMemberArn(member.userId);

  const params = {
    ChannelArn: channelArn,
    MessageId: messageId,
    ChimeBearer: chimeBearerArn,
  };

  const request = (await chimeMessagingClient()).getChannelMessage(params);
  const response = await request.promise();
  return response.ChannelMessage;
}

async function listChannelMessages(
  channelArn,
  userId,
  nextToken = null
) {
  console.log('listChannelMessages called');

  const chimeBearerArn = createMemberArn(userId);

  const params = {
    ChannelArn: channelArn,
    NextToken: nextToken,
    ChimeBearer: chimeBearerArn,
  };

  const request = (await chimeMessagingClient()).listChannelMessages(params);
  const response = await request.promise();
  const messageList = response.ChannelMessages;
  messageList.sort(function (a, b) {
    // eslint-disable-next-line no-nested-ternary
    return a.CreatedTimestamp < b.CreatedTimestamp
      ? -1
      : a.CreatedTimestamp > b.CreatedTimestamp
      ? 1
      : 0;
  });

  const messages = [];
  for (let i = 0; i < messageList.length; i++) {
    const message = messageList[i];
    messages.push(message);
  }
  return { Messages: messages, NextToken: response.NextToken };
}

async function createChannelMembership(
  channelArn,
  memberArn,
  userId
) {
  console.log('createChannelMembership called');
  const chimeBearerArn = createMemberArn(userId);
  const params = {
    ChannelArn: channelArn,
    MemberArn: memberArn,
    Type: 'DEFAULT', // OPTIONS ARE: DEFAULT and HIDDEN
    ChimeBearer: chimeBearerArn
  };

  const request = (await chimeMessagingClient()).createChannelMembership(
    params
  );
  const response = await request.promise();
  return response.Member;
}

async function deleteChannelMembership(channelArn, memberArn, userId) {
  console.log('deleteChannelMembership called');
  const chimeBearerArn = createMemberArn(userId);

  const params = {
    ChannelArn: channelArn,
    MemberArn: memberArn,
    ChimeBearer: chimeBearerArn
  };

  const request = (await chimeMessagingClient()).deleteChannelMembership(
    params
  );
  const response = await request.promise();
  return response;
}

async function listChannelMemberships(channelArn, userId) {
  console.log('listChannelMemberships called');
  const chimeBearerArn = createMemberArn(userId);

  const params = {
    ChannelArn: channelArn,
    ChimeBearer: chimeBearerArn
  };

  const request = (await chimeMessagingClient()).listChannelMemberships(params);
  const response = await request.promise();
  return response.ChannelMemberships;
}

async function createChannel(
  appInstanceArn,
  metadata,
  name,
  mode,
  privacy,
  userId
) {
  console.log('createChannel called');

  const chimeBearerArn = createMemberArn(userId);
  if (!metadata && privacy === 'PUBLIC') {
    metadata = JSON.stringify({ ChannelType: 'PUBLIC_STANDARD' });
  }

  const params = {
    AppInstanceArn: appInstanceArn,
    Metadata: metadata,
    Name: name,
    Mode: mode,
    Privacy: privacy,
    ChimeBearer: chimeBearerArn,
  };

  const request = (await chimeMessagingClient()).createChannel(params);
  request.on('build', function () {
    request.httpRequest.headers[appInstanceUserArnHeader] = createMemberArn(
      userId
    );
  });
  const response = await request.promise();
  return response.ChannelArn;
}

async function describeChannel(channelArn, userId) {
  console.log('describeChannel called');

  const chimeBearerArn = createMemberArn(userId);

  const params = {
    ChannelArn: channelArn,
    ChimeBearer: chimeBearerArn,
  };

  const request = (await chimeMessagingClient()).describeChannel(params);
  const response = await request.promise();
  return response.Channel;
}

async function updateChannel(channelArn, name, mode, metadata, userId) {
  console.log('updateChannel called');

  const chimeBearerArn = createMemberArn(userId);
  console.log(chimeBearerArn);
  const params = {
    ChannelArn: channelArn,
    Name: name,
    Mode: mode,
    Metadata: metadata,
    ChimeBearer: chimeBearerArn,
  };

  const request = (await chimeMessagingClient()).updateChannel(params);
  const response = await request.promise();
  return response;
}

async function listChannelMembershipsForAppInstanceUser(userId) {
  console.log('listChannelMembershipsForAppInstanceUser called');

  const chimeBearerArn = createMemberArn(userId);

  const params = {
    ChimeBearer: chimeBearerArn,
  };

  const request = (
    await chimeMessagingClient()
  ).listChannelMembershipsForAppInstanceUser(params);
  const response = await request.promise();
  const channels = response.ChannelMemberships;
  return channels;
}

async function listChannels(appInstanceArn, userId) {
  console.log('listChannels called');

  const chimeBearerArn = createMemberArn(userId);
  const params = {
    AppInstanceArn: appInstanceArn,
    ChimeBearer: chimeBearerArn,
  };

  const request = (await chimeMessagingClient()).listChannels(params);
  const response = await request.promise();
  const channels = response.Channels;
  return channels;
}

async function deleteChannel(channelArn, userId) {
  console.log('deleteChannel called');

  const chimeBearerArn = createMemberArn(userId);
  const params = {
    ChannelArn: channelArn,
    ChimeBearer: chimeBearerArn,
  };

  const request = (await chimeMessagingClient()).deleteChannel(params);
  await request.promise();
}

async function listChannelModerators(channelArn, userId) {
  console.log('listChannelModerators called');
  const chimeBearerArn = createMemberArn(userId);

  const params = {
    ChannelArn: channelArn,
    ChimeBearer: chimeBearerArn,
  };

  const request = (await chimeMessagingClient()).listChannelModerators(params);
  const response = await request.promise();
  return response ? response.ChannelModerators : null;
}

async function updateChannelMessage(
  channelArn,
  messageId,
  content,
  metadata,
  userId
) {
  console.log('updateChannelMessage called');
  const chimeBearer = createMemberArn(userId);
  const params = {
    ChannelArn: channelArn,
    MessageId: messageId,
    Content: content,
    Metadata: metadata,
    ChimeBearer: chimeBearer
  };

  const request = (await chimeMessagingClient()).updateChannelMessage(params);

  const response = await request.promise();
  return response;
}

async function redactChannelMessage(
  channelArn,
  messageId,
  userId
) {
  console.log('redactChannelMessage called');

  const chimeBearerArn = createMemberArn(userId);
  const params = {
    ChannelArn: channelArn,
    MessageId: messageId,
    ChimeBearer: chimeBearerArn
  };

  const request = (await chimeMessagingClient()).redactChannelMessage(params);

  const response = await request.promise();
  return response;
}

async function getMeeting(
    meetingId
) {
  console.log('geeMeeting called')

  const params = {
    MeetingId: meetingId
  };

  const request = (await chimeMeetingsClient()).getMeeting(params);
  const response = await request.promise();

  return response;
}

async function createMeeting(name, userId, channelArn) {
  const response = await fetch(
    `${appConfig.apiGatewayInvokeUrl}create?name=${encodeURIComponent(
      name
    )}&userId=${encodeURIComponent(userId)}&channel=${encodeURIComponent(
      channelArn
    )}`,
    {
      method: 'POST',
    }
  );
  const data = await response.json();

  if (data.error) {
    throw new Error(`Server error: ${data.error}`);
  }

  return data;
}

async function createAttendee(name, userId, channelArn, meeting) {
  const response = await fetch(
    `${appConfig.apiGatewayInvokeUrl}join?name=${encodeURIComponent(
      name
    )}&userId=${encodeURIComponent(userId)}&channel=${encodeURIComponent(
      channelArn
    )}&meeting=${encodeURIComponent(meeting)}`,
    {
      method: 'POST',
    }
  );
  const data = await response.json();

  if (data.error) {
    throw new Error(`Server error: ${data.error}`);
  }

  return data;
}

function createGetAttendeeCallback() {
  return async (chimeAttendeeId, externalUserId) => {
    return {
      name: externalUserId,
    };
  };
}

async function endMeeting(meetingId) {
  const res = await fetch(
    `${appConfig.apiGatewayInvokeUrl}end?meetingId=${encodeURIComponent(
      meetingId
    )}`,
    {
      method: 'POST',
    }
  );

  if (!res.ok) {
    throw new Error('Server error ending meeting');
  }
}

export {
  //メッセージ送信<Meesaging>
  sendChannelMessage,
  //メッセージ取得<Messaging>
  getChannelMessage,
  //メッセージ一覧取得
  listChannelMessages,
  //Channelにメンバーを追加する
  createChannelMembership,
  //Channelのメンバー一覧を取得する
  listChannelMemberships,
  //Channelからメンバーを削除する
  deleteChannelMembership,
  //Channelを作成する
  createChannel,
  //Channelの詳細を取得する
  describeChannel,
  //Channelの属性を変更する
  updateChannel,
  //Channel一覧を取得する
  listChannels,
  //Channelを削除する
  deleteChannel,
  //ChannelのModerator一覧を取得する
  listChannelModerators,
  //Channelのメッセージを更新する
  updateChannelMessage,
  //メッセージを秘匿化する
  redactChannelMessage,
  //MessagingSessionEndpointを取得する<Messaging>
  getMessagingSessionEndpoint,
  //AppInstanceUserが所属しているChannel一覧を取得する(管理者のみ)
  listChannelMembershipsForAppInstanceUser,
  //会議を作成する<backend>
  createMeeting,
  //会議に参加する <backend>
  createAttendee,
  //参加者IDを取得する<>
  createGetAttendeeCallback,
  //会議を終了する<backend>
  endMeeting,
  //ただの初期化<>
  resetAWSClients,
  //会議情報を取得する<Meeetings>
  getMeeting,
};
