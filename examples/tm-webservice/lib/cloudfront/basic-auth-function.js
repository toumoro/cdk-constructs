function handler(event) {
  var authHeaders = event.request.headers.authorization;

  // The Base64-encoded Auth string that should be present.
  // It is an encoding of `Basic base64([username]:[password])`
  // The username and password are:
  //      Username: quebecca
  //      Password: j5t6i2e9w
  var expected = "Basic cXVlYmVjY2E6ajV0NmkyZTl3";
  

  // If the Host header is "example.com", pass the request without authentication
  if (event.request.headers.host && event.request.headers.host.value === "quebec.ca") {
    return event.request;
  }

  // If an Authorization header is supplied and it's an exact match, pass the
  // request on through to CF/the origin without any modification.
  if (authHeaders && authHeaders.value === expected) {
    return event.request;
  }

  // But if we get here, we must either be missing the auth header or the
  // credentials failed to match what we expected.
  // Request the browser present the Basic Auth dialog.
  var response = {
    statusCode: 401,
    statusDescription: "Unauthorized",
    headers: {
      "www-authenticate": {
        value: 'Basic realm="Authentification"',
      },
    },
  };

  return response;
}


// // REQUIREMENTS
// // cloudfront/
// //     functions/
// //     ├── basic-auth-function.js
// //     └── node_modules/
// //         └── aws-sdk/

// // cd functions/
// // npm init -y
// // npm install aws-sdk
// // zip -r function.zip .

// const AWS = require('aws-sdk');
// const ssm = new AWS.SSM();

// exports.handler = async (event) => {
//     const request = event.Records[0].cf.request;
//     const authHeaders = request.headers.authorization;
//     const paramName = '/cloudfrontStack/parameters/ExpectedBasicAuth';

//     let expected;
//     try {
//         const parameter = await ssm.getParameter({
//             Name: paramName,
//             WithDecryption: true
//         }).promise();

//         expected = parameter.Parameter.Value;
//     } catch (error) {
//         console.error("Error retrieving parameter from Parameter Store:", error);
//         return {
//             status: '500',
//             statusDescription: 'Internal Server Error',
//             body: 'Error retrieving parameter from Parameter Store',
//         };
//     }

//     if (authHeaders && authHeaders[0].value === expected) {
//         return request;
//     }

//     return {
//         status: '401',
//         statusDescription: 'Unauthorized',
//         headers: {
//             'www-authenticate': [{
//                 key: 'WWW-Authenticate',
//                 value: 'Basic realm="Authentication"',
//             }],
//         },
//     };
// };
