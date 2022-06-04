import type { IMap } from './types'

interface IIopaMap<T> {
  get<K extends keyof T>(key: K): T[K]
  has<K extends keyof T>(key: K): boolean
  set<K extends keyof T>(key: K, value: T[K]): void
  set(value: IMapInit<any>): void
  default<K extends keyof T>(key: K, valueFn: T[K] | (() => T[K])): T[K]
  delete<K extends keyof T>(key: K): boolean
  entries(): [any, any][]
  toJSON(): any
}

export type IMapInit<T> = Partial<T> | [keyof T, T[keyof T]][] | IopaMap<T>

export default class IopaMap<T> implements IMap<T> {
  private static readonly _BLACK_LIST_STRINGIFY: string[] = [
    'iopa.RawRequest',
    'iopa.RawResponse',
    'iopa.Body',
    'server.CancelToken',
    'server.CancelTokenSource',
    'server.Environment',
    'get',
    'set',
    'delete',
    'toJSON',
    'capability',
    'setCapability',
    'server.Events',
    'server.Capabilities',
    'log',
    'dispose',
    'create',
    'reply'
  ]

  private static readonly _BLACK_LIST_KEYVALUETABLE: string[] = this._BLACK_LIST_STRINGIFY.concat([
    'iopa.Url',
    'iopa.OriginalUrl',
    'iopa.Headers',
    'iopa.Method',
    'iopa.ContentLength',
    'iopa.Params',
    'flipper.Path',
    'response',
    'response.StatusCode',
    'response.ContentLength',
    'server.Duration',
    'server.Trace'
  ])


  public constructor(data?: IMapInit<T>, prevData?: IIopaMap<T>) {
    if (prevData) {
      this._loadEntries(prevData.entries())
    }
    if (data) {
      if (Array.isArray(data)) {
        this._loadEntries(data)
      } else if ('entries' in data) {
        this._loadEntries((data.entries as Function)())
      } else {
        this._loadEntries(
          Object.entries(data as unknown as Record<keyof T, T[keyof T]>) as [
            keyof T,
            T[keyof T]
          ][]
        )
      }
    }
  }

  private _loadEntries(entries: [keyof T, T[keyof T]][]): void {
    for (const entry of entries) {
      this.set(entry[0], entry[1])
    }
  }

  public get<K extends keyof T>(key: K): T[K] {
    return this[key as unknown as string]
  }

  public has<K extends keyof T>(key: K): boolean {
    return key in this
  }

  public set(value: IMapInit<T>): void
  public set<K extends keyof T>(key: K, value: T[K]): void
  public set<K extends keyof T>(data: IMapInit<T> | K, value?: T[K]): void {
    if (value || typeof data !== 'object') {
      this[data as unknown as string] = value
      return
    }
    if (Array.isArray(data)) {
      this._loadEntries(data)
    } else if ('entries' in data) {
      this._loadEntries((data.entries as Function)())
    } else {
      this._loadEntries(
        Object.entries(data as unknown as Record<keyof T, T[keyof T]>) as [
          keyof T,
          T[keyof T]
        ][]
      )
    }
  }

  public delete<K extends keyof T>(key: K): boolean {
    if (key in this) {
      delete this[key as unknown as string]
      return true
    }
    return false
  }

  public default<K extends keyof T>(
    key: K,
    valueFn: T[K] | (() => T[K])
  ): T[K] {
    if (key in this) {
      /** noop */
    } else if (typeof valueFn === 'function') {
      this.set(key, (valueFn as Function)())
    } else {
      this.set(key, valueFn)
    }
    return this.get(key)
  }

  public entries(): [any, any][] {
    return Object.entries(this) as any
  }

  public toString(): string {
    return jsonSerialize(this.toJSON())
  }

  public toKeyValueTable(): {key: string, value: any}[] {
    const rows: {key: string, value: any}[] = []

    for (const key of Object.getOwnPropertyNames(this).filter(
      (key) =>
        !key.startsWith('_') &&
        !IopaMap._BLACK_LIST_KEYVALUETABLE.includes(key) &&
        // eslint-disable-next-line eqeqeq
        this[key] != null
    )) {
      if (
        typeof this[key] === 'object' &&
        this[key].constructor.name.toString() === 'URL'
      ) {
        rows.push({key, value: (this[key] as URL).href})
        break
      }
      rows.push({key, value: this[key]})
    }

    const proto1 = Object.getPrototypeOf(this)
    const proto2 = Object.getPrototypeOf(proto1)
    ;[proto1, proto2].forEach((proto) => {
      for (const key of Object.getOwnPropertyNames(proto).filter(
        (key) =>
          !(rows.find(({key: rowKey}) => key == rowKey)) &&
          !key.startsWith('_') &&
          !IopaMap._BLACK_LIST_KEYVALUETABLE.includes(key) &&
          // eslint-disable-next-line eqeqeq
          this[key] != null
      )) {
        const desc = Object.getOwnPropertyDescriptor(proto, key)
        const hasGetter = desc && typeof desc.get === 'function'

        if (hasGetter) {
          const value = desc.get.call(this)
          if (
            typeof value === 'object' &&
            value.constructor.name.toString() === 'Headers'
          ) {
            rows.push({key, value: Object.fromEntries((value as any).entries())})
            break
          }
          rows.push({key, value})
        }
      }
    })

    return rows
  }

  public toJSON(): T {
    const jsonObj: any = {}

    for (const key of Object.getOwnPropertyNames(this).filter(
      (key) =>
        !key.startsWith('_') &&
        !IopaMap._BLACK_LIST_STRINGIFY.includes(key) &&
        // eslint-disable-next-line eqeqeq
        this[key] != null
    )) {
      if (
        typeof this[key] === 'object' &&
        this[key].constructor.name.toString() === 'URL'
      ) {
        jsonObj[key] = (this[key] as URL).href
        break
      }
      jsonObj[key] = this[key]
    }

    const proto1 = Object.getPrototypeOf(this)
    const proto2 = Object.getPrototypeOf(proto1)
    ;[proto1, proto2].forEach((proto) => {
      for (const key of Object.getOwnPropertyNames(proto).filter(
        (key) =>
          !(key in jsonObj) &&
          !key.startsWith('_') &&
          !IopaMap._BLACK_LIST_STRINGIFY.includes(key) &&
          // eslint-disable-next-line eqeqeq
          this[key] != null
      )) {
        const desc = Object.getOwnPropertyDescriptor(proto, key)
        const hasGetter = desc && typeof desc.get === 'function'

        if (hasGetter) {
          const value = desc.get.call(this)
          if (
            typeof value === 'object' &&
            value.constructor.name.toString() === 'Headers'
          ) {
            jsonObj[key] = Object.fromEntries((value as any).entries())
            break
          }
          jsonObj[key] = value
        }
      }
    })

    return jsonObj
  }
}

function getCircularReplacer(): (key: any, value: any) => any {
  const seen = new WeakSet()
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return undefined
      }
      seen.add(value)
      if ('toJSON' in value) {
        return value.toJSON()
      }
    }
    return value
  }
}

function jsonSerialize(data: any): string {
  return JSON.stringify(data, getCircularReplacer(), 2)
}
