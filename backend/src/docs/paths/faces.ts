import { idParameter, publicOperation, ref, secured, tenantScopedDescription } from "../helpers";
import type { OpenApiObject, OpenApiPaths } from "../types";

const faceId = idParameter("Authorized Face UUID");
const faceResponse = (description: string): OpenApiObject => ({
    description,
    content: { "application/json": { schema: {
        type: "object",
        required: ["ok", "face"],
        properties: { ok: { type: "boolean" }, face: ref("AuthorizedFace") },
    } } },
});
const photosBody = (includeName: boolean): OpenApiObject => ({
    required: true,
    content: {
        "multipart/form-data": {
            schema: {
                type: "object",
                ...(includeName ? { required: ["name"] } : { required: ["photos"] }),
                properties: {
                    ...(includeName ? {
                        name: { type: "string" },
                        role: { type: "string", nullable: true },
                    } : {}),
                    photos: {
                        type: "array",
                        items: { type: "string", format: "binary" },
                    },
                },
            },
        },
    },
});
const imageResponses = {
    "200": {
        description: "Stored image.",
        content: {
            "image/jpeg": { schema: { type: "string", format: "binary" } },
            "image/png": { schema: { type: "string", format: "binary" } },
            "image/webp": { schema: { type: "string", format: "binary" } },
        },
    },
    "404": { $ref: "#/components/responses/NotFound" },
    "500": { $ref: "#/components/responses/ServerError" },
};

export const facePaths: OpenApiPaths = {
    "/api/faces/by-robot/{robotId}": {
        get: publicOperation({
            operationId: "getFacesForRobot",
            summary: "Get Authorized Faces for a robot",
            description: "Public robot synchronization endpoint. The robot ID resolves the tenant.",
            tags: ["Faces"],
            parameters: [{
                name: "robotId",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
            }],
            responses: {
                "200": {
                    description: "Authorized faces and image URLs.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["ok", "faces"],
                        properties: {
                            ok: { type: "boolean" },
                            faces: { type: "array", items: ref("AuthorizedFace") },
                        },
                    } } },
                },
            },
        }, { notFound: true }),
    },
    "/api/faces/visitor-images/{id}": {
        get: publicOperation({
            operationId: "getActiveVisitorImageForRobot",
            summary: "Get an active Visitor image for robot sync",
            tags: ["Faces", "Visitors"],
            parameters: [idParameter("Visitor UUID")],
            responses: imageResponses,
        }, { notFound: true }),
    },
    "/api/faces": {
        get: secured({
            operationId: "listAuthorizedFaces",
            summary: "List Authorized Faces",
            description: tenantScopedDescription,
            tags: ["Faces"],
            responses: {
                "200": {
                    description: "Authorized Faces.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["ok", "faces"],
                        properties: {
                            ok: { type: "boolean" },
                            faces: { type: "array", items: ref("AuthorizedFace") },
                        },
                    } } },
                },
            },
        }),
        post: secured({
            operationId: "createAuthorizedFace",
            summary: "Create an Authorized Face",
            description: `${tenantScopedDescription} Photos are optional when creating a face.`,
            tags: ["Faces"],
            requestBody: photosBody(true),
            responses: { "201": faceResponse("Created face.") },
        }, { validation: true }),
    },
    "/api/faces/{id}": {
        put: secured({
            operationId: "updateAuthorizedFace",
            summary: "Update an Authorized Face",
            description: tenantScopedDescription,
            tags: ["Faces"],
            parameters: [faceId],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                role: { type: "string", nullable: true },
                            },
                        },
                    },
                },
            },
            responses: { "200": faceResponse("Updated face.") },
        }, { validation: true, notFound: true }),
        delete: secured({
            operationId: "deleteAuthorizedFace",
            summary: "Delete an Authorized Face",
            description: tenantScopedDescription,
            tags: ["Faces"],
            parameters: [faceId],
            responses: {
                "200": {
                    description: "Face deleted.",
                    content: { "application/json": { schema: ref("SuccessResponse") } },
                },
            },
        }, { notFound: true }),
    },
    "/api/faces/{id}/images": {
        post: secured({
            operationId: "addAuthorizedFaceImages",
            summary: "Add images to an Authorized Face",
            description: tenantScopedDescription,
            tags: ["Faces"],
            parameters: [faceId],
            requestBody: photosBody(false),
            responses: {
                "200": {
                    description: "Updated image filenames.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["ok", "images"],
                        properties: {
                            ok: { type: "boolean" },
                            images: { type: "array", items: { type: "string" } },
                        },
                    } } },
                },
            },
        }, { validation: true, notFound: true }),
    },
    "/api/faces/{id}/images/{filename}": {
        get: {
            operationId: "getAuthorizedFaceImage",
            summary: "Get an Authorized Face image",
            description: "Public image-friendly route.",
            tags: ["Faces"],
            security: [],
            parameters: [
                faceId,
                { name: "filename", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: imageResponses,
        },
        delete: secured({
            operationId: "deleteAuthorizedFaceImage",
            summary: "Delete an Authorized Face image",
            description: tenantScopedDescription,
            tags: ["Faces"],
            parameters: [
                faceId,
                { name: "filename", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: {
                "200": {
                    description: "Updated image filenames.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["ok", "images"],
                        properties: {
                            ok: { type: "boolean" },
                            images: { type: "array", items: { type: "string" } },
                        },
                    } } },
                },
            },
        }, { notFound: true }),
    },
};

