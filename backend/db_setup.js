require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const dbName = process.env.DB_NAME || 'parking_system_mvp';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function databaseExists(connection) {
  const [rows] = await connection.query('SHOW DATABASES LIKE ?', [dbName]);
  return rows.length > 0;
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_name = ?
      LIMIT 1
    `,
    [dbName, tableName]
  );
  return rows.length > 0;
}

async function getCount(connection, tableName) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
  return rows[0]?.total || 0;
}

async function migrateParkingSpotsColumns(connection) {
  const [cols] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'parking_spots'`,
    [dbName]
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));

  if (!names.has('price_coefficient')) {
    await connection.query(
      `ALTER TABLE parking_spots ADD COLUMN price_coefficient DECIMAL(10,4) NOT NULL DEFAULT 1`
    );
    console.log('- Migration: added parking_spots.price_coefficient');
  }
  if (names.has('zone_color')) {
    await connection.query(`ALTER TABLE parking_spots DROP COLUMN zone_color`);
    console.log('- Migration: dropped parking_spots.zone_color');
  }

  const [zoneCol] = await connection.query(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS len
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'parking_spots' AND COLUMN_NAME = 'zone'`,
    [dbName]
  );
  if (zoneCol.length > 0 && zoneCol[0].len != null && Number(zoneCol[0].len) < 120) {
    await connection.query(`ALTER TABLE parking_spots MODIFY COLUMN zone VARCHAR(120) NULL`);
    console.log('- Migration: widened parking_spots.zone to VARCHAR(120)');
  }
}

async function migrateVehiclesColumns(connection) {
  const [cols] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vehicles'`,
    [dbName]
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));
  if (names.has('is_archived')) {
    await connection.query(`ALTER TABLE vehicles DROP COLUMN is_archived`);
    console.log('- Migration: dropped vehicles.is_archived');
  }
}

async function migrateParkingSessionsPaymentStatus(connection) {
  const [cols] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'parking_sessions'`,
    [dbName]
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));
  if (!names.has('payment_status')) {
    await connection.query(
      `ALTER TABLE parking_sessions ADD COLUMN payment_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid'`
    );
    console.log('- Migration: added parking_sessions.payment_status');
  }
  if (!names.has('day_rate_snapshot')) {
    await connection.query(
      `ALTER TABLE parking_sessions ADD COLUMN day_rate_snapshot DECIMAL(10,2) NULL`
    );
    console.log('- Migration: added parking_sessions.day_rate_snapshot');
  }
  if (!names.has('night_rate_snapshot')) {
    await connection.query(
      `ALTER TABLE parking_sessions ADD COLUMN night_rate_snapshot DECIMAL(10,2) NULL`
    );
    console.log('- Migration: added parking_sessions.night_rate_snapshot');
  }
  await connection.query(
    `UPDATE parking_sessions ps
     JOIN tariffs t ON t.id = ps.tariff_id
     SET
       ps.day_rate_snapshot = CASE
         WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN COALESCE(t.day_price, t.price_per_hour)
         WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN COALESCE(t.weekday_price, t.price_per_hour)
         ELSE t.price_per_hour
       END,
       ps.night_rate_snapshot = CASE
         WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN COALESCE(t.night_price, t.price_per_hour)
         WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN COALESCE(t.weekend_price, t.price_per_hour)
         ELSE t.price_per_hour
       END
     WHERE
       ps.day_rate_snapshot IS NULL OR ps.night_rate_snapshot IS NULL
       OR (ps.day_rate_snapshot = 0 AND ps.night_rate_snapshot = 0)`
  );
}

async function ensureParkingSessionsIndexes(connection) {
  const specs = [
    {
      name: 'idx_parking_sessions_status',
      sql: 'CREATE INDEX idx_parking_sessions_status ON parking_sessions(status)',
    },
    {
      name: 'idx_parking_sessions_start_time',
      sql: 'CREATE INDEX idx_parking_sessions_start_time ON parking_sessions(start_time)',
    },
  ];

  for (const { name, sql } of specs) {
    const [rows] = await connection.query(
      `SELECT 1 FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = 'parking_sessions' AND index_name = ?
       LIMIT 1`,
      [dbName, name]
    );
    if (rows.length === 0) {
      await connection.query(sql);
      console.log(`- Added index ${name}`);
    }
  }
}

async function checkDatabaseStatus() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const exists = await databaseExists(connection);
    if (!exists) {
      console.log(`\nDatabase "${dbName}" does not exist.`);
      return;
    }

    console.log(`\nDatabase "${dbName}" exists.`);
    await connection.query(`USE \`${dbName}\``);

    const requiredTables = ['users', 'parking_spots', 'vehicles', 'tariffs', 'parking_sessions'];
    for (const tableName of requiredTables) {
      const existsTable = await tableExists(connection, tableName);
      if (!existsTable) {
        console.log(`- Table "${tableName}": missing`);
        continue;
      }

      const total = await getCount(connection, tableName);
      console.log(`- Table "${tableName}": OK (${total} rows)`);
    }
  } finally {
    await connection.end();
  }
}

async function initializeDatabase() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        login VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS parking_spots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        spot_number VARCHAR(20) NOT NULL UNIQUE,
        status ENUM('free', 'occupied') NOT NULL DEFAULT 'free',
        zone VARCHAR(120) NULL,
        note VARCHAR(255) NULL,
        price_coefficient DECIMAL(10,4) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await migrateParkingSpotsColumns(connection);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_plate VARCHAR(20) NOT NULL UNIQUE,
        brand VARCHAR(100) NULL,
        vehicle_type VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await migrateVehiclesColumns(connection);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tariffs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        smart_mode TINYINT(1) NOT NULL DEFAULT 0,
        smart_type ENUM('day_night', 'weekday_weekend') NULL,
        price_per_hour DECIMAL(10,2) NOT NULL,
        min_price DECIMAL(10,2) NOT NULL,
        day_price DECIMAL(10,2) NULL,
        night_price DECIMAL(10,2) NULL,
        weekday_price DECIMAL(10,2) NULL,
        weekend_price DECIMAL(10,2) NULL,
        day_start TIME NULL,
        day_end TIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS parking_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parking_spot_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NULL,
        total_cost DECIMAL(10,2) NULL,
        status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
        payment_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
        day_rate_snapshot DECIMAL(10,2) NULL,
        night_rate_snapshot DECIMAL(10,2) NULL,
        tariff_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sessions_spot FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id),
        CONSTRAINT fk_sessions_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
        CONSTRAINT fk_sessions_tariff FOREIGN KEY (tariff_id) REFERENCES tariffs(id)
      )
    `);

    await migrateParkingSessionsPaymentStatus(connection);

    await ensureParkingSessionsIndexes(connection);

    const [users] = await connection.query('SELECT id FROM users WHERE login = ? LIMIT 1', ['admin']);
    if (users.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await connection.query(
        'INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)',
        ['admin', passwordHash, 'admin']
      );
      console.log('- Seeded admin user: login "admin", password "admin123"');
    } else {
      console.log('- Admin user already exists');
    }

    const [spots] = await connection.query('SELECT COUNT(*) AS total FROM parking_spots');
    if ((spots[0]?.total || 0) === 0) {
      const values = [];
      for (let i = 1; i <= 10; i += 1) {
        values.push([`A-${String(i).padStart(2, '0')}`, 'free']);
      }
      await connection.query('INSERT INTO parking_spots (spot_number, status) VALUES ?', [values]);
      console.log('- Seeded 10 parking spots');
    } else {
      console.log('- Parking spots already seeded');
    }

    const [activeTariffs] = await connection.query(
      'SELECT id FROM tariffs WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );
    if (activeTariffs.length === 0) {
      await connection.query(
        `
          INSERT INTO tariffs (
            is_active,
            smart_mode,
            smart_type,
            price_per_hour,
            min_price,
            day_price,
            night_price,
            weekday_price,
            weekend_price,
            day_start,
            day_end
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [1, 0, null, 20, 20, null, null, null, null, null, null]
      );
      console.log('- Seeded default active tariff (basic mode)');
    } else {
      console.log('- Active tariff already exists');
    }

    console.log(`\nDatabase "${dbName}" initialized successfully.`);
  } finally {
    await connection.end();
  }
}

async function dropDatabase() {
  const confirm = await ask(
    `Type "DROP" to confirm deleting database "${dbName}" (all data will be lost): `
  );
  if (confirm !== 'DROP') {
    console.log('Deletion cancelled.');
    return;
  }

  const connection = await mysql.createConnection(dbConfig);
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    console.log(`Database "${dbName}" deleted.`);
  } finally {
    await connection.end();
  }
}

async function main() {
  try {
    console.log('\n=== DB Setup Menu ===');
    console.log('1. Check database status');
    console.log('2. Initialize database (create all + seed)');
    console.log('3. Delete database');

    const choice = await ask('\nChoose option (1/2/3): ');

    if (choice === '1') {
      await checkDatabaseStatus();
    } else if (choice === '2') {
      await initializeDatabase();
    } else if (choice === '3') {
      await dropDatabase();
    } else {
      console.log('Unknown option. Use 1, 2, or 3.');
    }
  } catch (error) {
    console.error('\nDB setup failed:', error.message);
  } finally {
    rl.close();
  }
}

main();
