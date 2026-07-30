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

    it("documents tenant-scoped Organization Robot management", () => {
        const collection = openApiSpecification.paths["/api/organization/robots"];
        const item = openApiSpecification.paths["/api/organization/robots/{id}"];
        const restore = openApiSpecification.paths["/api/organization/robots/{id}/restore"];

        expect(collection.get.security).toEqual([{ bearerAuth: [] }]);
        expect(collection.post.security).toEqual([{ bearerAuth: [] }]);
        expect(item.put.security).toEqual([{ bearerAuth: [] }]);
        expect(item.delete.security).toEqual([{ bearerAuth: [] }]);
        expect(restore.patch.security).toEqual([{ bearerAuth: [] }]);
        expect(collection.get.description).toContain("organization_robots:read");
        expect(collection.post.description).toContain("organization_robots:write");
        expect(item.put.description).toContain("organization_robots:write");
        expect(item.delete.description).toContain("organization_robots:write");
        expect(restore.patch.description).toContain("organization_robots:write");
        expect(collection.post.responses["201"]).toBeDefined();
        expect(collection.post.responses["400"]).toBeDefined();
        expect(item.put.responses["404"]).toBeDefined();
        expect(item.put.responses["409"]).toBeDefined();
        expect(item.delete.responses["200"].content["application/json"].schema.oneOf).toHaveLength(2);
        expect(restore.patch.responses["404"]).toBeDefined();
        expect(collection.get.parameters[0].schema.enum).toEqual(["active", "archived", "all"]);
        expect(openApiSpecification.components.schemas.OrganizationRobot.properties.archivedAt).toBeDefined();
    });

    it("documents dedicated platform-wide Admin Alert management", () => {
        const collection = openApiSpecification.paths["/api/admin/alerts"].get;
        const details = openApiSpecification.paths["/api/admin/alerts/{id}"].get;
        const status = openApiSpecification.paths["/api/admin/alerts/{id}/status"].patch;
        const image = openApiSpecification.paths["/api/admin/alerts/{id}/image"].get;

        expect(collection.security).toEqual([{ bearerAuth: [] }]);
        expect(collection.description).toContain("admin_alerts:read");
        expect(collection.description).toContain("not restricted");
        expect(status.description).toContain("admin_alerts:write");
        expect(details.responses["404"]).toBeDefined();
        expect(status.responses["409"]).toBeDefined();
        expect(image.responses["200"].content["image/jpeg"]).toBeDefined();
        expect(collection.parameters.map((parameter: { name?: string; $ref?: string }) =>
            parameter.name || parameter.$ref
        )).toEqual([
            "status",
            "tenantId",
            "from",
            "to",
            "search",
            "#/components/parameters/Limit",
            "#/components/parameters/Offset",
        ]);
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
