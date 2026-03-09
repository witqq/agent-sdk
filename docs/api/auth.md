[**@witqq/agent-sdk**](README.md)

***

[@witqq/agent-sdk](README.md) / auth

# auth

## Classes

### AccessDeniedError

Defined in: [auth/types.ts:155](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L155)

User denied access during OAuth flow

#### Extends

- [`AuthError`](#autherror)

#### Constructors

##### Constructor

> **new AccessDeniedError**(): [`AccessDeniedError`](#accessdeniederror)

Defined in: [auth/types.ts:156](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L156)

###### Returns

[`AccessDeniedError`](#accessdeniederror)

###### Overrides

[`AuthError`](#autherror).[`constructor`](#constructor-1)

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [errors.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L21)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AuthError`](#autherror).[`code`](#code-1)

##### httpStatus?

> `readonly` `optional` **httpStatus**: `number`

Defined in: [errors.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L25)

HTTP status code hint for error classification

###### Inherited from

[`AuthError`](#autherror).[`httpStatus`](#httpstatus-1)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L23)

Whether this error is safe to retry

###### Inherited from

[`AuthError`](#autherror).[`retryable`](#retryable-1)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L36)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AuthError`](#autherror).[`is`](#is-1)

***

### AuthError

Defined in: [auth/types.ts:139](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L139)

Base error for auth operations.

#### Param

Error description

#### Param

Standard ErrorOptions (e.g. cause)

#### Extends

- [`AgentSDKError`](index.md#agentsdkerror)

#### Extended by

- [`DeviceCodeExpiredError`](#devicecodeexpirederror)
- [`AccessDeniedError`](#accessdeniederror)
- [`TokenExchangeError`](#tokenexchangeerror)

#### Constructors

##### Constructor

> **new AuthError**(`message`, `options?`): [`AuthError`](#autherror)

Defined in: [auth/types.ts:140](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L140)

###### Parameters

###### message

`string`

###### options?

`ErrorOptions`

###### Returns

[`AuthError`](#autherror)

###### Overrides

[`AgentSDKError`](index.md#agentsdkerror).[`constructor`](index.md#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [errors.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L21)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](index.md#agentsdkerror).[`code`](index.md#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus**: `number`

Defined in: [errors.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L25)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](index.md#agentsdkerror).[`httpStatus`](index.md#httpstatus-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L23)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](index.md#agentsdkerror).[`retryable`](index.md#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L36)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](index.md#agentsdkerror).[`is`](index.md#is-2)

***

### ClaudeAuth

Defined in: [auth/claude-auth.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/claude-auth.ts#L33)

Programmatic OAuth+PKCE authentication for Claude SDK.

#### Example

```ts
const auth = new ClaudeAuth();
const { authorizeUrl, completeAuth } = auth.startOAuthFlow({
  redirectUri: "https://platform.claude.com/oauth/code/callback",
});
// Open authorizeUrl in browser, get code from redirect
const token = await completeAuth(code);
// Use token with ClaudeBackendOptions: env.CLAUDE_CODE_OAUTH_TOKEN
```

#### Constructors

##### Constructor

> **new ClaudeAuth**(`options?`): [`ClaudeAuth`](#claudeauth)

Defined in: [auth/claude-auth.ts:40](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/claude-auth.ts#L40)

###### Parameters

###### options?

Optional configuration with custom fetch and random bytes for testing

###### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

###### randomBytes?

`RandomBytesFn`

###### Returns

[`ClaudeAuth`](#claudeauth)

#### Methods

##### extractCode()

> `static` **extractCode**(`input`): `string`

Defined in: [auth/claude-auth.ts:103](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/claude-auth.ts#L103)

Extract an authorization code from user input.
Accepts a raw code string or a full redirect URL containing a `code` query parameter.

###### Parameters

###### input

`string`

Raw authorization code or redirect URL

###### Returns

`string`

The extracted authorization code

###### Example

```ts
ClaudeAuth.extractCode("abc123"); // "abc123"
ClaudeAuth.extractCode("https://platform.claude.com/oauth/code/callback?code=abc123&state=xyz"); // "abc123"
```

##### refreshToken()

> **refreshToken**(`refreshToken`): `Promise`\<[`ClaudeAuthToken`](#claudeauthtoken)\>

Defined in: [auth/claude-auth.ts:133](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/claude-auth.ts#L133)

Refresh an expired Claude token.

###### Parameters

###### refreshToken

`string`

The refresh token from a previous authentication

###### Returns

`Promise`\<[`ClaudeAuthToken`](#claudeauthtoken)\>

New auth token with refreshed access token

###### Throws

If the refresh request fails

###### Example

```ts
const auth = new ClaudeAuth();
const newToken = await auth.refreshToken(oldToken.refreshToken);
```

##### startOAuthFlow()

> **startOAuthFlow**(`options?`): [`OAuthFlowResult`](#oauthflowresult)

Defined in: [auth/claude-auth.ts:67](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/claude-auth.ts#L67)

Start the Claude OAuth+PKCE flow.
Generates PKCE code verifier/challenge and returns an authorize URL
plus a `completeAuth(code)` function for token exchange.

###### Parameters

###### options?

[`OAuthFlowOptions`](#oauthflowoptions)

Redirect URI and optional scopes

###### Returns

[`OAuthFlowResult`](#oauthflowresult)

OAuth flow result with authorize URL and completeAuth function

###### Throws

If PKCE generation fails

###### Example

```ts
const auth = new ClaudeAuth();
const { authorizeUrl, completeAuth } = auth.startOAuthFlow({
  redirectUri: "https://platform.claude.com/oauth/code/callback",
});
console.log(`Open: ${authorizeUrl}`);
const token = await completeAuth(authorizationCode);
```

***

### CopilotAuth

Defined in: [auth/copilot-auth.ts:54](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/copilot-auth.ts#L54)

Programmatic GitHub Device Flow authentication for Copilot SDK.

#### Example

```ts
const auth = new CopilotAuth();
const flow = await auth.startDeviceFlow();
console.log(`Open ${flow.verificationUrl} and enter ${flow.userCode}`);
const token = await flow.waitForToken();
// Use token.accessToken with CopilotBackendOptions.githubToken
```

#### Constructors

##### Constructor

> **new CopilotAuth**(`options?`): [`CopilotAuth`](#copilotauth)

Defined in: [auth/copilot-auth.ts:58](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/copilot-auth.ts#L58)

###### Parameters

###### options?

Optional configuration with custom fetch for testing

###### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

###### Returns

[`CopilotAuth`](#copilotauth)

#### Methods

##### refreshToken()

> **refreshToken**(`refreshToken`, `signal?`): `Promise`\<[`CopilotAuthToken`](#copilotauthtoken)\>

Defined in: [auth/copilot-auth.ts:232](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/copilot-auth.ts#L232)

Refresh an expired Copilot token using a refresh token.
Only works for GitHub App tokens that include a refresh_token.

###### Parameters

###### refreshToken

`string`

The refresh token from the original auth flow

###### signal?

`AbortSignal`

Optional abort signal

###### Returns

`Promise`\<[`CopilotAuthToken`](#copilotauthtoken)\>

Fresh CopilotAuthToken with new access and refresh tokens

###### Throws

If the refresh request fails

###### Example

```ts
const auth = new CopilotAuth();
const newToken = await auth.refreshToken(oldToken.refreshToken!);
```

##### startDeviceFlow()

> **startDeviceFlow**(`options?`): `Promise`\<[`DeviceFlowResult`](#deviceflowresult)\>

Defined in: [auth/copilot-auth.ts:81](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/copilot-auth.ts#L81)

Start the GitHub Device Flow.
Returns a device code result with user code, verification URL,
and a `waitForToken()` function that polls until the user authorizes.

###### Parameters

###### options?

Optional scopes and abort signal

###### scopes?

`string`

###### signal?

`AbortSignal`

###### Returns

`Promise`\<[`DeviceFlowResult`](#deviceflowresult)\>

Device flow result with user code, verification URL, and waitForToken poller

###### Throws

If the device code request fails

###### Throws

If the device code expires before user authorizes

###### Throws

If the user denies access

###### Example

```ts
const auth = new CopilotAuth();
const { userCode, verificationUrl, waitForToken } = await auth.startDeviceFlow();
console.log(`Open ${verificationUrl} and enter code: ${userCode}`);
const token = await waitForToken();
```

***

### DeviceCodeExpiredError

Defined in: [auth/types.ts:147](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L147)

Device code expired before user authorized

#### Extends

- [`AuthError`](#autherror)

#### Constructors

##### Constructor

> **new DeviceCodeExpiredError**(): [`DeviceCodeExpiredError`](#devicecodeexpirederror)

Defined in: [auth/types.ts:148](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L148)

###### Returns

[`DeviceCodeExpiredError`](#devicecodeexpirederror)

###### Overrides

[`AuthError`](#autherror).[`constructor`](#constructor-1)

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [errors.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L21)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AuthError`](#autherror).[`code`](#code-1)

##### httpStatus?

> `readonly` `optional` **httpStatus**: `number`

Defined in: [errors.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L25)

HTTP status code hint for error classification

###### Inherited from

[`AuthError`](#autherror).[`httpStatus`](#httpstatus-1)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L23)

Whether this error is safe to retry

###### Inherited from

[`AuthError`](#autherror).[`retryable`](#retryable-1)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L36)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AuthError`](#autherror).[`is`](#is-1)

***

### TokenExchangeError

Defined in: [auth/types.ts:166](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L166)

Token exchange or refresh failed.

#### Param

Error description

#### Param

Standard ErrorOptions (e.g. cause)

#### Extends

- [`AuthError`](#autherror)

#### Constructors

##### Constructor

> **new TokenExchangeError**(`message`, `options?`): [`TokenExchangeError`](#tokenexchangeerror)

Defined in: [auth/types.ts:167](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L167)

###### Parameters

###### message

`string`

###### options?

`ErrorOptions`

###### Returns

[`TokenExchangeError`](#tokenexchangeerror)

###### Overrides

[`AuthError`](#autherror).[`constructor`](#constructor-1)

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [errors.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L21)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AuthError`](#autherror).[`code`](#code-1)

##### httpStatus?

> `readonly` `optional` **httpStatus**: `number`

Defined in: [errors.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L25)

HTTP status code hint for error classification

###### Inherited from

[`AuthError`](#autherror).[`httpStatus`](#httpstatus-1)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L23)

Whether this error is safe to retry

###### Inherited from

[`AuthError`](#autherror).[`retryable`](#retryable-1)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L36)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AuthError`](#autherror).[`is`](#is-1)

***

### TokenRefreshManager

Defined in: [auth/refresh-manager.ts:116](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L116)

Background token refresh manager with event emission and retry logic.

Lifecycle: `new` → `start()` → (auto-refreshes) → `stop()` or `dispose()`

#### Constructors

##### Constructor

> **new TokenRefreshManager**(`options`): [`TokenRefreshManager`](#tokenrefreshmanager)

Defined in: [auth/refresh-manager.ts:135](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L135)

###### Parameters

###### options

[`TokenRefreshOptions`](#tokenrefreshoptions)

###### Returns

[`TokenRefreshManager`](#tokenrefreshmanager)

#### Accessors

##### isDisposed

###### Get Signature

> **get** **isDisposed**(): `boolean`

Defined in: [auth/refresh-manager.ts:169](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L169)

Whether the manager has been disposed

###### Returns

`boolean`

##### isRunning

###### Get Signature

> **get** **isRunning**(): `boolean`

Defined in: [auth/refresh-manager.ts:164](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L164)

Whether the manager is currently running

###### Returns

`boolean`

##### token

###### Get Signature

> **get** **token**(): [`AuthToken`](#authtoken)

Defined in: [auth/refresh-manager.ts:159](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L159)

Current token managed by this instance

###### Returns

[`AuthToken`](#authtoken)

#### Methods

##### dispose()

> **dispose**(): `void`

Defined in: [auth/refresh-manager.ts:205](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L205)

Stop and clean up all resources

###### Returns

`void`

##### off()

> **off**\<`K`\>(`event`, `listener`): `this`

Defined in: [auth/refresh-manager.ts:152](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L152)

Remove an event listener

###### Type Parameters

###### K

`K` *extends* keyof [`TokenRefreshEvents`](#tokenrefreshevents)

###### Parameters

###### event

`K`

###### listener

[`TokenRefreshEvents`](#tokenrefreshevents)\[`K`\]

###### Returns

`this`

##### on()

> **on**\<`K`\>(`event`, `listener`): `this`

Defined in: [auth/refresh-manager.ts:145](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L145)

Register an event listener

###### Type Parameters

###### K

`K` *extends* keyof [`TokenRefreshEvents`](#tokenrefreshevents)

###### Parameters

###### event

`K`

###### listener

[`TokenRefreshEvents`](#tokenrefreshevents)\[`K`\]

###### Returns

`this`

##### start()

> **start**(): `void`

Defined in: [auth/refresh-manager.ts:178](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L178)

Start automatic refresh scheduling.
If the token is already expired, emits "expired" immediately.
If the token has no expiresIn, does nothing (long-lived token).

###### Returns

`void`

##### stop()

> **stop**(): `void`

Defined in: [auth/refresh-manager.ts:186](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L186)

Stop automatic refresh (can be restarted with start())

###### Returns

`void`

##### updateToken()

> **updateToken**(`token`): `void`

Defined in: [auth/refresh-manager.ts:195](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L195)

Update the managed token (e.g. after manual refresh).
Reschedules automatic refresh if running.

###### Parameters

###### token

[`AuthToken`](#authtoken)

###### Returns

`void`

## Interfaces

### AuthToken

Defined in: [auth/types.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L20)

Base auth token returned by all auth providers.

#### Example

```ts
import type { AuthToken } from "@witqq/agent-sdk/auth";

const token: AuthToken = {
  accessToken: "gho_abc123...",
  tokenType: "bearer",
  obtainedAt: Date.now(),
};
```

#### Extended by

- [`CopilotAuthToken`](#copilotauthtoken)
- [`ClaudeAuthToken`](#claudeauthtoken)

#### Properties

##### accessToken

> **accessToken**: `string`

Defined in: [auth/types.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L22)

The access token string

##### expiresIn?

> `optional` **expiresIn**: `number`

Defined in: [auth/types.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L26)

Seconds until token expires (undefined = long-lived)

##### obtainedAt

> **obtainedAt**: `number`

Defined in: [auth/types.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L28)

Timestamp when the token was obtained

##### tokenType

> **tokenType**: `string`

Defined in: [auth/types.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L24)

Token type (e.g. "bearer")

***

### ClaudeAuthToken

Defined in: [auth/types.ts:70](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L70)

Claude-specific token (OAuth+PKCE, expires in 8h).

#### Example

```ts
import type { ClaudeAuthToken } from "@witqq/agent-sdk/auth";

const token: ClaudeAuthToken = {
  accessToken: "sk-ant-oat01-...",
  tokenType: "bearer",
  expiresIn: 28800,
  obtainedAt: Date.now(),
  refreshToken: "sk-ant-rt01-...",
  scopes: ["user:inference", "user:profile"],
};
```

#### Extends

- [`AuthToken`](#authtoken)

#### Properties

##### accessToken

> **accessToken**: `string`

Defined in: [auth/types.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L22)

The access token string

###### Inherited from

[`AuthToken`](#authtoken).[`accessToken`](#accesstoken)

##### expiresIn?

> `optional` **expiresIn**: `number`

Defined in: [auth/types.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L26)

Seconds until token expires (undefined = long-lived)

###### Inherited from

[`AuthToken`](#authtoken).[`expiresIn`](#expiresin)

##### obtainedAt

> **obtainedAt**: `number`

Defined in: [auth/types.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L28)

Timestamp when the token was obtained

###### Inherited from

[`AuthToken`](#authtoken).[`obtainedAt`](#obtainedat)

##### refreshToken

> **refreshToken**: `string`

Defined in: [auth/types.ts:72](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L72)

Refresh token for obtaining new access tokens

##### scopes

> **scopes**: `string`[]

Defined in: [auth/types.ts:74](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L74)

OAuth scopes granted

##### tokenType

> **tokenType**: `string`

Defined in: [auth/types.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L24)

Token type (e.g. "bearer")

###### Inherited from

[`AuthToken`](#authtoken).[`tokenType`](#tokentype)

***

### CopilotAuthToken

Defined in: [auth/types.ts:46](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L46)

Copilot-specific token (GitHub OAuth, long-lived).

#### Example

```ts
import type { CopilotAuthToken } from "@witqq/agent-sdk/auth";

const token: CopilotAuthToken = {
  accessToken: "gho_abc123...",
  tokenType: "bearer",
  obtainedAt: Date.now(),
  login: "octocat",
};
```

#### Extends

- [`AuthToken`](#authtoken)

#### Properties

##### accessToken

> **accessToken**: `string`

Defined in: [auth/types.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L22)

The access token string

###### Inherited from

[`AuthToken`](#authtoken).[`accessToken`](#accesstoken)

##### expiresIn?

> `optional` **expiresIn**: `number`

Defined in: [auth/types.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L26)

Seconds until token expires (undefined = long-lived)

###### Inherited from

[`AuthToken`](#authtoken).[`expiresIn`](#expiresin)

##### login?

> `optional` **login**: `string`

Defined in: [auth/types.ts:48](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L48)

GitHub user login associated with the token

##### obtainedAt

> **obtainedAt**: `number`

Defined in: [auth/types.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L28)

Timestamp when the token was obtained

###### Inherited from

[`AuthToken`](#authtoken).[`obtainedAt`](#obtainedat)

##### refreshToken?

> `optional` **refreshToken**: `string`

Defined in: [auth/types.ts:50](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L50)

Refresh token for obtaining new access tokens (present when GitHub App has expiring tokens)

##### tokenType

> **tokenType**: `string`

Defined in: [auth/types.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L24)

Token type (e.g. "bearer")

###### Inherited from

[`AuthToken`](#authtoken).[`tokenType`](#tokentype)

***

### DeviceFlowResult

Defined in: [auth/types.ts:92](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L92)

Result of initiating a GitHub Device Flow.

#### Example

```ts
import { CopilotAuth } from "@witqq/agent-sdk/auth";

const auth = new CopilotAuth();
const { userCode, verificationUrl, waitForToken } = await auth.startDeviceFlow();
console.log(`Open ${verificationUrl} and enter code: ${userCode}`);
const token = await waitForToken();
```

#### Properties

##### userCode

> **userCode**: `string`

Defined in: [auth/types.ts:94](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L94)

The code the user must enter at the verification URL

##### verificationUrl

> **verificationUrl**: `string`

Defined in: [auth/types.ts:96](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L96)

URL where the user enters the code

##### waitForToken()

> **waitForToken**: (`signal?`) => `Promise`\<[`CopilotAuthToken`](#copilotauthtoken)\>

Defined in: [auth/types.ts:98](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L98)

Polls GitHub until user authorizes; resolves with token

###### Parameters

###### signal?

`AbortSignal`

###### Returns

`Promise`\<[`CopilotAuthToken`](#copilotauthtoken)\>

***

### OAuthFlowOptions

Defined in: [auth/types.ts:104](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L104)

Options for starting a Claude OAuth flow

#### Properties

##### redirectUri?

> `optional` **redirectUri**: `string`

Defined in: [auth/types.ts:106](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L106)

The redirect URI registered with the OAuth app

##### scopes?

> `optional` **scopes**: `string`

Defined in: [auth/types.ts:108](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L108)

OAuth scopes to request (defaults to user:profile user:inference)

***

### OAuthFlowResult

Defined in: [auth/types.ts:126](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L126)

Result of initiating a Claude OAuth flow.

#### Example

```ts
import type { OAuthFlowResult } from "@witqq/agent-sdk/auth";

const result: OAuthFlowResult = {
  authorizeUrl: "https://claude.ai/oauth/authorize?...",
  completeAuth: async (code) => ({ ... }),
};
// Open result.authorizeUrl in browser, get code from redirect
const token = await result.completeAuth(code);
```

#### Properties

##### authorizeUrl

> **authorizeUrl**: `string`

Defined in: [auth/types.ts:128](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L128)

URL to open in browser for user authorization

##### completeAuth()

> **completeAuth**: (`codeOrUrl`) => `Promise`\<[`ClaudeAuthToken`](#claudeauthtoken)\>

Defined in: [auth/types.ts:130](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/types.ts#L130)

Exchange the authorization code (or full redirect URL) for tokens

###### Parameters

###### codeOrUrl

`string`

###### Returns

`Promise`\<[`ClaudeAuthToken`](#claudeauthtoken)\>

***

### TokenRefreshEvents

Defined in: [auth/refresh-manager.ts:67](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L67)

Events emitted by TokenRefreshManager

#### Properties

##### disposed()

> **disposed**: () => `void`

Defined in: [auth/refresh-manager.ts:75](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L75)

Emitted when manager is disposed

###### Returns

`void`

##### error()

> **error**: (`error`, `attempt`) => `void`

Defined in: [auth/refresh-manager.ts:71](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L71)

Emitted when refresh attempt failed (may retry)

###### Parameters

###### error

`Error`

###### attempt

`number`

###### Returns

`void`

##### expired()

> **expired**: () => `void`

Defined in: [auth/refresh-manager.ts:73](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L73)

Emitted when token expired and could not be refreshed

###### Returns

`void`

##### refreshed()

> **refreshed**: (`token`) => `void`

Defined in: [auth/refresh-manager.ts:69](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L69)

Emitted when token was successfully refreshed

###### Parameters

###### token

[`AuthToken`](#authtoken)

###### Returns

`void`

***

### TokenRefreshOptions

Defined in: [auth/refresh-manager.ts:79](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L79)

Configuration for TokenRefreshManager

#### Properties

##### maxRetries?

> `optional` **maxRetries**: `number`

Defined in: [auth/refresh-manager.ts:95](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L95)

Maximum retry attempts on refresh failure. Default: 3

##### minDelayMs?

> `optional` **minDelayMs**: `number`

Defined in: [auth/refresh-manager.ts:103](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L103)

Minimum schedule delay in ms (prevents scheduling in the past). Default: 1000

##### refresh()

> **refresh**: (`token`) => `Promise`\<[`AuthToken`](#authtoken)\>

Defined in: [auth/refresh-manager.ts:86](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L86)

Function that performs the actual token refresh.
Receives the current token and returns a new one.

###### Parameters

###### token

[`AuthToken`](#authtoken)

###### Returns

`Promise`\<[`AuthToken`](#authtoken)\>

##### refreshThreshold?

> `optional` **refreshThreshold**: `number`

Defined in: [auth/refresh-manager.ts:91](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L91)

Fraction of token lifetime at which to trigger refresh (0-1).
Default: 0.8 (refresh at 80% of lifetime, i.e. with 20% remaining)

##### retryDelayMs?

> `optional` **retryDelayMs**: `number`

Defined in: [auth/refresh-manager.ts:99](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L99)

Base delay between retries in ms. Exponential backoff applied. Default: 1000

##### token

> **token**: [`AuthToken`](#authtoken)

Defined in: [auth/refresh-manager.ts:81](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/auth/refresh-manager.ts#L81)

Current token with expiresIn and obtainedAt
