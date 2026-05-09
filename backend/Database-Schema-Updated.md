## 3.5.2 Database Architecture and Schema (Updated)

The platform uses a MongoDB document model with reference-based relationships across five business domains: User and Security, Product and Catalog, Sales and Fulfillment, Logistics, and AI Analytics.

Unlike a fully relational SQL schema, this design combines embedded snapshots (for historical accuracy) and ObjectId references (for integrity and query flexibility).

- User and Security module manages authentication, account roles, and administrative audit logs.
- Product module manages catalog data, category taxonomy, stock, and customer reviews.
- Sales module manages orders, order line items, vouchers, and payment state transitions.
- Logistics module manages shipments, tracking metadata, delivery snapshots, and shipment status timelines.
- AI module captures user behavior and recommendation history for personalization.

This architecture supports one-to-many relationships such as User -> Orders and Order -> Shipments, while preserving many-to-many behavior through transactional records (for example User <-> Product via Order items and Reviews).

### Core Relationship Map

- User (1) -> Order (N) via `orders.userId`.
- Order (1) -> Shipment (N) via `shipments.orderId` and `orders.shipmentIds[]`.
- User (1) -> Shipment (N) via `shipments.customerId`.
- Order (1) -> Review (N) and Product (1) -> Review (N).
- Voucher (1) -> Order (N) via `orders.voucherId` and `orders.voucherCode` snapshot.
- User (admin/staff) (1) -> AuditLog (N).

All collections include `createdAt` and `updatedAt` timestamps.

---

### Users Collection (`users`)

Stores customer and backoffice identities.

| Field                      | Type     | Required | Description                                    |
| -------------------------- | -------- | -------- | ---------------------------------------------- |
| `_id`                      | ObjectId | Yes      | Primary key.                                   |
| `name`                     | String   | Yes      | Display name.                                  |
| `phone`                    | String   | No       | Vietnamese phone format; unique sparse index.  |
| `email`                    | String   | No       | Email; unique sparse index.                    |
| `password`                 | String   | No       | BCrypt hash, excluded by default from queries. |
| `googleId`                 | String   | No       | Google OAuth external ID; unique sparse index. |
| `avatar`                   | String   | No       | Profile image URL/path.                        |
| `provider`                 | String   | Yes      | `local` or `google`.                           |
| `address`                  | String   | No       | Default address.                               |
| `role`                     | String   | Yes      | `user`, `admin`, `staff`, `audit`.             |
| `isActive`                 | Boolean  | Yes      | Soft-disable account flag.                     |
| `resetPasswordToken`       | String   | No       | Password reset token.                          |
| `resetPasswordExpires`     | Date     | No       | Reset token expiry.                            |
| `passwordResetOtpHash`     | String   | No       | OTP hash for reset flow.                       |
| `passwordResetOtpExpires`  | Date     | No       | OTP expiry.                                    |
| `passwordResetOtpAttempts` | Number   | No       | OTP attempt counter.                           |

---

### Products Collection (`products`)

Stores catalog and inventory records.

| Field           | Type          | Required | Description                                   |
| --------------- | ------------- | -------- | --------------------------------------------- |
| `_id`           | ObjectId      | Yes      | Primary key.                                  |
| `name`          | String        | Yes      | Product name.                                 |
| `slug`          | String        | Yes      | SEO slug; unique index.                       |
| `price`         | Number        | Yes      | Current selling price.                        |
| `originalPrice` | Number        | No       | Optional base price/MSRP.                     |
| `category`      | String        | Yes      | Enum category (`veg`, `fruit`, `meat`, etc.). |
| `subCategory`   | String        | No       | Sub-category label.                           |
| `description`   | String        | No       | Product details.                              |
| `imageUrl`      | String        | No       | Product image path/URL.                       |
| `stock`         | Number        | Yes      | Available inventory.                          |
| `unit`          | String        | No       | Unit of measure.                              |
| `tags`          | Array[String] | No       | Search/filter keywords.                       |
| `isActive`      | Boolean       | Yes      | Storefront visibility flag.                   |
| `externalId`    | String        | No       | External/legacy integration ID.               |

---

### Orders Collection (`orders`)

Stores financial transactions, delivery snapshots, and fulfillment lifecycle state.

| Field                     | Type            | Required | Description                                                                                                                                     |
| ------------------------- | --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                     | ObjectId        | Yes      | Primary key.                                                                                                                                    |
| `orderId`                 | String          | Yes      | Business code (e.g., `ORD-XXXX`).                                                                                                               |
| `userId`                  | ObjectId        | Yes      | Reference to `users._id`.                                                                                                                       |
| `items`                   | Array[Object]   | Yes      | Purchased line items snapshot.                                                                                                                  |
| `items[].productId`       | ObjectId        | Yes      | Reference to `products._id`.                                                                                                                    |
| `items[].productName`     | String          | Yes      | Name snapshot at purchase time.                                                                                                                 |
| `items[].quantity`        | Number          | Yes      | Purchased quantity.                                                                                                                             |
| `items[].price`           | Number          | Yes      | Unit price snapshot.                                                                                                                            |
| `items[].subtotal`        | Number          | Yes      | Line total (`quantity * price`).                                                                                                                |
| `delivery`                | Object          | Yes      | Recipient and address snapshot.                                                                                                                 |
| `delivery.name`           | String          | Yes      | Recipient name.                                                                                                                                 |
| `delivery.phone`          | String          | Yes      | Recipient phone.                                                                                                                                |
| `delivery.address`        | String          | Yes      | Delivery address.                                                                                                                               |
| `delivery.slot`           | String          | No       | Preferred time slot.                                                                                                                            |
| `payment`                 | Object          | Yes      | Payment metadata.                                                                                                                               |
| `payment.method`          | String          | Yes      | `cod`, `vnpay`, `momo`.                                                                                                                         |
| `payment.status`          | String          | Yes      | `pending`, `paid`, `refunded`.                                                                                                                  |
| `payment.gateway`         | String          | No       | Gateway code/name.                                                                                                                              |
| `payment.transactionId`   | String          | No       | Gateway transaction ID.                                                                                                                         |
| `payment.transactionTime` | Date            | No       | Payment completion time.                                                                                                                        |
| `payment.amount`          | Number          | No       | Paid amount snapshot.                                                                                                                           |
| `payment.gatewayResponse` | Mixed           | No       | Raw gateway payload.                                                                                                                            |
| `voucherId`               | ObjectId        | No       | Reference to `vouchers._id`.                                                                                                                    |
| `voucherCode`             | String          | No       | Promo code snapshot for history.                                                                                                                |
| `shippingFee`             | Number          | Yes      | Shipping cost.                                                                                                                                  |
| `discount`                | Number          | Yes      | Total discount.                                                                                                                                 |
| `subtotal`                | Number          | Yes      | Sum of line item subtotals.                                                                                                                     |
| `totalAmount`             | Number          | Yes      | Final payable amount.                                                                                                                           |
| `status`                  | String          | Yes      | `pending`, `confirmed`, `shipping`, `delivered`, `cancelled`, `return_requested`, `return_approved`, `return_rejected`, `returned`, `refunded`. |
| `deliveredAt`             | Date            | No       | Delivery completion timestamp.                                                                                                                  |
| `shipmentIds`             | Array[ObjectId] | No       | Reverse links to `shipments._id` for split fulfillment.                                                                                         |
| `returnRequest`           | Object          | No       | Return workflow details and review state.                                                                                                       |
| `note`                    | String          | No       | Optional customer/admin note.                                                                                                                   |

Key indexes:

- `{ userId: 1, createdAt: -1 }`
- `{ status: 1, createdAt: -1 }`
- `{ payment.status: 1, createdAt: -1 }`

---

### Shipments Collection (`shipments`) [New]

Tracks logistics execution separately from order payment state.

| Field                     | Type          | Required | Description                                                                                             |
| ------------------------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `_id`                     | ObjectId      | Yes      | Primary key.                                                                                            |
| `orderId`                 | ObjectId      | Yes      | Reference to `orders._id`.                                                                              |
| `customerId`              | ObjectId      | Yes      | Reference to `users._id` (recipient owner).                                                             |
| `carrier`                 | String        | Yes      | `internal`, `ghn`, `ghtk`, `viettel_post`, `jnt`, `other`.                                              |
| `trackingNumber`          | String        | No       | Normalized uppercase tracking code.                                                                     |
| `shippingFee`             | Number        | Yes      | Shipment-level fee allocation.                                                                          |
| `eta`                     | Date          | No       | Estimated arrival date/time.                                                                            |
| `deliveredAt`             | Date          | No       | Delivery confirmation timestamp.                                                                        |
| `currentStatus`           | String        | Yes      | `pending`, `picked`, `packed`, `shipped`, `in_transit`, `delivered`, `failed`, `returned`, `cancelled`. |
| `deliverySnapshot`        | Object        | No       | Snapshot: recipient and address info at shipment creation.                                              |
| `statusHistory`           | Array[Object] | No       | Event timeline of status transitions.                                                                   |
| `statusHistory[].status`  | String        | Yes      | One status event value.                                                                                 |
| `statusHistory[].at`      | Date          | Yes      | Event timestamp.                                                                                        |
| `statusHistory[].actorId` | ObjectId      | No       | User/admin that performed the update.                                                                   |
| `statusHistory[].source`  | String        | No       | Source label (`system`, `migration`, `admin_update`, etc.).                                             |
| `statusHistory[].note`    | String        | No       | Optional event note.                                                                                    |
| `metadata`                | Mixed         | No       | Flexible carrier-specific payload.                                                                      |

Key indexes:

- `{ orderId: 1, createdAt: -1 }`
- `{ customerId: 1, createdAt: -1 }`
- `{ currentStatus: 1, updatedAt: -1 }`
- Unique partial index `{ carrier: 1, trackingNumber: 1 }` when tracking number exists.

---

### Vouchers Collection (`vouchers`)

Stores promotional discount campaigns.

| Field           | Type     | Required | Description                       |
| --------------- | -------- | -------- | --------------------------------- |
| `_id`           | ObjectId | Yes      | Primary key.                      |
| `code`          | String   | Yes      | Unique uppercase voucher code.    |
| `type`          | String   | Yes      | `ship`, `percent`, `fixed`.       |
| `value`         | Number   | Yes      | Discount numeric value.           |
| `cap`           | Number   | No       | Discount cap for percentage type. |
| `minOrderValue` | Number   | No       | Minimum subtotal required.        |
| `maxUses`       | Number   | No       | Total redemption limit.           |
| `usedCount`     | Number   | No       | Current redemption count.         |
| `startsAt`      | Date     | No       | Campaign start time.              |
| `expiresAt`     | Date     | No       | Campaign end time.                |
| `isActive`      | Boolean  | Yes      | Admin activation flag.            |
| `note`          | String   | No       | Internal note.                    |

---

### Reviews Collection (`reviews`)

Stores post-purchase customer product feedback.

| Field          | Type     | Required | Description                          |
| -------------- | -------- | -------- | ------------------------------------ |
| `_id`          | ObjectId | Yes      | Primary key.                         |
| `userId`       | ObjectId | Yes      | Reference to reviewer (`users._id`). |
| `orderId`      | ObjectId | Yes      | Reference to purchased order.        |
| `orderCode`    | String   | No       | Business order code snapshot.        |
| `productId`    | ObjectId | Yes      | Reference to reviewed product.       |
| `productName`  | String   | No       | Product name snapshot.               |
| `productImage` | String   | No       | Product image snapshot.              |
| `rating`       | Number   | Yes      | Rating score from 1 to 5.            |
| `comment`      | String   | No       | Text feedback.                       |

Unique constraint:

- One review per user per order per product: `{ userId, orderId, productId }`.

---

### Audit Logs Collection (`auditlogs`)

Captures privileged actions for traceability and governance.

| Field     | Type     | Required | Description                                        |
| --------- | -------- | -------- | -------------------------------------------------- |
| `_id`     | ObjectId | Yes      | Primary key.                                       |
| `adminId` | ObjectId | Yes      | Reference to acting admin/staff account.           |
| `action`  | String   | Yes      | Action code.                                       |
| `target`  | String   | Yes      | Affected entity reference (e.g., `Order:ORD-...`). |
| `details` | Mixed    | No       | Structured payload with context before/after.      |
| `ip`      | String   | No       | Request source IP.                                 |

---

### AI Behavior and Analytics Collections

#### Recommendation Histories (`recommendhistories`)

Stores recommendation outputs per user.

| Field                         | Type          | Required | Description                     |
| ----------------------------- | ------------- | -------- | ------------------------------- |
| `_id`                         | ObjectId      | Yes      | Primary key.                    |
| `userId`                      | ObjectId      | Yes      | Reference to target user.       |
| `recommendations`             | Array[Object] | No       | Ranked recommendation list.     |
| `recommendations[].productId` | String        | Yes      | Recommended product identifier. |
| `recommendations[].score`     | Number        | No       | Ranking score.                  |
| `recommendations[].reason`    | String        | No       | Explainability text.            |

#### User Events (`userevents`)

Stores behavior telemetry for personalization and funnel analytics.

| Field       | Type     | Required | Description                                               |
| ----------- | -------- | -------- | --------------------------------------------------------- |
| `_id`       | ObjectId | Yes      | Primary key.                                              |
| `userId`    | ObjectId | No       | Nullable for guest activity.                              |
| `sessionId` | String   | Yes      | Session tracking key.                                     |
| `eventType` | String   | Yes      | `view_product`, `add_to_cart`, `purchase`, `view_recipe`. |
| `productId` | String   | No       | Product identifier associated with event.                 |
| `metadata`  | Mixed    | No       | Flexible contextual payload.                              |

Key indexes:

- `{ userId: 1, createdAt: -1 }`
- `{ productId: 1 }`
- `{ sessionId: 1, createdAt: -1 }`

#### Sessions (`sessions`)

Managed by `connect-mongo` for authentication persistence and expiration handling.

---

### Summary of the Updated Design

The updated schema provides stable e-commerce operations by separating transaction state (`orders`) from logistics execution (`shipments`) while keeping strict linkage to customer identity (`users`). This separation improves scalability for split shipments, tracking workflows, and post-delivery processes (returns/refunds), without losing historical financial accuracy.
