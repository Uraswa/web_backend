// core/database/migrations/1764247553630_create_products_and_feedback.js
export const up = (pgm) => {
  // Товары
  pgm.createTable('products', {
    product_id: {
      type: 'serial',
      primaryKey: true
    },
    category_id: {
      type: 'integer',
      references: 'product_categories(category_id)',
      notNull: true
    },
    shop_id: {
      type: 'integer',
      references: 'shops(shop_id)',
      onDelete: 'CASCADE',
      notNull: true
    },
    name: {
      type: 'varchar(255)',
      notNull: true
    },
    description: {
      type: 'text'
    },
    photos: {
      type: 'text'  // JSON массив ссылок на Yandex Cloud
    },
    price: {
      type: 'decimal(10,2)',
      notNull: true
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('current_timestamp')
    }
  });

  // Отзывы
  pgm.createTable('feedback', {
    user_id: {
      type: 'integer',
      references: 'users(user_id)',
      primaryKey: true
    },
    product_id: {
      type: 'integer',
      references: 'products(product_id)',
      primaryKey: true
    },
    rate: {
      type: 'smallint',
      notNull: true,  // 1-5
      check: 'rate >= 1 AND rate <= 5'
    },
    good_text: {
      type: 'text'
    },
    bad_text: {
      type: 'text'
    },
    comment: {
      type: 'text'
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('current_timestamp')
    }
  });

  // Индексы
  // pgm.createIndex('products', 'category_id');
  // pgm.createIndex('products', 'shop_id');
  // pgm.createIndex('products', 'created_at');
  // pgm.createIndex('feedback', 'product_id');
  // pgm.createIndex('feedback', 'rate');
};

export const down = (pgm) => {
  pgm.dropTable('feedback');
  pgm.dropTable('products');
};