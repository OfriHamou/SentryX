import express from "express";
import request from "supertest";
import { mountDocumentationRoutes } from "./routes";
import { openApiSpecification, validateOpenApiSpecification } from "./swagger";

describe("OpenAPI documentation", () => {
    it("generates a valid, non-empty OpenAPI 3 document with JWT bearer authentication", async () => {
        expect(openApiSpecification.openapi).toMatch(/^3\./);
        expect(Object.keys(openApiSpecification.paths)).not.toHaveLength(0);
        expect(openApiSpecification.components.securitySchemes.bearerAuth).toMatchObject({
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
        });
        await expect(validateOpenApiSpecification()).resolves.toBeUndefined();
    });

    it("documents the current protected OnCall contract", () => {
        const currentDuty = openApiSpecification.paths["/api/on-call/me"].get;
        const tasks = openApiSpecification.paths["/api/on-call/tasks"].get;

        expect(currentDuty.security).toEqual([{ bearerAuth: [] }]);
        expect(tasks.security).toEqual([{ bearerAuth: [] }]);
        expect(currentDuty.description).toContain("on_call:read");
        expect(tasks.description).toContain("on_call:read");
        expect(tasks.parameters.map((parameter: { name?: string; $ref?: string }) =>
            parameter.name || parameter.$ref
        )).toEqual([
            "status",
            "#/components/parameters/Limit",
            "#/components/parameters/Offset",
        ]);
        expect(
            openApiSpecification.components.schemas.CurrentDutyResponse
                .properties.currentShift.allOf[0].$ref
        ).toBe("#/components/schemas/OnCallCurrentShift");
    });

    it("serves the generated document without initializing the database", async () => {
        const app = express();
        mountDocumentationRoutes(app);

        const response = await request(app)
            .get("/api-docs.json")
            .expect("Content-Type", /json/)
            .expect(200);

        expect(response.body.openapi).toBe(openApiSpecification.openapi);
        expect(response.body.paths).toBeDefined();
        expect(response.body.components.securitySchemes.bearerAuth.scheme).toBe("bearer");

        const uiResponse = await request(app)
            .get("/api-docs/")
            .expect("Content-Type", /html/)
            .expect(200);

        expect(uiResponse.text).toContain('id="swagger-ui"');
    });
});
