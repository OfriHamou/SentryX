# SentryX backend

Install dependencies and start the TypeScript development server:

```bash
npm install
npm run dev
```

Swagger UI is available at `http://localhost:4000/api-docs`, and the raw OpenAPI document is available at `http://localhost:4000/api-docs.json`.

To call protected endpoints, log in, copy the returned JWT `accessToken`, select **Authorize** in Swagger UI, and paste the access token. Do not paste the refresh token. Set `API_PUBLIC_URL` to the externally reachable backend origin (for example, `https://api.example.test`) to publish an explicit deployed-server entry in the specification.

