import bcrypt from "bcrypt";
import { hashPassword, verifyPassword } from "./password";

jest.mock("bcrypt", () => ({
    __esModule: true,
    default: {
        hash: jest.fn(),
        compare: jest.fn(),
    },
}));

const hashMock = bcrypt.hash as unknown as jest.MockedFunction<
    (password: string, saltRounds: number) => Promise<string>
>;
const compareMock = bcrypt.compare as unknown as jest.MockedFunction<
    (password: string, passwordHash: string) => Promise<boolean>
>;

describe("password service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe("hashPassword", () => {
        it("hashes the supplied password with exactly 12 salt rounds and returns the hash", async () => {
            hashMock.mockImplementation(async () => "stored-password-hash");

            const result = await hashPassword("plain-password");

            expect(hashMock).toHaveBeenCalledTimes(1);
            expect(hashMock).toHaveBeenCalledWith("plain-password", 12);
            expect(result).toBe("stored-password-hash");
        });

        it("propagates a bcrypt hashing error", async () => {
            const error = new Error("hash failed");
            hashMock.mockRejectedValue(error);

            await expect(hashPassword("plain-password")).rejects.toBe(error);
        });
    });

    describe("verifyPassword", () => {
        it.each([true, false])("returns %s when bcrypt compare returns %s", async (matches) => {
            compareMock.mockImplementation(async () => matches);

            const result = await verifyPassword("plain-password", "stored-password-hash");

            expect(compareMock).toHaveBeenCalledTimes(1);
            expect(compareMock).toHaveBeenCalledWith("plain-password", "stored-password-hash");
            expect(result).toBe(matches);
        });

        it("propagates a bcrypt comparison error", async () => {
            const error = new Error("compare failed");
            compareMock.mockRejectedValue(error);

            await expect(verifyPassword("plain-password", "stored-password-hash")).rejects.toBe(error);
        });
    });
});
