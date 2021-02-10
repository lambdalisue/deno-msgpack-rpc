/**
 * The message type, must be the integer zero (0) for "Request" messages.
 */
export type MessageTypeRequest = 0;

/**
 * The message type, must be the integer one (1) for "Response" messages.
 */
export type MessageTypeResponse = 1;

/**
 * The message type, must be the integer two (2) for "Notification" messages.
 */
export type MessageTypeNotification = 2;

/**
 * A 32-bit unsigned integer number. This number is used as a sequence number.
 * The server's response to the "Request" will have the same msgid.
 */
export type MessageId = number;

/**
 * A string which represents the method name.
 */
export type MessageMethod = string;

/**
 * An array of the function arguments. The elements of this array are arbitarary objects.
 */
export type MessageParams = unknown[];

/**
 * If the method is executed correctly, this field is Nil.
 * If the error occured at the server-side, then this field is an arbitrary object which
 * represents the error.
 */
export type MessageError = unknown | null;

/**
 * An arbitrary object, which represents the returned result of the function.
 * If an error occured, this field should be nil.
 */
export type MessageResult = unknown | null;

/**
 * Request message which is sent from client to server.
 */
export type RequestMessage = [
  MessageTypeRequest,
  MessageId,
  MessageMethod,
  MessageParams,
];

/**
 * Response message which is sent from server to client as a response
 */
export type ResponseMessage = [
  MessageTypeResponse,
  MessageId,
  MessageError,
  MessageResult,
];

/**
 * Notification message which is sent from client to server.
 */
export type NotificationMessage = [
  MessageTypeNotification,
  MessageMethod,
  MessageParams,
];

/**
 * Message used in MessagePack-RPC
 */
export type Message = RequestMessage | ResponseMessage | NotificationMessage;

/**
 * Check if an arbitrary data is RequestMessage or not
 */
export function isRequestMessage(data: unknown): data is RequestMessage {
  return (
    Array.isArray(data) &&
    data.length === 4 &&
    data[0] === 0 &&
    typeof data[1] === "number" &&
    typeof data[2] === "string" &&
    Array.isArray(data[3])
  );
}

/**
 * Check if an arbitrary data is ResponseMessage or not
 */
export function isResponseMessage(data: unknown): data is ResponseMessage {
  return (
    Array.isArray(data) &&
    data.length === 4 &&
    data[0] === 1 &&
    typeof data[1] === "number" &&
    typeof data[2] !== "undefined" &&
    typeof data[3] !== "undefined"
  );
}

/**
 * Check if an arbitrary data is NotificationMessage or not
 */
export function isNotificationMessage(
  data: unknown,
): data is NotificationMessage {
  return (
    Array.isArray(data) &&
    data.length === 3 &&
    data[0] === 2 &&
    typeof data[1] === "string" &&
    Array.isArray(data[2])
  );
}

/**
 * Check if an arbitrary data is Message or not
 */
export function isMessage(data: unknown): data is Message {
  return (
    isRequestMessage(data) ||
    isResponseMessage(data) ||
    isNotificationMessage(data)
  );
}
