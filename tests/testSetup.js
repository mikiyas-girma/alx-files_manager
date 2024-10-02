import sinon from 'sinon';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { MongoClient } from 'mongodb';
import { createClient } from 'redis';
import { expect } from 'chai';

// Mock MongoDB connection
const mockMongoDB = () => {
  const dbStub = sinon.stub(dbClient, 'db');
  dbStub.value({
    collection: () => ({
      countDocuments: sinon.stub().resolves(0), // Stub the countDocuments method
    }),
  });
};

// Mock Redis connection
const mockRedis = () => {
  sinon.stub(redisClient.redis, 'connected').value(true);
  sinon.stub(redisClient, 'get').resolves(null);
  sinon.stub(redisClient, 'set').resolves();
  sinon.stub(redisClient, 'del').resolves();
};

// Before each test, mock the MongoDB and Redis connections
beforeEach(() => {
  mockMongoDB();
  mockRedis();
});

// After each test, restore the original behavior
afterEach(() => {
  sinon.restore();
});

