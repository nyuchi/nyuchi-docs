# Nyuchi API — Authentication (agent reference)

> This file is served directly by the gateway at
> `https://api.nyuchi.com/AUTH.md` (`text/markdown`, unauthenticated) —
> fetch it directly (`curl https://api.nyuchi.com/AUTH.md`) rather than
> parsing the rendered docs page. It's also mirrored at
> [docs.nyuchi.com/AUTH.md](https://docs.nyuchi.com/AUTH.md) and rendered
> as prose at
> [docs.nyuchi.com/api/authentication](https://docs.nyuchi.com/api/authentication)
> and [docs.nyuchi.com/api/api-keys](https://docs.nyuchi.com/api/api-keys)
> — this file in `nyuchi/nyuchi-api` (formerly `nyuchi/api-gateway`) is the source; edit it here, not on
> the docs site, so it can never drift from the code it describes.

## Three credential types — don't conflate them

| Credential                                                            | Identifies                                | Has a secret?     | Use for                                                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Platform JWT (`Authorization: Bearer …`)                              | A signed-in person                        | —                 | Acting on behalf of a user (first-party services get one by token exchange)                                       |
| API key (`X-Client-Id`/`X-Client-Secret`, `nyk_...`/`nys_...`)        | Your application                          | Yes               | Server-to-server calls to product namespaces (news, weather, commerce, …)                                         |
| Machine token (`Authorization: Bearer …`, from `POST /v1/auth/token`) | Your application                          | Exchanged for one | The same as an API key, in standard OAuth `client_credentials` form — **preferred**                               |
| Sign-in app (`client_id` only, `nya_...`)                             | Your application, for login purposes only | No                | Telling `GET /v1/auth/workos/login` which `redirect_uris` to trust — nothing else                                 |
| Agent token (`Authorization: Bearer …`, `nyag_...` client)            | An agent registered under a workspace     | Exchanged for one | Minting and managing that workspace's external keys — [For agents](#for-agents-minting-api-keys-without-a-person) |

An API key and a machine token are the **same credential**, not two — the
token is what you get when you exchange the key pair at
`POST /v1/auth/token`, and it carries identical scopes and limits. Use the
token form; the raw header pair stays supported for simple scripts.

### Device tokens (`/v1/devices`)

A household display (Mukoko Home on a TV, tablet or desktop) never holds a
person's token. It pairs through the OAuth 2.0 Device Authorization Grant
(RFC 8628) and receives its **own** credentials:

- an access token, a gateway-signed JWT with `aud: "device"`, `sub` = the
  device id, `entity_id` = the household (a `family` entity), `sid` = the
  device session and `scope: "household:display"`, valid 15 minutes
  (`DEVICE_JWT_EXPIRY_SECONDS`);
- an opaque refresh token, stored only as a SHA-256 hash and **rotated on
  every use**. Presenting a refresh token that was already rotated away
  revokes the session (reuse detection).

`verify_platform_jwt` and `verify_machine_jwt` both reject the device
audience, so a device token gets `401` everywhere except the routes that ask
for `require_device` (`/v1/devices/me*`). Each of those re-reads the device
and its session, so revoking a device takes effect at once.

The protocol endpoints (`POST /v1/devices/authorization`,
`POST /v1/devices/token`) take an internal credential only: id-worker is the
public front door and forwards with its internal key (scoped `devices`).
Pairing, listing, renaming and revoking are person routes under
entity-membership RBAC: any active member of the household may pair and
list; a household guardian (or founder) or the person who paired the device
may rename or revoke it. No WorkOS permission or claim is involved.

### Internal namespaces (`/v1/admin/*`, `/v1/pay/*`)

A handful of namespaces are classified `internal` in
`gateway/lib/api_catalog.py` (modeled on the Google Cloud console's API
library — you enable the APIs you want and the key carries those slugs as
scopes). An **external** key can never reach them, no matter what scopes it
was provisioned with.

A **person** reaches them with a **WorkOS permission** — see
[Console permissions](#console-permissions-admin-pay-and-review-for-people) below. That is how
the new console (nyuchi/nyuchi-platform#330) calls them on the signed-in
person's behalf.

A **machine** reaches them with an **internal-classified** key
(`keyType: internal`) — the same `nyk_`/`nys_` credential shape as
everything above, so there is nothing new to implement.

The legacy `X-Internal-Key` shared secret is still accepted where the
operator has configured one, for the legacy Next.js console only. It is
**deprecated**: it has no scopes, no owner and no rotation story, every
response to it carries `Deprecation: true`, and it is removed together with
the legacy console (the #330 exit gate: "Nothing still uses
`INTERNAL_API_KEY`").

Without a console permission, this gate **fails closed**. If you present neither
an internal key nor a valid `X-Internal-Key`, you get `401` — even if your
platform JWT is perfectly good and the route's own permission check would
have passed.

### Who counts as a platform admin (`/v1/admin/*`)

This section describes the **legacy** path (an internal credential plus a
membership), which the legacy console and Mukoko Kweli's dashboard still
use. A caller with a console token is judged on its WorkOS permissions instead.

The internal-credential gate above is only the first of two layers. Every
`/v1/admin/*` endpoint additionally requires the caller to be a **platform
administrator**, and that is decided from `entity.memberships` — the
platform's authz source of truth — never from a JWT claim:

> **Admin** = an **active** membership (`isActive: true`) on the **Nyuchi
> Africa** organization entity whose `membershipRole` is `founder` or
> `admin`.

Consequences worth knowing before you debug a `403`:

- **There is no "admin" role claim, and adding one grants nothing.** Platform
  JWTs are minted with `role: "authenticated"` and machine tokens with
  `role: "machine"`; neither is consulted for admin. Admin is granted and
  revoked by adding/deactivating a membership row, so it is auditable and
  revocable in one place.
- **A machine credential can never be an admin.** API keys, the
  `client_credentials` token, and `X-Client-Id`/`X-Client-Secret` are all
  rejected by the admin check with `403` — admin is granted on the basis of
  being a specific human, not of holding a service key. Note the internal-key
  gate and the admin check are different layers: an internal key satisfies the
  first and still fails the second.
- **Being the entity's `founderPersonId` is not sufficient** on its own (it is
  for ordinary workspace management); platform admin needs the explicit
  membership row.
- **Everything fails closed.** No membership, an inactive membership, a
  non-manager role, an unresolvable admin entity, or an unconfigured MongoDB
  all deny (`403`, or `503` when Mongo is unconfigured).

**Operators** — the entity is configured, not hardcoded:

| Env var                  | Meaning                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NYUCHI_ADMIN_ENTITY_ID` | The `entity.entities._id` of the Nyuchi Africa entity. Same variable name the sibling `nyuchi/mukoko-events-admin` app uses for exactly this. Optional. |

When it is unset the entity is resolved by its `slug` (`nyuchi-africa`). When
it can be resolved by neither, **every** admin request is denied — including
one from a genuine admin — with a `403` naming the missing variable.

## Console permissions: admin, pay and review for people

The new console is Astro pages server-rendered through a Rust backend
(nyuchi/nyuchi-platform#330). The backend calls this API **on the signed-in
person's behalf** and holds no key that grants admin, pay or review by
itself, so those routes authorise that person by **WorkOS permission**. The
code is `gateway/lib/console_permissions.py`.

### WorkOS is the source of truth

Every route asks for a **permission**, never a role. A role is a bundle of
permissions, and WorkOS manages both. The API keeps no role-to-permission
map. It reads the role slugs on the person's **active** membership in the
**Nyuchi Africa** organization (`NYUCHI_WORKOS_ORG_ID`), then the permissions
WorkOS attaches to those roles. Only these `console:*` permissions count:

| Permission                    | Grants                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `console:admin-read`          | `/v1/admin/*` reads; viewing any entity's members                                                        |
| `console:admin-write`         | `/v1/admin/*` writes, merges and changing a person's role; changing any entity's members (with a reason) |
| `console:review`              | Every review pipeline; reading and editing records other people own                                      |
| `console:verification-review` | Deciding representative claims                                                                           |
| `console:pay`                 | `/v1/pay/*`                                                                                              |
| `console:api-keys-mint`       | Minting, rotating or revoking an internal API key                                                        |

The roles, as configured in WorkOS (Mukoko Account → Production):

| WorkOS role             | Permissions                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `admin`                 | All six                                                               |
| `platform-team`         | `console:admin-read`, `console:review`, `console:verification-review` |
| `verification-reviewer` | `console:verification-review`                                         |
| `pay-operator`          | `console:pay`                                                         |

To change who can do what, change a role's permissions or a person's roles
in WorkOS. Nothing in this API changes. Other permissions on the same roles
(`mongodb:access`, `fundi:admin`, …) are ignored here.

The AuthKit access token has its own `permissions` claim. The API doesn't
use it, because it describes whichever organization that session is in, not
necessarily Nyuchi Africa.

### Which route needs which permission

"Re-checked" means WorkOS is asked again before the route runs (see below).

| Route                                                                                                                                                                                                          | Permission                         | Re-checked |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------- |
| `GET /v1/admin/stats`, `GET /v1/admin/users`, `GET /v1/admin/profiles/{user_id}`, `GET /v1/admin/events`, `GET /v1/admin/analytics`                                                                            | `console:admin-read`               | no         |
| `PUT /v1/admin/profiles/{user_id}`, `PATCH /v1/admin/users/{user_id}`, `POST /v1/admin/ubuntu-points/{user_id}`                                                                                                | `console:admin-write`              | yes        |
| `POST /v1/admin/families/merge`, `POST /v1/admin/persons/merge`, `PUT /v1/admin/persons/{person_id}/role`                                                                                                      | `console:admin-write`              | yes        |
| `POST /v1/admin/claims/{claim_id}/decide`                                                                                                                                                                      | `console:verification-review`      | yes        |
| `GET /v1/pay/status`, `GET /v1/pay/wallet/`, `GET /v1/pay/wallet/transactions`, `GET /v1/pay/tokens/…`, `GET /v1/pay/gateway/providers`                                                                        | `console:pay`                      | no         |
| `POST /v1/pay/gateway/deposit`, `POST /v1/pay/gateway/withdraw`                                                                                                                                                | `console:pay`                      | yes        |
| `POST /v1/api-keys` with `key_type: internal`; `POST /v1/api-keys/{key_id}/rotate` and `DELETE /v1/api-keys/{key_id}` on an internal key                                                                       | `console:api-keys-mint`            | yes        |
| Review decisions: `PATCH /v1/pipeline/submissions/{id}`, `PATCH /v1/applications/{experts,businesses}/{id}`, `POST /v1/{content,directory,places}/{id}/{approve,reject}`                                       | `console:review`                   | yes        |
| Editing someone else's record: `PATCH`/`DELETE /v1/content/{id}`, `PATCH`/`DELETE /v1/directory/{id}`, `PATCH /v1/places/{id}`, `PATCH /v1/travel/businesses/{id}`. The owner needs no permission (see below). | `console:review`                   | yes        |
| Reading someone else's record: `GET /v1/pipeline/submissions/{id}`, `GET /v1/applications/experts/{id}`, `GET /v1/places/{id}/contributions` (the owner needs no permission)                                   | `console:review`                   | no         |
| Staff "see all" lists: `GET /v1/pipeline/pending`, `GET /v1/pipeline/submissions`, `GET /v1/applications/{experts,businesses}`, `GET /v1/directory` (private entities), `GET /v1/content` (unpublished work)   | `console:review` widens them       | no         |
| Another entity's members: `GET /v1/organization/{id}/members` when not a member (a staff view, audited)                                                                                                        | `console:admin-read` (or `-write`) | no         |
| Changing another entity's members: `POST`, `PATCH /v1/organization/{id}/members[/{person_id}]`, `DELETE …/members/{person_id}`, with a `reason` in the JSON body                                               | `console:admin-write`              | yes        |

**Who "the owner" is** is decided by the record and, where an entity owns
it, by that entity's memberships (`gateway/lib/entities.py`), never by a
WorkOS permission. For a place, the owner is the person in `ownerEntityId`
(the legacy shape) or, once the place is claimed and `ownerEntityId` is an
entity, a manager of that entity: its founding person (`founderPersonId`), a
`founder` or `admin` membership, or a family guardian (`is_entity_manager`).
A directory listing is an `entity.entities` document, so its managers are
the same people: they edit it, but only its founders (`founderPersonId` or a
`founder` membership) delete it. `/v1/directory/{id}` writes reach only a
business listing (an `organization` with `schemaOrgType` `LocalBusiness`,
never the platform admin entity); any other entity is `404` there, for staff
too. Publishing or featuring a place and verifying a listing stay review
decisions, whoever asks. An owner reads a place's edit suggestions without
the suggester's person id.

There is no super-permission. The `admin` role passes every row because
WorkOS gives it all six. The review routes used to compare the `role` claim
to `admin`, `reviewer` or `moderator`, values nothing ever minted, so every
review action answered `403`. A bare `role` claim now grants nothing.

To add an operator route, use `Depends(require_permission(...))` with one of
the policies in `gateway/lib/console_permissions.py` (`ADMIN_READ`,
`ADMIN_WRITE`, `CLAIM_REVIEW`, `PAY`, `REVIEW`, `API_KEYS_MINT`). For a gate
inside other logic ("the owner, or a reviewer"), call
`require_console_permission(request, current_user, *REVIEW)`. For a staff
"see all" read, use `holds_permission` plus `audit_staff_view`. Then add the
route to this table and to `tests/test_console_permissions.py` or
`tests/test_review_permissions.py`. A new permission goes in
`CONSOLE_PERMISSIONS` and `PERMISSION_NAMESPACES`, and is created in WorkOS
with the same slug.

### How a permission reaches a request

1. The console backend signs the person in with AuthKit. It then exchanges
   the AuthKit access token at `POST /v1/auth/token` (the
   [token exchange](#first-party-edge-services-acting-for-a-person-token-exchange))
   with **its own internal key**. That key's `nyk_` client id must be listed
   in `CONSOLE_BACKEND_CLIENT_IDS`.
   - Like every exchanging key, it needs the `identity` scope, plus the
     person namespaces the console serves. That includes the namespaces the
     review routes live in (`content`, `directory`, `places`, `travel`,
     `applications`), and `circles` and `campfire`, which are now in the API
     catalogue.
   - For an organisation's own dashboards it also needs `analytics`,
     `insights` and `entities`. They are person namespaces (public in the
     catalogue, not non-delegable), so the exchange grants them as soon as
     the key holds them and the console asks for them (or sends no
     `scope`); nothing else is needed.
   - It must **not** hold `admin`, `pay`, `api-keys`, `auth-apps` or
     `pipeline`.
2. For that key only, the exchange asks WorkOS for the person's console
   permissions and puts them in the token it issues. If WorkOS can't answer,
   the exchange returns `503 temporarily_unavailable`; it never guesses.
3. The token's `scope` gains operator namespaces only as far as those
   permissions reach. A person with no console permission gets the same
   token as before, with none of these.

   | Permission                                         | Adds to `scope` |
   | -------------------------------------------------- | --------------- |
   | `admin-read`, `admin-write`, `verification-review` | `admin`         |
   | `review`                                           | `pipeline`      |
   | `pay`                                              | `pay`           |
   | `api-keys-mint`                                    | `api-keys`      |

   `api-keys` is also on every console token, whatever its permissions
   (nyuchi/api-gateway#152). It is self-service: each route there checks the
   person's own role in the workspace that owns the key. Any member lists
   the workspace's keys; a manager (an organization founder or admin, or a
   family guardian) creates, rotates and revokes its **external** keys; an
   **internal** key also needs `console:api-keys-mint`. Every create, rotate
   and revoke writes a `developer.api_key` audit line with ids only, and a
   `client_secret` is returned once, with `Cache-Control: no-store`.

   `auth-apps` ("Sign in with Nyuchi" registrations) is on every console
   token for the same reason (#268): any member of the workspace lists its
   sign-in apps, and its managers register them, change their redirect URIs
   and revoke them. There is no internal tier, so no permission is involved.
   Both stay non-delegable for every other key.

4. The backend calls the API with that token as the bearer, **without** its
   key pair. Sending the key too would make it bound the namespaces, and the
   key holds none of these.
5. On a re-checked route, the gateway asks WorkOS again.
   - The membership is always read live, so a role removed from the person
     stops the write at once.
   - Role definitions are cached for 60 seconds, so a permission removed
     from a role takes effect within a minute.
   - A refusal is `403` ("Your WorkOS permissions have changed"). WorkOS not
     answering is `503`: retry.
   - Reads trust the token. It lives at most `TOKEN_EXCHANGE_MAX_SECONDS`
     and never past the AuthKit access token, so permissions are re-read on
     every refresh.

**Claims** on a console token, in addition to the exchange's `scope` and
`act`:

| Claim                 | Value                                                        |
| --------------------- | ------------------------------------------------------------ |
| `console_permissions` | Sorted list, e.g. `["console:admin-read", "console:review"]` |
| `console_org`         | The WorkOS organization id the permissions were read from    |
| `workos_user_id`      | The WorkOS user they were read for, used by the re-check     |

A token whose `console_org` isn't the currently configured organization
carries no permission.

**No other path puts a permission in a token.** A sign-in token from
`/v1/auth/workos/callback` never carries one. That endpoint serves every
registered sign-in app, and a token held by one of them must never open the
operator surfaces.

### Answers

| Situation                                                | Status                                        |
| -------------------------------------------------------- | --------------------------------------------- |
| No credential                                            | `401`                                         |
| Invalid or expired bearer token                          | `401`                                         |
| Console token without the route's namespace in `scope`   | `403` (`not scoped for …`)                    |
| Token without the required permission                    | `403`, `detail.error = "permission_required"` |
| Permission removed in WorkOS since the token was issued  | `403` on a re-checked route                   |
| WorkOS unreachable on a re-check                         | `503`                                         |
| Any other caller on `/v1/admin`, `/v1/pay`, internal key | the legacy checks, as before #330             |

A console token is judged on its permissions alone. It never falls back to
the legacy checks. The review routes have no legacy path.

### Legacy callers, until the Next.js console is removed

Everything that passed before still passes, unchanged:

- **`/v1/admin/*` in `gateway/routers/admin.py`:** an internal key or
  `X-Internal-Key`, plus an admin membership (see
  [above](#who-counts-as-a-platform-admin-v1admin)).
- **`POST /v1/admin/claims/{claim_id}/decide` and
  `PUT /v1/admin/persons/{person_id}/role`:** an admin membership alone.
  Mukoko Kweli's dashboard forwards the reviewer's own token.
- **`/v1/pay/*`:** an internal key or `X-Internal-Key`.
- **Minting an internal API key:** an internal key or `X-Internal-Key`, plus
  being a manager of the key's workspace, as for every key.

Responses to `X-Internal-Key` carry `Deprecation: true`.

### Audit

Every request to these routes, allowed or denied, writes one JSON line to
the `nyuchi.audit` log:

```json
{
  "event": "console.privileged_action",
  "outcome": "allowed",
  "via": "permission",
  "actor": "<person id>",
  "permissions": ["console:pay"],
  "client_id": "nyk_console…",
  "method": "POST",
  "route": "/v1/pay/gateway/deposit",
  "target": { "organization_id": "<entity id>" },
  "required": ["console:pay"],
  "recheck": true
}
```

- **`via`** is one of `permission`, `membership`, `x_internal_key`,
  `x_internal_key+membership`, `internal_api_key`,
  `internal_api_key+membership` or `unconfigured_dev`.
- **A denial** carries a `reason` and a `status`. The reason is one of
  `permission_missing`, `permission_revoked`, `recheck_unavailable`,
  `invalid_token`, `no_permission` or `legacy_refused`.
- **A staff "see all" read** carries `reason: staff_view`.
- **`target`** holds ids only: the path parameters and any `*_id` field of
  the JSON body.
- **Never logged:** tokens, emails, names, free-text fields and query
  strings.

### Operators

| Env var                      | Meaning                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `NYUCHI_WORKOS_ORG_ID`       | The WorkOS organization id of Nyuchi Africa. If unset, no token carries a permission and the console exchange is `503`. |
| `CONSOLE_BACKEND_CLIENT_IDS` | Comma-separated `nyk_` client ids of the console backend's key(s). If unset, no exchange carries permissions.           |

`WORKOS_API_KEY` must be able to list organization memberships and the
organization's roles (`GET /authorization/organizations/{id}/roles`).
Permissions are granted in WorkOS, on roles. Nothing in this API grants or
stores one.

## Entity user management: `/v1/organization/{id}/members`

Each organization, community and place-owner entity manages its own people
(nyuchi/nyuchi-platform#384). Access is the entity's own memberships
(`entity.memberships`, data-infra's canonical `Membership`), read live on
every request; nothing is cached and no WorkOS permission or claim is
involved for members. A family's people are family relations, managed at
`/v1/family`; a family id here is `400`. The rules are in
`gateway/lib/entity_members.py`.

| Route                                        | Who                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /v1/organization/{id}/members`          | Any active member (read-only unless founder or admin). Staff with `console:admin-read`, audited.         |
| `POST /v1/organization/{id}/members`         | Founder or admin, with a role no higher than their own. Staff with `console:admin-write` and a `reason`. |
| `PATCH /v1/organization/{id}/members/{pid}`  | Founder or admin, on a member ranked no higher, to a role no higher. Staff as above.                     |
| `DELETE /v1/organization/{id}/members/{pid}` | The member themself; founder or admin on a member ranked no higher. Staff as above.                      |

- **Rank:** founder > admin > manager > representative > contributor >
  member > follower > kin. Nobody grants a role above their own (an admin
  can make an admin, never a founder), and nobody changes or removes a
  member ranked above them (an admin cannot touch a founder). Only
  data-infra's `MembershipRole` values are accepted (legacy `owner` and
  `employee` are read as founder and manager).
- **Never leaderless:** the last active founder cannot be removed or demoted,
  and neither can the last active founder-or-admin, including by
  themselves. Counted from active memberships. A concurrent change that
  would leave none is undone (`409`).
- **`founderPersonId`** counts as a founder membership only when that person
  has no membership record for the entity at all (an entity created before
  memberships were written). Once a membership exists it alone decides, and
  `founderPersonId` never counts towards the guard.
- **Removal** ends the membership (`isActive: false`, `endedAt`); it is never
  deleted. A role change resets `permissions` to the new role's defaults
  unless `permissions` is sent with it. Permissions are entity-scoped: a
  namespaced value (`console:…`) is `422`.
- **Staff** act with founder rank, under the same guards, and never on
  their own membership (`403`). A write needs
  `console:admin-write`, re-checked with WorkOS, and a non-empty `reason`
  (up to 1,000 characters) in the JSON body, or `422`.
- **Audit:** every write attempt on a member entity, allowed or refused, writes one `entity.membership`
  line to `nyuchi.audit`: `action` (`added`, `role_changed`, `removed`),
  `outcome`, `actor`, `entity_id`, `target_person_id`, `old_role`,
  `new_role`, `via` (`membership`, `self` or `staff`) and, for a refusal,
  `status` and a `reason` code (`not_entity_manager`, `role_above_actor`,
  `target_above_actor`, `last_founder`, `last_manager`, `last_manager_race`,
  `reason_required`, `staff_permission_refused`, `platform_permission`, …).
  Ids and role names only.
- **The audit record** is a `platform.auditLog` document
  (`eventType` `entity.membership.<action>`) written **ahead** of every
  change with `details.state: pending`, then set to `applied`, or to
  `undone` with a code when the change does not stand (a lost race, a member
  removed meanwhile, a failed write). The API has no Mongo transactions, so
  this is how no change exists without its record and no failure leaves an
  `applied` one; a record left `pending` means the process stopped
  mid-change. It holds the actor (the verified token's person, never a
  request field; for staff also their WorkOS user id), the target person,
  old and new role and permissions, the request id (`X-Request-Id` or a new
  one) and, for staff, the reason, which is never logged. No route updates
  or deletes these records.
- **Identity:** access is read from the live `entity.memberships` row by
  person id, on every request; nothing is cached. A target named by a merged
  person's id is the surviving person (`mergedIntoPersonId`, which the
  persons merge moves memberships along). A caller's merged-away id holds no
  memberships and no `founderPersonId` shortcut. Nothing is resolved by email
  or handle. `scripts/normalise_membership_person_ids.py` (dry run by
  default, `--apply`) rewrites membership rows keyed by a merged id, a
  verified email or a handle to the person id.
- **Re-adding a former member** reopens their ended membership (one record
  per person and entity), with a new `joinedAt`.
- The list response carries `viewer`: the caller's `role`, `can_manage`,
  `staff`, `reason_required` and the `assignable_roles`, so the console only
  offers what the API will accept.

### Invites (nyuchi/data-infra#72, approved 2026-11-11)

`entity.membershipInvites` follows data-infra's `MembershipInvite` (approved by the owner on 2026-11-11).
Routes in `gateway/routers/organization_invites.py`:

| Route                                              | Who                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /v1/organization/{id}/invites`               | Founder or admin, with a role no higher than their own. Staff with `console:admin-write` and a `reason`.                                                                                                                                                                             |
| `GET /v1/organization/{id}/invites`                | Founder or admin (the addresses are personal). Staff with `console:admin-read`, audited.                                                                                                                                                                                             |
| `DELETE /v1/organization/{id}/invites/{invite_id}` | Founder or admin, for an invite whose role is no higher than their own. Staff as above.                                                                                                                                                                                              |
| `GET /v1/organization/invites/mine`                | The signed-in person: open invites to their WorkOS-verified email.                                                                                                                                                                                                                   |
| `POST /v1/organization/invites/accept`             | The invited identity only: the signed-in person whose email, as WorkOS verifies it for their linked WorkOS user (asked live; never the person record's own `email`, which a person can edit), is the invited address, with the token or the invite id. A token alone never suffices. |

- The token (`secrets.token_urlsafe(32)`) is returned once, with
  `Cache-Control: no-store`; only its SHA-256 is stored. With
  `MEMBER_INVITE_ACCEPT_URL` set, `accept_url` carries it in the fragment.
  **No email is sent**: this API has no mail path yet (`delivery: not_sent`),
  so the inviter passes the token on.
- Invites last 7 days and are single use (claimed atomically); a TTL index
  deletes every invite, address included, 30 days after it expires.
- Creating is rate limited (20 an hour per inviter, 50 an hour per entity,
  `429`), and an entity has at most 100 open invites.
- At acceptance the inviter's authority is read again: an invite from
  someone who is no longer a founder or admin ranked at or above the role is
  void (`409`). Nobody accepts their own invite (`403`); a wrong or
  unverified account is `403`. An existing member is `409` and keeps their
  role; a removed member needs an invite made after the removal (`409`).
  Accepting creates
  the membership (or reopens a former member's) and is audited like any
  addition (`via: invite`); the address never reaches a log line or an
  audit record.

## Pay is disabled

`/v1/pay/*` is switched off in every environment (`PAY_ENABLED`). Only the
ungated `GET /v1/pay/status` responds; wallet, tokens and gateway answer
`503`. It is not feature-complete — currency coverage and compliance
posture — so don't build against it yet. `status` exists precisely so you
can tell "disabled on purpose" from an outage.

Both API keys and sign-in apps are **workspace-scoped**: every one belongs
to a workspace (a family or organization entity) and is managed by that
workspace's managers. `GET /v1/workspaces` lists the workspaces you
belong to, with your role in each. Everything rides on
`https://api.nyuchi.com/v1/*`.

## If you're building a user-facing app: WorkOS AuthKit sign-in

`GET /v1/auth/workos/login` and `GET /v1/auth/workos/callback` are a
**public, multi-tenant** pair of endpoints — every app on the Nyuchi
platform uses the same two routes. There is no per-app gateway
configuration or hardcoded domain allowlist; instead, **your app
registers its own redirect origins on a sign-in app you create for your
workspace.**

### Step 1 — find or create a workspace, then register a sign-in app

```bash
# What workspaces do I belong to, and what's my role in each?
curl https://api.nyuchi.com/v1/workspaces \
  -H "Authorization: Bearer $PLATFORM_JWT"

# Register a sign-in app under one of them (must be a manager: family
# guardian, or org founder/admin)
curl -X POST https://api.nyuchi.com/v1/auth-apps \
  -H "Authorization: Bearer $PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your App",
    "entity_id": "<workspace id from above>",
    "redirect_uris": ["https://your-app.example/auth/callback"]
  }'
```

The response includes a `client_id` (`nya_...`) — **there is no secret to
store**; it's a public identifier, safe to embed in frontend code, same
as an OAuth `client_id` typically is. Update the registered origins any
time with:

```bash
curl -X PATCH https://api.nyuchi.com/v1/auth-apps/{app_id}/redirect-uris \
  -H "Authorization: Bearer $PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["https://your-app.example/auth/callback"]}'
```

Only the origin (`scheme://host`) is actually checked — the path can be
anything.

### Step 2 — send the user to /login with your client_id

```
GET /v1/auth/workos/login?return_to=https://your-app.example/auth/callback&client_id=nya_...
```

- `return_to` must be an **absolute URL** whose origin is on the list you
  registered in step 1. A relative path, or an origin you haven't
  registered, gets a `400` — not a redirect. This is deliberate: the
  gateway will not hand a live token to an unverified redirect target.
- Omitting `client_id` only works if your `return_to` origin happens to be
  on the gateway's first-party allowlist (`platform.nyuchi.com`, the
  Nyuchi console). Every third-party app must pass `client_id`.
- The response is `{"authorization_url": "..."}`. Redirect the user there.

### Step 3 — WorkOS redirects back to the gateway, then to you

AuthKit authenticates the user and redirects to the gateway's own
`WORKOS_REDIRECT_URI` with a one-time `code`. The gateway exchanges it,
mints a platform JWT, and 302s the browser to **your** `return_to` with
the token in the URL fragment (never the query string, so it never hits
server logs or `Referer`):

```
302 https://your-app.example/auth/callback#access_token=...&person_id=...&is_new_user=...&expires_in=...
```

Parse `window.location.hash` client-side and strip it from the URL so a
page refresh doesn't reprocess it.

The person is found by WorkOS user id (the person's first identity, or one
linked later). Only when WorkOS has verified the user's email
(`email_verified` on the user record WorkOS returns to the gateway) is an
account that predates WorkOS matched by that email, or a new person
created. Otherwise `/callback` and `/refresh` answer
`403 {"detail": {"error": "email_not_verified", ...}}` and nothing is
linked or created, the same refusal as `POST /v1/identity/persons/ensure`.
A WorkOS user already linked to a person by id signs in as before.

### The fail-closed default — read this before scripting the flow

If `return_to`/`state` is missing when `/callback` runs — because the
caller never sent one, or WorkOS didn't round-trip it — the endpoint
returns **`400`, not the token.** It does not fall back to rendering the
JWT in the JSON response unless you explicitly pass
`allow_direct_token_response=true`. This exists because that fallback
used to be the default, and a real browser landing there put a live,
30-day access token on screen and in browser history for a real user.

**Never build an integration that sets `allow_direct_token_response=true`
by default, and never drive this flow through an actual browser without a
registered `return_to`.** The flag is for scripted, server-to-server code
exchanges only — e.g. an automated test harness that already has a
one-time `code` and wants the JSON body directly:

```bash
curl "https://api.nyuchi.com/v1/auth/workos/callback?code=$CODE&allow_direct_token_response=true"
```

If you're an agent hitting a `400` here and considering just adding
`allow_direct_token_response=true` to make it pass — stop. That flag is
for non-browser, server-to-server callers that already control the
response body privately. Fix `return_to` registration (step 1) instead.

## If you're building a script/service: API keys

For server-to-server calls that aren't acting on behalf of a specific
signed-in user, use an API key instead — a _different_ registration from
a sign-in app, and this one does carry a secret:

```bash
# Create a key under a workspace you manage
curl -X POST https://api.nyuchi.com/v1/api-keys \
  -H "Authorization: Bearer $PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Your Service", "entity_id": "<workspace id>", "scopes": ["news"]}'

# Then authenticate requests with either header form:
curl https://api.nyuchi.com/v1/news/articles \
  -H "X-Client-Id: nyk_..." \
  -H "X-Client-Secret: nys_..."

# or combined:
curl https://api.nyuchi.com/v1/news/articles \
  -H "X-API-Key: nyk_....nys_..."
```

Keys are scoped to **public** namespaces only (news, weather, commerce,
and other published surfaces) — `admin`, `pay`, and other internal
namespaces reject external keys regardless of the secret. `client_secret`
is shown once at creation — store it, don't lose it; `POST
/v1/api-keys/{id}/rotate` mints a new one if you do. Both responses also
carry the key as a ready-made `nyuchi-credentials.json`
([below](#credentials-file-nyuchi-credentialsjson)).

### Where keys are stored

Only the SHA-256 of a secret is ever stored, with the client id. The store
is whichever of MongoDB `platform.apiKeys` or Postgres `platform.api_keys`
(`nyuchi_relational_db`, `db/spine/proposed/011_platform_api_keys.sql`) the
`API_KEYS_OWNER` setting names (`gateway/lib/key_store.py`,
[#289](https://github.com/nyuchi/api-gateway/issues/289)). Moving between
them copies hashes, so no key has to be re-issued. Either way a revoke or a
rotation takes effect on the next request made with the key pair; a machine
token already exchanged from it stays valid until it expires (at most an
hour).

### Preferred: exchange the key for a short-lived token

Sending the long-lived secret on every request works, but the standard
OAuth 2.0 `client_credentials` grant is better — the secret stays on your
server and only a cheap 1-hour bearer token travels. Every OAuth client
library already speaks this:

```bash
curl -X POST https://api.nyuchi.com/v1/auth/token \
  -d grant_type=client_credentials \
  -d client_id=nyk_... \
  -d client_secret=nys_...

# → {"access_token": "...", "token_type": "Bearer",
#    "expires_in": 3600, "scope": "news places"}

curl https://api.nyuchi.com/v1/news/articles \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Send the credentials in the **form body**, not as `X-Client-Id` /
`X-Client-Secret` headers — those headers authenticate the request before
it reaches the token endpoint.

Pass `scope` to narrow a token to a subset of the key's namespaces (handy
for handing a task-specific token to a subsystem). You can never widen
beyond what the key already has — an unheld scope returns
`400 invalid_scope`.

**The token carries the same limits as the key.** Namespace scopes,
external-vs-internal separation, expiry and monthly quota are all
enforced on the bearer token exactly as on the header pair — exchanging a
key for a token is a change of transport, never an escalation. Errors
follow RFC 6749 §5.2 (`invalid_client`, `invalid_scope`,
`unsupported_grant_type`).

The same endpoint also serves the token-exchange grant, for first-party
services acting for a person; see
[below](#first-party-edge-services-acting-for-a-person-token-exchange).

### Credentials file: `nyuchi-credentials.json`

The create and rotate responses also carry `credentials`: the same key as one
self-contained JSON document, in the spirit of a Google Cloud service-account
key (`credentials.json`). The console offers it as a download on the
one-time secret screen. Save it as a file and a client needs no other
configuration: the endpoint, the grant and the auth method are all inside.

```json
{
  "$schema": "https://api.nyuchi.com/schemas/credentials/v1.json",
  "type": "nyuchi_api_key",
  "version": 1,
  "key_id": "6f1c…",
  "name": "Production backend",
  "entity_id": "<workspace id>",
  "key_type": "external",
  "client_id": "nyk_…",
  "client_secret": "nys_…",
  "client_secret_expires_at": 0,
  "scope": "news weather",
  "grant_types": ["client_credentials"],
  "token_endpoint_auth_method": "client_secret_post",
  "issuer": "https://api.nyuchi.com",
  "token_uri": "https://api.nyuchi.com/v1/auth/token",
  "api_base": "https://api.nyuchi.com/v1",
  "created_at": "2026-10-09T12:00:00Z",
  "expires_at": null
}
```

The field names are standard, not invented:

- `client_id`, `client_secret`, `client_secret_expires_at`, `grant_types`,
  `token_endpoint_auth_method` and `scope` come from OAuth 2.0 Dynamic Client
  Registration (RFC 7591). `client_secret_expires_at` is seconds since the
  epoch, and `0` means the secret does not expire. `scope` is space-delimited
  (RFC 6749 §3.3).
- `issuer` comes from Authorization Server Metadata (RFC 8414). `token_uri` is
  the name GCP's key file uses for RFC 8414's `token_endpoint`.
- `created_at` and `expires_at` are ISO 8601 UTC, and `expires_at` is `null`
  for a key that never expires.

Three documents describe it, all unauthenticated and cacheable:

- `GET /schemas/credentials/v1.json` is the JSON Schema (draft 2020-12).
  Validate a file against it before trusting it. It covers both kinds of
  file, picked by `type`: `nyuchi_api_key` (this section) and `nyuchi_agent`
  ([For agents](#for-agents-minting-api-keys-without-a-person)). Each has a fixed set of fields
  (`additionalProperties` is `false`); a new field means a new `version`.
- `GET /.well-known/oauth-authorization-server` is the RFC 8414 metadata:
  `issuer`, `token_endpoint`, `grant_types_supported`,
  `token_endpoint_auth_methods_supported`, and `scopes_supported` (the public
  API catalogue).
- `GET /.well-known/openid-configuration` is the same issuer for platform-JWT
  verifiers ([below](#verifying-a-platform-jwt-without-the-signing-secret)).

**Point `NYUCHI_APPLICATION_CREDENTIALS` at the file.** This mirrors Google's
`GOOGLE_APPLICATION_CREDENTIALS`: code reads the variable, loads the file,
checks `type == "nyuchi_api_key"` and `version == 1`, and exchanges the pair
at `token_uri`. An agent's file is loaded the same way but has
`type == "nyuchi_agent"`, and its token reaches only `/v1/agents/me*`
([For agents](#for-agents-minting-api-keys-without-a-person)), so check the type your code expects.

```bash
export NYUCHI_APPLICATION_CREDENTIALS="$HOME/.config/nyuchi/nyuchi-credentials.json"

ACCESS_TOKEN=$(curl -fsS "$(jq -r .token_uri "$NYUCHI_APPLICATION_CREDENTIALS")" \
  -d grant_type=client_credentials \
  --data-urlencode "client_id=$(jq -r .client_id "$NYUCHI_APPLICATION_CREDENTIALS")" \
  --data-urlencode "client_secret=$(jq -r .client_secret "$NYUCHI_APPLICATION_CREDENTIALS")" \
  | jq -r .access_token)

curl "$(jq -r .api_base "$NYUCHI_APPLICATION_CREDENTIALS")/news/articles" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```python
import json
import os

import httpx

with open(os.environ["NYUCHI_APPLICATION_CREDENTIALS"]) as f:
    creds = json.load(f)
assert creds["type"] == "nyuchi_api_key" and creds["version"] == 1

token = httpx.post(
    creds["token_uri"],
    data={  # client_secret_post: credentials in the form body
        "grant_type": "client_credentials",
        "client_id": creds["client_id"],
        "client_secret": creds["client_secret"],
    },
).raise_for_status().json()

articles = httpx.get(
    f"{creds['api_base']}/news/articles",
    headers={"Authorization": f"Bearer {token['access_token']}"},
).json()
```

```ts
import { readFileSync } from "node:fs";

const creds = JSON.parse(
  readFileSync(process.env.NYUCHI_APPLICATION_CREDENTIALS!, "utf8"),
);
if (creds.type !== "nyuchi_api_key" || creds.version !== 1) {
  throw new Error("Not a v1 Nyuchi credentials file");
}

const res = await fetch(creds.token_uri, {
  method: "POST",
  // client_secret_post: credentials in the form body
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.client_id,
    client_secret: creds.client_secret,
  }),
});
if (!res.ok) throw new Error(`token: ${res.status}`);
const { access_token, expires_in } = await res.json();

const articles = await fetch(`${creds.api_base}/news/articles`, {
  headers: { Authorization: `Bearer ${access_token}` },
}).then((r) => r.json());
```

Cache the token until shortly before `expires_in` runs out (one hour), then
exchange again. Don't exchange on every call.

**The file holds the secret.** Treat it like a password: keep it in a secrets
manager (1Password, Vault, Cloudflare/Fly/Vercel secrets, a Kubernetes
Secret) and mount it at run time, readable only by the service (`chmod 600`).
Never commit it, and never paste it into a chat or a ticket. If it leaks,
rotate the key: the old secret stops working at once, and the console offers
a fresh file. The gateway never stores the file, logs it or returns it again.
Add this to every repository's `.gitignore`:

```gitignore
# Nyuchi API credentials: secrets, never commit
nyuchi-credentials*.json
```

The console names every download so that one pattern covers it:
`nyuchi-credentials-<key name>-<key id>.json` when a key is created, and
`nyuchi-credentials-<key name>-<key id>-rotated-<YYYYMMDD>.json` (the UTC
date of the rotation) when it is rotated, so a rotated file does not land as
a `(1)` copy of the one it replaces. Two rotations on the same UTC day share
a name, and the browser numbers the second. Delete the old file once the new
one is in place: its secret no longer works.

**Coming next: key-pair credentials (v2).** A v1 file carries a shared
secret. The recommended upgrade for internal and server keys is a v2 file
with a private key instead (`token_endpoint_auth_method: "private_key_jwt"`,
RFC 7523): the gateway stores only the public key, as GCP does. It is tracked
in nyuchi/api-gateway#285 and not built yet.

### What a machine credential can do

A machine credential acts **as the person who created the key**, bounded
by the key's namespace scopes. That is deliberate, and worth understanding
before you provision one: within a permitted namespace the key can do what
its creator can do. Scope keys narrowly, create them under the workspace
they belong to, and rotate them if the creator leaves.

Endpoints that are meaningless or unsafe for a robot — anything that
changes the caller's own identity, such as linking a second sign-in email
— reject machine credentials with `403`.

## For agents: minting API keys without a person

An agent (a deploy bot, a coding agent, an MCP server) can mint and manage
the API keys of the apps it is connected to with no human session
([#286](https://github.com/nyuchi/api-gateway/issues/286)). It is its own
principal, registered under a workspace by one of its managers, and it
holds only what that manager granted it.

### What a manager sets up (once, in the console or by API)

```bash
curl -X POST https://api.nyuchi.com/v1/agents \
  -H "Authorization: Bearer $PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "Deploy bot",
        "entity_id": "<workspace id>",
        "scope_ceiling": ["news", "weather"],
        "allowed_app_ids": ["<sign-in app id>"],
        "granted_actions": ["api-keys:read", "api-keys:mint", "api-keys:rotate", "api-keys:revoke"],
        "max_keys": 10, "default_key_ttl_days": 30, "max_key_ttl_days": 90, "mints_per_hour": 20
      }'
# → 201 {"id": "…", "client_id": "nyag_…", "client_secret": "nyas_…",
#        "credentials": {"type": "nyuchi_agent", …}}   shown once, Cache-Control: no-store
```

Save `credentials` as `nyuchi-credentials-<agent name>-<agent id>.json`
(`…-rotated-<YYYYMMDD>.json` after a rotate, the same convention as a
key's file, so `nyuchi-credentials*.json` in `.gitignore` covers it) and give
it to the agent (a secrets manager or a Worker secret, never a repository).
It validates against the same `/schemas/credentials/v1.json`, with
`type: "nyuchi_agent"`, `agent_id` in place of `key_id`, and `scope` listing
the key actions it may take. Only a
workspace manager can register, change, rotate (`POST /v1/agents/{id}/rotate`)
or revoke (`DELETE /v1/agents/{id}`) an agent, and only with a person
token: no API key, machine token or agent token reaches those routes.
The agent acts for the manager who registered it (`owner_person_id`). A
manager who rotates its secret, widens what it may do, or re-enables it
becomes its owner from then on, so the keys it mints are always attributed
to the person who last vouched for it.

| Setting                                     | Meaning                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `scope_ceiling`                             | The APIs a key it mints may carry. Public catalogue slugs only: an agent never mints an internal key                 |
| `allowed_app_ids`                           | The workspace's sign-in apps its keys may be bound to. When set, every key names one (`app_id`)                      |
| `granted_actions`                           | Which of `api-keys:read`, `api-keys:mint`, `api-keys:rotate`, `api-keys:revoke` it may take (default: read and mint) |
| `max_keys`                                  | Active keys it may hold at once                                                                                      |
| `default_key_ttl_days` / `max_key_ttl_days` | Every key it mints expires: the default when it asks for none, never past the maximum                                |
| `mints_per_hour`                            | Its hourly allowance, on top of a short burst limit on every write                                                   |
| `status`                                    | `active` or `disabled` (`PATCH /v1/agents/{id}`). Revoked is final                                                   |

### What the agent does

1. Exchange its credentials for an agent token. The token is
   `aud=agent`, lives 10 minutes, and **no other route accepts it**: it
   reaches `/v1/agents/me*` and nothing else.

   ```bash
   curl -X POST https://api.nyuchi.com/v1/auth/token \
     -d grant_type=client_credentials \
     -d client_id=nyag_... \
     -d client_secret=nyas_... \
     -d "scope=api-keys:mint"             # optional: narrow to some granted actions
   # → {"access_token": "...", "token_type": "Bearer", "expires_in": 600, "scope": "api-keys:mint"}
   ```

2. Mint, list, rotate and revoke its keys:

   ```bash
   curl -X POST https://api.nyuchi.com/v1/agents/me/keys \
     -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
     -d '{"name": "widget production", "scopes": ["news"], "app_id": "<sign-in app id>", "expires_in_days": 30}'
   # → 201 {"id": "…", "client_id": "nyk_…", "client_secret": "nys_…", "key_type": "external",
   #        "created_by_agent_id": "…", "credentials": {"type": "nyuchi_api_key", …}}

   curl https://api.nyuchi.com/v1/agents/me/keys -H "Authorization: Bearer $AGENT_TOKEN"            # api-keys:read
   curl -X POST https://api.nyuchi.com/v1/agents/me/keys/$KEY_ID/rotate -H "Authorization: Bearer $AGENT_TOKEN"   # api-keys:rotate
   curl -X DELETE https://api.nyuchi.com/v1/agents/me/keys/$KEY_ID -H "Authorization: Bearer $AGENT_TOKEN"        # api-keys:revoke
   ```

   The minted key is an ordinary external key of the workspace: it acts
   within its scopes as the manager who registered the agent, exactly as if
   they had minted it, and goes through the same developer-qualification
   plan (free tier or developer). Its `credentials` object is the same
   `nyuchi_api_key` file a person's key gets.

Python:

```python
import json, os, requests

creds = json.load(open(os.environ["NYUCHI_APPLICATION_CREDENTIALS"]))  # the agent's file
assert creds["type"] == "nyuchi_agent" and creds["version"] == 1
token = requests.post(creds["token_uri"], data={
    "grant_type": "client_credentials",
    "client_id": creds["client_id"],
    "client_secret": creds["client_secret"],
}).json()["access_token"]
key = requests.post(f"{creds['api_base']}/agents/me/keys",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"name": "widget production", "scopes": ["news"], "app_id": "<app id>"}).json()
# Store key["credentials"] in your secrets manager; it is never shown again.
```

TypeScript:

```ts
import { readFile } from "node:fs/promises";

const creds = JSON.parse(await readFile(process.env.NYUCHI_APPLICATION_CREDENTIALS!, "utf8"));
const tokenRes = await fetch(creds.token_uri, {
  method: "POST",
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.client_id,
    client_secret: creds.client_secret,
  }),
});
const { access_token } = await tokenRes.json();
const key = await fetch(`${creds.api_base}/agents/me/keys`, {
  method: "POST",
  headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "widget production", scopes: ["news"], app_id: "<app id>" }),
}).then((r) => r.json());
```

### What an agent can never do

- Mint an internal key. There is no `key_type`, and an internal or operator
  API is `403 internal_scope_not_allowed` at registration and at mint.
- Go beyond its ceiling (`403 scope_exceeds_ceiling`), the workspace's
  developer qualification (`403 scope_not_approved`), its apps
  (`403 app_not_allowed`, `422 app_required`), its maximum TTL
  (`422 ttl_exceeds_maximum`), its key cap (`409 agent_key_limit`) or its
  allowance (`429 slow_down`).
- Touch a key it did not mint, in its own workspace or any other. Those are
  `404`, so it never learns that a key exists.
- Rotate an expired key (`409 key_expired`; mint a new one). Expired keys
  do not count against its cap.
- Mint two keys at once: mints for one agent are serialised across
  instances (`429 slow_down` while another is under way).
- Register, change, rotate or revoke an agent, itself included.
- Use its token anywhere but `/v1/agents/me*` (`401`).

Anything more needs a person. A human-approval flow (CIBA, or an approval
queue in the console) is a follow-up on #286; until then it is denied.

### Revocation

Every agent call re-reads the agent. It stops at once (`401`) when a
manager disables or revokes it, when its workspace is deactivated, or when
the manager who registered it no longer manages the workspace.
`DELETE /v1/agents/{id}` revokes it for good and, by default
(`cascade=true`), revokes every key it minted (`revokedReason:
"agent_revoked"`); `cascade=false` leaves them for the workspace's managers.
People list an agent's keys with `GET /v1/agents/{id}/keys` or
`GET /v1/api-keys?entity_id=…&created_by_agent_id=…`.

Every action, allowed or refused, writes one line to `nyuchi.audit`
(`developer.agent` for the agent itself, `developer.api_key` with
`agent_id` for its keys): ids only, never a secret or a token.

### From an MCP server

The Nyuchi and Mzizi MCP servers (Cloudflare Workers, per the org's
`mcp-server-cloudflare` conventions) can offer these as tools for agents
that speak MCP: `api_keys_list`, `api_keys_create`, `api_keys_rotate` and
`api_keys_revoke`. The server holds the agent's `nyuchi-credentials.json`
as a Worker secret, exchanges it at `token_uri`, caches the token for its
`expires_in`, and calls `/v1/agents/me/keys*`. They are machine-to-machine
tools behind the auth-by-audience gate; rotate and revoke carry
`destructiveHint: true`, and a created key's secret is returned once to
the calling agent and never logged. This is a design, not yet built.

### Coming next

- `private_key_jwt` (RFC 7523) for the agent's own credential, with #285's
  v2 key-pair credentials files. The server will then hold only a public
  key.

## First-party edge services acting for a person: token exchange

A first-party edge service that signs people in with WorkOS AuthKit itself
(the identity edge, `mukoko-id-api`, is the first) can trade the person's
AuthKit access token for a short-lived platform JWT naming that person.
This is the RFC 8693 token-exchange grant on the same endpoint:

```bash
curl -X POST https://api.nyuchi.com/v1/auth/token \
  -d grant_type=urn:ietf:params:oauth:grant-type:token-exchange \
  -d subject_token=$AUTHKIT_ACCESS_TOKEN \
  -d subject_token_type=urn:ietf:params:oauth:token-type:access_token \
  -d client_id=nyk_... \
  -d client_secret=nys_... \
  -d "scope=identity family"            # optional; see below

# → {"access_token": "...", "issued_token_type": "urn:ietf:params:oauth:token-type:jwt",
#    "token_type": "Bearer", "expires_in": 287, "scope": "family identity"}
```

**Who may call it.** Only an `internal` key that holds the `identity`
scope. Anything else gets `400 unauthorized_client`. External keys can
never act for a person.

**What is checked on the subject token**, before any claim is trusted:

- the RS256 signature, against the JWKS at
  `<WORKOS_AUTHKIT_DOMAIN>/oauth2/jwks`;
- `exp` (10 seconds of clock skew);
- `iss` is the configured AuthKit origin, or
  `<host>/user_management/<Console client id>` on `https://api.workos.com`,
  the AuthKit origin or the custom Auth API domain
  (`WORKOS_AUTH_API_DOMAIN`). `WORKOS_AUTHKIT_DOMAIN` is configuration
  only, parsed as a URL, and accepted only as a bare `https` origin;
- the issuing WorkOS client, read from the `client_id` claim (or `aud`,
  where a JWT template adds one), is the Nyuchi Console's:
  `WORKOS_CONSOLE_CLIENT_ID`, one client id and never a list, because
  access to the API is governed by the Console;
- the WorkOS session (`sid`) is still active, asked of WorkOS, so a
  signed-out or revoked session cannot be replayed. Set
  `TOKEN_EXCHANGE_CHECK_WORKOS_SESSION=false` to skip this; it is also
  skipped while `WORKOS_API_KEY` is unset.

Any failure is `400 invalid_grant`. If the AuthKit domain or the allow-list
is unset or malformed, or the JWKS or WorkOS cannot be reached, the answer
is `503 temporarily_unavailable`; retry.

**The person must already exist.** The WorkOS user is looked up by its
WorkOS user id (primary or linked identity), then, for accounts older than
WorkOS, by the email WorkOS reports as verified. Nobody is created here.
An unknown user is `404 person_not_found`: provision them with
`POST /v1/identity/persons/ensure` (below), then exchange again, once.

**What you get.** An ordinary person JWT (`aud=authenticated`,
`sub=<person id>`, `sid` of the WorkOS session) with two extra claims:

- `scope`: the namespaces it may reach. It is the requested `scope`
  (default: every scope the key holds) intersected with the key's scopes
  and with what a person's token may ever reach. `admin`, `pay`,
  `api-keys`, `auth-apps`, `couch` and `pipeline` are never delegated from
  a key's scopes. The one exception is the console backend's key, which
  adds operator namespaces from the person's own WorkOS permissions, never from the key,
  and the self-service `api-keys` and `auth-apps` namespaces for every person
  (see [Console permissions](#console-permissions-admin-pay-and-review-for-people)).
  When nothing is left the answer is `400 invalid_scope`. A request made
  with this token outside its `scope` is `403`, whether or not the key
  pair travels with it.
- `act`: `{"sub": "<your nyk_ client id>"}`, the service acting for the
  person (RFC 8693 §4.1).

It lives at most `TOKEN_EXCHANGE_MAX_SECONDS` (15 minutes by default) and
never longer than the AuthKit access token it came from. Cache it keyed on
the AuthKit token and exchange again when that token is refreshed.

Call the API with the person token as the bearer. You may also send your
key pair as `X-Client-Id`/`X-Client-Secret`; the key then bounds the
namespaces as well.

Every attempt, granted or refused, is written to the `nyuchi.audit` log as
one JSON line: outcome, reason, `nyk_` client id, key id, WorkOS user and
client ids, person id, granted scope, and a fingerprint of the session id.
Tokens and secrets are never logged.

### The station console: `/v1/stations`

The StationKit console (`nyuchi/stationkit`, served at `weatherstations.nyuchi.com`) is a
first-party edge service of exactly this kind: its WorkOS app is the Console's, so its
people's AuthKit access tokens exchange. Its backend holds an **internal** key with the
`identity` and `stations` scopes, exchanges each person's token with `scope=stations`, and
calls `/v1/stations` with the result. That token reaches the stations routes and nothing else.
`stations` is an internal namespace (no external key carries it) and `stations:service`, the
ingest Worker's scope, is never delegated to a person. A station's own ingest key, sent as
`Authorization: Bearer <ingestKey>`, reaches that station's `GET /v1/stations/{id}` and
`POST /v1/stations/{id}/readings` and nothing else. The one-off import of the stations that
exist today is a route of its own, `POST /v1/stations/import`, for an internal key scoped
`stations` and `stations:import` (non-delegable, never the ingest Worker's key, minted
short-lived by a person holding `console:api-keys-mint`). See
[docs/architecture/stations.md](architecture/stations.md).

### Provisioning a new person: `POST /v1/identity/persons/ensure`

Someone who signs in at the identity edge for the first time has no person
yet, because they never passed through this API's own AuthKit callback. The
edge provisions them explicitly, with the same key and the same AuthKit
access token:

```bash
curl -X POST https://api.nyuchi.com/v1/identity/persons/ensure \
  -H "X-Client-Id: nyk_..." -H "X-Client-Secret: nys_..." \
  -H "content-type: application/json" \
  -d '{"subject_token": "'"$AUTHKIT_ACCESS_TOKEN"'",
       "subject_token_type": "urn:ietf:params:oauth:token-type:access_token"}'

# → 201 {"person_id": "...", "created": true}    a new person
# → 200 {"person_id": "...", "created": false}   they already had one
```

The flow is: exchange → `404 person_not_found` → ensure → exchange once
more. It is a separate endpoint, not a flag on the exchange, so that the
exchange only ever reads, and creating a person has its own audit event,
its own refusals and its own limit.

**What is checked**, in order, before anything is written:

- the caller is a machine credential for an `internal` key holding
  `identity` (`401 invalid_client` without one, `403` otherwise). A
  person's own token is refused;
- the subject token, exactly as for the exchange: signature, `exp`, `iss`,
  the issuing client the Console's (`WORKOS_CONSOLE_CLIENT_ID`)
  (`400 invalid_grant`);
- the WorkOS session is still active (`400 invalid_grant` when it has
  ended);
- WorkOS, asked for the user by id, reports the email as verified
  (`403 email_not_verified` otherwise). The person is built from that WorkOS
  user record, never from anything in the request.

**What it creates**, through the same function the AuthKit callback uses
(`gateway/lib/provisioning.py`): the person, their default Family with them
as guardian (family-first), the WorkOS `external_id` back-link and the
`identity.person.signed_up` event (`source: "identity_edge"`). An existing
person who belongs to no Family is given their default one.

**Idempotent and safe under concurrency.** The same WorkOS user always
yields the same person: concurrent calls race on the unique `workosUserId`
and `email` indexes and the loser gets the winner's person back. The
default Family's id is derived from the person id, so it cannot be created
twice either.

Errors share the exchange's shape (`{"detail": {"error", "error_description"}}`);
`503 temporarily_unavailable` means retry (WorkOS unreachable or
unconfigured, or the persons store unavailable, including after the
`PERSONS_OWNER` flip until its write path lands). Every attempt is one
`identity.person.ensure` line on `nyuchi.audit` (outcome `created`,
`existing` or `denied`), with no tokens, secrets or emails. Limit:
30/minute.

## Linking a second sign-in email to the same person

Real people use different emails for different contexts — a work email
for one workspace, a personal one, a different work email for another —
and it should all still be one Nyuchi identity, not three. If your user
is already signed in and wants to add another sign-in email:

```
GET /v1/auth/workos/login-link?return_to=https://your-app.example/linked
Authorization: Bearer $PLATFORM_JWT
```

This requires the caller's _own_ platform JWT (they must already be
signed in) — completing hosted login with the new email is the proof they
own it, but only when WorkOS has verified that email; an unverified one is
refused with `403 email_not_verified` and nothing is linked. After it
succeeds, that email signs the same person in from then on; the response
redirect carries `#linked=1&email=...`, not a new token (the caller's
existing session doesn't change). If the email is already linked to a
_different_ person, this rejects with `409` — it never silently merges
two people. Untangling identities that already exist as separate people
(e.g. before this endpoint existed) is a support action:
`POST /v1/admin/persons/merge`.

## Using the platform JWT

```bash
curl https://api.nyuchi.com/v1/identity/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Keeping the session alive: WorkOS decides

WorkOS, not the gateway, decides how long a sign-in lasts: the AuthKit
application's maximum session length and inactivity timeout, revocation,
and sign-out. `/callback` keeps the WorkOS session in a sealed, HttpOnly
cookie (`nyuchi_workos_session`, path `/v1/auth/workos`) on the gateway's
own host, and the platform JWT carries the WorkOS session id as `sid`.

- `POST /v1/auth/workos/refresh` (send cookies: `credentials: "include"`)
  swaps the WorkOS refresh token for a new one and returns
  `{access_token, expires_in, person_id}`. Call it when the platform JWT
  is about to expire or an API call returns 401.
  - `401`: the WorkOS session is over (or never existed here). Sign in
    again via `/v1/auth/workos/login`.
  - `503`: WorkOS couldn't be reached. Keep the session and retry; never
    sign the user out for this.
- `POST /v1/auth/workos/logout?return_to=…` clears the cookie and returns
  `{logout_url}`. Send the browser there to end the session at WorkOS
  (and so in every app that relies on it). `return_to` must be on the
  `/login` allowlist and registered as a Sign-out URI in WorkOS.

Both need `WORKOS_COOKIE_PASSWORD` (32+ characters).

Until every client refreshes, the platform JWT keeps its fixed lifetime:
30 days (web) / 1 year (native). Set
`PLATFORM_JWT_FOLLOW_WORKOS_SESSION=true` to make it expire with the
WorkOS access token instead. That way no gateway token outlives what
WorkOS allows.

## Verifying a platform JWT without the signing secret

A service that only needs to _check_ a sign-in (an Edge Worker, say) should
not hold a secret that can also _mint_ one. The gateway publishes its
asymmetric keys for exactly that:

- `GET https://api.nyuchi.com/.well-known/openid-configuration` — `issuer`,
  `jwks_uri`, the signing algorithm
- `GET https://api.nyuchi.com/.well-known/jwks.json` — the ES256 public keys

Verify with `alg` pinned to `ES256`, the key whose `kid` matches the token
header, `iss` = `https://api.nyuchi.com`, and `aud` = `authenticated` (a
person) — `machine` tokens are a different audience and must never be
accepted as a person. With `jose`:

```ts
const jwks = createRemoteJWKSet(new URL("https://api.nyuchi.com/.well-known/jwks.json"));
const { payload } = await jwtVerify(token, jwks, {
  algorithms: ["ES256"],
  issuer: "https://api.nyuchi.com",
  audience: "authenticated",
});
```

**Transition.** Until the operator switches the gateway to ES256
(`PLATFORM_JWT_SIGNING_ALG`), tokens are still HS256 with
`iss: nyuchi-platform`, and the JWKS may be empty. During the switch both
kinds are valid: accept ES256 via the JWKS and, only if you already hold the
HS256 secret, HS256 — never HS256 verified with a public key. Once the
longest-lived HS256 token has expired (one year for native clients), drop
HS256.

## Retired — do not build against these

`/v1/auth/exchange`, `/v1/auth/refresh`, and `/v1/auth/otp/*` (the
retired email/SMS OTP flow) have been removed entirely. WorkOS
AuthKit is the sole sign-in path.

## Rate limits

`/v1/auth/workos/{login,callback,logout}` and `/v1/auth/token`: 30
requests/minute. Every other endpoint defaults to 60/minute. `429`
responses carry a `Retry-After` header — back off, don't loop tightly.

Limits are counted **per API key** when you authenticate with one (either
header form or a machine token), and per client IP otherwise. Two services
sharing an egress IP no longer share a bucket, and moving IPs doesn't
reset your key's.

**The console backend** (a key in `CONSOLE_BACKEND_CLIENT_IDS`) is
different. It serves every console user from one key and one IP, so its
limits are counted per person:

- **API calls.** A request carrying a token the console backend exchanged
  is counted against the person it acts for (`sub`), at the usual limits.
  Only a verified token is bucketed this way.
- **Token exchange.** `POST /v1/auth/token` gives the console key 1200
  requests/minute, provided it also sends its key pair as
  `X-Client-Id`/`X-Client-Secret` headers (that is how the request is
  counted against the key rather than the IP). Each person is then held to
  30 exchanges/minute. Over that, the answer is `429` with
  `{"error": "slow_down"}`.

Machine tokens are minted freshly per request only if you ask for one —
cache the token for its `expires_in` rather than calling `/v1/auth/token`
on every API call, or you'll spend your auth budget on handshakes.

### Public application forms

`POST /v1/applications/businesses` and `POST /v1/applications/experts`
take submissions without a sign-in, from the "get involved" forms on
Zimbabwe Travel Info (nyuchi/nyuchi-platform#375). They carry their own
controls:

- **5 a minute and 20 an hour per caller address** (`Fly-Client-IP`),
  signed in or not.
- **Without a sign-in**, the body must have `privacy_consent: true`
  (`422` otherwise, recorded as `privacyConsentAt`) and the request must
  carry a Cloudflare Turnstile token in the `CF-Turnstile-Response`
  header. The gateway checks it with Siteverify using
  `TURNSTILE_SECRET_KEY` and accepts only tokens solved on
  `TURNSTILE_ALLOWED_HOSTNAMES`. A missing token is `400`, a failed one
  `403`, and Siteverify being unreachable `503`.
- **No secret configured** means anonymous submissions answer `503`
  outside development. A signed-in person never needs a Turnstile token.
- Field lengths are capped and `email` must be a valid address.

## Further reading

- [Authentication (full guide)](https://docs.nyuchi.com/api/authentication)
- [API keys](https://docs.nyuchi.com/api/api-keys)
- [Security and rate limits](https://docs.nyuchi.com/api/security)
- Testing this flow by hand as a team member? See `docs/AUTH_TESTING.md`
  in this repo instead — different audience, same underlying rules.
