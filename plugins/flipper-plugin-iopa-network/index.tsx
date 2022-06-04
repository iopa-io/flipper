import React, { createRef, CSSProperties } from 'react'

import {
  Button,
  Form,
  Input,
  Menu,
  message,
  Modal,
  Radio,
  Typography,
} from 'antd'

import {
  Layout,
  DetailSidebar,
  PluginClient,
  createState,
  usePlugin,
  useValue,
  createDataSource,
  DataTable,
  DataTableColumn,
  DataTableManager,
  theme,
  renderReactRoot,
} from 'flipper-plugin';

import {
  IContextIopa,
  IContextIopaLegacy,
  IContextIopaSerialized,
  IContextReply,
  IContextReplyLegacy,
  IContextReplySerialized
} from './types';

import {
  convertRequestToCurlCommand,
  formatStatus,
  formatBytes,
  formatDuration,
  contextsToText,
  decodeBody,
  formatMethod
} from './utils';

import RequestDetails from './RequestDetails';
import {DeleteOutlined} from '@ant-design/icons';
import IopaMap from './map';

const LOCALSTORAGE_RESPONSE_BODY_FORMAT_KEY =
  '__NETWORK_CACHED_RESPONSE_BODY_FORMAT';

export const BodyOptions = ['formatted', 'parsed'].map((value) => ({
  label: value,
  value,
}));


type Events = {
  request: IContextIopaSerialized;
  response: [IContextIopaSerialized, IContextReplySerialized];
};

type CustomColumnConfig = {
  header: string;
  type: 'response' | 'request';
};

type StateExport = {
  serializedContexts: IContextIopaSerialized[];
  selectedId: string | undefined;
  customColumns: CustomColumnConfig[];
};

export function plugin(client: PluginClient<Events>) {
  const detailBodyFormat = createState<string>(
    localStorage.getItem(LOCALSTORAGE_RESPONSE_BODY_FORMAT_KEY) || 'parsed',
  );
  const contexts = createDataSource<IContextIopa, 'iopa.Id'>([], {
    key: 'iopa.Id',
  });
  const selectedId = createState<string | undefined>(undefined);
  const tableManagerRef = createRef<undefined | DataTableManager<IContextIopa>>();

  const customColumns = createState<CustomColumnConfig[]>([], {
    persist: 'customColumns',
    persistToLocalStorage: true,
  });
  const columns = createState<DataTableColumn<IContextIopa>[]>(baseColumns); // not persistable

  client.onDeepLink((payload: unknown) => {
    const searchTermDelim = 'searchTerm=';
    if (typeof payload !== 'string') {
      return;
    } else if (payload.startsWith(searchTermDelim)) {
      tableManagerRef.current?.clearSelection();
      tableManagerRef.current?.setSearchValue(
        payload.slice(searchTermDelim.length),
      );
    } else {
      tableManagerRef.current?.setSearchValue('');
      tableManagerRef.current?.selectItemById(payload);
    }
  });

  client.addMenuEntry({
    action: 'clear',
    handler: clearLogs,
  });

  client.onConnect(() => {
    init();
  });

  client.onMessage('request', (data: IContextIopaSerialized) => {
    // Some network stacks may send duplicate data, so we filter them out.
    if (contexts.has(data['iopa.Id'])) {
      console.warn(`Ignoring duplicate request with id ${data['iopa.Id']}:`, data);
    } else {
      const context = createContextFromSerializedRequest(data, customColumns.get())
      console.log(context)
      contexts.append(context);
    }
  });

  client.onMessage('response', ([request, response]: [IContextIopaSerialized, IContextReplySerialized]) => {
    const context = contexts.getById(request['iopa.Id']);
    if (!context) {
      return; // context table might have been cleared
    }

    contexts.upsert(
      updateContextWithResponseInfo(context, request, response, customColumns.get()),
    );
  });

  function init() {
  }

  function clearLogs() {
    contexts.clear();
  }

  function addCustomColumn(column: CustomColumnConfig) {
    // prevent doubles
    if (
      customColumns
        .get()
        .find((c) => c.header === column.header && c.type === column.type)
    ) {
      return;
    }
    // add custom column config
    customColumns.update((d) => {
      d.push(column);
    });
    // generate DataTable column config
    addDataTableColumnConfig(column);
    // update existing entries
    for (let i = 0; i < contexts.size; i++) {
      const context = contexts.get(i);

      ;(context as any)[`_${column.type}_header_${column.header}`] = (
        column.type === 'request'
          ? context.get('iopa.Headers').get(column.header)
          : context.response.get('iopa.Headers').get(column.header)
      ),

      contexts.update(i, context);
    }
  }

  function addDataTableColumnConfig(column: CustomColumnConfig) {
    columns.update((d) => {
      d.push({
        key: `_${column.type}_header_${column.header}` as any,
        width: 200,
        title: `${column.header} (${column.type})`,
      });
    });
  }

  client.onReady(() => {
    // after restoring a snapshot, let's make sure we update the columns
    customColumns.get().forEach(addDataTableColumnConfig);
  });

  client.onExport<StateExport>(async (idler, onStatusMessage) => {
    const serializedContexts: IContextIopaSerialized[] = [];
    for (let i = 0; i < contexts.size; i++) {
      const context = contexts.get(i);
      serializedContexts.push(context.toJSON())
        
      if (idler.isCancelled()) {
        return undefined;
      }
      if (idler.shouldIdle()) {
        onStatusMessage(`Serializing request ${i + 1}/${contexts.size}`);
        await idler.idle();
      }
    }
    return {
      selectedId: selectedId.get(),
      serializedContexts,
      customColumns: customColumns.get(),
    };
  });

  client.onImport<StateExport>((data) => {
    selectedId.set(data.selectedId);
    customColumns.set(data.customColumns);
    data.serializedContexts.forEach((serializedContext) => {
      contexts.append(createContextFromSerializedRequest(serializedContext, customColumns.get()));
    });
  });

  return {
    columns,
    detailBodyFormat,
    requests: contexts,
    clearLogs,
    onSelectFormat(bodyFormat: string) {
      detailBodyFormat.set(bodyFormat);
      localStorage.setItem(LOCALSTORAGE_RESPONSE_BODY_FORMAT_KEY, bodyFormat);
    },
    selectedId,
    onSelect(context: IContextIopa) {
      selectedId.set(context?.get('iopa.Id'));
    },
    init,
    tableManagerRef,
    onContextMenu(context: IContextIopa | undefined) {
      return (
        <>
          <Menu.Item
            key="curl"
            onClick={() => {
              if (!context) {
                return;
              }
              const command = convertRequestToCurlCommand(context);
              client.writeTextToClipboard(command);
            }}>
            Copy cURL command
          </Menu.Item>
          <Menu.Item
            key="custom header"
            onClick={() => {
              showCustomColumnDialog(addCustomColumn);
            }}>
            Add header column{'\u2026'}
          </Menu.Item>
        </>
      );
    },
    onCopyText(text: string) {
      client.writeTextToClipboard(text);
      message.success('Text copied to clipboard');
    },
    addCustomColumn,
  };
}

function showCustomColumnDialog(
  addCustomColumn: (column: CustomColumnConfig) => void,
) {
  function CustomColumnDialog({unmount}: {unmount(): void}) {
    const [form] = Form.useForm();
    return (
      <Modal
        title="Add custom column"
        visible
        onOk={() => {
          const header = form.getFieldValue('header');
          const type = form.getFieldValue('type');
          if (header && type) {
            addCustomColumn({
              header,
              type,
            });
            unmount();
          }
        }}
        onCancel={unmount}>
        <Form
          layout={'vertical'}
          form={form}
          initialValues={{
            type: 'response',
            header: '',
          }}>
          <Form.Item label="Header name" name="header">
            <Input placeholder="Header name" />
          </Form.Item>
          <Form.Item label="Header type" name="type">
            <Radio.Group>
              <Radio value={'request'}>Request</Radio>
              <Radio value={'response'}>Response</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    );
  }

  renderReactRoot((unmount) => <CustomColumnDialog unmount={unmount} />);
}

function createContextFromSerializedRequest(
  data: IContextIopaSerialized,
  customColumns: CustomColumnConfig[],
): IContextIopa {
  let url: URL | undefined = undefined;
  try {
    url = data['iopa.OriginalUrl'] ? new URL(data['iopa.OriginalUrl']) : undefined;
  } catch (e) {
    console.warn(`Failed to parse url: '${data['iopa.OriginalUrl'] }'`, e);
  }

  const req = {
    ...data,
    'iopa.Id': data['iopa.Id'],
     // request
    'server.Timestamp': new Date(data['server.Timestamp']),
    'iopa.Method': data['iopa.Method'],
    'iopa.OriginalUrl': data['iopa.OriginalUrl'] ?? '',
    'iopa.Url': url,
    'flipper.Path': url.pathname,
    'iopa.Headers': new Headers(data['iopa.Headers']),
    'iopa.Body': decodeBody(data)
  };

  req['iopa.ContentLength'] = req['iopa.Body']?.length || 0

  customColumns
    .filter((c) => c.type === 'request')
    .forEach(({header}) => {
      (req as any)['_request_header_' + header] = 
      req['iopa.Headers'].get(header)
    });
  return new IopaMap<IContextIopaLegacy>(req) as unknown as IContextIopa
}

const BLACKLIST_REQUEST = ['iopa.Id', 'server.Timestamp', 'iopa.Method', 'iopa.OriginalUrl', 'iopa.Headers']

function updateContextWithResponseInfo(
  context: IContextIopa,
  request: IContextIopaSerialized,
  response: IContextReplySerialized,
  customColumns: CustomColumnConfig[],
): IContextIopa {
  
  Object.keys(request)
    .filter((key) => !BLACKLIST_REQUEST.includes(key))
    .forEach((key) => {
      context.set(key as any, request[key])
    })

  const res = {
    ...response,
    'server.Timestamp': new Date(response['server.Timestamp']),
    'iopa.Headers': new Headers(response['iopa.Headers']),
    'iopa.Body': decodeBody(response)
  };

  console.log(response['iopa.Headers'], new Headers(response['iopa.Headers']))

  customColumns
    .filter((c) => c.type === 'response')
    .forEach(({header}) => {
      (context as any)['_response_header_' + header] = 
        context.response.get('iopa.Headers').get(header)
    });

    context.response = new IopaMap<IContextReplyLegacy>(res) as unknown as IContextReply

    context.set('response.ContentLength', context.response.get('iopa.Body')?.length || 0)
    context.set('response.StatusCode', context.response.get('iopa.StatusCode'))
    context.set('server.Duration', response['server.Timestamp']-request['server.Timestamp'])

    return context
}

export function Component() {
  const instance = usePlugin(plugin);
  const columns = useValue(instance.columns);

  return (
      <Layout.Container
        grow
        key={
          columns.length /* make sure to reset the table if colums change */
        }>
        <DataTable
          columns={columns}
          dataSource={instance.requests}
          onRowStyle={getRowStyle}
          tableManagerRef={instance.tableManagerRef}
          onSelect={instance.onSelect}
          onCopyRows={contextsToText}
          onContextMenu={instance.onContextMenu}
          enableAutoScroll
          extraActions={
            <Layout.Horizontal gap>
              <Button title="Clear logs" onClick={instance.clearLogs}>
                <DeleteOutlined />
              </Button>
            </Layout.Horizontal>
          }
        />
        <DetailSidebar width={400}>
          <Sidebar />
        </DetailSidebar>
      </Layout.Container>
  );
}

function Sidebar() {
  const instance = usePlugin(plugin);
  const selectedId = useValue(instance.selectedId);
  const detailBodyFormat = useValue(instance.detailBodyFormat);

  const request = instance.requests.getById(selectedId!);
  if (!request) {
    return (
      <Layout.Container pad grow center>
        <Typography.Text type="secondary">No request selected</Typography.Text>
      </Layout.Container>
    );
  }

  return (
    <RequestDetails
      key={selectedId}
      context={request}
      bodyFormat={detailBodyFormat}
      onSelectFormat={instance.onSelectFormat}
      onCopyText={instance.onCopyText}
    />
  );
}

const baseColumns: DataTableColumn<IContextIopa>[] = [
  {
    key: 'server.Timestamp',
    title: 'Request Time',
    width: 120,
  },
  {
    key: 'iopa.Id',
    title: 'Id',
    width: 60,
  },
  {
    key: 'flipper.Path',
    title: "Path"
  },
  {
    key: 'iopa.OriginalUrl',
    title: 'Full URL',
    visible: false,
  },
  {
    key: 'iopa.Method',
    title: 'Method',
    formatters: formatMethod,
    align: 'center',
    width: 70,
  },
  {
    key: 'response.StatusCode',
    title: 'Status',
    width: 70,
    formatters: formatStatus,
    align: 'left',
  },
  {
    key: 'iopa.ContentLength',
    title: 'Req. Size',
    width: 100,
    formatters: formatBytes,
    align: 'left',
  },
  {
    key: 'response.ContentLength',
    title: 'Resp. Size',
    width: 100,
    formatters: formatBytes,
    align: 'left',
  },
  {
    key: 'server.Duration',
    title: 'Duration',
    width: 100,
    formatters: formatDuration,
    align: 'left',
  },
];


const baseRowStyle = {
  ...theme.monospace,
  color: theme.textColorSecondary
};

const mockingStyle = {
  ...baseRowStyle,
  color: theme.warningColor,
};

const errorStyle = {
  ...baseRowStyle,
  color: theme.errorColor,
};

function getRowStyle(row: IContextIopa) {
  const status = row.response?.get('iopa.StatusCode')
  return row.get('flipper.isMock')
    ? mockingStyle
    : status && status >= 400 && status < 600
    ? errorStyle
    : baseRowStyle;
}
