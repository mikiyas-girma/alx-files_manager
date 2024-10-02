import { expect } from 'chai';
import sinon from 'sinon';
import AppController from '../../controllers/AppController';
import dbClient from '../../utils/db';
import redisClient from '../../utils/redis';

describe('AppController', () => {
    describe('getStatus', () => {
        it('should return status 200 with redis and db status', () => {
            const req = {};
            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.stub()
            };

            sinon.stub(redisClient, 'isAlive').returns(true);
            sinon.stub(dbClient, 'isAlive').returns(true);

            AppController.getStatus(req, res);

            expect(res.status.calledWith(200)).to.be.true;
            expect(res.json.calledWith({ redis: true, db: true })).to.be.true;

            redisClient.isAlive.restore();
            dbClient.isAlive.restore();
        });
    });

    describe('getStats', () => {
        it('should return status 200 with total users and files', async () => {
            const req = {};
            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.stub()
            };

            sinon.stub(dbClient, 'nbUsers').resolves(5);
            sinon.stub(dbClient, 'nbFiles').resolves(10);

            await AppController.getStats(req, res);

            expect(res.status.calledWith(200)).to.be.true;
            expect(res.json.calledWith({ users: 5, files: 10 })).to.be.true;

            dbClient.nbUsers.restore();
            dbClient.nbFiles.restore();
        });
    });
});
