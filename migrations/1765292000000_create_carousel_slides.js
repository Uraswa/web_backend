// Создание таблицы рекламных слайдов карусели
export const up = (pgm) => {
  pgm.createTable('carousel_slides', {
    slide_id: {
      type: 'serial',
      primaryKey: true
    },
    type: {
      type: 'varchar(50)',
      notNull: true
    },
    title: {
      type: 'text'
    },
    description: {
      type: 'text'
    },
    button_text: {
      type: 'varchar(255)'
    },
    button_link: {
      type: 'varchar(255)'
    },
    image_url: {
      type: 'text',
      notNull: true
    },
    slide_order: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('carousel_slides', ['slide_order', 'slide_id']);
};

export const down = (pgm) => {
  pgm.dropTable('carousel_slides');
};
