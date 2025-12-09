// core/database/migrations/[timestamp]_add_cascade_to_foreign_keys.js
export const up = async (pgm) => {
  // 1. Изменяем foreign key в таблице user_profiles
  pgm.dropConstraint('user_profiles', 'user_profiles_user_id_fkey');
  pgm.addConstraint('user_profiles', 'user_profiles_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });

  // 2. Изменяем foreign key в таблице user_login_info
  pgm.addConstraint('user_login_info', 'user_login_info_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });

  // 3. Изменяем foreign key в таблице users_activation_links
    pgm.addConstraint('users_activation_links', 'users_activation_links_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });

  // 4. Изменяем foreign key в таблице users_password_change_tokens
  pgm.addConstraint('users_password_change_tokens', 'users_password_change_tokens_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });

  // 5. Изменяем foreign key в таблице shops (owner_id -> users)
  pgm.dropConstraint('shops', 'shops_owner_id_fkey');
  pgm.addConstraint('shops', 'shops_owner_id_fkey', {
    foreignKeys: {
      columns: 'owner_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });

  // 6. Изменяем foreign key в таблице products (category_id -> product_categories)
  pgm.dropConstraint('products', 'products_category_id_fkey');
  pgm.addConstraint('products', 'products_category_id_fkey', {
    foreignKeys: {
      columns: 'category_id',
      references: 'product_categories(category_id)',
      onDelete: 'CASCADE'
    }
  });

  // 7. Изменяем foreign key в таблице feedback (user_id -> users)
  pgm.dropConstraint('feedback', 'feedback_user_id_fkey');
  pgm.addConstraint('feedback', 'feedback_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });

  // 8. Изменяем foreign key в таблице feedback (product_id -> products) - это основная ошибка
  pgm.dropConstraint('feedback', 'feedback_product_id_fkey');
  pgm.addConstraint('feedback', 'feedback_product_id_fkey', {
    foreignKeys: {
      columns: 'product_id',
      references: 'products(product_id)',
      onDelete: 'CASCADE'
    }
  });

  // 9. Изменяем foreign key в таблице orders (receiver_id -> users)
  pgm.dropConstraint('orders', 'orders_receiver_id_fkey');
  pgm.addConstraint('orders', 'orders_receiver_id_fkey', {
    foreignKeys: {
      columns: 'receiver_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });

  // 10. Изменяем foreign key в таблице orders (opp_id -> opp)
  pgm.dropConstraint('orders', 'orders_opp_id_fkey');
  pgm.addConstraint('orders', 'orders_opp_id_fkey', {
    foreignKeys: {
      columns: 'opp_id',
      references: 'opp(opp_id)',
      onDelete: 'CASCADE'
    }
  });

  // 11. Изменяем foreign key в таблице order_products (product_id -> products)
  pgm.dropConstraint('order_products', 'order_products_product_id_fkey');
  pgm.addConstraint('order_products', 'order_products_product_id_fkey', {
    foreignKeys: {
      columns: 'product_id',
      references: 'products(product_id)',
      onDelete: 'CASCADE'
    }
  });

  // 12. Изменяем foreign key в таблице users_tokens (user_id -> users)
  pgm.dropConstraint('users_tokens', 'users_tokens_user_id_fkey');
  pgm.addConstraint('users_tokens', 'users_tokens_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });
};

export const down = async (pgm) => {
  // Восстанавливаем обратно все foreign keys без CASCADE (будет NO ACTION по умолчанию)

  // 1. user_profiles
  pgm.dropConstraint('user_profiles', 'user_profiles_user_id_fkey');
  pgm.addConstraint('user_profiles', 'user_profiles_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)'
    }
  });

  // 2. user_login_info
  pgm.dropConstraint('user_login_info', 'user_login_info_user_id_fkey');
  pgm.addConstraint('user_login_info', 'user_login_info_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)'
    }
  });

  // 3. users_activation_links
  pgm.dropConstraint('users_activation_links', 'users_activation_links_user_id_fkey');
  pgm.addConstraint('users_activation_links', 'users_activation_links_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)'
    }
  });

  // 4. users_password_change_tokens
  pgm.dropConstraint('users_password_change_tokens', 'users_password_change_tokens_user_id_fkey');
  pgm.addConstraint('users_password_change_tokens', 'users_password_change_tokens_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)'
    }
  });

  // 5. shops
  pgm.dropConstraint('shops', 'shops_owner_id_fkey');
  pgm.addConstraint('shops', 'shops_owner_id_fkey', {
    foreignKeys: {
      columns: 'owner_id',
      references: 'users(user_id)'
    }
  });

  // 6. products (category_id)
  pgm.dropConstraint('products', 'products_category_id_fkey');
  pgm.addConstraint('products', 'products_category_id_fkey', {
    foreignKeys: {
      columns: 'category_id',
      references: 'product_categories(category_id)'
    }
  });

  // 7. feedback (user_id)
  pgm.dropConstraint('feedback', 'feedback_user_id_fkey');
  pgm.addConstraint('feedback', 'feedback_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)'
    }
  });

  // 8. feedback (product_id)
  pgm.dropConstraint('feedback', 'feedback_product_id_fkey');
  pgm.addConstraint('feedback', 'feedback_product_id_fkey', {
    foreignKeys: {
      columns: 'product_id',
      references: 'products(product_id)'
    }
  });

  // 9. orders (receiver_id)
  pgm.dropConstraint('orders', 'orders_receiver_id_fkey');
  pgm.addConstraint('orders', 'orders_receiver_id_fkey', {
    foreignKeys: {
      columns: 'receiver_id',
      references: 'users(user_id)'
    }
  });

  // 10. orders (opp_id)
  pgm.dropConstraint('orders', 'orders_opp_id_fkey');
  pgm.addConstraint('orders', 'orders_opp_id_fkey', {
    foreignKeys: {
      columns: 'opp_id',
      references: 'opp(opp_id)'
    }
  });

  // 11. order_products (product_id)
  pgm.dropConstraint('order_products', 'order_products_product_id_fkey');
  pgm.addConstraint('order_products', 'order_products_product_id_fkey', {
    foreignKeys: {
      columns: 'product_id',
      references: 'products(product_id)'
    }
  });

  // 12. users_tokens
  pgm.dropConstraint('users_tokens', 'users_tokens_user_id_fkey');
  pgm.addConstraint('users_tokens', 'users_tokens_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)'
    }
  });
};