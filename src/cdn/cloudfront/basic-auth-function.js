function handler(event) {
  var authHeaders = event.request.headers.authorization;

  // The Base64-encoded Auth string that should be present.
  // It is an encoding of `Basic base64([username]:[password])`
  // The username and password are:
  //      Username: mce
  //      Password: password
  var expected = "Basic bWNlOnBhc3N3b3Jk";

  // If the Host header is "lesaffaires.com", pass the request without authentication
  // if (event.request.headers.host && event.request.headers.host.value === "lesaffaires.com") {
  //   return event.request;
  // }

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
