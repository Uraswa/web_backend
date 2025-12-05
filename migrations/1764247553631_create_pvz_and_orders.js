// core/database/migrations/1764247553631_create_pvz_and_orders.js
export const up = (pgm) => {
  // ПВЗ (Point of Purchase/Pickup)
  pgm.createTable('opp', {
    opp_id: {
      type: 'serial',
      primaryKey: true
    },
    address: {
      type: 'varchar(500)',
      notNull: true
    },
    latitude: {
      type: 'float',
      notNull: true
    },
    longitude: {
      type: 'float',
      notNull: true
    },
    enabled: {
      type: 'boolean',
      notNull: true,
      default: true
    },
    work_time: {
      type: 'json'  // { "mon": "09:00-20:00", "tue": "09:00-20:00", ... }
    }
  });

  // Тип заказа
  pgm.createType('order_type', ['client', 'logistics']);

  // Заказы
  pgm.createTable('orders', {
    order_id: {
      type: 'serial',
      primaryKey: true
    },
    order_type: {
      type: 'order_type',
      notNull: true,
      default: 'client'
    },
    receiver_id: {
      type: 'integer',
      references: 'users(user_id)',
      notNull: true
    },
    opp_id: {
      type: 'integer',
      references: 'opp(opp_id)',
      notNull: true
    },
    created_date: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    received_date: {
      type: 'timestamp'
    }
  });

  // Индексы
  // pgm.createIndex('opp', 'enabled');
  // pgm.createIndex('opp', ['latitude', 'longitude']);
  // pgm.createIndex('orders', 'receiver_id');
  // pgm.createIndex('orders', 'opp_id');
  // pgm.createIndex('orders', 'order_type');
  // pgm.createIndex('orders', 'created_date');
};

export const down = (pgm) => {
  pgm.dropTable('orders');
  pgm.dropType('order_type');
  pgm.dropTable('opp');
};