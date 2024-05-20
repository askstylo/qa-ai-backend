const { createClient } = require('redis');

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.on('get', (key) => {
  console.log('Redis Client Get', key);
});

redisClient.on('set', (key, value) => {
  console.log('Redis Client Set', key, value);
}); 

(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

module.exports = redisClient;
