import jwt from "jsonwebtoken";
import {
    signAccessToken,
    signAuthToken,
    signRefreshToken,
    verifyAccessToken,
    verifyAuthToken,
    verifyRefreshToken,
} from "./token";

const ACCESS_SECRET = "unit-test-access-secret";
const REFRESH_SECRET = "unit-test-refresh-secret";
const ENV_KEYS = [
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_ACCESS_EXPIRES_IN",
    "JWT_EXPIRES_IN",
    "JWT_REFRESH_EXPIRES_IN",
] as const;

const accessPayload = {
    userId: "user-123",
    tenantId: "tenant-456",
    roleId: 7,
    roleName: "Operator",
};

const refreshPayload = {
    ...accessPayload,
    sessionId: "session-789",
};

describe("token service", () => {
    const originalEnvironment = new Map<string, string | undefined>();

    beforeEach(() => {
        for (const key of ENV_KEYS) {
            originalEnvironment.set(key, process.env[key]);
        }

        process.env.JWT_SECRET = ACCESS_SECRET;
        process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
        process.env.JWT_ACCESS_EXPIRES_IN = "15m";
        process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            const originalValue = originalEnvironment.get(key);
            if (originalValue === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = originalValue;
            }
        }
        originalEnvironment.clear();
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe("Access Tokens", () => {
        it("signs an Access Token that is verifiable and contains the access type", () => {
            const token = signAccessToken(accessPayload);

            const decoded = jwt.verify(token, ACCESS_SECRET) as jwt.JwtPayload;

            expect(decoded).toMatchObject({ ...accessPayload, type: "access" });
            expect(verifyAccessToken(token)).toEqual(accessPayload);
        });

        it("returns an identity without an optional roleName", () => {
            const { roleName: _roleName, ...payloadWithoutRoleName } = accessPayload;
            const token = signAccessToken(payloadWithoutRoleName);

            expect(verifyAccessToken(token)).toEqual(payloadWithoutRoleName);
        });

        it("keeps signAuthToken as a backwards-compatible Access Token alias", () => {
            const token = signAuthToken(accessPayload);

            expect(jwt.verify(token, ACCESS_SECRET)).toMatchObject({
                ...accessPayload,
                type: "access",
            });
        });

        it("keeps verifyAuthToken as a backwards-compatible Access Token alias", () => {
            const token = signAccessToken(accessPayload);

            expect(verifyAuthToken(token)).toEqual(accessPayload);
        });

        it("rejects a Refresh Token", () => {
            const token = jwt.sign({ ...refreshPayload, type: "refresh" }, ACCESS_SECRET);

            expect(() => verifyAccessToken(token)).toThrow("Invalid access token type");
        });

        it("rejects a malformed token", () => {
            expect(() => verifyAccessToken("not-a-jwt")).toThrow();
        });

        it("rejects a token signed with the wrong secret", () => {
            const token = jwt.sign({ ...accessPayload, type: "access" }, "wrong-secret");

            expect(() => verifyAccessToken(token)).toThrow();
        });

        it("rejects an expired token without waiting for time to pass", () => {
            const token = jwt.sign({ ...accessPayload, type: "access" }, ACCESS_SECRET, {
                expiresIn: -1,
            });

            expect(() => verifyAccessToken(token)).toThrow(/expired/i);
        });

        it.each([
            ["userId", { tenantId: accessPayload.tenantId, roleId: accessPayload.roleId }],
            ["tenantId", { userId: accessPayload.userId, roleId: accessPayload.roleId }],
            ["roleId", { userId: accessPayload.userId, tenantId: accessPayload.tenantId }],
            ["non-numeric roleId", { ...accessPayload, roleId: "7" }],
        ])("rejects a token missing or invalid %s", (_label, invalidPayload) => {
            const token = jwt.sign({ ...invalidPayload, type: "access" }, ACCESS_SECRET);

            expect(() => verifyAccessToken(token)).toThrow("Invalid authentication token payload");
        });

        it("throws the expected error when signing without JWT_SECRET", () => {
            delete process.env.JWT_SECRET;

            expect(() => signAccessToken(accessPayload)).toThrow(
                "Missing required JWT_SECRET env variable",
            );
        });

        it("throws the expected error when verifying without JWT_SECRET", () => {
            const token = jwt.sign({ ...accessPayload, type: "access" }, ACCESS_SECRET);
            delete process.env.JWT_SECRET;

            expect(() => verifyAccessToken(token)).toThrow(
                "Missing required JWT_SECRET env variable",
            );
        });
    });

    describe("Refresh Tokens", () => {
        it("signs a Refresh Token that is verifiable and contains the refresh type", () => {
            const token = signRefreshToken(refreshPayload);

            const decoded = jwt.verify(token, REFRESH_SECRET) as jwt.JwtPayload;

            expect(decoded).toMatchObject({ ...refreshPayload, type: "refresh" });
        });

        it("returns the refresh identity and expiry as a valid Date", () => {
            const token = signRefreshToken(refreshPayload);

            const verified = verifyRefreshToken(token);

            expect(verified).toMatchObject(refreshPayload);
            expect(verified.expiresAt).toBeInstanceOf(Date);
            expect(Number.isNaN(verified.expiresAt.getTime())).toBe(false);
        });

        it("returns a refresh identity without an optional roleName", () => {
            const { roleName: _roleName, ...payloadWithoutRoleName } = refreshPayload;
            const token = signRefreshToken(payloadWithoutRoleName);

            expect(verifyRefreshToken(token)).toMatchObject(payloadWithoutRoleName);
            expect(verifyRefreshToken(token).roleName).toBeUndefined();
        });

        it("rejects an Access Token", () => {
            const token = jwt.sign({ ...accessPayload, type: "access" }, REFRESH_SECRET, {
                expiresIn: "15m",
            });

            expect(() => verifyRefreshToken(token)).toThrow("Invalid refresh token type");
        });

        it("rejects a malformed token", () => {
            expect(() => verifyRefreshToken("not-a-jwt")).toThrow();
        });

        it("rejects a token signed with the wrong Refresh secret", () => {
            const token = jwt.sign({ ...refreshPayload, type: "refresh" }, "wrong-secret", {
                expiresIn: "7d",
            });

            expect(() => verifyRefreshToken(token)).toThrow();
        });

        it("rejects an expired token without waiting for time to pass", () => {
            const token = jwt.sign({ ...refreshPayload, type: "refresh" }, REFRESH_SECRET, {
                expiresIn: -1,
            });

            expect(() => verifyRefreshToken(token)).toThrow(/expired/i);
        });

        it.each([
            ["sessionId", { ...accessPayload }],
            ["userId", { ...refreshPayload, userId: undefined }],
            ["tenantId", { ...refreshPayload, tenantId: undefined }],
            ["roleId", { ...refreshPayload, roleId: undefined }],
            ["non-numeric roleId", { ...refreshPayload, roleId: "7" }],
        ])("rejects a token missing or invalid %s", (_label, invalidPayload) => {
            const token = jwt.sign({ ...invalidPayload, type: "refresh" }, REFRESH_SECRET, {
                expiresIn: "7d",
            });

            expect(() => verifyRefreshToken(token)).toThrow("Invalid refresh token payload");
        });

        it("rejects a Refresh Token without an expiry", () => {
            const token = jwt.sign({ ...refreshPayload, type: "refresh" }, REFRESH_SECRET);

            expect(() => verifyRefreshToken(token)).toThrow("Refresh token is missing expiry");
        });

        it("uses JWT_REFRESH_SECRET when it is configured", () => {
            const token = signRefreshToken(refreshPayload);

            expect(() => jwt.verify(token, ACCESS_SECRET)).toThrow();
            expect(verifyRefreshToken(token)).toMatchObject(refreshPayload);
        });

        it("falls back to JWT_SECRET when JWT_REFRESH_SECRET is absent", () => {
            delete process.env.JWT_REFRESH_SECRET;
            const token = signRefreshToken(refreshPayload);

            expect(jwt.verify(token, ACCESS_SECRET)).toMatchObject({ type: "refresh" });
            expect(verifyRefreshToken(token)).toMatchObject(refreshPayload);
        });
    });
});
