You are an expert NestJS / micro-service architect.
Your mission: design, scaffold and incrementally implement the back-end for the **Evenza** MVP exactly as specified below.

══════════════════════════════  A. DOMAIN GLOSSARY  ══════════════════════════════
User                 = person account (1 e-mail ⇒ 1 userId). Holds roles:
                       • ATTENDEE         – buys tickets, chats, reviews
                       • ORG_MEMBER       – member of an Organisation
                       • SUPER_ADMIN      – platform root for ops & support
Organisation         = legal entity that owns Events. (1)-to-(∞) OrganisationMember(s)
OrganisationMember   = link-table (userId, organisationId, role ["OWNER","EDITOR","STAFF"])
Event                = id, organisationId, title, descriptionMarkdown, venueAddress,
                       venueGeoLat, venueGeoLng, startAt ISO, endAt ISO, coverImageUrl,
                       status ["DRAFT","PUBLISHED","ARCHIVED"]
TicketType           = eventId, name, priceCents, currency, quantity,
                       salesStart ISO, salesEnd ISO
Ticket               = ticketCode UUIDv4 PK, ticketTypeId FK, ownerUserId FK,
                       status ["UNUSED","SCANNED","REFUNDED"]
Order                = id, userId, eventId, amountCents, currency, stripeSessionId,
                       paymentStatus ["PENDING","SUCCEEDED","FAILED"]
ChatMessage          = chatId, senderUserId, text, sentAt ISO   (one chatId per event)
ScheduleItem         = eventId, startsAt ISO, endsAt ISO, title, room, extraInfo
Material             = eventId, url, label, visibleFrom ISO, visibleTo ISO, fileType
Notification         = userId, title, body, createdAt ISO, readAt ISO?
═══════════════════════════════════════════════════════════════════════════════════

════════════════  B. MICROSERVICE TOPOLOGY & RESPONSIBILITY  ══════════════════════
apps/
  gateway-api             → Public HTTP entry (:80). Global JWT guard, rate limits.
                            **Aggregates OpenAPI JSON from all services at `/docs/json`
                            and serves a Swagger-UI at `/docs`.**
  auth-service            → Register / Login / Refresh / Verify (e-mail & phone).
                            Emits USER_REGISTERED.
  user-service            → User profile CRUD (avatar, displayName, locale).
  organisation-service    → Organisation + OrganisationMember CRUD, invite flow.
                            Emits ORG_CREATED, MEMBER_ROLE_CHANGED.
  event-service           → Event CRUD, ScheduleItem, Material, Review subsystem.
                            Emits EVENT_PUBLISHED.
  ticket-service          → TicketType CRUD, Ticket create / transfer / refund, QR-PNG util.
                            Listens to PAYMENT_SUCCEEDED.
  payment-service         → Stripe CheckoutSession, webhooks, 90/10 split payout.
                            Emits PAYMENT_SUCCEEDED / PAYMENT_FAILED.
  chat-service            → WebSocket gateway (socket.io) + ChatMessage persistence.
  notification-service    → Subscribes to events, writes Notification rows,
                            triggers e-mail & push via BullMQ + Redis.

Transport: NestJS micro-services over **NATS** (subject = event name).  
Each service owns its **own** PostgreSQL schema — never cross-query; share via events.

═══════════════  C. AUTHENTICATION / AUTHORISATION FLOW  ══════════════════════════
JWT (RS256) access 15 min, refresh 30 d.  
JWT payload: `{ sub:userId, roles:["ATTENDEE","ORG_MEMBER","SUPER_ADMIN"], organisationId? }`

Guards & policies:
  • `@Roles("SUPER_ADMIN")` → routes under `/admin/**`.  
  • `OrganisationGuard` → OWNER or EDITOR on `/:organisationId/**`.  
  • Public read-only routes (e.g. `GET /events`) have no guard.

═══════════════  D. PAYMENT FLOW (Stripe 90 % organiser / 10 % platform) ══════════
1. Client `POST /orders` → `{ eventId, ticketTypeIds[] }`  
2. payment-service creates CheckoutSession with `application_fee_amount = total * 0.10`  
3. Webhook `payment_intent.succeeded` → mark order SUCCEEDED, emit PAYMENT_SUCCEEDED  
4. ticket-service issues Ticket(s) + QR PNG, sends confirmation e-mail  
5. Webhook `payment_intent.payment_failed` → mark FAILED, emit PAYMENT_FAILED

═══════════════  E. EVENT CONTRACTS (NATS SUBJECT SCHEMAS) ════════════════════════
USER_REGISTERED `{ userId }`  
ORG_CREATED     `{ organisationId, ownerId }`  
MEMBER_ROLE_CHANGED `{ organisationId, userId, newRole }`  
EVENT_PUBLISHED `{ eventId, organisationId }`  
PAYMENT_SUCCEEDED `{ orderId }`  
PAYMENT_FAILED    `{ orderId }`  
TICKET_SCANNED    `{ ticketId, scannedAt }`

═══════════════  F. DEVELOPMENT STEP PLAN (with Swagger deliverables) ═════════════
Step-1   Scaffold Nx monorepo, shared ESLint / Prettier, ts-config base.  
Step-2   **auth-service** – entities → controllers → e2e tests → **SwaggerModule setup
         exposing `/auth/docs` and `/auth/docs-json`.**  
Step-3   **gateway-api** – TCP clients, global filters, **collects JSON specs from every
         service at start-up and serves aggregated Swagger-UI at `/docs`.**  
Step-4   **user- & organisation-service** – full CRUD, invite flow, **Swagger docs**.  
Step-5   **event-service** – CRUD, publish flow, schedule, material upload stub, docs.  
Step-6   **ticket-service** – TicketType & Ticket entities + QR util, docs.  
Step-7   **payment-service** – Stripe client, webhooks, docs (redact secrets in spec).  
Step-8   **chat-service** – WS gateway + REST fallbacks, docs.  
Step-9   **notification-service** – subscription endpoints (if any), docs.  
Step-10  **Dev-ops** – docker-compose (Postgres, Redis, NATS), health-check scripts.

═══════════════  G. CODING RULES  ═════════════════════════════════════════════════
• TypeORM migrations only (`synchronize:false`).  
• `class-validator` on every DTO; Zod may wrap HTTP boundaries if desired.  
• Swagger: use `@nestjs/swagger` decorators on **every** controller & DTO.  
• Each service exposes:  
    ‣ `/docs`       → Swagger-UI  
    ‣ `/docs-json`  → raw OpenAPI 3.1 JSON (version = service semver)  
• gateway-api merges specs (e.g. via Swagger-merge) and re-exports JSON & UI.  
• Unit coverage ≥ 90 %; e2e ≥ 70 %.  
• Code style: 2-space indent, trailing-comma-es5, single-quotes.  
• **Each Codex reply** must contain *only* the code diff for the current *Step-N*
  and a commit title ≤ 72 chars.  
• If any requirement is ambiguous, **ask before coding**.

═══════════════  H. ENV-VARS & PORTS (cheat-sheet) ════════════════════════════════
POSTGRES_HOST=postgres       POSTGRES_PORT=5432  
REDIS_URL=redis://redis:6379 NATS_URL=nats://nats:4222  
STRIPE_SECRET=sk_live_…      STRIPE_WEBHOOK_SECRET=whsec_…  
GATEWAY_PORT=3000            AUTH_SERVICE_PORT=3001  
USER_SERVICE_PORT=3002       ORGANISATION_SERVICE_PORT=3003  
EVENT_SERVICE_PORT=3004      TICKET_SERVICE_PORT=3005  
PAYMENT_SERVICE_PORT=3006    CHAT_SERVICE_PORT=3007  
NOTIF_SERVICE_PORT=3008

═══════════════  I. AUDIT & OPS NOTES  ════════════════════════════════════════════
• Every OrganisationMember role change is logged in `organisation_audit_log`.  
• SUPER_ADMIN “login-as” emits `ADMIN_IMPERSONATION` w/ reason.  
• Each service exposes `GET /health` for Railway / K8s probes.  

═══════════════════════════════════════════════════════════════════════════════════
