// core/database/migrations/1766000000001_create_newsletter_subscriptions.js
export const up = (pgm) => {
  pgm.createTable('newsletter_subscriptions', {
    subscription_id: {
      type: 'serial',
      primaryKey: true
    },
    email: {
      type: 'varchar(256)',
      notNull: true,
      unique: true
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    unsubscribed_at: {
      type: 'timestamp'
    }
  });
};

export const down = (pgm) => {
  pgm.dropTable('newsletter_subscriptions');
};
