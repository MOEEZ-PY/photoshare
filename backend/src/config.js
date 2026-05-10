'use strict';

function required(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`FATAL: Environment variable ${name} is required but not set.`);
    process.exit(1);
  }
  return val;
}

function optional(name, defaultValue) {
  return process.env[name] ?? defaultValue;
}

const config = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '3000'), 10),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '24h'),
  DB_PATH: optional('DB_PATH', './data/photobazaar.db'),
  UPLOAD_DIR: optional('UPLOAD_DIR', './uploads'),
  MAX_PHOTO_SIZE_MB: parseInt(optional('MAX_PHOTO_SIZE_MB', '10'), 10),
  MAX_VIDEO_SIZE_MB: parseInt(optional('MAX_VIDEO_SIZE_MB', '100'), 10),
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY', ''),
  AZURE_STORAGE_CONNECTION_STRING: optional('AZURE_STORAGE_CONNECTION_STRING', ''),
  AZURE_STORAGE_CONTAINER_NAME: optional('AZURE_STORAGE_CONTAINER_NAME', 'uploads'),
  SEED_CREATORS: (() => {
    const raw = optional(
      'SEED_CREATORS',
      JSON.stringify([
        {
          username: 'creator1',
          email: 'creator1@photobazaar.app',
          password: 'Creator@123',
          display_name: 'Creator One',
        },
        {
          username: 'creator2',
          email: 'creator2@photobazaar.app',
          password: 'Creator@456',
          display_name: 'Creator Two',
        },
      ])
    );
    try {
      return JSON.parse(raw);
    } catch {
      console.error('FATAL: SEED_CREATORS must be valid JSON.');
      process.exit(1);
    }
  })(),
};

module.exports = config;
