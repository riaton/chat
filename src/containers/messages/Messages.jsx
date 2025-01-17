/* eslint-disable react/no-children-prop */
/* eslint-disable no-console */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React, { useState, useEffect } from 'react';
import {
  InfiniteList,
  PopOverItem,
  Modal,
  ModalHeader,
  ModalBody,
  ModalButtonGroup,
  ModalButton,
  ChatBubble,
  ChatBubbleContainer,
  EditableChatBubble,
  formatDate,
  formatTime,
  useNotificationDispatch,
} from 'amazon-chime-sdk-component-library-react';

import {
  listChannelMessages,
  createMemberArn,
  updateChannelMessage,
  redactChannelMessage,
} from '../../api/ChimeAPI';
import insertDateHeaders from '../../utilities/insertDateHeaders';

import './Messages.css';
import { useChatChannelState } from '../../providers/ChatMessagesProvider';

const Messages = ({
  messages,
  messagesRef,
  setMessages,
  channelArn,
  channelName,
  userId,
  setChannelMessageToken,
  activeChannelRef,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { channelMessageTokenRef } = useChatChannelState();
  const notificationDispatch = useNotificationDispatch();

  const handleScrollTop = async () => {
    setIsLoading(true);
    if (!channelMessageTokenRef.current) {
      console.log('No new messages');
      setIsLoading(false);
      return;
    }
    const oldMessages = await listChannelMessages(
      activeChannelRef.current.ChannelArn,
      userId,
      channelMessageTokenRef.current
    );
    const newMessages = [...oldMessages.Messages, ...messagesRef.current];

    setMessages(newMessages);
    setChannelMessageToken(oldMessages.NextToken);
    setIsLoading(false);
  };

  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showRedactModal, setShowRedactModal] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [redactingMessageId, setRedactingMessageId] = useState('');

  const handleDiscardEdit = () => {
    setShowDiscardModal(false);
    setEditingMessageId('');
  };

  const discardModal = (
    <Modal onClose={() => setShowDiscardModal(false)}>
      <ModalHeader title="変更を取り消しますか？" />
      <ModalBody>
        <div>この操作は取り消しできません</div>
        <ModalButtonGroup
          primaryButtons={[
            <ModalButton
              label="取り消し"
              type="submit"
              variant="primary"
              onClick={handleDiscardEdit}
              key="1"
            />,
            <ModalButton
              label="キャンセル"
              variant="secondary"
              closesModal
              key="2"
            />,
          ]}
        />
      </ModalBody>
    </Modal>
  );

  const handleShowRedactModal = (messageId) => {
    setRedactingMessageId(messageId);
    setShowRedactModal(true);
  };

  const handleCloseRedactModal = () => {
    setRedactingMessageId('');
    setShowRedactModal(false);
  };

  const redact = async () => {
    try {
      await redactChannelMessage(channelArn, redactingMessageId, userId);
    }
    catch {
      notificationDispatch({
        type: 0,
        payload: {
          message: 'メッセージの削除に失敗しました',
          severity: 'error',
        },
      });
    }
    setShowRedactModal(false);
  };

  const redactModal = (
    <Modal onClose={handleCloseRedactModal}>
      <ModalHeader title="メッセージを削除しますか？" />
      <ModalBody>
        <div>この操作は取り消しできません</div>
        <ModalButtonGroup
          primaryButtons={[
            <ModalButton
              label="削除"
              type="submit"
              variant="primary"
              onClick={redact}
              key="1"
            />,
            <ModalButton
              label="キャンセル"
              variant="secondary"
              closesModal
              key="2"
            />,
          ]}
        />
      </ModalBody>
    </Modal>
  );

  const cancelEdit = (e) => {
    e.preventDefault();
    setShowDiscardModal(true);
  };

  const saveEdit = async (e, newText, metadata) => {
    e.preventDefault();
    try {
      await updateChannelMessage(
        channelArn,
        editingMessageId,
        newText,
        metadata,
        userId
      );
    }
    catch {
      notificationDispatch({
        type: 0,
        payload: {
          message: 'メッセージの編集に失敗しました',
          severity: 'error',
        },
      });
    }
    setEditingMessageId('');
  };

  const flattenedMessages = messages.map((m) => {
    const content = !m.Content || m.Redacted ? '(Deleted)' : m.Content;
    let editedNote;
    if (m.LastEditedTimestamp && !m.Redacted) {
      const time = formatTime(m.LastEditedTimestamp);
      const date = formatDate(
        m.LastEditedTimestamp,
        undefined,
        undefined,
        'today',
        'yesterday'
      );
      editedNote = (
        <i style={{ fontStyle: 'italic' }}>{` (edited ${date} at ${time})`}</i>
      );
    }

    const messageStatus = m.Status.Value == null ? 'SENT' : m.Status.Value;
    let statusNote;
    if (messageStatus !== 'SENT') {
      statusNote = (
        <i style={{ fontStyle: 'italic' }}>{`     (${messageStatus})`}</i>
      );
    }
    
    return {
      content: content,
      editedNote: editedNote,
      messageId: m.MessageId,
      createdTimestamp: m.CreatedTimestamp,
      redacted: m.Redacted,
      senderName: m.Sender.Name,
      senderId: m.Sender.Arn,
      metadata: m.Metadata,
      status: m.Status.Value,
      statusNote: statusNote,
    };
  });

  const listItems = insertDateHeaders(flattenedMessages);

  const messageList = listItems.map((m, i, self) => {
    if (!m.content) {
      return m;
    }

    if (m.Metadata) {
      let metadata = JSON.parse(m.Metadata);
      if (metadata.isMeetingInfo) {
        return m;
      };
    }

    const variant =
      createMemberArn(userId) === m.senderId ? 'outgoing' : 'incoming';
    let actions = null;
    const messageStatus = m.status == null ? 'SENT' : m.status;
    if (variant === 'outgoing' && messageStatus === 'SENT') {
      actions = [
        <PopOverItem
          key="1"
          children={<span>Edit</span>}
          onClick={() => setEditingMessageId(m.messageId)}
        />,
        <PopOverItem
          key="2"
          children={<span>Delete</span>}
          onClick={() => handleShowRedactModal(m.messageId)}
        />,
      ];
    }

    const prevMessageSender = self[i - 1]?.senderId;
    const currMessageSender = m.senderId;
    const nextMessageSender = self[i + 1]?.senderId;

    let showTail = true;
    if (
      currMessageSender && // it is a message
      nextMessageSender && // the item after is a message
      currMessageSender === nextMessageSender // the item after is from the same sender
    ) {
      showTail = false;
    }
    let showName = true;
    if (
      currMessageSender && // it is a message
      prevMessageSender && // the item before is a message
      currMessageSender === prevMessageSender // the message before is from the same sender
    ) {
      showName = false;
    }

    return (
      <div className="message">
        <ChatBubbleContainer
          timestamp={formatTime(m.createdTimestamp)}
          actions={actions}
          key={`message${i.toString()}`}
          css="margin: 1rem;"
        >
          {editingMessageId === m.messageId && !m.redacted ? (
            <EditableChatBubble
              variant={variant}
              senderName={m.senderName}
              content={m.content}
              save={(event, value) => saveEdit(event, value, m.metadata)}
              cancel={cancelEdit}
              showName={showName}
              showTail={showTail}
            />
          ) : (
            <ChatBubble
              variant={variant}
              senderName={m.senderName}
              redacted={m.redacted}
              showName={showName}
              showTail={showTail}
            >
              <div>
                {m.content}
                {m.editedNote}
                {m.statusNote}
              </div>
            </ChatBubble>
          )}
        </ChatBubbleContainer>
      </div>
    );
  });

  return (
    <div className="message-list-container">
      {showDiscardModal && discardModal}
      {showRedactModal && redactModal}
      <div className="message-list-header">{channelName}</div>
      <InfiniteList
        style={{ display: 'flex', flexGrow: '1' }}
        items={messageList}
        onLoad={handleScrollTop}
        isLoading={isLoading}
        className="chat-message-list"
      />
    </div>
  );
};
export default Messages;
