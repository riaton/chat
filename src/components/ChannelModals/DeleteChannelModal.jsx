// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */

import React from 'react';

import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalButtonGroup,
  ModalButton,
} from 'amazon-chime-sdk-component-library-react';

export const DeleteChannelModal = ({
  onClose,
  channel,
  handleChannelDeletion,
}) => {
  return (
    <Modal onClose={onClose}>
      <ModalHeader title={`チャネル「${channel.Name}」を削除しますか？`} />
      <ModalBody>
        <form
          onSubmit={(e) => handleChannelDeletion(e, channel.ChannelArn, channel.Metadata)}
          id="deletion-form"
        />
        <p>この操作は取り消しできません</p>
      </ModalBody>
      <ModalButtonGroup
        primaryButtons={[
          <ModalButton
            label="削除"
            form="deletion-form"
            type="submit"
            variant="primary"
          />,
          <ModalButton label="キャンセル" closesModal variant="secondary" />,
        ]}
      />
    </Modal>
  );
};

export default DeleteChannelModal;
