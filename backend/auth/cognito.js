const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

let cognitoClient = null;
let jwksClient = null;

function getCognitoConfig() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const region = process.env.COGNITO_REGION || 'us-east-1';

  return { userPoolId, clientId, region };
}

function getCognitoClient() {
  if (!cognitoClient) {
    const { region } = getCognitoConfig();
    const config = { region };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    cognitoClient = new CognitoIdentityProviderClient(config);
  }
  return cognitoClient;
}

function getJwksClient() {
  if (!jwksClient) {
    const { userPoolId, region } = getCognitoConfig();
    if (!userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID is not configured');
    }
    const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    jwksClient = jwksRsa({
      jwksUri,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }
  return jwksClient;
}

async function createUser(email, password, name) {
  const client = getCognitoClient();
  const { userPoolId } = getCognitoConfig();

  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID is required');
  }

  const userAttributes = [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' },
  ];

  if (name) {
    userAttributes.push({ Name: 'name', Value: name });
  }

  const createCmd = new AdminCreateUserCommand({
    UserPoolId: userPoolId,
    Username: email,
    UserAttributes: userAttributes,
    MessageAction: 'SUPPRESS',
  });

  const createRes = await client.send(createCmd);

  let cognitoSub = null;
  if (createRes.User && createRes.User.Attributes) {
    const subAttr = createRes.User.Attributes.find((attr) => attr.Name === 'sub');
    if (subAttr) {
      cognitoSub = subAttr.Value;
    }
  }

  const setPasswordCmd = new AdminSetUserPasswordCommand({
    UserPoolId: userPoolId,
    Username: email,
    Password: password,
    Permanent: true,
  });

  await client.send(setPasswordCmd);

  return { cognitoSub };
}

async function authenticateUser(email, password) {
  const client = getCognitoClient();
  const { userPoolId, clientId } = getCognitoConfig();

  if (!userPoolId || !clientId) {
    throw new Error('COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are required');
  }

  const authCmd = new AdminInitiateAuthCommand({
    UserPoolId: userPoolId,
    ClientId: clientId,
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  const authRes = await client.send(authCmd);
  const result = authRes.AuthenticationResult;

  if (!result) {
    throw new Error('Cognito authentication failed: No authentication result returned');
  }

  return {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: result.RefreshToken,
    expiresIn: result.ExpiresIn,
  };
}

async function deleteUser(username) {
  const client = getCognitoClient();
  const { userPoolId } = getCognitoConfig();

  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID is required');
  }

  const deleteCmd = new AdminDeleteUserCommand({
    UserPoolId: userPoolId,
    Username: username,
  });

  await client.send(deleteCmd);
}

async function getUser(username) {
  const client = getCognitoClient();
  const { userPoolId } = getCognitoConfig();

  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID is required');
  }

  const getCmd = new AdminGetUserCommand({
    UserPoolId: userPoolId,
    Username: username,
  });

  return await client.send(getCmd);
}

function getKey(header, callback) {
  const jwks = getJwksClient();
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey ? key.getPublicKey() : key.rsaPublicKey;
    callback(null, signingKey);
  });
}

async function verifyToken(token) {
  const { userPoolId, clientId, region } = getCognitoConfig();
  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID is required for token verification');
  }

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer,
      },
      (err, decoded) => {
        if (err) {
          return reject(err);
        }
        if (!decoded || decoded.token_use !== 'access') {
          return reject(new Error(`Invalid token_use claim: expected access, got ${decoded ? decoded.token_use : 'undefined'}`));
        }
        if (clientId && decoded.client_id && decoded.client_id !== clientId) {
          return reject(new Error(`Client ID mismatch: expected ${clientId}, got ${decoded.client_id}`));
        }
        resolve(decoded);
      }
    );
  });
}

module.exports = {
  createUser,
  authenticateUser,
  deleteUser,
  getUser,
  verifyToken,
};

