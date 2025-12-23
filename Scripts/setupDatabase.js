import pkg from 'pg';
import { exec } from 'child_process';
import 'dotenv/config';

const { Client } = pkg;

// Проверяем и создаем БД если не существует
async function setupDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: 'postgres' // Подключаемся к дефолтной БД
  });

  try {
    await client.connect();

    // Проверяем существование БД
    const dbCheck = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME || 'marketplace_dev'}'`
    );

    if (dbCheck.rows.length === 0) {
      console.log('Creating database...');
      await client.query(`CREATE DATABASE ${process.env.DB_NAME || 'marketplace_dev'}`);
      console.log('Database created successfully!');
    } else {
      console.log('Database already exists');
    }

    await client.end();

    // Запускаем миграции
    console.log('Running migrations...');
    exec('npm run migrate up', (error, stdout, stderr) => {
      if (error) {
        console.error('Migration error:', error);
        return;
      }
      console.log(stdout);
      console.log('Database setup completed!');
    });

  } catch (error) {
    console.error('Database setup error:', error.message);
    console.log('\nMake sure PostgreSQL is installed and running!');
    console.log('   You can install it from: https://www.postgresql.org/download/');
  }
}

setupDatabase();