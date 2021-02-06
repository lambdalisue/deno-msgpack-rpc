export interface Request {
  readonly type: 0;
  readonly msgid: number;
  readonly method: string;
  readonly params: any[];
}

export interface Response {
  readonly type: 1;
  readonly msgid: number;
  readonly error?: any;
  readonly result?: any;
}

export interface Notification {
  readonly type: 2;
  readonly method: string;
  readonly params: any[];
}

export type Message = Request | Response | Notification;

export function encode(message: Message): any[] {
  switch (message.type) {
    case 0:
      return [message.type, message.msgid, message.method, message.params];
    case 1:
      return [message.type, message.msgid, message.error, message.result];
    case 2:
      return [message.type, message.method, message.params];
  }
}

export function decode(data: any[]): Message {
  switch (data[0]) {
    case 0:
      return {
        type: 0,
        msgid: data[1],
        method: data[2],
        params: data[3],
      };
    case 1:
      return {
        type: 1,
        msgid: data[1],
        error: data[2],
        result: data[3],
      };
    case 2:
      return {
        type: 2,
        method: data[1],
        params: data[2],
      };
    default:
      throw new Error(`Unexpected data '${data}' is received`);
  }
}
