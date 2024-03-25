export enum ErrorCode {
  NOT_LOGGED_IN = "NotLoggedIn",
  NO_USER_EXISTS = "NoUserExists",
  NO_USER_PROVIDED = "NoUserProvided",
  INVALID_SIGNATURE = "InvalidSignature",
  SIGNATURE_DOES_NOT_MATCH_USER = "SignatureDoesNotMatchUser",
  MISSING_HTTP_SIGNATURE = "MissingHttpSignature",
  LOGIN_FAILED = "LoginFailed",
  INVALID_CHAT_ID = "InvalidChatId",
  ACCOUNT_CREATION_FAILED = "AccountCreationFailed",
  CHAT_CREATION_FAILED = "ChatCreationFailed",
  CHAT_LIST_RETRIEVE_FAILED = "ChatListRetrieveFailed",
  CHAT_RETRIEVE_FAILED = "ChatRetrieveFailed",
  NO_CHAT_ID_PROVIDED = "NoChatIdProvided",
  CHAT_INVITE_FAILED = "ChatInviteFailed",
  CHAT_ACCEPT_INVITE_FAILED = "ChatAcceptInviteFailed",
  NOT_MEMBER_OF_CHAT = "NotMemberOfChat",
  CANNOT_GET_USER_KEYS = "CannotGetUserKeys",
  FAILED_TO_ADD_KEY_EXCHANGE = "FailedToAddKeyExchange",
  FAILED_TO_GET_MESSAGES = "FailedToGetMessages",
  FAILED_TO_VERIFY_CHAT_MEMBER = "FailedToVerifyChatMember",
  FAILED_TO_RETRIEVE_KEY_EXCHANGES = "FailedToRetrieveKeyExchanges",
  FAILED_TO_PROCESS_FILE_DURING_UPLOAD = "FailedToProcessFileDuringUpload",
  FAILED_TO_SAVE_FILE_INFO_DATABASE = "FailedToSaveFileInfoDatabase",
  FAILED_TO_UPLOAD_FILE = "FailedToUploadFile",

}

export type UserInfo = {
  id: string,
  identity_key_base64: string,
  exchange_key_base64: string,
  exchange_key_sig_base64: string,
  exchange_prekey_base64: string,
  exchange_prekey_sig_base64: string
};

export enum KeyType {
  IDENTITY_KEY_PAIR = "id_keypair",
  EXCHANGE_ID_PAIR = "exchange_keypair",
  EXCHANGE_PREKEY_PAIR = "exchange_prekey_keypair",

}
