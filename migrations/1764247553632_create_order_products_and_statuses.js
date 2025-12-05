// core/database/migrations/1764247553632_create_order_products_and_statuses.js
export const up = (pgm) => {
  // Товары в заказах
  pgm.createTable('order_products', {
    product_id: {
      type: 'integer',
      references: 'products(product_id)',
      primaryKey: true,
      onDelete: 'RESTRICT'
    },
    order_id: {
      type: 'integer',
      references: 'orders(order_id)',
      primaryKey: true,
      onDelete: 'CASCADE'
    },
    ordered_count: {
      type: 'integer',
      notNull: true,
      check: 'ordered_count > 0'
    },
    price: {
      type: 'decimal(10,2)',
      notNull: true
    },
    opp_received_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      check: 'opp_received_count >= 0 AND opp_received_count <= ordered_count'
    }
  });

  // Статусы заказов
  pgm.createType('order_status', ['packing', 'shipping', 'waiting', 'done', 'canceled']);

  pgm.createTable('order_statuses', {
    order_id: {
      type: 'integer',
      references: 'orders(order_id)',
      primaryKey: true,
      onDelete: 'CASCADE'
    },
    status: {
      type: 'order_status',
      notNull: true
    },
    date: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    data: {
      type: 'json'  // Дополнительная информация о статусе
    }
  });

  // Индексы
  // pgm.createIndex('order_products', 'order_id');
  // pgm.createIndex('order_statuses', 'status');
  // pgm.createIndex('order_statuses', 'date');
};

export const down = (pgm) => {
  pgm.dropTable('order_statuses');
  pgm.dropType('order_status');
  pgm.dropTable('order_products');
};