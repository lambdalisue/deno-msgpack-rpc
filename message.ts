/**
 * Request message which is sent from client to server
 */
export interface Request {
  /**
   * The message type, must be the integer zero (0) for "Request" messages.
   */
  readonly type: 0;
  /**
   * A 32-bit unsigned integer number. This number is used as a sequence number.
   * The server's response to the "Request" will have the same msgid.
   */
  readonly msgid: number;
  /**
   * A string which represents the method name.
   */
  readonly method: string;
  /**
   * An array of the function arguments. The elements of this array are arbitarary objects.
   */
  readonly params: any[];
}

/**
 * Response message which is sent from server to client as a response
 */
export interface Response {
  /**
   * The message type, must be the integer one (1) for "Response" messages.
   */
  readonly type: 1;
  /**
   * A 32-bit unsigned integer number. This corresponds to the value used in the request message.
   */
  readonly msgid: number;
  /**
   * If the method is executed correctly, this filed is Nil.
   * If the error occured at the server-side, then this field is an arbitrary object which
   * represents the error.
   */
  readonly error?: any;
  /**
   * An arbitrary object, which represents the returned result of the function.
   * If an error occured, this field should be nil.
   */
  readonly result?: any;
}

/**
 * Notification message which is sent from client to server.
 */
export interface Notification {
  /**
   * The message type, must be the integer two (2) for "Notification" messages.
   */
  readonly type: 2;
  /**
   * A string which represents the method name.
   */
  readonly method: string;
  /**
   * An array of the function arguments. The elements of this array are arbitarary objects.
   */
  readonly params: any[];
}

/**
 * Message used in MessagePack-RPC
 */
export type Message = Request | Response | Notification;

/**
 * Encode a message into a n-elements array which can be packed in MessagePack format directly.
 */
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

/**
 * Decode a n-elements array which can be unpacked from MessagePack format directly to a message.
 * It throw an error when `data` is unexpected format.
 */
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
