import React, { useCallback, useMemo, useState } from 'react';
import {Component} from 'react';
import xmlBeautifier from 'xml-beautifier';
import {Base64} from 'js-base64';

import {
  DataInspector,
  Layout,
  Panel,
  styled,
  theme,
  CodeBlock,
} from 'flipper-plugin';
import {Select, Typography} from 'antd';

import {addValueByPointer, bodyAsBinary, bodyAsString, formatBytes} from './utils';
import { IContextIopa, IContextReply, IInsights, IRetryInsights } from './types';
import {BodyOptions} from './index';
import { KeyValueItem, KeyValueTable} from './KeyValueTable';
import {CopyOutlined} from '@ant-design/icons';

import { applyPatch, applyOperation, getValueByPointer } from 'fast-json-patch'

const {Text} = Typography;

interface TraceRecord {
  started: number,
  startJson: any,
  duration: number,
  next: boolean,
  nextDuration?: number,
  resumed?: number,
  nextDelta?: any,
  resumeDelta?: any,
  endDelta?: any
}

interface TraceRecordExpanded {
  started: number,
  startJson: any,
  duration: number,
  next: boolean,
  nextDuration?: number,
  resumed?: number,
  nextDelta?: any,
  nextJson?: any,
  resumeDelta?: any,
  resumeJson?: any,
  endDelta?: any,
  endJson?: any

  startJsonDiffsForEnd?: any
  endJsonDiffs?: any

  startJsonDiffsForNext?: any
  nextJsonDiffs?: any
}

type RequestDetailsProps = {
  context: IContextIopa;
  bodyFormat: string;
  onSelectFormat: (bodyFormat: string) => void;
  onCopyText(test: string): void;
};
export default class RequestDetails extends Component<RequestDetailsProps> {
  urlColumns = (url: URL) => {
    return [
      {
        key: 'url',
        value: url.href,
      },
      {
        key: 'host',
        value: url.host,
      },
      {
        key: 'path',
        value: url.pathname,
      },
      url.search && {
        key: 'query',
        value: url.search,
      },
    ].filter(Boolean);
  };

  render() {
    const {context, bodyFormat, onSelectFormat, onCopyText} = this.props;
    const url: URL = context.get('iopa.Url')

    const formattedText = bodyFormat == 'formatted';

    return (
      <>
        <Panel key="request" title={'Request'}>
          <KeyValueTable items={this.urlColumns(url)} />
        </Panel>

        {context.get('iopa.Params') ? (
          <Panel title={'Request Parameters'}>
            <QueryInspector queryParams={context.get('iopa.Params')} />
          </Panel>
        ) : null}

        {Array.from(context.get('iopa.Headers').keys()).length > 0 ? (
          <Panel key="headers" title={'Request Headers'} collapsed >
            <HeaderInspector headers={context.get('iopa.Headers')} />
          </Panel>
        ) : null}

        <Panel key="context" title={'IOPA Context'}>
            <ContextInspector context={context} />
        </Panel>

        {context.get('iopa.Body') != null ? (
          <Panel
            key="requestData"
            title={'Request Body'}
            extraActions={
              typeof context.get('iopa.Body') === 'string' ? (
                <CopyOutlined
                  title="Copy request body"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyText(context.get('iopa.Body') as string);
                  }}
                />
              ) : null
            }
            pad>
            <RequestBodyInspector
              formattedText={formattedText}
              context={context}
            />
          </Panel>
        ) : null}
        {context.get('server.Trace') ? (
          <Panel title={'Middleware Used'}>
            <MiddlewareInspector trace={context.get('server.Trace')} />
          </Panel>
        ) : null}
        {context.response?.get('iopa.StatusCode') ? (
          <>
            {Array.from(context.response.get('iopa.Headers')?.keys())?.length ? (
              <Panel
                key={'responseheaders'}
                title={`Response Headers${
                  context.get('flipper.isMock') ? ' (Mocked)' : ''
                }`}>
                <HeaderInspector headers={context.response.get('iopa.Headers')} />
              </Panel>
            ) : null}
           <Panel key="context" title={'IOPA Response'}>
              <ContextInspector context={context.response} />
           </Panel>
            <Panel
              key={'responsebody'}
              title={`Response Body${
                context.get('flipper.isMock') ? ' (Mocked)' : ''
              }`}
              extraActions={
                typeof context.get('iopa.Body') === 'string' &&
                context.get('iopa.Body') ? (
                  <CopyOutlined
                    title="Copy response body"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyText(context.get('iopa.Body') as string);
                    }}
                  />
                ) : null
              }
              pad>
              <ResponseBodyInspector
                formattedText={formattedText}
                context={context}
              />
            </Panel>
          </>
        ) : null}
        <Panel key="options" title={'Options'} collapsed pad>
          <Text>Body formatting:</Text>
          <Select
            value={bodyFormat}
            onChange={onSelectFormat}
            options={BodyOptions}
          />
        </Panel>
      </>
    );
  }
}

const QueryInspector = ({queryParams}: {queryParams: Record<string, any>}) => {

    const rows: KeyValueItem[] = Object.entries(queryParams).map(([key, value]) => ({
        key,
        value,
      }));
      
    return rows.length > 0 ? <KeyValueTable items={rows} /> : null;
  }


const MiddlewareInspector: React.FC<{trace: Array<[string, TraceRecord]>}> = ({trace } ) => {

  const [selected, setSelected] = useState<KeyValueItem & { data: TraceRecordExpanded}>()

  const onSelect = useCallback((record: KeyValueItem) => {
    setSelected(record as KeyValueItem & { data: TraceRecordExpanded})
  }, [setSelected])

  const rows = useMemo(() => trace.map(([key, value]) => ({
        key,
        value: `${value.duration}ms`,
        data: expandTrace(value)
      })), [trace])

  return rows.length > 0 ? <>
    <KeyValueTable enableColumnHeaders onSelect={onSelect} items={rows} />
    {selected && selected.data.nextDelta && <DataInspector expandRoot data={selected.data.nextJsonDiffs} diff={selected.data.startJsonDiffsForNext} />}
    {selected && selected.data.endDelta && <DataInspector expandRoot data={selected.data.endJsonDiffs} diff={selected.data.startJsonDiffsForEnd} />}
    </> : null
}

function diffsOnly(item: any, delta: Array<{ op: 'test' | 'add' | 'replace' | 'remove', path: string, value?: string }>) {
  const result: any = {}

  delta.filter(o => (o.op === 'replace' || o.op === 'remove' || o.op === 'add'))
  .forEach(o => {
    addValueByPointer(result, o.path, o.op === 'add' ? undefined : getValueByPointer(item, o.path))
  })

  return result
}

function expandTrace(data: TraceRecord) {
  const trace = JSON.parse(JSON.stringify(data)) as TraceRecordExpanded
  if (trace.next) {
    trace.nextJson = JSON.parse(JSON.stringify(data.startJson))
    applyPatch(trace.nextJson, trace.nextDelta || [])

    trace.resumeJson = JSON.parse(JSON.stringify(trace.nextJson))
    applyPatch(trace.resumeJson, trace.resumeDelta || [])

    trace.endJson = JSON.parse(JSON.stringify(trace.resumeJson))
    applyPatch(trace.endJson, trace.endDelta || [])

    trace.startJsonDiffsForNext = diffsOnly(trace.startJson, trace.nextDelta || [])
    trace.nextJsonDiffs = JSON.parse(JSON.stringify(trace.startJsonDiffsForNext))
    applyPatch(trace.nextJsonDiffs, trace.nextDelta || [])

    trace.startJsonDiffsForEnd = diffsOnly(trace.resumeJson, trace.endDelta || [])
    trace.endJsonDiffs = JSON.parse(JSON.stringify(trace.startJsonDiffsForEnd))
    applyPatch(trace.endJsonDiffs, trace.endDelta || [])
  } else {
    trace.endJson = JSON.parse(JSON.stringify(data.startJson))
    applyPatch(trace.endJson, trace.endDelta || [])

    trace.startJsonDiffsForEnd = diffsOnly(trace.startJson, trace.endDelta || [])
    trace.endJsonDiffs = JSON.parse(JSON.stringify(trace.startJsonDiffsForEnd))
    applyPatch(trace.endJsonDiffs, trace.endDelta || [])
  }
  return trace
}

type HeaderInspectorProps = {
  headers: Headers;
};

type HeaderInspectorState = {
  computedHeaders: Object;
};

class HeaderInspector extends Component<
  HeaderInspectorProps,
  HeaderInspectorState
> {
  render() {
    const rows = Array.from(this.props.headers.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] == b[0] ? 0 : 1))
      .map(([key, value]) => ({key, value}));
    return rows.length > 0 ? (
      <KeyValueTable items={rows} />
    ) : null;
  }
}

const ContextInspector = ({context}: {context: IContextIopa | IContextReply}) => {

  const rows = context.toKeyValueTable()

    return Object.keys(rows).length > 0 ? (
      <Layout.Container gap>
        <KeyValueTable items={rows} />
      </Layout.Container>
    ) : null;
  }


type BodyFormatter = {
  formatRequest?: (context: IContextIopa) => any;
  formatResponse?: (request: IContextIopa) => any;
};

class RequestBodyInspector extends Component<{
  context: IContextIopa;
  formattedText: boolean;
}> {
  render() {
    const {context, formattedText} = this.props;
    if (context.get('iopa.Body') == null || context.get('iopa.Body') === '') {
      return <Empty />;
    }
    const bodyFormatters = formattedText ? TextBodyFormatters : BodyFormatters;
    for (const formatter of bodyFormatters) {
      if (formatter.formatRequest) {
        try {
          const component = formatter.formatRequest(context);
          if (component) {
            return (
              <Layout.Container gap>
                {component}
                <FormattedBy>
                  Formatted by {formatter.constructor.name}
                </FormattedBy>
              </Layout.Container>
            );
          }
        } catch (e: any) {
          console.warn(
            'BodyFormatter exception from ' + formatter.constructor.name,
            e.message,
          );
        }
      }
    }
    return renderRawBody(context, 'request');
  }
}

class ResponseBodyInspector extends Component<{
  context: IContextIopa;
  formattedText: boolean;
}> {
  render() {
    const {context, formattedText} = this.props;
    if (context.response?.get('iopa.Body') == null || context.response?.get('iopa.Body') === '') {
      return <Empty />;
    }
    const bodyFormatters = formattedText ? TextBodyFormatters : BodyFormatters;
    for (const formatter of bodyFormatters) {
      if (formatter.formatResponse) {
        try {
          const component = formatter.formatResponse(context);
          if (component) {
            return (
              <Layout.Container gap>
                {component}
                <FormattedBy>
                  Formatted by {formatter.constructor.name}
                </FormattedBy>
              </Layout.Container>
            );
          }
        } catch (e: any) {
          console.warn(
            'BodyFormatter exception from ' + formatter.constructor.name,
            e.message,
          );
        }
      }
    }
    return renderRawBody(context, 'response');
  }
}

const FormattedBy = styled(Text)({
  marginTop: 8,
  fontSize: '0.7em',
  textAlign: 'center',
  display: 'block',
  color: theme.disabledColor,
});

const Empty = () => (
  <Layout.Container pad>
    <Text>(empty)</Text>
  </Layout.Container>
);

function renderRawBody(context: IContextIopa, mode: 'request' | 'response') {
  const data = mode === 'request' ? context.get('iopa.Body') : context.response.get('iopa.Body');
  return (
    <Layout.Container gap>
      <CodeBlock>{bodyAsString(data)}</CodeBlock>
    </Layout.Container>
  );
}

type ImageWithSizeProps = {
  src: string;
};

type ImageWithSizeState = {
  width: number;
  height: number;
};

class ImageWithSize extends Component<ImageWithSizeProps, ImageWithSizeState> {
  static Image = styled.img({
    objectFit: 'scale-down',
    maxWidth: '100%',
    marginBottom: 10,
  });

  constructor(props: ImageWithSizeProps) {
    super(props);
    this.state = {
      width: 0,
      height: 0,
    };
  }

  componentDidMount() {
    const image = new Image();
    image.src = this.props.src;
    image.onload = () => {
      image.width;
      image.height;
      this.setState({
        width: image.width,
        height: image.height,
      });
    };
  }

  render() {
    return (
      <Layout.Container center>
        <ImageWithSize.Image src={this.props.src} />
        <Text type="secondary">
          {this.state.width} x {this.state.height}
        </Text>
      </Layout.Container>
    );
  }
}

class ImageFormatter {
  formatResponse(context: IContextIopa) {
    if (
      context.response.get('iopa.Headers').get('content-type').startsWith(
        'image/',
      )
    ) {
      if (context.response.get('iopa.Body')) {
        const src = `data:${context.response.get('iopa.Headers').get('content-type')};base64,${Base64.fromUint8Array(
          bodyAsBinary(context.response.get('iopa.Body'))!,
        )}`;
        return <ImageWithSize src={src} />;
      } else {
        // fallback to using the request url
        return <ImageWithSize src={context.get('iopa.OriginalUrl')} />;
      }
    } else {
      return undefined
    }
  }
}

class VideoFormatter {
  static Video = styled.video({
    maxWidth: 500,
    maxHeight: 500,
  });

  formatResponse = (context: IContextIopa) => {
    const contentType = context.get('iopa.Headers').get('content-type');
    if (contentType?.startsWith('video/')) {
      return (
        <Layout.Container center>
          <VideoFormatter.Video controls>
            <source src={context.get('iopa.OriginalUrl')} type={contentType} />
          </VideoFormatter.Video>
        </Layout.Container>
      );
    }
    return undefined
  };
}

class JSONText extends Component<{children: any}> {
  render() {
    const jsonObject = this.props.children;
    return (
      <CodeBlock>
        {JSON.stringify(jsonObject, null, 2)}
        {'\n'}
      </CodeBlock>
    );
  }
}

class XMLText extends Component<{body: any}> {
  render() {
    const xmlPretty = xmlBeautifier(this.props.body);
    return (
      <CodeBlock>
        {xmlPretty}
        {'\n'}
      </CodeBlock>
    );
  }
}

class JSONTextFormatter {
  formatRequest(context: IContextIopa) {
    return this.format(
      bodyAsString(context.get('iopa.Body')),
      context.get('iopa.Headers').get('content-type'),
    );
  }

  formatResponse(context: IContextIopa) {
    return this.format(
      bodyAsString(context.get('iopa.Body')),
      context.get('iopa.Headers').get('content-type'),
    );
  }

  format(body: string, contentType: string) {
    if (
      contentType.startsWith('application/json') ||
      contentType.startsWith('application/hal+json') ||
      contentType.startsWith('text/javascript') ||
      contentType.startsWith('application/x-fb-flatbuffer')
    ) {
      try {
        const data = JSON.parse(body);
        return <JSONText>{data}</JSONText>;
      } catch (SyntaxError) {
        // Multiple top level JSON roots, map them one by one
        return body
          .split('\n')
          .map((json) => JSON.parse(json))
          .map((data, idx) => <JSONText key={idx}>{data}</JSONText>);
      }
    } else {
      return undefined
    }
  }
}

class XMLTextFormatter {
  formatRequest(context: IContextIopa) {
    return this.format(
      bodyAsString(context.get('iopa.Body')),
      context.get('iopa.Headers').get('content-type'),
    );
  }

  formatResponse(context: IContextIopa) {
    return this.format(
      bodyAsString(context.response.get('iopa.Body')),
      context.response.get('iopa.Headers').get('content-type'),
    );
  }

  format(body: string, contentType: string) {
    if (contentType.startsWith('text/html')) {
      return <XMLText body={body} />;
    } else {
      return undefined
    }
  }
}

class JSONFormatter {
  formatRequest(context: IContextIopa) {
    return this.format(
      bodyAsString(context.get('iopa.Body')),
      context.get('iopa.Headers').get('content-type'),
    );
  }

  formatResponse(context: IContextIopa) {
    return this.format(
      bodyAsString(context.response.get('iopa.Body')),
      context.response.get('iopa.Headers').get('content-type'),
    );
  }

  format(body: string, contentType: string) {
    if (
      contentType.startsWith('application/json') ||
      contentType.startsWith('application/hal+json') ||
      contentType.startsWith('text/javascript') ||
      contentType.startsWith('application/x-fb-flatbuffer')
    ) {
      try {
        const data = JSON.parse(body);
        return <DataInspector collapsed expandRoot data={data} />;
      } catch (SyntaxError) {
        // Multiple top level JSON roots, map them one by one
        const roots = body.split('\n');
        return (
          <DataInspector
            collapsed
            expandRoot
            data={roots.map((json) => JSON.parse(json))}
          />
        );
      }
    } else {
      return undefined
    }
  }
}

class LogEventFormatter {
  formatRequest(context: IContextIopa) {
    if (context.get('iopa.OriginalUrl').indexOf('logging_client_event') > 0) {
      const data = new URLSearchParams(bodyAsString(context.get('iopa.Body')));
      if (typeof data.get('message') === 'string') {
        data.set('message', JSON.parse(data.get('message')))
      }
      return <DataInspector expandRoot data={Object.fromEntries(data.entries())} />;
    } else {
      return undefined
    }
  }
}

class GraphQLBatchFormatter {
  formatRequest(context: IContextIopa) {
    if (context.get('iopa.OriginalUrl').indexOf('graphqlbatch') > 0) {
      const data = new URLSearchParams(bodyAsString(context.get('iopa.Body')));
      if (typeof data.get('queries') === 'string') {
        data.set('queries', JSON.parse(data.get('queries')));
      }
      return <DataInspector expandRoot data={Object.fromEntries(data.entries())} />;
    } else {
      return undefined
    }
  }
}

class GraphQLFormatter {
  parsedServerTimeForFirstFlush(data: any) {
    const firstResponse =
      Array.isArray(data) && data.length > 0 ? data[0] : data;
    if (!firstResponse) {
      return null;
    }

    const extensions = firstResponse['extensions'];
    if (!extensions) {
      return null;
    }
    const serverMetadata = extensions['server_metadata'];
    if (!serverMetadata) {
      return null;
    }
    const requestStartMs = serverMetadata['request_start_time_ms'];
    const timeAtFlushMs = serverMetadata['time_at_flush_ms'];
    return (
      <Text type="secondary">
        {'Server wall time for initial response (ms): ' +
          (timeAtFlushMs - requestStartMs)}
      </Text>
    );
  }
  formatRequest(context: IContextIopa) {
    if (context.get('iopa.OriginalUrl').indexOf('graphql') > 0) {
      const decoded = context.get('iopa.Body');
      if (!decoded) {
        return undefined;
      }
      const data = Object.fromEntries((new URLSearchParams(bodyAsString(decoded))).entries())
      if (typeof data.variables === 'string') {
        data.variables = JSON.parse(data.variables);
      }
      if (typeof data.query_params === 'string') {
        data.query_params = JSON.parse(data.query_params);
      }
      return <DataInspector expandRoot data={data} />;
    }
    else {
      return undefined
    }
  }

  formatResponse(context: IContextIopa) {
    return this.format(
      bodyAsString(context.response.get('iopa.Body')!),
      context.response.get('iopa.Headers').get('content-type') || '',
    );
  }

  format = (body: string, contentType: string) => {
    if (
      contentType.startsWith('application/json') ||
      contentType.startsWith('application/hal+json') ||
      contentType.startsWith('text/javascript') ||
      contentType.startsWith('text/html') ||
      contentType.startsWith('application/x-fb-flatbuffer')
    ) {
      try {
        const data = JSON.parse(body);
        return (
          <div>
            {this.parsedServerTimeForFirstFlush(data)}
            <DataInspector collapsed expandRoot data={data} />
          </div>
        );
      } catch (SyntaxError) {
        // Multiple top level JSON roots, map them one by one
        const parsedResponses = body
          .replace(/}{/g, '}\r\n{')
          .split('\n')
          .filter((json) => json.length > 0)
          .map((json) => JSON.parse(json));
        return (
          <div>
            {this.parsedServerTimeForFirstFlush(parsedResponses)}
            <DataInspector collapsed expandRoot data={parsedResponses} />
          </div>
        );
      }
    } else {
      return undefined
    }
  };
}

class FormUrlencodedFormatter {
  formatRequest = (context: IContextIopa) => {
    const contentType = context.get('iopa.Headers').get('content-type');
    if (contentType?.startsWith('application/x-www-form-urlencoded')) {
      const decoded = context.get('iopa.Body');
      if (!decoded) {
        return undefined;
      }
      const data = Object.fromEntries((new URLSearchParams(bodyAsString(decoded))).entries())
      return (
        <DataInspector
          expandRoot
          data={data}
        />
      );
    } else {
      return undefined
    }
  };
}

class BinaryFormatter {
  formatRequest(context: IContextIopa) {
    if (
      context.get('iopa.Headers').get('content-type') ===
      'application/octet-stream'
    ) {
      return '(binary data)'; // we could offer a download button here?
    } else {
      return undefined
    }
  }

  formatResponse(context: IContextIopa) {
    if (
      context.response.get('iopa.Headers').get('content-type') ===
      'application/octet-stream'
    ) {
      return '(binary data)'; // we could offer a download button here?
    } else {
      return undefined
    }
  }
}

const BodyFormatters: Array<BodyFormatter> = [
  new ImageFormatter(),
  new VideoFormatter(),
  new LogEventFormatter(),
  new GraphQLBatchFormatter(),
 // new GraphQLFormatter(),
  new JSONFormatter(),
  new FormUrlencodedFormatter(),
  new XMLTextFormatter(),
  new BinaryFormatter(),
];

const TextBodyFormatters: Array<BodyFormatter> = [new JSONTextFormatter()];

class InsightsInspector extends Component<{insights: IInsights}> {
  formatTime(value: number): string {
    return `${value} ms`;
  }

  formatSpeed(value: number): string {
    return `${formatBytes(value)}/sec`;
  }

  formatRetries = (retry: IRetryInsights): string => {
    const timesWord = retry.limit === 1 ? 'time' : 'times';

    return `${this.formatTime(retry.timeSpent)} (${
      retry.count
    } ${timesWord} out of ${retry.limit})`;
  };

  buildRow<T>(
    name: string,
    value: T | null | undefined,
    formatter: (value: T) => string,
  ): any {
    return value
      ? {
          key: name,
          value: formatter(value),
        }
      : null;
  }

  render() {
    const insights = this.props.insights;
    const {buildRow, formatTime, formatSpeed, formatRetries} = this;

    const rows = [
      buildRow('Retries', insights.retries, formatRetries),
      buildRow('DNS lookup time', insights.dnsLookupTime, formatTime),
      buildRow('Connect time', insights.connectTime, formatTime),
      buildRow('SSL handshake time', insights.sslHandshakeTime, formatTime),
      buildRow('Pretransfer time', insights.preTransferTime, formatTime),
      buildRow('Redirect time', insights.redirectsTime, formatTime),
      buildRow('First byte wait time', insights.timeToFirstByte, formatTime),
      buildRow('Data transfer time', insights.transferTime, formatTime),
      buildRow('Post processing time', insights.postProcessingTime, formatTime),
      buildRow('Bytes transfered', insights.bytesTransfered, formatBytes),
      buildRow('Transfer speed', insights.transferSpeed, formatSpeed),
    ].filter((r) => r != null);

    return rows.length > 0 ? <KeyValueTable items={rows} /> : null;
  }
}
