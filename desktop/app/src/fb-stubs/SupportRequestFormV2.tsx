/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import React, {Component} from 'react';

import {styled, Text, colors, FlexColumn} from '../ui';

const StyledFlexGrowColumn = styled(FlexColumn)({
  flexGrow: 1,
});

const StyledFlexColumn = styled(StyledFlexGrowColumn)({
  justifyContent: 'center',
  alignItems: 'center',
});

const Padder = styled.div<any>(
  ({paddingLeft, paddingRight, paddingBottom, paddingTop}) => ({
    paddingLeft: paddingLeft || 0,
    paddingRight: paddingRight || 0,
    paddingBottom: paddingBottom || 0,
    paddingTop: paddingTop || 0,
  }),
);

const Title = styled(Text)({
  fontWeight: 'bold',
  color: colors.greyTint3,
  height: 'auto',
  width: 200,
  textOverflow: 'ellipsis',
});

export default class extends Component<void, void> {
  render() {
    return (
      <StyledFlexGrowColumn>
        <StyledFlexColumn>
          <Padder paddingBottom={8}>
            <Title>Please log support requests directly in Github Issues</Title>
          </Padder>
        </StyledFlexColumn>
      </StyledFlexGrowColumn>
    );
  }
}
