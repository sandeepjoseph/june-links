import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const inquiries = sqliteTable('inquiries', {
  id: text('id').primaryKey(), reference: text('reference').notNull().unique(),
  createdAt: integer('created_at').notNull(), name: text('name').notNull(),
  email: text('email').notNull(), tier: text('tier').notNull(),
  destination: text('destination').notNull(), payloadJson: text('payload_json').notNull(),
  payloadHash: text('payload_hash').notNull(), status: text('status').notNull().default('new'),
  privacyVersion: text('privacy_version').notNull()
});
export const inquiryLimits = sqliteTable('inquiry_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull()
});
export const inquiryNotifications = sqliteTable('inquiry_notifications', {
  inquiryId: text('inquiry_id').primaryKey().references(() => inquiries.id),
  recipient: text('recipient').notNull(), filename: text('filename').notNull(),
  status: text('status').notNull().default('pending'), attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: integer('next_attempt_at').notNull(), leaseUntil: integer('lease_until').notNull().default(0),
  attachmentBase64: text('attachment_base64'), providerId: text('provider_id'), errorCode: text('error_code'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull()
}, table => [index('inquiry_notifications_due').on(table.status,table.nextAttemptAt)]);
