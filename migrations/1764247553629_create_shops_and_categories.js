// core/database/migrations/1764247553629_create_shops_and_categories.js
export const up = (pgm) => {
  // Категории товаров
  pgm.createTable('product_categories', {
    category_id: {
      type: 'serial',
      primaryKey: true
    },
    parent_category_id: {
      type: 'integer',
      references: 'product_categories(category_id)',
      onDelete: 'CASCADE'
    },
    name: {
      type: 'varchar(255)',
      notNull: true
    }
  });

  // Магазины
  pgm.createTable('shops', {
    shop_id: {
      type: 'serial',
      primaryKey: true
    },
    owner_id: {
      type: 'integer',
      references: 'users(user_id)',
      notNull: true
    },
    name: {
      type: 'varchar(255)',
      notNull: true
    },
    description: {
      type: 'text'
    }
  });

  // Индексы
  // pgm.createIndex('product_categories', 'parent_category_id');
  // pgm.createIndex('shops', 'owner_id');
};

export const down = (pgm) => {
  pgm.dropTable('shops');
  pgm.dropTable('product_categories');
};