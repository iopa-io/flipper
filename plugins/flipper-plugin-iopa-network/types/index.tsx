import {DataSource} from 'flipper-plugin';

export interface IMap<T> {
  get<K extends keyof T>(k: K): T[K]
  set<K extends keyof T>(k: K, value: T[K]): void
}  

interface IContextCore {
  'server.Version': string
  'iopa.Id': string
  'server.Timestamp': Date
}

export interface IContextIopaLegacy extends IContextCore {
  readonly 'iopa.Body': string | Uint8Array | undefined
  readonly 'iopa.Headers': Headers
  readonly 'iopa.Method': string
  readonly 'iopa.OriginalUrl': string
  readonly 'iopa.Url': URL
  readonly 'iopa.RemoteAddress': string
  readonly 'iopa.RawRequest': Request
  readonly 'iopa.IsHijacked': boolean
  readonly 'iopa.RawResponse': Response | PromiseLike<Response>
  readonly 'server.Trace'?: Array<[string, {
    started: number,
    startJson: any,
    duration: number,
    next: boolean,
    nextDuration?: number,
    resumed?: number,
    nextDelta?: any,
    resumeDelta?: any,
    endDelta?: any
  }]>
  readonly 'iopa.Params': Record<string, any>

  //
  // column helpers
  //

  'flipper.Path': string
  'flipper.isMock': boolean
  'iopa.ContentLength': number
  'response.StatusCode': number
  'response.ContentLength': number
  'server.Duration': number

}

export type IContextIopaSerialized = Omit<
IContextIopaLegacy,
'server.Timestamp' | 'iopa.Body'  | 'iopa.Headers'
> & {
  readonly 'server.Timestamp': number;
  readonly 'iopa.Headers': Record<string, string>
  'iopa.Body'?: string | [string]; // wrapped in Array represents base64 encoded
};

export interface IContextReplyLegacy extends IContextCore {
  'iopa.Body': string | Uint8Array | undefined;
  'iopa.Headers': Headers
  'iopa.StatusCode': number
  'iopa.StatusText': string
  'server.Duration': number
}

export type IContextReplySerialized = Omit<
IContextReplyLegacy,
'server.Timestamp' | 'iopa.Body'  | 'iopa.Headers'
> & {
readonly 'server.Timestamp': number;
readonly 'iopa.Headers': Record<string, string>
'iopa.Body'?: string | [string]; // wrapped in Array represents base64 encoded
};

export type IContextReply = IContextReplyLegacy & 
IMap<IContextReplyLegacy> & { 
  toJSON(): IContextReplySerialized
  toKeyValueTable(): {key: string, value: any}[] }

export type IContextIopa= IContextIopaLegacy &
IMap<IContextIopaLegacy> & { 
  response?: IContextReply,   
  toJSON(): IContextIopaSerialized
  toKeyValueTable(): {key: string, value: any}[] }

export type IRequests = DataSource<IContextIopa, never>;

export type IRetryInsights = {
  count: number;
  limit: number;
  timeSpent: number;
};


export type IInsights = {
  dnsLookupTime: number | null | undefined;
  connectTime: number | null | undefined;
  sslHandshakeTime: number | null | undefined;
  preTransferTime: number | null | undefined;
  redirectsTime: number | null | undefined;
  timeToFirstByte: number | null | undefined;
  transferTime: number | null | undefined;
  postProcessingTime: number | null | undefined;
  // Amount of transferred data can be different from total size of payload.
  bytesTransfered: number | null | undefined;
  transferSpeed: number | null | undefined;
  retries: IRetryInsights | null | undefined;
};