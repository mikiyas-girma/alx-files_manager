import chai from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import app from '../../server'; // Assuming you have an Express app in app.js
import dbClient from '../../utils/db';
import redisClient from '../../utils/redis';
import AuthController from '../../controllers/AuthController';

chai.use(chaiHttp);
const { expect } = chai;

describe('AuthController', () => {
    let request;
    let response;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        request = {
            header: sinon.stub(),
        };
        response = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub(),
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('getConnect', () => {
        it('should return 401 if Authorization header is missing', async () => {
            request.header.withArgs('Authorization').returns(null);

            await AuthController.getConnect(request, response);

            expect(response.status.calledWith(401)).to.be.true;
            expect(response.json.calledWith({ error: 'Unauthorized' })).to.be.true;
        });

        it('should return 401 if credentials are invalid', async () => {
            request.header.withArgs('Authorization').returns('Basic invalidcredentials');

            await AuthController.getConnect(request, response);

            expect(response.status.calledWith(401)).to.be.true;
            expect(response.json.calledWith({ error: 'Unauthorized' })).to.be.true;
        });

        it('should return 401 if user is not found', async () => {
            const email = 'test@example.com';
            const password = 'password';
            const hashedPassword = sha1(password);
            const credentials = Buffer.from(`${email}:${password}`).toString('base64');
            request.header.withArgs('Authorization').returns(`Basic ${credentials}`);

            const usersStub = sandbox.stub(dbClient.db.collection('users'), 'findOne').yields(null, null);

            await AuthController.getConnect(request, response);

            expect(usersStub.calledWith({ email, password: hashedPassword })).to.be.true;
            expect(response.status.calledWith(401)).to.be.true;
            expect(response.json.calledWith({ error: 'Unauthorized' })).to.be.true;
        });

        it('should return 200 and a token if user is found', async () => {
            const email = 'test@example.com';
            const password = 'password';
            const hashedPassword = sha1(password);
            const credentials = Buffer.from(`${email}:${password}`).toString('base64');
            request.header.withArgs('Authorization').returns(`Basic ${credentials}`);

            const user = { _id: 'userId' };
            const usersStub = sandbox.stub(dbClient.db.collection('users'), 'findOne').yields(null, user);
            const redisStub = sandbox.stub(redisClient, 'set').resolves();

            await AuthController.getConnect(request, response);

            expect(usersStub.calledWith({ email, password: hashedPassword })).to.be.true;
            expect(redisStub.calledOnce).to.be.true;
            expect(response.status.calledWith(200)).to.be.true;
            expect(response.json.calledOnce).to.be.true;
        });
    });

    describe('getDisconnect', () => {
        it('should return 401 if token is missing', async () => {
            request.header.withArgs('X-Token').returns(null);

            await AuthController.getDisconnect(request, response);

            expect(response.status.calledWith(401)).to.be.true;
            expect(response.json.calledWith({ error: 'Unauthorized' })).to.be.true;
        });

        it('should return 401 if user is not found in Redis', async () => {
            const token = 'someToken';
            request.header.withArgs('X-Token').returns(token);

            const redisStub = sandbox.stub(redisClient, 'get').resolves(null);

            await AuthController.getDisconnect(request, response);

            expect(redisStub.calledWith(`auth_${token}`)).to.be.true;
            expect(response.status.calledWith(401)).to.be.true;
            expect(response.json.calledWith({ error: 'Unauthorized' })).to.be.true;
        });

        it('should return 204 if user is found and token is deleted', async () => {
            const token = 'someToken';
            request.header.withArgs('X-Token').returns(token);

            const redisGetStub = sandbox.stub(redisClient, 'get').resolves('userId');
            const redisDelStub = sandbox.stub(redisClient, 'del').resolves();

            await AuthController.getDisconnect(request, response);

            expect(redisGetStub.calledWith(`auth_${token}`)).to.be.true;
            expect(redisDelStub.calledWith(`auth_${token}`)).to.be.true;
            expect(response.status.calledWith(204)).to.be.true;
            expect(response.json.calledOnce).to.be.true;
        });
    });
});
