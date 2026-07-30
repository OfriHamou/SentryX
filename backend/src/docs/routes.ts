import type { Application } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpecification } from "./swagger";

export function mountDocumentationRoutes(app: Application): void {
    app.get("/api-docs.json", (_req, res) => {
        res.status(200).json(openApiSpecification);
    });

    app.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(openApiSpecification, {
            explorer: true,
            swaggerOptions: {
                persistAuthorization: true,
            },
            customSiteTitle: "SentryX API documentation",
        }),
    );
}

