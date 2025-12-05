// 1764247553628_create_auth_tables.js
export const up = (pgm) => {
  pgm.createTable('users', {
    user_id: { type: 'serial', primaryKey: true },
    registration_date: { type: 'timestamp', default: pgm.func('current_timestamp') },
    is_active: { type: 'boolean', default: true },
    is_activated: { type: 'boolean', default: false },
  });

  pgm.createTable('user_login_info', {
    user_id: { type: 'serial', primaryKey: true },
    email: { type: 'varchar(256)', notNull: true, unique: true },
    password: { type: 'varchar(256)', notNull: true },
  });

  pgm.createTable('users_activation_links', {
    user_id: { type: 'serial', primaryKey: true },
    activation_link: {type: 'varchar(256)', unique: true}
  });

  pgm.createTable('users_password_change_tokens', {
    user_id: { type: 'serial', primaryKey: true },
    password_change_token: {type: 'varchar(256)', unique: true}
  });

  pgm.createTable('user_profiles', {
    user_id: {
      type: 'integer',
      references: 'users(user_id)',
      primaryKey: true
    },
    first_name: { type: 'varchar(100)' },
    last_name: { type: 'varchar(100)' }
  });
};