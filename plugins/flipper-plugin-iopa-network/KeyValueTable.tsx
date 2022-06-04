import * as React from 'react';
import {createDataSource, DataInspector, DataSource, DataTable, DataTableColumn, MasterDetail, theme} from 'flipper-plugin';
import {useCallback, useState} from 'react';
import {
  Typography,
} from 'antd'

export type KeyValueItem = {
  key: string;
  value: string;
};

const columns: DataTableColumn<KeyValueItem>[] = [
  {
    key: 'key',
    title: 'Key',
    wrap: true,
    width: 160,
    onRender: (row) =>  <Typography.Text type="success">{row.key}</Typography.Text>
  },
  {
    key: 'value',
    title: 'Value',
    wrap: true,
  },
];

const baseRowStyle = {
  ...theme.monospace,
  color: theme.textColorSecondary
};

function getRowStyle() {
  return baseRowStyle;
}

export function KeyValueTable({items, enableColumnHeaders, onSelect}: {items: KeyValueItem[], enableColumnHeaders?: boolean, onSelect?: (record: KeyValueItem) => void}) {
  const handleCopyRows = useCallback((rows: KeyValueItem[]) => {
    return rows.map(({key, value}) => `${key}: ${value}`).join('\n');
  }, []);

  return (
    <DataTable<KeyValueItem>
      columns={columns}
      enableColumnHeaders={enableColumnHeaders || false}
      records={items}
      enableSearchbar={false}
      scrollable={false}
      enableHorizontalScroll={false}
      onRowStyle={getRowStyle}
      onCopyRows={handleCopyRows}
      onSelect={onSelect}
    />
  );
}
