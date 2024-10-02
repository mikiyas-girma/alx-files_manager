import chai from "chai";
import chaiHttp from "chai-http";
import sinon from "sinon";
import sha1 from "sha1";
import dbClient from "../../utils/db";
import redisClient from "../../utils/redis";
import AuthController from "../../controllers/AuthController";

chai.use(chaiHttp);
const { expect } = chai;

describe("AuthController", () => {
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

  describe("getConnect", () => {
    it("should return 401 if Authorization header is missing", async () => {
      request.header.withArgs("Authorization").returns(null);

      await AuthController.getConnect(request, response);

      expect(response.status.calledWith(401)).to.be.true;
      expect(response.json.calledWith({ error: "Unauthorized" })).to.be.true;
    });

    it("should return 401 if credentials are invalid", async () => {
      request.header
        .withArgs("Authorization")
        .returns("Basic invalidcredentials");

      await AuthController.getConnect(request, response);

      expect(response.status.calledWith(401)).to.be.true;
      expect(response.json.calledWith({ error: "Unauthorized" })).to.be.true;
    });

    it("should return 401 if user is not found", async () => {
      const email = "test@example.com";
      const password = "password";
      const hashedPassword = sha1(password);
      const credentials = Buffer.from(`${email}:${password}`).toString(
        "base64"
      );
      request.header.withArgs("Authorization").returns(`Basic ${credentials}`);

      const collectionStub = sandbox.stub(dbClient.db, "collection").returns({
        findOne: sandbox.stub().yields(null, null),
      });

      await AuthController.getConnect(request, response);

      expect(collectionStub.calledWith("users")).to.be.true;
      expect(response.status.calledWith(401)).to.be.true;
      expect(response.json.calledWith({ error: "Unauthorized" })).to.be.true;
    });

    it("should return 200 and a token if user is found", async () => {
      const email = "test@example.com";
      const password = "password";
      const hashedPassword = sha1(password);
      const credentials = Buffer.from(`${email}:${password}`).toString(
        "base64"
      );
      request.header.withArgs("Authorization").returns(`Basic ${credentials}`);

      const user = { _id: "userId" };
      const collectionStub = sandbox.stub(dbClient.db, "collection").returns({
        findOne: sandbox.stub().yields(null, user),
      });

      await AuthController.getConnect(request, response);

      expect(collectionStub.calledWith("users")).to.be.true;
      expect(response.status.calledWith(200)).to.be.true;
      expect(response.json.calledOnce).to.be.true;
    });
  });

  describe("getDisconnect", () => {
    it("should return 401 if token is missing", async () => {
      request.header.withArgs("X-Token").returns(null);

      await AuthController.getDisconnect(request, response);

      expect(response.status.calledWith(401)).to.be.true;
      expect(response.json.calledWith({ error: "Unauthorized" })).to.be.true;
    });

    it("should return 401 if user is not found in Redis", async () => {
      const token = "someToken";
      request.header.withArgs("X-Token").returns(token);

      await AuthController.getDisconnect(request, response);

      expect(response.status.calledWith(401)).to.be.true;
      expect(response.json.calledWith({ error: "Unauthorized" })).to.be.true;
    });

    it("should return 204 if user is found and token is deleted", async () => {
      const token = "someToken";
      request.header.withArgs("X-Token").returns(token);
      // Stubbing redisClient.get to return a valid userId
      redisClient.get.resolves("userId");

      await AuthController.getDisconnect(request, response);

      expect(response.status.calledWith(204)).to.be.true;
    });
  });
});
