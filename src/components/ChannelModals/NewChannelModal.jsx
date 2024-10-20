// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 改変済
/* Copyright 2024 Riaton. All Rights Reserved. */
import React, { useEffect, useState } from 'react';

import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalButtonGroup,
  ModalButton,
  Input,
  Label,
  RadioGroup,
  PrimaryButton
} from 'amazon-chime-sdk-component-library-react';

import './NewChannelModal.css';
import { useAuthContext } from '../../providers/AuthProvider';

export const NewChannelModal = ({ onClose, onCreateChannel }) => {
  const [name, setName] = useState('');
  const [userName, setUserName] = useState('');
  const { member } = useAuthContext();

  const onNameChange = (e) => {
    setName(e.target.value);
  };

  return (
    <Modal size="lg" onClose={onClose}>
      <ModalHeader title="チャネル作成" />
      <ModalBody>
        <form
          onSubmit={(e) =>
            onCreateChannel(e, name, 'RESTRICTED', 'PUBLIC')
          }
          id="new-channel-form"
        >
          <div className="ch-form-field-input">
            <Label className="lbl">チャネル名</Label>
            <Input
              className="value"
              showClear={false}
              type="text"
              value={name}
              onChange={(e) => onNameChange(e)}
            />
          </div>
          <div className="ch-form-field-input">
            <Label className="lbl">管理者</Label>
            <Label className="value">{member.username}</Label>
          </div>
        </form>
      </ModalBody>
      <ModalButtonGroup
        primaryButtons={[
          <ModalButton
            label="作成"
            type="submit"
            form="new-channel-form"
            variant="primary"
          />,
          <ModalButton label="キャンセル" closesModal variant="secondary" />,
        ]}
      />
    </Modal>
  );
};

export default NewChannelModal;
