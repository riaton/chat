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
import { useUserPermission } from '../../providers/UserPermissionProvider';

export const LeaveChannelModal = ({ onClose, channel, handleLeaveChannel }) => {
  const userPermission = useUserPermission();
  return (
    <Modal onClose={onClose}>
      <ModalHeader title={`Leave ${channel.Name}?`} />
      <ModalBody>
        <p>You cannot undo this action.</p>
      </ModalBody>
      <ModalButtonGroup
        primaryButtons={[
          <ModalButton
            label="Leave"
            onClick={handleLeaveChannel}
            variant="primary"
            closesModal
          />,
          <ModalButton label="Cancel" closesModal variant="secondary" />,
        ]}
      />
    </Modal>
  );
};

export default LeaveChannelModal;
