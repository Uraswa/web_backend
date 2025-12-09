// core/database/migrations/[timestamp]_add_is_admin_and_opp_owner_id.js
export const up = async (pgm) => {
  pgm.addColumn('users', {
    is_admin: {
      type: 'boolean',
      notNull: true,
      default: false
    }
  });
pgm.addColumn('opp', {
    owner_id: {
      type: 'integer',
      references: 'users(user_id)',
      onDelete: 'CASCADE'
    }
  });
};

export const down = async (pgm) => {
  // 1. Удаляем поле is_admin из users
  pgm.dropColumn('users', 'is_admin');

  // 2. Удаляем foreign key constraint из opp.owner_id
  pgm.dropConstraint('opp', 'opp_owner_id_fkey');

  // 3. Удаляем поле owner_id из opp
  pgm.dropColumn('opp', 'owner_id');
};